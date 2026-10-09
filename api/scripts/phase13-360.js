// Phase 13 GOAL 1 — 360px captures: /today, /leads, /approvals, /grow.
// Real UI, real data, viewport 360x800 (mobile), full-height inner scroller.
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fs = require('fs');

(async () => {
  const step = process.argv[2];
  if (!step) { console.log('usage: node phase13-360.js today|leads|approvals|grow'); return; }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  // founder login: the UI mints its own token via /api/auth/session (BOOTSTRAP_ADMIN_TOKEN
  // on the API) — no localStorage injection needed.
  const routes = { today: '/today', leads: '/leads', approvals: '/approvals', grow: '/grow' };
  const url = 'http://localhost:3000' + routes[step];
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  // full inner scroller height (the app scrolls inside <main>)
  const sh = await page.evaluate(() => document.querySelector('main')?.scrollHeight || document.body.scrollHeight);
  await page.setViewport({ width: 360, height: Math.min(Math.max(sh, 800), 4000), isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 1200));

  const visible = await page.evaluate(() => document.body.innerText.length > 100);
  console.log(step, 'visible:', visible, 'content height:', sh);
  const out = `C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-13/360-${step}.png`;
  fs.mkdirSync('C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-13', { recursive: true });
  await page.screenshot({ path: out });
  console.log('SAVED', out, fs.statSync(out).size, 'bytes');
  await browser.close();
})();
