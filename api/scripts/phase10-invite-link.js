require('fs');
const path = require('path');
const envPath = path.join('C:/Users/Abhishek/SpinachOS-v4/api/scripts', '..', '.env');
for (const line of require('fs').readFileSync(envPath,'utf8').split('\n')) { const m=line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2]; }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API = 'http://localhost:4000';
(async () => {
  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const r0 = await fetch(API + '/api/v1/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + boot }, body: JSON.stringify({ sub: 'p10-shots', role: 'director' }) });
  const { token } = await r0.json();
  const fH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // Create a fresh invite for TechFlow Inc → returns the ONE-TIME magic link
  const { data: tf } = await sb.from('clients').select('id, name').eq('name', 'TechFlow Inc').single();
  const ri = await fetch(API + '/api/v1/portal/invites', { method: 'POST', headers: fH, body: JSON.stringify({ client_id: tf.id, email: 'a@probe.test', expires_days: 7 }) });
  const inv = await ri.json();
  console.log('invite:', ri.status);
  console.log('LINK=' + inv.link);
})();