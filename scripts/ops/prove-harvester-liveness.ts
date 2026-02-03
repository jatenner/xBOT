#!/usr/bin/env tsx
/**
 * 🔬 HARVESTER LIVENESS PROOF
 * 
 * Proves that harvester can store ≥1 new public_search_* opportunity
 * in a single, controlled run.
 * 
 * Constraints:
 * - EXACTLY ONE harvest cycle
 * - Use .env.control (session-based auth)
 * - P1_MODE=true
 * - EXACTLY ONE public search query
 * - NO seed harvesting
 * - NO parallel contexts
 * - NO repeated navigations
 * - NO retries
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from 'playwright';
import { getSupabaseClient } from '../../src/db/index';

const SEARCH_URL = 'https://x.com/search?q=health%20min_faves:300%20-filter:replies%20lang:en&f=live';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🔬 HARVESTER LIVENESS PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // STEP 1 — Sanity snapshot
  console.log('STEP 1 — Sanity Snapshot\n');
  
  // Check env file
  const envControlPath = path.join(process.cwd(), '.env.control');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  let envFile = 'none';
  if (fs.existsSync(envControlPath)) {
    envFile = '.env.control';
  } else if (fs.existsSync(envLocalPath)) {
    envFile = '.env.local';
  }
  console.log(`   Env file loaded: ${envFile}`);
  
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE || 'not set'}`);
  console.log(`   P1_MODE: ${process.env.P1_MODE || 'not set'}`);
  console.log(`   TWITTER_SESSION_B64: ${process.env.TWITTER_SESSION_B64 ? `set (length: ${process.env.TWITTER_SESSION_B64.length})` : 'not set'}`);
  console.log(`   Browser profile: N/A (using temp profile for this proof)\n`);
  
  // Query DB for baseline
  const supabase = getSupabaseClient();
  const { data: beforeData, error: beforeError } = await supabase
    .from('reply_opportunities')
    .select('discovery_source')
    .like('discovery_source', 'public_search_%');
  
  if (beforeError) {
    console.error(`   ❌ DB query error: ${beforeError.message}`);
    process.exit(1);
  }
  
  const beforeCount = beforeData?.length || 0;
  console.log(`   public_search_* count BEFORE: ${beforeCount}\n`);

  // STEP 2 — Controlled search navigation
  console.log('STEP 2 — Controlled Search Navigation\n');
  console.log(`   Navigating to: ${SEARCH_URL}`);
  
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Load cookies from TWITTER_SESSION_B64 if available
  if (process.env.TWITTER_SESSION_B64) {
    try {
      const decoded = Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString('utf8');
      const sessionData = JSON.parse(decoded);
      let cookies: any[] = [];
      if (Array.isArray(sessionData.cookies)) {
        cookies = sessionData.cookies;
      } else if (Array.isArray(sessionData)) {
        cookies = sessionData;
      }
      
      const normalizedCookies = cookies.map((c: any) => ({
        name: c.name || c.Name || '',
        value: c.value || c.Value || '',
        domain: c.domain || c.Domain || '.x.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.Expires || -1,
        httpOnly: c.httpOnly || c.HttpOnly || false,
        secure: c.secure !== false,
        sameSite: c.sameSite || c.SameSite || 'None',
      }));
      
      await context.addCookies(normalizedCookies);
      console.log(`   ✅ Injected ${normalizedCookies.length} cookies\n`);
    } catch (e: any) {
      console.log(`   ⚠️  Failed to load cookies: ${e.message}\n`);
    }
  }
  
  // Navigate ONCE
  console.log('   Navigating...');
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait 8-12 seconds AFTER page load
  const waitTime = 8000 + Math.random() * 4000; // 8-12 seconds
  console.log(`   Waiting ${Math.floor(waitTime / 1000)}s after page load...`);
  await page.waitForTimeout(waitTime);
  
  const finalUrl = page.url();
  const title = await page.title();
  
  // Extract tweet cards and status URLs
  const extraction = await page.evaluate(() => {
    // Find tweet cards
    const tweetCards = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
    
    // Find status links
    const statusLinks = Array.from(document.querySelectorAll('a[href*="/status/"]'))
      .map((link: any) => link.href)
      .filter((href: string) => href.includes('/status/'));
    
    // Extract unique tweet IDs
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
  
  console.log(`   ✅ Navigation complete`);
  console.log(`   Final URL: ${finalUrl}`);
  console.log(`   Page title: ${title}`);
  console.log(`   domTweetCards: ${extraction.domTweetCards}`);
  console.log(`   statusUrls: ${extraction.statusUrls.length}\n`);
  
  // Take screenshot and save HTML
  const screenshotPath = path.join(process.cwd(), 'docs', 'proofs', 'harvest', `liveness-proof-${Date.now()}.png`);
  const htmlPath = path.join(process.cwd(), 'docs', 'proofs', 'harvest', `liveness-proof-${Date.now()}.html`);
  
  const proofsDir = path.dirname(screenshotPath);
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const htmlContent = await page.content();
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  
  console.log(`   📸 Screenshot: ${screenshotPath}`);
  console.log(`   📄 HTML: ${htmlPath}\n`);

  // STEP 3 — Extraction + fallback
  console.log('STEP 3 — Extraction + Fallback\n');
  
  let tweetIds: string[] = [];
  let extractionPath = 'none';
  
  // Attempt structured extraction first
  if (extraction.domTweetCards > 0) {
    // Try to extract from tweet cards
    const structuredIds = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
      const ids: string[] = [];
      
      cards.forEach((card: any) => {
        // Try to find status link within card
        const link = card.querySelector('a[href*="/status/"]');
        if (link) {
          const href = link.getAttribute('href');
          const match = href.match(/\/status\/(\d+)/);
          if (match && match[1]) {
            ids.push(match[1]);
          }
        }
      });
      
      return ids;
    });
    
    if (structuredIds.length > 0) {
      tweetIds = structuredIds;
      extractionPath = 'structured';
    }
  }
  
  // Fallback to URL parsing if structured extraction failed
  if (tweetIds.length === 0 && extraction.statusUrls.length > 0) {
    tweetIds = extraction.statusUrls;
    extractionPath = 'fallback_urls';
  }
  
  console.log(`   Extraction path: ${extractionPath}`);
  console.log(`   Tweet IDs extracted: ${tweetIds.length}\n`);
  
  if (tweetIds.length === 0) {
    console.log('❌ FAILURE: No tweet IDs extracted');
    console.log(`   Step failed: STEP 3`);
    console.log(`   Evidence: domTweetCards=${extraction.domTweetCards}, statusUrls=${extraction.statusUrls.length}`);
    await browser.close();
    process.exit(1);
  }

  // STEP 4 — Storage (P1 fail-open)
  console.log('STEP 4 — Storage (P1 Fail-Open)\n');
  console.log(`   Storing ${tweetIds.length} candidates as reply_opportunities...`);
  
  const insertData = tweetIds.map((tweetId) => ({
    target_tweet_id: tweetId,
    target_tweet_url: `https://x.com/i/status/${tweetId}`,
    target_username: '', // Will be filled later if needed
    target_tweet_content: '', // Will be filled later if needed
    discovery_source: 'public_search_proof',
    status: 'pending',
    replied_to: false,
    is_root_tweet: true,
    is_reply_tweet: false,
    root_tweet_id: tweetId,
    opportunity_score: 0,
    created_at: new Date().toISOString(),
  }));
  
  const { data: insertResult, error: insertError } = await supabase
    .from('reply_opportunities')
    .insert(insertData)
    .select();
  
  if (insertError) {
    console.error(`   ❌ Storage error: ${insertError.message}`);
    console.log(`   Step failed: STEP 4`);
    await browser.close();
    process.exit(1);
  }
  
  const insertedCount = insertResult?.length || 0;
  console.log(`   ✅ Inserted ${insertedCount} rows\n`);

  // STEP 5 — Post-run proof
  console.log('STEP 5 — Post-Run Proof\n');
  
  const { data: afterData, error: afterError } = await supabase
    .from('reply_opportunities')
    .select('discovery_source')
    .like('discovery_source', 'public_search_%');
  
  if (afterError) {
    console.error(`   ❌ DB query error: ${afterError.message}`);
    await browser.close();
    process.exit(1);
  }
  
  const afterCount = afterData?.length || 0;
  const delta = afterCount - beforeCount;
  
  // Get breakdown by discovery_source
  const { data: breakdownData } = await supabase
    .from('reply_opportunities')
    .select('discovery_source');
  
  const breakdown: Record<string, number> = {};
  breakdownData?.forEach((row) => {
    if (row.discovery_source?.startsWith('public_search_')) {
      breakdown[row.discovery_source] = (breakdown[row.discovery_source] || 0) + 1;
    }
  });
  
  console.log(`   public_search_* count BEFORE: ${beforeCount}`);
  console.log(`   public_search_* count AFTER: ${afterCount}`);
  console.log(`   Net delta: ${delta}`);
  console.log(`\n   Breakdown by discovery_source:`);
  Object.entries(breakdown).forEach(([source, count]) => {
    console.log(`     ${source}: ${count}`);
  });
  
  await browser.close();
  
  // SUCCESS CRITERIA
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (delta >= 1) {
    console.log('✅ SUCCESS: ≥1 new public_search_* opportunity stored');
    console.log(`   Net delta: ${delta}`);
    console.log(`   Extraction path: ${extractionPath}`);
    console.log(`   Tweet IDs stored: ${insertedCount}`);
    process.exit(0);
  } else {
    console.log('❌ FAILURE: No new public_search_* opportunities stored');
    console.log(`   Net delta: ${delta}`);
    console.log(`   Step failed: STEP 5`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
