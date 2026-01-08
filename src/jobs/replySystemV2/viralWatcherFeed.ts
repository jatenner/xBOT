/**
 * 🔥 VIRAL WATCHER FEED
 * 
 * Detects trending/viral health tweets and their quote-tweets (root only)
 * Pulls every 5-10 min
 */

import { getSupabaseClient } from '../../db/index';
import { UnifiedBrowserPool } from '../../browser/UnifiedBrowserPool';

const FETCH_INTERVAL_MINUTES = 5;
const VIRAL_THRESHOLD_LIKES = 100; // Minimum likes to be considered viral
const HEALTH_KEYWORDS = [
  'health', 'fitness', 'nutrition', 'wellness', 'exercise',
  'diet', 'supplements', 'cardio', 'strength', 'metabolism'
];

export interface ViralTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string;
  like_count: number;
  reply_count: number;
  retweet_count: number;
  quote_count?: number;
  is_root: boolean;
}

/**
 * Fetch viral health tweets
 */
export async function fetchViralWatcherFeed(): Promise<ViralTweet[]> {
  console.log('[VIRAL_FEED] 🔥 Fetching viral health tweets...');
  
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: ViralTweet[] = [];
  
  // Check trending topics
  try {
    const trendingTweets = await fetchTrendingTweets(pool);
    tweets.push(...trendingTweets);
  } catch (error: any) {
    console.error(`[VIRAL_FEED] ⚠️ Failed to fetch trending: ${error.message}`);
  }
  
  // Check quote tweets for health topics
  try {
    const quoteTweets = await fetchQuoteTweets(pool);
    tweets.push(...quoteTweets);
  } catch (error: any) {
    console.error(`[VIRAL_FEED] ⚠️ Failed to fetch quote tweets: ${error.message}`);
  }
  
  console.log(`[VIRAL_FEED] ✅ Fetched ${tweets.length} viral tweets`);
  
  return tweets;
}

/**
 * Fetch trending tweets (filtered for health keywords)
 */
async function fetchTrendingTweets(pool: UnifiedBrowserPool): Promise<ViralTweet[]> {
  return await pool.withContext('viral_feed', async (context) => {
    const page = await context.newPage();
    
    try {
      await page.goto('https://x.com/explore', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Extract trending tweets
      const tweets = await page.evaluate(({ threshold, keywords }) => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results: any[] = [];
        
        for (const article of articles) {
          // Extract tweet ID
          const tweetLink = article.querySelector('a[href*="/status/"]');
          if (!tweetLink) continue;
          
          const href = tweetLink.getAttribute('href') || '';
          const match = href.match(/\/status\/(\d+)/);
          if (!match) continue;
          
          const tweet_id = match[1];
          
          // Extract content
          const tweetText = article.querySelector('[data-testid="tweetText"]');
          const content = tweetText?.textContent?.trim() || '';
          
          // Check if health-related
          const contentLower = content.toLowerCase();
          const isHealthRelated = keywords.some(kw => contentLower.includes(kw.toLowerCase()));
          if (!isHealthRelated) continue;
          
          // Extract author
          const authorLink = article.querySelector('a[href^="/"]');
          const author_username = authorLink?.getAttribute('href')?.replace('/', '') || 'unknown';
          
          // Extract metrics
          const likeCount = article.querySelector('[data-testid="like"]')?.textContent?.trim() || '0';
          const replyCount = article.querySelector('[data-testid="reply"]')?.textContent?.trim() || '0';
          const retweetCount = article.querySelector('[data-testid="retweet"]')?.textContent?.trim() || '0';
          
          const likes = parseInt(likeCount.replace(/[^\d]/g, '')) || 0;
          if (likes < threshold) continue; // Filter by viral threshold
          
          // Extract timestamp
          const timeElement = article.querySelector('time');
          const posted_at = timeElement?.getAttribute('datetime') || new Date().toISOString();
          
          // Check if root (no "Replying to" indicator)
          const isRoot = !article.querySelector('[data-testid="reply"]')?.textContent?.includes('Replying to');
          
          results.push({
            tweet_id,
            author_username,
            content: content.substring(0, 500),
            posted_at,
            like_count: likes,
            reply_count: parseInt(replyCount.replace(/[^\d]/g, '')) || 0,
            retweet_count: parseInt(retweetCount.replace(/[^\d]/g, '')) || 0,
          is_root: isRoot,
        });
      }
      
      return results;
    }, { threshold: VIRAL_THRESHOLD_LIKES, keywords: HEALTH_KEYWORDS });
      
      return tweets;
    } finally {
      await page.close();
    }
  }, 1); // Low priority
}

/**
 * Fetch quote tweets (root tweets that were quoted)
 */
async function fetchQuoteTweets(pool: UnifiedBrowserPool): Promise<ViralTweet[]> {
  // This would search for quote tweets of health-related content
  // For now, return empty array (can be enhanced later)
  return [];
}

