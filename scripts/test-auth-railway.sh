#!/bin/bash

echo "🧪 Testing Twitter Authentication on Railway..."
echo ""

# Run the auth test on Railway
railway run "pnpm tsx -e \"
import { UnifiedBrowserPool } from './src/browser/UnifiedBrowserPool.js';

async function test() {
  console.log('Testing auth on Railway...');
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('test');
  
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  try {
    await page.waitForSelector('[data-testid=SideNav_NewTweet_Button]', { timeout: 10000 });
    console.log('✅ AUTHENTICATED on Railway');
  } catch {
    console.log('❌ NOT AUTHENTICATED on Railway');
    console.log('URL:', await page.url());
  }
  
  const cookies = await page.context().cookies();
  console.log('Cookies:', cookies.length);
  
  await pool.shutdown();
}

test().catch(console.error);
\""

