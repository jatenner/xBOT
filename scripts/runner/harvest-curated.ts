#!/usr/bin/env tsx
/**
 * 🌾 MAC RUNNER CURATED HARVESTER
 * 
 * Harvests opportunities using human-like discovery:
 * - Home timeline scrolling (default)
 * - Search queries (optional)
 * 
 * Runs every 5 minutes via LaunchAgent.
 * 
 * Usage:
 *   pnpm run runner:harvest-once (MODE=home_scroll)
 *   pnpm run runner:harvest-search (MODE=search_queries)
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first (preferred), then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Set runner mode to use persistent profile
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

// Lazy imports after env is loaded
let getSupabaseClient: any;
let resolveTweetAncestry: any;
let filterTargetQuality: any;

const CURATED_HANDLES_STR = process.env.REPLY_CURATED_HANDLES || '';
const CURATED_HANDLES = CURATED_HANDLES_STR
  .split(',')
  .map(h => h.trim().toLowerCase().replace('@', ''))
  .filter(Boolean);

const HARVEST_MODE = process.env.HARVEST_MODE || 'home_scroll'; // 'home_scroll' or 'search_queries'
const MAX_VALIDATIONS_PER_RUN = parseInt(process.env.MAX_VALIDATIONS_PER_RUN || '12', 10);
const MAX_AGE_HOURS = 48; // Check last 48h for duplicates
const HARVEST_AGE_HOURS = 24; // Only harvest tweets from last 24h
const SCROLL_COUNT = parseInt(process.env.SCROLL_COUNT || '8', 10);

interface HarvestResult {
  tweets_seen: number;
  tweet_ids_collected: number;
  validated_ok: number;
  inserted: number;
  skipped_by_reason: Record<string, number>;
  consent_wall_seen: boolean;
}

/**
 * Random jitter delay
 */
