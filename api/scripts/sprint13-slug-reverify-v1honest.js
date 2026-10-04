// Sprint 13 nit re-verify TEST 3 (honest v1→v2): install from an explicit
// v1-only pack (v2 deleted first), then seed v2, verify v1 instance untouched.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const TOKEN = fs.readFileSync('.director-jwt', 'utf8').trim();
  const CLIENT = '37ef7e34-a48b-4499-9a9f-01487d682938';

  // 0. delete v2 so install picks v1 (the pre-v2 state)
  await c.from('playbooks').delete().eq('slug', 'client-onboarding').eq('version', 2);
  const { data: packs } = await c.from('playbooks').select('slug,version').eq('slug', 'client-onboarding');
  console.log('0. packs before:', packs.map(p => 'v' + p.version).join(','));

  // 1. install v1
  const res = await fetch('http://localhost:4000/api/v1/playbooks/client-onboarding/install', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT, name: 'Nit4 v1-honest test' }),
  });
  const inst = await res.json();
  const wfId = (inst.workflow || inst.pipeline || inst).id;
  const { data: v1before } = await c.from('workflows').select('name,steps_json,metadata,current_step,updated_at').eq('id', wfId).single();
  console.log('1. install v1: workflow=' + String(wfId).slice(0, 8) + '  pack_version=' + (v1before?.metadata || {}).pack_version + '  steps=[' + (v1before?.steps_json || []).map(s => s.name).join(',') + ']');

  // 2. seed v2
  const { data: seedv2, error: e3 } = await c.from('playbooks').insert({
    slug: 'client-onboarding', version: 2, name: 'Client Onboarding v2',
    description: 'v2: revised stages + kickoff-review gate', workflow_type: 'onboarding',
    stages_json: [{ name: 'kickoff' }, { name: 'discovery' }, { name: 'proposal_review' }, { name: 'handoff' }],
    tasks_json: [{ name: 'Kickoff call', agent: 'ceo', step_name: 'kickoff' }, { name: 'Proposal draft', agent: 'designer', step_name: 'proposal_review' }],
    gates_json: [{ name: 'Proposal approval gate', action: 'approve_deliverable', risk_tier: 'medium', after_step: 'proposal_review' }],
  }).select('id,version').single();
  console.log('2. seed v2:', e3 ? 'FAIL: ' + e3.message.slice(0, 90) : 'OK  id=' + (seedv2?.id || '').slice(0, 8) + '  v' + seedv2?.version);

  // 3. v1 instance UNTOUCHED?
  const { data: v1after } = await c.from('workflows').select('name,steps_json,metadata,current_step,updated_at').eq('id', wfId).single();
  const same = JSON.stringify(v1before) === JSON.stringify(v1after);
  console.log('3. v1 after v2 seed: pack_version=' + (v1after?.metadata || {}).pack_version + '  steps=[' + (v1after?.steps_json || []).map(s => s.name).join(',') + ']  updated_at=' + String(v1after?.updated_at).slice(0, 19));
  console.log('   v1 instance untouched:', same ? 'PASS (snapshot byte-identical)' : 'FAIL (instance mutated!)');

  // 4. fresh install gets v2
  const res2 = await fetch('http://localhost:4000/api/v1/playbooks/client-onboarding/install', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT, name: 'Nit4 v2-fresh honest' }),
  });
  const inst2 = await res2.json();
  const wf2 = (inst2.workflow || inst2.pipeline || inst2).id;
  const { data: v2inst } = await c.from('workflows').select('name,steps_json,metadata').eq('id', wf2).single();
  console.log('4. fresh install: v' + (v2inst?.metadata || {}).pack_version + '  steps=[' + (v2inst?.steps_json || []).map(s => s.name).join(',') + ']');
  console.log('   VERDICT:', (v2inst?.metadata || {}).pack_version === 2 ? 'PASS (new installs get v2)' : 'FAIL');

  // cleanup
  await c.from('workflows').delete().eq('id', wfId);
  await c.from('workflows').delete().eq('id', wf2);
  console.log('cleanup: test instances deleted (client-onboarding v1 + v2 pack seeds kept)');
})();
