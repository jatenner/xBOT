#!/usr/bin/env tsx
/**
 * Truth Gap Audit: Last 24 Hours
 * 
 * Reconciles tweets posted to X vs saved in Supabase to identify:
 * - Tweets posted to X but missing in DB
 * - DB marked posted but missing on X
 * - Duplicate tweet_id mappings
 * 
 * Uses Twitter API v2 (preferred) or local Playwright (fallback)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface XTweet {
  tweet_id: string;
  created_at: Date;
  url: string;
  text_snippet: string;
}

interface DBDecision {
  decision_id: string;
  decision_type: string;
  status: string;
  tweet_id: string | null;
  thread_tweet_ids: string[] | null;
  posted_at: string | null;
  updated_at: string | null;
}

interface FetchResult {
  tweets: XTweet[];
  method: 'api' | 'local_playwright' | 'failed';
  error?: string;
}

interface TruthGapResult {
  xTweets: XTweet[];
  dbDecisions: DBDecision[];
  tweetedButMissingInDb: XTweet[];
  dbMarkedPostedButMissingOnX: DBDecision[];
  duplicates: Array<{ tweet_id: string; decision_ids: string[] }>;
  fetchMethod: 'api' | 'local_playwright' | 'failed';
  auditValid: boolean;
  fetchError?: string;
}

/**
 * Fetch tweets from X using Twitter API v2 (preferred method)
 */
async function fetchXTweetsViaAPI(): Promise<FetchResult> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const userId = process.env.TWITTER_USER_ID;
  const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
  
  if (!bearerToken) {
    return { tweets: [], method: 'failed', error: 'TWITTER_BEARER_TOKEN not set' };
  }
  
  console.log(`[TRUTH_GAP] Fetching tweets via Twitter API v2...`);
  
  try {
    // First, get user ID if not provided
    let targetUserId = userId;
    if (!targetUserId) {
      const userLookupUrl = `https://api.twitter.com/2/users/by/username/${username}`;
      const userResponse = await fetch(userLookupUrl, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error(`User lookup failed: ${userResponse.status} ${userResponse.statusText}`);
      }
      
      const userData = await userResponse.json();
      targetUserId = userData.data?.id;
      
      if (!targetUserId) {
        throw new Error('Could not resolve user ID');
      }
    }
    
    // Fetch user timeline (last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startTime = twentyFourHoursAgo.toISOString();
    
    const timelineUrl = `https://api.twitter.com/2/users/${targetUserId}/tweets?max_results=100&start_time=${startTime}&tweet.fields=created_at,text&exclude=retweets,replies`;
    
    const response = await fetch(timelineUrl, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const tweets: XTweet[] = [];
    
    if (data.data && Array.isArray(data.data)) {
      for (const tweet of data.data) {
        const created_at = new Date(tweet.created_at);
        const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;
        
        tweets.push({
          tweet_id: tweet.id,
          created_at,
          url: tweetUrl,
          text_snippet: tweet.text?.substring(0, 100) || ''
        });
      }
    }
    
    console.log(`[TRUTH_GAP] ✅ Fetched ${tweets.length} tweets via Twitter API v2`);
    return { tweets, method: 'api' };
    
  } catch (error: any) {
    console.error(`[TRUTH_GAP] ❌ Twitter API fetch failed: ${error.message}`);
    return { tweets: [], method: 'failed', error: error.message };
  }
}

/**
 * Fetch tweets from X profile timeline using local Playwright (fallback)
 * Uses a fresh chromium instance, NOT the shared browser pool
 */
