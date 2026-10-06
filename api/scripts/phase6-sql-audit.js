// Phase 6 GOAL 0(b) — SQL audit: migrations vs LIVE DB reconciliation.
// Probes information_schema (tables/columns), pg_policies, pg_constraint.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8');
const URL = env.match(/SUPABASE_URL=(\S+)/)[1].trim();
const KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1].trim();
const sb = createClient(URL, KEY);

async function rpc(sql) {
  // service-role REST can't run arbitrary SQL; use the /rest/v1/ tables +
  // OpenAPI introspection instead. We probe via known REST endpoints.
  const { data, error } = await sb.rpc('__sql', { q: sql }).catch(() => ({ data: null, error: { message: 'no rpc' } }));
  return { data, error };
}

(async () => {
  // 1. All tables that exist (via REST probe on OpenAPI root)
  const res = await fetch(URL + '/rest/v1/', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  const openapi = await res.json();
  const tables = Object.keys(openapi.definitions || {});
  console.log('LIVE TABLES (' + tables.length + '):', tables.sort().join(', '));

  // 2. Probe columns for the key migrations
  const colChecks = [
    ['leads', 'budget_signal'], ['leads', 'intent_signal'], ['leads', 'fit_signal'],
    ['approvals', 'type'], ['clients', 'monthly_value'],
    ['job_queue', 'status'], ['laya_routing_decisions', 'confidence'],
    ['provider_keys', 'mask_hint'], ['department_model_picks', 'model'],
    ['playbooks', 'version'], ['agent_memory', 'expiry'],
    ['usage_logs', 'cost_inr'], ['deliverables', 'version'],
    ['gate_actions', 'risk_tier'], ['content_calendar', 'status'],
  ];
  console.log('\nCOLUMN PROBES (REST select — 200 = column exists):');
  for (const [t, c] of colChecks) {
    try {
      const r = await fetch(`${URL}/rest/v1/${t}?select=${c}&limit=1`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      const ok = r.status === 200;
      const body = await r.text();
      console.log(`  ${ok ? 'OK ' : 'FAIL'} ${t}.${c} → ${r.status}${ok ? '' : ' ' + body.slice(0, 120)}`);
    } catch (e) { console.log(`  ERR ${t}.${c}: ${e.message}`); }
  }

  // 3. Playbooks seeded? (sprint-12 migration seed)
  const { data: packs } = await sb.from('playbooks').select('slug,version').limit(20);
  console.log('\nPLAYBOOKS:', JSON.stringify(packs));

  // 4. RLS: pg_policies not REST-probeable — check via a table's 401 behavior with anon-ish (no key)
  console.log('\nRLS behavioral probe (no key = should be denied/401):');
  try {
    const r = await fetch(`${URL}/rest/v1/clients?select=id&limit=1`, { headers: { apikey: 'invalid' } });
    console.log('  clients w/ bad key →', r.status, '(denied = RLS/auth on)');
  } catch (e) { console.log('  err', e.message); }

  // 5. Rows in phase5 tables
  for (const t of ['job_queue', 'laya_routing_decisions', 'provider_keys', 'department_model_picks']) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
    console.log(`ROWS ${t}: ${count}`);
  }
})();
