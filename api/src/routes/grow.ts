/*
 * routes/grow.ts — Sprint 13: the GROW loop end-to-end.
 * Planned → drafting (generate) → review → approved (inbox publish gate) →
 * scheduled → published/dry-run → failed(+attention card).
 *
 * N3 §0 (this revision): the LAST legacy seam is closed. Every read and
 * write here now runs on content_items — the ONE canonical calendar
 * (N2 unification). marketing_content_calendar is never touched. The
 * legacy slot shape survives only as a VIEW via slot-adapter.ts.
 *
 * Reuses, never reinvents:
 *   - content_items via slot-adapter (the canonical calendar surface)
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
// Phase 5 GOAL 1: the queued job path (retry with backoff, dead-letter).
import { enqueue, registerHandler } from '../job-queue';
// Phase 5 GOAL 9: the publishing registry — grow.ts calls the INTERFACE,
// never a provider directly (adding a provider = one module, zero core changes).
import { getActivePublisher, cleanError } from '../providers/publishing';
import { styleBlockFor } from '../agents/style-contract';
// N3 §0: the canonical-calendar adapter (legacy VIEW + canonical write-patch).
import { getSlot, ciUpdate } from '../slot-adapter';

// ---------------------------------------------------------------------
// Provider selection — REMOVED (Phase 5 GOAL 9): the hardcoded Publora env
// path moved to providers/publishing.ts (the registry). grow.ts calls
// getActivePublisher() — nothing connected → dry-run (never stalls).
// ---------------------------------------------------------------------

/** Live-mode reporter for the read side — registry-driven (GOAL 9). */
const publishMode = async () => ((await getActivePublisher()) ? 'live' : 'dry-run');

/**
 * GROW event log — pipeline_events.workflow_id is NOT NULL (calendar slots
 * have no workflow), so GROW transitions log into the SLOT's metadata.history
 * (always visible via /grow/status + the calendar page). Never silent.
 * N3 §0: reads/writes content_items (canonical) — never the legacy table.
 */