async function fetchXTweetsViaLocalPlaywright(): Promise<FetchResult> {
  console.log(`[TRUTH_GAP] Fetching tweets from X profile via local Playwright...`);
  
  const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
  const profileUrl = `https://x.com/${username}`;
  
  const tweets: XTweet[] = [];
  
  try {
    // Import playwright dynamically
    const { chromium } = await import('playwright');
    
    // Launch fresh browser instance (NOT using shared pool)
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for dynamic content
      
      // Scroll to load more tweets (scroll 3 times)
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
      }
      
      // Extract tweet IDs and metadata
      const tweetData = await page.evaluate(() => {
        const tweets: Array<{ id: string; url: string; text: string; time: string }> = [];
        
        // Find all article elements (tweets)
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        
        articles.forEach((article) => {
          // Extract tweet ID from links
          const links = article.querySelectorAll('a[href*="/status/"]');
          let tweetId = '';
          let tweetUrl = '';
          
          for (const link of Array.from(links)) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/status\/(\d+)/);
            if (match && match[1]) {
              tweetId = match[1];
              tweetUrl = href.startsWith('http') ? href : `https://x.com${href}`;
              break;
            }
          }
          
          if (!tweetId) return;
          
          // Extract text
          const textElement = article.querySelector('[data-testid="tweetText"]') || 
                             article.querySelector('div[lang]');
          const text = textElement?.textContent?.trim() || '';
          
          // Extract time (approximate - X uses relative time)
          const timeElement = article.querySelector('time');
          const timeAttr = timeElement?.getAttribute('datetime') || '';
          
          tweets.push({
            id: tweetId,
            url: tweetUrl,
            text: text.substring(0, 100),
            time: timeAttr
          });
        });
        
        return tweets;
      });
      
      // Filter to last 24 hours and convert to XTweet format
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (const tweet of tweetData) {
        if (!tweet.id) continue;
        
        let created_at: Date;
        if (tweet.time) {
          created_at = new Date(tweet.time);
        } else {
          // Fallback: use current time minus estimated age (rough approximation)
          created_at = new Date(Date.now() - 12 * 60 * 60 * 1000); // Assume 12h ago
        }
        
        // Only include tweets from last 24h
        if (created_at >= twentyFourHoursAgo) {
          tweets.push({
            tweet_id: tweet.id,
            created_at,
            url: tweet.url,
            text_snippet: tweet.text
          });
        }
      }
      
      console.log(`[TRUTH_GAP] ✅ Fetched ${tweets.length} tweets via local Playwright`);
      
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
    
    return { tweets, method: 'local_playwright' };
    
  } catch (error: any) {
    console.error(`[TRUTH_GAP] ❌ Local Playwright fetch failed: ${error.message}`);
    return { tweets: [], method: 'failed', error: error.message };
  }
}

/**
 * Fetch tweets from X (tries API first only if credentials present, otherwise Playwright)
 */
async function fetchXTweets(): Promise<FetchResult> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  
  // Only try API if credentials are present
  if (bearerToken) {
    console.log(`[TRUTH_GAP] Twitter API credentials detected, trying API first...`);
    const apiResult = await fetchXTweetsViaAPI();
    if (apiResult.method === 'api' && apiResult.tweets.length > 0) {
      return apiResult;
    }
    console.log(`[TRUTH_GAP] API fetch failed or returned no tweets, falling back to Playwright...`);
  } else {
    console.log(`[TRUTH_GAP] No Twitter API credentials found (TWITTER_BEARER_TOKEN not set)`);
    console.log(`[TRUTH_GAP] Using Playwright-only mode (matches posting method)`);
  }
  
  // Use local Playwright (isolated instance, not shared pool)
  const playwrightResult = await fetchXTweetsViaLocalPlaywright();
  return playwrightResult;
}

/**
 * Query Supabase for posted decisions in last 24h
 */
