// Phase 11 pre-check via REST (no RPC): current leads rows + statuses.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

(async () => {
  const r = await fetch(`${URL}/rest/v1/leads?select=status,email,source&limit=50`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const rows = await r.json();
  console.log('leads REST status:', r.status, 'count:', Array.isArray(rows) ? rows.length : rows);
  if (Array.isArray(rows)) {
    const by = {};
    for (const x of rows) by[x.status] = (by[x.status] || 0) + 1;
    console.log('status distribution:', JSON.stringify(by));
  } else console.log(String(JSON.stringify(rows)).slice(0, 300));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
