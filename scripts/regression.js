// Phase 3 — endpoint regression baseline: hit every route, record status codes.
// Run BEFORE and AFTER the split; compare.
const fs = require('fs');
const TOKEN = fs.readFileSync('C:/Users/Abhishek/AppData/Local/hermes/cache/scratch/p4-token.txt', 'utf8').trim();
const H = { Authorization: 'Bearer ' + TOKEN };

// (method, path, body) — the ~96-endpoint inventory, condensed to the live-testable set
const CASES = [
  ['GET',  '/health'],
  ['GET',  '/api/v1/profiles'],
  ['GET',  '/api/v1/clients'],
  ['GET',  '/api/v1/clients/761acb76-2e8e-4eb6-9bd6-ac3188651ba6'],
  ['GET',  '/api/v1/packages'],
  ['GET',  '/api/v1/invoices'],
  ['GET',  '/api/v1/approvals'],
  ['GET',  '/api/v1/approvals/pending'],
  ['GET',  '/api/v1/workflows'],
  ['GET',  '/api/v1/knowledge/query?q=brand+identity'],
  ['GET',  '/api/v1/knowledge/context/761acb76-2e8e-4eb6-9bd6-ac3188651ba6'],
  ['GET',  '/api/v1/cron/jobs'],
  ['GET',  '/api/v1/kanban/boards'],
  ['GET',  '/api/v1/kanban/cards'],
  ['GET',  '/api/v1/models/breakers'],
  ['GET',  '/api/v1/models/fallback-log'],
  ['GET',  '/api/system/health'],
  ['GET',  '/api/overview/stats'],
  ['GET',  '/api/activity?limit=5'],
  ['GET',  '/api/jobs?limit=3'],
  ['GET',  '/api/projects'],
  ['GET',  '/api/assets'],
  ['GET',  '/api/outputs'],
  ['GET',  '/api/schedule/today'],
  ['GET',  '/api/agents'],
  ['GET',  '/api/v1/comms/channels'],
  ['POST', '/api/v1/telegram/webhook', { update_id: 900001 }],           // 403 expected (secret enforced)
  ['POST', '/api/v1/auth/token', { sub: 'attacker' }],                    // 401 expected (P0)
];

(async () => {
  const results = {};
  for (const [method, path, body] of CASES) {
    try {
      const r = await fetch('http://localhost:4000' + path, {
        method,
        headers: method === 'POST' && !path.includes('auth/token') && !path.includes('telegram')
          ? { ...H, 'Content-Type': 'application/json' }
          : { ...(path.startsWith('/api/v1') ? H : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      results[method + ' ' + path] = r.status;
    } catch (e) {
      results[method + ' ' + path] = 'ERR: ' + String(e?.message || '').slice(0, 30);
    }
  }
  fs.writeFileSync('C:/Users/Abhishek/AppData/Local/hermes/cache/scratch/regression-' + (process.argv[2] || 'before') + '.json', JSON.stringify(results, null, 1));
  for (const [k, v] of Object.entries(results)) console.log(String(v).padEnd(4), k);
  console.log('=== ' + Object.keys(results).length + ' endpoints recorded ===');
})();
