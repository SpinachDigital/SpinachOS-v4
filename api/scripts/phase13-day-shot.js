// Phase 13 GOAL 4 — founder-day dashboard state screenshot: /today after a
// full simulated day (27/27 green). Full inner-scroller height, desktop.
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await page.goto('http://localhost:3000/today', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  const sh = await page.evaluate(() => document.querySelector('main')?.scrollHeight || document.body.scrollHeight);
  await page.setViewport({ width: 1440, height: Math.min(Math.max(sh, 900), 4000), deviceScaleFactor: 1.5 });
  await new Promise(r => setTimeout(r, 1200));
  const txt = await page.evaluate(() => document.body.innerText);
  console.log('today visible:', /Approvals pending|Top inbox|Active pipelines/.test(txt), 'h:', sh);
  const out = 'C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-13/founder-day-today.png';
  fs.mkdirSync('C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-13', { recursive: true });
  await page.screenshot({ path: out });
  console.log('SAVED', out, fs.statSync(out).size, 'bytes');
  await browser.close();
})();
