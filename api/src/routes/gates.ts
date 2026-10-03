/*
 * routes/gates.ts — Sprint 10 §2: DELIVER approval gates, deny-by-default.
 *
 * Between pipeline stages sit gate_actions: the pipeline PAUSES at a gate
 * until the founder approves. This is the DELIVER version of Sprint 9's
 * outreach gate — same pattern, same inbox (ApprovalCards), same mutation.
 *
 * DENY-BY-DEFAULT:
 *   - No registered gate action runs without an explicit approval.
 *   - Unknown/unrequested actions are REJECTED (400/404), not queued.
 *   - Risk tiers (read | write | external): a higher tier needs explicit
 *     approval even if a lower tier was approved before — no silent
 *     escalation. Approvals are per gate_action, never per workflow-wide
 *     blanket.
 *   - Every gate decision writes an audit trail (pipeline_events) with
 *     who/what/when + payload hash. Secrets in payloads are redacted in
 *     logs and previews (REDACT_KEYS).
 *
 * Table: supabase/migration-sprint10-deliver.sql (gate_actions).
 */
import { createHash } from 'crypto';
import { app, authMiddleware, emitApproval, supabase } from '../ctx';
import { recordGateDecision, recordFounderCorrection } from '../memory-ledger';

// Secrets/tokens never rendered raw — previews + logs redact these keys.
const REDACT_KEYS = /^(password|secret|token|api_?key|authorization|credential|access_?token|refresh_?token|private_?key)$/i;

export const redactPayload = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (REDACT_KEYS.test(k)) out[k] = '[REDACTED]';
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = redactPayload(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (x && typeof x === 'object' ? redactPayload(x) : x));
    else out[k] = v;
  }
  return out;
};

const payloadHash = (payload: unknown): string =>
  createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex').slice(0, 32);

// Risk tier ranking — external > write > read. A gate at a HIGHER tier than
// the one last approved on this workflow needs fresh explicit approval.
const TIER_RANK: Record<string, number> = { read: 1, write: 2, external: 3 };

