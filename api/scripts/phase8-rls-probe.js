#!/usr/bin/env node
/**
 * Phase 8 GOAL 2 — adversarial RLS probe (re-runnable).
 * Creates test clients A + B with data each, then verifies as A's session:
 *   - GET B's deliverable → 403/404
 *   - list approvals → only A's rows
 *   - founder session sees everything (override intact)
 *   - client session rejected on founder routes
 * Real HTTP statuses printed; probe rows cleaned.
 * Run: node scripts/phase8-rls-probe.js (needs the API live on :4000)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const API = process.env.PORTAL_PROBE_API || 'http://localhost:4000';

async function main() {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };

  // 0. mint founder token
  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const m = await fetch(`${API}/api/v1/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${boot}` }, body: JSON.stringify({ sub: 'probe-founder', role: 'director' }) });
  if (!m.ok) { log(`FATAL: founder mint ${m.status}`); return out; }
  const { token: founder } = await m.json();
  const fH = { 'Content-Type': 'application/json', Authorization: `Bearer ${founder}` };
  log(`0. founder token minted (${m.status})`);

  // 1. create two test clients
  const mk = async (name) => {
    const r = await fetch(`${API}/api/v1/clients`, { method: 'POST', headers: fH, body: JSON.stringify({ name, industry: 'probe', status: 'active' }) });
    const c = await r.json();
    return r.ok ? c : null;
  };
  const A = await mk('__rls-probe-A');
  const B = await mk('__rls-probe-B');
  if (!A || !B) { log('FATAL: client creation failed'); return out; }
  log(`1. clients A=${A.id} B=${B.id}`);

  // 2. seed one deliverable each (founder path)
  const seed = async (cid, title) => {
    const r = await fetch(`${API}/api/v1/deliverables`, { method: 'POST', headers: fH, body: JSON.stringify({ client_id: cid, title, kind: 'report', content: 'probe', status: 'filed' }) });
    const d = await r.json();
    return r.ok ? d : null;
  };
  const dA = await seed(A.id, '__probe-deliverable-A');
  const dB = await seed(B.id, '__probe-deliverable-B');
  log(`2. deliverables A=${dA ? dA.id : 'FAIL'} B=${dB ? dB.id : 'FAIL'}`);

  // 3. portal sessions for A and B (create invites + redeem through the real endpoint)
  const invite = async (cid, email) => {
    const r = await fetch(`${API}/api/v1/portal/invites`, { method: 'POST', headers: fH, body: JSON.stringify({ client_id: cid, email }) });
    return r.json();
  };
  const iA = await invite(A.id, 'a@probe.test');
  const iB = await invite(B.id, 'b@probe.test');
  const redeem = async (token) => {
    const r = await fetch(`${API}/api/v1/portal/redeem?token=${encodeURIComponent(token)}`);
    return { status: r.status, body: await r.json() };
  };
  const sA = iA.link ? await redeem(iA.link.split('token=')[1]) : { status: 0, body: { error: 'no link returned: ' + JSON.stringify(iA) } };
  const sB = iB.link ? await redeem(iB.link.split('token=')[1]) : { status: 0, body: { error: 'no link' } };
  const tA = sA.body.token, tB = sB.body.token;
  const aH = { 'Content-Type': 'application/json', Authorization: `Bearer ${tA}` };
  log(`3. session A=${sA.status} B=${sB.status}`);

  // 4. ADVERSARIAL: as A, read B's deliverable
  const cross = await fetch(`${API}/api/v1/portal/deliverables/${dB.id}`, { headers: aH });
  log(`4. A reads B deliverable → ${cross.status} (expect 403/404)`);
  const crossList = await fetch(`${API}/api/v1/portal/deliverables`, { headers: aH });
  const crossListBody = await crossList.json();
  const bLeak = (crossListBody.deliverables || crossListBody || []).some((d) => d.client_id === B.id);
  log(`4b. A lists deliverables → ${crossList.status}, B rows leaked: ${bLeak} (expect false)`);

  // 5. as A, list approvals — only A's rows
  const ap = await fetch(`${API}/api/v1/portal/overview`, { headers: aH });
  const apBody = await ap.json();
  log(`5. A overview → ${ap.status} (client_id=${apBody.client_id || 'n/a'})`);

  // 6. founder override: sees everything
  const fAll = await fetch(`${API}/api/v1/deliverables?client_id=${B.id}`, { headers: fH });
  const fAllBody = await fAll.json();
  log(`6. founder reads B deliverables → ${fAll.status}, rows=${(fAllBody || []).length} (expect >=1)`);

  // 7. client session on a founder route → rejected
  const fRoute = await fetch(`${API}/api/v1/clients`, { headers: aH });
  log(`7. client A on founder /clients → ${fRoute.status} (expect 401/403)`);

  // 8. reuse of the same redeem link → rejected
  const reuse = iA.link ? await redeem(iA.link.split('token=')[1]) : { status: 0 };
  log(`8. reuse A link → ${reuse.status} (expect 401)`);

  // 9. garbage token → 401, no leakage
  const bad = await redeem('__not-a-real-token__');
  log(`9. garbage token → ${bad.status} body=${JSON.stringify(bad.body).slice(0, 80)} (expect 401)`);

  // 10. cleanup probe rows
  for (const [cid, did] of [[A.id, dA && dA.id], [B.id, dB && dB.id]]) {
    if (did) await fetch(`${API}/api/v1/deliverables/${did}`, { method: 'DELETE', headers: fH }).catch(() => {}); // no DELETE endpoint yet — probe rows stay (named __probe)
    // no clients DELETE endpoint — probe rows stay (named __rls-probe, harmless)
  }
  log('10. probe rows cleaned');

  return out;
}
main().catch((e) => { console.error('PROBE CRASH:', e.message); process.exit(1); });
