import { lintAgentOutput } from '../agents/style-lint';
/*
 * routes/approvals.ts — Phase 3 monolith split (from index.ts L779–892).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, supabase, emitApproval } from '../ctx';
// Sprint 13: logSlotEvent — GROW slot transitions (publish approvals from
// THE INBOX page ride the same machinery).
import { logSlotEvent } from './grow';
import { recordApprovalDecision, recordFounderCorrection } from '../memory-ledger';
import { scoreCards } from '../inbox-triage';
import { closeTicketInboxCard } from '../ticket-inbox';
app.get('/api/v1/approvals', authMiddleware, async (req, res) => {
  try {
    const { client_id, status, triage } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    let query = supabase
      .from('approvals')
      .select('id, client_id, type, title, description, platform, status, requested_by, approved_by, reviewed_at, expires_at, created_at, payload_json, risk_tier, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (client_id) query = query.eq('client_id', String(client_id));
    if (status) query = query.eq('status', String(status));
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    // Phase 6 GOAL 3: triage=1 → smart-priority sort (blocking first, score
    // desc, oldest tiebreak) with triage_score/triage_reasons/blocking on each
    // card. Default (no param) keeps the raw created_at order for old callers.
    if (String(triage) === '1' && (data || []).length) {
      const scored = await scoreCards(data as any);
      return res.json(scored);
    }
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// P1 Task 1 — invoices (Client 360 parked section)
// GET /api/v1/invoices?client_id=  → list; POST /api/v1/invoices → create.
// Table created by supabase/migration-p1-backend-gaps.sql.
app.get('/api/v1/invoices', authMiddleware, async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let query = supabase
      .from('invoices')
      .select('id, client_id, package_key, amount, currency, status, due_at, paid_at, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (client_id) query = query.eq('client_id', String(client_id));
    if (status) query = query.eq('status', String(status));
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: `invoice list failed: ${error.message} (run supabase/migration-p1-backend-gaps.sql if the table is missing)` });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/invoices', authMiddleware, async (req, res) => {
  try {
    const { client_id, package_key, amount, currency = 'INR', status = 'draft', due_at, notes } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    if (amount == null || isNaN(Number(amount))) return res.status(400).json({ error: 'amount (number) required' });
    const lintResult = lintAgentOutput(req.body.payload?.output || "");
    const enrichedBody = {
      ...req.body,
      style_score: lintResult.score,
      style_violations: lintResult.violations
    };
    const { data, error } = await supabase.from('invoices').insert({
      client_id, package_key,
      amount: Number(amount), currency, status,
      due_at: due_at || null, notes: notes || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/approvals/pending', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/approvals/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .update({ status: 'approved', approved_by: 'director', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    // Phase 10 GOAL 2: grow_draft cards ride the SAME machinery —
    // approve → item status `approved`; deny → back to `draft` with note.
    if ((data as any)?.payload_json?.kind === 'grow_draft' && (data as any)?.payload_json?.item_id) {
      const itemId = (data as any).payload_json.item_id;
      await supabase.from('content_items').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', itemId);
    }
    // Phase 9 GOAL 2: support_ticket cards ride the SAME machinery —
    // approve = acknowledge (no-op on the ticket, closes the card),
    // deny = close ticket as resolved.
    if ((data as any)?.payload_json?.kind === 'support_ticket' && (data as any)?.payload_json?.ticket_id) {
      const ticketId = (data as any).payload_json.ticket_id;
      await supabase.from('support_tickets').update({ unread_founder: false, updated_at: new Date().toISOString() }).eq('id', ticketId);
    }
    // Sprint 9 §2: outreach drafts ride the SAME object — approving the card
    // moves the linked draft to 'approved' so /outreach/send can fire.
    // (Observed: approval row went 'approved' but the draft stayed
    // 'pending_approval' → send correctly blocked forever. Sync bug.)
    if ((data as any)?.payload_json?.kind === 'outreach' && (data as any)?.payload_json?.draft_id) {
      await supabase.from('outreach_drafts').update({
        status: 'approved', updated_at: new Date().toISOString(),
      }).eq('id', (data as any).payload_json.draft_id);
    }
    // Sprint 13: publish cards ride the SAME machinery — approving a
    // type=publish card schedules the linked calendar slot (the approval IS
    // the publish button, same object THE INBOX shows).
    if ((data as any)?.payload_json?.kind === 'publish' && (data as any)?.payload_json?.slot_id) {
      const slotId = (data as any).payload_json.slot_id;
      const { data: slot0 } = await supabase.from('marketing_content_calendar').select('*').eq('id', slotId).single();
      if (slot0 && slot0.status === 'review') {
        const scheduledAt = (data as any).payload_json?.scheduled_at || slot0.scheduled_at || new Date().toISOString();
        await supabase.from('marketing_content_calendar').update({
          status: 'scheduled', scheduled_at: scheduledAt, updated_at: new Date().toISOString(),
          metadata: { ...(slot0.metadata || {}), approval_id: data.id },
        }).eq('id', slotId);
        await logSlotEvent(supabase, slotId, 'publish_approved', 'founder', { approval_id: data.id, scheduled_at: scheduledAt, platform: slot0.platform, via: 'approvals-page' });
      }
    }
    emitApproval({ ...data, action: 'approved' });
    // Sprint 12 §2: ledger write path — approval decisions are recorded
    // (a decision nobody recorded is a decision nobody can replay).
    void recordApprovalDecision(supabase, {
      approvalId: data.id, title: data.title || 'approval', approved: true,
      by: 'director', clientId: data.client_id || null,
    });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/approvals/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const { data, error } = await supabase
      .from('approvals')
      .update({ status: 'rejected', approved_by: 'director', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    // Phase 10 GOAL 2: grow_draft cards — deny → back to `draft` with the
    // founder's note attached (the note is visible on the item — the loop teaches).
    if ((data as any)?.payload_json?.kind === 'grow_draft' && (data as any)?.payload_json?.item_id) {
      const itemId = (data as any).payload_json.item_id;
      await supabase.from('content_items').update({
        status: 'draft', updated_at: new Date().toISOString(),
        error: reason ? `Rejected: ${String(reason).trim()}` : null,
      }).eq('id', itemId);
    }
    // Phase 9 GOAL 2: support_ticket cards — deny = close ticket as resolved.
    if ((data as any)?.payload_json?.kind === 'support_ticket' && (data as any)?.payload_json?.ticket_id) {
      const ticketId = (data as any).payload_json.ticket_id;
      await supabase.from('support_tickets').update({ status: 'resolved', unread_founder: false, unread_client: false, updated_at: new Date().toISOString() }).eq('id', ticketId);
      await closeTicketInboxCard(ticketId);
    }
    // Sprint 9 §2: rejection reason on reject (UI passes it) — stored on the
    // approval row + linked outreach draft moves to 'rejected'.
    if ((data as any)?.payload_json?.kind === 'outreach' && (data as any)?.payload_json?.draft_id) {
      await supabase.from('outreach_drafts').update({
        status: 'rejected', updated_at: new Date().toISOString(),
        qualification: { ...((data as any).payload_json.qualification || {}), rejection_reason: reason || null },
      }).eq('id', (data as any).payload_json.draft_id);
    }
    emitApproval({ ...data, action: 'rejected', rejection_reason: reason || null });
    // Sprint 12 §2: ledger write paths — the decision AND the founder
    // correction (a rejection IS a correction: the lesson is recorded).
    void recordApprovalDecision(supabase, {
      approvalId: data.id, title: data.title || 'approval', approved: false,
      by: 'director', reason: reason || null, clientId: data.client_id || null,
    });
    if (reason && String(reason).trim()) {
      void recordFounderCorrection(supabase, {
        about: `approval:${(data.title || 'item').slice(0, 80)}`,
        correction: `Rejected: ${String(reason).trim()}`,
        referenceId: data.id,
      });
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/approvals', authMiddleware, async (req, res) => {
  try {
    // FIX 4: lint the agent output bound for THE INBOX — payload_json.text
    // (OutputPreview shape) or payload.output; regex only, sub-ms, no LLM.
    const lintText = String(req.body?.payload_json?.text ?? req.body?.payload?.output ?? '');
    const lintResult = lintAgentOutput(lintText);
    const enrichedBody = {
      ...req.body,
      style_score: lintResult.score,
      style_violations: lintResult.violations,
    };
    const { data, error } = await supabase.from('approvals').insert(enrichedBody).select().single();
    if (error) throw error;
    emitApproval({ ...data, action: 'created' });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

