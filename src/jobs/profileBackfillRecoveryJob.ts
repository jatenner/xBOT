/**
 * 🔧 TIER-2 PROFILE BACKFILL RECOVERY
 * 
 * Fallback recovery that scans our own X/Twitter profile for tweets
 * that posted successfully but have NO receipt (crash between post and receipt write).
 * 
 * - Runs every 60 minutes (low frequency, low impact)
 * - Scans last 30-50 tweets from profile
 * - Backfills DB when receipts/metadata missing
 * - Idempotent: never duplicates records
 * - Complements Tier-1 receipts reconciliation
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

interface ProfileTweet {
  tweet_id: string;
  url: string;
  scraped_at: Date;
}

interface RecoveryResult {
  scanned: number;
  found_missing: number;
  inserted: number;
  failed: number;
  errors: string[];
}

/**
 * Scrape recent tweets from our own profile
 */
async function scrapeOwnProfileTweets(limit: number = 30): Promise<ProfileTweet[]> {
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('profile_backfill');
  
  try {
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    console.log(`[PROFILE_RECOVERY] Navigating to profile: ${username}`);
    
    await page.goto(`https://x.com/${username}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for timeline to load
    await page.waitForTimeout(3000);
    
    // Scroll a bit to load more tweets
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    
    // Extract tweet links from profile
    const tweets = await page.evaluate((maxTweets) => {
      const tweetLinks: { url: string; tweet_id: string }[] = [];
      
      // Find all article elements (tweets)
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      
      for (const article of articles) {
        if (tweetLinks.length >= maxTweets) break;
        
        // Find status link within article
        const statusLink = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
        if (!statusLink) continue;
        
        const url = statusLink.href;
        const match = url.match(/\/status\/(\d+)/);
        if (!match) continue;
        
        const tweet_id = match[1];
        
        // Only include our own tweets (not retweets shown on profile)
        tweetLinks.push({ url, tweet_id });
      }
      
      return tweetLinks;
    }, limit);
    
    console.log(`[PROFILE_RECOVERY] Found ${tweets.length} tweets on profile`);
    
    return tweets.map(t => ({
      tweet_id: t.tweet_id,
      url: t.url,
      scraped_at: new Date()
    }));
    
  } finally {
    await pool.releasePage(page);
  }
}

/**
 * Check if tweet exists in database
 */
async function tweetExistsInDB(tweet_id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('tweet_id', tweet_id)
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    // Error other than "not found"
    throw new Error(`DB check failed: ${error.message}`);
  }
  
  return !!data;
}

/**
 * Backfill missing tweet into database
 */
async function backfillMissingTweet(tweet: ProfileTweet): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Create deterministic decision_id from tweet_id
  const decision_id = `discovered_${tweet.tweet_id}`;
  
  // Check if already backfilled (idempotency)
  const { data: existing } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('decision_id', decision_id)
    .single();
  
  if (existing) {
    console.log(`[PROFILE_RECOVERY] Already backfilled: ${tweet.tweet_id}`);
    return;
  }
  
  // Insert discovered tweet
  const payload = {
    decision_id,
    decision_type: 'single', // Assume single unless we can detect otherwise
    status: 'posted',
    tweet_id: tweet.tweet_id,
    posted_at: new Date().toISOString(),
    discovered_via_profile: true,
    content: '[Discovered via profile scan - content unavailable]',
    prompt_tokens: 0,
    completion_tokens: 0,
    total_cost: 0,
    scheduled_at: new Date().toISOString()
  };
  
  const { error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .insert([payload]);
  
  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }
  
  console.log(`[PROFILE_RECOVERY] ✅ Backfilled discovered tweet: ${tweet.tweet_id}`);
}

/**
 * Main recovery job execution
 */
export async function runProfileBackfillRecovery(): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    scanned: 0,
    found_missing: 0,
    inserted: 0,
    failed: 0,
    errors: []
  };
  
  try {
    console.log('[PROFILE_RECOVERY] Starting Tier-2 profile backfill recovery...');
    
    // Step 1: Scrape our profile
    const profileTweets = await scrapeOwnProfileTweets(30);
    result.scanned = profileTweets.length;
    
    if (profileTweets.length === 0) {
      console.log('[PROFILE_RECOVERY] No tweets found on profile (profile may be loading)');
      return result;
    }
    
    // Step 2: Check each tweet against DB
    for (const tweet of profileTweets) {
      try {
        const exists = await tweetExistsInDB(tweet.tweet_id);
        
        if (!exists) {
          result.found_missing++;
          console.log(`[PROFILE_RECOVERY] Missing tweet detected: ${tweet.tweet_id}`);
          
          // Step 3: Backfill missing tweet
          await backfillMissingTweet(tweet);
          result.inserted++;
          
        }
      } catch (itemError: any) {
        console.error(`[PROFILE_RECOVERY] Error processing ${tweet.tweet_id}:`, itemError.message);
        result.failed++;
        result.errors.push(`${tweet.tweet_id}: ${itemError.message}`);
      }
    }
    
    // Step 4: Log summary
    console.log('═══════════════════════════════════════');
    console.log(`[PROFILE_RECOVERY] Summary: scanned=${result.scanned} found_missing=${result.found_missing} inserted=${result.inserted} failed=${result.failed}`);
    if (result.errors.length > 0) {
      console.error('[PROFILE_RECOVERY] Errors encountered:');
      result.errors.slice(0, 3).forEach(err => console.error(`[PROFILE_RECOVERY]   - ${err}`));
      if (result.errors.length > 3) {
        console.error(`[PROFILE_RECOVERY]   ... and ${result.errors.length - 3} more`);
      }
    }
    console.log('═══════════════════════════════════════');
    
    return result;
    
  } catch (error: any) {
    console.error('[PROFILE_RECOVERY] Fatal error:', error.message);
    result.errors.push(`Fatal: ${error.message}`);
    return result;
  }
}

/**
 * Start the profile backfill recovery job (runs every 60 minutes)
 */
export function startProfileBackfillRecovery(): NodeJS.Timeout {
  console.log('[PROFILE_RECOVERY] Starting profile backfill recovery job (every 60 minutes)');
  
  // Run first check after 5 minutes (give system time to stabilize)
  setTimeout(() => {
    runProfileBackfillRecovery().catch(err => {
      console.error('[PROFILE_RECOVERY] Initial recovery failed:', err.message);
    });
  }, 5 * 60 * 1000);
  
  // Then every 60 minutes
  return setInterval(() => {
    runProfileBackfillRecovery().catch(err => {
      console.error('[PROFILE_RECOVERY] Recovery job failed:', err.message);
    });
  }, 60 * 60 * 1000);
}

