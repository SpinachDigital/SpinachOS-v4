// QA probe-row cleanup via PostgREST (no DDL needed — run once, 13 Oct 2026).
// Backups already on disk: docs/evidence/qa-quarantine-backup/*.json
// Deletes: __* probe clients, test* clients, Batch Lead seed leads.
// The is_test COLUMN migration (supabase/migration-qa-quarantine.sql) still
// needs the Supabase dashboard SQL editor — founder runs that separately.
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const OUT = path.join(__dirname, '..', '..', 'docs', 'evidence', 'qa-quarantine-backup');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1. backup rows that will be deleted
  const bak = await sb.from('clients').select('*').limit(1000);
  fs.writeFileSync(path.join(OUT, 'clients-pre-delete.json'), JSON.stringify(bak.data || []));
  const bakL = await sb.from('leads').select('*').limit(2000);
  fs.writeFileSync(path.join(OUT, 'leads-pre-delete.json'), JSON.stringify(bakL.data || []));
  console.log('backups refreshed');

  // 2. delete probe clients (__ prefix, 2+ chars) + test-named clients
  // PostgREST like: % wildcard. '__%' = starts with two underscores.
  const d1 = await sb.from('clients').delete().like('name', '\\_\\_%');
  console.log('__ clients:', d1.error ? 'ERR ' + d1.error.message : 'deleted');
  const d2 = await sb.from('clients').delete().ilike('name', 'test%');
  console.log('test* clients:', d2.error ? 'ERR ' + d2.error.message : 'deleted');
  const d2b = await sb.from('clients').delete().ilike('name', 'qa test%');
  console.log('qa test clients:', d2b.error ? 'ERR ' + d2b.error.message : 'deleted');
  const d3 = await sb.from('leads').delete().like('name', 'Batch Lead%');
  console.log('Batch Lead leads:', d3.error ? 'ERR ' + d3.error.message : 'deleted');
  const d4 = await sb.from('leads').delete().ilike('name', 'test%');
  console.log('test* leads:', d4.error ? 'ERR ' + d4.error.message : 'deleted');

  // 3. verify
  const c = await sb.from('clients').select('id', { count: 'exact', head: true });
  console.log('clients remaining:', c.count);
  const l = await sb.from('leads').select('id', { count: 'exact', head: true });
  console.log('leads remaining:', l.count);
  const probe = await sb.from('clients').select('name').like('name', '\\_\\_%');
  console.log('probe clients left:', (probe.data || []).length);
})();
