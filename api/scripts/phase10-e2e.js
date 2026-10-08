require('fs');
const path = require('path');
const envPath = path.join('C:/Users/Abhishek/SpinachOS-v4/api/scripts', '..', '.env');
for (const line of require('fs').readFileSync(envPath,'utf8').split('\n')) { const m=line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2]; }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API = 'http://localhost:4000';
(async () => {
  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const r0 = await fetch(API + '/api/v1/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + boot }, body: JSON.stringify({ sub: 'p10-e2e', role: 'director' }) });
  const { token } = await r0.json();
  const fH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  
  // 1. create idea
  const rc = await fetch(API + '/api/v1/grow/items', { method: 'POST', headers: fH, body: JSON.stringify({ title: 'Test idea', channel: 'x', body_text: 'Initial thought' }) });
  const item = await rc.json();
  console.log('1. create idea:', rc.status, item);
  
  // 2. calendar read
  const rcal = await fetch(API + '/api/v1/grow/calendar', { headers: fH });
  const cal = await rcal.json();
  console.log('2. calendar:', rcal.status, cal.length, 'items');
  
  // 3. patch
  const rp = await fetch(API + '/api/v1/grow/items/' + item.id, { method: 'PATCH', headers: fH, body: JSON.stringify({ title: 'Updated idea', body_text: 'Updated body' }) });
  const p = await rp.json();
  console.log('3. patch:', rp.status, p.title);
  
  // 4. generate
  const rg = await fetch(API + '/api/v1/grow/items/' + item.id + '/generate', { method: 'POST', headers: fH, body: JSON.stringify({}) });
  const g = await rg.json();
  console.log('4. generate:', rg.status, 'score:', g.style_score, 'card:', g.card_id);
  
  // 5. direct publish without approval (should 403 — item is draft)
  const rpub = await fetch(API + '/api/v1/grow/items/' + item.id + '/publish', { method: 'POST', headers: fH, body: JSON.stringify({}) });
  console.log('5. direct publish (draft):', rpub.status, '(expect 403)');
  
  // 6. approve the card
  const ra = await fetch(API + '/api/v1/approvals/' + g.card_id + '/approve', { method: 'POST', headers: fH, body: JSON.stringify({}) });
  console.log('6. approve card:', ra.status);
  
  // 7. check item status after approve
  const { data: itemAfter } = await sb.from('content_items').select('status, style_score').eq('id', item.id).single();
  console.log('7. item after approve:', itemAfter?.status, '(expect approved)');
  
  // 8. schedule
  const rsch = await fetch(API + '/api/v1/grow/items/' + item.id + '/schedule', { method: 'POST', headers: fH, body: JSON.stringify({ scheduled_for: new Date(Date.now() + 3600000).toISOString() }) });
  console.log('8. schedule:', rsch.status);
  
  // 9. publish (approved — dry-run since no provider)
  const rpub2 = await fetch(API + '/api/v1/grow/items/' + item.id + '/publish', { method: 'POST', headers: fH, body: JSON.stringify({}) });
  const pub2 = await rpub2.json();
  console.log('9. publish (approved):', rpub2.status, pub2);
  
  // 10. check final status
  const { data: itemFinal } = await sb.from('content_items').select('status, provider_post_id, published_at').eq('id', item.id).single();
  console.log('10. final item:', itemFinal?.status, itemFinal?.provider_post_id);
  
  // cleanup
  await sb.from('content_items').delete().eq('id', item.id);
  await sb.from('approvals').delete().eq('id', g.card_id);
  console.log('cleaned');
})();