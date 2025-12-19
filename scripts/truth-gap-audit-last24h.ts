#!/usr/bin/env tsx
/**
 * Truth Gap Audit: Last 24 Hours
 * 
 * Reconciles tweets posted to X vs saved in Supabase to identify:
 * - Tweets posted to X but missing in DB
 * - DB marked posted but missing on X
 * - Duplicate tweet_id mappings
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { Page } from 'playwright';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

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

interface TruthGapResult {
  xTweets: XTweet[];
  dbDecisions: DBDecision[];
  tweetedButMissingInDb: XTweet[];
  dbMarkedPostedButMissingOnX: DBDecision[];
  duplicates: Array<{ tweet_id: string; decision_ids: string[] }>;
}

/**
 * Fetch tweets from X profile timeline using Playwright
 */
async function fetchXTweetsViaPlaywright(): Promise<XTweet[]> {
  console.log(`[TRUTH_GAP] Fetching tweets from X profile via Playwright...`);
  
  const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
  const profileUrl = `https://x.com/${username}`;
  
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: XTweet[] = [];
  
  try {
    await pool.withContext('truth_gap_audit', async (context) => {
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
        
        console.log(`[TRUTH_GAP] ✅ Fetched ${tweets.length} tweets from X profile`);
        
      } finally {
        await page.close();
      }
    }, 0);
    
  } catch (error: any) {
    console.error(`[TRUTH_GAP] ❌ Failed to fetch tweets via Playwright: ${error.message}`);
    // Return empty array on error - audit will still run on DB data
  }
  
  return tweets;
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
function reconcile(xTweets: XTweet[], dbDecisions: DBDecision[]): TruthGapResult {
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
    duplicates
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

async function main() {
  try {
    console.log(`[TRUTH_GAP] Starting truth gap audit for last 24 hours...\n`);
    
    // Fetch X tweets
    const xTweets = await fetchXTweetsViaPlaywright();
    
    // Query DB decisions
    const dbDecisions = await queryDBDecisions();
    
    // Reconcile
    const result = reconcile(xTweets, dbDecisions);
    
    // Generate report
    const report = generateReport(result);
    
    // Write report
    const fs = await import('fs/promises');
    const reportPath = 'docs/reports/TRUTH_GAP_AUDIT_LAST24H.md';
    await fs.writeFile(reportPath, report, 'utf-8');
    
    console.log(`\n[TRUTH_GAP] ✅ Report generated: ${reportPath}\n`);
    
    // Print summary
    console.log(`=== TRUTH GAP SUMMARY ===`);
    console.log(`Tweets on X: ${result.xTweets.length}`);
    console.log(`DB Decisions: ${result.dbDecisions.length}`);
    console.log(`🚨 Posted to X but Missing in DB: ${result.tweetedButMissingInDb.length}`);
    console.log(`DB Marked Posted but Missing on X: ${result.dbMarkedPostedButMissingOnX.length}`);
    console.log(`Duplicate Mappings: ${result.duplicates.length}`);
    
    if (result.tweetedButMissingInDb.length > 0) {
      console.log(`\n⚠️ WARNING: ${result.tweetedButMissingInDb.length} tweets were posted to X but not saved in DB!`);
      console.log(`   This indicates a persistence gap that needs investigation.`);
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

