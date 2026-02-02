#!/usr/bin/env tsx
/**
 * 🔍 Search Page Forensics Diagnostic
 * 
 * Loads a public search query URL with same browser settings as harvester
 * and outputs diagnostic information about why extraction might be failing.
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/diagnose-public-search.ts <query_url>
 * 
 * Example:
 *   pnpm exec tsx scripts/ops/diagnose-public-search.ts "https://x.com/search?q=health%20min_faves:300%20-filter:replies%20lang:en&src=typed_query&f=live"
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const queryUrl = process.argv[2];
  
  if (!queryUrl) {
    console.error('Usage: pnpm exec tsx scripts/ops/diagnose-public-search.ts <query_url>');
    console.error('');
    console.error('Example:');
    console.error('  pnpm exec tsx scripts/ops/diagnose-public-search.ts "https://x.com/search?q=health%20min_faves:300%20-filter:replies%20lang:en&src=typed_query&f=live"');
    process.exit(1);
  }
  
  console.log('[SEARCH_DIAG] Starting search page forensics...');
  console.log(`[SEARCH_DIAG] queryUrl=${queryUrl}`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('search_diagnostic');
  
  try {
    // Navigate to search page
    console.log('[SEARCH_DIAG] Navigating to search page...');
    try {
      await page.goto(queryUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
    } catch (error: any) {
      if (error.message.includes('Timeout')) {
        console.warn('[SEARCH_DIAG] ⚠️ Navigation timeout - page may be blocked or slow. Continuing with current state...');
      } else {
        throw error;
      }
    }
    
    // Wait for content to load (same as harvester)
    await Promise.race([
      page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }).catch(() => null),
      page.waitForSelector('a[href*="/status/"]', { timeout: 10000 }).catch(() => null),
      page.waitForTimeout(10000)
    ]);
    
    await page.waitForTimeout(3000); // Additional settle time
    
    // Get page metadata
    const finalUrl = page.url();
    const title = await page.title();
    
    // Count DOM tweet cards
    const domTweetCards = await page.evaluate(() => {
      const selectors = [
        'article[data-testid="tweet"]',
        'article[role="article"]',
        'div[data-testid="cellInnerDiv"]',
        'div[data-testid="tweet"]'
      ];
      let found = 0;
      for (const sel of selectors) {
        found = document.querySelectorAll(sel).length;
        if (found > 0) break;
      }
      return found;
    });
    
    // Extract status links
    const statusLinksFound = await page.evaluate(() => {
      const statusIds = new Set<string>();
      
      // Method 1: Scan all anchors
      const anchors = Array.from(document.querySelectorAll('a[href*="/status/"]'));
      anchors.forEach(a => {
        const href = a.getAttribute('href') || '';
        // Only collect public status URLs (not /i/...)
        if (href.includes('/status/') && !href.includes('/i/')) {
          const match = href.match(/\/status\/(\d+)/);
          if (match && match[1]) {
            statusIds.add(match[1]);
          }
        }
      });
      
      // Method 2: Scan HTML content for status URLs (fallback)
      if (statusIds.size === 0) {
        const html = document.documentElement.outerHTML;
        const statusMatches = html.match(/\/status\/(\d{15,20})/g);
        if (statusMatches) {
          statusMatches.forEach(match => {
            const idMatch = match.match(/\/(\d{15,20})/);
            if (idMatch && idMatch[1] && !match.includes('/i/')) {
              statusIds.add(idMatch[1]);
            }
          });
        }
      }
      
      return Array.from(statusIds);
    });
    
    // Check for block indicators
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const pageHtml = await page.content();
    
    const blockIndicators = {
      something_went_wrong: pageText.includes('Something went wrong'),
      try_again: pageText.includes('Try again'),
      sign_in: pageText.includes('Sign in') || pageText.includes('Log in'),
      unusual_activity: pageText.includes('unusual activity'),
      js_not_available: pageText.includes('JavaScript is not available'),
      rate_limit: pageText.includes('rate limit') || pageText.includes('Rate limit'),
      join_x: pageText.includes('Join X') || pageText.includes('join X'),
      login_wall: finalUrl.includes('/i/flow/login') || title.toLowerCase().includes('log in') || title.toLowerCase().includes('sign in'),
    };
    
    // Classify page state
    let classification: 'ok' | 'blocked' | 'login_wall' | 'js_required' | 'selector_mismatch' = 'ok';
    
    if (blockIndicators.login_wall || (blockIndicators.sign_in && blockIndicators.join_x)) {
      classification = 'login_wall';
    } else if (blockIndicators.something_went_wrong || blockIndicators.try_again || blockIndicators.rate_limit) {
      classification = 'blocked';
    } else if (blockIndicators.js_not_available) {
      classification = 'js_required';
    } else if (domTweetCards === 0 && statusLinksFound.length === 0) {
      // Check if page has tweet markers but no cards
      const hasTweetMarkers = pageText.includes('Retweet') || pageText.includes('Like') || pageText.includes('Reply');
      if (hasTweetMarkers) {
        classification = 'selector_mismatch';
      } else {
        classification = 'blocked'; // Likely empty query or blocked
      }
    }
    
    // Output diagnostic info
    console.log(`[SEARCH_DIAG] finalUrl=${finalUrl}`);
    console.log(`[SEARCH_DIAG] title=${title}`);
    console.log(`[SEARCH_DIAG] domTweetCards=${domTweetCards}`);
    console.log(`[SEARCH_DIAG] statusLinksFound=${statusLinksFound.length}`);
    console.log(`[SEARCH_DIAG] classification=${classification}`);
    
    // Save artifacts
    const tmpDir = '/tmp';
    mkdirSync(tmpDir, { recursive: true });
    
    writeFileSync(join(tmpDir, 'search-diag.html'), pageHtml);
    console.log(`[SEARCH_DIAG] Saved HTML: /tmp/search-diag.html`);
    
    await page.screenshot({ path: join(tmpDir, 'search-diag.png'), fullPage: true });
    console.log(`[SEARCH_DIAG] Saved screenshot: /tmp/search-diag.png`);
    
    // Print block indicators
    if (Object.values(blockIndicators).some(v => v)) {
      console.log(`[SEARCH_DIAG] Block indicators detected:`);
      Object.entries(blockIndicators).forEach(([key, value]) => {
        if (value) {
          console.log(`[SEARCH_DIAG]   - ${key}: true`);
        }
      });
    }
    
    // Print status IDs found (first 10)
    if (statusLinksFound.length > 0) {
      console.log(`[SEARCH_DIAG] Status IDs found (first 10):`);
      statusLinksFound.slice(0, 10).forEach((id, idx) => {
        console.log(`[SEARCH_DIAG]   ${idx + 1}. ${id}`);
      });
      if (statusLinksFound.length > 10) {
        console.log(`[SEARCH_DIAG]   ... and ${statusLinksFound.length - 10} more`);
      }
    }
    
    // Exit with appropriate code
    if (classification === 'ok' && statusLinksFound.length > 0) {
      console.log(`[SEARCH_DIAG] ✅ Page looks OK - found ${statusLinksFound.length} status URLs`);
      process.exit(0);
    } else {
      console.log(`[SEARCH_DIAG] ⚠️  Issue detected: ${classification}`);
      console.log(`[SEARCH_DIAG] Check /tmp/search-diag.html and /tmp/search-diag.png for details`);
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(`[SEARCH_DIAG] ❌ Error:`, error.message);
    process.exit(1);
  } finally {
    await pool.releasePage(page);
  }
}

main();