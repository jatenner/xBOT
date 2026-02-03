#!/usr/bin/env tsx
/**
 * Production Parity Probe - Verify auth state in Railway production
 * 
 * Checks:
 * - Session loaded with auth_token + ct0 on .x.com
 * - No login redirects
 * - Search page loads with tweet cards
 * 
 * NEVER logs cookie values - only presence, domains, and expiry timestamps
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import * as fs from 'fs';
import * as path from 'path';

const PROOF_DIR = path.join(process.cwd(), 'docs', 'proofs', 'auth');
const TIMESTAMP = Date.now();
const PROOF_SUBDIR = path.join(PROOF_DIR, TIMESTAMP.toString());

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🔬 PRODUCTION PARITY PROBE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Ensure proof directory exists
  if (!fs.existsSync(PROOF_SUBDIR)) {
    fs.mkdirSync(PROOF_SUBDIR, { recursive: true });
  }

  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('prod_parity_probe');

  const results: {
    home: {
      finalUrl: string;
      title: string;
      cookieCount: number;
      authTokenPresent: boolean;
      ct0Present: boolean;
      authTokenDomain?: string;
      ct0Domain?: string;
      authTokenExpires?: number;
      ct0Expires?: number;
      redirectChain: string[];
    };
    search: {
      finalUrl: string;
      title: string;
      domTweetCards: number;
      statusUrls: number;
      redirectChain: string[];
    };
  } = {
    home: {
      finalUrl: '',
      title: '',
      cookieCount: 0,
      authTokenPresent: false,
      ct0Present: false,
      redirectChain: [],
    },
    search: {
      finalUrl: '',
      title: '',
      domTweetCards: 0,
      statusUrls: 0,
      redirectChain: [],
    },
  };

  try {
    // PROBE 1: Home navigation
    console.log('🔬 PROBE 1: Home Navigation\n');
    console.log('   Navigating to https://x.com/home...');
    
    const homeRedirects: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/i/flow/login')) {
        homeRedirects.push(url);
      }
    });

    await page.goto('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000); // Wait for any redirects

    results.home.finalUrl = page.url();
    results.home.title = await page.title();
    results.home.redirectChain = homeRedirects;

    const context = page.context();
    const homeCookies = await context.cookies('https://x.com');
    results.home.cookieCount = homeCookies.length;

    const authToken = homeCookies.find(c => c.name.toLowerCase() === 'auth_token' && c.domain === '.x.com');
    const ct0 = homeCookies.find(c => c.name.toLowerCase() === 'ct0' && c.domain === '.x.com');

    results.home.authTokenPresent = !!authToken;
    results.home.ct0Present = !!ct0;

    if (authToken) {
      results.home.authTokenDomain = authToken.domain;
      results.home.authTokenExpires = authToken.expires;
    }
    if (ct0) {
      results.home.ct0Domain = ct0.domain;
      results.home.ct0Expires = ct0.expires;
    }

    console.log(`   Final URL: ${results.home.finalUrl}`);
    console.log(`   Title: ${results.home.title}`);
    console.log(`   Cookie count: ${results.home.cookieCount}`);
    console.log(`   auth_token on .x.com: ${results.home.authTokenPresent ? 'YES' : 'NO'}`);
    console.log(`   ct0 on .x.com: ${results.home.ct0Present ? 'YES' : 'NO'}`);
    if (authToken) {
      console.log(`   auth_token expires: ${authToken.expires === -1 ? 'session' : new Date(authToken.expires * 1000).toISOString()}`);
    }
    if (ct0) {
      console.log(`   ct0 expires: ${ct0.expires === -1 ? 'session' : new Date(ct0.expires * 1000).toISOString()}`);
    }

    // Save screenshot
    const homeScreenshot = path.join(PROOF_SUBDIR, 'home.png');
    await page.screenshot({ path: homeScreenshot, fullPage: false });
    console.log(`   Screenshot: ${homeScreenshot}`);

    // Save HTML
    const homeHtml = path.join(PROOF_SUBDIR, 'home.html');
    fs.writeFileSync(homeHtml, await page.content(), 'utf8');
    console.log(`   HTML: ${homeHtml}\n`);

    // PROBE 2: Search navigation
    console.log('🔬 PROBE 2: Search Navigation\n');
    const searchUrl = 'https://x.com/search?q=health%20min_faves:300%20-filter:replies%20lang:en&f=live';
    console.log(`   Navigating to: ${searchUrl}`);

    const searchRedirects: string[] = [];
    page.removeAllListeners('response');
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/i/flow/login')) {
        searchRedirects.push(url);
      }
    });

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(8000); // Wait for results to load

    results.search.finalUrl = page.url();
    results.search.title = await page.title();
    results.search.redirectChain = searchRedirects;

    const extraction = await page.evaluate(() => {
      const tweetCards = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
      const statusLinks = Array.from(document.querySelectorAll('a[href*="/status/"]'))
        .map((link: any) => link.href)
        .filter((href: string) => href.includes('/status/'));
      
      const tweetIds = new Set<string>();
      statusLinks.forEach((href: string) => {
        const match = href.match(/\/status\/(\d+)/);
        if (match && match[1]) {
          tweetIds.add(match[1]);
        }
      });

      return {
        domTweetCards: tweetCards.length,
        statusUrls: Array.from(tweetIds),
      };
    });

    results.search.domTweetCards = extraction.domTweetCards;
    results.search.statusUrls = extraction.statusUrls.length;

    console.log(`   Final URL: ${results.search.finalUrl}`);
    console.log(`   Title: ${results.search.title}`);
    console.log(`   domTweetCards: ${results.search.domTweetCards}`);
    console.log(`   statusUrls: ${results.search.statusUrls}`);

    // Save screenshot
    const searchScreenshot = path.join(PROOF_SUBDIR, 'search.png');
    await page.screenshot({ path: searchScreenshot, fullPage: false });
    console.log(`   Screenshot: ${searchScreenshot}`);

    // Save HTML
    const searchHtml = path.join(PROOF_SUBDIR, 'search.html');
    fs.writeFileSync(searchHtml, await page.content(), 'utf8');
    console.log(`   HTML: ${searchHtml}\n`);

  } finally {
    await pool.releasePage(page);
  }

  // Generate proof doc
  const proofDoc = `# Production Parity Probe - ${new Date().toISOString()}

## Results

### Home Navigation
- **Final URL**: ${results.home.finalUrl}
- **Title**: ${results.home.title}
- **Cookie Count**: ${results.home.cookieCount}
- **auth_token on .x.com**: ${results.home.authTokenPresent ? '✅ YES' : '❌ NO'}
- **ct0 on .x.com**: ${results.home.ct0Present ? '✅ YES' : '❌ NO'}
${results.home.authTokenDomain ? `- **auth_token domain**: ${results.home.authTokenDomain}` : ''}
${results.home.ct0Domain ? `- **ct0 domain**: ${results.home.ct0Domain}` : ''}
${results.home.authTokenExpires ? `- **auth_token expires**: ${results.home.authTokenExpires === -1 ? 'session' : new Date(results.home.authTokenExpires * 1000).toISOString()}` : ''}
${results.home.ct0Expires ? `- **ct0 expires**: ${results.home.ct0Expires === -1 ? 'session' : new Date(results.home.ct0Expires * 1000).toISOString()}` : ''}
- **Redirect Chain**: ${results.home.redirectChain.length > 0 ? results.home.redirectChain.join(' → ') : 'None'}

### Search Navigation
- **Final URL**: ${results.search.finalUrl}
- **Title**: ${results.search.title}
- **domTweetCards**: ${results.search.domTweetCards}
- **statusUrls**: ${results.search.statusUrls}
- **Redirect Chain**: ${results.search.redirectChain.length > 0 ? results.search.redirectChain.join(' → ') : 'None'}

## Artifacts
- Home screenshot: \`home.png\`
- Home HTML: \`home.html\`
- Search screenshot: \`search.png\`
- Search HTML: \`search.html\`

## Verdict

${results.home.finalUrl.includes('/i/flow/login') ? '❌ **FAIL**: Redirected to login page' : '✅ **PASS**: No login redirect'}
${!results.home.authTokenPresent ? '❌ **FAIL**: auth_token missing on .x.com' : '✅ **PASS**: auth_token present'}
${!results.home.ct0Present ? '❌ **FAIL**: ct0 missing on .x.com' : '✅ **PASS**: ct0 present'}
${results.search.domTweetCards === 0 ? '❌ **FAIL**: No tweet cards found' : '✅ **PASS**: Tweet cards found'}

**Overall**: ${results.home.finalUrl.includes('/i/flow/login') || !results.home.authTokenPresent || !results.home.ct0Present || results.search.domTweetCards === 0 ? '❌ FAILED' : '✅ PASSED'}
`;

  const proofDocPath = path.join(PROOF_SUBDIR, 'PROOF.md');
  fs.writeFileSync(proofDocPath, proofDoc, 'utf8');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    VERDICT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const passed = !results.home.finalUrl.includes('/i/flow/login') &&
                 results.home.authTokenPresent &&
                 results.home.ct0Present &&
                 results.search.domTweetCards > 0;

  if (passed) {
    console.log('✅ PRODUCTION AUTH VERIFIED');
    console.log(`   Proof doc: ${proofDocPath}`);
  } else {
    console.log('❌ PRODUCTION AUTH FAILED');
    console.log(`   Proof doc: ${proofDocPath}`);
    if (results.home.finalUrl.includes('/i/flow/login')) {
      console.log('   Issue: Redirected to login page');
    }
    if (!results.home.authTokenPresent) {
      console.log('   Issue: auth_token missing on .x.com');
    }
    if (!results.home.ct0Present) {
      console.log('   Issue: ct0 missing on .x.com');
    }
    if (results.search.domTweetCards === 0) {
      console.log('   Issue: No tweet cards found in search');
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
