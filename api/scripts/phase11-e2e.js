// PHASE 11 E2E probe — WIN loop end-to-end with real IDs at every step.
// add lead → list → patch notes → invalid transition (422) → import CSV →
// qualify (score + card) → approve card (→ qualified) → invalid onboard (400) →
// draft outreach (style score + card) → DIRECT send w/o approval (403 NEGATIVE) →
// approve card → approve-and-send (no sender → pending_send HONEST) →
// mark responded → onboard (client + pipeline + invite, real IDs).
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const API = 'http://localhost:4000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const TOKEN = jwt.sign({ sub: 'director', role: 'founder' }, JWT_SECRET, { expiresIn: '2h' });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

const out = [];
function log(step, status, extra) {
  const line = `${step}: ${status}${extra ? ' — ' + JSON.stringify(extra).slice(0, 260) : ''}`;
  out.push(line); console.log(line);
}

async function req(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let d = null;
  try { d = await r.json(); } catch { /* text */ }
  return { status: r.status, d };
}

(async () => {
  // ---- GOAL 1: CRUD + import ----
  const stamp = Date.now();
  let r = await req('POST', '/leads', { name: 'Probe Lead', email: `probe-${stamp}@probelab.co`, company: 'ProbeLab Industries', source: 'referral' });
  log('1 create lead', r.status, { id: r.d?.id, status: r.d?.status });
  const leadId = r.d?.id;
  if (!leadId) process.exit(1);

  r = await req('POST', '/leads', { name: 'Dupe Probe', email: `probe-${stamp}@probelab.co` });
  log('2 duplicate email rejected', r.status, r.d?.error ? '409 dupe' : 'FAIL');

  r = await req('GET', '/leads?status=new');
  log('3 list new leads', r.status, { count: Array.isArray(r.d) ? r.d.length : '?' });

  r = await req('PATCH', `/leads/${leadId}`, { notes: 'Need social media + ads retainer for gym chain. Budget approved. Referred by Rohit.' });
  log('4 patch notes', r.status, { notes_len: (r.d?.notes || '').length });

  r = await req('PATCH', `/leads/${leadId}`, { status: 'onboarded' });
  log('5 INVALID transition new→onboarded', r.status, r.status === 422 ? '422 rejected (no skipping) ✅' : r.d?.error);

  // import (2 rows, 1 dupe of the lead just created → dedupe proof)
  const csv = `Import One,imp1-${stamp}@importco.in,Import Co\nImport Two,imp2-${stamp}@importco.in,Import Co\nProbe Lead,probe-${stamp}@probelab.co,ProbeLab Industries`;
  r = await req('POST', '/leads/import', { csv });
  log('6 import (3 rows, 1 dupe)', r.status, r.d);

  // ---- GOAL 2: qualify ----
  r = await req('POST', `/leads/${leadId}/qualify`);
  log('7 qualify', r.status, { score: r.d?.score, card_id: r.d?.card_id, rationale: (r.d?.rationale || '').slice(0, 80) });
  const qualCardId = r.d?.card_id;
  if (!qualCardId) process.exit(1);

  r = await req('POST', `/leads/${leadId}/qualify`);
  log('8 re-qualify non-new rejected', r.status, r.status === 400 ? '400 (only new) ✅' : r.d?.error);

  r = await req('POST', `/approvals/${qualCardId}/approve`);
  log('9 approve qualify card', r.status, { type: r.d?.type, status: r.d?.status });
  r = await req('GET', `/leads?status=qualified`);
  const lead = (r.d || []).find(x => x.id === leadId);
  log('10 lead now qualified', lead ? 200 : 404, { status: lead?.status, score: lead?.score });

  // ---- GOAL 3: outreach draft → approve → send ----
  r = await req('POST', `/leads/${leadId}/onboard`, { playbook_pack_slug: 'client-onboarding' });
  log('11 onboard from qualified rejected', r.status, r.status === 400 ? '400 (only responded) ✅' : r.d?.error);

  r = await req('POST', `/leads/${leadId}/draft-outreach`);
  log('12 draft outreach', r.status, { draft_id: r.d?.draft_id, style_score: r.d?.style_score, card_id: r.d?.card_id, subject: r.d?.subject });
  const draftId = r.d?.draft_id;
  const outCardId = r.d?.card_id;
  if (!draftId) process.exit(1);

  // NEGATIVE: direct send without card approval
  r = await req('POST', `/outreach/${draftId}/approve-and-send`);
  log('13 DIRECT SEND no approval', r.status, r.status === 403 ? '403 BLOCKED (golden rule) ✅' : `FAIL ${r.d?.error}`);

  r = await req('POST', `/approvals/${outCardId}/approve`);
  log('14 approve outreach card', r.status, { status: r.d?.status });

  r = await req('POST', `/outreach/${draftId}/approve-and-send`);
  log('15 approve-and-send', r.status, r.d);

  // lead should now be 'outreached' (send path updates? check live)
  r = await req('GET', `/leads?status=outreached`);
  const oLead = (r.d || []).find(x => x.id === leadId);
  log('16 lead outreached?', oLead ? 200 : 404, { status: oLead?.status });

  // ---- GOAL 4: onboard ----
  r = await req('PATCH', `/leads/${leadId}`, { status: 'responded' });
  log('17 patch outreached→responded', r.status, { status: r.d?.status });

  r = await req('POST', `/leads/${leadId}/onboard`, { playbook_pack_slug: 'client-onboarding' });
  log('18 onboard', r.status, r.d);

  // security: client token → 401/403 on WIN routes
  const CTOKEN = jwt.sign({ sub: 'client-x', role: 'client' }, JWT_SECRET, { expiresIn: '1h' });
  const cr = await fetch(`${API}/leads`, { headers: { Authorization: `Bearer ${CTOKEN}` } });
  log('19 client session on /leads', cr.status, cr.status === 403 ? '403 rejected ✅' : `FAIL ${cr.status}`);

  console.log('\n=== PROBE COMPLETE ===');
  fs.writeFileSync('C:/Users/Abhishek/AppData/Local/Temp/p11-e2e-result.json', JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
