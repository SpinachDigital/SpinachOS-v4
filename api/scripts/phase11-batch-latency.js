// Phase 11: batch qualify probe (5 seeded leads) + latency law (p95 < 500ms).
// Bounded: batch scores max 50 'new' leads; results filtered to the 5 seeds.
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
  const seeded = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${API}/leads`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Batch Lead ${i + 1}`, email: `bq-${stamp}-${i}@batchprobe.co`, company: `BatchCo ${i + 1}`, source: 'referral', notes: 'Referred by Rohit. Budget approved for ads automation retainer.' }) });
    const d = await r.json();
    if (r.status === 201) seeded.push(d.id);
  }
  console.log('seeded:', seeded.length);

  const t0 = Date.now();
  const r = await fetch(`${API}/leads/qualify-batch`, { method: 'POST', headers: H });
  const raw = await r.text();
  let d;
  try { d = JSON.parse(raw); } catch { d = { parse_error: raw.slice(0, 200) }; }
  console.log('qualify-batch:', r.status, 'scored:', d.scored, 'took:', Date.now() - t0, 'ms');
  const mine = (d.results || []).filter(x => seeded.includes(x.lead_id));
  console.log('seed leads scored:', mine.length);
  for (const x of mine) console.log('  lead', x.lead_id?.slice(0, 8), 'score', x.score, 'card', x.card_id?.slice(0, 8));

  // latency law: lead list + filtered list p95
  const reads = [];
  for (let i = 0; i < 10; i++) {
    let t = Date.now();
    let r1 = await fetch(`${API}/leads?status=new`, { headers: H });
    await r1.json(); reads.push(Date.now() - t);
    t = Date.now();
    const r2 = await fetch(`${API}/leads?status=qualified`, { headers: H });
    await r2.json(); reads.push(Date.now() - t);
  }
  reads.sort((a, b) => a - b);
  const p95 = reads[Math.ceil(reads.length * 0.95) - 1];
  console.log('reads:', reads.join(','), 'ms');
  console.log('p95:', p95, 'ms —', p95 < 500 ? 'PASS (<500ms)' : 'FAIL');
  fs.writeFileSync('C:/Users/Abhishek/AppData/Local/Temp/p11-batch-result.json', JSON.stringify({ seeded, mine, scored: d.scored, p95, reads }, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
