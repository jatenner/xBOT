/**
 * 📊 ENGAGEMENT RATE CALCULATOR
 * 
 * Calculates REAL engagement rates for discovered accounts by scraping their recent tweets
 * 
 * Engagement Rate = (avg_tweet_likes / follower_count)
 * 
 * This fixes the placeholder 0.02 values with actual data
 */

import { getSupabaseClient } from '../db';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { withBrowserLock, BrowserPriority } from '../browser/BrowserSemaphore';

interface TweetMetrics {
  likes: number;
  replies: number;
  retweets: number;
  timestamp: number;
}

export async function calculateEngagementRates(): Promise<void> {
  console.log('[ENGAGEMENT_CALC] 📊 Starting engagement rate calculation...');
  
  const supabase = getSupabaseClient();
  
  // Get accounts that need engagement rate calculation
  // Priority: accounts with NULL or placeholder (0.02) engagement_rate
  const { data: accounts, error } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, engagement_rate')
    .or('engagement_rate.is.null,engagement_rate.eq.0.02')
    .gte('follower_count', 200000)  // Only calculate for 200k+ accounts (target accounts)
    .order('follower_count', { ascending: false })
    .limit(50); // Process 50 accounts per run (to avoid timeouts)
  
  if (error || !accounts || accounts.length === 0) {
    console.log('[ENGAGEMENT_CALC] ℹ️ No accounts need calculation');
    return;
  }
  
  console.log(`[ENGAGEMENT_CALC] 📋 Found ${accounts.length} accounts to calculate`);
  
  const pool = UnifiedBrowserPool.getInstance();
  let calculated = 0;
  let failed = 0;
  
  for (const account of accounts) {
    try {
      console.log(`[ENGAGEMENT_CALC] 🔍 Calculating @${account.username} (${account.follower_count?.toLocaleString()} followers)...`);
      
      const engagementRate = await withBrowserLock(
        `engagement_calc_${account.username}`,
        BrowserPriority.HARVESTING,
        async () => {
          return await calculateAccountEngagementRate(
            String(account.username), 
            Number(account.follower_count) || 0
          );
        }
      );
      
      if (engagementRate !== null) {
        // Update account with real engagement rate
        const { error: updateError } = await supabase
          .from('discovered_accounts')
          .update({
            engagement_rate: engagementRate,
            last_updated: new Date().toISOString()
          })
          .eq('username', account.username);
        
        if (updateError) {
          console.error(`[ENGAGEMENT_CALC] ❌ Failed to update @${account.username}:`, updateError.message);
          failed++;
        } else {
          console.log(`[ENGAGEMENT_CALC] ✅ @${account.username}: ${(engagementRate * 100).toFixed(2)}% engagement`);
          calculated++;
        }
      } else {
        console.warn(`[ENGAGEMENT_CALC] ⚠️ Could not calculate @${account.username} - skipping`);
        failed++;
      }
      
      // Rate limit: wait 3 seconds between accounts
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error: any) {
      console.error(`[ENGAGEMENT_CALC] ❌ Error calculating @${account.username}:`, error.message);
      failed++;
    }
  }
  
  console.log(`[ENGAGEMENT_CALC] ✅ Complete: ${calculated} calculated, ${failed} failed`);
}

/**
 * Calculate engagement rate for a single account
 */