function jitter(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Check if tweet was already used/attempted in last 48h
 */
async function isTweetAlreadyUsed(tweetId: string): Promise<boolean> {
  if (!getSupabaseClient) {
    const db = await import('../../src/db');
    getSupabaseClient = db.getSupabaseClient;
  }
  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  // Check reply_decisions
  const { data: decisions } = await supabase
    .from('reply_decisions')
    .select('decision_id')
    .eq('target_tweet_id', tweetId)
    .gte('created_at', cutoffTime)
    .limit(1);

  if (decisions && decisions.length > 0) {
    return true;
  }

  // Check system_events for POST_ATTEMPT or POST_SUCCESS
  const { data: events } = await supabase
    .from('system_events')
    .select('event_id')
    .in('event_type', ['POST_ATTEMPT', 'POST_SUCCESS'])
    .gte('created_at', cutoffTime)
    .like('event_data', `%"target_tweet_id":"${tweetId}"%`)
    .limit(1);

  return (events && events.length > 0) || false;
}

/**
 * Record CONSENT_WALL event
 */
async function recordConsentWall(mode: string, url: string): Promise<void> {
  if (!getSupabaseClient) {
    const db = await import('../../src/db');
    getSupabaseClient = db.getSupabaseClient;
  }
  const supabase = getSupabaseClient();
  
  await supabase.from('system_events').insert({
    event_type: 'CONSENT_WALL_SEEN',
    severity: 'warning',
    message: `Consent wall detected during harvest: ${mode}`,
    event_data: {
      mode,
      url,
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });
}

/**
 * Check for consent wall on page
 * For search pages: Only flag consent wall if logged-in shell is missing
 */
async function checkConsentWall(page: any, isSearchPage: boolean = false): Promise<boolean> {
  const currentUrl = page.url();
  
  // Check for explicit redirects to consent/login flows
  if (currentUrl.includes('/i/flow/consent') || currentUrl.includes('/i/flow/login')) {
    return true;
  }
  
  // For search pages: First check if logged-in shell exists
  if (isSearchPage) {
    const hasShell = await page.evaluate(() => {
      return !!(
        document.querySelector('nav[role="navigation"]') ||
        document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
        document.querySelector('a[href="/home"]') ||
        document.querySelector('[data-testid="primaryColumn"]')
      );
    });
    
    // If shell exists, we're logged in - not a consent wall
    if (hasShell) {
      return false;
    }
  }
  
  // Check for login button/form visible (only if shell is missing)
  const hasLoginButton = await page.locator('text="Sign in"').isVisible({ timeout: 2000 }).catch(() => false) ||
                         await page.locator('text="Log in"').isVisible({ timeout: 2000 }).catch(() => false);
  
  if (hasLoginButton && isSearchPage) {
    // On search page with login button but no shell = consent wall
    return true;
  }
  
  // Check for explicit consent text (only if shell is missing)
  const pageContent = await page.content().catch(() => '');
  const hasConsentText = pageContent.includes('Before you continue to X') ||
                        pageContent.includes('Cookies') && pageContent.includes('consent') ||
                        pageContent.includes('Accept cookies');
  
  if (hasConsentText && isSearchPage) {
    // Wait a bit to see if tweets load despite consent text
    await page.waitForTimeout(3000);
    const hasTweets = await page.evaluate(() => {
      return !!document.querySelector('article[data-testid="tweet"]');
    });
    
    // If tweets exist, it's not a consent wall (just a banner)
    if (hasTweets) {
      return false;
    }
    
    // No tweets + consent text + no shell = consent wall
    return true;
  }
  
  // Check for explicit error messages (always flag these)
  if (pageContent.includes('This post is from an account that no longer exists') || 
      pageContent.includes('Something went wrong') ||
      pageContent.includes('rate limit exceeded') ||
      pageContent.includes('suspended') ||
      pageContent.includes('This account doesn\'t exist')) {
    return true;
  }
  
  // Check for explicit error messages in DOM
  const hasError = await page.locator('text="Something went wrong"').isVisible({ timeout: 1000 }).catch(() => false) ||
                   await page.locator('text="This post is from an account that no longer exists"').isVisible({ timeout: 1000 }).catch(() => false);
  
  return hasError;
}

/**
 * Collect tweets from home timeline
 */
async function collectFromHomeTimeline(): Promise<string[]> {
  // Use runner launcher (CDP mode)
  if (!process.env.RUNNER_BROWSER) {
    process.env.RUNNER_BROWSER = process.env.RUNNER_MODE === 'true' ? 'cdp' : 'direct';
  }
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const tweetIds: string[] = [];
  
  const context = await launchRunnerPersistent(true); // headless for harvesting
  
  // ALWAYS create a NEW page for harvesting (don't reuse existing pages in CDP mode)
  let page = await context.newPage();
  console.log('   📄 Created new page for harvesting');
  
  try {
    // Navigate with retry logic
    let navigationSuccess = false;
    let retryCount = 0;
    const maxRetries = 1;
    
    while (!navigationSuccess && retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`   🔄 Retry ${retryCount}/${maxRetries}: Stopping current navigation and creating fresh page...`);
          await page.evaluate(() => window.stop()).catch(() => {});
          await page.close().catch(() => {});
          page = await context.newPage();
          console.log('   📄 Created fresh page for retry');
        }
        
        console.log('   🌐 Navigating to https://x.com/home...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const finalUrl = page.url();
        console.log(`   ✅ Navigation complete: ${finalUrl}`);
        
        // Wait for lightweight "logged in shell" selectors (left nav/compose/avatar)
        // Don't wait for tweets - they may load slowly
        // Use a timeout wrapper to ensure Promise.race doesn't hang
        const shellDetected = await Promise.race([
          page.waitForSelector('nav[role="navigation"]', { timeout: 5000 }).then(() => 'leftNav').catch(() => null),
          page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 5000 }).then(() => 'compose').catch(() => null),
          page.waitForSelector('[data-testid="SideNav_AccountSwitcher_Button"]', { timeout: 5000 }).then(() => 'avatar').catch(() => null),
          page.waitForSelector('a[href="/home"]', { timeout: 5000 }).then(() => 'homeLink').catch(() => null),
          page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 5000 }).then(() => 'primaryColumn').catch(() => null),
          new Promise(resolve => setTimeout(() => resolve(null), 6000)), // Fallback timeout
        ]).catch(() => null);
        
        if (shellDetected) {
          console.log(`   ✅ Shell detected: ${shellDetected}`);
          navigationSuccess = true;
        } else {
          // Check if we're actually logged in (maybe selectors are different)
          const hasShell = await page.evaluate(() => {
            return !!(
              document.querySelector('nav[role="navigation"]') ||
              document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
              document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
              document.querySelector('a[href="/home"]') ||
              document.querySelector('[data-testid="primaryColumn"]')
            );
          });
          
          if (hasShell) {
            console.log('   ✅ Shell detected: (evaluated check)');
            navigationSuccess = true;
          } else {
            // Check for login redirect
            const currentUrl = page.url();
            if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login')) {
              await recordConsentWall('home_scroll', currentUrl);
              throw new Error('CONSENT_WALL - Login required');
            }
            
            if (retryCount < maxRetries) {
              console.log('   ⚠️  Shell not detected, will retry...');
              retryCount++;
              await jitter(1000, 2000);
              continue;
            } else {
              throw new Error('Shell not detected after retries');
            }
          }
        }
      } catch (error: any) {
        if (error.message.includes('CONSENT_WALL')) {
          throw error;
        }
        
        if (retryCount < maxRetries) {
          console.log(`   ⚠️  Navigation failed: ${error.message}, retrying...`);
          retryCount++;
          await jitter(1000, 2000);
        } else {
          throw new Error(`Navigation failed after ${maxRetries + 1} attempts: ${error.message}`);
        }
      }
    }
    
    // Check for explicit consent wall (only if we see error messages)
    const hasExplicitError = await page.locator('text="Something went wrong"').isVisible({ timeout: 2000 }).catch(() => false);
    if (hasExplicitError) {
      await recordConsentWall('home_scroll', 'https://x.com/home');
      throw new Error('CONSENT_WALL');
    }
    
    // Give page a moment to render tweets (but don't wait for them)
    await jitter(2000, 3000);
    
    // Scroll and collect tweets
    for (let i = 0; i < SCROLL_COUNT; i++) {
      // Extract tweet IDs from visible tweets
      const ids = await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results: string[] = [];
        
        for (const article of articles) {
          // Check if it's a reply (skip)
          const articleText = article.textContent || '';
          if (articleText.includes('Replying to')) {
            continue;
          }
          
          // Extract tweet ID
          const links = article.querySelectorAll('a[href*="/status/"]');
          for (const link of Array.from(links)) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/status\/(\d+)/);
            if (match) {
              results.push(match[1]);
              break;
            }
          }
        }
        
        return [...new Set(results)]; // Deduplicate
      });
      
      tweetIds.push(...ids);
      console.log(`   📜 Scroll ${i + 1}/${SCROLL_COUNT}: Found ${ids.length} tweet IDs (total: ${tweetIds.length})`);
      
      // Early exit if we've collected enough (keep runs lightweight)
      if (tweetIds.length >= 20) {
        console.log(`   ✅ Collected ${tweetIds.length} tweet IDs, stopping early (max 20 per run)`);
        break;
      }
      
      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });
      
      await jitter(800, 1500); // Human-like scroll delay
    }
  } catch (error: any) {
    if (error.message.includes('CONSENT_WALL')) {
      throw error;
    }
    throw new Error(`Home timeline collection failed: ${error.message}`);
  } finally {
    await page.close();
    await context.close();
  }
  
  return [...new Set(tweetIds)]; // Deduplicate final list
}

