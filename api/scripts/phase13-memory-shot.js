// Phase 13 GOAL 3 — /memory screenshot: real search, real ranked results.
// Types a real query, waits, captures the results (honesty rule: real UI, real data).
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await page.goto('http://localhost:3000/memory', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // type a real query and search (Enter — the input has onKeyDown Enter)
  await page.type('input[aria-label="Search company memory"]', 'realty');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 5000));

  const txt = await page.evaluate(() => document.body.innerText);
  console.log('results visible:', /Intake|realty|result/i.test(txt));
  fs.mkdirSync('C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-13', { recursive: true });
  const out = 'C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-13/memory-search.png';
  await page.screenshot({ path: out });
  console.log('SAVED', out, fs.statSync(out).size, 'bytes');
  await browser.close();
})();
