const { chromium } = require('playwright');
(async () => {
  try {
    const b = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
    const p = await b.newPage();
    await p.goto('https://example.com', { timeout: 20000 });
    console.log('PLAYWRIGHT_OK');
    await b.close();
  } catch (e) {
    console.error('PLAYWRIGHT_FAIL', e.message);
    process.exit(1);
  }
})();