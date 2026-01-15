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
 */
async function checkConsentWall(page: any): Promise<boolean> {
  const pageContent = await page.content().catch(() => '');
  const pageText = await page.textContent('body').catch(() => '');
  
  // Only check for explicit consent wall indicators
  if (pageContent.includes('This post is from an account that no longer exists') || 
      pageContent.includes('Something went wrong') ||
      pageContent.includes('rate limit exceeded') ||
      pageContent.includes('suspended') ||
      pageContent.includes('This account doesn\'t exist')) {
    return true;
  }
  
  // Check for explicit error messages
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
  
  // In CDP mode, reuse existing page if available, otherwise create new
  let page = context.pages()[0];
  if (!page) {
    page = await context.newPage();
  }
  
  try {
    // Check current URL - if already on home, don't navigate again
    const currentUrl = page.url();
    if (!currentUrl.includes('x.com/home')) {
      console.log('   🌐 Navigating to https://x.com/home...');
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await jitter(3000, 5000);
    } else {
      console.log('   ✅ Already on home page, refreshing...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await jitter(3000, 5000);
    }
    
    // Check if we're logged in
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="primaryColumn"]') ||
             !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
             !!document.querySelector('nav[role="navigation"]');
    });
    
    if (!isLoggedIn) {
      console.log('   ⚠️  Not logged in - may need to re-run login helper');
      // Check for login prompt
      const hasLoginPrompt = await page.locator('text="Sign in"').isVisible({ timeout: 2000 }).catch(() => false);
      if (hasLoginPrompt) {
        await recordConsentWall('home_scroll', 'https://x.com/home');
        throw new Error('CONSENT_WALL - Login required');
      }
    } else {
      console.log('   ✅ Appears to be logged in');
    }
    
    // Wait for timeline to load (give it more time)
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 20000 });
      console.log('   ✅ Timeline loaded');
    } catch (e) {
      console.log('   ⚠️  Timeline not found, trying alternative selectors...');
      // Try waiting for any content
      await page.waitForTimeout(5000);
    }
    
    // Check for explicit consent wall (only if we see error messages)
    const hasExplicitError = await page.locator('text="Something went wrong"').isVisible({ timeout: 2000 }).catch(() => false);
    if (hasExplicitError) {
      await recordConsentWall('home_scroll', 'https://x.com/home');
      throw new Error('CONSENT_WALL');
    }
    
    // Debug: Check what's on the page
    const pageInfo = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const allArticles = document.querySelectorAll('article');
      const links = document.querySelectorAll('a[href*="/status/"]');
      const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
      return {
        tweetArticles: articles.length,
        allArticles: allArticles.length,
        statusLinks: links.length,
        url: window.location.href,
        title: document.title,
        hasPrimaryColumn: !!primaryColumn,
      };
    });
    console.log(`   🔍 Page info: ${pageInfo.tweetArticles} tweet articles, ${pageInfo.allArticles} total articles, ${pageInfo.statusLinks} status links, primaryColumn: ${pageInfo.hasPrimaryColumn}`);
    
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
  const page = await context.newPage();
  
  try {
    for (const handle of CURATED_HANDLES.slice(0, 5)) { // Limit to first 5 handles
      try {
        const searchUrl = `https://x.com/search?q=from%3A${handle}%20min_faves%3A20%20-filter%3Areplies%20-filter%3Aretweets&src=typed_query`;
        console.log(`   🔍 Searching @${handle}...`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await jitter(2000, 4000);
        
        // Check for consent wall
        if (await checkConsentWall(page)) {
          await recordConsentWall('search_queries', searchUrl);
          console.log(`   ⚠️  CONSENT_WALL detected, skipping search`);
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
  if (!resolveTweetAncestry) {
    const recorder = await import('../../src/jobs/replySystemV2/replyDecisionRecorder');
    resolveTweetAncestry = recorder.resolveTweetAncestry;
  }
  if (!filterTargetQuality) {
    const filter = await import('../../src/gates/replyTargetQualityFilter');
    filterTargetQuality = filter.filterTargetQuality;
  }
  if (!getSupabaseClient) {
    const db = await import('../../src/db');
    getSupabaseClient = db.getSupabaseClient;
  }
  
  try {
    // Resolve ancestry
    const ancestry = await resolveTweetAncestry(tweetId);
    
    if (!ancestry.target_exists) {
      result.skipped_by_reason['target_not_exists'] = (result.skipped_by_reason['target_not_exists'] || 0) + 1;
      return;
    }
    
    if (!ancestry.isRoot || ancestry.targetInReplyToTweetId !== null) {
      result.skipped_by_reason['not_root'] = (result.skipped_by_reason['not_root'] || 0) + 1;
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
    const targetText = ancestry.normalizedSnapshot || '';
    const qualityResult = filterTargetQuality(
      targetText,
      ancestry.targetAuthor || 'unknown',
      undefined,
      targetText
    );
    
    if (!qualityResult.pass) {
      result.skipped_by_reason[qualityResult.deny_reason_code || 'quality_filter'] = 
        (result.skipped_by_reason[qualityResult.deny_reason_code || 'quality_filter'] || 0) + 1;
      return;
    }
    
    // Insert opportunity
    const { error: insertError } = await supabase
      .from('reply_opportunities')
      .insert({
        target_tweet_id: tweetId,
        target_username: ancestry.targetAuthor || 'unknown',
        target_tweet_url: `https://x.com/i/status/${tweetId}`,
        target_tweet_content: targetText.substring(0, 500),
        tweet_posted_at: ancestry.targetPostedAt ? new Date(ancestry.targetPostedAt).toISOString() : new Date().toISOString(),
        is_root_tweet: true,
        root_tweet_id: tweetId,
        target_in_reply_to_tweet_id: null,
        status: 'pending',
        replied_to: false,
        opportunity_score: qualityResult.score || 75.0,
        discovery_method: HARVEST_MODE === 'home_scroll' ? 'mac_home_scroll' : 'mac_search',
        account_username: ancestry.targetAuthor || 'unknown',
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
    
    if (HARVEST_MODE === 'home_scroll') {
      console.log('📜 Collecting from home timeline...\n');
      tweetIds = await collectFromHomeTimeline();
    } else if (HARVEST_MODE === 'search_queries') {
      console.log('🔍 Collecting from search queries...\n');
      tweetIds = await collectFromSearchQueries();
    } else {
      throw new Error(`Unknown HARVEST_MODE: ${HARVEST_MODE}`);
    }
    
    result.tweet_ids_collected = tweetIds.length;
    result.tweets_seen = tweetIds.length; // Approximate
    
    console.log(`\n✅ Collected ${tweetIds.length} unique tweet IDs\n`);
    
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
