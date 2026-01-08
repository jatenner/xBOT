/**
 * 📋 CURATED ACCOUNTS FEED
 * 
 * Maintains list of 200-500 high-signal health accounts
 * Pulls latest tweets every 5-10 min
 */

import { getSupabaseClient } from '../../db/index';
import { UnifiedBrowserPool } from '../../browser/UnifiedBrowserPool';

const FETCH_INTERVAL_MINUTES = 5;
const TWEETS_PER_ACCOUNT = 2; // Latest N tweets per account (reduced for faster completion)

export interface CuratedTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
}

/**
 * Fetch latest tweets from curated accounts
 */
export async function fetchCuratedAccountsFeed(): Promise<CuratedTweet[]> {
  console.log('[CURATED_FEED] 📋 Fetching tweets from curated accounts...');
  
  const supabase = getSupabaseClient();
  
  // Get enabled curated accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('curated_accounts')
    .select('username, signal_score')
    .eq('enabled', true)
    .order('signal_score', { ascending: false })
    .limit(500); // Top 500 by signal score
  
  if (accountsError || !accounts || accounts.length === 0) {
    console.error(`[CURATED_FEED] ❌ No curated accounts found: ${accountsError?.message}`);
    return [];
  }
  
  console.log(`[CURATED_FEED] ✅ Found ${accounts.length} curated accounts`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: CuratedTweet[] = [];
  
  // Fetch tweets from each account (in batches to avoid rate limits)
  const batchSize = 5; // Reduced batch size to avoid browser crashes
  const MAX_ACCOUNTS_TO_FETCH = 20; // Limit to top 20 accounts initially to avoid browser overload
  
  const accountsToFetch = accounts.slice(0, MAX_ACCOUNTS_TO_FETCH);
  console.log(`[CURATED_FEED] 📊 Fetching from ${accountsToFetch.length} accounts (limited from ${accounts.length} total)`);
  
  for (let i = 0; i < accountsToFetch.length; i += batchSize) {
    const batch = accountsToFetch.slice(i, i + batchSize);
    
    // Process sequentially within batch to avoid browser overload
    for (const account of batch) {
      try {
        const accountTweets = await fetchAccountTweets(account.username, pool);
        tweets.push(...accountTweets);
        
        // Update last_fetched_at
        await supabase
          .from('curated_accounts')
          .update({ last_tweet_fetched_at: new Date().toISOString() })
          .eq('username', account.username);
      } catch (error: any) {
        console.error(`[CURATED_FEED] ⚠️ Failed to fetch ${account.username}: ${error.message}`);
        // Continue with next account
      }
    }
    
    // Rate limit: wait between batches
    if (i + batchSize < accountsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
    }
  }
  
  console.log(`[CURATED_FEED] ✅ Fetched ${tweets.length} tweets from ${accounts.length} accounts`);
  
  return tweets;
}

/**
 * Fetch latest tweets from a specific account
 */
async function fetchAccountTweets(username: string, pool: UnifiedBrowserPool): Promise<CuratedTweet[]> {
  return await pool.withContext('curated_feed', async (context) => {
    const page = await context.newPage();
    const { getSupabaseClient } = await import('../../db/index');
    const supabase = getSupabaseClient();
    
    try {
      const profileUrl = `https://x.com/${username}`;
      console.log(`[CURATED_FEED] 📡 Fetching from @${username}...`);
      
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for timeline to load
      
      // Handle consent wall if present
      try {
        // Try to find and click "Accept all cookies" or similar buttons
        const consentSelectors = [
          'button:has-text("Accept all cookies")',
          'button:has-text("Accept")',
          '[data-testid="cookieConsentAccept"]',
          'button[aria-label*="Accept"]',
        ];
        
        for (const selector of consentSelectors) {
          try {
            const button = await page.locator(selector).first();
            if (await button.isVisible({ timeout: 2000 })) {
              console.log(`[CURATED_FEED] 🍪 Clicking consent button: ${selector}`);
              await button.click();
              await page.waitForTimeout(2000);
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }
      } catch (e) {
        // Consent wall handling failed, continue anyway
      }
      
      // DIAGNOSTICS: Check login status and walls
      const diagnostics = await page.evaluate(() => {
        const hasComposeBox = !!document.querySelector('[data-testid="tweetTextarea_0"]');
        const hasAccountMenu = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
        const bodyText = document.body.textContent || '';
        const hasLoginWall = bodyText.includes('Sign in') ||
                            bodyText.includes('Log in') ||
                            !!document.querySelector('a[href*="/i/flow/login"]');
        const hasConsentWall = bodyText.includes('Accept all cookies') ||
                               bodyText.includes('Cookie');
        const hasErrorWall = bodyText.includes('Something went wrong') ||
                             bodyText.includes('Try again');
        const hasRateLimit = bodyText.includes('rate limit') ||
                            bodyText.includes('Too many requests');
        
        const tweetContainers = document.querySelectorAll('article[data-testid="tweet"]');
        
        return {
          logged_in: hasComposeBox || hasAccountMenu,
          wall_detected: hasLoginWall || hasConsentWall || hasErrorWall || hasRateLimit,
          wall_type: hasLoginWall ? 'login' : hasConsentWall ? 'consent' : hasErrorWall ? 'error' : hasRateLimit ? 'rate_limit' : 'none',
          tweet_containers_found: tweetContainers.length,
        };
      });
      
      console.log(`[CURATED_FEED] 🔍 Diagnostics for @${username}:`, diagnostics);
      
      // Log diagnostics to system_events
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_diagnostics',
        severity: 'info',
        message: `Feed diagnostics for @${username}`,
        event_data: {
          username,
          url: profileUrl,
          ...diagnostics,
        },
        created_at: new Date().toISOString(),
      });
      
      // If consent wall still detected after handling, try to wait and retry
      if (diagnostics.wall_detected && diagnostics.wall_type === 'consent') {
        console.log(`[CURATED_FEED] ⚠️ Consent wall detected for @${username}, waiting and retrying...`);
        await page.waitForTimeout(3000);
        
        // Re-check after wait
        const retryDiagnostics = await page.evaluate(() => {
          const tweetContainers = document.querySelectorAll('article[data-testid="tweet"]');
          return { tweet_containers_found: tweetContainers.length };
        });
        
        if (retryDiagnostics.tweet_containers_found > 0) {
          console.log(`[CURATED_FEED] ✅ Consent wall cleared, found ${retryDiagnostics.tweet_containers_found} tweets`);
          diagnostics.tweet_containers_found = retryDiagnostics.tweet_containers_found;
          diagnostics.wall_detected = false;
        } else {
          console.warn(`[CURATED_FEED] ⚠️ Consent wall still blocking @${username}`);
          return [];
        }
      }
      
      // If other wall detected (login, error, rate limit), return empty
      if (diagnostics.wall_detected && diagnostics.wall_type !== 'consent') {
        console.warn(`[CURATED_FEED] ⚠️ Wall detected for @${username}: ${diagnostics.wall_type}`);
        
        if (diagnostics.tweet_containers_found === 0) {
          const screenshotPath = `/tmp/feed_wall_${username}_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        }
        
        return [];
      }
      
      // Wait for tweets to appear
      try {
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
      } catch (e) {
        console.warn(`[CURATED_FEED] ⚠️ No tweets found for @${username} (selector timeout)`);
        
        // Take screenshot if no tweets found
        if (diagnostics.tweet_containers_found === 0) {
          const screenshotPath = `/tmp/feed_no_tweets_${username}_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        }
        
        return [];
      }
      
      // Scroll to load more tweets
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
      
      // Extract tweets
      const tweets = await page.evaluate((count) => {
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
          
          // Extract metrics
          const likeCount = article.querySelector('[data-testid="like"]')?.textContent?.trim() || '0';
          const replyCount = article.querySelector('[data-testid="reply"]')?.textContent?.trim() || '0';
          const retweetCount = article.querySelector('[data-testid="retweet"]')?.textContent?.trim() || '0';
          
          // Extract timestamp
          const timeElement = article.querySelector('time');
          const posted_at = timeElement?.getAttribute('datetime') || new Date().toISOString();
          
          results.push({
            tweet_id,
            author_username: username,
            content: content.substring(0, 500),
            posted_at,
            like_count: parseInt(likeCount.replace(/[^\d]/g, '')) || 0,
            reply_count: parseInt(replyCount.replace(/[^\d]/g, '')) || 0,
            retweet_count: parseInt(retweetCount.replace(/[^\d]/g, '')) || 0,
          });
        }
        
        return results;
      }, TWEETS_PER_ACCOUNT);
      
      // Log extraction results
      const extractedTweetIds = tweets.map(t => t.tweet_id);
      console.log(`[CURATED_FEED] ✅ @${username}: fetched ${tweets.length} tweets, extracted ${extractedTweetIds.length} IDs`);
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_extraction',
        severity: 'info',
        message: `Tweet extraction for @${username}`,
        event_data: {
          username,
          tweet_containers_found: diagnostics.tweet_containers_found,
          extracted_tweet_ids_count: extractedTweetIds.length,
          extracted_tweet_ids: extractedTweetIds.slice(0, 5), // First 5 IDs
        },
        created_at: new Date().toISOString(),
      });
      
      return tweets;
    } catch (error: any) {
      console.error(`[CURATED_FEED] ❌ Error fetching @${username}: ${error.message}`);
      // Log to system_events
      try {
        const { getSupabaseClient } = await import('../../db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_feed_error',
          severity: 'warning',
          message: `Failed to fetch tweets from @${username}: ${error.message}`,
          event_data: { username, error: error.message },
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        // Ignore logging errors
      }
      return [];
    } finally {
      await page.close();
    }
  }, 1); // Low priority
}

