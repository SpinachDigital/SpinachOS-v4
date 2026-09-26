// Sprint 2 dedupe verification: old dup 38c14a25 gone; its dependents intact?
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KEEP = '70bc3210-a3f0-4037-889b-c80b23805baf';

(async () => {
  const { data: keo } = await sb.from('clients').select('id, name').ilike('name', 'keo karpin');
  console.log('keo karpin rows:', keo.length, keo.map(c => c.id.slice(0, 8)));

  // dangling client_id check across dependents
  for (const tbl of ['workflows', 'invoices', 'leads', 'events', 'calendars', 'marketing_content_calendar']) {
    const { count: total } = await sb.from(tbl).select('id', { count: 'exact', head: true });
    const { data: rows } = await sb.from(tbl).select('id, client_id').not('client_id', 'is', null).limit(500);
    // fetch all client ids
    const { data: clients } = await sb.from('clients').select('id');
    const ids = new Set((clients || []).map(c => c.id));
    const dangling = (rows || []).filter(r => !ids.has(r.client_id));
    console.log(tbl.padEnd(26), 'total:', total, '| sampled dangling client_ids:', dangling.length);
    dangling.slice(0, 5).forEach(r => console.log('   DANGLING:', tbl, r.id.slice(0, 8), '→ client', (r.client_id || '').slice(0, 8)));
  }
  // keep ke workflows
  const { count: keepWf } = await sb.from('workflows').select('id', { count: 'exact', head: true }).eq('client_id', KEEP);
  console.log('workflows on keep client:', keepWf);
})().catch(e => console.log('FAIL', e.message));