async function queryDBDecisions(): Promise<DBDecision[]> {
  const supabase = getSupabaseClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log(`[TRUTH_GAP] Querying Supabase for decisions updated since ${twentyFourHoursAgo}...`);
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, thread_tweet_ids, posted_at, updated_at')
    .gte('updated_at', twentyFourHoursAgo)
    .in('status', ['posted', 'failed', 'retrying'])
    .order('updated_at', { ascending: false });
  
  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
  
  console.log(`[TRUTH_GAP] ✅ Found ${data?.length || 0} decisions in DB`);
  
  const decisions: DBDecision[] = (data || []).map((row: any) => {
    let threadTweetIds: string[] | null = null;
    
    if (row.thread_tweet_ids) {
      try {
        const parsed = typeof row.thread_tweet_ids === 'string' 
          ? JSON.parse(row.thread_tweet_ids) 
          : row.thread_tweet_ids;
        threadTweetIds = Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        threadTweetIds = null;
      }
    }
    
    return {
      decision_id: row.decision_id,
      decision_type: row.decision_type || 'single',
      status: row.status,
      tweet_id: row.tweet_id,
      thread_tweet_ids: threadTweetIds,
      posted_at: row.posted_at,
      updated_at: row.updated_at
    };
  });
  
  return decisions;
}

/**
 * Reconcile X tweets vs DB decisions
 */
function reconcile(xTweets: XTweet[], dbDecisions: DBDecision[], fetchMethod: 'api' | 'local_playwright' | 'failed', fetchError?: string): TruthGapResult {
  const auditValid = fetchMethod !== 'failed' && xTweets.length > 0;
  
  // If audit is invalid, return empty results
  if (!auditValid) {
    return {
      xTweets: [],
      dbDecisions,
      tweetedButMissingInDb: [],
      dbMarkedPostedButMissingOnX: [],
      duplicates: [],
      fetchMethod,
      auditValid: false,
      fetchError
    };
  }
  
  console.log(`[TRUTH_GAP] Reconciling ${xTweets.length} X tweets vs ${dbDecisions.length} DB decisions...`);
  
  // Build maps for quick lookup
  const xTweetIds = new Set(xTweets.map(t => t.tweet_id));
  const dbTweetIdToDecisions = new Map<string, DBDecision[]>();
  
  // Map tweet_id -> decisions (including thread_tweet_ids)
  for (const decision of dbDecisions) {
    if (decision.tweet_id) {
      if (!dbTweetIdToDecisions.has(decision.tweet_id)) {
        dbTweetIdToDecisions.set(decision.tweet_id, []);
      }
      dbTweetIdToDecisions.get(decision.tweet_id)!.push(decision);
    }
    
    // Also check thread_tweet_ids
    if (decision.thread_tweet_ids) {
      for (const threadTweetId of decision.thread_tweet_ids) {
        if (!dbTweetIdToDecisions.has(threadTweetId)) {
          dbTweetIdToDecisions.set(threadTweetId, []);
        }
        dbTweetIdToDecisions.get(threadTweetId)!.push(decision);
      }
    }
  }
  
  // Find tweets posted to X but missing in DB
  const tweetedButMissingInDb: XTweet[] = [];
  for (const xTweet of xTweets) {
    if (!dbTweetIdToDecisions.has(xTweet.tweet_id)) {
      tweetedButMissingInDb.push(xTweet);
    }
  }
  
  // Find DB marked posted but missing on X
  const dbMarkedPostedButMissingOnX: DBDecision[] = [];
  for (const decision of dbDecisions) {
    if (decision.status === 'posted' && decision.tweet_id && !xTweetIds.has(decision.tweet_id)) {
      dbMarkedPostedButMissingOnX.push(decision);
    }
    
    // Also check thread_tweet_ids
    if (decision.status === 'posted' && decision.thread_tweet_ids) {
      for (const threadTweetId of decision.thread_tweet_ids) {
        if (!xTweetIds.has(threadTweetId)) {
          // Only add once per decision
          if (!dbMarkedPostedButMissingOnX.find(d => d.decision_id === decision.decision_id)) {
            dbMarkedPostedButMissingOnX.push(decision);
          }
        }
      }
    }
  }
  
  // Find duplicates (same tweet_id mapped to multiple decision_ids)
  const duplicates: Array<{ tweet_id: string; decision_ids: string[] }> = [];
  for (const [tweetId, decisions] of dbTweetIdToDecisions.entries()) {
    if (decisions.length > 1) {
      duplicates.push({
        tweet_id: tweetId,
        decision_ids: decisions.map(d => d.decision_id)
      });
    }
  }
  
  return {
    xTweets,
    dbDecisions,
    tweetedButMissingInDb,
    dbMarkedPostedButMissingOnX,
    duplicates,
    fetchMethod,
    auditValid: true
  };
}

