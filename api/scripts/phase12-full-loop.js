// PHASE 12 GOAL 5 — THE FULL COMPANY LOOP, one continuous probe:
// seed lead → qualify → approve → draft outreach → approve → send (honest
// pending_send — no key in DB) → onboard → client + pipeline + invite →
// advance pipeline → gate → file deliverable → asset auto-stamped →
// reuse asset → GROW draft → generate → approve → schedule → publish (mock) →
// ledger entries at every step. Real IDs end-to-end.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const API = 'http://localhost:4000/api/v1';
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const TOKEN = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '4h' });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const SH = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function req(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
}
async function db(table, query) {
  return (await (await fetch(`${URL}/rest/v1/${table}?${query}`, { headers: SH })).json());
}

const log = [];
function step(n, name, status, detail) {
  const line = `STEP ${n} ${name}: ${status}${detail ? ' — ' + String(detail).slice(0, 150) : ''}`;
  log.push(line); console.log(line);
}

(async () => {
  const stamp = Date.now();
  const ids = {};

  // 1. seed lead
  let r = await req('POST', '/leads', { name: 'Full Loop Lead', email: `fullloop-${stamp}@loopco.co`, company: 'LoopCo Industries', source: 'referral', notes: 'Referred by Rohit. Budget approved for full ads automation retainer. Looking for an agency now.' });
  step(1, 'create lead', r.status, r.d?.id); ids.lead = r.d?.id;

  // 2. qualify (agent)
  r = await req('POST', `/leads/${ids.lead}/qualify`);
  step(2, 'qualify (agent score)', r.status, `score ${r.d?.score}`); ids.qualCard = r.d?.card_id;

  // 3. founder approves qualification
  r = await req('POST', `/approvals/${ids.qualCard}/approve`);
  step(3, 'approve qualify card', r.status);

  // 4. draft outreach (agent, style-linted)
  r = await req('POST', `/leads/${ids.lead}/draft-outreach`);
  step(4, 'draft outreach', r.status, `style ${r.d?.style_score}`); ids.draft = r.d?.draft_id; ids.outCard = r.d?.card_id;

  // 5. golden rule: direct send blocked
  r = await req('POST', `/outreach/${ids.draft}/approve-and-send`);
  step(5, 'direct send WITHOUT approval', r.status, r.status === 403 ? '403 BLOCKED (golden rule) ✅' : JSON.stringify(r.d));

  // 6. founder approves outreach
  r = await req('POST', `/approvals/${ids.outCard}/approve`);
  step(6, 'approve outreach card', r.status);

  // 7. send (honest — no sender connected)
  r = await req('POST', `/outreach/${ids.draft}/approve-and-send`);
  step(7, 'send (honest path)', r.status, r.d?.status || JSON.stringify(r.d));

  // 8. lead responds (founder marks)
  r = await req('PATCH', `/leads/${ids.lead}`, { status: 'responded' });
  step(8, 'lead responded', r.status, r.d?.status);

  // 9. onboard → client + pipeline + invite
  r = await req('POST', `/leads/${ids.lead}/onboard`, { playbook_pack_slug: 'client-onboarding' });
  step(9, 'onboard', r.status, `client ${r.d?.client_id?.slice(0, 8)} pipeline ${r.d?.pipeline_id?.slice(0, 8)} invite ${r.d?.invite_id?.slice(0, 8)}`);
  ids.client = r.d?.client_id; ids.pipeline = r.d?.pipeline_id; ids.invite = r.d?.invite_id;

  // 10. advance pipeline one stage (gate: advance_stage)
  r = await req('POST', '/gates', { workflow_id: ids.pipeline, client_id: ids.client, gate_name: `loop-advance-${stamp}`, action: 'advance_stage', risk_tier: 'read' });
  step(10, 'create advance gate', r.status, r.d?.gate_id?.slice(0, 8)); ids.advGate = r.d?.gate_id;
  r = await req('POST', `/gates/${ids.advGate}/approve`); step(11, 'approve advance gate', r.status);
  r = await req('POST', `/gates/${ids.advGate}/run`); step(12, 'advance stage (run)', r.status, `step: ${r.d?.to || r.d?.advanced_to || JSON.stringify(r.d).slice(0, 60)}`);

  // 13. file deliverable at gate (auto-asset)
  r = await req('POST', '/gates', { workflow_id: ids.pipeline, client_id: ids.client, gate_name: `loop-file-${stamp}`, action: 'file_deliverable', risk_tier: 'write', payload: { title: `LoopCo Brand Sprint Deck ${stamp}`, kind: 'report', content: 'The full-loop probe deliverable — brand sprint summary deck.', after_step: 'kickoff' } });
  step(13, 'create file gate', r.status, r.d?.gate_id?.slice(0, 8)); ids.fileGate = r.d?.gate_id;
  r = await req('POST', `/gates/${ids.fileGate}/approve`); step(14, 'approve file gate', r.status);
  r = await req('POST', `/gates/${ids.fileGate}/run`); step(15, 'file deliverable (run)', r.status, `deliverable ${r.d?.deliverable?.id?.slice(0, 8)}`);
  ids.deliverable = r.d?.deliverable?.id;

  // 16. asset auto-stamp verify (DB)
  const filed = await db('deliverables', `select=id,title,metadata&id=eq.${ids.deliverable}`);
  const stamp16 = filed[0]?.metadata?.library;
  step(16, 'asset auto-stamp (library)', stamp16 ? 'VERIFIED' : 'MISSING', `bucket ${stamp16?.bucket}`);

  // 17. reuse asset → GROW draft
  r = await req('POST', `/assets/${ids.deliverable}/reuse`, { target: 'grow_draft', note: 'full-loop reuse' });
  step(17, 'reuse → GROW draft', r.status, `draft ${r.d?.draft_id?.slice(0, 8)}`); ids.growDraft = r.d?.draft_id;

  // 18. generate (Laya drafts in style)
  r = await req('POST', `/grow/items/${ids.growDraft}/generate`);
  step(18, 'generate (agent)', r.status, r.d?.style_score != null ? `style ${r.d?.style_score}` : JSON.stringify(r.d).slice(0, 60));
  ids.genCard = r.d?.card_id;

  // 19. founder approves the draft
  r = await req('POST', `/approvals/${ids.genCard}/approve`);
  step(19, 'approve draft card', r.status);

  // 20. schedule (the schedule route enforces approved-first — same as the
  // Phase 10 loop; the PATCH route only edits idea/draft, this item is approved)
  r = await req('POST', `/grow/items/${ids.growDraft}/schedule`, { scheduled_for: new Date(Date.now() - 60_000).toISOString() });
  step(20, 'schedule', r.status, r.d?.status);

  // 21. publish — MOCK provider (publora deactivates first: the registry
  // iterates in insertion order, so mock only activates when publora is off;
  // cleanup re-activates publora — the Phase 10 loop-probe pattern)
  await fetch(`${URL}/rest/v1/provider_keys`, { method: 'POST', headers: SH, body: JSON.stringify({ provider: 'mock', key_ciphertext: 'mock-e2e-key', is_active: true, label: 'MOCK (Phase 12 full-loop)' }) });
  await fetch(`${URL}/rest/v1/provider_keys?provider=eq.publora`, { method: 'PATCH', headers: SH, body: JSON.stringify({ is_active: false }) });
  try {
    r = await req('POST', `/grow/items/${ids.growDraft}/publish`);
    step(21, 'publish (mock)', r.status, `post ${r.d?.provider_post_id || JSON.stringify(r.d).slice(0, 60)}`);
  } finally {
    // cleanup: mock off, publora back on
    await fetch(`${URL}/rest/v1/provider_keys?provider=eq.mock`, { method: 'DELETE', headers: SH });
    await fetch(`${URL}/rest/v1/provider_keys?provider=eq.publora`, { method: 'PATCH', headers: SH, body: JSON.stringify({ is_active: true }) });
    console.log('  (cleanup: mock removed, publora reactivated)');
  }

  // 22. ledger entries at every step (replay)
  const ledger = await db('agent_memory', `select=key&key=like.*${ids.lead.slice(0, 8)}*&limit=5`);
  const onboardLedger = await db('agent_memory', `select=key,value&key=eq.onboard:${ids.lead}&limit=2`);
  step(22, 'ledger entries', onboardLedger.length > 0 ? 'REPLAYABLE' : 'none', `onboard:${ids.lead.slice(0, 8)} + outreach key`);

  const outreachLedger = await db('agent_memory', `select=key&key=eq.outreach:${ids.draft}&limit=2`);
  console.log(`  outreach ledger key present: ${outreachLedger.length > 0}`);

  console.log('\n=== FULL LOOP COMPLETE ===');
  console.log('ids:', JSON.stringify({ lead: ids.lead, client: ids.client, pipeline: ids.pipeline, invite: ids.invite, deliverable: ids.deliverable, grow_draft: ids.growDraft }, null, 2));
  fs.writeFileSync('C:/Users/Abhishek/AppData/Local/Temp/p12-full-loop-result.json', JSON.stringify({ log, ids }, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
