/*
 * routes/grow.ts — Sprint 13: the GROW loop end-to-end.
 * Planned → drafting (generate) → review → approved (inbox publish gate) →
 * scheduled → published/dry-run → failed(+attention card).
 *
 * Reuses, never reinvents:
 *   - marketing_content_calendar (the real calendar surface, statuses live)
 *   - the assets library (Sprint 11) — visuals pulled via reuse, not regenerated
 *   - the agent/gateway path (Sprint 11 instrumentation logs the cost)
 *   - the approval machinery (approvals rows type='publish' — THE pattern)
 *   - the cron pattern (workflow-watcher's setInterval style) for dispatch
 *
 * Safety law: nothing reaches a real platform account without an explicit
 * founder approval. The approval IS the publish button. No auto-publish.
 *
 * Provider: Publora (primary, pre-decided) — keys are env vars
 * (PUBLORA_API_TOKEN etc.); absent keys → DRY-RUN mode (the full chain
 * executes, the API call is simulated and logged as dry-run, the UI shows
 * "publishing not connected — dry run"). Never stalls waiting for keys,
 * never fakes a real publish.
 */
import { app, authMiddleware, supabase, emitApproval } from '../ctx';
// Sprint 13 fix: runGatewayTask is PRIVATE in bridge.ts (importing it resolved
// to a shim that returned the raw object as a string). runSpecialistTask is
// the exported real-gateway call (bench path, Sprint 11 usage-instrumented).
import { runSpecialistTask } from '../bridge';

// ---------------------------------------------------------------------
// Provider selection — Publora primary (see report for the 3-line reason).
// Keys are env vars; absent → dry-run. Never hardcoded.
// ---------------------------------------------------------------------
const PUBLORA_TOKEN = process.env.PUBLORA_API_TOKEN || '';
const PUBLORA_BASE = process.env.PUBLORA_BASE_URL || 'https://api.publora.com/v1';
const publishMode = () => (PUBLORA_TOKEN ? 'live' : 'dry-run');

/**
 * One scheduling-API call. dry-run: simulated + logged. live: real POST.
 * Returns { mode, post_id?, error? } — the caller stores the outcome.
 */