/**
 * Collect tweets from search queries
 */
async function collectFromSearchQueries(): Promise<string[]> {
  // Use runner launcher (CDP mode)
  if (!process.env.RUNNER_BROWSER) {
    process.env.RUNNER_BROWSER = process.env.RUNNER_MODE === 'true' ? 'cdp' : 'direct';
  }
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const tweetIds: string[] = [];
  
  const context = await launchRunnerPersistent(true); // headless for harvesting
  
  // ALWAYS create a NEW page for harvesting (don't reuse existing pages in CDP mode)
  let page = await context.newPage();
  console.log('   📄 Created new page for search harvesting');
  
  try {
    for (const handle of CURATED_HANDLES.slice(0, 5)) { // Limit to first 5 handles
      try {
        const searchUrl = `https://x.com/search?q=from%3A${handle}%20min_faves%3A20%20-filter%3Areplies%20-filter%3Aretweets&src=typed_query`;
        console.log(`   🔍 Searching @${handle}...`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await jitter(2000, 4000);
        
        // Wait for search results to load (up to 10s)
        const searchResultsLoaded = await Promise.race([
          page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }).then(() => 'tweets'),
          page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 10000 }).then(() => 'column'),
          page.waitForSelector('[data-testid="cellInnerDiv"]', { timeout: 10000 }).then(() => 'results'),
          new Promise(resolve => setTimeout(() => resolve(null), 10000)), // Fallback timeout
        ]).catch(() => null);
        
        if (!searchResultsLoaded) {
          console.log(`   ⚠️  Search results did not load for @${handle}`);
        }
        
        // Check for consent wall (with search page flag)
        const consentWallDetected = await checkConsentWall(page, true);
        
        if (consentWallDetected) {
          // Save debug artifacts
          const debugDir = path.join(process.env.RUNNER_PROFILE_DIR || '.runner-profile', 'harvest_debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          const timestamp = Date.now();
          await page.screenshot({ path: path.join(debugDir, `consent_wall_search_${handle}_${timestamp}.png`) }).catch(() => {});
          const html = await page.content().catch(() => '');
          fs.writeFileSync(path.join(debugDir, `consent_wall_search_${handle}_${timestamp}.html`), html);
          
          await recordConsentWall('search_queries', searchUrl);
          console.log(`   ⚠️  CONSENT_WALL detected, skipping search (artifacts saved)`);
          continue;
        }
        
        // Scroll a few times
        for (let i = 0; i < 3; i++) {
          const ids = await page.evaluate(() => {
            const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            const results: string[] = [];
            
            for (const article of articles) {
              const articleText = article.textContent || '';
              if (articleText.includes('Replying to')) {
                continue;
              }
              
              const links = article.querySelectorAll('a[href*="/status/"]');
              for (const link of Array.from(links)) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/status\/(\d+)/);
                if (match) {
                  results.push(match[1]);
                  break;
                }
              }
            }
            
            return [...new Set(results)];
          });
          
          tweetIds.push(...ids);
          
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 2);
          });
          
          await jitter(800, 1500);
        }
        
        await jitter(1000, 2000); // Delay between handles
      } catch (error: any) {
        if (error.message.includes('CONSENT_WALL')) {
          throw error;
        }
        console.log(`   ⚠️  Search failed for @${handle}: ${error.message}`);
      }
    }
  } catch (error: any) {
    if (error.message.includes('CONSENT_WALL')) {
      throw error;
    }
    throw new Error(`Search collection failed: ${error.message}`);
  } finally {
    await page.close();
    await context.close();
  }
  
  return [...new Set(tweetIds)];
}

