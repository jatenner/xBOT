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
  const ACCOUNTS_PER_RUN = 8; // Increased: more fresh candidates per run to keep reply queue fresh
  
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
  
  // Get enabled accounts, prioritized by staleness (least recently fetched first)
  // This ensures we check accounts most likely to have NEW tweets
  const { data: allAccounts, error: accountsError } = await supabase
    .from('curated_accounts')
    .select('username, signal_score, last_tweet_fetched_at')
    .eq('enabled', true)
    .order('last_tweet_fetched_at', { ascending: true, nullsFirst: true });
  
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
      
      // 🎯 CENTRALIZED CONSENT HANDLING: Use centralized session manager
      const { ensureConsentAccepted, loadTwitterState, saveTwitterState } = await import('../../playwright/twitterSession');
      
      // Ensure storageState is loaded for this context
      const storageState = await loadTwitterState();
      if (storageState) {
        await context.addCookies(storageState.cookies);
        console.log(`[CURATED_FEED] ✅ Loaded storageState (${storageState.cookies.length} cookies) for @${username}`);
      }
      
      // 🔒 MANDATE 4: Track navigation timing
      const navStart = Date.now();
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for timeline to load
      timings.navigationMs = Date.now() - navStart;
      
      // Get initial container count (primary + fallback selectors for diagnostics)
      const containersBeforeResult = await safeEvaluate(page, () => {
        const articleTweet = document.querySelectorAll('article[data-testid="tweet"]').length;
        const anyTweet = document.querySelectorAll('[data-testid="tweet"]').length;
        return { article_tweet: articleTweet, any_tweet: anyTweet, primary: articleTweet };
      });
      const containersBefore = containersBeforeResult?.primary ?? 0;
      
      // 🎯 CENTRALIZED: Ensure consent is accepted with retry
      const consentResult = await ensureConsentAccepted(page, async () => {
        // Retry navigation after consent acceptance
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
      });
      
      const consentCleared = consentResult.cleared;
      const clickAttempted = consentResult.attempts;
      const matchedSelector: string | null = consentResult.matchedSelector || null;
      
      // Post-consent: allow timeline to render and trigger lazy load
      await page.waitForTimeout(2000);
      await safeEvaluate(page, () => { window.scrollBy(0, 800); });
      await page.waitForTimeout(2000);
      
      // Ensure Posts tab is active (profile may open on Replies or other tab)
      try {
        const postsTab = page.getByRole('tab', { name: /Posts/i });
        const count = await postsTab.count();
        if (count > 0) {
          const isSelected = await postsTab.first().getAttribute('aria-selected');
          if (isSelected !== 'true') {
            await postsTab.first().click();
            await page.waitForTimeout(3000);
            console.log(`[CURATED_FEED] 📌 Clicked Posts tab for @${username}`);
          }
        }
      } catch (tabErr: any) {
        console.warn(`[CURATED_FEED] Posts tab click skipped for @${username}: ${tabErr?.message ?? tabErr}`);
      }
      
      // Wait for primary column / timeline if present (X structure)
      try {
        await page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 5000 });
        await page.waitForTimeout(2000);
      } catch (_) {
        // optional
      }
      const finalUrl = page.url();
      if (finalUrl !== profileUrl) {
        console.log(`[CURATED_FEED] 📍 Final URL for @${username}: ${finalUrl}`);
      }
      
      // Log consent handling results; use max of primary/fallback for container count
      const containersAfterResult = await safeEvaluate(page, () => {
        const articleTweet = document.querySelectorAll('article[data-testid="tweet"]').length;
        const anyTweet = document.querySelectorAll('[data-testid="tweet"]').length;
        return { article_tweet: articleTweet, any_tweet: anyTweet, primary: articleTweet, max: Math.max(articleTweet, anyTweet) };
      });
      let containersAfter = containersAfterResult?.max ?? (containersAfterResult?.primary ?? 0);
      let containersBySelector = containersAfterResult
        ? { article_tweet: containersAfterResult.article_tweet, any_tweet: containersAfterResult.any_tweet }
        : { article_tweet: 0, any_tweet: 0 };
      
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
          containers_by_selector: containersBySelector,
          consent_cleared: consentCleared,
          page_url: profileUrl,
          final_url: finalUrl,
        },
        created_at: new Date().toISOString(),
      });
      
      // DIAGNOSTICS: Check login status, walls, and container counts by selector
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
        const articleTweet = document.querySelectorAll('article[data-testid="tweet"]').length;
        const anyTweet = document.querySelectorAll('[data-testid="tweet"]').length;
        // Detect if we're on a profile timeline (Posts tab): look for tab or main column
        const tabSelected = document.querySelector('[role="tab"][aria-selected="true"]');
        const tabLabel = tabSelected?.textContent?.trim() || null;
        return {
          logged_in: hasComposeBox || hasAccountMenu,
          wall_detected: hasLoginWall || hasConsentWall || hasErrorWall || hasRateLimit,
          wall_type: hasLoginWall ? 'login' : hasConsentWall ? 'consent' : hasErrorWall ? 'error' : hasRateLimit ? 'rate_limit' : 'none',
          tweet_containers_found: Math.max(articleTweet, anyTweet),
          containers_by_selector: { article_tweet: articleTweet, any_tweet: anyTweet },
          tab_label: tabLabel,
        };
      });
      
      console.log(`[CURATED_FEED] 🔍 Diagnostics for @${username}:`, diagnostics, 'containers_by_selector:', containersBySelector, 'page_url:', profileUrl, 'consent_cleared:', consentCleared);
      
      // Log diagnostics to system_events
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_feed_diagnostics',
        severity: 'info',
        message: `Feed diagnostics for @${username}`,
        event_data: {
          username,
          url: profileUrl,
          page_url: profileUrl,
          ...diagnostics,
          containers_by_selector: containersBySelector,
          consent_cleared: consentCleared,
        },
        created_at: new Date().toISOString(),
      });
      
      // Update diagnostics with containers_after for downstream logic
      diagnostics.tweet_containers_found = containersAfter;
      
      // If consent wall still detected after handling AND no containers found
      if (diagnostics.wall_detected && diagnostics.wall_type === 'consent' && !consentCleared && containersAfter === 0) {
        console.warn(`[CURATED_FEED] ⚠️ Consent wall still blocking @${username} after ${clickAttempted} attempts`);
        
        const screenshotPath = `/tmp/feed_consent_failed_${username}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
        
        // 🎯 ANALYTICS: Record CONSENT_WALL deny decision
        const { resolveTweetAncestry, recordReplyDecision } = await import('./replyDecisionRecorder');
        // Create a synthetic tweet ID for consent wall tracking (since no tweets were fetched)
        const consentWallTweetId = `consent_wall_${username}_${Date.now()}`;
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
              url: profileUrl,
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
          reason: `Consent wall blocked feed fetch for @${username} (attempts=${clickAttempted}, selector=${matchedSelector || 'none'}, containers_before=${containersBefore}, containers_after=${containersAfter}${consentResult.variant ? `, variant=${consentResult.variant}` : ''})`,
          deny_reason_code: 'CONSENT_WALL', // 🎯 ANALYTICS: Structured deny reason
          status: ancestry.status,
          confidence: ancestry.confidence,
          method: ancestry.method || 'consent_wall_blocked',
          scored_at: new Date().toISOString(),
          template_status: 'FAILED',
          trace_id: `feed_${Date.now()}`,
          pipeline_source: 'reply_v2_feed_curated',
        });
        
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
            deny_reason_code: 'CONSENT_WALL',
          },
          created_at: new Date().toISOString(),
        });
        
        console.log(`[CURATED_FEED] 🎯 Recorded CONSENT_WALL deny decision for @${username}`);
        
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
      
      // When still 0 containers: scroll to top then down to trigger timeline lazy load
      if (containersAfter === 0) {
        await safeEvaluate(page, () => { window.scrollTo(0, 0); });
        await page.waitForTimeout(1500);
        await safeEvaluate(page, () => { window.scrollBy(0, 600); });
        await page.waitForTimeout(3000);
        const afterScroll = await safeEvaluate(page, () => ({
          article_tweet: document.querySelectorAll('article[data-testid="tweet"]').length,
          any_tweet: document.querySelectorAll('[data-testid="tweet"]').length,
        }));
        if ((afterScroll?.article_tweet ?? 0) + (afterScroll?.any_tweet ?? 0) > 0) {
          containersBySelector.article_tweet = afterScroll?.article_tweet ?? 0;
          containersBySelector.any_tweet = afterScroll?.any_tweet ?? 0;
          containersAfter = Math.max(containersBySelector.article_tweet, containersBySelector.any_tweet);
          console.log(`[CURATED_FEED] 📌 Containers after scroll-to-top: article_tweet=${containersBySelector.article_tweet} any_tweet=${containersBySelector.any_tweet}`);
        }
      }
      
      // Determine tweet selector: prefer primary; use fallback if primary yields 0
      const primarySelector = 'article[data-testid="tweet"]';
      const fallbackSelector = '[data-testid="tweet"]';
      let tweetSelector = primarySelector;
      if (containersAfter === 0) {
        try {
          await page.waitForSelector(primarySelector, { timeout: 15000 });
          tweetSelector = primarySelector;
        } catch {
          try {
            await page.waitForSelector(fallbackSelector, { timeout: 5000 });
            tweetSelector = fallbackSelector;
            console.log(`[CURATED_FEED] 📌 Using fallback selector for @${username}: ${fallbackSelector}`);
          } catch (e) {
            console.warn(`[CURATED_FEED] ⚠️ No tweets found for @${username} (primary and fallback selector timeout)`);
            const screenshotPath = `/tmp/feed_no_tweets_${username}_${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`[CURATED_FEED] 📸 Screenshot saved: ${screenshotPath}`);
            return [];
          }
        }
      } else if (containersBySelector.article_tweet === 0 && containersBySelector.any_tweet > 0) {
        tweetSelector = fallbackSelector;
        console.log(`[CURATED_FEED] 📌 Using fallback selector for @${username}: ${fallbackSelector} (containers: any_tweet=${containersBySelector.any_tweet})`);
      }
      
      // Scroll to load more tweets
      await safeEvaluate(page, () => {
        window.scrollBy(0, 1000);
      });
      await page.waitForTimeout(2000);
      
      // Extract profile follower count once (for metadata richness)
      const profileFollowers = await safeEvaluate(page, () => {
        const bodyText = document.body?.innerText || document.body?.textContent || '';
        const match = bodyText.match(/([\d.,]+)\s*([KMB])?\s*Followers?/i) || bodyText.match(/Followers?\s*([\d.,]+)\s*([KMB])?/i);
        if (!match) return null;
        let num = parseFloat(match[1].replace(/,/g, ''));
        const suffix = (match[2] || '').toUpperCase();
        if (suffix === 'K') num *= 1e3;
        else if (suffix === 'M') num *= 1e6;
        else if (suffix === 'B') num *= 1e9;
        return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
      });
      if (profileFollowers != null) {
        console.log(`[CURATED_FEED] 📊 Profile @${username} follower_count=${profileFollowers}`);
      }
      
      // 🔒 MANDATE 4: Track extraction timing
      const extractStart = Date.now();
      // Extract tweets using chosen selector (primary or fallback)
      const tweets = await safeEvaluate(page, (payload: { count: number; username: string; tweet_selector: string; author_follower_count: number | null }) => {
        const articles = Array.from(document.querySelectorAll(payload.tweet_selector));
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
            author_follower_count: payload.author_follower_count ?? undefined,
          });
        }
        
        return results;
      }, { count: TWEETS_PER_ACCOUNT, username, tweet_selector: tweetSelector, author_follower_count: profileFollowers ?? null });
      
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
