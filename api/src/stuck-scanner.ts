/**
 * N4 §2 trigger 2: pipeline stage goes STUCK (idle crosses 72h) → one buzz.
 *
 * Runs on a 15-minute interval. The "crossing" is edge-detected: a push fires
 * only when a pipeline's idle crosses 72h (previous scan < 72h, now >= 72h),
 * or the explicit blocked flag turns on. The founder is never re-buzzed for a
 * stage that has been stuck for days — the nudge surface already shows that.
 */
import { supabase } from './ctx';
import { sendPushToUser, FOUNDER_EMAIL } from './push';

// In-memory edge state: pipeline_id -> was stuck at last scan. Resets on API
// restart, which is acceptable: a restart may re-buzz once for truly stuck
// stages, which is a feature (fresh eyes), not spam.
const wasStuck = new Set<string>();

export async function scanStuckPipelines(): Promise<{ checked: number; newlyStuck: number }> {
  // Same clock as N2 §3: updated_at is the activity clock, 72h is the line.
  const line = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('pipelines')
    .select('id, name, status, updated_at')
    .lt('updated_at', line)
    .or('status.eq.blocked,status.neq.closed');
  if (error) return { checked: 0, newlyStuck: 0 };
  let newly = 0;
  for (const p of rows || []) {
    const key = String(p.id);
    if (wasStuck.has(key)) continue;
    wasStuck.add(key);
    newly++;
    const days = Math.floor((Date.now() - new Date(p.updated_at as string).getTime()) / 86400000);
    void sendPushToUser(FOUNDER_EMAIL, {
      title: 'Pipeline stuck',
      body: `${p.name || 'A pipeline'} has been idle ${days} day${days === 1 ? '' : 's'}.`,
      link: `/pipeline/${p.id}`,
    }).catch(() => {});
  }
  // Pipelines that recovered leave the edge set so a future stall re-buzzes.
  if (rows) {
    const stuckIds = new Set((rows as any[]).map(r => String(r.id)));
    for (const key of [...wasStuck]) if (!stuckIds.has(key)) wasStuck.delete(key);
  }
  return { checked: (rows || []).length, newlyStuck: newly };
}

export function startStuckPipelineScanner(): void {
  // Kick once shortly after boot, then every 15 minutes.
  setTimeout(() => { void scanStuckPipelines().catch(() => {}); }, 60_000);
  setInterval(() => { void scanStuckPipelines().catch(() => {}); }, 15 * 60_000);
}