/**
 * Validate tweet using CDP-authenticated session (Mac Runner only)
 */
async function validateTweetWithCDP(tweetId: string): Promise<{
  exists: boolean;
  isRoot: boolean;
  author: string | null;
  content: string | null;
  error?: string;
}> {
  // Only use CDP validation in RUNNER_MODE with CDP browser
  if (process.env.RUNNER_MODE !== 'true' || process.env.RUNNER_BROWSER !== 'cdp') {
    // Fallback to legacy validation
    return { exists: false, isRoot: false, author: null, content: null, error: 'Not in CDP mode' };
  }
  
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const context = await launchRunnerPersistent(true); // headless
  const page = await context.newPage();
  
  const debugDir = path.join(process.env.RUNNER_PROFILE_DIR || '.runner-profile', 'harvest_debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  
  try {
    const tweetUrl = `https://x.com/i/status/${tweetId}`;
    console.log(`   🔍 Validating ${tweetId} via CDP...`);
    
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Let page settle
    
    const finalUrl = page.url();
    
    // Check for login redirect
    if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
      console.log(`   ⚠️  Login redirect detected for ${tweetId}`);
      await page.screenshot({ path: path.join(debugDir, `login_redirect_${tweetId}.png`) });
      await page.close();
      await context.close();
      return { exists: false, isRoot: false, author: null, content: null, error: 'Login required' };
    }
    
    // Wait for lightweight shell selectors OR tweet article
    const shellOrTweet = await Promise.race([
      page.waitForSelector('nav[role="navigation"]', { timeout: 5000 }).then(() => 'shell').catch(() => null),
      page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 5000 }).then(() => 'shell').catch(() => null),
      page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 }).then(() => 'tweet').catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), 6000)), // Fallback timeout
    ]).catch(() => null);
    
    if (!shellOrTweet) {
      console.log(`   ⚠️  No shell or tweet detected for ${tweetId}`);
      await page.screenshot({ path: path.join(debugDir, `no_content_${tweetId}.png`) });
      const html = await page.content();
      fs.writeFileSync(path.join(debugDir, `no_content_${tweetId}.html`), html);
      await page.close();
      await context.close();
      return { exists: false, isRoot: false, author: null, content: null, error: 'No content detected' };
    }
    
    // Extract tweet data
    const tweetData = await page.evaluate(() => {
      // Check for "This Post is unavailable" or "doesn't exist" messages
      const bodyText = document.body.textContent || '';
      const isUnavailable = bodyText.includes('This Post is unavailable') || 
                           bodyText.includes("doesn't exist") ||
                           bodyText.includes('Post not found');
      
      if (isUnavailable) {
        return { exists: false, reason: 'unavailable' };
      }
      
      // Find main tweet article
      const mainArticle = document.querySelector('article[data-testid="tweet"]:first-of-type');
      if (!mainArticle) {
        return { exists: false, reason: 'no_article' };
      }
      
      // Extract author
      const authorElement = mainArticle.querySelector('[data-testid="User-Name"] a');
      const author = authorElement?.textContent?.replace('@', '').trim() || null;
      
      // Extract content - collect all spans inside tweetText container
      const tweetTextEl = mainArticle.querySelector('[data-testid="tweetText"]');
      let content: string | null = null;
      
      if (tweetTextEl) {
        // Collect all text from spans inside
        const spans = tweetTextEl.querySelectorAll('span');
        const texts: string[] = [];
        spans.forEach((span: Element) => {
          const text = span.textContent?.trim();
          if (text && text.length > 0) {
            texts.push(text);
          }
        });
        
        // If we got spans, join them; otherwise use textContent
        if (texts.length > 0) {
          content = texts.join(' ');
        } else {
          content = tweetTextEl.textContent?.trim() || null;
        }
      }
      
      // Handle "Show more" button if present and content is short
      if (content && content.length < 100) {
        const showMoreButton = mainArticle.querySelector('span:has-text("Show more")');
        if (showMoreButton) {
          // Note: We can't click here in evaluate, but we'll try to get expanded text
          const expandedText = mainArticle.textContent || '';
          if (expandedText.length > content.length) {
            content = expandedText.substring(0, 500); // Limit to reasonable length
          }
        }
      }
      
      // Check if it's a reply (look for "Replying to" text)
      const articleText = mainArticle.textContent || '';
      const isReply = /Replying to\s+@/i.test(articleText) || 
                     !!mainArticle.querySelector('[data-testid="socialContext"]');
      
      // Extract tweet ID from article link
      const articleLink = mainArticle.querySelector('a[href*="/status/"]');
      const href = articleLink?.getAttribute('href') || '';
      const match = href.match(/\/status\/(\d+)/);
      const articleTweetId = match ? match[1] : null;
      
      return {
        exists: true,
        author,
        content,
        isReply,
        articleTweetId,
      };
    });
    
    await page.close();
    await context.close();
    
    if (!tweetData.exists) {
      const errorReason = tweetData.reason === 'unavailable' ? 'unavailable' : 
                          tweetData.reason === 'no_article' ? 'No content detected' :
                          'not_found';
      console.log(`   ❌ Tweet ${tweetId} ${tweetData.reason || 'not found'}`);
      return { exists: false, isRoot: false, author: null, content: null, error: errorReason };
    }
    
    console.log(`   ✅ Tweet ${tweetId} exists: author=@${tweetData.author || 'unknown'}, isReply=${tweetData.isReply}`);
    return {
      exists: true,
      isRoot: !tweetData.isReply,
      author: tweetData.author || null,
      content: tweetData.content || null,
    };
    
  } catch (error: any) {
    console.log(`   ❌ Validation error for ${tweetId}: ${error.message}`);
    await page.screenshot({ path: path.join(debugDir, `error_${tweetId}.png`) }).catch(() => {});
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    return { exists: false, isRoot: false, author: null, content: null, error: error.message };
  }
}

