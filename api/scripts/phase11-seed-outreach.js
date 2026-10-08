// Phase 11: seed a PENDING outreach card for the screenshot (lead → qualify →
// approve → draft — the draft card stays pending for the capture).
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const API = 'http://localhost:4000/api/v1';
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const TOKEN = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '2h' });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

(async () => {
  const stamp = Date.now();
  let r = await fetch(`${API}/leads`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Outreach Shot', email: `oshot-${stamp}@shotlab.co`, company: 'ShotLab Outreach', source: 'referral', notes: 'Referred by Rohit. Needs ads automation retainer. Budget approved.' }) });
  const lead = await r.json();
  console.log('lead:', r.status, lead.id?.slice(0, 8));
  r = await fetch(`${API}/leads/${lead.id}/qualify`, { method: 'POST', headers: H });
  const q = await r.json();
  console.log('qualify:', r.status, 'score', q.score, 'card', q.card_id?.slice(0, 8));
  r = await fetch(`${API}/approvals/${q.card_id}/approve`, { method: 'POST', headers: H });
  console.log('approve qualify card:', r.status);
  r = await fetch(`${API}/leads/${lead.id}/draft-outreach`, { method: 'POST', headers: H });
  const d = await r.json();
  console.log('draft outreach:', r.status, 'style_score', d.style_score, 'card', d.card_id?.slice(0, 8));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
