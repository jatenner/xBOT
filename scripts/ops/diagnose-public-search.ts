#!/usr/bin/env tsx
/**
 * 🔍 Search Page Forensics Diagnostic
 * 
 * Diagnoses why Twitter search pages return 0 tweets
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { writeFileSync } from 'fs';

async function main() {
  const queryUrl = process.argv[2] || 'https://x.com/search?q=min_faves%3A10000%20-filter%3Areplies%20lang%3Aen&src=typed_query&f=live';
  
  console.log('[SEARCH_DIAG] 🔍 Diagnosing search page...');
  console.log(`[SEARCH_DIAG] URL: ${queryUrl}\n`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('search_diagnostic');
  
  try {
    console.log('[SEARCH_DIAG] 🌐 Navigating to search page...');
    await page.goto(queryUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await page.waitForTimeout(5000); // Let page settle
    
    const finalUrl = page.url();
    const title = await page.title().catch(() => 'unknown');
    
    console.log(`[SEARCH_DIAG] finalUrl=${finalUrl}`);
    console.log(`[SEARCH_DIAG] title=${title}`);
    
    // Count DOM tweet cards using all known selectors
    const domCounts = await page.evaluate(() => {
      const selectors = [
        'article[data-testid="tweet"]',
        'article[role="article"]',
        'div[data-testid="cellInnerDiv"]',
        'div[data-testid="tweet"]'
      ];
      const counts: Record<string, number> = {};
      selectors.forEach(sel => {
        counts[sel] = document.querySelectorAll(sel).length;
      });
      return counts;
    });
    
    const domTweetCards = Math.max(...Object.values(domCounts));
    console.log(`[SEARCH_DIAG] domTweetCards=${domTweetCards}`);
    Object.entries(domCounts).forEach(([sel, count]) => {
      if (count > 0) console.log(`[SEARCH_DIAG]   ${sel}: ${count}`);
    });
    
    // Extract status URLs from anchors
    const statusLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/status/"]'));
      const statusIds = new Set<string>();
      anchors.forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        if (match && match[1]) {
          statusIds.add(match[1]);
        }
      });
      return Array.from(statusIds);
    });
    
    console.log(`[SEARCH_DIAG] statusLinksFound=${statusLinks.length}`);
    if (statusLinks.length > 0 && statusLinks.length <= 10) {
      console.log(`[SEARCH_DIAG]   Sample IDs: ${statusLinks.slice(0, 5).join(', ')}`);
    }
    
    // Get page HTML and text for analysis
    const html = await page.content();
    const pageText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    
    // Save artifacts
    writeFileSync('/tmp/search-diag.html', html.substring(0, 500000)); // Max 500KB
    await page.screenshot({ path: '/tmp/search-diag.png', fullPage: false });
    console.log(`[SEARCH_DIAG] 💾 Saved HTML to /tmp/search-diag.html (${html.length} chars)`);
    console.log(`[SEARCH_DIAG] 📸 Saved screenshot to /tmp/search-diag.png`);
    
    // Classify page state
    let classification: 'ok' | 'blocked' | 'login_wall' | 'js_required' | 'selector_mismatch' = 'ok';
    
    const lowerText = pageText.toLowerCase();
    const lowerHtml = html.toLowerCase();
    
    if (lowerText.includes('sign in') && (lowerText.includes('the conversation') || lowerText.includes('join x')) ||
        lowerText.includes('log in') && (lowerText.includes('your account') || lowerText.includes('join x')) ||
        finalUrl.includes('/i/flow/login') ||
        title.toLowerCase().includes('log in') ||
        title.toLowerCase().includes('sign in')) {
      classification = 'login_wall';
      console.log(`[SEARCH_DIAG] classification=login_wall`);
    } else if (lowerText.includes('something went wrong') || 
               lowerText.includes('try again') ||
               lowerText.includes('error occurred')) {
      classification = 'blocked';
      console.log(`[SEARCH_DIAG] classification=blocked`);
    } else if (lowerText.includes('unusual activity') ||
               lowerText.includes('rate limit') ||
               lowerText.includes('too many requests')) {
      classification = 'blocked';
      console.log(`[SEARCH_DIAG] classification=blocked (rate limit)`);
    } else if (lowerHtml.includes('javascript is not available') ||
               lowerText.includes('enable javascript')) {
      classification = 'js_required';
      console.log(`[SEARCH_DIAG] classification=js_required`);
    } else if (domTweetCards === 0 && statusLinks.length === 0 && html.length > 100000) {
      // Page loaded but no tweets found - likely selector mismatch
      classification = 'selector_mismatch';
      console.log(`[SEARCH_DIAG] classification=selector_mismatch`);
    } else if (domTweetCards > 0 || statusLinks.length > 0) {
      classification = 'ok';
      console.log(`[SEARCH_DIAG] classification=ok`);
    }
    
    // Print block indicators found
    const indicators: string[] = [];
    if (lowerText.includes('something went wrong')) indicators.push('"Something went wrong"');
    if (lowerText.includes('try again')) indicators.push('"Try again"');
    if (lowerText.includes('sign in')) indicators.push('"Sign in"');
    if (lowerText.includes('unusual activity')) indicators.push('"unusual activity"');
    if (lowerHtml.includes('javascript is not available')) indicators.push('"JavaScript is not available"');
    if (lowerText.includes('rate limit')) indicators.push('"rate limit"');
    
    if (indicators.length > 0) {
      console.log(`[SEARCH_DIAG] Block indicators found: ${indicators.join(', ')}`);
    }
    
    console.log(`\n[SEARCH_DIAG] Summary: ${classification} | tweets=${domTweetCards} | statusLinks=${statusLinks.length}`);
    
  } catch (error: any) {
    console.error(`[SEARCH_DIAG] ❌ Error: ${error.message}`);
    if (error.stack) console.error(error.stack);
  } finally {
    await pool.releasePage(page);
  }
}

main().catch(console.error);
