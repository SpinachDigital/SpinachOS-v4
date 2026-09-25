/*
 * src/warroom-helpers.ts — Phase 3 monolith split (index.ts L2441–2480).
 * No behavior changes.
 */
import { supabase, broadcast, emitFeed } from './ctx';
export async function ensureWorkflowChannel(workflowId: string, workflowName: string): Promise<string | null> {
  const { data: existing } = await supabase.from('channels').select('id').eq('workflow_id', workflowId).maybeSingle();
  if (existing) return existing.id;
  const { data: ch, error } = await supabase.from('channels').insert({
    name: `wf-${String(workflowName).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`,
    display_name: `⚔ ${workflowName}`,
    description: `War-room: ${workflowName}`,
    channel_type: 'public',
    kind: 'workflow',
    workflow_id: workflowId,
    created_by: 'orchestrator',
  }).select('id').single();
  if (error) { console.error('[warroom] channel create failed:', error.message); return null; }
  return ch.id;
}

/**
 * warRoomPost — coordination-level message to the workflow channel.
 * Called by the pipeline engine on delegation/QA/decision events.
 */
export async function warRoomPost(workflowId: string, workflowName: string, sender: string, content: string, metadata: any = {}) {
  const chId = await ensureWorkflowChannel(workflowId, workflowName);
  if (!chId) return;
  const { error } = await supabase.from('messages').insert({
    channel_id: chId,
    sender_type: 'agent',
    sender_id: sender,
    content: content.slice(0, 1000),
    message_type: 'text',
    metadata: { ...metadata, war_room: true },
  });
  if (error) console.error('[warroom] post failed:', error.message);
  broadcast('comms_message', { channel_id: chId, sender, content: content.slice(0, 500), war_room: true });
}

// Wire the pipeline engine to post coordination chatter
// (wrap the original emitFeed calls for PIPELINE_STEP / QA_REWORK / PIPELINE_PAUSED / COMPLETED)
const origEmitFeed = emitFeed;

// GET /api/v1/warroom/:workflowId — the one-screen view: workflow + steps + messages