async function calculateAccountEngagementRate(
  username: string,
  followerCount: number
): Promise<number | null> {
  if (followerCount === 0) {
    return null; // Can't calculate without follower count
  }
  
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('engagement_calc');
  
  try {
    // Navigate to account timeline
    await page.goto(`https://x.com/${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    // Extract recent tweets with engagement metrics
    const tweetMetrics: TweetMetrics[] = await page.evaluate(() => {
      const results: TweetMetrics[] = [];
      const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      
      // Sample up to 10 recent tweets
      for (let i = 0; i < Math.min(tweetElements.length, 10); i++) {
        const tweet = tweetElements[i];
        
        // Get tweet timestamp
        const timeEl = tweet.querySelector('time');
        const datetime = timeEl?.getAttribute('datetime') || '';
        if (!datetime) continue;
        
        const timestamp = new Date(datetime).getTime();
        
        // Only include tweets from last 7 days (recent engagement)
        const ageMs = Date.now() - timestamp;
        if (ageMs > 7 * 24 * 60 * 60 * 1000) continue;
        
        // Extract engagement metrics
        const likeEl = tweet.querySelector('[data-testid="like"]') || 
                      tweet.querySelector('[aria-label*="like"]');
        const replyEl = tweet.querySelector('[data-testid="reply"]') || 
                       tweet.querySelector('[aria-label*="repl"]');
        const retweetEl = tweet.querySelector('[data-testid="retweet"]') || 
                         tweet.querySelector('[aria-label*="repost"]');
        
        const parseNumber = (text: string): number => {
          if (!text || text === '0') return 0;
          const clean = text.toLowerCase().replace(/[^\d.kmb]/g, '');
          if (clean.includes('k')) return parseFloat(clean) * 1000;
          if (clean.includes('m')) return parseFloat(clean) * 1000000;
          if (clean.includes('b')) return parseFloat(clean) * 1000000000;
          return parseFloat(clean) || 0;
        };
        
        const likes = parseNumber(likeEl?.textContent || '0');
        const replies = parseNumber(replyEl?.textContent || '0');
        const retweets = parseNumber(retweetEl?.textContent || '0');
        
        if (likes > 0 || replies > 0 || retweets > 0) {
          results.push({ likes, replies, retweets, timestamp });
        }
      }
      
      return results;
    });
    
    if (tweetMetrics.length === 0) {
      console.warn(`[ENGAGEMENT_CALC] ⚠️ No recent tweets found for @${username}`);
      return null;
    }
    
    // Calculate average likes per tweet
    const avgLikes = tweetMetrics.reduce((sum, t) => sum + t.likes, 0) / tweetMetrics.length;
    
    // Engagement rate = avg_likes / follower_count
    const engagementRate = avgLikes / followerCount;
    
    console.log(`[ENGAGEMENT_CALC] 📊 @${username}: ${tweetMetrics.length} tweets sampled, ${avgLikes.toFixed(0)} avg likes, ${(engagementRate * 100).toFixed(3)}% engagement`);
    
    return engagementRate;
    
  } catch (error: any) {
    console.error(`[ENGAGEMENT_CALC] ❌ Error scraping @${username}:`, error.message);
    return null;
  } finally {
    await pool.releasePage(page);
  }
}

/**
 * Calculate engagement rates for a batch of accounts (can be called from scheduler)
 */
export async function calculateEngagementRatesBatch(batchSize: number = 20): Promise<void> {
  console.log(`[ENGAGEMENT_CALC] 📊 Starting batch calculation (${batchSize} accounts)...`);
  
  const supabase = getSupabaseClient();
  
  // Get accounts that need calculation
  const { data: accounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count')
    .or('engagement_rate.is.null,engagement_rate.eq.0.02')
    .gte('follower_count', 200000)
    .order('follower_count', { ascending: false })
    .limit(batchSize);
  
  if (!accounts || accounts.length === 0) {
    console.log('[ENGAGEMENT_CALC] ℹ️ No accounts need calculation');
    return;
  }
  
  console.log(`[ENGAGEMENT_CALC] 📋 Processing ${accounts.length} accounts...`);
  
  for (const account of accounts) {
    try {
      const engagementRate = await calculateAccountEngagementRate(
        String(account.username),
        Number(account.follower_count) || 0
      );
      
      if (engagementRate !== null) {
        await supabase
          .from('discovered_accounts')
          .update({
            engagement_rate: engagementRate,
            last_updated: new Date().toISOString()
          })
          .eq('username', account.username);
        
        console.log(`[ENGAGEMENT_CALC] ✅ @${account.username}: ${(engagementRate * 100).toFixed(2)}%`);
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error: any) {
      console.error(`[ENGAGEMENT_CALC] ❌ @${account.username}:`, error.message);
    }
  }
  
  console.log('[ENGAGEMENT_CALC] ✅ Batch complete');
}

