// Phase 12 screenshots — REAL captures via CDP headless Chrome.
// Steps: today (overview), asset (library row with library stamp + reuse),
// growdraft (GROW draft from reuse), outreach (honest pending_send state).
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const OUT_DIR = 'C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-12';

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9223', defaultViewport: { width: 1440, height: 900 } });
  const step = process.argv[2];
  const page = await browser.newPage();

  // founder session (same mint path as Phase 10/11 captures)
  await page.goto('http://localhost:3000/api/auth/session', { waitUntil: 'networkidle2', timeout: 30000 });
  const sessText = await page.evaluate(() => document.body.innerText);
  let founderToken = null;
  try { founderToken = JSON.parse(sessText).token; } catch { }
  if (!founderToken) { console.log('ERROR: no founder token'); process.exit(4); }
  await page.evaluate((t) => {
    localStorage.setItem('spinach_token_cache', JSON.stringify({ token: t, expires_at: Date.now() + 3600_000 }));
  }, founderToken);

  if (step === 'today') {
    await page.goto('http://localhost:3000/today', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('overview visible:', /Approvals pending/i.test(txt) && /WIN this week/i.test(txt));
    // The app shell scrolls INSIDE <main> (body stays 900px) — fullPage misses
    // the lower sections. Grow the viewport to the main's scroll height, then
    // the whole overview fits one capture.
    const mainH = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return Math.max(main.scrollHeight, 900);
    });
    await page.setViewport({ width: 1440, height: mainH + 100 });
    await new Promise(r => setTimeout(r, 800));
    const file = `${OUT_DIR}/today-overview.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes', 'viewport:', mainH + 100);
  }

  if (step === 'asset') {
    // assets library — the auto-stamped filed deliverable (P12 Probe / LoopCo)
    await page.goto('http://localhost:3000/assets', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    // scroll to the newest filed asset
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter(e => /LoopCo Brand Sprint|P12 Probe/i.test(e.textContent || '') && e.children.length === 0);
      if (els.length) els[0].scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 1500));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('asset visible:', /LoopCo Brand Sprint|P12 Probe/i.test(txt));
    const file = `${OUT_DIR}/filed-deliverable-asset.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  if (step === 'growdraft') {
    // GROW calendar — the draft created from the asset reuse
    await page.goto('http://localhost:3000/grow', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('grow draft visible:', /LoopCo Brand Sprint/i.test(txt));
    const file = `${OUT_DIR}/reuse-grow-draft.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  if (step === 'outreach') {
    // leads pipeline — the outreached lead (send queued honestly)
    await page.goto('http://localhost:3000/leads', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('outreached visible:', /Outreached/i.test(txt));
    const file = `${OUT_DIR}/outreach-pending-send.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  await browser.disconnect();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
