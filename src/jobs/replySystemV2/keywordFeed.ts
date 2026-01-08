/**
 * 🔍 KEYWORD FEED
 * 
 * Searches/scrapes for health keywords
 * Pulls every 5-10 min
 */

import { getSupabaseClient } from '../../db/index';
import { UnifiedBrowserPool } from '../../browser/UnifiedBrowserPool';

const HEALTH_KEYWORDS = [
  'creatine', 'protein', 'ozempic', 'cholesterol',
  'zone 2', 'VO2 max', 'sleep', 'cardio', 'strength',
  'metabolism', 'insulin', 'glucose', 'keto', 'fasting',
  'supplements', 'vitamins', 'minerals', 'hydration'
];

const FETCH_INTERVAL_MINUTES = 5;
const TWEETS_PER_KEYWORD = 10; // Top N tweets per keyword

export interface KeywordTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  keyword: string;
}

/**
 * Fetch tweets for health keywords
 */
export async function fetchKeywordFeed(): Promise<KeywordTweet[]> {
  console.log('[KEYWORD_FEED] 🔍 Fetching tweets for health keywords...');
  
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: KeywordTweet[] = [];
  
  // Fetch tweets for each keyword
  for (const keyword of HEALTH_KEYWORDS) {
    try {
      const keywordTweets = await fetchKeywordTweets(keyword, pool);
      tweets.push(...keywordTweets);
      
      // Rate limit: wait between keywords
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`[KEYWORD_FEED] ⚠️ Failed to fetch keyword "${keyword}": ${error.message}`);
    }
  }
  
  console.log(`[KEYWORD_FEED] ✅ Fetched ${tweets.length} tweets for ${HEALTH_KEYWORDS.length} keywords`);
  
  return tweets;
}

/**
 * Fetch tweets for a specific keyword
 */
async function fetchKeywordTweets(keyword: string, pool: UnifiedBrowserPool): Promise<KeywordTweet[]> {
  return await pool.withContext('keyword_feed', async (context) => {
    const page = await context.newPage();
    
    try {
      // Search URL
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
      console.log(`[KEYWORD_FEED] 🔍 Searching for: ${keyword}`);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Let results load
      
      // Wait for tweets to appear
      try {
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
      } catch (e) {
        console.warn(`[KEYWORD_FEED] ⚠️ No tweets found for "${keyword}" (selector timeout)`);
        return [];
      }
      
      // Scroll to load more tweets
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
      
      // Extract tweets
      const tweets = await page.evaluate(({ count, keyword }) => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results: any[] = [];
        
        for (let i = 0; i < Math.min(articles.length, count); i++) {
          const article = articles[i];
          
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
          
          // Extract author
          const authorLink = article.querySelector('a[href^="/"]');
          const author_username = authorLink?.getAttribute('href')?.replace('/', '') || 'unknown';
          
          // Extract metrics
          const likeCount = article.querySelector('[data-testid="like"]')?.textContent?.trim() || '0';
          const replyCount = article.querySelector('[data-testid="reply"]')?.textContent?.trim() || '0';
          const retweetCount = article.querySelector('[data-testid="retweet"]')?.textContent?.trim() || '0';
          
          // Extract timestamp
          const timeElement = article.querySelector('time');
          const posted_at = timeElement?.getAttribute('datetime') || new Date().toISOString();
          
          results.push({
            tweet_id,
            author_username,
            content: content.substring(0, 500),
            posted_at,
            like_count: parseInt(likeCount.replace(/[^\d]/g, '')) || 0,
            reply_count: parseInt(replyCount.replace(/[^\d]/g, '')) || 0,
            retweet_count: parseInt(retweetCount.replace(/[^\d]/g, '')) || 0,
            keyword: keyword,
          });
        }
        
        return results;
      }, { count: TWEETS_PER_KEYWORD, keyword });
      
      console.log(`[KEYWORD_FEED] ✅ "${keyword}": fetched ${tweets.length} tweets`);
      return tweets;
    } catch (error: any) {
      console.error(`[KEYWORD_FEED] ❌ Error fetching "${keyword}": ${error.message}`);
      return [];
    } finally {
      await page.close();
    }
  }, 1); // Low priority
}

