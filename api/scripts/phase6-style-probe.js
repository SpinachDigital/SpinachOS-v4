// Phase 6 GOAL 1 — style-contract live probe: 3 agents, 3 tiers, before/after + latency.
// Runs under tsx so it can import the real style-contract module directly.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const OMNI = (env.match(/OMNIROUTE_URL=(\S+)/) || [null, 'http://localhost:20128'])[1].trim();
const BOOT = env.match(/BOOTSTRAP_ADMIN_TOKEN=(\S+)/)[1].trim();

const bridgeSrc = fs.readFileSync(path.join(__dirname, '../src/bridge.ts'), 'utf8');
const SOUL_RE = /([a-z_]+): '((?:[^'\\]|\\.)*)'/g;
const SOULS = {};
let m;
while ((m = SOUL_RE.exec(bridgeSrc)) !== null) SOULS[m[1]] = m[2].replace(/\\n/g, '\n');
function soulFor(agent) { return SOULS[agent] || 'You are the ' + agent + ' agent of Spinach Labs.'; }

async function call(model, system, user) {
  const t0 = Date.now();
  const r = await fetch(OMNI + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1600, temperature: 0.7 }),
  });
  const data = await r.json();
  return { out: (data && data.choices && data.choices[0] && data.choices[0].message.content) || '(no output)', ms: Date.now() - t0 };
}

(async () => {
  const { styleBlockFor } = await import('../src/agents/style-contract');
  const agents = [
    { a: 'engineer', task: 'Summarize the current state of the API for the ops log.' },
    { a: 'ceo', task: 'Summarize this month for the founder: 6 sprints shipped, 1 phase hardened, 0 clients live.' },
    { a: 'social', task: 'Write a 2-line Instagram post about Spinach OS finishing its product sprints.' },
  ];
  console.log('=== BEFORE (soul only) vs AFTER (soul + style block) ===\n');
  for (const { a, task } of agents) {
    const soul = soulFor(a);
    console.log('--- ' + a + ' | task: ' + task);
    const before = await call('auto/best-fast', soul, task);
    console.log('BEFORE (' + before.ms + 'ms):\n' + before.out.slice(0, 350) + '\n');
    const after = await call('auto/best-fast', soul + styleBlockFor(a), task);
    console.log('AFTER (' + after.ms + 'ms):\n' + after.out.slice(0, 350) + '\n');
  }

  // p50/p95 via the live API task path
  const login = await fetch('http://localhost:4000/api/v1/auth/token', {
    method: 'POST', headers: { Authorization: 'Bearer ' + BOOT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sub: 'founder', role: 'director' }),
  });
  const token = (await login.json()).token;
  const lat = [];
  for (let i = 0; i < 6; i++) {
    const t0 = Date.now();
    const r = await fetch('http://localhost:4000/api/v1/agents/execute', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'research', task: 'noop probe ' + i, source: 'phase6-style-probe' }),
    });
    await r.json();
    lat.push(Date.now() - t0);
  }
  lat.sort((x, y) => x - y);
  console.log('=== API task-path round-trips (6 samples): ' + lat.join(', ') + ' ms');
  console.log('p50: ' + lat[2] + 'ms  p95: ' + lat[5] + 'ms (injection = prompt chars only)');
})();
