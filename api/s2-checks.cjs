// Sprint 2 pre-checks: keo karpin duplicates + /api/overview/stats labels.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await sb.from('clients').select('id, name, status, business_type, created_at').order('created_at', { ascending: false }).limit(100);
  const names = {};
  (data || []).forEach(c => { names[c.name] = (names[c.name] || 0) + 1; });
  console.log('duplicate client names:', JSON.stringify(names));
  const dupes = Object.entries(names).filter(([, n]) => n > 1);
  for (const [name] of dupes) {
    const rows = data.filter(c => c.name === name);
    console.log('---', name, '---');
    rows.forEach(r => console.log('  ', r.id.slice(0, 8), r.status, r.business_type, r.created_at));
  }
  const r = await fetch('http://localhost:4000/api/overview/stats');
  const stats = await r.json();
  console.log('overview stats labels:', JSON.stringify((Array.isArray(stats) ? stats : [stats]).map(s => s.label)));
})().catch(e => console.log('FAIL', e.message));
