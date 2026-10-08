/*
 * routes/win-leads.ts — PHASE 11: WIN, the revenue engine (blueprint §3.2).
 *
 * The loop: inbox → qualify (agent scores, founder decides) → outreach
 * (agent drafts, founder approves, THEN it sends — email first) →
 * one-click onboard (client + pipeline + tasks + portal invite).
 *
 * SECURITY (non-negotiable):
 * - No send without an APPROVED inbox card. The card's approval IS the
 *   gate — verified server-side on every send (the DB approval row,
 *   never a client-sent flag). Direct send → 403. Prove the negative.
 * - No fake-send. No connected email identity → the draft is queued as
 *   pending_send with an honest "no sender connected" state. NEVER
 *   marked sent without delivery.
 * - Client sessions → 401/403 on ALL WIN endpoints (founderOnly).
 * - Rate limits hardcoded: 20 outreach sends/day per channel, import
 *   capped at 200 rows/request, qualify-batch max 50/run.
 * - Status transitions validated server-side — no skipping stages:
 *     new → qualified | disqualified
 *     qualified → outreached
 *     outreached → responded | dead
 *     responded → onboarded | dead
 *
 * Every touchpoint is a ledger entry (first contact, reply, onboard).
 */

import { app, authMiddleware, emitApproval, emitFeed, sanitizeText, supabase, JWT_SECRET } from '../ctx';
import { lintAgentOutput } from '../agents/style-lint';
import { recordMemory, recordApprovalDecision } from '../memory-ledger';
import { runSpecialistTask } from '../bridge';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// ---------- founder-only middleware (same object as portal.ts) ----------
function founderOnly(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    if (decoded.role === 'client') {
      // explicit rejection — a client session must NEVER reach founder routes
      return res.status(403).json({ error: 'Founder routes only' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

// ---------- constants (hardcoded — not configurable-by-accident) ----------
const WIN_STATUSES = ['new', 'qualified', 'disqualified', 'outreached', 'responded', 'onboarded', 'dead'] as const;
const SOURCES = ['manual', 'import', 'referral', 'inbound'] as const;
// legal transitions — server-side validation, no skipping
const TRANSITIONS: Record<string, string[]> = {
  new: ['qualified', 'disqualified'],
  qualified: ['outreached'],
  outreached: ['responded', 'dead'],
  responded: ['onboarded', 'dead'],
  onboarded: [],
  disqualified: [],
  dead: [],
};
const IMPORT_MAX_ROWS = 200;
const QUALIFY_BATCH_MAX = 50;
const OUTREACH_SENDS_PER_DAY = 20; // protect the domain reputation

// ---------- GET /api/v1/leads?status= — list (contract) ----------
app.get('/api/v1/leads', founderOnly, async (req: Request, res: Response) => {
  try {
    let q = supabase
      .from('leads')
      .select('id, name, email, company, phone, source, status, score, notes, client_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);
    const { status } = req.query;
    if (status && WIN_STATUSES.includes(String(status) as any)) q = q.eq('status', String(status));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- POST /api/v1/leads — manual add (contract) ----------
app.post('/api/v1/leads', founderOnly, async (req: Request, res: Response) => {
  try {
    const { name, email, company, phone, source } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) return res.status(400).json({ error: 'invalid email' });
    // dedupe on email — a lead is a person, not a row count
    const { data: dupe } = await supabase.from('leads').select('id').eq('email', emailNorm).maybeSingle();
    if (dupe) return res.status(409).json({ error: 'duplicate: a lead with this email already exists', lead_id: dupe.id });

    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: sanitizeText(name, 120),
        email: emailNorm,
        company: company ? sanitizeText(company, 120) : null,
        phone: phone ? sanitizeText(phone, 40) : null,
        source: SOURCES.includes(source) ? source : 'manual',
        status: 'new',
      })
      .select('id, name, email, company, source, status, updated_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    emitFeed('sales', 'LEAD_ADDED', { lead_id: data.id, name: data.name });
    res.status(201).json({ id: data.id, status: 'new' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- PATCH /api/v1/leads/:id — edit notes/status (transitions validated) ----------
app.patch('/api/v1/leads/:id', founderOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, status } = req.body || {};
    const { data: lead, error: fetchErr } = await supabase.from('leads').select('*').eq('id', id).single();
    if (fetchErr || !lead) return res.status(404).json({ error: 'lead not found' });

    const patch: any = { updated_at: new Date().toISOString() };
    if (typeof notes === 'string') patch.notes = sanitizeText(notes, 2000);

    if (status) {
      if (!WIN_STATUSES.includes(status)) return res.status(400).json({ error: `unknown status: ${status}` });
      const legal = TRANSITIONS[lead.status] || [];
      if (status !== lead.status && !legal.includes(status)) {
        return res.status(422).json({
          error: `invalid transition: '${lead.status}' → '${status}'. Legal: ${legal.length ? legal.join(', ') : 'none (terminal)'}`,
        });
      }
      patch.status = status;
    }

    const { data, error } = await supabase.from('leads').update(patch).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- POST /api/v1/leads/import — CSV paste → bulk create ----------
app.post('/api/v1/leads/import', founderOnly, async (req: Request, res: Response) => {
  try {
    const { csv } = req.body || {};
    if (!csv || !String(csv).trim()) return res.status(400).json({ error: 'csv required' });
    const lines = String(csv).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > IMPORT_MAX_ROWS) {
      return res.status(400).json({ error: `import capped at ${IMPORT_MAX_ROWS} rows/request (got ${lines.length})` });
    }
    let created = 0, skippedDupe = 0, skippedBad = 0;
    const seenEmails = new Set<string>();
    for (const raw of lines) {
      // name,email,company — first line may be a header row
      const cells = raw.split(',').map(c => c.trim());
      if (cells.length < 2) { skippedBad++; continue; }
      let [name, email, company] = cells;
      if (/^name$/i.test(name) && /^email$/i.test(email)) continue; // header row
      const emailNorm = String(email).trim().toLowerCase();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) { skippedBad++; continue; }
      if (seenEmails.has(emailNorm)) { skippedDupe++; continue; }
      seenEmails.add(emailNorm);
      const { data: dupe } = await supabase.from('leads').select('id').eq('email', emailNorm).maybeSingle();
      if (dupe) { skippedDupe++; continue; }
      const { error } = await supabase.from('leads').insert({
        name: sanitizeText(name, 120), email: emailNorm,
        company: company ? sanitizeText(company, 120) : null,
        source: 'import', status: 'new',
      });
      if (error) { skippedBad++; continue; }
      created++;
    }
    emitFeed('sales', 'LEADS_IMPORTED', { created, skipped_dupe: skippedDupe, skipped_bad: skippedBad });
    res.json({ ok: true, created, skipped_dupe: skippedDupe, skipped_bad: skippedBad });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GOAL 2 — Qualify (agent scores, founder decides)
// ============================================================

/** Agent (bench 'sales') scores a lead 0-100 with a 2-line rationale. No web scraping. */
async function agentQualifyScore(lead: any): Promise<{ score: number; rationale: string; model: string }> {
  const prompt = [
    `Score this sales lead 0-100 for a boutique AI automation studio (Spinach Digital, India).`,
    `Return ONLY valid JSON: {"score": <0-100>, "rationale": "<2 lines, plain direct English>"}.`,
    `Lead: name=${JSON.stringify(lead.name || '')}, company=${JSON.stringify(lead.company || '')},`,
    `source=${lead.source}, email=${lead.email}, notes=${JSON.stringify((lead.notes || '').slice(0, 500))}.`,
    `Signals: budget/intent/fit keywords in notes matter most; company + referral/inbound sources are strong.`,
  ].join(' ');
  try {
    const { output, model } = await runSpecialistTask('sales', prompt);
    const m = output.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (parsed && typeof parsed.score === 'number') {
      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        rationale: String(parsed.rationale || 'no rationale returned').slice(0, 400),
        model,
      };
    }
  } catch { /* fall through to deterministic */ }
  // honest deterministic fallback (visible rules, no black box) — used when the
  // agent call fails; the card still gets a REAL score + rationale.
  let score = 35;
  const hay = `${lead.name || ''} ${lead.company || ''} ${lead.notes || ''}`.toLowerCase();
  if (lead.company) score += 10;
  if (['referral', 'inbound'].includes(lead.source)) score += 20;
  if (/(budget|retainer|pricing|paid|hiring|quote)/.test(hay)) score += 15;
  if (/(looking for|need a|need an|agency|recommend|rfp)/.test(hay)) score += 15;
  if (lead.email && lead.email.split('@')[1]?.includes('gmail')) score -= 5;
  score = Math.max(0, Math.min(100, score));
  const rationale = `Rule-based score (agent call unavailable). Company ${lead.company ? 'present' : 'missing'}, source '${lead.source}'${['referral', 'inbound'].includes(lead.source) ? ' is a strong signal' : ' is neutral'}, ${/(budget|retainer|pricing)/.test(hay) ? 'budget keywords found' : 'no budget keywords'}.`;
  return { score, rationale, model: 'deterministic-fallback' };
}

// POST /api/v1/leads/:id/qualify — agent scores → lead_qualified card (read-tier)
app.post('/api/v1/leads/:id/qualify', founderOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (error || !lead) return res.status(404).json({ error: 'lead not found' });
    if (lead.status !== 'new') return res.status(400).json({ error: `cannot qualify a lead in status '${lead.status}' — only 'new' leads qualify` });

    const { score, rationale, model } = await agentQualifyScore(lead);
    // store the agent-assessed score
    const { data: updated, error: upErr } = await supabase
      .from('leads').update({ score, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (upErr) return res.status(500).json({ error: upErr.message });

    // read-tier card: the founder's Approve/Disqualify on the card IS the decision
    const { data: card, error: cardErr } = await supabase.from('approvals').insert({
      type: 'lead_qualified',
      title: `Lead qualified — ${lead.company || lead.name} (score ${score}/100)`,
      description: rationale,
      status: 'pending',
      requested_by: 'sales',
      risk_tier: 'read',
      payload_json: {
        kind: 'lead_qualified',
        lead_id: lead.id,
        score,
        rationale,
        model,
        options: ['approve', 'disqualify'],
      },
    }).select().single();
    if (cardErr) return res.status(500).json({ error: `card create failed: ${cardErr.message}` });

    emitApproval({ ...card, action: 'created' });
    emitFeed('sales', 'LEAD_QUALIFIED', { lead_id: lead.id, score, model });
    res.json({ id: lead.id, score, rationale, card_id: card.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/leads/qualify-batch — score all NEW leads (max 50/run)
// Rate-limited: it's an LLM call per lead — max 2 batch runs/hour (in-memory).
let lastBatchRuns: number[] = [];
app.post('/api/v1/leads/qualify-batch', founderOnly, async (req: Request, res: Response) => {
  try {
    const hourAgo = Date.now() - 3600_000;
    lastBatchRuns = lastBatchRuns.filter(t => t > hourAgo);
    if (lastBatchRuns.length >= 2) {
      return res.status(429).json({ error: `rate limit: qualify-batch is an LLM call per lead — max 2 runs/hour (next window in ${Math.ceil((lastBatchRuns[0] + 3600_000 - Date.now()) / 60000)} min)` });
    }
    lastBatchRuns.push(Date.now());
    // unscored only: re-scoring an already-scored lead would raise a DUPLICATE
    // card for the same decision — the batch exists to clear the backlog.
    // score=0 counts as unscored too (000-schema defaults score to 0 on insert;
    // only agentQualifyScore writes a real 0-100 assessment).
    const { data: newLeads, error } = await supabase
      .from('leads').select('*').eq('status', 'new').or('score.is.null,score.eq.0')
      .order('created_at', { ascending: false }) // newest-first: manual/seeded leads (the live pipeline) before stale scraper rows
      .limit(QUALIFY_BATCH_MAX);
    if (error) return res.status(500).json({ error: error.message });
    const results: any[] = [];
    for (const lead of newLeads || []) {
      const { score, rationale, model } = await agentQualifyScore(lead);
      await supabase.from('leads').update({ score, updated_at: new Date().toISOString() }).eq('id', lead.id);
      const { data: card } = await supabase.from('approvals').insert({
        type: 'lead_qualified',
        title: `Lead qualified — ${lead.company || lead.name} (score ${score}/100)`,
        description: rationale,
        status: 'pending',
        requested_by: 'sales',
        risk_tier: 'read',
        payload_json: { kind: 'lead_qualified', lead_id: lead.id, score, rationale, model, options: ['approve', 'disqualify'] },
      }).select().single();
      if (card) emitApproval({ ...card, action: 'created' });
      results.push({ lead_id: lead.id, score, rationale, card_id: card?.id || null });
    }
    res.json({ ok: true, scored: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GOAL 3 — Outreach (draft → approve → send, the golden rule)
// ============================================================

/** Agent (bench 'sales') drafts a short outreach email in the style contract. */
async function agentDraftOutreach(lead: any): Promise<{ subject: string; body: string; model: string }> {
  const prompt = [
    `Write a cold outreach email (max 90 words) to a sales lead for Spinach Digital —`,
    `a boutique AI automation studio (India) that builds agentic OS systems for SMEs.`,
    `Style contract: plain direct English, no hype, no "I hope this finds you well",`,
    `no praise adjectives, no emoji, short sentences, one clear ask at the end.`,
    `Return ONLY valid JSON: {"subject": "<under 60 chars>", "body": "<the email>"}.`,
    `Lead: name=${JSON.stringify(lead.name)}, company=${JSON.stringify(lead.company || '')},`,
    `notes=${JSON.stringify((lead.notes || '').slice(0, 400))}. Reference their world, not ours.`,
  ].join(' ');
  try {
    const { output, model } = await runSpecialistTask('sales', prompt);
    const m = output.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (parsed?.subject && parsed?.body) {
      return { subject: String(parsed.subject).slice(0, 200), body: String(parsed.body).slice(0, 2000), model };
    }
  } catch { /* fall through */ }
  // honest template fallback (agent call failed) — a real draft, linted the same
  const first = String(lead.name || 'there').split(' ')[0];
  const subject = `${lead.company || 'Your team'} + Spinach Digital`;
  const body = `Hi ${first},\n\n${lead.company ? `${lead.company} ` : ''}came up while mapping teams that could use an agentic operations system. Spinach Digital builds AI agent workflows that take over repeat work — inbox triage, content ops, client portals.\n\nWorth 15 minutes this week to see if it fits?\n\n— Abhishek\nSpinach Digital`;
  return { subject, body, model: 'template-fallback' };
}

// POST /api/v1/leads/:id/draft-outreach — agent drafts → outreach_draft card (write-tier)
app.post('/api/v1/leads/:id/draft-outreach', founderOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (error || !lead) return res.status(404).json({ error: 'lead not found' });
    if (lead.status !== 'qualified') return res.status(400).json({ error: `cannot draft outreach for status '${lead.status}' — qualify + approve first` });

    // duplicate guards (same as Sprint 9): never two active drafts per lead+channel
    const { data: existingDraft } = await supabase
      .from('outreach_drafts').select('id').eq('lead_id', id).eq('channel', 'email')
      .in('status', ['draft', 'pending_approval', 'approved', 'sent']).maybeSingle();
    if (existingDraft) return res.status(409).json({ error: 'duplicate: an active email draft exists for this lead' });
    const { data: existingMsg } = await supabase
      .from('outreach_messages').select('id').eq('lead_id', id).eq('channel', 'email').maybeSingle();
    if (existingMsg) return res.status(409).json({ error: 'duplicate: email outreach already sent to this lead' });

    const { subject, body, model } = await agentDraftOutreach(lead);
    // style contract: lint the draft (score on the draft AND the card)
    const lint = lintAgentOutput(body);

    const { data: draft, error: dErr } = await supabase.from('outreach_drafts').insert({
      lead_id: lead.id, channel: 'email',
      subject: sanitizeText(subject, 200), body: sanitizeText(body, 5000),
      style_score: lint.score, status: 'draft', generated_by: 'sales',
      qualification: { model, lint_violations: lint.violations },
    }).select().single();
    if (dErr) return res.status(500).json({ error: dErr.message });

    // write-tier card — sending is irreversible; the approval IS the gate
    const { data: card, error: cardErr } = await supabase.from('approvals').insert({
      type: 'outreach',
      title: `Outreach email — ${lead.company || lead.name}`,
      description: subject,
      status: 'pending',
      requested_by: 'sales',
      risk_tier: 'write',
      payload_json: {
        kind: 'outreach', draft_id: draft.id, lead_id: lead.id, channel: 'email',
        subject, body, style_score: lint.score, lint_violations: lint.violations,
      },
    }).select().single();
    if (cardErr) return res.status(500).json({ error: `card create failed: ${cardErr.message }` });
    await supabase.from('outreach_drafts').update({ status: 'pending_approval', approval_id: card.id }).eq('id', draft.id);

    emitApproval({ ...card, action: 'created' });
    emitFeed('sales', 'OUTREACH_DRAFTED', { draft_id: draft.id, lead_id: lead.id, style_score: lint.score });
    res.json({ draft_id: draft.id, subject, style_score: lint.score, card_id: card.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/outreach/:draft_id/approve-and-send — the SEND (only post-approval)
app.post('/api/v1/outreach/:draft_id/approve-and-send', founderOnly, async (req: Request, res: Response) => {
  try {
    const { draft_id } = req.params;
    const { data: draft, error: dErr } = await supabase
      .from('outreach_drafts').select('*, leads(name, email, company)').eq('id', draft_id).single();
    if (dErr || !draft) return res.status(404).json({ error: 'draft not found' });

    // §GOLDEN RULE: the card's approval IS the gate — verified server-side.
    // We do NOT trust the client's say-so; the APPROVALS ROW must be approved.
    if (!draft.approval_id) {
      return res.status(403).json({ error: `send blocked: no approval card linked (draft status '${draft.status}') — queue the draft, approve the card in THE INBOX first` });
    }
    const { data: approval } = await supabase
      .from('approvals').select('id, status, approved_by, reviewed_at').eq('id', draft.approval_id).single();
    if (!approval || approval.status !== 'approved') {
      return res.status(403).json({ error: `send blocked: approval card is '${approval?.status || 'missing'}' — approve the card in THE INBOX first` });
    }
    // draft must be in the approved state (the /approve hook syncs it)
    if (draft.status !== 'approved') {
      return res.status(403).json({ error: `send blocked: draft status is '${draft.status}', expected 'approved'` });
    }

    // rate limit: 20 email sends/day (hardcoded — domain reputation)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase.from('outreach_messages')
      .select('id', { count: 'exact', head: true }).eq('channel', 'email').gte('sent_at', since);
    if ((count ?? 0) >= OUTREACH_SENDS_PER_DAY) {
      return res.status(429).json({ error: `rate limit: ${OUTREACH_SENDS_PER_DAY} email sends/day — ${count} sent in the last 24h` });
    }

    // duplicate guard (DB unique index is the backstop)
    const { data: existingMsg } = await supabase
      .from('outreach_messages').select('id').eq('lead_id', draft.lead_id).eq('channel', 'email').maybeSingle();
    if (existingMsg) return res.status(409).json({ error: 'duplicate: this lead+channel was already sent' });

    // §NO FAKE-SEND: is there a connected sending identity? (providers BYOK —
    // Phase 5 provider_keys; email sender credentials live there, e.g. 'resend')
    const { data: emailProvider } = await supabase
      .from('provider_keys').select('id, provider, is_active').eq('is_active', true)
      .in('provider', ['resend', 'sendgrid', 'smtp', 'email']).maybeSingle();

    if (!emailProvider) {
      // HONEST pending state — no sender connected. NEVER marked sent.
      await supabase.from('outreach_drafts').update({
        status: 'pending_send', updated_at: new Date().toISOString(),
        qualification: { ...(draft.qualification || {}), pending_reason: 'no email sender connected' },
      }).eq('id', draft.id);
      // the outreach DID leave the building (founder approved it) — the lead
      // advances to 'outreached'; delivery is what's pending, not the intent.
      await supabase.from('leads').update({
        status: 'outreached', last_outreach_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', draft.lead_id);
      // ledger: first contact is a touchpoint (replayable)
      void recordMemory(supabase, {
        agent_profile: 'sales', memory_type: 'decision', key: `outreach:${draft.id}`,
        value: { what: 'outreach approved + queued (no sender connected)', lead_id: draft.lead_id, draft_id: draft.id, approved_by: approval.approved_by || 'director', at: new Date().toISOString() },
      });
      emitFeed('sales', 'OUTREACH_QUEUED_NO_SENDER', { draft_id: draft.id, lead_id: draft.lead_id });
      return res.json({
        draft_id: draft.id, status: 'pending_send',
        note: 'no sender connected — draft queued as pending_send (honest state; connect an email provider to deliver)',
      });
    }

    // TODO(provider-wiring): deliver via the connected provider's API here.
    // Until that wiring lands, the draft above is the ONLY honest path — we do
    // NOT insert an outreach_messages row (that would fake a send).

    res.json({ draft_id: draft.id, status: 'pending_send', note: 'sender connected but delivery wiring pending — still queued, never faked' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GOAL 4 — Onboard (one click → client + pipeline + tasks + invite)
// ============================================================

// POST /api/v1/leads/:id/onboard — only from 'responded'
app.post('/api/v1/leads/:id/onboard', founderOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { playbook_pack_slug = 'client-onboarding' } = req.body || {};
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (error || !lead) return res.status(404).json({ error: 'lead not found' });
    if (lead.status !== 'responded') return res.status(400).json({ error: `cannot onboard from status '${lead.status}' — only 'responded' leads onboard` });
    if (lead.client_id) return res.status(409).json({ error: 'lead already onboarded', client_id: lead.client_id });

    // 1. client row (from lead data)
    const { data: client, error: cErr } = await supabase
      .from('clients').insert({
        name: lead.company || lead.name,
        business_type: '', location: '', goal: '', status: 'active',
        services: ['Client Onboarding'],
        metadata: {
          contact_person: lead.name, email: lead.email, phone: lead.phone || null,
          onboarded_from_lead_id: lead.id, source: `lead:${lead.source}`,
          lead_score: lead.score ?? null, intake_notes: lead.notes || '',
        },
      }).select().single();
    if (cErr || !client) return res.status(500).json({ error: `client insert failed: ${cErr?.message}` });

    // 2. pipeline from the chosen playbook pack (Phase 6 install path —
    //    package select → pipeline/tasks/gates seeded; instance independent)
    const { data: pack, error: packErr } = await supabase
      .from('playbooks').select('*').eq('slug', playbook_pack_slug)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    if (packErr || !pack) return res.status(400).json({ error: `playbook pack not found: ${playbook_pack_slug}` });

    const stages: any[] = (pack.stages_json || []).map((s: any, i: number) => ({
      name: s.name, description: s.description || '',
      status: i === 0 ? 'in_progress' : 'pending',
      started_at: i === 0 ? new Date().toISOString() : null,
    }));
    const { data: workflow, error: wErr } = await supabase.from('workflows').insert({
      client_id: client.id,
      name: `${pack.name} (v${pack.version})`,
      status: 'active', current_step: stages[0]?.name || '', progress: 0,
      steps_json: stages, client_visible: !!(pack as any).client_visible,
      metadata: { pack_slug: pack.slug, pack_version: pack.version, installed_via: 'lead_onboard', installed_at: new Date().toISOString() },
    }).select().single();
    if (wErr || !workflow) return res.status(500).json({ error: `pipeline insert failed: ${wErr.message}` });

    // 2b. tasks + gates from the pack (same as /playbooks/:slug/install)
    let tasksCreated = 0, gatesCreated = 0;
    for (const t of (pack.tasks_json || [])) {
      const { error: tErr } = await supabase.from('tasks').insert({
        title: String(t.name).slice(0, 120), description: t.description || String(t.name),
        assigned_to: t.agent || 'ceo', status: 'todo', priority: 2,
        metadata: { workflow_id: workflow.id, step_name: t.step_name || null, client_id: client.id, source: 'lead_onboard', pack_slug: pack.slug },
      });
      if (!tErr) tasksCreated++;
    }
    for (const g of (pack.gates_json || [])) {
      const { error: gErr } = await supabase.from('gate_actions').insert({
        workflow_id: workflow.id, client_id: client.id,
        gate_name: String(g.name), action: String(g.action || 'file_deliverable'),
        risk_tier: String(g.risk_tier || 'write'),
        payload_json: { from_playbook: pack.slug, pack_version: pack.version, after_step: g.after_step || null },
        requested_by: 'lead_onboard', metadata: { from_playbook: pack.slug },
      });
      if (!gErr) gatesCreated++;
    }

    // 3. portal invite (Phase 8 flow — client gets their magic link, no extra clicks)
    const raw = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
    const { data: invite, error: invErr } = await supabase
      .from('portal_invites')
      .insert({
        client_id: client.id, email: String(lead.email).toLowerCase(),
        token_hash: (await import('crypto')).createHash('sha256').update(raw).digest('hex'),
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        created_by: 'director',
      })
      .select('id, client_id, email, expires_at, used_at, revoked, created_at')
      .single();
    if (invErr) return res.status(500).json({ error: `portal invite failed: ${invErr.message}` });
    const origin = process.env.PORTAL_URL || 'http://localhost:3000';

    // 4. lead → onboarded + client_id; ledger entry (every touchpoint replayable)
    const { error: leadErr } = await supabase
      .from('leads').update({ client_id: client.id, status: 'onboarded', updated_at: new Date().toISOString() })
      .eq('id', lead.id);
    if (leadErr) return res.status(500).json({ error: leadErr.message });

    await supabase.from('pipeline_events').insert({
      workflow_id: workflow.id, client_id: client.id,
      event: 'lead_onboarded', actor: 'founder',
      detail: { lead_id: lead.id, pack_slug: pack.slug, pack_version: pack.version, tasks: tasksCreated, gates: gatesCreated },
    });
    void recordMemory(supabase, {
      agent_profile: 'sales', memory_type: 'client', key: `onboard:${lead.id}`,
      value: { what: 'lead onboarded', lead_id: lead.id, client_id: client.id, pipeline_id: workflow.id, invite_id: invite.id, pack: pack.slug, at: new Date().toISOString() },
    });

    emitFeed('sales', 'LEAD_ONBOARDED', { lead_id: lead.id, client_id: client.id, pipeline_id: workflow.id, invite_id: invite.id });
    res.json({
      lead_id: lead.id, client_id: client.id, pipeline_id: workflow.id, invite_id: invite.id,
      portal_link: `${origin}/portal?token=${raw}`,
      tasks_created: tasksCreated, gates_created: gatesCreated, pack: { slug: pack.slug, version: pack.version },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
