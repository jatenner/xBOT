/**
 * 🔍 DISCOVERED ACCOUNTS FEED
 * 
 * Fetches tweets from discovered_accounts (10-20% of candidates)
 * Lightweight account discovery integration for Reply System V2
 */

import { getSupabaseClient } from '../../db/index';
import { UnifiedBrowserPool } from '../../browser/UnifiedBrowserPool';
import type { Page } from 'playwright';

export interface DiscoveredTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
}

const ACCOUNTS_PER_RUN = 3; // 10-20% of total candidates (if 15-20 candidates per fetch)
const SOURCE_TIMEOUT_MS = 90 * 1000; // 90 seconds per source

/**
 * Fetch latest tweets from discovered_accounts (BOUNDED: N accounts per run)
 */
export async function fetchDiscoveredAccountsFeed(): Promise<DiscoveredTweet[]> {
  const startTime = Date.now();
  
  console.log(`[DISCOVERED_FEED] 🔍 Fetching tweets from discovered accounts (bounded: ${ACCOUNTS_PER_RUN} accounts/run)...`);
  
  const supabase = getSupabaseClient();
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: DiscoveredTweet[] = [];
  
  // 🔒 TASK 3: Get top discovered accounts (by priority_score or performance_tier)
  // Prioritize accounts with high priority_score and recent activity
  const { data: discoveredAccounts, error: accountsError } = await supabase
    .from('discovered_accounts')
    .select('username, priority_score, performance_tier, last_updated, total_replies_count')
    .order('priority_score', { ascending: false, nullsFirst: false })
    .order('last_updated', { ascending: false, nullsFirst: false }) // Recent activity first
    .limit(ACCOUNTS_PER_RUN * 5); // Get more than needed to account for failures
  
  if (accountsError || !discoveredAccounts || discoveredAccounts.length === 0) {
    console.log(`[DISCOVERED_FEED] ⚠️ No discovered accounts found: ${accountsError?.message || 'empty'}`);
    return [];
  }
  
  // Select accounts for this run (prioritize high priority_score)
  const accountsToFetch = discoveredAccounts.slice(0, ACCOUNTS_PER_RUN);
  
  console.log(`[DISCOVERED_FEED] 📊 Processing ${accountsToFetch.length} discovered accounts`);
  
  // 🔒 MANDATE 2: Per-source timebox (90s)
  const sourceTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Discovered accounts feed timeout after ${SOURCE_TIMEOUT_MS / 1000}s`));
    }, SOURCE_TIMEOUT_MS);
  });
  
  const fetchPromise = (async () => {
    const page = await pool.acquirePage('discovered_accounts_fetch');
    
    try {
      for (const account of accountsToFetch) {
        const accountStartTime = Date.now();
        
        try {
          // Navigate to account profile
          const profileUrl = `https://x.com/${account.username}`;
          await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
          
          // Wait for tweets to load
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }).catch(() => {
            console.warn(`[DISCOVERED_FEED] ⚠️ No tweets found for @${account.username}`);
          });
          
          // Extract latest tweets (root tweets only)
          const accountTweets = await page.evaluate(() => {
            const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 3); // Top 3 tweets
            return tweetElements.map(tweet => {
              // Extract tweet text
              const textElement = tweet.querySelector('[data-testid="tweetText"]');
              const text = textElement?.textContent || '';
              
              // Extract engagement (likes, replies, retweets)
              const likeElement = tweet.querySelector('[data-testid="like"]');
              const replyElement = tweet.querySelector('[data-testid="reply"]');
              const retweetElement = tweet.querySelector('[data-testid="retweet"]');
              
              const likeCount = parseInt(likeElement?.textContent?.replace(/[^\d]/g, '') || '0', 10);
              const replyCount = parseInt(replyElement?.textContent?.replace(/[^\d]/g, '') || '0', 10);
              const retweetCount = parseInt(retweetElement?.textContent?.replace(/[^\d]/g, '') || '0', 10);
              
              // Extract tweet ID from link
              const linkElement = tweet.querySelector('a[href*="/status/"]');
              const href = linkElement?.getAttribute('href') || '';
              const tweetIdMatch = href.match(/\/status\/(\d+)/);
              const tweetId = tweetIdMatch ? tweetIdMatch[1] : '';
              
              // Extract timestamp (relative time, approximate)
              const timeElement = tweet.querySelector('time');
              const timeAttr = timeElement?.getAttribute('datetime');
              const postedAt = timeAttr || new Date().toISOString();
              
              // Check if it's a reply (has "Replying to" text)
              const isReply = tweet.textContent?.includes('Replying to') || false;
              
              return {
                tweet_id: tweetId,
                content: text,
                like_count: likeCount,
                reply_count: replyCount,
                retweet_count: retweetCount,
                posted_at: postedAt,
                is_reply: isReply,
              };
            }).filter(t => t.tweet_id && !t.is_reply); // Only root tweets
          });
          
          // Add author username and convert to DiscoveredTweet format
          for (const tweet of accountTweets) {
            tweets.push({
              tweet_id: tweet.tweet_id,
              author_username: account.username,
              content: tweet.content,
              posted_at: tweet.posted_at,
              like_count: tweet.like_count,
              reply_count: tweet.reply_count,
              retweet_count: tweet.retweet_count,
            });
          }
          
          const accountDuration = Date.now() - accountStartTime;
          console.log(`[DISCOVERED_FEED] ✅ @${account.username}: ${accountTweets.length} tweets (${accountDuration}ms)`);
          
          // Rate limit: wait between accounts
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (accountError: any) {
          console.error(`[DISCOVERED_FEED] ❌ Failed to fetch @${account.username}: ${accountError.message}`);
          // Continue to next account
        }
      }
    } finally {
      await pool.releasePage(page);
    }
    
    return tweets;
  })();
  
  try {
    const result = await Promise.race([fetchPromise, sourceTimeoutPromise]);
    const duration = Date.now() - startTime;
    console.log(`[DISCOVERED_FEED] ✅ Fetched ${result.length} tweets from discovered accounts (${duration}ms)`);
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[DISCOVERED_FEED] ❌ Feed failed after ${duration}ms: ${error.message}`);
    return tweets; // Return partial results
  }
}

