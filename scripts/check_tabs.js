const browserManager = require('../src/browser/browser-manager');

(async () => {
  try {
    const browser = await browserManager.connect();
    const pages = await browser.pages();
    console.log('Connected! Open tabs count:', pages.length);
    for (let i = 0; i < pages.length; i++) {
      const title = await pages[i].title();
      const url = pages[i].url();
      console.log(`[${i}] ${title} -> ${url}`);
    }
  } catch (err) {
    console.error('Error connecting to browser:', err.message);
  }
})();
