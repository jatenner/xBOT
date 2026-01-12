/**
 * 📊 ENGAGEMENT TRACKER
 * 
 * Fetches engagement metrics after 24h and stores in reply_decisions
 */

import { getSupabaseClient } from '../../db';
import { UnifiedBrowserPool } from '../../browser/UnifiedBrowserPool';

/**
 * Fetch engagement metrics for a posted reply tweet
 */
export async function fetchReplyEngagement(
  replyTweetId: string
): Promise<{
  likes: number;
  replies: number;
  retweets: number;
  views: number;
} | null> {
  try {
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('engagement_fetch');
    
    try {
      const tweetUrl = `https://x.com/i/web/status/${replyTweetId}`;
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000); // Let page load
      
      // Extract metrics from page (Twitter's structure)
      const metrics = await page.evaluate(() => {
        // Look for engagement metrics in various possible locations
        const likesEl = document.querySelector('[data-testid="like"]') || 
                       document.querySelector('a[href*="/like"]') ||
                       document.querySelector('[aria-label*="like" i]');
        const repliesEl = document.querySelector('[data-testid="reply"]') ||
                         document.querySelector('a[href*="/reply"]') ||
                         document.querySelector('[aria-label*="reply" i]');
        const retweetsEl = document.querySelector('[data-testid="retweet"]') ||
                          document.querySelector('a[href*="/retweet"]') ||
                          document.querySelector('[aria-label*="retweet" i]');
        const viewsEl = document.querySelector('[data-testid="app-text-transition-container"]') ||
                       document.querySelector('span:contains("Views")');
        
        const extractNumber = (el: Element | null): number => {
          if (!el) return 0;
          const text = el.textContent || '';
          const match = text.match(/([\d,]+)/);
          if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10);
          }
          return 0;
        };
        
        return {
          likes: extractNumber(likesEl),
          replies: extractNumber(repliesEl),
          retweets: extractNumber(retweetsEl),
          views: extractNumber(viewsEl),
        };
      });
      
      return metrics;
    } finally {
      await pool.releasePage(page);
    }
  } catch (error: any) {
    console.warn(`[ENGAGEMENT_TRACKER] ⚠️ Failed to fetch engagement for ${replyTweetId}: ${error.message}`);
    return null;
  }
}

/**
 * Update reply_decisions with 24h engagement metrics
 */
export async function updateReplyEngagement(
  postedReplyTweetId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Find the reply_decision record for this posted tweet
  const { data: decision } = await supabase
    .from('reply_decisions')
    .select('id, posted_reply_tweet_id, created_at')
    .eq('posted_reply_tweet_id', postedReplyTweetId)
    .maybeSingle();
  
  if (!decision) {
    console.warn(`[ENGAGEMENT_TRACKER] ⚠️ No reply_decision found for posted_reply_tweet_id=${postedReplyTweetId}`);
    return;
  }
  
  // Check if already fetched (within last 2 hours)
  const { data: existing } = await supabase
    .from('reply_decisions')
    .select('engagement_fetched_at')
    .eq('id', decision.id)
    .single();
  
  if (existing?.engagement_fetched_at) {
    const fetchedAt = new Date(existing.engagement_fetched_at);
    const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < 2) {
      console.log(`[ENGAGEMENT_TRACKER] ⏭️ Skipping ${postedReplyTweetId} - fetched ${ageHours.toFixed(1)}h ago`);
      return;
    }
  }
  
  // Fetch engagement
  const metrics = await fetchReplyEngagement(postedReplyTweetId);
  
  if (!metrics) {
    console.warn(`[ENGAGEMENT_TRACKER] ⚠️ Could not fetch metrics for ${postedReplyTweetId}`);
    return;
  }
  
  // Update reply_decisions
  const { error } = await supabase
    .from('reply_decisions')
    .update({
      engagement_24h_likes: metrics.likes,
      engagement_24h_replies: metrics.replies,
      engagement_24h_retweets: metrics.retweets,
      engagement_24h_views: metrics.views,
      engagement_fetched_at: new Date().toISOString(),
    })
    .eq('id', decision.id);
  
  if (error) {
    console.error(`[ENGAGEMENT_TRACKER] ❌ Failed to update engagement: ${error.message}`);
  } else {
    console.log(`[ENGAGEMENT_TRACKER] ✅ Updated engagement for ${postedReplyTweetId}: likes=${metrics.likes}, replies=${metrics.replies}, retweets=${metrics.retweets}, views=${metrics.views}`);
  }
}

/**
 * Job to fetch engagement for replies posted 24h+ ago
 */
export async function fetchPendingEngagementMetrics(): Promise<{
  checked: number;
  updated: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();
  
  // Find replies posted 24h+ ago without engagement data
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: pending } = await supabase
    .from('reply_decisions')
    .select('id, posted_reply_tweet_id, created_at')
    .eq('decision', 'ALLOW')
    .not('posted_reply_tweet_id', 'is', null)
    .or(`engagement_fetched_at.is.null,engagement_fetched_at.lt.${twentyFourHoursAgo}`)
    .order('created_at', { ascending: false })
    .limit(10); // Process 10 at a time
  
  if (!pending || pending.length === 0) {
    return { checked: 0, updated: 0, errors: 0 };
  }
  
  let updated = 0;
  let errors = 0;
  
  for (const decision of pending) {
    if (!decision.posted_reply_tweet_id) continue;
    
    try {
      await updateReplyEngagement(decision.posted_reply_tweet_id);
      updated++;
    } catch (error: any) {
      console.error(`[ENGAGEMENT_TRACKER] ❌ Error updating ${decision.posted_reply_tweet_id}: ${error.message}`);
      errors++;
    }
  }
  
  return {
    checked: pending.length,
    updated,
    errors,
  };
}
