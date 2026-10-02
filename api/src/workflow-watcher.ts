/*
 * workflow-watcher.ts — Sprint 10 §1: pipeline stuck detection (10 min).
 *
 * A pipeline stage idle past its SLA (48h default — stage.started_at) surfaces
 * in THE INBOX as an attention card (approvals row, type=stuck_stage), not a
 * silent stall. Idempotent: one open card per (workflow, stage); auto-resolve
 * when the stage advances or completes (resolved_by='watcher').
 *
 * Every detection writes a pipeline_events 'stuck_flag' row (audit trail) —
 * a move nobody can see is not a move, and a stall nobody can see is fatal.
 */
import cron from 'node-cron';
import { supabase, emitApproval } from './ctx';

const WATCHER_RUNNING = { armed: false };

// Stage SLA: 48h default. A stage with no progress for 48h+ is stuck.
const STAGE_SLA_HOURS = 48;

export const runWorkflowWatcherOnce = async (): Promise<{ flagged: number; resolved: number }> => {
  let flagged = 0;
  let resolved = 0;
  const now = Date.now();

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, client_id, name, current_step, status, steps_json, updated_at')
    .eq('status', 'active');

  for (const wf of workflows || []) {
    const steps: any[] = wf.steps_json || [];
    const cur = steps.find((s) => s.name === wf.current_step) || steps.find((s) => s.status === 'in_progress');
    if (!cur || !cur.name) continue;

    const startedAt = cur.started_at || wf.updated_at;
    if (!startedAt) continue;
    const idleHours = (now - new Date(startedAt).getTime()) / 3600000;
    if (idleHours < STAGE_SLA_HOURS) continue;

    // Idempotent: one open stuck_stage card per (workflow, stage).
    const { data: open } = await supabase
      .from('approvals')
      .select('id')
      .eq('status', 'pending')
      .eq('type', 'stuck_stage')
      .contains('payload_json', { workflow_id: wf.id, stage: cur.name })
      .maybeSingle();
    if (open) continue;

    const clientName = wf.client_id
      ? (await supabase.from('clients').select('name').eq('id', wf.client_id).single()).data?.name
      : null;

    const title = `Pipeline stuck: "${cur.name}" ${Math.round(idleHours)}h idle — ${clientName || wf.name}`;
    const { data: card, error } = await supabase.from('approvals').insert({
      client_id: wf.client_id,
      type: 'stuck_stage',
      title,
      description: `Stage "${cur.name}" has been in_progress for ${Math.round(idleHours)}h (SLA ${STAGE_SLA_HOURS}h). Pipeline paused here — advance it, assign the next agent, or close the pipeline.`,
      payload_json: {
        workflow_id: wf.id,
        stage: cur.name,
        idle_hours: Math.round(idleHours),
        sla_hours: STAGE_SLA_HOURS,
        pipeline_name: wf.name,
        client_name: clientName || null,
      },
      requested_by: 'watcher',
    }).select().single();
    if (error) {
      if (!/duplicate/i.test(error.message || '')) console.error(`[wf-watcher] stuck flag insert failed (${wf.id}/${cur.name}):`, error.message);
      continue;
    }
    flagged++;
    // Audit trail: a stall nobody can see is fatal.
    await supabase.from('pipeline_events').insert({
      workflow_id: wf.id, client_id: wf.client_id, event: 'stuck_flag',
      from_step: cur.name, actor: 'watcher',
      detail: { approval_id: card.id, idle_hours: Math.round(idleHours), sla_hours: STAGE_SLA_HOURS },
    });
    emitApproval({ ...card, action: 'created' });
    console.log(`[wf-watcher] stuck: "${cur.name}" ${Math.round(idleHours)}h on ${wf.name.slice(0, 40)} → attention card ${card.id.slice(0, 8)}`);
  }

  // Auto-resolve: open stuck_stage cards whose stage advanced/completed.
  const { data: openCards } = await supabase
    .from('approvals')
    .select('id, payload_json, title')
    .eq('status', 'pending')
    .eq('type', 'stuck_stage');
  for (const card of openCards || []) {
    const p = (card as any).payload_json || {};
    if (!p.workflow_id || !p.stage) continue;
    const { data: wf } = await supabase.from('workflows').select('current_step, status').eq('id', p.workflow_id).single();
    if (!wf) continue;
    const advanced = wf.current_step !== p.stage || wf.status === 'completed';
    if (!advanced) continue;
    const { error } = await supabase
      .from('approvals')
      .update({ status: 'approved', approved_by: 'watcher', reviewed_at: new Date().toISOString() })
      .eq('id', card.id)
      .is('reviewed_at', null)
      .eq('status', 'pending');
    if (!error) {
      resolved++;
      await supabase.from('pipeline_events').insert({
        workflow_id: p.workflow_id, event: 'stuck_resolved', actor: 'watcher',
        detail: { approval_id: card.id, stage: p.stage },
      });
      console.log(`[wf-watcher] resolved stuck card → ${p.stage} advanced`);
    }
  }

  return { flagged, resolved };
};

export const startWorkflowWatcher = () => {
  if (WATCHER_RUNNING.armed) return;
  try {
    cron.schedule('*/10 * * * *', async () => {
      try {
        const r = await runWorkflowWatcherOnce();
        if (r.flagged || r.resolved) console.log(`[wf-watcher] ${new Date().toISOString()} flagged=${r.flagged} resolved=${r.resolved}`);
      } catch (e: any) {
        console.error('[wf-watcher] run failed:', e?.message);
      }
    });
    WATCHER_RUNNING.armed = true;
    console.log(`[wf-watcher] armed: */10 * * * * — stage SLA ${STAGE_SLA_HOURS}h → attention card (THE INBOX)`);
  } catch (e: any) {
    console.error('[wf-watcher] arm failed:', e?.message);
  }
};
