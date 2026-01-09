/**
 * 👻 GHOST RECONCILIATION JOB
 * 
 * Detects ghost tweets (posted on X but missing in DB) by:
 * 1. Scraping our own profile timeline
 * 2. Comparing with DB records
 * 3. Inserting ghost_tweets records for any missing tweets
 * 4. Alerting via system_events
 * 
 * Runs every 10-30 minutes
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

const OUR_USERNAME = process.env.TWITTER_USERNAME || 'Signal_Synapse';
const PROFILE_URL = `https://x.com/${OUR_USERNAME}`;
const TWEETS_TO_CHECK = 50; // Last N tweets to check

export interface GhostTweet {
  tweet_id: string;
  content: string;
  posted_at: string;
  in_reply_to_tweet_id?: string;
}

/**
 * Run ghost reconciliation
 */
export async function runGhostReconciliation(): Promise<{
  checked: number;
  ghosts_found: number;
  ghosts_inserted: number;
  errors: string[];
}> {
  console.log('[GHOST_RECON] 👻 Starting ghost reconciliation...');
  
  const result = {
    checked: 0,
    ghosts_found: 0,
    ghosts_inserted: 0,
    errors: [] as string[],
  };
  
  try {
    // Step 1: Scrape our profile timeline
    const scrapedTweets = await scrapeProfileTimeline();
    result.checked = scrapedTweets.length;
    
    if (scrapedTweets.length === 0) {
      console.log('[GHOST_RECON] ⚠️ No tweets scraped from profile');
      return result;
    }
    
    console.log(`[GHOST_RECON] ✅ Scraped ${scrapedTweets.length} tweets from profile`);
    
    // Step 2: Compare with DB
    const ghosts = await findGhostTweets(scrapedTweets);
    result.ghosts_found = ghosts.length;
    
    if (ghosts.length === 0) {
      console.log('[GHOST_RECON] ✅ No ghosts found - all tweets in DB');
      return result;
    }
    
    console.log(`[GHOST_RECON] 🚨 Found ${ghosts.length} ghost tweet(s)!`);
    
    // Step 3: Insert ghost records
    const inserted = await insertGhostTweets(ghosts);
    result.ghosts_inserted = inserted;
    
    // Step 4: Alert via system_events
    await alertGhostTweets(ghosts);
    
    return result;
    
  } catch (error: any) {
    const errorMsg = `Ghost reconciliation failed: ${error.message}`;
    console.error(`[GHOST_RECON] ❌ ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Scrape our profile timeline to get recent tweet IDs
 */
async function scrapeProfileTimeline(): Promise<GhostTweet[]> {
  const pool = UnifiedBrowserPool.getInstance();
  
  return await pool.withContext('ghost_recon', async (context) => {
    const page = await context.newPage();
    
    try {
      console.log(`[GHOST_RECON] 📍 Navigating to ${PROFILE_URL}...`);
      await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Let page load
      
      // Extract tweet IDs and content
      const tweets = await page.evaluate((checkCount) => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results: any[] = [];
        
        for (let i = 0; i < Math.min(articles.length, checkCount); i++) {
          const article = articles[i];
          
          // Extract tweet ID from link
          const tweetLink = article.querySelector('a[href*="/status/"]');
          if (!tweetLink) continue;
          
          const href = tweetLink.getAttribute('href') || '';
          const match = href.match(/\/status\/(\d+)/);
          if (!match) continue;
          
          const tweet_id = match[1];
          
          // Extract content
          const tweetText = article.querySelector('[data-testid="tweetText"]');
          const content = tweetText?.textContent?.trim() || '';
          
          // Extract timestamp (approximate)
          const timeElement = article.querySelector('time');
          const posted_at = timeElement?.getAttribute('datetime') || new Date().toISOString();
          
          // Check if reply
          const replyLink = article.querySelector('a[href*="/status/"][href*="/status/"]');
          let in_reply_to_tweet_id: string | undefined;
          if (replyLink) {
            const replyHref = replyLink.getAttribute('href') || '';
            const replyMatch = replyHref.match(/\/status\/(\d+)/);
            if (replyMatch && replyMatch[1] !== tweet_id) {
              in_reply_to_tweet_id = replyMatch[1];
            }
          }
          
          results.push({
            tweet_id,
            content: content.substring(0, 500), // Limit length
            posted_at,
            in_reply_to_tweet_id,
          });
        }
        
        return results;
      }, TWEETS_TO_CHECK);
      
      return tweets;
    } finally {
      await page.close();
    }
  }, 1); // Low priority
}

/**
 * Find tweets that exist on X but not in DB
 */
async function findGhostTweets(scrapedTweets: GhostTweet[]): Promise<GhostTweet[]> {
  const supabase = getSupabaseClient();
  
  const tweetIds = scrapedTweets.map(t => t.tweet_id);
  
  // Check which tweet_ids exist in DB
  const { data: existingTweets } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id')
    .in('tweet_id', tweetIds)
    .not('tweet_id', 'is', null);
  
  const existingIds = new Set(existingTweets?.map(t => t.tweet_id) || []);
  
  // 🔒 GRACE WINDOW: Check for pending permits/decisions (3-minute grace window)
  const graceWindowStart = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
  
  // Check pending permits (may be posting now)
  const { data: pendingPermits } = await supabase
    .from('post_attempts')
    .select('actual_tweet_id')
    .in('status', ['PENDING', 'APPROVED'])
    .gte('created_at', graceWindowStart.toISOString());
  
  pendingPermits?.forEach(p => {
    if (p.actual_tweet_id && tweetIds.includes(p.actual_tweet_id)) {
      existingIds.add(p.actual_tweet_id); // Exclude from ghosts
    }
  });
  
  // Check decisions in posting state
  const { data: postingDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id')
    .in('status', ['posting_attempt', 'queued'])
    .gte('created_at', graceWindowStart.toISOString());
  
  postingDecisions?.forEach(d => {
    if (d.tweet_id && tweetIds.includes(d.tweet_id)) {
      existingIds.add(d.tweet_id); // Exclude from ghosts
    }
  });
  
  // Find ghosts (scraped but not in DB, and not in grace window)
  const ghosts = scrapedTweets.filter(t => !existingIds.has(t.tweet_id));
  
  if (ghosts.length < scrapedTweets.length - existingIds.size) {
    const excluded = scrapedTweets.length - existingIds.size - ghosts.length;
    console.log(`[GHOST_RECON] 🛡️ Grace window excluded ${excluded} recently posted tweets from ghost detection`);
  }
  
  return ghosts;
}

/**
 * Insert ghost tweets into ghost_tweets table
 */
async function insertGhostTweets(ghosts: GhostTweet[]): Promise<number> {
  const supabase = getSupabaseClient();
  
  const railway_service_name = process.env.RAILWAY_SERVICE_NAME || 'xBOT';
  const git_sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  
  let inserted = 0;
  
  for (const ghost of ghosts) {
    // Check if already recorded
    const { data: existing } = await supabase
      .from('ghost_tweets')
      .select('id')
      .eq('tweet_id', ghost.tweet_id)
      .single();
    
    if (existing) {
      continue; // Already recorded
    }
    
    const { error } = await supabase
      .from('ghost_tweets')
      .insert({
        tweet_id: ghost.tweet_id,
        content: ghost.content,
        posted_at: ghost.posted_at,
        in_reply_to_tweet_id: ghost.in_reply_to_tweet_id || null,
        author_username: OUR_USERNAME,
        origin_commit_sha: git_sha,
        origin_service_name: railway_service_name,
        origin_run_id: `recon_${Date.now()}`,
        detected_by: 'reconciliation_job',
        status: 'detected',
      });
    
    if (error) {
      console.error(`[GHOST_RECON] ⚠️ Failed to insert ghost tweet ${ghost.tweet_id}: ${error.message}`);
    } else {
      inserted++;
      console.log(`[GHOST_RECON] 👻 Recorded ghost tweet: ${ghost.tweet_id}`);
    }
  }
  
  return inserted;
}

/**
 * Alert via system_events
 */
async function alertGhostTweets(ghosts: GhostTweet[]): Promise<void> {
  const supabase = getSupabaseClient();
  
  const railway_service_name = process.env.RAILWAY_SERVICE_NAME || 'xBOT';
  const git_sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  
  for (const ghost of ghosts) {
    await supabase.from('system_events').insert({
      event_type: 'ghost_tweet_detected',
      severity: 'critical', // 🔒 MANDATE 4: High-severity event
      message: `🚨 GHOST TWEET DETECTED: ${ghost.tweet_id} (posted on X but missing in DB)`,
      event_data: {
        tweet_id: ghost.tweet_id,
        content_preview: ghost.content.substring(0, 100),
        in_reply_to_tweet_id: ghost.in_reply_to_tweet_id,
        origin_commit_sha: git_sha,
        origin_service_name: railway_service_name,
        detected_at: new Date().toISOString(),
        detection_time: new Date().toISOString(), // 🔒 MANDATE 4: Detection time
      },
      created_at: new Date().toISOString(),
    });
  }
  
  console.log(`[GHOST_RECON] 📢 Alerted ${ghosts.length} ghost tweet(s) via system_events`);
}