export async function logSlotEvent(supabase: any, slotId: string, event: string, actor: string, detail: Record<string, unknown>) {
  try {
    const { data: slot } = await supabase
      .from('content_items')
      .select('metadata')
      .eq('id', slotId)
      .single();
    const history = [...(((slot?.metadata as any)?.history) || []), { event, actor, detail, at: new Date().toISOString() }].slice(-50);
    await supabase.from('content_items').update({ metadata: { ...((slot?.metadata as any) || {}), history } }).eq('id', slotId);
    // When the slot belongs to a workflow (rare), mirror into pipeline_events.
    if ((slot?.metadata as any)?.workflow_id) {
      await supabase.from('pipeline_events').insert({
        workflow_id: (slot!.metadata as any).workflow_id, client_id: (slot!.metadata as any)?.client_id || null,
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
    const slot = await getSlot(supabase, req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'slot not found' });
    if (slot.status !== 'planned' && slot.status !== 'drafting') {
      return res.status(409).json({ error: `slot is ${slot.status} — only planned/drafting slots generate` });
    }

    // Drafting (visible, not silent). N3 §0: canonical write via ciUpdate.
    await supabase.from('content_items').update(ciUpdate({ status: 'drafting' })).eq('id', slot.id);

    // Text via the gateway path (Sprint 11 instrumentation logs the cost).
    const brief = slot.topic || slot.theme || 'the scheduled topic';
    const platformNote = slot.platform === 'x' ? '280 chars max' : 'platform-native length';
    // Phase 6 GOAL 1: GROW content is T2 EXPRESSIVE — voice allowed, filter on.
    const t2Block = styleBlockFor('social', 'T2');
    const result = await runSpecialistTask('seo_specialist', `Write a ${slot.platform} post for Spinach Digital about ${brief}. ${platformNote}. Return ONLY the post text.` + t2Block);
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
      String(a.title).toLowerCase().includes(String(slot.theme || '').toLowerCase()) || a.metadata?.client_id === (slot.metadata as any)?.client_id);
    let assetRef: string | null = null;
    if (reusable) {
      // Reuse (visible, not silent — logged in the slot's history).
      const { data: hit } = await supabase.from('deliverables').select('id, title, client_id, content, file_url, kind').eq('id', reusable.id).single();
      if (hit && (slot.metadata as any)?.workflow_id) {
        await supabase.from('deliverables').insert({
          client_id: hit.client_id, workflow_id: (slot.metadata as any).workflow_id,
          title: `${hit.title} (reused)`, kind: hit.kind, content: hit.content, file_url: hit.file_url, version: 1,
          metadata: { reused_from: hit.id, note: `GROW generate for slot ${slot.id}` },
        });
      }
      await logSlotEvent(supabase, slot.id, 'asset_reused', 'grow:generate', { asset_id: reusable.id, title: reusable.title });
      assetRef = reusable.file_url || reusable.id;
    }

    // Full preview + review status. Draft without a usage row is incomplete —
    // runGatewayTask already logged the usage row (Sprint 11 instrumentation).
    // N3 §0: canonical fields body_text + metadata.review/asset_ref.
    const { data: cur } = await supabase.from('content_items').select('metadata').eq('id', slot.id).single();
    const { data: updated, error: upErr } = await supabase
      .from('content_items')
      .update({
        ...ciUpdate({ status: 'review', content_text: text }),
        metadata: { ...((cur?.metadata as any) || {}), review: true, generated_at: new Date().toISOString(), generated_for: brief, asset_ref: assetRef },
      })
      .eq('id', slot.id)
      .select()
      .single();
    if (upErr) throw upErr;
    res.json({ ok: true, slot: updated, mode: await publishMode() });
  } catch (e: any) {
    // Generation failed → the slot stays drafting (honest) with the error,
    // BUT a hard transport abort (timeout) means nothing was generated and
    // the slot is wedged — reset to planned so the founder can retry.
    if (/aborted|timeout/i.test(e.message || '')) {
      try {
        await supabase.from('content_items')
          .update(ciUpdate({ status: 'planned' }))
          .eq('id', req.params.slotId);
      } catch { /* best-effort reset */ }
    }
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------
// GOAL 3 — Approve: the publish gate in THE INBOX (approval type 'publish')
// ---------------------------------------------------------------------
app.post('/api/v1/grow/submit/:slotId', authMiddleware, async (req, res) => {
  try {
    const slot = await getSlot(supabase, req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'slot not found' });
    if (slot.status !== 'review') return res.status(409).json({ error: `slot is ${slot.status} — only review slots submit` });

    // The publish approval (THE pattern — same object, same mutation).
    const { data: approval, error } = await supabase.from('approvals').insert({
      client_id: (slot.metadata as any)?.client_id || null,
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
        preview_media: slot.asset_ref,
      },
    }).select().single();
    if (error) throw error;

    const { data: cur } = await supabase.from('content_items').select('metadata').eq('id', slot.id).single();
    await supabase.from('content_items').update({
      updated_at: new Date().toISOString(),
      metadata: { ...((cur?.metadata as any) || {}), approval_id: approval.id },
    }).eq('id', slot.id);
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
    const slot0 = await getSlot(supabase, slotId);

    if (approved) {
      // Approve → approved + scheduled (the scheduler dispatches at time).
      // Sprint 13: approval_id lives in metadata (schema-honest).
      await supabase.from('approvals').update({ status: 'approved', approved_by: 'founder', reviewed_at: new Date().toISOString() }).eq('id', approval.id);
      const scheduledAt = approval.payload_json?.scheduled_at || new Date().toISOString();
      const { data: cur } = await supabase.from('content_items').select('metadata').eq('id', slotId).single();
      const { data: slot, error: sErr } = await supabase
        .from('content_items')
        .update({
          ...ciUpdate({ status: 'scheduled', scheduled_at: scheduledAt }),
          metadata: { ...((cur?.metadata as any) || {}), approval_id: approval.id },
        })
        .eq('id', slotId)
        .select()
        .single();
      if (sErr) throw sErr;
      await logSlotEvent(supabase, slotId, 'publish_approved', 'founder', { approval_id: approval.id, scheduled_at: scheduledAt, platform: (slot as any)?.channel });
      res.json({ ok: true, slot });
    } else {
      // Reject → reason REQUIRED (Sprint 10 nit-4 rule), slot back to drafting.
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'reason required — a rejection without a reason is not a decision' });
      }
      await supabase.from('approvals').update({ status: 'rejected', approved_by: 'founder', reviewed_at: new Date().toISOString() }).eq('id', approval.id);
      const { data: cur } = await supabase.from('content_items').select('metadata').eq('id', slotId).single();
      const { data: slot, error: sErr } = await supabase
        .from('content_items')
        .update({
          ...ciUpdate({ status: 'drafting' }),
          metadata: { ...((cur?.metadata as any) || {}), rejection_reason: String(reason).trim(), review: false },
        })
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
// GOAL 4 — the scheduler: scheduled slots dispatch at their time.
// Phase 5 GOAL 1: dispatch is a QUEUED job (job_queue) — retry with backoff,
// dead-letter visible. GOAL 9: publishing via getActivePublisher() (registry
// interface call — no direct provider import). Nothing dispatches without an
// approved approval row — the approval IS the publish button.
// N3 §0: the due-slot scan reads content_items (canonical) directly.
// ---------------------------------------------------------------------
const dispatchDueSlots = async () => {
  try {
    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(10);
    if (error) throw error;
    for (const slot of due || []) {
      // Safety law: no approved approval → no dispatch (deny-by-default).
      // Sprint 13: approval_id lives in metadata (schema-honest).
      if (!(slot.metadata as any)?.approval_id) {
        console.warn(`[grow] slot ${slot.id} scheduled WITHOUT approval — skipping (deny-by-default)`);
        continue;
      }
      const { data: appr } = await supabase.from('approvals').select('id, status').eq('id', (slot.metadata as any).approval_id).single();
      if (!appr || appr.status !== 'approved') {
        console.warn(`[grow] slot ${slot.id} approval ${(slot.metadata as any).approval_id} not approved — skipping`);
        continue;
      }
      // Phase 5 GOAL 1: enqueue the publish job (retry with backoff on
      // failure; dead-letter visible — nothing fails silently). The slot
      // stays 'scheduled' until the job actually succeeds.
      const jobId = await enqueue('grow:publish', { slot_id: slot.id });
      if (!jobId) {
        console.error(`[grow] slot ${slot.id} enqueue failed — will retry next tick`);
        continue;
      }
      await logSlotEvent(supabase, slot.id, 'publish_queued', 'grow:scheduler', { job_id: jobId, queue: 'grow:publish' });
    }
    if ((due || []).length > 0) console.log(`[grow] queued ${(due || []).length} due slot(s) for publish`);
  } catch (e: any) {
    console.error('[grow] dispatch failed:', e?.message);
  }
};

// The publish job handler — the actual scheduling-API call (queued; the
// queue retries with backoff, dead-letters visibly).
// N3 §0: reads the canonical row; writes canonical fields (body_text,
// provider_post_id, published_at, error) + metadata merges.
async function handlePublishJob(payload: { slot_id: string }) {
  const { data: slot } = await supabase.from('content_items').select('*').eq('id', payload.slot_id).single();
  if (!slot) return; // slot deleted — job done, nothing to publish
  if (slot.status !== 'scheduled') return; // already published/failed — idempotent
  // Safety law re-checked at execution time (deny-by-default).
  if (!(slot.metadata as any)?.approval_id) throw new Error('slot has no approval — deny-by-default');
  const { data: appr } = await supabase.from('approvals').select('id, status').eq('id', (slot.metadata as any).approval_id).single();
  if (!appr || appr.status !== 'approved') throw new Error('approval not approved — deny-by-default');

  // GOAL 9: the registry interface call — never a direct provider import.
  const publisher = await getActivePublisher();
  const mode = publisher ? 'live' : 'dry-run';
  const result = publisher
    ? await publisher.schedule({
        platform: slot.channel,
        text: String(slot.body_text || ''),
        mediaUrls: (slot.metadata as any)?.asset_ref ? [(slot.metadata as any).asset_ref] : [],
        scheduledAt: slot.scheduled_for,
      })
    : { mode: 'dry-run' as const, scheduledId: `dryrun-${Date.now()}` };

  const postId = result.postId || result.scheduledId;
  if (result.error) {
    // failed + the error stored + an attention card in THE INBOX (the queue
    // ALSO retries this job with backoff until max attempts — both paths).
    const { data: cur } = await supabase.from('content_items').select('metadata').eq('id', slot.id).single();
    await supabase.from('content_items').update({
      status: 'failed',
      error: String(result.error).slice(0, 1000),
      updated_at: new Date().toISOString(),
      metadata: { ...((cur?.metadata as any) || {}), publish_error: result.error, publish_mode: mode },
    }).eq('id', slot.id);
    await supabase.from('approvals').insert({
      client_id: (slot.metadata as any)?.client_id || null, type: 'publish',
      title: `PUBLISH FAILED — ${slot.channel} post ${(slot.scheduled_for || '').slice(0, 10)} slot ${(slot.metadata as any)?.slot_index ?? 0}`,
      description: cleanError(result.error), platform: slot.channel, status: 'pending',
      requested_by: 'grow', payload_json: { kind: 'publish_failure', slot_id: slot.id, error: cleanError(result.error) },
    });
    await logSlotEvent(supabase, slot.id, 'publish_failed', 'grow:scheduler', { error: result.error, mode });
    throw new Error(result.error); // → the queue retries with backoff
  }
  const { data: cur2 } = await supabase.from('content_items').select('metadata').eq('id', slot.id).single();
  await supabase.from('content_items').update({
    status: 'published',
    provider_post_id: postId,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: { ...((cur2?.metadata as any) || {}), publish_mode: mode, publisher: publisher?.name || 'dry-run' },
  }).eq('id', slot.id);
  await logSlotEvent(supabase, slot.id, 'published', 'grow:scheduler', { post_id: postId, mode, platform: slot.channel, publisher: publisher?.name || 'dry-run' });
  console.log(`[grow] ${mode}: slot ${slot.id.slice(0, 8)} published to ${slot.channel} (${postId}) via ${publisher?.name || 'dry-run'}`);
}

// The scheduler — every 60s (due slots only; the workflow-watcher pattern).
let _growSchedulerStarted = false;
export const startGrowScheduler = () => {
  if (_growSchedulerStarted) return;
  _growSchedulerStarted = true;
  setInterval(() => { void dispatchDueSlots(); }, 60_000);
  console.log(`[grow-scheduler] armed: */60s — scheduled slots queue publish jobs at time (content_items)`);
};

// Phase 5 GOAL 1: the publish job handler registration (called from index.ts
// before the queue worker starts).
export function registerPublishJobHandler() {
  registerHandler('grow:publish', handlePublishJob);
}

// ---------------------------------------------------------------------
// Status/history read side (the full chain visible)
// ---------------------------------------------------------------------
app.get('/api/v1/grow/status/:slotId', authMiddleware, async (req, res) => {
  try {
    const slot = await getSlot(supabase, req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'slot not found' });
    // Status history: the slot's metadata.history (GROW transitions — visible,
    // not silent; pipeline_events has NOT NULL workflow_id and slots don't
    // belong to workflows).
    const history = (slot.metadata as any)?.history || [];
    res.json({ slot, history, mode: await publishMode() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
