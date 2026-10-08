// Phase 12 probe: GOAL 1 (email status + both send paths), GOAL 3 (reuse → GROW draft),
// GOAL 4 (overview shape + latency + client 401). Real IDs everywhere.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const API = 'http://localhost:4000/api/v1';
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const TOKEN = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '2h' });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SH = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function req(method, path, body, headers = H) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
}

(async () => {
  console.log('=== GOAL 1: email sender ===');
  let r = await req('GET', '/providers/email/status');
  console.log('email status:', r.status, JSON.stringify(r.d));

  // both send paths need a lead through the pipeline. Build one:
  const stamp = Date.now();
  r = await req('POST', '/leads', { name: 'P12 Send Probe', email: `p12send-${stamp}@probelab.co`, company: 'P12 SendCo', source: 'inbound', notes: 'Referred by Rohit. Budget approved for ads automation retainer.' });
  const lead = r.d;
  console.log('lead:', r.status, lead.id?.slice(0, 8));
  r = await req('POST', `/leads/${lead.id}/qualify`); console.log('qualify:', r.status, 'score', r.d?.score);
  r = await req('POST', `/approvals/${r.d.card_id}/approve`); console.log('approve qualify:', r.status);
  r = await req('POST', `/leads/${lead.id}/draft-outreach`);
  const draft = r.d;
  console.log('draft:', r.status, 'style', draft?.style_score, 'draft_id', draft?.draft_id?.slice(0, 8), 'card', draft?.card_id?.slice(0, 8));
  // NEGATIVE first: direct send without card approval
  r = await req('POST', `/outreach/${draft.draft_id}/approve-and-send`);
  console.log('direct send (no approval):', r.status, r.status === 403 ? '403 BLOCKED ✅' : JSON.stringify(r.d).slice(0, 80));
  r = await req('POST', `/approvals/${draft.card_id}/approve`);
  console.log('approve outreach card:', r.status);
  r = await req('POST', `/outreach/${draft.draft_id}/approve-and-send`);
  console.log('send path A (status now):', r.status, JSON.stringify(r.d).slice(0, 160));

  console.log('\n=== GOAL 2: filing → library stamp (via gates) ===');
  // file a deliverable at a gate on the TechFlow workflow (real gate action)
  const wf = await (await fetch(`${URL}/rest/v1/workflows?select=id,client_id&status=eq.active&limit=3`, { headers: SH })).json();
  const target = wf[0];
  console.log('workflow:', target.id.slice(0, 8), 'client:', target.client_id?.slice(0, 8));
  r = await req('POST', '/gates', {
    workflow_id: target.id, client_id: target.client_id, gate_name: `p12-probe-${stamp}`,
    action: 'file_deliverable', risk_tier: 'read',
    payload: { title: `P12 Probe Asset ${stamp}`, kind: 'report', content: 'Phase 12 filing probe — auto library stamp', after_step: 'kickoff' },
  });
  console.log('gate create:', r.status, (r.d?.id || r.d?.gate?.id || '').toString().slice(0, 8), JSON.stringify(r.d).slice(0, 120));
  const gateId = r.d?.id || r.d?.gate?.id;
  if (gateId) {
    r = await req('POST', `/gates/${gateId}/approve`);
    console.log('gate approve:', r.status, JSON.stringify(r.d).slice(0, 200));
  }

  console.log('\n=== GOAL 3: reuse → GROW draft ===');
  const assets = await (await fetch(`${URL}/rest/v1/deliverables?select=id,title,client_id&order=created_at.desc&limit=5`, { headers: SH })).json();
  const asset = assets.find(a => a.title && a.title.includes('P12 Probe')) || assets[0];
  console.log('asset:', asset.id.slice(0, 8), JSON.stringify(asset.title).slice(0, 50));
  r = await req('POST', `/assets/${asset.id}/reuse`, { target: 'grow_draft', note: 'p12 probe reuse' });
  console.log('reuse → grow_draft:', r.status, 'draft_id', r.d?.draft_id?.slice(0, 8));
  if (r.d?.draft_id) {
    const item = await (await fetch(`${URL}/rest/v1/content_items?select=id,title,body_text,status,client_id,metadata&id=eq.${r.d.draft_id}`, { headers: SH })).json();
    console.log('GROW draft row:', JSON.stringify(item[0]).slice(0, 240));
  }

  console.log('\n=== GOAL 4: overview ===');
  const t0 = Date.now();
  r = await req('GET', '/overview');
  console.log('overview:', r.status, 'took', Date.now() - t0, 'ms');
  console.log('  today:', JSON.stringify(r.d?.today));
  console.log('  pipelines:', (r.d?.pipelines || []).length, JSON.stringify((r.d?.pipelines || [])[0] || {}).slice(0, 120));
  console.log('  inbox_top:', (r.d?.inbox_top || []).length);
  console.log('  win_week:', JSON.stringify(r.d?.win_week), 'grow_week:', JSON.stringify(r.d?.grow_week));

  // client 401 probe
  const CTOKEN = jwt.sign({ sub: 'client-x', role: 'client' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cr = await fetch(`${API}/overview`, { headers: { Authorization: `Bearer ${CTOKEN}` } });
  console.log('client on /overview:', cr.status, cr.status === 403 ? '403 ✅' : 'FAIL');
  const cr2 = await fetch(`${API}/providers/email/status`, { headers: { Authorization: `Bearer ${CTOKEN}` } });
  console.log('client on email status:', cr2.status, cr2.status === 403 ? '403 ✅' : 'FAIL');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
