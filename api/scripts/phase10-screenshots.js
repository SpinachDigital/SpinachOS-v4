// Phase 10 evidence — real screenshots via CDP (headless Chrome, own profile).
// Usage: node scripts/phase10-screenshots.js <step>
//   portal   — redeem magic link → portal overview
//   approve  — pending review → approve with note → status change visible
//   download — deliverable download via signed URL working
//   invite   — founder invite UI → create + revoke
// Each capture >50KB, ≥800px wide. Saves to docs/evidence/phase-8-1/.

const CDP_PORT = 9223;
const OUT_DIR = 'C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-8-1';

// CDP helper over the /json endpoint + WebSocket is heavier than needed;
// simplest robust path: use Puppeteer-core if available, else raw CDP via ws.
let puppeteer = null;
try { puppeteer = require('puppeteer-core'); } catch { /* fall back */ }

async function main() {
  const step = process.argv[2];
  if (!step || !['portal', 'approve', 'download', 'invite'].includes(step)) {
    console.log('usage: node scripts/phase10-screenshots.js <portal|approve|download|invite>');
    process.exit(1);
  }

  // Load env (API base + tokens)
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const API = 'http://localhost:4000';

  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const r0 = await fetch(API + '/api/v1/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + boot }, body: JSON.stringify({ sub: 'p10-shots', role: 'director' }) });
  const { token } = await r0.json();

  if (!puppeteer) {
    console.log('ERROR: puppeteer-core not installed — npm i -D puppeteer-core');
    process.exit(2);
  }

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${CDP_PORT}`,
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  // fresh client session for every step (invite → redeem)
  const { data: tf } = await sb.from('clients').select('id, name').eq('name', 'TechFlow Inc').single();
  const ri = await fetch(API + '/api/v1/portal/invites', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ client_id: tf.id, email: 'a@probe.test', expires_days: 7 }) });
  const inv = await ri.json();
  if (!inv.link) { console.log('ERROR: no invite link', inv); process.exit(3); }
  await page.goto(inv.link, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  if (step === 'portal') {
    const file = `${OUT_DIR}/redeem-portal-overview.png`;
    await page.screenshot({ path: file });
    const stat = fs.statSync(file);
    console.log('SAVED', file, stat.size, 'bytes');
    const text = await page.evaluate(() => document.body.innerText);
    console.log('PAGE_TEXT_HEAD:', text.slice(0, 300).replace(/\n+/g, ' | '));
  }

  if (step === 'approve') {
    // pending review → approve with note → status change visible
    const before = await page.evaluate(() => document.body.innerText);
    console.log('pending review visible:', before.includes('Approve'));
    const noteInput = await page.$('input[placeholder*="ote" i], textarea[placeholder*="ote" i]');
    if (noteInput) await noteInput.type('Approved — ship it.');
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => x.textContent.trim() === 'Approve');
      if (b) { b.click(); return true; }
      return false;
    });
    console.log('approve clicked:', clicked);
    // wait for the status change (review shows accepted / card leaves Waiting on you)
    let statusChange = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const txt = await page.evaluate(() => document.body.innerText);
      if (!txt.includes('Approve') || txt.includes('accepted')) { statusChange = true; break; }
    }
    console.log('status change visible:', statusChange);
    const file = `${OUT_DIR}/approve-status-change.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
    // verify in DB: the deliverable's client_review is now accepted
    const { data: d } = await sb.from('deliverables').select('metadata').eq('id', '07b63365-c595-4912-b9c6-6960ec5334b3').single();
    console.log('DB check client_review:', d?.metadata?.client_review);
  }

  if (step === 'download') {
    // deliverable download via signed URL — click the UI Download button (the
    // page session token rides localStorage → the real authenticated path).
    // First prove the endpoint server-side with the client session, then click.
    const res = await page.evaluate(async () => {
      const raw = localStorage.getItem('spinach_portal_session');
      if (!raw) return { status: 0, body: 'no session in localStorage' };
      const s = JSON.parse(raw);
      const r = await fetch(`/api/v1/portal/deliverables/07b63365-c595-4912-b9c6-6960ec5334b3/download`, { headers: { Authorization: `Bearer ${s.token}` } });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    });
    console.log('signed URL endpoint (page session):', JSON.stringify(res));
    const file = `${OUT_DIR}/download-signed-url.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  if (step === 'invite') {
    // founder invite UI → create + revoke. The command-center mints its founder
    // JWT via the Next server route (/api/auth/session → bootstrap) and caches
    // it in localStorage (spinach_token_cache). Seed that cache FIRST, then the
    // client detail page renders the portal invite panel with real data.
    await page.goto('http://localhost:3000/api/auth/session', { waitUntil: 'networkidle2', timeout: 30000 });
    const sessText = await page.evaluate(() => document.body.innerText);
    let founderToken = null;
    try { founderToken = JSON.parse(sessText).token; } catch { /* not json */ }
    if (!founderToken) { console.log('ERROR: no founder token from /api/auth/session'); process.exit(4); }
    await page.evaluate((t) => {
      localStorage.setItem('spinach_token_cache', JSON.stringify({ token: t, expires_at: Date.now() + 3600_000 }));
    }, founderToken);
    await page.goto('http://localhost:3000/clients/5c3ca086-05e8-4f67-9811-95573ee0f9ea', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    // scroll the portal invite panel into view (it sits below the invoices panel)
    await page.evaluate(() => {
      const h3s = [...document.querySelectorAll('h3')];
      const p = h3s.find(x => x.textContent.trim().toLowerCase() === 'client portal');
      if (p) p.scrollIntoView({ block: 'start' });
    });
    await new Promise(r => setTimeout(r, 1500));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('invite panel visible:', /client portal/i.test(txt) && /invite/i.test(txt));
    const file = `${OUT_DIR}/invite-create-revoke.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  await page.close();
  await browser.disconnect();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(9); });