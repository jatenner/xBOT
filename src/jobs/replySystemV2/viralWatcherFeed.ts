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
 * Fetch viral health tweets (BOUNDED: 1 query per run)
 */
export async function fetchViralWatcherFeed(): Promise<ViralTweet[]> {
  const startTime = Date.now();
  const SOURCE_TIMEOUT_MS = 90 * 1000; // 90 seconds per source
  
  console.log('[VIRAL_FEED] 🔥 Fetching viral health tweets (bounded: 1 query/run)...');
  
  const supabase = getSupabaseClient();
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: ViralTweet[] = [];
  
  // 🔒 MANDATE 1: Get cursor (alternate between trending and quote tweets)
  const { data: cursor } = await supabase
    .from('feed_cursors')
    .select('cursor_value, metadata')
    .eq('feed_name', 'viral_watcher')
    .single();
  
  const cursorValue = cursor?.cursor_value || '0';
  const queryType = cursorValue === '0' ? 'trending' : 'quote'; // Alternate
  const nextCursorValue = cursorValue === '0' ? '1' : '0';
  
  console.log(`[VIRAL_FEED] 📍 Query type: ${queryType} (cursor: ${cursorValue})`);
  
  // 🔒 MANDATE 2: Per-source timebox (90s)
  const sourceTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Viral feed timeout after ${SOURCE_TIMEOUT_MS / 1000}s`));
    }, SOURCE_TIMEOUT_MS);
  });
  
  const fetchPromise = (async () => {
    let browserAcquireMs = 0;
    let navigationMs = 0;
    let extractionMs = 0;
    let dbWriteMs = 0;
    
    // Execute one query based on cursor
    if (queryType === 'trending') {
      const browserStart = Date.now();
      const trendingTweets = await fetchTrendingTweets(pool);
      browserAcquireMs += Date.now() - browserStart;
      tweets.push(...trendingTweets);
    } else {
      const browserStart = Date.now();
      const quoteTweets = await fetchQuoteTweets(pool);
      browserAcquireMs += Date.now() - browserStart;
      tweets.push(...quoteTweets);
    }
    
    // Update cursor for next run
    await supabase
      .from('feed_cursors')
      .upsert({
        feed_name: 'viral_watcher',
        cursor_value: nextCursorValue,
        last_updated_at: new Date().toISOString(),
        metadata: { queries_per_run: 1 },
      });
    
    return { tweets, timings: { browserAcquireMs, navigationMs, extractionMs, dbWriteMs } };
  })();
  
  try {
    const result = await Promise.race([fetchPromise, sourceTimeoutPromise]);
    const duration = Date.now() - startTime;
    
    // 🔒 MANDATE 4: Log diagnostics
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_feed_source_completed',
      severity: 'info',
      message: `Viral feed completed: ${result.tweets.length} tweets in ${duration}ms`,
      event_data: {
        feed_name: 'viral_watcher',
        tweets_fetched: result.tweets.length,
        query_type: queryType,
        cursor_value: cursorValue,
        next_cursor_value: nextCursorValue,
        duration_ms: duration,
        timings: result.timings,
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[VIRAL_FEED] ✅ Fetched ${result.tweets.length} viral tweets (${duration}ms)`);
    return result.tweets;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[VIRAL_FEED] ⏱️ Timeout or error: ${error.message} (${duration}ms)`);
    
    // Log timeout
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_feed_source_timeout',
      severity: 'warning',
      message: `Viral feed timeout: ${error.message}`,
      event_data: {
        feed_name: 'viral_watcher',
        tweets_fetched: tweets.length,
        query_type: queryType,
        cursor_value: cursorValue,
        duration_ms: duration,
        error: error.message,
      },
      created_at: new Date().toISOString(),
    });
    
    // Return partial results
    return tweets;
  }
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