export const runGates = () => {
  // ------------------------------------------------------------------
  // POST /gates — register a gate action (watcher/agent side). Deny-by-
  // default: unknown action kinds are rejected here, not queued.
  // ------------------------------------------------------------------
  app.post('/api/v1/gates', authMiddleware, async (req, res) => {
    try {
      const { workflow_id, client_id, gate_name, action, risk_tier = 'write', payload } = req.body || {};
      if (!workflow_id || !gate_name || !action) {
        return res.status(400).json({ error: 'workflow_id, gate_name, action required' });
      }
      // Deny-by-default: only known gate actions register.
      const KNOWN_ACTIONS = ['advance_stage', 'file_deliverable', 'external_send', 'client_report'];
      if (!KNOWN_ACTIONS.includes(String(action))) {
        return res.status(400).json({ error: `unknown gate action "${action}" — deny-by-default (known: ${KNOWN_ACTIONS.join(', ')})` });
      }
      const tier = String(risk_tier);
      if (!TIER_RANK[tier]) return res.status(400).json({ error: `risk_tier must be read|write|external` });

      // The workflow must exist — gates sit on real pipelines only.
      const { data: wf, error: wfErr } = await supabase.from('workflows').select('id, client_id, current_step').eq('id', workflow_id).single();
      if (wfErr || !wf) return res.status(404).json({ error: 'workflow not found' });

      // Sprint 11 nit 5 — CROSS-GATE risk-tier escalation: a gate at a HIGHER
      // tier than any previously approved gate on this workflow carries an
      // escalation flag in its event trail (the approve is still explicit —
      // but the audit trail records that this tier was never approved before).
      // No silent escalation: reviewers see the tier jump.
      let escalation = false;
      if (tier !== 'read') {
        const { data: prior } = await supabase
          .from('gate_actions')
          .select('risk_tier')
          .eq('workflow_id', workflow_id)
          .eq('status', 'approved');
        const priorMax = Math.max(0, ...(prior || []).map((g: any) => TIER_RANK[g.risk_tier] || 0));
        escalation = TIER_RANK[tier] > priorMax;
      }

      // Idempotent: an open gate of the same (workflow, gate_name) is returned,
      // not duplicated.
      const { data: open } = await supabase
        .from('gate_actions')
        .select('id')
        .eq('workflow_id', workflow_id)
        .eq('gate_name', gate_name)
        .eq('status', 'pending')
        .maybeSingle();
      if (open) return res.json({ ok: true, gate_id: open.id, existing: true });

      const { data: gate, error } = await supabase.from('gate_actions').insert({
        workflow_id,
        client_id: client_id || wf.client_id,
        gate_name,
        action,
        risk_tier: tier,
        payload_json: redactPayload(payload),
        payload_hash: payloadHash(payload),
        requested_by: 'watcher',
        metadata: { escalation },
      }).select().single();
      if (error) throw error;

      // The pipeline pauses here: mark the gate pause on the event trail.
      await supabase.from('pipeline_events').insert({
        workflow_id, client_id: gate.client_id, event: 'gate_paused',
        from_step: wf.current_step, actor: 'watcher',
        detail: { gate_id: gate.id, gate_name, action, risk_tier: tier, escalation },
      });

      emitApproval({ ...gate, type: 'gate', action: 'created' });
      res.status(201).json({ ok: true, gate_id: gate.id, gate });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------------
  // GET /gates?workflow_id=&status= — the gate queue (inbox + pipeline page)
  // ------------------------------------------------------------------
  app.get('/api/v1/gates', authMiddleware, async (req, res) => {
    try {
      const { workflow_id, status } = req.query;
      const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
      let query = supabase
        .from('gate_actions')
        .select('id, workflow_id, client_id, gate_name, action, risk_tier, payload_json, payload_hash, status, requested_by, approved_by, reviewed_at, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (workflow_id) query = query.eq('workflow_id', String(workflow_id));
      if (status) query = query.eq('status', String(status));
      const { data, error } = await query;
      if (error) throw error;
      res.json((data || []).map((g: any) => ({ ...g, payload_json: redactPayload(g.payload_json) })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /gates/:id/approve — founder approval. Risk-tier escalation check:
  // a higher tier than any previously approved gate on this workflow needs
  // explicit approval (which this IS) — but an approve of a REJECTED/expired
  // gate is refused (409), never resurrected silently.
  // ------------------------------------------------------------------
  app.post('/api/v1/gates/:id/approve', authMiddleware, async (req, res) => {
    try {
      const { data: gate, error } = await supabase
        .from('gate_actions')
        .update({ status: 'approved', approved_by: 'founder', reviewed_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('status', 'pending')          // deny-by-default: only pending gates approve
        .select()
        .single();
      if (error || !gate) return res.status(409).json({ error: 'gate not pending — already decided or expired' });

      // Audit trail: who/what/when + payload hash.
      await supabase.from('pipeline_events').insert({
        workflow_id: gate.workflow_id, client_id: gate.client_id, event: 'gate_approved',
        to_step: null, actor: 'founder',
        detail: { gate_id: gate.id, gate_name: gate.gate_name, action: gate.action, risk_tier: gate.risk_tier, payload_hash: gate.payload_hash },
      });
      // Sprint 12 §2: the ledger write path — a gate decision nobody recorded
      // is a decision nobody can replay.
      void recordGateDecision(supabase, {
        gateId: gate.id, gateName: gate.gate_name, approved: true,
        tier: gate.risk_tier, escalation: (gate.metadata as any)?.escalation || false,
        by: 'founder', clientId: gate.client_id,
      });
      emitApproval({ ...gate, type: 'gate', action: 'approved' });
      res.json({ ok: true, gate });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /gates/:id/reject — founder rejection (reason REQUIRED — Sprint 11
  // nit 4: the report claimed "reason required" but stored reason||null with
  // no 400. Enforced now).
  // ------------------------------------------------------------------
  app.post('/api/v1/gates/:id/reject', authMiddleware, async (req, res) => {
    try {
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'reason required — a rejection without a reason is not a decision' });
      }
      const reasonText = String(reason).trim();
      const { data: gate, error } = await supabase
        .from('gate_actions')
        .update({
          status: 'rejected', approved_by: 'founder', reviewed_at: new Date().toISOString(),
          metadata: { rejection_reason: reasonText },
        })
        .eq('id', req.params.id)
        .eq('status', 'pending')
        .select()
        .single();
      if (error || !gate) return res.status(409).json({ error: 'gate not pending — already decided or expired' });

      await supabase.from('pipeline_events').insert({
        workflow_id: gate.workflow_id, client_id: gate.client_id, event: 'gate_rejected',
        actor: 'founder',
        detail: { gate_id: gate.id, gate_name: gate.gate_name, reason: reasonText },
      });
      // Sprint 12 §2: ledger write paths — the gate decision AND the founder
      // correction (a rejection IS a correction: the lesson is recorded).
      void recordGateDecision(supabase, {
        gateId: gate.id, gateName: gate.gate_name, approved: false,
        tier: gate.risk_tier, by: 'founder', clientId: gate.client_id,
      });
      void recordFounderCorrection(supabase, {
        about: `gate:${gate.gate_name}`,
        correction: `Rejected: ${reasonText}`,
        referenceId: gate.id,
      });
      emitApproval({ ...gate, type: 'gate', action: 'rejected', rejection_reason: reasonText });
      res.json({ ok: true, gate });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /gates/:id/run — the gate action EXECUTES only after approval
  // (deny-by-default: 403 without approval). advance_stage drives §1
  // auto-advance; file_deliverable drives §3 filing.
  // ------------------------------------------------------------------
  app.post('/api/v1/gates/:id/run', authMiddleware, async (req, res) => {
    try {
      const { data: gate } = await supabase.from('gate_actions').select('*').eq('id', req.params.id).single();
      if (!gate) return res.status(404).json({ error: 'gate not found' });
      if (gate.status !== 'approved') {
        return res.status(403).json({ error: 'gate not approved — deny-by-default: the action does not run (approve it in THE INBOX first)' });
      }
      if (gate.metadata?.ran_at) return res.status(409).json({ error: 'gate already ran (idempotent)' });

      if (gate.action === 'advance_stage') {
        // Reuse the pipeline advance engine (§1): same sequence enforcement.
        const { data: wf } = await supabase.from('workflows').select('current_step').eq('id', gate.workflow_id).single();
        const steps = (await supabase.from('workflows').select('steps_json').eq('id', gate.workflow_id).single()).data?.steps_json || [];
        const current = steps.find((s: any) => s.name === wf?.current_step) || steps.find((s: any) => s.status === 'in_progress') || steps[0];
        if (!current) return res.status(400).json({ error: 'no steps on workflow' });

        // Mark current step completed → next step in_progress (same logic as
        // /pipeline/advance — kept inline to write the gate-scoped event).
        const idx = steps.findIndex((s: any) => s.name === current.name);
        steps[idx].status = 'completed';
        steps[idx].completed_at = new Date().toISOString();
        const nextIdx = steps.findIndex((s: any, i: number) => i > idx && s.status === 'pending');
        let progress = Math.round((steps.filter((s: any) => s.status === 'completed').length / steps.length) * 100);
        if (nextIdx >= 0) {
          steps[nextIdx].status = 'in_progress';
          steps[nextIdx].started_at = new Date().toISOString();
          await supabase.from('workflows').update({ steps_json: steps, current_step: steps[nextIdx].name, progress }).eq('id', gate.workflow_id);
          // §1: every auto-advance logged (who/what/when).
          await supabase.from('pipeline_events').insert({
            workflow_id: gate.workflow_id, client_id: gate.client_id, event: 'auto_advance',
            from_step: current.name, to_step: steps[nextIdx].name, actor: `gate:${gate.gate_name}`,
            detail: { gate_id: gate.id, approved_by: gate.approved_by, progress },
          });
        } else {
          await supabase.from('workflows').update({ steps_json: steps, status: 'completed', progress: 100, current_step: null }).eq('id', gate.workflow_id);
          await supabase.from('pipeline_events').insert({
            workflow_id: gate.workflow_id, client_id: gate.client_id, event: 'auto_advance',
            from_step: current.name, to_step: null, actor: `gate:${gate.gate_name}`,
            detail: { gate_id: gate.id, approved_by: gate.approved_by, completed: true },
          });
        }
        await supabase.from('gate_actions').update({ metadata: { ...(gate.metadata || {}), ran_at: new Date().toISOString() } }).eq('id', gate.id);
        return res.json({ ok: true, action: 'advance_stage', next_step: nextIdx >= 0 ? steps[nextIdx].name : null, progress });
      }

      if (gate.action === 'file_deliverable') {
        // §3: file the deliverable — stored + indexed + linked to the twin.
        const { title, kind = 'file', content, file_url } = (gate.payload_json || {}) as any;
        if (!title) return res.status(400).json({ error: 'payload.title required for file_deliverable' });
        const { data: filed, error: fileErr } = await supabase.from('deliverables').insert({
          client_id: gate.client_id, workflow_id: gate.workflow_id, gate_action_id: gate.id,
          title, kind, content: content || null, file_url: file_url || null,
          released_by: gate.approved_by, released_at: new Date().toISOString(),
        }).select().single();
        if (fileErr) throw fileErr;
        await supabase.from('pipeline_events').insert({
          workflow_id: gate.workflow_id, client_id: gate.client_id, event: 'filed',
          actor: `gate:${gate.gate_name}`,
          detail: { gate_id: gate.id, deliverable_id: filed.id, title, released_by: gate.approved_by },
        });
        await supabase.from('gate_actions').update({ metadata: { ...(gate.metadata || {}), ran_at: new Date().toISOString(), deliverable_id: filed.id } }).eq('id', gate.id);
        return res.json({ ok: true, action: 'file_deliverable', deliverable: filed });
      }

      return res.status(400).json({ error: `gate action "${gate.action}" has no runner — deny-by-default` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
};

// Mount on import — same pattern as every other route file (routes register
// at module load; index.ts imports this file for its side effects).
runGates();
