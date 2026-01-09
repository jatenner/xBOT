/**
 * 📋 CURATED ACCOUNTS FEED
 * 
 * Maintains list of 200-500 high-signal health accounts
 * Pulls latest tweets every 5-10 min
 */

import { getSupabaseClient } from '../../db/index';
import { UnifiedBrowserPool } from '../../browser/UnifiedBrowserPool';
import { Page } from 'playwright';

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
 * 🔒 SAFE EVALUATE HELPER
 * Enforces single payload object pattern to prevent scope errors
 */
async function safeEvaluate<T>(
  page: Page,
  fn: (payload: any) => T,
  payload: Record<string, any> = {}
): Promise<T> {
  // Runtime assert: username must exist in payload if used
  if (fn.toString().includes('username') && !payload.username) {
    throw new Error(`safeEvaluate: username required in payload but missing. Payload keys: ${Object.keys(payload).join(', ')}`);
  }
  
  return page.evaluate(fn, payload);
}

/**
 * Fetch latest tweets from curated accounts (BOUNDED: N accounts per run with cursor rotation)
 */
export async function fetchCuratedAccountsFeed(): Promise<CuratedTweet[]> {
  const startTime = Date.now();
  const SOURCE_TIMEOUT_MS = 90 * 1000; // 90 seconds per source
  const ACCOUNTS_PER_RUN = 5; // Hard cap: process only 5 accounts per run
  
  console.log(`[CURATED_FEED] 📋 Fetching tweets from curated accounts (bounded: ${ACCOUNTS_PER_RUN} accounts/run)...`);
  
  const supabase = getSupabaseClient();
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: CuratedTweet[] = [];
  
  // 🔒 MANDATE 1: Get cursor and rotate
  const { data: cursor } = await supabase
    .from('feed_cursors')
    .select('cursor_value, metadata')
    .eq('feed_name', 'curated_accounts')
    .single();
  
  const cursorIndex = parseInt(cursor?.cursor_value || '0', 10);
  const accountsPerRun = cursor?.metadata?.accounts_per_run || ACCOUNTS_PER_RUN;
  
  console.log(`[CURATED_FEED] 📍 Cursor position: ${cursorIndex} (processing ${accountsPerRun} accounts)`);
  
  // Get all enabled accounts (ordered by signal_score)
  const { data: allAccounts, error: accountsError } = await supabase
    .from('curated_accounts')
    .select('username, signal_score')
    .eq('enabled', true)
    .order('signal_score', { ascending: false });
  
  if (accountsError || !allAccounts || allAccounts.length === 0) {
    console.error(`[CURATED_FEED] ❌ No curated accounts found: ${accountsError?.message}`);
    return [];
  }
  
  // Get accounts for this run (rotate via cursor)
  const accountsToFetch = allAccounts.slice(cursorIndex, cursorIndex + accountsPerRun);
  const nextCursorIndex = (cursorIndex + accountsPerRun) % allAccounts.length;
  
  console.log(`[CURATED_FEED] 📊 Processing accounts ${cursorIndex}-${cursorIndex + accountsPerRun - 1} of ${allAccounts.length} total`);
  
  // 🔒 MANDATE 2: Per-source timebox (90s)
  const sourceTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Curated feed timeout after ${SOURCE_TIMEOUT_MS / 1000}s`));
    }, SOURCE_TIMEOUT_MS);
  });
  
  const fetchPromise = (async () => {
    let browserAcquireMs = 0;
    let navigationMs = 0;
    let extractionMs = 0;
    let dbWriteMs = 0;
    
    // Process accounts sequentially (no batching to stay within timebox)
    for (const account of accountsToFetch) {
      const accountStartTime = Date.now();
      
      try {
        // Browser acquire timing
        const browserStart = Date.now();
        const accountTweets = await fetchAccountTweets(account.username, pool);
        browserAcquireMs += Date.now() - browserStart;
        
        tweets.push(...accountTweets);
        
        // DB write timing
        const dbStart = Date.now();
        await supabase
          .from('curated_accounts')
          .update({ last_tweet_fetched_at: new Date().toISOString() })
          .eq('username', account.username);
        dbWriteMs += Date.now() - dbStart;
        
        const accountDuration = Date.now() - accountStartTime;
        console.log(`[CURATED_FEED] ✅ @${account.username}: ${accountTweets.length} tweets (${accountDuration}ms)`);
        
      } catch (error: any) {
        console.error(`[CURATED_FEED] ⚠️ Failed to fetch ${account.username}: ${error.message}`);
        // Continue with next account
      }
    }
    
    // Update cursor for next run
    await supabase
      .from('feed_cursors')
      .upsert({
        feed_name: 'curated_accounts',
        cursor_value: nextCursorIndex.toString(),
        last_updated_at: new Date().toISOString(),
        metadata: { accounts_per_run: accountsPerRun },
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
      message: `Curated feed completed: ${result.tweets.length} tweets in ${duration}ms`,
      event_data: {
        feed_name: 'curated_accounts',
        tweets_fetched: result.tweets.length,
        accounts_processed: accountsToFetch.length,
        cursor_index: cursorIndex,
        next_cursor_index: nextCursorIndex,
        duration_ms: duration,
        timings: result.timings,
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[CURATED_FEED] ✅ Fetched ${result.tweets.length} tweets from ${accountsToFetch.length} accounts (${duration}ms)`);
    return result.tweets;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[CURATED_FEED] ⏱️ Timeout or error: ${error.message} (${duration}ms)`);
    
    // Log timeout
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_feed_source_timeout',
      severity: 'warning',
      message: `Curated feed timeout: ${error.message}`,
      event_data: {
        feed_name: 'curated_accounts',
        tweets_fetched: tweets.length,
        accounts_processed: accountsToFetch.length,
        cursor_index: cursorIndex,
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
 * Fetch latest tweets from a specific account
 */
async function fetchAccountTweets(username: string, pool: UnifiedBrowserPool): Promise<CuratedTweet[]> {
  return await pool.withContext('curated_feed', async (context) => {
    const page = await context.newPage();
    const { getSupabaseClient } = await import('../../db/index');
    const supabase = getSupabaseClient();
    
    let extractedCount = 0;
    const profileUrl = `https://x.com/${username}`;
    const timings = {
      browserAcquireMs: 0,
      navigationMs: 0,
      extractionMs: 0,
      dbWriteMs: 0,
    };
    
    try {
      console.log(`[CURATED_FEED] 📡 Fetching from @${username}...`);
      
      // 🔒 MANDATE 4: Track navigation timing
      const navStart = Date.now();
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for timeline to load
      timings.navigationMs = Date.now() - navStart;
      
      // Handle consent wall if present - STRONGER APPROACH
      let consentCleared = false;
      let clickAttempted = 0;
      let matchedSelector: string | null = null;
      
      // Get initial container count
      const containersBefore = await safeEvaluate(page, () => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      try {
        // Strategy 1: Text-based locators
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
          // Strategy 2: Try iframe
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
              } catch (e) {
                // Try next iframe
              }
            }
          }},
          // Strategy 3: Keyboard interaction
          { name: 'keyboard TAB+ENTER', fn: async () => {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);
            const focused = await safeEvaluate(page, () => {
              const active = document.activeElement;
              return active?.textContent?.toLowerCase().includes('accept') || false;
            });
            if (focused) {
              await page.keyboard.press('Enter');
              return true;
            }
          }},
          // Strategy 4: Escape key to dismiss overlay
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
              console.log(`[CURATED_FEED] 🍪 Clicked consent button via: ${strategy.name}`);
              
              // Wait for overlay to be detached (not just clicked)
              await page.waitForFunction(
                () => {
                  const overlays = document.querySelectorAll('[role="dialog"], [data-testid*="cookie"], [aria-label*="cookie"]');
                  return overlays.length === 0;
                },
                { timeout: 5000 }
              ).catch(() => {
                // Overlay might not have role attributes, continue anyway
              });
              
              await page.waitForTimeout(2000); // Additional wait
              
              // Verify containers increased
              const containersAfter = await safeEvaluate(page, () => {
                return document.querySelectorAll('article[data-testid="tweet"]').length;
              });
              
              if (containersAfter > containersBefore) {
                consentCleared = true;
                console.log(`[CURATED_FEED] ✅ Consent cleared: ${containersBefore} -> ${containersAfter} containers`);
                break;
              }
            }
          } catch (e) {
            // Try next strategy
          }
        }
      } catch (e) {
        console.log(`[CURATED_FEED] ⚠️ Consent handling failed: ${(e as Error).message}`);
      }
      
      // Log consent handling results
      const containersAfter = await safeEvaluate(page, () => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_consent_handling',
        severity: 'info',
        message: `Consent handling for @${username}`,
        event_data: {
          username,
          click_attempted: clickAttempted,
          matched_selector: matchedSelector,
          containers_before: containersBefore,
          containers_after: containersAfter,
          consent_cleared: consentCleared,
        },
        created_at: new Date().toISOString(),
      });
      
      // DIAGNOSTICS: Check login status and walls
      const diagnostics = await safeEvaluate(page, () => {
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
      
      // Update diagnostics with containers_after
      diagnostics.tweet_containers_found = containersAfter;
      
      // If consent wall still detected after handling AND no containers found
      if (diagnostics.wall_detected && diagnostics.wall_type === 'consent' && !consentCleared && containersAfter === 0) {
        console.warn(`[CURATED_FEED] ⚠️ Consent wall still blocking @${username} after ${clickAttempted} attempts`);
        
        const screenshotPath = `/tmp/feed_consent_failed_${username}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_feed_consent_failed',
          severity: 'warning',
          message: `Consent wall failed to clear for @${username}`,
          event_data: {
            username,
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
        console.warn(`[CURATED_FEED] ⚠️ Wall detected for @${username}: ${diagnostics.wall_type}`);
        
        const screenshotPath = `/tmp/feed_wall_${username}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        
        return [];
      }
      
      // Wait for tweets to appear (if not already found)
      if (containersAfter === 0) {
        try {
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        } catch (e) {
          console.warn(`[CURATED_FEED] ⚠️ No tweets found for @${username} (selector timeout)`);
          
          const screenshotPath = `/tmp/feed_no_tweets_${username}_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
          
          return [];
        }
      }
      
      // Scroll to load more tweets
      await safeEvaluate(page, () => {
        window.scrollBy(0, 1000);
      });
      await page.waitForTimeout(2000);
      
      // 🔒 MANDATE 4: Track extraction timing
      const extractStart = Date.now();
      // Extract tweets (FIXED: use single payload object)
      const tweets = await safeEvaluate(page, (payload: { count: number; username: string }) => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results: any[] = [];
        
        for (let i = 0; i < Math.min(articles.length, payload.count); i++) {
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
          
          // Skip replies on profile timelines (detect "Replying to" indicator)
          const socialContext = article.querySelector('[data-testid="socialContext"]');
          const hasReplyIndicator = socialContext ? 
            /Replying to/i.test(socialContext.textContent || '') : false;
          
          if (hasReplyIndicator) {
            continue; // Skip replies on profile timelines
          }
          
          // Extract metrics
          const likeCount = article.querySelector('[data-testid="like"]')?.textContent?.trim() || '0';
          const replyCount = article.querySelector('[data-testid="reply"]')?.textContent?.trim() || '0';
          const retweetCount = article.querySelector('[data-testid="retweet"]')?.textContent?.trim() || '0';
          
          // Extract timestamp
          const timeElement = article.querySelector('time');
          const posted_at = timeElement?.getAttribute('datetime') || new Date().toISOString();
          
          results.push({
            tweet_id,
            author_username: payload.username,
            content: content.substring(0, 500),
            posted_at,
            like_count: parseInt(likeCount.replace(/[^\d]/g, '')) || 0,
            reply_count: parseInt(replyCount.replace(/[^\d]/g, '')) || 0,
            retweet_count: parseInt(retweetCount.replace(/[^\d]/g, '')) || 0,
          });
        }
        
        return results;
      }, { count: TWEETS_PER_ACCOUNT, username });
      
      timings.extractionMs = Date.now() - extractStart;
      extractedCount = tweets.length;
      
      // 🔒 MANDATE 4: Log extraction results with timings
      const extractedTweetIds = tweets.map(t => t.tweet_id);
      console.log(`[CURATED_FEED] ✅ @${username}: fetched ${tweets.length} tweets, extracted ${extractedTweetIds.length} IDs`);
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_extraction',
        severity: 'info',
        message: `Tweet extraction for @${username}`,
        event_data: {
          username,
          url: profileUrl,
          tweet_containers_found: diagnostics.tweet_containers_found,
          extracted_tweet_ids_count: extractedTweetIds.length,
          extracted_tweet_ids: extractedTweetIds.slice(0, 5), // First 5 IDs
          timings: {
            browser_acquire_ms: timings.browserAcquireMs,
            navigation_ms: timings.navigationMs,
            extraction_ms: timings.extractionMs,
            db_write_ms: timings.dbWriteMs,
          },
        },
        created_at: new Date().toISOString(),
      });
      
      return tweets;
    } catch (error: any) {
      console.error(`[CURATED_FEED] ❌ Error fetching @${username}: ${error.message}`);
      console.error(`[CURATED_FEED] 📊 Account stats: url=${profileUrl}, extracted=${extractedCount}`);
      
      // Log to system_events
      try {
        const { getSupabaseClient } = await import('../../db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_feed_error',
          severity: 'warning',
          message: `Failed to fetch tweets from @${username}: ${error.message}`,
          event_data: { 
            username, 
            url: profileUrl,
            extracted_count: extractedCount,
            error: error.message,
            stack: error.stack?.substring(0, 500),
          },
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        // Ignore logging errors
      }
      return [];
    } finally {
      await page.close();
    }
  }, 0); // High priority - feeds are critical for system operation
}
