#!/usr/bin/env tsx
import { chromium } from 'playwright';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  const profilePath = join(homedir(), 'Library/Application Support/Google/Chrome/Default');
  console.log('Profile path:', profilePath);
  console.log('Launching persistent context...\n');

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    channel: 'chrome',
    args: ['--no-first-run'],
  });

  try {
    // Check cookies BEFORE navigation (from persistent context)
    console.log('Checking cookies from persistent context (before navigation)...');
    const cookiesBeforeNav = await context.cookies();
    const twitterCookiesBeforeNav = cookiesBeforeNav.filter(c => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    );
    const authTokenBefore = twitterCookiesBeforeNav.find(c => c.name === 'auth_token');
    const ct0Before = twitterCookiesBeforeNav.find(c => c.name === 'ct0');
    console.log('Cookies before navigation:', cookiesBeforeNav.length);
    console.log('Twitter cookies before navigation:', twitterCookiesBeforeNav.length);
    console.log('auth_token before nav:', authTokenBefore ? `YES (domain: ${authTokenBefore.domain})` : 'NO');
    console.log('ct0 before nav:', ct0Before ? `YES (domain: ${ct0Before.domain})` : 'NO');
    
    const page = await context.newPage();
    console.log('\nNavigating to x.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('\nFinal URL:', url);
    console.log('Page title:', await page.title());

    const cookies = await context.cookies();
    const twitterCookies = cookies.filter(c => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    );
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0 = twitterCookies.find(c => c.name === 'ct0');

    console.log('\nCookie Analysis:');
    console.log('Total cookies:', cookies.length);
    console.log('Twitter cookies:', twitterCookies.length);
    console.log('auth_token:', authToken ? `YES (domain: ${authToken.domain})` : 'NO');
    console.log('ct0:', ct0 ? `YES (domain: ${ct0.domain})` : 'NO');

    if (authToken && ct0) {
      console.log('\n✅ SUCCESS: Auth cookies found');
      process.exit(0);
    } else {
      console.log('\n❌ FAIL: Auth cookies not found');
      console.log('Twitter cookie names:', twitterCookies.map(c => c.name).join(', '));
      process.exit(1);
    }
  } finally {
    await context.close();
  }
}

main().catch(console.error);
