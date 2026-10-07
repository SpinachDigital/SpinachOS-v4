#!/usr/bin/env node
/**
 * Phase 8.1 — CLOSE THE PORTAL LOOP — live probe (re-runnable).
 * Verifies on the running stack:
 *   GOAL 2: preview read routes return client data; re-decide → 403;
 *           client session on preview routes → 403.
 *   GOAL 3: gate file_deliverable on a client_visible workflow → deliverable
 *           enters pending_client_review → client approves → accepted →
 *           pipeline filed event carries client_review.
 *   SECURITY: client session on founder /clients → 401.
 * Run: node scripts/phase81-probe.js (API :4000 + 066 applied)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const API = 'http://localhost:4000';

async function main() {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };

  // 0. founder token
  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const m = await fetch(`${API}/api/v1/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${boot}` }, body: JSON.stringify({ sub: 'probe-founder', role: 'director' }) });
  const { token: founder } = await m.json();
  const fH = { 'Content-Type': 'application/json', Authorization: `Bearer ${founder}` };
  log(`0. founder token minted (${m.status})`);

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. probe client + client_visible workflow (via install of content-production pack)
  const rC = await fetch(`${API}/api/v1/clients`, { method: 'POST', headers: fH, body: JSON.stringify({ name: '__p81-probe', industry: 'probe', status: 'active' }) });
  const client = await rC.json();
  log(`1. client created (${rC.status}) ${client.id}`);

  // check the pack's client_visible flag (066 seeded it true)
  const { data: pack } = await sb.from('playbooks').select('slug, client_visible').eq('slug', 'content-production').limit(1).single();
  log(`1b. pack client_visible: ${pack?.client_visible} (expect true from 066)`);

  // install → workflow inherits the flag
  const rI = await fetch(`${API}/api/v1/playbooks/content-production/install`, { method: 'POST', headers: fH, body: JSON.stringify({ client_id: client.id }) });
  const inst = await rI.json();
  log(`2. install (${rI.status}): workflow=${inst.workflow?.id}`);
  const { data: wfRow } = await sb.from('workflows').select('client_visible').eq('id', inst.workflow.id).single();
  log(`2b. workflow client_visible: ${wfRow?.client_visible} (expect true — inherited at install)`);

  // find the file_deliverable gate on this workflow
  const { data: gates } = await sb.from('gate_actions').select('id, gate_name, action, status').eq('workflow_id', inst.workflow.id).eq('action', 'file_deliverable');
  const gate = gates?.[0];
  log(`3. file_deliverable gate: ${gate?.id} (${gate?.status})`);

  // 4. approve the gate → file_deliverable RUNS via /run (deny-by-default) → client_review=pending
  const rG = await fetch(`${API}/api/v1/gates/${gate.id}/approve`, { method: 'POST', headers: fH, body: JSON.stringify({}) });
  log(`4. gate approve (${rG.status})`);
  const rRun = await fetch(`${API}/api/v1/gates/${gate.id}/run`, { method: 'POST', headers: fH, body: JSON.stringify({}) });
  const gRes = await rRun.json();
  log(`4a. gate run (${rRun.status}): action=${gRes.action} client_review=${gRes.client_review}`);
  const filedId = gRes.deliverable?.id;
  const { data: filedRow } = await sb.from('deliverables').select('metadata, title').eq('id', filedId).single();
  log(`4b. deliverable metadata.client_review: ${filedRow?.metadata?.client_review} (expect pending)`);

  // 5. client invite → redeem → session
  const rInv = await fetch(`${API}/api/v1/portal/invites`, { method: 'POST', headers: fH, body: JSON.stringify({ client_id: client.id, email: 'p81@probe.test' }) });
  const inv = await rInv.json();
  const rRed = await fetch(`${API}/api/v1/portal/redeem?token=${encodeURIComponent(inv.link.split('token=')[1])}`);
  const sess = await rRed.json();
  const cH = { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.token}` };
  log(`5. invite+session: invite=${rInv.status} session=${rRed.status}`);

  // 6. pending-reviews populated for real
  const rPR = await fetch(`${API}/api/v1/portal/pending-reviews`, { headers: cH });
  const prBody = await rPR.json();
  const inPending = (prBody.reviews || []).some(d => d.id === filedId);
  log(`6. client pending-reviews (${rPR.status}): contains filed deliverable: ${inPending} (expect true)`);

  // 7. pipeline filed event with client_review
  const { data: feedCheck } = await sb.from('pipeline_events').select('id, detail').eq('workflow_id', inst.workflow.id).eq('event', 'filed').order('created_at', { ascending: false }).limit(1);
  log(`7. pipeline filed event client_review: ${JSON.stringify(feedCheck?.[0]?.detail?.client_review)} (expect "pending")`);

  // 8. client approves → accepted
  const rDec = await fetch(`${API}/api/v1/portal/reviews/${filedId}/decision`, { method: 'POST', headers: cH, body: JSON.stringify({ decision: 'approved', note: 'probe sign-off' }) });
  const decBody = await rDec.json();
  log(`8. client decision (${rDec.status}): ${decBody.decision}`);
  const { data: afterDec } = await sb.from('deliverables').select('metadata').eq('id', filedId).single();
  log(`8b. after decision client_review: ${afterDec?.metadata?.client_review} (expect accepted)`);

  // 9. ledger entry (wait for void insert to settle)
  await new Promise(res => setTimeout(res, 1500));
  const { data: ledgerRow } = await sb.from('agent_memory').select('id, key').like('key', `client_review:${filedId}%`).limit(1);
  log(`9. ledger entry: ${ledgerRow?.[0]?.id || 'MISSING'}`);

  // 10. GOAL 2: preview read routes (founder + preview_client_id)
  const q = `preview_client_id=${client.id}`;
  const rPO = await fetch(`${API}/api/v1/portal/preview/overview?${q}`, { headers: fH });
  const poBody = await rPO.json();
  log(`10. preview overview (${rPO.status}): client_id=${poBody.client_id === client.id ? 'MATCH' : 'MISMATCH'} waiting=${poBody.waiting_on_you}`);
  const rPD = await fetch(`${API}/api/v1/portal/preview/deliverables?${q}`, { headers: fH });
  const pdBody = await rPD.json();
  log(`10b. preview deliverables (${rPD.status}): rows=${(pdBody.deliverables || []).length}`);

  // 11. re-decide decided deliverable → 403 (not awaiting review)
  const rDec2 = await fetch(`${API}/api/v1/portal/reviews/${filedId}/decision`, { method: 'POST', headers: cH, body: JSON.stringify({ decision: 'approved' }) });
  log(`11. re-decide decided deliverable → ${rDec2.status} (expect 403 — not awaiting review)`);

  // 12. SECURITY: client session on founder routes → 401
  const rSec = await fetch(`${API}/api/v1/clients`, { headers: cH });
  log(`12. client session on founder /clients → ${rSec.status} (expect 401)`);

  // 13. client session on preview routes → 403 (preview is founder-only)
  const rSec2 = await fetch(`${API}/api/v1/portal/preview/overview?${q}`, { headers: cH });
  log(`13. client session on preview route → ${rSec2.status} (expect 403)`);

  // 14. cleanup probe rows
  await sb.from('deliverables').delete().eq('id', filedId);
  await sb.from('portal_invites').delete().eq('client_id', client.id);
  await sb.from('client_sessions').delete().eq('client_id', client.id);
  await sb.from('pipeline_events').delete().eq('workflow_id', inst.workflow.id);
  await sb.from('gate_actions').delete().eq('workflow_id', inst.workflow.id);
  await sb.from('workflows').delete().eq('id', inst.workflow.id);
  await sb.from('agent_memory').delete().like('key', `client_review:${filedId}%`);
  log('14. probe rows cleaned');
  return out;
}
main().catch(e => { console.error('PROBE CRASH:', e.message); process.exit(1); });
