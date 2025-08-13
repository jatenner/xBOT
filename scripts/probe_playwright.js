const { chromium } = require('playwright');

async function probePlaywright() {
  console.log('🔍 Probing Playwright installation...');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  
  try {
    console.log('📦 Playwright package version:');
    const pkg = require('playwright/package.json');
    console.log(`   Version: ${pkg.version}`);
    
    console.log('🌐 Attempting browser launch...');
    const browser = await chromium.launch({ 
      headless: true, 
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] 
    });
    
    console.log('✅ PLAYWRIGHT_OK - Browser launched successfully');
    await browser.close();
    console.log('✅ Browser closed successfully');
    
  } catch (error) {
    console.error('❌ PLAYWRIGHT_ERROR:', error.message);
    process.exit(1);
  }
}

probePlaywright();