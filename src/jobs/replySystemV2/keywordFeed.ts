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
    const { getSupabaseClient } = await import('../../db/index');
    const supabase = getSupabaseClient();
    
    try {
      // Search URL
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
      console.log(`[KEYWORD_FEED] 🔍 Searching for: ${keyword}`);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Let results load
      
      // Handle consent wall if present - STRONGER APPROACH
      let consentCleared = false;
      let clickAttempted = 0;
      let matchedSelector = null;
      const containersBefore = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      try {
        const strategies = [
          { name: 'getByText Accept all cookies', fn: async () => {
            const acceptButton = page.getByText('Accept all cookies', { exact: false }).first();
            if (await acceptButton.isVisible({ timeout: 2000 })) {
              await acceptButton.click();
              return true;
            }
          }},
          { name: 'getByText Accept', fn: async () => {
            const acceptButton = page.getByText('Accept', { exact: false }).first();
            if (await acceptButton.isVisible({ timeout: 2000 })) {
              await acceptButton.click();
              return true;
            }
          }},
          { name: 'getByRole button accept', fn: async () => {
            const acceptButton = page.getByRole('button', { name: /accept/i }).first();
            if (await acceptButton.isVisible({ timeout: 2000 })) {
              await acceptButton.click();
              return true;
            }
          }},
          { name: 'locator button filter accept', fn: async () => {
            const acceptButton = page.locator('button').filter({ hasText: /accept/i }).first();
            if (await acceptButton.isVisible({ timeout: 2000 })) {
              await acceptButton.click();
              return true;
            }
          }},
          { name: 'iframe accept button', fn: async () => {
            const iframes = await page.locator('iframe').all();
            for (const iframe of iframes) {
              try {
                const frame = await iframe.contentFrame();
                if (frame) {
                  const acceptButton = frame.getByText(/accept/i).first();
                  if (await acceptButton.isVisible({ timeout: 1000 })) {
                    await acceptButton.click();
                    return true;
                  }
                }
              } catch (e) {}
            }
          }},
          { name: 'keyboard TAB+ENTER', fn: async () => {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);
            const focused = await page.evaluate(() => {
              const active = document.activeElement;
              return active?.textContent?.toLowerCase().includes('accept') || false;
            });
            if (focused) {
              await page.keyboard.press('Enter');
              return true;
            }
          }},
          { name: 'escape key', fn: async () => {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            return true;
          }},
        ];
        
        for (const strategy of strategies) {
          try {
            clickAttempted++;
            const clicked = await strategy.fn();
            if (clicked) {
              matchedSelector = strategy.name;
              console.log(`[KEYWORD_FEED] 🍪 Clicked consent button via: ${strategy.name}`);
              
              await page.waitForFunction(
                () => {
                  const overlays = document.querySelectorAll('[role="dialog"], [data-testid*="cookie"], [aria-label*="cookie"]');
                  return overlays.length === 0;
                },
                { timeout: 5000 }
              ).catch(() => {});
              
              await page.waitForTimeout(2000);
              
              const containersAfter = await page.evaluate(() => {
                return document.querySelectorAll('article[data-testid="tweet"]').length;
              });
              
              if (containersAfter > containersBefore) {
                consentCleared = true;
                console.log(`[KEYWORD_FEED] ✅ Consent cleared: ${containersBefore} -> ${containersAfter} containers`);
                break;
              }
            }
          } catch (e) {}
        }
      } catch (e) {
        console.log(`[KEYWORD_FEED] ⚠️ Consent handling failed: ${(e as Error).message}`);
      }
      
      const containersAfter = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_consent_handling',
        severity: 'info',
        message: `Consent handling for keyword: ${keyword}`,
        event_data: {
          keyword,
          click_attempted: clickAttempted,
          matched_selector: matchedSelector,
          containers_before: containersBefore,
          containers_after: containersAfter,
          consent_cleared: consentCleared,
        },
        created_at: new Date().toISOString(),
      });
      
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
      
      console.log(`[KEYWORD_FEED] 🔍 Diagnostics for "${keyword}":`, diagnostics);
      
      // Log diagnostics
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_diagnostics',
        severity: 'info',
        message: `Feed diagnostics for keyword: ${keyword}`,
        event_data: {
          keyword,
          url: searchUrl,
          ...diagnostics,
        },
        created_at: new Date().toISOString(),
      });
      
      // Update diagnostics with containers_after
      diagnostics.tweet_containers_found = containersAfter;
      
      // If consent wall still detected after handling AND no containers found
      if (diagnostics.wall_detected && diagnostics.wall_type === 'consent' && !consentCleared && containersAfter === 0) {
        console.warn(`[KEYWORD_FEED] ⚠️ Consent wall still blocking "${keyword}" after ${clickAttempted} attempts`);
        
        const screenshotPath = `/tmp/feed_consent_failed_keyword_${keyword}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[KEYWORD_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_feed_consent_failed',
          severity: 'warning',
          message: `Consent wall failed to clear for keyword: ${keyword}`,
          event_data: {
            keyword,
            screenshot_path: screenshotPath,
            containers_before: containersBefore,
            containers_after: containersAfter,
            click_attempted: clickAttempted,
          },
          created_at: new Date().toISOString(),
        });
        
        return [];
      }
      
      // If other wall detected AND no containers, return empty
      if (diagnostics.wall_detected && diagnostics.wall_type !== 'consent' && containersAfter === 0) {
        console.warn(`[KEYWORD_FEED] ⚠️ Wall detected for "${keyword}": ${diagnostics.wall_type}`);
        
        const screenshotPath = `/tmp/feed_wall_keyword_${keyword}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[KEYWORD_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        
        return [];
      }
      
      // Wait for tweets to appear (if not already found)
      if (containersAfter === 0) {
        try {
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        } catch (e) {
          console.warn(`[KEYWORD_FEED] ⚠️ No tweets found for "${keyword}" (selector timeout)`);
          
          const screenshotPath = `/tmp/feed_no_tweets_keyword_${keyword}_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`[KEYWORD_FEED] 📸 Screenshot saved: ${screenshotPath}`);
          
          return [];
        }
      }
      
      // Scroll to load more tweets
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
      
      // Extract tweets (even if consent wall was detected but containers exist)
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
          
          // Extract content - ROBUST: Join spans, normalize whitespace
          const tweetTextContainer = article.querySelector('[data-testid="tweetText"]');
          let content = '';
          if (tweetTextContainer) {
            // Get all text nodes and spans within the container
            const spans = tweetTextContainer.querySelectorAll('span');
            const textParts: string[] = [];
            spans.forEach(span => {
              const text = span.textContent?.trim();
              if (text && text.length > 0) {
                textParts.push(text);
              }
            });
            // Fallback to direct textContent if no spans found
            if (textParts.length === 0) {
              content = tweetTextContainer.textContent?.trim() || '';
            } else {
              // Join spans and normalize whitespace
              content = textParts.join(' ').replace(/\s+/g, ' ').trim();
            }
          }
          
          // Skip replies on search results (detect "Replying to" indicator)
          const socialContext = article.querySelector('[data-testid="socialContext"]');
          const hasReplyIndicator = socialContext ? 
            /Replying to/i.test(socialContext.textContent || '') : false;
          
          if (hasReplyIndicator) {
            continue; // Skip replies in search results
          }
          
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
      
      // Log extraction results
      const extractedTweetIds = tweets.map(t => t.tweet_id);
      console.log(`[KEYWORD_FEED] ✅ "${keyword}": fetched ${tweets.length} tweets, extracted ${extractedTweetIds.length} IDs`);
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_extraction',
        severity: 'info',
        message: `Tweet extraction for keyword: ${keyword}`,
        event_data: {
          keyword,
          tweet_containers_found: diagnostics.tweet_containers_found,
          extracted_tweet_ids_count: extractedTweetIds.length,
          extracted_tweet_ids: extractedTweetIds.slice(0, 5),
        },
        created_at: new Date().toISOString(),
      });
      
      return tweets;
    } catch (error: any) {
      console.error(`[KEYWORD_FEED] ❌ Error fetching "${keyword}": ${error.message}`);
      return [];
    } finally {
      await page.close();
    }
  }, 0); // High priority - feeds are critical for system operation
}