/**
 * Generate markdown report
 */
function generateReport(result: TruthGapResult): string {
  const reportDate = new Date().toISOString();
  
  let report = `# Truth Gap Audit: Last 24 Hours\n\n`;
  report += `**Date:** ${reportDate}\n\n`;
  report += `---\n\n`;
  
  report += `## Audit Status\n\n`;
  report += `- **X_FETCH_METHOD:** ${result.fetchMethod}\n`;
  report += `- **AUDIT_VALID:** ${result.auditValid}\n`;
  if (result.fetchError) {
    report += `- **Fetch Error:** ${result.fetchError}\n`;
  }
  report += `\n`;
  
  // Add note about method
  if (result.fetchMethod === 'local_playwright') {
    report += `> **Note:** This audit uses Playwright to verify what is visible on X's UI.\n`;
    report += `> This matches the posting method, ensuring consistency.\n\n`;
  }
  
  if (!result.auditValid) {
    report += `## ⚠️ AUDIT INVALID\n\n`;
    report += `Could not fetch tweets from X. Cannot determine truth gap.\n\n`;
    report += `**Reason:** ${result.fetchError || 'Unknown error'}\n\n`;
    report += `**What this means:**\n`;
    report += `- The audit cannot verify if tweets are actually visible on X\n`;
    report += `- This is NOT the same as "posted but missing in DB"\n`;
    report += `- Fix X scraping (Playwright) to run a valid audit\n\n`;
    report += `**Next Steps:**\n`;
    report += `1. Check Playwright is installed and working\n`;
    report += `2. Verify network connectivity to x.com\n`;
    report += `3. Check browser session (TWITTER_SESSION_B64) if authentication is required\n\n`;
    report += `---\n\n`;
    report += `**Report Generated:** ${reportDate}\n`;
    return report;
  }
  
  report += `## Summary\n\n`;
  report += `- **Tweets on X (last 24h):** ${result.xTweets.length}\n`;
  report += `- **DB Decisions (last 24h):** ${result.dbDecisions.length}\n`;
  report += `- **Posted to X but Missing in DB:** ${result.tweetedButMissingInDb.length} 🚨\n`;
  report += `- **DB Marked Posted but Missing on X:** ${result.dbMarkedPostedButMissingOnX.length}\n`;
  report += `- **Duplicate Tweet ID Mappings:** ${result.duplicates.length}\n\n`;
  
  report += `## Tweets Posted to X but Missing in DB 🚨\n\n`;
  if (result.tweetedButMissingInDb.length === 0) {
    report += `✅ No gaps found - all X tweets are recorded in DB.\n\n`;
  } else {
    report += `Found ${result.tweetedButMissingInDb.length} tweets on X that are not recorded in DB:\n\n`;
    report += `| tweet_id | created_at | url | text_snippet |\n`;
    report += `|----------|------------|-----|--------------|\n`;
    for (const tweet of result.tweetedButMissingInDb.slice(0, 25)) {
      const shortId = tweet.tweet_id.substring(0, 15);
      const createdAt = tweet.created_at.toISOString().substring(0, 19);
      const textPreview = tweet.text_snippet.substring(0, 60).replace(/\n/g, ' ');
      report += `| ${shortId}... | ${createdAt} | ${tweet.url} | ${textPreview}... |\n`;
    }
    report += `\n`;
  }
  
  report += `## DB Marked Posted but Missing on X\n\n`;
  if (result.dbMarkedPostedButMissingOnX.length === 0) {
    report += `✅ All DB posted decisions appear on X.\n\n`;
  } else {
    report += `Found ${result.dbMarkedPostedButMissingOnX.length} DB decisions marked 'posted' but not found on X:\n\n`;
    report += `| decision_id | decision_type | tweet_id | thread_tweet_ids | posted_at |\n`;
    report += `|-------------|---------------|----------|------------------|-----------|\n`;
    for (const decision of result.dbMarkedPostedButMissingOnX.slice(0, 25)) {
      const shortDecisionId = decision.decision_id.substring(0, 8);
      const shortTweetId = decision.tweet_id ? decision.tweet_id.substring(0, 15) : 'N/A';
      const threadIdsStr = decision.thread_tweet_ids 
        ? `[${decision.thread_tweet_ids.length} IDs]` 
        : 'N/A';
      const postedAt = decision.posted_at ? decision.posted_at.substring(0, 19) : 'N/A';
      report += `| ${shortDecisionId}... | ${decision.decision_type} | ${shortTweetId}... | ${threadIdsStr} | ${postedAt} |\n`;
    }
    report += `\n`;
  }
  
  report += `## Duplicate Tweet ID Mappings\n\n`;
  if (result.duplicates.length === 0) {
    report += `✅ No duplicate tweet_id mappings found.\n\n`;
  } else {
    report += `Found ${result.duplicates.length} tweet_ids mapped to multiple decision_ids:\n\n`;
    report += `| tweet_id | decision_ids (count) |\n`;
    report += `|----------|---------------------|\n`;
    for (const dup of result.duplicates.slice(0, 25)) {
      const shortTweetId = dup.tweet_id.substring(0, 15);
      const decisionIdsStr = dup.decision_ids.map(id => id.substring(0, 8)).join(', ');
      report += `| ${shortTweetId}... | ${dup.decision_ids.length}: ${decisionIdsStr}... |\n`;
    }
    report += `\n`;
  }
  
  report += `---\n\n`;
  report += `**Report Generated:** ${reportDate}\n`;
  
  return report;
}

