// Sprint 13 nit re-verify: slug-unique → (slug, version) — 3 tests, real output
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const TOKEN = fs.readFileSync('.director-jwt', 'utf8').trim();
  const CLIENT = '37ef7e34-a48b-4499-9a9f-01487d682938';
  const base = { name: 'reverify probe', workflow_type: 'content', stages_json: [{ name: 's1' }], tasks_json: [], gates_json: [] };

  await c.from('playbooks').delete().eq('slug', '__reverify-probe');

  // TEST 1: same slug, version 1 + 2 — dono succeed
  const { data: r1a, error: e1a } = await c.from('playbooks').insert({ slug: '__reverify-probe', version: 1, ...base }).select('id,slug,version').single();
  const { data: r1b, error: e1b } = await c.from('playbooks').insert({ slug: '__reverify-probe', version: 2, name: 'reverify probe v2', workflow_type: 'content', stages_json: [{ name: 's1' }], tasks_json: [], gates_json: [] }).select('id,slug,version').single();
  console.log('TEST 1 — same slug, version 1 aur 2 (dono insert):');
  console.log('  row v1:', e1a ? 'FAIL: ' + e1a.message.slice(0, 90) : 'OK  id=' + r1a.id.slice(0, 8) + '  ' + r1a.slug + ' v' + r1a.version);
  console.log('  row v2:', e1b ? 'FAIL: ' + e1b.message.slice(0, 90) : 'OK  id=' + r1b.id.slice(0, 8) + '  ' + r1b.slug + ' v' + r1b.version);
  console.log('  VERDICT:', (!e1a && !e1b) ? 'PASS' : 'FAIL');
  console.log('');

  // TEST 2: same slug+version duplicate — fail hona chahiye
  const { error: e2 } = await c.from('playbooks').insert({ slug: '__reverify-probe', version: 1, ...base });
  console.log('TEST 2 — same slug+version duplicate:');
  console.log('  result:', e2 ? 'REJECTED: ' + e2.message.slice(0, 100) : 'INSERTED (FAIL — duplicate allowed!)');
  console.log('  VERDICT:', e2 ? 'PASS' : 'FAIL');
  console.log('');

  // TEST 3: v2 pack seed → v1 instance untouched
  const res = await fetch('http://localhost:4000/api/v1/playbooks/client-onboarding/install', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT, name: 'Nit4 reverify v1' }),
  });
  const inst = await res.json();
  const wfId = (inst.workflow || inst.pipeline || inst).id;
  console.log('TEST 3 — v2 pack seed → v1 instance untouched:');
  console.log('  3a. install v1:', res.ok ? 'OK  workflow=' + String(wfId).slice(0, 8) : 'FAIL: ' + JSON.stringify(inst).slice(0, 90));

  const { data: v1before } = await c.from('workflows').select('name,steps_json,metadata,current_step,updated_at').eq('id', wfId).single();
  console.log('  3b. v1 snapshot: pack_version=' + (v1before?.metadata || {}).pack_version + '  steps=[' + (v1before?.steps_json || []).map(s => s.name).join(',') + ']  updated_at=' + String(v1before?.updated_at).slice(0, 19));

  await c.from('playbooks').delete().eq('slug', 'client-onboarding').eq('version', 2);
  const { data: seedv2, error: e3 } = await c.from('playbooks').insert({
    slug: 'client-onboarding', version: 2, name: 'Client Onboarding v2',
    description: 'v2: revised stages + kickoff-review gate', workflow_type: 'onboarding',
    stages_json: [{ name: 'kickoff' }, { name: 'discovery' }, { name: 'proposal_review' }, { name: 'handoff' }],
    tasks_json: [{ name: 'Kickoff call', agent: 'ceo', step_name: 'kickoff' }, { name: 'Proposal draft', agent: 'designer', step_name: 'proposal_review' }],
    gates_json: [{ name: 'Proposal approval gate', action: 'approve_deliverable', risk_tier: 'medium', after_step: 'proposal_review' }],
  }).select('id,version').single();
  console.log('  3c. seed v2:', e3 ? 'FAIL: ' + e3.message.slice(0, 90) : 'OK  id=' + (seedv2?.id || '').slice(0, 8) + '  v' + seedv2?.version);

  const { data: v1after } = await c.from('workflows').select('name,steps_json,metadata,current_step,updated_at').eq('id', wfId).single();
  const same = JSON.stringify(v1before) === JSON.stringify(v1after);
  console.log('  3d. v1 after seed: pack_version=' + (v1after?.metadata || {}).pack_version + '  steps=[' + (v1after?.steps_json || []).map(s => s.name).join(',') + ']  updated_at=' + String(v1after?.updated_at).slice(0, 19));
  console.log('  3e. v1 instance untouched:', same ? 'PASS (snapshot byte-identical)' : 'FAIL (instance mutated!)');

  const res2 = await fetch('http://localhost:4000/api/v1/playbooks/client-onboarding/install', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT, name: 'Nit4 reverify v2-fresh' }),
  });
  const inst2 = await res2.json();
  const wf2 = (inst2.workflow || inst2.pipeline || inst2).id;
  const { data: v2inst } = await c.from('workflows').select('name,steps_json,metadata').eq('id', wf2).single();
  console.log('  3f. fresh install: v' + (v2inst?.metadata || {}).pack_version + '  steps=[' + (v2inst?.steps_json || []).map(s => s.name).join(',') + ']');
  console.log('  3g. VERDICT:', (v2inst?.metadata || {}).pack_version === 2 ? 'PASS (new installs get v2)' : 'FAIL');
  console.log('');

  // cleanup: test instances + probe rows (real v2 pack seed stays)
  await c.from('workflows').delete().eq('id', wfId);
  await c.from('workflows').delete().eq('id', wf2);
  await c.from('playbooks').delete().eq('slug', '__reverify-probe');
  console.log('cleanup: test instances + probe rows deleted; client-onboarding v2 pack seed kept (real pack)');
})();
