// SPRINT 10 §7.2 — real 360px captures (Playwright fixed viewport).
// Two sprints ran at honest-500px (Chrome headless min-width floor + HMR
// emulation flaps). Playwright's fixed viewport solves both: no HMR race,
// true 360px width.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const SHOTS = [
  { url: '/pipeline', out: 'pipeline-index-360.png' },
  { url: '/clients/3a1f71c4-e3da-49bf-8ab8-04f8256dcc4a', out: 'client-twin-360.png' },
  { url: '/chat', out: 'chat-single-bar-360.png' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${s.url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(6000);
      // horizontal overflow check (honest 360 audit)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 370);
      await page.screenshot({ path: `../../docs/evidence/sprint-10/${s.out}`, fullPage: true });
      console.log(`${s.out}: written | horizontal-overflow: ${overflow}`);
    } catch (e) {
      console.log(`${s.out}: FAILED — ${e.message.slice(0, 100)}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