/**
 * Validate a specific tweet URL
 */
async function validateTweetUrl(tweetUrl: string): Promise<void> {
  console.log(`[TRUTH_GAP] Validating tweet URL: ${tweetUrl}`);
  
  // Extract tweet_id from URL
  const match = tweetUrl.match(/\/status\/(\d+)/);
  if (!match || !match[1]) {
    console.error(`[TRUTH_GAP] ❌ Invalid tweet URL format`);
    process.exit(1);
  }
  
  const tweetId = match[1];
  console.log(`[TRUTH_GAP] Extracted tweet_id: ${tweetId}`);
  
  // Verify it exists on X (use same logic as main audit)
  const fetchResult = await fetchXTweets();
  
  if (fetchResult.method === 'failed') {
    console.error(`[TRUTH_GAP] ❌ Cannot validate tweet - X fetch failed: ${fetchResult.error}`);
    process.exit(1);
  }
  
  const existsOnX = fetchResult.tweets.some(t => t.tweet_id === tweetId);
  
  if (!existsOnX) {
    console.log(`[TRUTH_GAP] ⚠️ Tweet ${tweetId} not found on X (may be outside 24h window or deleted)`);
  } else {
    console.log(`[TRUTH_GAP] ✅ Tweet ${tweetId} exists on X (via ${fetchResult.method})`);
  }
  
  // Verify it exists in DB
  const dbDecisions = await queryDBDecisions();
  let existsInDb = false;
  let foundInDecision: DBDecision | null = null;
  
  for (const decision of dbDecisions) {
    if (decision.tweet_id === tweetId) {
      existsInDb = true;
      foundInDecision = decision;
      break;
    }
    
    if (decision.thread_tweet_ids && decision.thread_tweet_ids.includes(tweetId)) {
      existsInDb = true;
      foundInDecision = decision;
      break;
    }
  }
  
  if (!existsInDb) {
    console.log(`[TRUTH_GAP] ❌ FAIL: Tweet ${tweetId} NOT found in DB`);
    console.log(`[TRUTH_GAP]    This indicates a truth gap!`);
    process.exit(1);
  } else {
    console.log(`[TRUTH_GAP] ✅ PASS: Tweet ${tweetId} found in DB`);
    console.log(`[TRUTH_GAP]    Decision ID: ${foundInDecision!.decision_id}`);
    console.log(`[TRUTH_GAP]    Decision Type: ${foundInDecision!.decision_type}`);
    console.log(`[TRUTH_GAP]    Status: ${foundInDecision!.status}`);
    if (foundInDecision!.thread_tweet_ids && foundInDecision!.thread_tweet_ids.includes(tweetId)) {
      console.log(`[TRUTH_GAP]    Found in thread_tweet_ids (thread of ${foundInDecision!.thread_tweet_ids.length} tweets)`);
    }
  }
}