/**
 * Validate and insert a tweet
 */
async function validateAndInsert(
  tweetId: string,
  result: HarvestResult,
  validatedCount: { count: number }
): Promise<void> {
  if (validatedCount.count >= MAX_VALIDATIONS_PER_RUN) {
    result.skipped_by_reason['max_validations_reached'] = (result.skipped_by_reason['max_validations_reached'] || 0) + 1;
    return;
  }
  
  validatedCount.count++;
  
  // Lazy import modules
  if (!filterTargetQuality) {
    const filter = await import('../../src/gates/replyTargetQualityFilter');
    filterTargetQuality = filter.filterTargetQuality;
  }
  if (!getSupabaseClient) {
    const db = await import('../../src/db');
    getSupabaseClient = db.getSupabaseClient;
  }
  
  try {
    // Use CDP validation in RUNNER_MODE with CDP browser
    let validationResult: { exists: boolean; isRoot: boolean; author: string | null; content: string | null; error?: string };
    
    if (process.env.RUNNER_MODE === 'true' && process.env.RUNNER_BROWSER === 'cdp') {
      // Use CDP-authenticated validation
      validationResult = await validateTweetWithCDP(tweetId);
    } else {
      // Fallback to legacy resolveTweetAncestry (for Railway)
      if (!resolveTweetAncestry) {
        const recorder = await import('../../src/jobs/replySystemV2/replyDecisionRecorder');
        resolveTweetAncestry = recorder.resolveTweetAncestry;
      }
      const ancestry = await resolveTweetAncestry(tweetId);
      validationResult = {
        exists: ancestry.status === 'OK',
        isRoot: ancestry.isRoot && ancestry.status === 'OK',
        author: null, // Will be extracted from ancestry if needed
        content: null,
        error: ancestry.status !== 'OK' ? ancestry.error : undefined,
      };
    }
    
    if (!validationResult.exists) {
      const skipReason = validationResult.error === 'unavailable' ? 'unavailable' : 
                        validationResult.error === 'Login required' ? 'login_required' :
                        validationResult.error === 'No content detected' ? 'no_content_detected' :
                        'target_not_exists';
      result.skipped_by_reason[skipReason] = (result.skipped_by_reason[skipReason] || 0) + 1;
      console.log(`   ⏭️  Skipped ${tweetId}: ${skipReason}`);
      return;
    }
    
    if (!validationResult.isRoot) {
      result.skipped_by_reason['not_root'] = (result.skipped_by_reason['not_root'] || 0) + 1;
      console.log(`   ⏭️  Skipped ${tweetId}: not_root`);
      return;
    }
    
    // Check if already used
    const alreadyUsed = await isTweetAlreadyUsed(tweetId);
    if (alreadyUsed) {
      result.skipped_by_reason['already_replied'] = (result.skipped_by_reason['already_replied'] || 0) + 1;
      return;
    }
    
    // Check for duplicate in reply_opportunities
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('reply_opportunities')
      .select('id')
      .eq('target_tweet_id', tweetId)
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      result.skipped_by_reason['duplicate_opportunity'] = (result.skipped_by_reason['duplicate_opportunity'] || 0) + 1;
      return;
    }
    
    // Apply quality filter
    const targetText = validationResult.content || '';
    const targetAuthor = validationResult.author || 'unknown';
    
    if (!targetText) {
      result.skipped_by_reason['no_content'] = (result.skipped_by_reason['no_content'] || 0) + 1;
      console.log(`   ⏭️  Skipped ${tweetId}: no_content`);
      return;
    }
    
    const qualityResult = filterTargetQuality(
      targetText,
      targetAuthor,
      undefined,
      targetText
    );
    
    if (!qualityResult.pass) {
      result.skipped_by_reason[qualityResult.deny_reason_code || 'quality_filter'] = 
        (result.skipped_by_reason[qualityResult.deny_reason_code || 'quality_filter'] || 0) + 1;
      console.log(`   ⏭️  Skipped ${tweetId}: ${qualityResult.deny_reason_code || 'quality_filter'}`);
      return;
    }
    
    // Insert opportunity
    const { error: insertError } = await supabase
      .from('reply_opportunities')
      .insert({
        target_tweet_id: tweetId,
        target_username: targetAuthor,
        target_tweet_url: `https://x.com/i/status/${tweetId}`,
        target_tweet_content: targetText.substring(0, 500),
        tweet_posted_at: new Date().toISOString(), // Use current time since we don't have posted_at from CDP
        is_root_tweet: true,
        root_tweet_id: tweetId,
        target_in_reply_to_tweet_id: null,
        status: 'pending',
        replied_to: false,
        opportunity_score: qualityResult.score || 75.0,
        discovery_method: HARVEST_MODE === 'home_scroll' ? 'mac_home_scroll' : 'mac_search',
        account_username: targetAuthor,
      });
    
    if (insertError) {
      if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
        result.skipped_by_reason['duplicate_opportunity'] = (result.skipped_by_reason['duplicate_opportunity'] || 0) + 1;
      } else {
        result.skipped_by_reason['insert_error'] = (result.skipped_by_reason['insert_error'] || 0) + 1;
      }
    } else {
      result.inserted++;
      result.validated_ok++;
    }
  } catch (error: any) {
    result.skipped_by_reason['validation_error'] = (result.skipped_by_reason['validation_error'] || 0) + 1;
  }
}

