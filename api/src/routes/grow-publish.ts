// Phase 10 GOAL 3 — Publish via the active provider (the engine)
// POST /api/v1/grow/items/:id/publish (founder-only): from `approved` OR
// `scheduled` (a scheduled item was approved BEFORE scheduling — the schedule
// route enforces that; this is the same publish path the scheduler runs).
// Calls getActivePublisher().publish(). On success: published,
// provider_post_id + published_at + ledger entry. On failure: failed + error
// stored + inbox card. Dry-run when no provider connected — never fake-posts.
// POST /api/v1/grow/items/:id/schedule { scheduled_for }: the Phase 10
// scheduler picks up due items (status='scheduled', due time passed) and runs
// publishItem() — the same path.

import { app, supabase, authMiddleware, emitFeed } from '../ctx';
import { getActivePublisher } from '../providers/publishing';
import { recordMemory } from '../memory-ledger';

const GROW_API = '/api/v1/grow';

// ---------- Shared publish path (route + scheduler both call this) ----------
export type PublishResult = {
  ok: boolean;
  dry_run?: boolean;
  postId?: string | null;
  provider?: string;
  status?: number;
  error?: string;
};

export async function publishItem(id: string): Promise<PublishResult> {
  const { data: item, error: fetchErr } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !item) {
    return { ok: false as const, status: 404, error: 'Item not found' };
  }

  // Approval gates are law: only approved / scheduled items publish.
  // (scheduled implies prior approval — the schedule route enforces it.)
  if (!['approved', 'scheduled'].includes(item.status)) {
    return { ok: false as const, status: 403, error: `Item is ${item.status} — only approved items publish (approval gates are law)` };
  }

  // Registry interface call — never a direct provider import
  const publisher = await getActivePublisher();
  const mode = publisher ? 'live' : 'dry-run';

  const result = publisher
    ? await publisher.publish({
        platform: item.channel,
        text: String(item.body_text || ''),
        mediaUrls: [],
        scheduledAt: item.scheduled_for || new Date().toISOString(),
      })
    : { mode: 'dry-run' as const, postId: `dryrun-${Date.now()}` };

  if (result.error) {
    // failed + error stored + inbox card (write-tier, "publish failed")
    await supabase.from('content_items').update({
      status: 'failed',
      error: result.error,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await supabase.from('approvals').insert({
      type: 'grow_draft',
      risk_tier: 'write',
      client_id: item.client_id,
      title: `PUBLISH FAILED — ${item.channel} "${item.title}"`,
      description: result.error.slice(0, 400),
      status: 'pending',
      requested_by: 'grow',
      payload_json: { kind: 'publish_failure', item_id: id, error: result.error },
    });

    emitFeed('grow', 'publish_failed', {
      item_id: id,
      channel: item.channel,
      error: result.error,
    });

    return { ok: false as const, status: 502, error: result.error };
  }

  // Success: published + provider_post_id + published_at
  const postId = result.postId || `dryrun-${Date.now()}`;
  await supabase.from('content_items').update({
    status: 'published',
    provider_post_id: postId,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  // GOAL 5: ledger entry (what, where, when, provider, post id) — the loop
  // closes in Company Memory (agent_memory, type=decision, best-effort).
  void recordMemory(supabase, {
    agent_profile: 'grow',
    memory_type: 'decision',
    key: `publish:${id}`.slice(0, 200),
    value: {
      what: 'content publish', title: item.title, channel: item.channel,
      provider: publisher?.name || 'dry-run', post_id: postId,
      published_at: new Date().toISOString(),
    },
  });

  emitFeed('grow', 'published', {
    item_id: id,
    channel: item.channel,
    post_id: postId,
    provider: publisher?.name || 'dry-run',
  });

  return { ok: true as const, dry_run: mode === 'dry-run', postId, provider: publisher?.name || 'dry-run' };
}

// ---------- Publish route: POST /api/v1/grow/items/:id/publish ----------
app.post(GROW_API + '/items/:id/publish', authMiddleware, async (req, res) => {
  try {
    const result = await publishItem(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    if (result.dry_run) {
      return res.json({ dry_run: true, id: req.params.id, status: 'approved', note: 'would publish — connect a provider' });
    }
    return res.json({ id: req.params.id, status: 'published', provider_post_id: result.postId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Schedule route: POST /api/v1/grow/items/:id/schedule ----------
app.post(GROW_API + '/items/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_for } = req.body || {};
    if (!scheduled_for) {
      return res.status(400).json({ error: 'scheduled_for required' });
    }

    const { data: item, error: fetchErr } = await supabase
      .from('content_items')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Scheduling ≠ approval — the item must be approved BEFORE it can schedule
    if (item.status !== 'approved') {
      return res.status(403).json({ error: `Item is ${item.status} — only approved items schedule` });
    }

    const { error } = await supabase
      .from('content_items')
      .update({
        status: 'scheduled',
        scheduled_for,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    emitFeed('grow', 'scheduled', { item_id: id, scheduled_for });
    res.json({ id, status: 'scheduled', scheduled_for });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Phase 10 scheduler: due content_items → publishItem ----------
// Every 60s (the grow-scheduler pattern): items with status='scheduled' whose
// time has passed run publishItem() — approval already happened at schedule time.
let _p10SchedulerStarted = false;
export const startContentItemScheduler = () => {
  if (_p10SchedulerStarted) return;
  _p10SchedulerStarted = true;
  setInterval(() => { void dispatchDueContentItems(); }, 60_000);
  console.log(`[content-scheduler] armed: */60s — due scheduled items queue publish`);
};

async function dispatchDueContentItems() {
  try {
    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('content_items')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(20);
    if (error || !due?.length) return;
    for (const row of due) {
      const result = await publishItem(row.id);
      console.log(`[content-scheduler] item ${row.id.slice(0, 8)}:`, result.ok ? (result.dry_run ? 'dry-run published' : 'published') : `failed: ${result.error}`);
    }
  } catch (e: any) {
    console.error('[content-scheduler] dispatch error:', e.message);
  }
}