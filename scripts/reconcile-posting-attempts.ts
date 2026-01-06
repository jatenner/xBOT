/**
 * 🔄 RECONCILE POSTING ATTEMPTS
 * 
 * Finds rows stuck in 'posting_attempt' status and reconciles them:
 * - Checks if tweet actually posted by scraping profile
 * - Updates status to 'posted' if found, 'failed' if not
 * - Prevents rows from staying in posting_attempt >5 minutes
 */

import { getSupabaseClient } from '../src/db/index';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { createHash } from 'crypto';

interface StuckAttempt {
  decision_id: string;
  content: string;
  created_at: string;
  decision_type: string;
}

interface ProfileTweet {
  tweet_id: string;
  content: string;
  posted_at: Date;
}

/**
 * Scrape recent tweets from our profile
 */
async function scrapeOwnProfileTweets(limit: number = 20): Promise<ProfileTweet[]> {
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('reconciliation');
  
  try {
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    console.log(`[RECONCILE] 🔍 Scraping profile: ${username}`);
    
    await page.goto(`https://x.com/${username}?t=${Date.now()}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Scroll to load more tweets
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    
    // Extract tweets from profile
    const tweets = await page.evaluate((maxTweets) => {
      const results: { tweet_id: string; content: string; datetime: string }[] = [];
      
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      
      for (const article of articles) {
        if (results.length >= maxTweets) break;
        
        // Get tweet ID from status link
        const statusLink = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
        if (!statusLink) continue;
        
        const url = statusLink.href;
        const match = url.match(/\/status\/(\d+)/);
        if (!match) continue;
        
        const tweet_id = match[1];
        
        // Get tweet content
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const content = textEl?.textContent || '';
        
        // Get timestamp
        const timeEl = article.querySelector('time');
        const datetime = timeEl?.getAttribute('datetime') || '';
        
        // Verify it's our tweet (check author)
        const authorLink = article.querySelector(`a[href="/${(window as any).TWITTER_USERNAME || 'SignalAndSynapse'}"]`);
        if (!authorLink) continue;
        
        results.push({ tweet_id, content, datetime });
      }
      
      return results;
    }, limit, username);
    
    console.log(`[RECONCILE] ✅ Found ${tweets.length} tweets on profile`);
    
      return tweets.map(t => ({
        tweet_id: t.tweet_id,
        content: t.content,
        posted_at: t.datetime ? new Date(t.datetime) : new Date()
      }));
    
  } catch (error: any) {
    console.error(`[RECONCILE] ❌ Profile scrape failed: ${error.message}`);
    return [];
  } finally {
    await pool.releasePage(page);
  }
}

/**
 * Calculate content hash for matching
 */
function hashContent(content: string): string {
  return createHash('md5').update(content.trim().toLowerCase()).digest('hex');
}

/**
 * Check if content matches (fuzzy match for threads)
 */
function contentMatches(dbContent: string, tweetContent: string, decisionType: string): boolean {
  const dbHash = hashContent(dbContent);
  const tweetHash = hashContent(tweetContent);
  
  // Exact match
  if (dbHash === tweetHash) return true;
  
  // For threads, check if any part matches
  if (decisionType === 'thread') {
    try {
      const parts = JSON.parse(dbContent);
      if (Array.isArray(parts)) {
        return parts.some(part => hashContent(part) === tweetHash);
      }
    } catch {
      // Not JSON, treat as single string
    }
  }
  
  // Fuzzy match: check if tweet content contains significant portion of DB content
  const dbWords = dbContent.trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const tweetWords = tweetContent.trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  if (dbWords.length === 0) return false;
  
  const matchingWords = dbWords.filter(w => tweetWords.includes(w));
  const matchRatio = matchingWords.length / dbWords.length;
  
  return matchRatio >= 0.7; // 70% word overlap
}

/**
 * Reconcile a single stuck attempt
 */
async function reconcileAttempt(attempt: StuckAttempt, profileTweets: ProfileTweet[]): Promise<void> {
  const supabase = getSupabaseClient();
  const attemptTime = new Date(attempt.created_at);
  const timeWindowStart = new Date(attemptTime.getTime() - 10 * 60 * 1000); // -10 min
  const timeWindowEnd = new Date(attemptTime.getTime() + 10 * 60 * 1000); // +10 min
  
  console.log(`[RECONCILE] 🔍 Checking decision_id=${attempt.decision_id}`);
  console.log(`[RECONCILE]   Content: "${attempt.content.substring(0, 60)}..."`);
  console.log(`[RECONCILE]   Time window: ${timeWindowStart.toISOString()} to ${timeWindowEnd.toISOString()}`);
  
  // Find matching tweet in profile tweets
  let matchedTweet: ProfileTweet | null = null;
  
  for (const tweet of profileTweets) {
    // Check time window
    if (tweet.posted_at < timeWindowStart || tweet.posted_at > timeWindowEnd) {
      continue;
    }
    
    // Check content match
    if (contentMatches(attempt.content, tweet.content, attempt.decision_type)) {
      matchedTweet = tweet;
      break;
    }
  }
  
  if (matchedTweet) {
    // Tweet found! Update to posted
    console.log(`[RECONCILE] ✅ MATCH FOUND: tweet_id=${matchedTweet.tweet_id}`);
    
    const { error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'posted',
        tweet_id: matchedTweet.tweet_id,
        posted_at: matchedTweet.posted_at.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('decision_id', attempt.decision_id);
    
    if (error) {
      console.error(`[RECONCILE] ❌ Update failed: ${error.message}`);
      throw error;
    }
    
    // Log system event
    await supabase.from('system_events').insert({
      event_type: 'posting_attempt_reconciled',
      severity: 'info',
      message: `Reconciled stuck posting attempt: found tweet_id=${matchedTweet.tweet_id}`,
      event_data: {
        decision_id: attempt.decision_id,
        tweet_id: matchedTweet.tweet_id,
        age_minutes: Math.round((Date.now() - attemptTime.getTime()) / 60000),
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[RECONCILE] ✅ Updated to status='posted'`);
  } else {
    // Tweet not found - mark as failed
    console.log(`[RECONCILE] ❌ NO MATCH: Tweet not found on profile`);
    
    const { error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'failed',
        skip_reason: 'posting_timeout_reconciled',
        updated_at: new Date().toISOString(),
      })
      .eq('decision_id', attempt.decision_id);
    
    if (error) {
      console.error(`[RECONCILE] ❌ Update failed: ${error.message}`);
      throw error;
    }
    
    // Log system event
    await supabase.from('system_events').insert({
      event_type: 'posting_attempt_failed',
      severity: 'warning',
      message: `Reconciled stuck posting attempt: tweet not found, marked as failed`,
      event_data: {
        decision_id: attempt.decision_id,
        age_minutes: Math.round((Date.now() - attemptTime.getTime()) / 60000),
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[RECONCILE] ✅ Updated to status='failed'`);
  }
}

/**
 * Main reconciliation function
 */
export async function reconcilePostingAttempts(): Promise<void> {
  const supabase = getSupabaseClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  console.log(`[RECONCILE] 🔄 Starting reconciliation...`);
  console.log(`[RECONCILE]   Looking for attempts older than: ${fiveMinutesAgo}`);
  
  // Find stuck attempts
  const { data: stuckAttempts, error: fetchError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, content, created_at, decision_type')
    .eq('status', 'posting_attempt')
    .lt('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    console.error(`[RECONCILE] ❌ Failed to fetch stuck attempts: ${fetchError.message}`);
    throw fetchError;
  }
  
  if (!stuckAttempts || stuckAttempts.length === 0) {
    console.log(`[RECONCILE] ✅ No stuck attempts found`);
    return;
  }
  
  console.log(`[RECONCILE] 📊 Found ${stuckAttempts.length} stuck attempts`);
  
  // Scrape profile once for all attempts
  const profileTweets = await scrapeOwnProfileTweets(30);
  
  if (profileTweets.length === 0) {
    console.error(`[RECONCILE] ⚠️ Could not scrape profile - marking all as failed`);
    
    // Mark all as failed if we can't scrape
    for (const attempt of stuckAttempts) {
      await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          status: 'failed',
          skip_reason: 'posting_timeout_profile_scrape_failed',
          updated_at: new Date().toISOString(),
        })
        .eq('decision_id', attempt.decision_id);
    }
    
    return;
  }
  
  // Reconcile each attempt
  let reconciled = 0;
  let failed = 0;
  
  for (const attempt of stuckAttempts) {
    try {
      await reconcileAttempt(attempt as StuckAttempt, profileTweets);
      reconciled++;
    } catch (error: any) {
      console.error(`[RECONCILE] ❌ Failed to reconcile ${attempt.decision_id}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`[RECONCILE] 🎉 Complete: ${reconciled} reconciled, ${failed} failed`);
}

// Run if called directly
if (require.main === module) {
  reconcilePostingAttempts()
    .then(() => {
      console.log('[RECONCILE] ✅ Reconciliation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[RECONCILE] ❌ Reconciliation failed:', error);
      process.exit(1);
    });
}

