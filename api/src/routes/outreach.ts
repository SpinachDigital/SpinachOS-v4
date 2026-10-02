/*
 * routes/outreach.ts — Sprint 9 §2: SAFE, approval-gated outreach.
 *
 * FLOW: qualify → outreach DRAFT → THE INBOX (approvals) → founder approves
 *       → send → logged. NOTHING sends without founder approval. Ever.
 *
 * SAFETY (non-negotiable):
 * - Deterministic qualification signals (budget/intent/fit keyword rules) —
 *   no black-box "AI says qualified". The rule hits are stored on the draft.
 * - Duplicate guard: DB unique index uq_outreach_msgs_lead_channel + a
 *   pre-flight check — never outreach the same lead twice per channel.
 * - Rate limits per channel/day are HARDCODED constants (not configurable):
 *   email 20/day, linkedin 10/day, threads 5/day, x 5/day.
 * - ToS-clean only: no channel integration is automated here. A send marks
 *   the message logged with lead + draft + approver + timestamp; actual
 *   delivery is manual (founder copies the approved draft) until a clean
 *   provider (ESP) exists. Gray paths (browser/CDP automation) never run.
 */
import { app, authMiddleware, emitApproval, emitFeed, sanitizeText, supabase } from '../ctx';

// §2 SAFETY: hardcoded rate limits per channel/day — NOT configurable-by-accident
const RATE_LIMITS_PER_DAY: Record<string, number> = {
  email: 20,
  linkedin: 10,
  threads: 5,
  x: 5,
};

// §2 SAFETY: deterministic qualification rules — visible, explainable signals
interface QualificationRule { signal: 'budget' | 'intent' | 'fit'; hit: boolean; reason: string }

function qualifyLead(lead: any): { qualified: boolean; score: number; rules: QualificationRule[] } {
  const rules: QualificationRule[] = [];
  const hay = [
    lead.name, lead.company, lead.role, lead.email,
    String((lead.metadata as any)?.raw_data?.title || ''),
    String((lead.metadata as any)?.raw_data?.text || ''),
    String((lead.metadata as any)?.notes || ''),
  ].filter(Boolean).join(' ').toLowerCase();

  // BUDGET signal: explicit money/hiring keywords in the lead's own text
  const budgetHits = ['budget', 'paid', 'pricing', 'quote', 'hiring', 'quote', '₹', 'budget for', 'retainer'];
  const budgetHit = budgetHits.some(k => hay.includes(k));
  rules.push({ signal: 'budget', hit: budgetHit, reason: budgetHit ? 'explicit budget/hiring keywords in lead text' : 'no budget keywords found' });

  // INTENT signal: in-market keywords (looking for/need a/agency)
  const intentHits = ['looking for', 'need a', 'need an', 'agency', 'recommend', 'suggest', 'rfp', 'proposal'];
  const intentHit = intentHits.some(k => hay.includes(k));
  rules.push({ signal: 'intent', hit: intentHit, reason: intentHit ? 'in-market keywords found' : 'no in-market keywords found' });

  // FIT signal: the lead's source is one of our clean inbound surfaces + has a role/company
  const fitHit = ['github', 'hackernews', 'google_maps', 'clutch', 'goodfirms'].includes(lead.source) && !!(lead.company || lead.role);
  rules.push({ signal: 'fit', hit: fitHit, reason: fitHit ? `source ${lead.source} + company/role present` : `source ${lead.source} or missing company/role` });

  // DETERMINISTIC: qualified = ALL three signals hit (no black-box scoring).
  const qualified = rules.every(r => r.hit);
  const score = rules.filter(r => r.hit).length;
  return { qualified, score, rules };
}

