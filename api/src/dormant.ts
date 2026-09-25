/*
 * dormant.ts — provision/hibernate dormant agents (Phase 3 split from index.ts).
 */
import { supabase, emitFeed, emitAgentState, broadcast } from './ctx';

export async function provisionDormantAgent(agentKey: string): Promise<{ activated: boolean; persisted?: boolean; reason: string }> {
  const { data: agentRow, error: selErr } = await supabase.from('agent_states').select('profile, is_dormant').eq('profile', agentKey).maybeSingle();
  // Migration v6 not applied → is_dormant column missing: report honestly, still emit the WS event
  if (selErr) {
    emitAgentState(agentKey, 'idle', 'Department online');
    emitFeed('system', 'PROVISIONED', { agent: agentKey, event: 'Paid Media department online', persisted: false });
    broadcast('department_online', { agent: agentKey, message: 'Paid Media department online' });
    return { activated: true, persisted: false, reason: `ws-only (migration v6 not applied: ${selErr.message.slice(0, 80)})` };
  }
  if (agentRow && agentRow.is_dormant === false) return { activated: false, reason: 'already active' };

  if (agentRow) {
    const { error } = await supabase.from('agent_states').update({ is_dormant: false, state: 'idle', activity: 'Department online' }).eq('profile', agentKey);
    if (error) return { activated: false, reason: `db update failed: ${error.message}` };
  }
  emitAgentState(agentKey, 'idle', 'Department online');
  emitFeed('system', 'PROVISIONED', { agent: agentKey, event: 'Paid Media department online', persisted: true });
  broadcast('department_online', { agent: agentKey, message: 'Paid Media department online' });
  return { activated: true, persisted: true, reason: 'provisioned from dormant template' };
}

export async function hibernateDormantAgent(agentKey: string): Promise<{ hibernated: boolean; reason: string }> {
  // Count remaining active scale clients — package_key lives in clients.metadata JSON
  const { count, error: cntErr } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('metadata->>package_key', 'scale');
  if (!cntErr && count && count > 0) return { hibernated: false, reason: `${count} scale clients remain` };

  const { data: agentRow, error: selErr } = await supabase.from('agent_states').select('profile, is_dormant').eq('profile', agentKey).maybeSingle();
  if (selErr) return { hibernated: false, reason: `migration v6 not applied: ${selErr.message.slice(0, 80)}` };
  if (!agentRow || agentRow.is_dormant === true) return { hibernated: false, reason: 'already dormant' };

  const { error } = await supabase.from('agent_states').update({ is_dormant: true, state: 'idle', activity: 'Dormant (no ads clients)' }).eq('profile', agentKey);
  if (error) return { hibernated: false, reason: `db update failed: ${error.message}` };
  emitAgentState(agentKey, 'idle', 'Dormant (no ads clients)');
  emitFeed('system', 'HIBERNATED', { agent: agentKey, event: 'Paid Media department dormant' });
  broadcast('department_offline', { agent: agentKey, message: 'Paid Media department dormant — no ads clients' });
  return { hibernated: true, reason: 'last ads client churned' };
}

// POST /api/v1/onboard — the Part E3 onboarding endpoint.
// Body: { name, package_key, has_logo, industry?, location?, contact?, email?, goal?, intake_notes? }
// Flow: client row (package_key + has_logo + intake_notes) → dormant trigger (scale→ads_manager)
