require('fs');
const path = require('path');
const envPath = path.join('C:/Users/Abhishek/SpinachOS-v4/api/scripts', '..', '.env');
for (const line of require('fs').readFileSync(envPath,'utf8').split('\n')) { const m=line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2]; }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API = 'http://localhost:4000';
(async () => {
  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const r0 = await fetch(API + '/api/v1/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + boot }, body: JSON.stringify({ sub: 'p10-mock', role: 'director' }) });
  const { token } = await r0.json();
  const fH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // Full path against the MOCK provider (proves pluggability):
  // idea → generate → approve → schedule (past time) → publish → status
  const t0 = Date.now();
  // Register the MOCK provider key + deactivate publora — the registry
  // iterates in insertion order (publora first), so the mock only activates
  // when publora is disconnected. This proves the pluggable interface end-to-end.
  await sb.from('provider_keys').upsert({ provider: 'mock', key_ciphertext: 'mock-e2e-key', is_active: true, label: 'MOCK (Phase 10 E2E)' });
  await sb.from('provider_keys').update({ is_active: false }).eq('provider', 'publora');
  const rc = await fetch(API + '/api/v1/grow/items', { method: 'POST', headers: fH, body: JSON.stringify({ title: 'Mock provider E2E', channel: 'x', body_text: 'Test the pluggable registry' }) });
  const item = await rc.json();
  console.log('1. create:', rc.status, item.id);

  const rg = await fetch(API + '/api/v1/grow/items/' + item.id + '/generate', { method: 'POST', headers: fH, body: JSON.stringify({}) });
  const g = await rg.json();
  console.log('2. generate:', rg.status, 'score:', g.style_score, 'card:', g.card_id);

  const ra = await fetch(API + '/api/v1/approvals/' + g.card_id + '/approve', { method: 'POST', headers: fH, body: JSON.stringify({}) });
  console.log('3. approve:', ra.status);

  // schedule 5s in the PAST → the scheduler picks it up within 60s
  const past = new Date(Date.now() - 5000).toISOString();
  const rsch = await fetch(API + '/api/v1/grow/items/' + item.id + '/schedule', { method: 'POST', headers: fH, body: JSON.stringify({ scheduled_for: past }) });
  console.log('4. schedule (past):', rsch.status);

  // wait for the scheduler (up to 70s)
  let finalItem = null;
  for (let i = 0; i < 14; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await sb.from('content_items').select('status, provider_post_id, published_at').eq('id', item.id).single();
    if (data && data.status === 'published') { finalItem = data; break; }
  }
  console.log('5. scheduler published:', finalItem ? finalItem.status : 'TIMEOUT', finalItem?.provider_post_id);

  // 6. ledger entry check (agent_memory, key=publish:<item_id>)
  const { data: ledger } = await sb.from('agent_memory').select('id, agent_profile, memory_type, key, value').order('created_at', { ascending: false }).limit(3);
  console.log('6. ledger latest:', JSON.stringify(ledger?.map(l => ({ agent: l.agent_profile, key: l.key, value: String(JSON.stringify(l.value)).slice(0, 100) })), null, 1));

  // 7. latency: calendar read p95
  const lat = [];
  for (let i = 0; i < 10; i++) {
    const s = Date.now();
    await fetch(API + '/api/v1/grow/calendar', { headers: fH });
    lat.push(Date.now() - s);
  }
  lat.sort((a, b) => a - b);
  console.log('7. calendar latency ms (10 reads):', lat.join(','), 'p95:', lat[9]);

  // cleanup + reactivate publora
  await sb.from('content_items').delete().eq('id', item.id);
  await sb.from('approvals').delete().eq('id', g.card_id);
  await sb.from('provider_keys').delete().eq('provider', 'mock');
  await sb.from('provider_keys').update({ is_active: true }).eq('provider', 'publora');
  console.log('cleaned (mock removed, publora reactivated)');
  console.log('TOTAL ms:', Date.now() - t0);
})();