// GET /api/v1/outreach/drafts?status= — list drafts (THE INBOX feeds on these)
app.get('/api/v1/outreach/drafts', authMiddleware, async (req, res) => {
  try {
    const { status, lead_id } = req.query;
    let query = supabase.from('outreach_drafts').select('*, leads(name, company, source, email)')
      .order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', String(status));
    if (lead_id) query = query.eq('lead_id', String(lead_id));
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: `${error.message} (run supabase/migration-sprint9-win.sql if the table is missing)` });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/outreach/qualify/:leadId — deterministic qualification (visible rules)
app.post('/api/v1/outreach/qualify/:leadId', authMiddleware, async (req, res) => {
  try {
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', req.params.leadId).single();
    if (error || !lead) return res.status(404).json({ error: 'lead not found' });
    const q = qualifyLead(lead);
    const { data, error: upErr } = await supabase.from('leads').update({
      budget_signal: q.rules.find(r => r.signal === 'budget')?.hit ? 'has_budget' : 'unknown',
      intent_signal: q.rules.find(r => r.signal === 'intent')?.hit ? 'in_market' : 'unknown',
      fit_signal: q.rules.find(r => r.signal === 'fit')?.hit ? 'good_fit' : 'unknown',
      qualified_at: q.qualified ? new Date().toISOString() : null,
      status: q.qualified && lead.status === 'new' ? 'qualified' : lead.status,
    }).eq('id', lead.id).select().single();
    if (upErr) return res.status(500).json({ error: `${upErr.message} (run supabase/migration-sprint9-win.sql for the qualification columns)` });
    res.json({ qualified: q.qualified, score: q.score, rules: q.rules, lead: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/outreach/draft — create a draft (agent-only, from a QUALIFIED lead)
app.post('/api/v1/outreach/draft', authMiddleware, async (req, res) => {
  try {
    const { lead_id, channel = 'email', subject, body, generated_by = 'sales' } = req.body || {};
    if (!lead_id || !body) return res.status(400).json({ error: 'lead_id and body required' });
    if (!RATE_LIMITS_PER_DAY[channel]) return res.status(400).json({ error: `channel must be one of: ${Object.keys(RATE_LIMITS_PER_DAY).join(', ')}` });

    // §2 SAFETY: the lead must be QUALIFIED (deterministic) before any draft
    const { data: lead, error: leadErr } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (leadErr || !lead) return res.status(404).json({ error: 'lead not found' });
    const q = qualifyLead(lead);
    if (!q.qualified) return res.status(400).json({
      error: 'lead not qualified — all three signals (budget/intent/fit) must hit',
      rules: q.rules,
    });

    // §2 SAFETY: duplicate guard — never outreach the same lead twice per channel
    const { data: existing } = await supabase.from('outreach_messages')
      .select('id').eq('lead_id', lead_id).eq('channel', channel).maybeSingle();
    if (existing) return res.status(409).json({ error: `duplicate: ${channel} outreach already sent to this lead (uq_outreach_msgs_lead_channel)` });
    const { data: existingDraft } = await supabase.from('outreach_drafts')
      .select('id').eq('lead_id', lead_id).eq('channel', channel).in('status', ['draft', 'pending_approval', 'approved', 'sent']).maybeSingle();
    if (existingDraft) return res.status(409).json({ error: 'duplicate: an active draft for this lead+channel already exists' });

    const { data, error } = await supabase.from('outreach_drafts').insert({
      lead_id, channel,
      subject: subject ? sanitizeText(subject, 200) : null,
      body: sanitizeText(body, 5000),
      qualification: { rules: q.rules, score: q.score, qualified_at: new Date().toISOString() },
      status: 'draft',
      generated_by,
    }).select().single();
    if (error) return res.status(500).json({ error: `${error.message} (run supabase/migration-sprint9-win.sql if the table is missing)` });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/outreach/drafts/:id/queue — move draft → THE INBOX (approval gate)
// Creates the ApprovalCard object; the card and the queue operate on the SAME approval row.
app.post('/api/v1/outreach/drafts/:id/queue', authMiddleware, async (req, res) => {
  try {
    const { data: draft, error: dErr } = await supabase.from('outreach_drafts').select('*').eq('id', req.params.id).single();
    if (dErr || !draft) return res.status(404).json({ error: 'draft not found' });
    if (draft.status !== 'draft') return res.status(400).json({ error: `draft status is '${draft.status}' — only 'draft' can be queued` });

    // §2 SAFETY: rate limit check at queue time (hardcoded limits)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from('outreach_messages')
      .select('id', { count: 'exact', head: true }).eq('channel', draft.channel).gte('sent_at', since);
    const limit = RATE_LIMITS_PER_DAY[draft.channel];
    if ((count ?? 0) >= limit) return res.status(429).json({ error: `rate limit: ${draft.channel} allows ${limit}/day (hardcoded), ${count} sent in the last 24h — the draft waits in the inbox` });

    // THE INBOX: the approval card IS the gate
    // Sprint 9 fix: fetch the lead name — the select('*') join on drafts
    // doesn't resolve relations on .single() (observed: title showed the
    // short lead id instead of the business name).
    const { data: leadRow } = await supabase.from('leads').select('name, company').eq('id', draft.lead_id).single();
    const leadLabel = leadRow?.company || leadRow?.name || String(draft.lead_id).slice(0, 8);
    const { data: approval, error: aErr } = await supabase.from('approvals').insert({
      type: 'outreach',
      title: `Outreach ${draft.channel} — ${leadLabel}`,
      description: draft.subject || draft.body.slice(0, 120),
      platform: draft.channel,
      status: 'pending',
      requested_by: draft.generated_by || 'sales',
      payload_json: {
        kind: 'outreach',
        draft_id: draft.id,
        lead_id: draft.lead_id,
        channel: draft.channel,
        subject: draft.subject,
        body: draft.body,
        qualification: draft.qualification,
      },
    }).select().single();
    if (aErr) return res.status(500).json({ error: `approval create failed: ${aErr.message}` });

    const { error: uErr } = await supabase.from('outreach_drafts').update({
      status: 'pending_approval', approval_id: approval.id, updated_at: new Date().toISOString(),
    }).eq('id', draft.id);
    if (uErr) return res.status(500).json({ error: uErr.message });

    emitApproval({ ...approval, action: 'created' });
    emitFeed('sales', 'OUTREACH_QUEUED', { draft_id: draft.id, approval_id: approval.id, channel: draft.channel });
    res.json({ ok: true, approval_id: approval.id, draft_id: draft.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/outreach/send/:draftId — THE SEND (only post-approval, ever)
// Called after the founder approves the ApprovalCard. Logs the message with
// lead + draft + approver + timestamp (audit trail or it didn't happen).
app.post('/api/v1/outreach/send/:draftId', authMiddleware, async (req, res) => {
  try {
    const { data: draft, error: dErr } = await supabase.from('outreach_drafts').select('*, leads(name, company, email)').eq('id', req.params.draftId).single();
    if (dErr || !draft) return res.status(404).json({ error: 'draft not found' });

    // §2 SAFETY: NOTHING sends without founder approval. Ever.
    if (draft.status !== 'approved' || !draft.approval_id) {
      return res.status(403).json({
        error: `send blocked: draft status '${draft.status}' — founder approval required first (queue the draft, approve the card in THE INBOX)`,
      });
    }
    // The approval row itself must be approved (same object as the card/queue)
    const { data: approval } = await supabase.from('approvals').select('id, status, approved_by, reviewed_at').eq('id', draft.approval_id).single();
    if (!approval || approval.status !== 'approved') {
      return res.status(403).json({ error: `send blocked: approval ${draft.approval_id?.slice(0, 8)} is '${approval?.status || 'missing'}' — approve the card first` });
    }

    // §2 SAFETY: duplicate guard at send time (the DB unique index is the backstop)
    const { data: existing } = await supabase.from('outreach_messages')
      .select('id').eq('lead_id', draft.lead_id).eq('channel', draft.channel).maybeSingle();
    if (existing) return res.status(409).json({ error: 'duplicate: this lead+channel was already sent' });

    // §2 ToS-clean: mark logged — actual delivery is manual (founder copies the
    // approved draft) until a clean ESP/provider exists. No browser automation.
    const { data: msg, error: mErr } = await supabase.from('outreach_messages').insert({
      draft_id: draft.id, lead_id: draft.lead_id, channel: draft.channel,
      subject: draft.subject, body: draft.body,
      sent_by: 'founder', approved_by: approval.approved_by || 'director',
    }).select().single();
    if (mErr) return res.status(500).json({ error: `${mErr.message} (run supabase/migration-sprint9-win.sql if the table is missing)` });

    await supabase.from('outreach_drafts').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', draft.id);
    await supabase.from('leads').update({ last_outreach_at: new Date().toISOString(), status: 'contacted' }).eq('id', draft.lead_id);

    emitFeed('sales', 'OUTREACH_SENT', { draft_id: draft.id, lead_id: draft.lead_id, channel: draft.channel, approved_by: approval.approved_by });
    res.json({ ok: true, message_id: msg.id, logged: { lead: draft.lead_id, draft: draft.id, approver: approval.approved_by, sent_at: msg.sent_at }, delivery: 'manual — copy the approved draft (no automated channel until a clean provider exists)' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/outreach/messages — the audit trail (every send, ever)
app.get('/api/v1/outreach/messages', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('outreach_messages')
      .select('*, leads(name, company, source)').order('sent_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: `${error.message} (run supabase/migration-sprint9-win.sql if the table is missing)` });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
