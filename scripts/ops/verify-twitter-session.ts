#!/usr/bin/env tsx
/**
 * ✅ VERIFY TWITTER SESSION
 * 
 * Verifies that TWITTER_SESSION_B64 contains valid auth cookies
 * and can successfully navigate to X.com.
 */

import { chromium, BrowserContext, Page, Cookie } from 'playwright';

/**
 * Load cookies from TWITTER_SESSION_B64
 */
function loadCookiesFromB64(): Cookie[] {
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();

  if (!sessionB64) {
    throw new Error('TWITTER_SESSION_B64 environment variable is required');
  }

  try {
    const decoded = Buffer.from(sessionB64, 'base64').toString('utf8');
    const sessionData = JSON.parse(decoded);

    let cookies: any[] = [];
    if (Array.isArray(sessionData.cookies)) {
      cookies = sessionData.cookies;
    } else if (Array.isArray(sessionData)) {
      cookies = sessionData;
    } else if (sessionData.cookies) {
      cookies = sessionData.cookies;
    } else {
      throw new Error('Invalid session format: expected {cookies: [...]} or [...]');
    }

    // Normalize to Playwright cookie format
    const normalizedCookies: Cookie[] = cookies.map((c: any) => {
      const domain = c.domain || c.Domain || '';
      const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`;

      return {
        name: c.name || c.Name || '',
        value: c.value || c.Value || '',
        domain: normalizedDomain.includes('x.com') ? '.x.com' : '.twitter.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.Expires || -1,
        httpOnly: c.httpOnly !== undefined ? c.httpOnly : (c.HttpOnly !== undefined ? c.HttpOnly : false),
        secure: c.secure !== undefined ? c.secure : (c.Secure !== false),
        sameSite: (c.sameSite || c.SameSite || 'None') as 'Strict' | 'Lax' | 'None',
      };
    });

    // Duplicate for both domains
    const duplicatedCookies: Cookie[] = [];
    for (const cookie of normalizedCookies) {
      duplicatedCookies.push(cookie);
      if (cookie.domain === '.x.com') {
        duplicatedCookies.push({ ...cookie, domain: '.twitter.com' });
      } else if (cookie.domain === '.twitter.com') {
        duplicatedCookies.push({ ...cookie, domain: '.x.com' });
      }
    }

    return duplicatedCookies;
  } catch (error: any) {
    throw new Error(`Failed to load cookies from TWITTER_SESSION_B64: ${error.message}`);
  }
}

/**
 * Check auth cookies exist
 */
function checkAuthCookies(cookies: Cookie[]): { hasAuthToken: boolean; hasCt0: boolean; reason?: string } {
  const twitterCookies = cookies.filter((c) =>
    c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
  );

  const authToken = twitterCookies.find((c) => c.name === 'auth_token');
  const ct0 = twitterCookies.find((c) => c.name === 'ct0');

  if (!authToken) {
    return { hasAuthToken: false, hasCt0: !!ct0, reason: 'auth_token cookie missing' };
  }

  if (!ct0) {
    return { hasAuthToken: true, hasCt0: false, reason: 'ct0 cookie missing' };
  }

  return { hasAuthToken: true, hasCt0: true };
}

/**
 * Verify navigation works
 */
async function verifyNavigation(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const finalUrl = page.url();

    // Check if we're redirected to login
    if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Main verification function
 */
async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Verify Twitter Session');
  console.log('═══════════════════════════════════════════════════════════\n');

  let cookies: Cookie[];
  try {
    cookies = loadCookiesFromB64();
    console.log(`[VERIFY_SESSION] ✅ Loaded ${cookies.length} cookies from TWITTER_SESSION_B64\n`);
  } catch (error: any) {
    console.error(`[VERIFY_SESSION] ❌ Failed to load cookies: ${error.message}`);
    process.exit(1);
  }

  // Check auth cookies
  const authCheck = checkAuthCookies(cookies);
  const twitterCookies = cookies.filter((c) =>
    c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
  );

  console.log(`[VERIFY_SESSION] 📊 Cookie Statistics:`);
  console.log(`   Total cookies: ${cookies.length}`);
  console.log(`   X.com/Twitter cookies: ${twitterCookies.length}`);
  console.log(`   auth_token present: ${authCheck.hasAuthToken ? '✅ YES' : '❌ NO'}`);
  console.log(`   ct0 present: ${authCheck.hasCt0 ? '✅ YES' : '❌ NO'}\n`);

  if (!authCheck.hasAuthToken || !authCheck.hasCt0) {
    console.error(`[VERIFY_SESSION] ❌ FAIL: ${authCheck.reason}`);
    process.exit(1);
  }

  // Launch browser and test navigation
  console.log(`[VERIFY_SESSION] 🚀 Launching browser...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    await context.addCookies(cookies);
    console.log(`[VERIFY_SESSION] ✅ Cookies added to browser context\n`);

    const page = await context.newPage();

    // Test 1: Navigate to home
    console.log(`[VERIFY_SESSION] 📍 Testing navigation to https://x.com/home...`);
    const homeOk = await verifyNavigation(page, 'https://x.com/home');
    if (homeOk) {
      console.log(`[VERIFY_SESSION] ✅ SAFE_GOTO_OK: https://x.com/home\n`);
    } else {
      console.error(`[VERIFY_SESSION] ❌ SAFE_GOTO_FAIL: Redirected to login\n`);
      process.exit(1);
    }

    // Test 2: Navigate to a sample tweet
    console.log(`[VERIFY_SESSION] 📍 Testing navigation to sample tweet...`);
    const tweetUrl = 'https://x.com/elonmusk/status/1234567890'; // Sample tweet ID
    const tweetOk = await verifyNavigation(page, tweetUrl);
    if (tweetOk) {
      console.log(`[VERIFY_SESSION] ✅ SAFE_GOTO_OK: ${tweetUrl}\n`);
    } else {
      console.log(`[VERIFY_SESSION] ⚠️  SAFE_GOTO_FAIL: ${tweetUrl} (may be expected if tweet doesn't exist)\n`);
    }

    console.log(`[VERIFY_SESSION] ✅ AUTH_OK: Session is valid\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Verification Complete');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('PASS: Session is valid and can navigate to X.com');

  } catch (error: any) {
    console.error(`[VERIFY_SESSION] ❌ Error during verification: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[VERIFY_SESSION] ❌ Fatal error: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
