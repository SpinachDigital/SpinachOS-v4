// Phase 13 GOAL 2 — dead-weight audit verification probe:
// 1. every sidebar page 200s (no broken nav)
// 2. dead routes redirect (307) to their new homes
// 3. deleted API route 404s (comms), deleted pages 404 (direct GET no redirect? they ARE redirected)
// 4. client auth still enforced after the audit (assets/overview/email-status 401 on client JWT)
// 5. knowledge/query: founder OK, client 401 (GOAL 3 security)
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const T = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const CT = jwt.sign({ sub: 'client-x', role: 'client' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = { Authorization: 'Bearer ' + T };
const API = 'http://localhost:4000/api/v1';
const UI = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); };

(async () => {
  // 1. sidebar pages 200
  const pages = ['/chat','/today','/','/projects','/pipeline','/agents','/team','/clients','/assets','/memory','/playbooks','/ledger','/evolutions','/pnl','/leads','/marketing','/grow','/analytics','/approvals','/settings'];
  for (const p of pages) {
    const r = await fetch(UI + p, { redirect: 'manual' });
    ok('page ' + p + ' → ' + r.status, r.status === 200);
  }
  // 2. redirects for dead routes
  for (const [src, dest] of [['/comms','/chat'],['/calendar','/marketing'],['/office','/'],['/logs','/analytics'],['/finance','/analytics'],['/knowledge','/settings'],['/terminal','/'],['/kanban','/projects']]) {
    const r = await fetch(UI + src, { redirect: 'manual' });
    const loc = r.headers.get('location') || r.headers.get('x-nextjs-redirect') || '';
    ok('redirect ' + src + ' → ' + loc + ' (' + r.status + ')', (r.status === 307 || r.status === 308) && loc.includes(dest));
  }
  // 3. deleted API route 404s
  const c = await fetch(API + '/comms/channels', { headers: H });
  ok('deleted /api/v1/comms/channels → ' + c.status, c.status === 404);
  // 4. client auth stands after the audit
  const CH = { Authorization: 'Bearer ' + CT };
  for (const ep of ['/assets', '/overview', '/providers/email/status']) {
    const r = await fetch(API + ep, { headers: CH });
    ok('client JWT ' + ep + ' → ' + r.status, r.status === 401 || r.status === 403);
  }
  // 5. knowledge/query security
  const kq = await fetch(API + '/knowledge/query?q=test', { headers: H });
  ok('founder knowledge/query → ' + kq.status, kq.status === 200);
  const kc = await fetch(API + '/knowledge/query?q=test', { headers: CH });
  ok('client knowledge/query → ' + kc.status, kc.status === 401 || kc.status === 403);
  console.log('\\n' + pass + ' pass, ' + fail + ' fail');
})();