/**
 * Check session status
 */
async function checkSessionStatus(): Promise<{ status: 'SESSION_OK' | 'SESSION_EXPIRED'; url: string; reason: string }> {
  // Use runner launcher (CDP mode when RUNNER_MODE=true)
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  
  const context = await launchRunnerPersistent(true); // headless for session check
  const page = await context.newPage();
  
  try {
    // Navigate to home, but don't wait for networkidle (can timeout)
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000); // Give page time to load
    
    const currentUrl = page.url();
    
    // Check for login redirect
    if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login')) {
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'Redirected to login page',
      };
    }
    
    // Check for login button/text
    const hasLoginButton = await page.locator('text="Sign in"').isVisible({ timeout: 2000 }).catch(() => false) ||
                          await page.locator('text="Log in"').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasLoginButton) {
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'Login button visible',
      };
    }
    
    // Check for logged-in indicators (left nav, compose, avatar - more reliable than timeline tweets)
    const sessionIndicators = await page.evaluate(() => {
      const hasLeftNav = !!(
        document.querySelector('nav[role="navigation"]') ||
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
        document.querySelector('a[href="/home"]')
      );
      
      const hasComposeButton = !!(
        document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
        document.querySelector('a[href="/compose/tweet"]')
      );
      
      const hasUserAvatar = !!(
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
      );
      
      return {
        hasLeftNav,
        hasComposeButton,
        hasUserAvatar,
        sessionOK: hasLeftNav || hasComposeButton || hasUserAvatar,
      };
    });
    
    if (sessionIndicators.sessionOK) {
      await context.close();
      return {
        status: 'SESSION_OK',
        url: currentUrl,
        reason: `Session OK: left nav=${sessionIndicators.hasLeftNav}, compose=${sessionIndicators.hasComposeButton}, avatar=${sessionIndicators.hasUserAvatar}`,
      };
    }
    
    await context.close();
    return {
      status: 'SESSION_EXPIRED',
      url: currentUrl,
      reason: 'No session indicators found (left nav/compose/avatar)',
    };
    
  } catch (error: any) {
    let url = 'unknown';
    try {
      url = page.url();
    } catch {}
    await context.close().catch(() => {});
    return {
      status: 'SESSION_EXPIRED',
      url,
      reason: `Error: ${error.message}`,
    };
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🌾 MAC RUNNER CURATED HARVESTER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Set browser mode for session check
  if (!process.env.RUNNER_BROWSER) {
    process.env.RUNNER_BROWSER = process.env.RUNNER_MODE === 'true' ? 'cdp' : 'direct';
  }
  
  // Check session first
  console.log('🔐 Checking session status...');
  const sessionCheck = await checkSessionStatus();
  
  if (sessionCheck.status === 'SESSION_EXPIRED') {
    console.log(`\n❌ SESSION_EXPIRED`);
    console.log(`   URL: ${sessionCheck.url}`);
    console.log(`   Reason: ${sessionCheck.reason}`);
    console.log(`\n⚠️  Need manual login refresh: run pnpm run runner:login\n`);
    process.exit(2);
  }
  
  console.log(`✅ ${sessionCheck.status}`);
  console.log(`   URL: ${sessionCheck.url}\n`);
  
  console.log(`Mode: ${HARVEST_MODE}`);
  console.log(`Max validations per run: ${MAX_VALIDATIONS_PER_RUN}`);
  console.log(`Scroll count: ${SCROLL_COUNT}\n`);
  
  const result: HarvestResult = {
    tweets_seen: 0,
    tweet_ids_collected: 0,
    validated_ok: 0,
    inserted: 0,
    skipped_by_reason: {},
    consent_wall_seen: false,
  };
  
  try {
    // Collect tweet IDs based on mode
    let tweetIds: string[] = [];
    let searchFailed = false;
    let searchFailureReason = '';
    
    if (HARVEST_MODE === 'home_scroll') {
      console.log('📜 Collecting from home timeline...\n');
      tweetIds = await collectFromHomeTimeline();
    } else if (HARVEST_MODE === 'search_queries') {
      console.log('🔍 Collecting from search queries...\n');
      try {
        tweetIds = await collectFromSearchQueries();
        
        // Check if search failed (0 results or consent wall)
        if (tweetIds.length === 0) {
          searchFailed = true;
          searchFailureReason = 'zero_results';
        }
      } catch (error: any) {
        if (error.message.includes('CONSENT_WALL')) {
          searchFailed = true;
          searchFailureReason = 'consent_wall';
        } else {
          searchFailed = true;
          searchFailureReason = `error: ${error.message}`;
        }
      }
      
      // Fallback to home_scroll if search failed
      if (searchFailed) {
        console.log(`\n⚠️  SEARCH MODE FAILED → FALLING BACK TO HOME_SCROLL`);
        console.log(`   Reason: ${searchFailureReason}\n`);
        result.consent_wall_seen = searchFailureReason === 'consent_wall';
        
        try {
          console.log('📜 Collecting from home timeline (fallback)...\n');
          const fallbackIds = await collectFromHomeTimeline();
          tweetIds = fallbackIds;
          console.log(`✅ Fallback collected ${tweetIds.length} tweet IDs\n`);
        } catch (fallbackError: any) {
          console.error(`❌ Fallback also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
    } else {
      throw new Error(`Unknown HARVEST_MODE: ${HARVEST_MODE}`);
    }
    
    result.tweet_ids_collected = tweetIds.length;
    result.tweets_seen = tweetIds.length; // Approximate
    
    console.log(`\n✅ Collected ${tweetIds.length} unique tweet IDs`);
    console.log(`   Tweet IDs collected: ${result.tweet_ids_collected}\n`);
    
    if (tweetIds.length === 0) {
      console.log('⚠️  No tweets collected');
      return;
    }
    
    // Validate and insert (with cap)
    console.log(`🔍 Validating up to ${MAX_VALIDATIONS_PER_RUN} tweets...\n`);
    const validatedCount = { count: 0 };
    
    for (const tweetId of tweetIds.slice(0, MAX_VALIDATIONS_PER_RUN * 2)) { // Process more than cap to account for skips
      await validateAndInsert(tweetId, result, validatedCount);
      
      if (validatedCount.count >= MAX_VALIDATIONS_PER_RUN) {
        break;
      }
      
      await jitter(300, 900); // Pace validations
    }
    
  } catch (error: any) {
    if (error.message.includes('CONSENT_WALL')) {
      result.consent_wall_seen = true;
      console.error(`\n❌ CONSENT_WALL detected - aborting harvest`);
    } else {
      console.error(`\n❌ Harvest failed: ${error.message}`);
    }
  }
  
  // Final report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 HARVEST REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Tweets seen: ${result.tweets_seen}`);
  console.log(`Tweet IDs collected: ${result.tweet_ids_collected}`);
  console.log(`Validated OK: ${result.validated_ok}`);
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Consent wall seen: ${result.consent_wall_seen ? 'YES' : 'NO'}\n`);
  
  if (Object.keys(result.skipped_by_reason).length > 0) {
    console.log('Skipped by reason:');
    const sorted = Object.entries(result.skipped_by_reason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    for (const [reason, count] of sorted) {
      console.log(`   ${reason}: ${count}`);
    }
    console.log('');
  }
  
  if (result.inserted > 0) {
    console.log(`✅ Successfully inserted ${result.inserted} opportunities`);
  } else {
    console.log(`⚠️  No opportunities inserted`);
  }
  
  console.log('');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