async function main() {
  try {
    // Check for --tweetUrl flag
    const args = process.argv.slice(2);
    const tweetUrlArg = args.find(arg => arg.startsWith('--tweetUrl='));
    
    if (tweetUrlArg) {
      const tweetUrl = tweetUrlArg.split('=')[1];
      await validateTweetUrl(tweetUrl);
      return;
    }
    
    console.log(`[TRUTH_GAP] Starting truth gap audit for last 24 hours...\n`);
    
    // Fetch X tweets (tries API first, then local Playwright)
    const fetchResult = await fetchXTweets();
    
    if (fetchResult.method === 'failed') {
      console.error(`\n[TRUTH_GAP] ❌ AUDIT_INVALID: could not fetch tweets from X`);
      console.error(`[TRUTH_GAP]    Error: ${fetchResult.error || 'Unknown'}`);
      console.error(`[TRUTH_GAP]    Cannot determine truth gap without X data.`);
      console.error(`\n[TRUTH_GAP] This audit verifies what is visible on X via Playwright.`);
      console.error(`[TRUTH_GAP] If X scraping fails, the audit cannot determine if tweets are truly posted.`);
      
      // Still generate report but mark as invalid
      const dbDecisions = await queryDBDecisions();
      const result = reconcile([], dbDecisions, 'failed', fetchResult.error);
      const report = generateReport(result);
      
      const fs = await import('fs/promises');
      const reportPath = 'docs/reports/TRUTH_GAP_AUDIT_LAST24H.md';
      await fs.writeFile(reportPath, report, 'utf-8');
      
      console.error(`\n[TRUTH_GAP] Report generated with AUDIT_VALID=false`);
      process.exit(1);
    }
    
    // Query DB decisions
    const dbDecisions = await queryDBDecisions();
    
    // Reconcile
    const result = reconcile(fetchResult.tweets, dbDecisions, fetchResult.method);
    
    // Generate report
    const report = generateReport(result);
    
    // Write report
    const fs = await import('fs/promises');
    const reportPath = 'docs/reports/TRUTH_GAP_AUDIT_LAST24H.md';
    await fs.writeFile(reportPath, report, 'utf-8');
    
    console.log(`\n[TRUTH_GAP] ✅ Report generated: ${reportPath}\n`);
    
    // Print summary
    console.log(`=== TRUTH GAP SUMMARY ===`);
    console.log(`X_FETCH_METHOD: ${result.fetchMethod}`);
    console.log(`AUDIT_VALID: ${result.auditValid}`);
    console.log(`Tweets on X: ${result.xTweets.length}`);
    console.log(`DB Decisions: ${result.dbDecisions.length}`);
    
    if (result.auditValid) {
      console.log(`🚨 Posted to X but Missing in DB: ${result.tweetedButMissingInDb.length}`);
      console.log(`DB Marked Posted but Missing on X: ${result.dbMarkedPostedButMissingOnX.length}`);
      console.log(`Duplicate Mappings: ${result.duplicates.length}`);
      
      if (result.tweetedButMissingInDb.length > 0) {
        console.log(`\n⚠️ WARNING: ${result.tweetedButMissingInDb.length} tweets were posted to X but not saved in DB!`);
        console.log(`   This indicates a persistence gap that needs investigation.`);
      }
    } else {
      console.log(`\n⚠️ AUDIT INVALID: Cannot determine truth gap without X data.`);
    }
    
  } catch (error: any) {
    console.error(`[TRUTH_GAP] ❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
