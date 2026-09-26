// Sprint 2: dedupe keo karpin — pick the keeper (newest with dependencies),
// re-point dependents, delete the other. Then verify.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const NEW = '70bc3210'; // 2026-09-25 20:52 (newer)
const OLD = '38c14a25'; // 2026-09-25 07:34
const pfx = (s) => s.split('-')[0];

(async () => {
  const { data: all } = await sb.from('clients').select('id, name').order('created_at', { ascending: false }).limit(200);
  const keep = all.find(c => c.id.startsWith(NEW));
  const drop = all.find(c => c.id.startsWith(OLD));
  console.log('KEEP:', keep.id, '| DROP:', drop.id);

  // who references each? (workflows, pipelines/tasks via workflows, invoices, leads, events)
  const refs = {};
  for (const [tbl, col] of [['workflows', 'client_id'], ['invoices', 'client_id'], ['leads', 'client_id'], ['events', 'client_id'], ['calendars', 'client_id'], ['marketing_content_calendar', 'client_id']]) {
    const { count } = await sb.from(tbl).select('id', { count: 'exact', head: true }).eq(col, drop.id);
    refs[tbl] = count;
    const { count: keepCount } = await sb.from(tbl).select('id', { count: 'exact', head: true }).eq(col, keep.id);
    refs[tbl + ' (keep)'] = keepCount;
  }
  console.log('references:', JSON.stringify(refs));

  // re-point drop's dependents to keep, then delete drop
  for (const tbl of ['workflows', 'invoices', 'leads', 'events', 'calendars', 'marketing_content_calendar']) {
    const { data, error } = await sb.from(tbl).update({ client_id: keep.id }).eq('client_id', drop.id).select('id');
    if (error) console.log('repoint', tbl, 'ERR', error.message);
    else if (data) console.log('repointed', data.length, tbl, 'rows →', keep.id.slice(0, 8));
  }
  const { error: delErr } = await sb.from('clients').delete().eq('id', drop.id);
  console.log('delete:', delErr ? 'ERR ' + delErr.message : 'OK');
  const { data: after } = await sb.from('clients').select('id, name').eq('name', 'keo karpin');
  console.log('keo karpin rows after:', after.length, after.map(c => c.id.slice(0, 8)));
})().catch(e => console.log('FAIL', e.message));
