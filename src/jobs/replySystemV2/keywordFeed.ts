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
const KEYWORDS_PER_RUN = 2; // Hard cap: reduced to 2 keywords per run for faster completion

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
 * Fetch tweets for health keywords (BOUNDED: M keywords per run with cursor rotation)
 */
export async function fetchKeywordFeed(): Promise<KeywordTweet[]> {
  const startTime = Date.now();
  const SOURCE_TIMEOUT_MS = 90 * 1000; // 90 seconds per source
  
  console.log(`[KEYWORD_FEED] 🔍 Fetching tweets for health keywords (bounded: ${KEYWORDS_PER_RUN} keywords/run)...`);
  
  const supabase = getSupabaseClient();
  const pool = UnifiedBrowserPool.getInstance();
  const tweets: KeywordTweet[] = [];
  
  // 🔒 MANDATE 1: Get cursor and rotate
  const { data: cursor } = await supabase
    .from('feed_cursors')
    .select('cursor_value, metadata')
    .eq('feed_name', 'keyword_search')
    .single();
  
  const cursorIndex = parseInt(cursor?.cursor_value || '0', 10);
  const keywordsPerRun = cursor?.metadata?.keywords_per_run || KEYWORDS_PER_RUN;
  
  console.log(`[KEYWORD_FEED] 📍 Cursor position: ${cursorIndex} (processing ${keywordsPerRun} keywords)`);
  
  // Get keywords for this run (rotate via cursor)
  const keywordsToFetch = HEALTH_KEYWORDS.slice(cursorIndex, cursorIndex + keywordsPerRun);
  const nextCursorIndex = (cursorIndex + keywordsPerRun) % HEALTH_KEYWORDS.length;
  
  console.log(`[KEYWORD_FEED] 📊 Processing keywords ${cursorIndex}-${cursorIndex + keywordsPerRun - 1} of ${HEALTH_KEYWORDS.length} total`);
  
  // 🔒 MANDATE 2: Per-source timebox (90s)
  const sourceTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Keyword feed timeout after ${SOURCE_TIMEOUT_MS / 1000}s`));
    }, SOURCE_TIMEOUT_MS);
  });
  
  const fetchPromise = (async () => {
    let browserAcquireMs = 0;
    let navigationMs = 0;
    let extractionMs = 0;
    let dbWriteMs = 0;
    
    // Fetch tweets for each keyword sequentially
    for (const keyword of keywordsToFetch) {
      const keywordStartTime = Date.now();
      
      try {
        const browserStart = Date.now();
        const keywordTweets = await fetchKeywordTweets(keyword, pool);
        browserAcquireMs += Date.now() - browserStart;
        
        tweets.push(...keywordTweets);
        
        const keywordDuration = Date.now() - keywordStartTime;
        console.log(`[KEYWORD_FEED] ✅ "${keyword}": ${keywordTweets.length} tweets (${keywordDuration}ms)`);
        
        // Rate limit: wait between keywords
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.error(`[KEYWORD_FEED] ⚠️ Failed to fetch keyword "${keyword}": ${error.message}`);
        // Continue with next keyword
      }
    }
    
    // Update cursor for next run
    await supabase
      .from('feed_cursors')
      .upsert({
        feed_name: 'keyword_search',
        cursor_value: nextCursorIndex.toString(),
        last_updated_at: new Date().toISOString(),
        metadata: { keywords_per_run: keywordsPerRun },
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
      message: `Keyword feed completed: ${result.tweets.length} tweets in ${duration}ms`,
      event_data: {
        feed_name: 'keyword_search',
        tweets_fetched: result.tweets.length,
        keywords_processed: keywordsToFetch.length,
        cursor_index: cursorIndex,
        next_cursor_index: nextCursorIndex,
        duration_ms: duration,
        timings: result.timings,
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[KEYWORD_FEED] ✅ Fetched ${result.tweets.length} tweets for ${keywordsToFetch.length} keywords (${duration}ms)`);
    return result.tweets;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[KEYWORD_FEED] ⏱️ Timeout or error: ${error.message} (${duration}ms)`);
    
    // Log timeout
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_feed_source_timeout',
      severity: 'warning',
      message: `Keyword feed timeout: ${error.message}`,
      event_data: {
        feed_name: 'keyword_search',
        tweets_fetched: tweets.length,
        keywords_processed: keywordsToFetch.length,
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
 * Fetch tweets for a specific keyword
 */
async function fetchKeywordTweets(keyword: string, pool: UnifiedBrowserPool): Promise<KeywordTweet[]> {
  return await pool.withContext('keyword_feed', async (context) => {
    const page = await context.newPage();
    const { getSupabaseClient } = await import('../../db/index');
    const supabase = getSupabaseClient();
    
    try {
      // 🎯 CENTRALIZED CONSENT HANDLING: Use centralized session manager
      const { ensureConsentAccepted, loadTwitterState } = await import('../../playwright/twitterSession');
      
      // Ensure storageState is loaded for this context (if not already loaded by UnifiedBrowserPool)
      const storageState = await loadTwitterState();
      if (storageState) {
        try {
          await context.addCookies(storageState.cookies);
          console.log(`[KEYWORD_FEED] ✅ Loaded storageState (${storageState.cookies.length} cookies) for keyword: ${keyword}`);
        } catch (cookieError: any) {
          console.warn(`[KEYWORD_FEED] ⚠️ Failed to add cookies: ${cookieError.message}`);
        }
      }
      
      // Search URL
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
      console.log(`[KEYWORD_FEED] 🔍 Searching for: ${keyword}`);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Let results load
      
      // Get initial container count
      const containersBefore = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      // 🎯 CENTRALIZED: Ensure consent is accepted with retry
      const consentResult = await ensureConsentAccepted(page, async () => {
        // Retry navigation after consent acceptance
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
      });
      
      const consentCleared = consentResult.cleared;
      const clickAttempted = consentResult.attempts;
      const matchedSelector = consentResult.matchedSelector || null;
      
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
        
        // 🎯 ANALYTICS: Record CONSENT_WALL deny decision
        const { resolveTweetAncestry, recordReplyDecision } = await import('./replyDecisionRecorder');
        // Create a synthetic tweet ID for consent wall tracking (since no tweets were fetched)
        const consentWallTweetId = `consent_wall_keyword_${keyword}_${Date.now()}`;
        const ancestry = await resolveTweetAncestry(consentWallTweetId).catch(() => ({
          targetTweetId: consentWallTweetId,
          targetInReplyToTweetId: null,
          rootTweetId: null,
          ancestryDepth: null,
          isRoot: false,
          status: 'ERROR' as const,
          confidence: 'LOW' as const,
          method: 'consent_wall_blocked',
        }));
        
        // 🎯 FAILURE DETAILS: Include variant, screenshot, HTML snippet
        const failureDetail = consentResult.variant || consentResult.screenshotPath || consentResult.htmlSnippet
          ? JSON.stringify({
              variant: consentResult.variant,
              screenshotPath: consentResult.screenshotPath,
              htmlSnippet: consentResult.htmlSnippet?.substring(0, 200), // Truncate HTML
              attempts: clickAttempted,
              selectorMatched: matchedSelector,
              keyword: keyword,
            })
          : undefined;
        
        // 🎯 COOLDOWN: Record consent wall for cooldown tracking
        const { getConsentWallCooldown } = await import('../../utils/consentWallCooldown');
        getConsentWallCooldown().recordWall();
        
        await recordReplyDecision({
          target_tweet_id: consentWallTweetId,
          target_in_reply_to_tweet_id: null,
          root_tweet_id: 'null',
          ancestry_depth: -1,
          is_root: false,
          decision: 'DENY',
          reason: `Consent wall blocked feed fetch for keyword: ${keyword} (attempts=${clickAttempted}, selector=${matchedSelector || 'none'}, containers_before=${containersBefore}, containers_after=${containersAfter}${consentResult.variant ? `, variant=${consentResult.variant}` : ''})${failureDetail ? ` [details: ${failureDetail.substring(0, 100)}]` : ''}`,
          deny_reason_code: 'CONSENT_WALL', // 🎯 ANALYTICS: Structured deny reason
          status: ancestry.status,
          confidence: ancestry.confidence,
          method: ancestry.method || 'consent_wall_blocked',
          scored_at: new Date().toISOString(),
          template_status: 'FAILED',
          trace_id: `feed_${Date.now()}`,
          pipeline_source: 'reply_v2_feed_keyword',
        });
        
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
            deny_reason_code: 'CONSENT_WALL',
          },
          created_at: new Date().toISOString(),
        });
        
        console.log(`[KEYWORD_FEED] 🎯 Recorded CONSENT_WALL deny decision for keyword: ${keyword}`);
        
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