async function publishToProvider(post: { platform: string; text: string; mediaUrls: string[]; scheduledAt: string }): Promise<{ mode: string; postId?: string; error?: string }> {
  if (!PUBLORA_TOKEN) {
    // DRY-RUN: the full chain executes, the API call is simulated + logged.
    console.log(`[grow][DRY-RUN] would publish to ${post.platform} at ${post.scheduledAt}: "${post.text.slice(0, 60)}…" (${post.mediaUrls.length} media)`);
    return { mode: 'dry-run', postId: `dryrun-${Date.now()}` };
  }
  try {
    const res = await fetch(`${PUBLORA_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PUBLORA_TOKEN}` },
      body: JSON.stringify({
        platform: post.platform,
        content: post.text,
        media: post.mediaUrls,
        schedule_at: post.scheduledAt,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { mode: 'live', error: `Publora ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    return { mode: 'live', postId: data?.id || data?.post_id || `publora-${Date.now()}` };
  } catch (e: any) {
    return { mode: 'live', error: `Publora failed: ${e?.message?.slice(0, 200)}` };
  }
}

/**
 * GROW event log — pipeline_events.workflow_id is NOT NULL (calendar slots
 * have no workflow), so GROW transitions log into the SLOT's metadata.history
 * (always visible via /grow/status + the calendar page). Never silent.
 */
async function logSlotEvent(supabase: any, slotId: string, event: string, actor: string, detail: Record<string, unknown>) {
  try {
    const { data: slot } = await supabase
      .from('marketing_content_calendar')
      .select('metadata')
      .eq('id', slotId)
      .single();
    const history = [...((slot?.metadata as any)?.history || []), { event, actor, detail, at: new Date().toISOString() }].slice(-50);
    await supabase.from('marketing_content_calendar').update({ metadata: { ...(slot?.metadata || {}), history } }).eq('id', slotId);
    // When the slot belongs to a workflow (rare), mirror into pipeline_events.
    if (slot?.metadata?.workflow_id) {
      await supabase.from('pipeline_events').insert({
        workflow_id: slot.metadata.workflow_id, client_id: slot.metadata?.client_id || null,
        event, actor, detail,
      });
    }
  } catch (e: any) {
    console.error('[grow] slot event log failed:', e?.message);
  }
}

// ---------------------------------------------------------------------
// GOAL 2 — Generate: planned slot → AI draft from the assets library
// ---------------------------------------------------------------------
app.post('/api/v1/grow/generate/:slotId', authMiddleware, async (req, res) => {
  try {
    const { data: slot, error: slotErr } = await supabase
      .from('marketing_content_calendar')
      .select('*')
      .eq('id', req.params.slotId)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'slot not found' });
    if (slot.status !== 'planned' && slot.status !== 'drafting') {
      return res.status(409).json({ error: `slot is ${slot.status} — only planned/drafting slots generate` });
    }

    // Drafting (visible, not silent).
    await supabase.from('marketing_content_calendar').update({ status: 'drafting', updated_at: new Date().toISOString() }).eq('id', slot.id);

    // Text via the gateway path (Sprint 11 instrumentation logs the cost).
    const brief = slot.topic || slot.theme || 'the scheduled topic';
    const platformNote = slot.platform === 'x' ? '280 chars max' : 'platform-native length';
    const result = await runSpecialistTask('seo_specialist', `Write a ${slot.platform} post for Spinach Digital about ${brief}. ${platformNote}. Return ONLY the post text.`);
    const text = result.output;

    // Visuals from the ASSETS LIBRARY (reuse endpoint — don't generate new
    // images when the library has them). Best match by theme/client tag.
    const { data: libraryHits } = await supabase
      .from('deliverables')
      .select('id, title, file_url, kind, metadata')
      .eq('kind', 'image')
      .order('created_at', { ascending: false })
      .limit(10);
    const reusable = (libraryHits || []).find((a: any) =>
      String(a.title).toLowerCase().includes(String(slot.theme || '').toLowerCase()) || a.metadata?.client_id === slot.metadata?.client_id);
    let assetRef: string | null = null;
    if (reusable) {
      // Reuse (visible, not silent — logged in the slot's history).
      const { data: hit } = await supabase.from('deliverables').select('id, title, client_id, content, file_url, kind').eq('id', reusable.id).single();
      if (hit && slot.metadata?.workflow_id) {
        await supabase.from('deliverables').insert({
          client_id: hit.client_id, workflow_id: slot.metadata.workflow_id,
          title: `${hit.title} (reused)`, kind: hit.kind, content: hit.content, file_url: hit.file_url, version: 1,
          metadata: { reused_from: hit.id, note: `GROW generate for slot ${slot.id}` },
        });
      }
      await logSlotEvent(supabase, slot.id, 'asset_reused', 'grow:generate', { asset_id: reusable.id, title: reusable.title });
      assetRef = reusable.file_url || reusable.id;
    }

    // Full preview + review status. Draft without a usage row is incomplete —
    // runGatewayTask already logged the usage row (Sprint 11 instrumentation).
    // Sprint 13: the calendar has no asset_ref column — the visual reference
    // lives in metadata.asset_ref (schema-honest, no migration needed).
    const { data: updated, error: upErr } = await supabase
      .from('marketing_content_calendar')
      .update({
        status: 'review',
        content_text: text,
        metadata: { ...(slot.metadata || {}), generated_at: new Date().toISOString(), generated_for: brief, asset_ref: assetRef },
      })
      .eq('id', slot.id)
      .select()
      .single();
    if (upErr) throw upErr;
    res.json({ ok: true, slot: updated, mode: publishMode() });
  } catch (e: any) {
    // Generation failed → the slot stays drafting (honest) with the error.
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------
// GOAL 3 — Approve: the publish gate in THE INBOX (approval type 'publish')
// ---------------------------------------------------------------------
app.post('/api/v1/grow/submit/:slotId', authMiddleware, async (req, res) => {
  try {
    const { data: slot, error: slotErr } = await supabase
      .from('marketing_content_calendar')
      .select('*')
      .eq('id', req.params.slotId)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'slot not found' });
    if (slot.status !== 'review') return res.status(409).json({ error: `slot is ${slot.status} — only review slots submit` });

    // The publish approval (THE pattern — same object, same mutation).
    const { data: approval, error } = await supabase.from('approvals').insert({
      client_id: slot.metadata?.client_id || null,
      type: 'publish',
      title: `Publish ${slot.platform} post — ${slot.date} slot ${slot.slot_index}`,
      description: String(slot.content_text || '').slice(0, 500),
      platform: slot.platform,
      status: 'pending',
      requested_by: 'grow',
      payload_json: {
        kind: 'publish', slot_id: slot.id, platform: slot.platform,
        scheduled_at: slot.scheduled_at || `${slot.date}T09:00:00+05:30`,
        preview_text: String(slot.content_text || '').slice(0, 800),
        preview_media: slot.asset_ref || null,
      },
    }).select().single();
    if (error) throw error;

    await supabase.from('marketing_content_calendar').update({ updated_at: new Date().toISOString(), metadata: { ...(slot.metadata || {}), approval_id: approval.id } }).eq('id', slot.id);
    emitApproval({ ...approval, action: 'created' });
    res.status(201).json({ ok: true, approval });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Publish decision → the slot transitions (approval machinery drives GROW).
app.post('/api/v1/grow/decision/:approvalId', authMiddleware, async (req, res) => {
  try {
    const { approved, reason } = req.body || {};
    const { data: approval, error } = await supabase.from('approvals').select('*').eq('id', req.params.approvalId).single();
    if (error || !approval) return res.status(404).json({ error: 'approval not found' });
    if (approval.type !== 'publish') return res.status(400).json({ error: 'not a publish approval' });
    const slotId = approval.payload_json?.slot_id;
    if (!slotId) return res.status(400).json({ error: 'approval has no slot link' });
    const { data: slot0 } = await supabase.from('marketing_content_calendar').select('*').eq('id', slotId).single();

    if (approved) {
      // Approve → approved + scheduled (the scheduler dispatches at time).
      // Sprint 13: the calendar has no approval_id column — the link lives in
      // metadata.approval_id (schema-honest).
      await supabase.from('approvals').update({ status: 'approved', approved_by: 'founder', reviewed_at: new Date().toISOString() }).eq('id', approval.id);
      const scheduledAt = approval.payload_json?.scheduled_at || new Date().toISOString();
      const { data: slot, error: sErr } = await supabase
        .from('marketing_content_calendar')
        .update({ status: 'scheduled', scheduled_at: scheduledAt, updated_at: new Date().toISOString(), metadata: { ...(slot0?.metadata || {}), approval_id: approval.id } })
        .eq('id', slotId)
        .select()
        .single();
      if (sErr) throw sErr;
      await logSlotEvent(supabase, slotId, 'publish_approved', 'founder', { approval_id: approval.id, scheduled_at: scheduledAt, platform: slot.platform });
      res.json({ ok: true, slot });
    } else {
      // Reject → reason REQUIRED (Sprint 10 nit-4 rule), slot back to drafting.
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'reason required — a rejection without a reason is not a decision' });
      }
      await supabase.from('approvals').update({ status: 'rejected', approved_by: 'founder', reviewed_at: new Date().toISOString() }).eq('id', approval.id);
      const { data: slot, error: sErr } = await supabase
        .from('marketing_content_calendar')
        .update({ status: 'drafting', updated_at: new Date().toISOString(), metadata: { rejection_reason: String(reason).trim() } })
        .eq('id', slotId)
        .select()
        .single();
      if (sErr) throw sErr;
      await logSlotEvent(supabase, slotId, 'publish_rejected', 'founder', { reason: String(reason).trim() });
      res.json({ ok: true, slot });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------
// GOAL 4 — the scheduler: scheduled slots dispatch at their time
// (workflow-watcher's setInterval pattern). On success → published with the
// platform post ID; on failure → failed + attention card in THE INBOX.
// Nothing dispatches without an approved approval row — the approval IS the
// publish button; the scheduler only executes what the founder already
// approved.
// ---------------------------------------------------------------------
const dispatchDueSlots = async () => {
  try {
    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('marketing_content_calendar')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(10);
    if (error) throw error;
    for (const slot of due || []) {
      // Safety law: no approved approval → no dispatch (deny-by-default).
      // Sprint 13: approval_id lives in metadata (schema-honest).
      if (!slot.metadata?.approval_id) {
        console.warn(`[grow] slot ${slot.id} scheduled WITHOUT approval — skipping (deny-by-default)`);
        continue;
      }
      const { data: appr } = await supabase.from('approvals').select('id, status').eq('id', slot.metadata.approval_id).single();
      if (!appr || appr.status !== 'approved') {
        console.warn(`[grow] slot ${slot.id} approval ${slot.metadata.approval_id} not approved — skipping`);
        continue;
      }
      const mode = publishMode();
      const result = await publishToProvider({
        platform: slot.platform,
        text: String(slot.content_text || ''),
        mediaUrls: slot.asset_ref ? [slot.asset_ref] : [],
        scheduledAt: slot.scheduled_at,
      });
      if (result.error) {
        // failed + the error stored + an attention card in THE INBOX.
        await supabase.from('marketing_content_calendar').update({
          status: 'failed', updated_at: new Date().toISOString(),
          metadata: { ...(slot.metadata || {}), publish_error: result.error, publish_mode: mode },
        }).eq('id', slot.id);
        await supabase.from('approvals').insert({
          client_id: slot.metadata?.client_id || null, type: 'publish',
          title: `PUBLISH FAILED — ${slot.platform} post ${slot.date} slot ${slot.slot_index}`,
          description: result.error.slice(0, 400), platform: slot.platform, status: 'pending',
          requested_by: 'grow', payload_json: { kind: 'publish_failure', slot_id: slot.id, error: result.error },
        });
        await logSlotEvent(supabase, slot.id, 'publish_failed', 'grow:scheduler', { error: result.error, mode });
      } else {
        await supabase.from('marketing_content_calendar').update({
          status: 'published', published_at: new Date().toISOString(), post_id: result.postId,
          updated_at: new Date().toISOString(),
          metadata: { ...(slot.metadata || {}), publish_mode: mode },
        }).eq('id', slot.id);
        await logSlotEvent(supabase, slot.id, 'published', 'grow:scheduler', { post_id: result.postId, mode, platform: slot.platform });
        console.log(`[grow] ${mode}: slot ${slot.id.slice(0, 8)} published to ${slot.platform} (${result.postId})`);
      }
    }
    if ((due || []).length > 0) console.log(`[grow] dispatched ${(due || []).length} due slot(s) (${publishMode()} mode)`);
  } catch (e: any) {
    console.error('[grow] dispatch failed:', e?.message);
  }
};

// The scheduler — every 60s (due slots only; the workflow-watcher pattern).
let _growSchedulerStarted = false;
export const startGrowScheduler = () => {
  if (_growSchedulerStarted) return;
  _growSchedulerStarted = true;
  setInterval(() => { void dispatchDueSlots(); }, 60_000);
  console.log(`[grow-scheduler] armed: */60s — scheduled slots dispatch at time (${publishMode()} mode)`);
};

// ---------------------------------------------------------------------
// Status/history read side (the full chain visible)
// ---------------------------------------------------------------------
app.get('/api/v1/grow/status/:slotId', authMiddleware, async (req, res) => {
  try {
    const { data: slot, error } = await supabase.from('marketing_content_calendar').select('*').eq('id', req.params.slotId).single();
    if (error || !slot) return res.status(404).json({ error: 'slot not found' });
    // Status history: the slot's metadata.history (GROW transitions — visible,
    // not silent; pipeline_events has NOT NULL workflow_id and slots don't
    // belong to workflows).
    const history = (slot.metadata as any)?.history || [];
    res.json({ slot, history, mode: publishMode() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
