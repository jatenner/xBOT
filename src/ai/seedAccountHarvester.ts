/**
 * 🌱 SEED ACCOUNT HARVESTER (PRIMARY DISCOVERY SOURCE)
 * 
 * Scrapes high-visibility health/fitness/science accounts for viral root tweets.
 * This is the PRIMARY source for reply opportunities, not a fallback.
 * 
 * Strategy:
 * - Maintain curated list of elite health accounts + viral aggregators
 * - Scrape their recent tweets (30-80 per account)
 * - Filter ROOT tweets only (no replies, retweets, quote-of-reply)
 * - Extract all metrics (likes, views, replies, retweets)
 * - Store as reply_opportunities with quality scoring
 */

import { Page } from 'playwright';
import { getSupabaseClient } from '../db/index';
import { scoreTargetQuality } from './targetQualityFilter';
import { checkFreshness } from './freshnessController';
import { checkWhoami } from '../utils/whoamiAuth';
import { computeRelevanceReplyabilityScores, HEALTH_AUTHORITY_ALLOWLIST, classifyDisallowedTweet } from './relevanceReplyabilityScorer';
import { computeContextSimilarity, computeOpportunityScoreFinal } from './contextSimilarityScorer';

// ═══════════════════════════════════════════════════════════════════════════
// SEED ACCOUNTS (HIGH-VISIBILITY HEALTH/FITNESS/SCIENCE)
// ═══════════════════════════════════════════════════════════════════════════

interface SeedAccount {
  username: string;
  category: 'health' | 'fitness' | 'nutrition' | 'longevity' | 'science' | 'aggregator';
  priority: number; // 0-1, higher = more valuable
  min_followers?: number;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  // Elite Health/Science (1M+ followers)
  { username: 'hubermanlab', category: 'science', priority: 1.0 },
  { username: 'foundmyfitness', category: 'longevity', priority: 1.0 },
  { username: 'peterattiamd', category: 'health', priority: 1.0 },
  { username: 'bengreenfield', category: 'health', priority: 0.9 },
  
  // Fitness Authorities (500K+)
  { username: 'jeff_nippard', category: 'fitness', priority: 0.9 },
  { username: 'biolayne', category: 'nutrition', priority: 0.9 },
  { username: 'drandygalpin', category: 'science', priority: 0.9 },
  
  // Viral Health Aggregators
  { username: 'thefitnesschef_', category: 'aggregator', priority: 0.8 },
  { username: 'drericberg', category: 'health', priority: 0.8 },
  
  // Science Communicators
  { username: 'yudapearl', category: 'science', priority: 0.7 },
  { username: 'nicknorwitzphd', category: 'science', priority: 0.7 },
];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ScrapedTweet {
  tweet_id: string;
  tweet_url: string;
  author_handle: string;
  author_name: string;
  author_followers?: number;
  tweet_content: string;
  like_count: number | null; // Can be null if metrics unknown
  reply_count: number | null;
  retweet_count: number | null;
  view_count?: number | null;
  tweet_posted_at: Date;
  age_minutes: number;
  velocity: number;
  is_root_tweet: boolean;
  is_reply_tweet: boolean;
  is_retweet: boolean;
  is_quote: boolean;
  in_reply_to_tweet_id?: string;
  conversation_id?: string;
}

interface StoredOpportunity {
  relevance_score: number;
  replyability_score: number;
  author_handle: string;
}

interface HarvestResult {
  account: string;
  scraped_count: number;
  root_only_count: number;
  stored_count: number;
  blocked_reply_count: number;
  blocked_quality_count: number;
  blocked_stale_count: number;
  blocked_disallowed_count?: number; // Optional: count of disallowed tweets filtered
  stored_opportunities?: StoredOpportunity[]; // Track stored opportunities with scores
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HARVESTER
// ═══════════════════════════════════════════════════════════════════════════

export async function harvestSeedAccounts(
  page: Page,
  options: {
    accounts?: string[]; // Override seed list
    max_tweets_per_account?: number;
    max_accounts?: number;
  } = {}
): Promise<{
  total_scraped: number;
  total_stored: number;
  results: HarvestResult[];
}> {
  // 🎯 CONNECTIVITY PREFLIGHT: Check Supabase connectivity before starting
  const supabaseClient = getSupabaseClient();
  try {
    const preflightUrl = process.env.SUPABASE_URL || 'unknown';
    console.log(`[HARVEST_PREFLIGHT] Checking Supabase connectivity...`);
    console.log(`[HARVEST_PREFLIGHT]   URL: ${preflightUrl.replace(/\/\/.*@/, '//***@')}`); // Hide credentials
    
    // Lightweight connectivity check
    const { error: preflightError } = await supabaseClient
      .from('seed_accounts')
      .select('handle')
      .limit(1);
    
    if (preflightError) {
      console.error(`[HARVEST_PREFLIGHT] ❌ Connectivity check failed: ${preflightError.message}`);
      console.error(`[HARVEST_PREFLIGHT]   Likely causes:`);
      console.error(`[HARVEST_PREFLIGHT]     - SUPABASE_URL points to private Railway URL (unreachable from local)`);
      console.error(`[HARVEST_PREFLIGHT]     - Network connectivity issue`);
      console.error(`[HARVEST_PREFLIGHT]     - Invalid SUPABASE_SERVICE_ROLE_KEY`);
      console.error(`[HARVEST_PREFLIGHT]   Continuing anyway (stats writes may fail)...`);
    } else {
      console.log(`[HARVEST_PREFLIGHT] ✅ Connectivity check passed`);
    }
  } catch (preflightErr: any) {
    console.error(`[HARVEST_PREFLIGHT] ❌ Preflight exception: ${preflightErr.message}`);
    if (preflightErr.message.includes('fetch failed') || preflightErr.message.includes('ETIMEDOUT')) {
      console.error(`[HARVEST_PREFLIGHT]   Network error detected - check SUPABASE_URL is reachable`);
    }
    console.error(`[HARVEST_PREFLIGHT]   Continuing anyway (stats writes may fail)...`);
  }
  console.log('');
  
  // 🗄️ DB-BACKED SEEDS: Query seed_accounts table if accounts not provided
  let accountsToUse: string[] = [];
  const seedsPerRun = parseInt(process.env.SEEDS_PER_RUN || '10', 10);
  
  if (options.accounts && options.accounts.length > 0) {
    // Use provided accounts (override)
    accountsToUse = options.accounts;
  } else {
    // Query DB for enabled seeds
    const { data: dbSeeds, error: dbError } = await supabaseClient
      .from('seed_accounts')
      .select('handle')
      .eq('enabled', true);
    
    if (dbError) {
      console.warn(`[SEED_HARVEST] ⚠️ Failed to query seed_accounts: ${dbError.message}, falling back to hardcoded list`);
      accountsToUse = SEED_ACCOUNTS.map(a => a.username);
    } else if (dbSeeds && dbSeeds.length > 0) {
      const allEnabledSeeds = dbSeeds.map(s => s.handle);
      
      // Use weighted sampling if stats available
      const { pickSeedsWeighted } = await import('../utils/seedSampling');
      const { seeds: weightedSeeds } = await pickSeedsWeighted(allEnabledSeeds, seedsPerRun);
      accountsToUse = weightedSeeds;
      
      // Log seed usage
      const totalEnabled = await supabaseClient
        .from('seed_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('enabled', true);
      
      console.log(`[SEEDS] total_enabled=${totalEnabled.count || 0} using_this_run=${accountsToUse.length}`);
    } else {
      // Fallback to hardcoded if DB is empty
      console.warn(`[SEED_HARVEST] ⚠️ No enabled seeds in DB, falling back to hardcoded list`);
      accountsToUse = SEED_ACCOUNTS.map(a => a.username).slice(0, seedsPerRun);
    }
  }
  const {
    max_tweets_per_account = 50,
    max_accounts = seedsPerRun || 10,
  } = options;
  
  const results: HarvestResult[] = [];
  let total_scraped = 0;
  let total_stored = 0;
  
  console.log(`[SEED_HARVEST] 🌱 Starting seed account harvest`);
  console.log(`[SEED_HARVEST]   Accounts: ${accountsToUse.slice(0, max_accounts).length}`);
  console.log(`[SEED_HARVEST]   Max tweets per account: ${max_tweets_per_account}`);
  
  const accountsToProcess = accountsToUse.slice(0, max_accounts);
  
  // Track stats for batch update
  const statsUpdates: Array<{
    handle: string;
    scraped_count: number;
    stored_count: number;
    tier1_pass: number;
    tier2_pass: number;
    tier3_pass: number;
    disallowed_count: number;
  }> = [];
  
  for (const username of accountsToProcess) {
    try {
      const result = await harvestAccount(page, username, max_tweets_per_account);
      results.push(result);
      total_scraped += result.scraped_count;
      total_stored += result.stored_count;
      
      // 🎯 COMPUTE TIER PASSES FROM IN-MEMORY STORED OPPORTUNITIES
      // Use same gate logic as replyJob for consistency
      const { HEALTH_AUTHORITY_ALLOWLIST } = await import('./relevanceReplyabilityScorer');
      
      const GATE_TIERS = [
        { tier: 1, relevance: 0.45, replyability: 0.35 },
        { tier: 2, relevance: 0.45, replyability: 0.30 },
        { tier: 3, relevance: 0.45, replyability: 0.25 },
      ];
      const HARD_FLOOR_RELEVANCE = 0.45;
      const WHITELIST_EXEMPTION_MIN_RELEVANCE = 0.40;
      
      let tier1Pass = 0;
      let tier2Pass = 0;
      let tier3Pass = 0;
      
      if (result.stored_opportunities && result.stored_opportunities.length > 0) {
        for (const opp of result.stored_opportunities) {
          const relevanceScore = opp.relevance_score;
          const replyabilityScore = opp.replyability_score;
          const authorHandle = (opp.author_handle || '').toLowerCase().replace('@', '');
          const isWhitelisted = HEALTH_AUTHORITY_ALLOWLIST.has(authorHandle);
          
          // HARD FLOOR: relevance < 0.45 => FAIL (unless whitelist exemption: 0.40-0.44)
          let effectiveRelevance = relevanceScore;
          
          if (relevanceScore < HARD_FLOOR_RELEVANCE) {
            // Check whitelist exemption: allow 0.40-0.44 for whitelisted authors
            if (isWhitelisted && relevanceScore >= WHITELIST_EXEMPTION_MIN_RELEVANCE) {
              effectiveRelevance = HARD_FLOOR_RELEVANCE; // Treat as meeting floor for tier checks
            } else {
              continue; // Below hard floor, skip
            }
          }
          
          // Try tiers in order (1 -> 2 -> 3) as fallback ladder
          // Count highest tier that passes
          for (const gate of GATE_TIERS) {
            if (effectiveRelevance >= gate.relevance && replyabilityScore >= gate.replyability) {
              if (gate.tier === 1) tier1Pass++;
              else if (gate.tier === 2) tier2Pass++;
              else if (gate.tier === 3) tier3Pass++;
              break; // Count only highest tier
            }
          }
        }
      }
      
      statsUpdates.push({
        handle: username,
        scraped_count: result.scraped_count,
        stored_count: result.stored_count,
        tier1_pass: tier1Pass,
        tier2_pass: tier2Pass,
        tier3_pass: tier3Pass,
        disallowed_count: 0, // Not tracked during harvest, leave as 0
      });
      
      console.log(`[SEED_STATS] seed=@${username} scraped=${result.scraped_count} stored=${result.stored_count} tier1=${tier1Pass} tier2=${tier2Pass} tier3=${tier3Pass} disallowed=0`);
      console.log(`[SEED_HARVEST] ✅ @${username}: ${result.stored_count}/${result.scraped_count} stored`);
      
      // Small delay between accounts
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`[SEED_HARVEST] ❌ @${username} failed:`, error.message);
      results.push({
        account: username,
        scraped_count: 0,
        root_only_count: 0,
        stored_count: 0,
        blocked_reply_count: 0,
        blocked_quality_count: 0,
        blocked_stale_count: 0,
        error: error.message,
      });
    }
  }
  
  // Batch update seed stats (non-fatal, wrapped in try/catch)
  if (statsUpdates.length > 0) {
    for (const update of statsUpdates) {
      try {
        const { error: statsError } = await supabaseClient
          .from('seed_account_stats')
          .upsert({
            handle: update.handle,
            scraped_count: update.scraped_count,
            stored_count: update.stored_count,
            tier1_pass: update.tier1_pass,
            tier2_pass: update.tier2_pass,
            tier3_pass: update.tier3_pass,
            disallowed_count: update.disallowed_count,
            last_harvest_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'handle',
          });
        
        if (statsError) {
          console.warn(`[SEED_STATS] ⚠️ Failed to update stats for @${update.handle}: ${statsError.message}`);
        }
      } catch (statsErr: any) {
        // Never throw - stats updates are non-critical
        const errorMsg = statsErr.message || String(statsErr);
        console.error(`[SEED_STATS] ❌ Exception updating stats for @${update.handle}: ${errorMsg}`);
        
        // Diagnose fetch failures
        if (errorMsg.includes('fetch failed') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('TypeError')) {
          const supabaseUrl = process.env.SUPABASE_URL || 'unknown';
          console.error(`[SEED_STATS]   Network error - SUPABASE_URL: ${supabaseUrl.replace(/\/\/.*@/, '//***@')}`);
          console.error(`[SEED_STATS]   Likely cause: URL unreachable (private Railway URL?) or network issue`);
        }
      }
    }
  }
  
  console.log(`[SEED_HARVEST] 🌾 Summary: ${total_stored}/${total_scraped} opportunities stored`);
  
  // Log tier distribution + guardrail for relevance_score=0
  const supabase = getSupabaseClient();
  const { data: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('tier, target_tweet_id, target_username, like_count, posted_minutes_ago, likes_per_min, opportunity_score, relevance_score, replyability_score, selection_reason')
    .eq('selection_reason', 'harvest_v2')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('opportunity_score', { ascending: false })
    .limit(50);
  
  if (recentOpps && recentOpps.length > 0) {
    const tierDist: Record<string, number> = {};
    for (const opp of recentOpps) {
      const tier = String(opp.tier || 'B').toUpperCase();
      tierDist[tier] = (tierDist[tier] || 0) + 1;
    }
    console.log(`[SEED_HARVEST] 📊 Tier distribution: S=${tierDist['S'] || 0} A=${tierDist['A'] || 0} B=${tierDist['B'] || 0}`);
    
    // 🚨 GUARDRAIL: Check relevance_score=0 percentage
    const zeroRelevanceCount = recentOpps.filter(opp => (opp.relevance_score || 0) === 0).length;
    const zeroRelevancePct = ((zeroRelevanceCount / recentOpps.length) * 100).toFixed(1);
    if (zeroRelevanceCount > 0) {
      console.warn(`[SEED_HARVEST] ⚠️ GUARDRAIL: ${zeroRelevanceCount}/${recentOpps.length} (${zeroRelevancePct}%) stored opportunities have relevance_score=0`);
      if (parseFloat(zeroRelevancePct) > 50) {
        console.error(`[SEED_HARVEST] 🚨 CRITICAL: >50% of stored opportunities have relevance_score=0 - scoring may be broken!`);
      }
    } else {
      console.log(`[SEED_HARVEST] ✅ GUARDRAIL: All ${recentOpps.length} stored opportunities have relevance_score > 0`);
    }
    
    // Log top 5 Tier_S candidates
    const tierS = recentOpps.filter(opp => String(opp.tier || '').toUpperCase() === 'S').slice(0, 5);
    if (tierS.length > 0) {
      console.log(`[SEED_HARVEST] 🏆 Top 5 Tier_S candidates:`);
      tierS.forEach((opp, i) => {
        console.log(`  ${i + 1}. @${opp.target_username} tweet_id=${opp.target_tweet_id} likes=${opp.like_count} age=${Math.round(opp.posted_minutes_ago || 0)}min likes/min=${(opp.likes_per_min || 0).toFixed(2)} score=${Math.round(opp.opportunity_score || 0)} relevance=${(opp.relevance_score || 0).toFixed(2)}`);
      });
    }
  }
  
  return { total_scraped, total_stored, results };
}

async function harvestAccount(
  page: Page,
  username: string,
  max_tweets: number
): Promise<HarvestResult> {
  const result: HarvestResult = {
    account: username,
    scraped_count: 0,
    root_only_count: 0,
    stored_count: 0,
    blocked_reply_count: 0,
    blocked_quality_count: 0,
    blocked_stale_count: 0,
  };
  
  // Navigate to user profile
  const profileUrl = `https://x.com/${username}`;
  console.log(`[SEED_HARVEST] 📍 Navigating to ${profileUrl}`);
  
  let finalUrl = '';
  let pageTitle = 'unknown';
  let tweetsFound = 0;
  let authOk = false;
  let authReason = 'ok';
  
  try {
    // Increased timeout for navigation
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for timeline container with increased timeout
    try {
      await page.waitForSelector('[data-testid="primaryColumn"], main, section', { timeout: 30000 });
    } catch (waitError) {
      console.warn(`[SEED_HARVEST] ⚠️ Timeline container not found after 30s, continuing anyway`);
    }
    
    await page.waitForTimeout(3000); // Let content load
    
    // ═══════════════════════════════════════════════════════════════════════════
    // AUTH DIAGNOSTIC: Check authentication status using WHOAMI
    // ═══════════════════════════════════════════════════════════════════════════
    finalUrl = page.url();
    pageTitle = await page.title().catch(() => 'unknown');
    
    // Check for Cloudflare/account access wall
    const isCloudflareWall = finalUrl.includes('/account/access') || pageTitle.toLowerCase().includes('just a moment');
    if (isCloudflareWall) {
      authReason = 'cloudflare_or_access_wall';
      authOk = false;
      console.log(`[SEED_RESULT] seed=${username} ok=false reason=${authReason} final_url=${finalUrl} title=${pageTitle} tweets_found=0`);
      result.error = authReason;
      return result; // Return early with structured failure
    }
    
    // Extract tweets first to check if any found
    const tweets = await extractTweetsFromProfile(page, max_tweets);
    result.scraped_count = tweets.length;
    tweetsFound = tweets.length;
    
    // Check WHOAMI (more reliable auth check)
    const whoami = await checkWhoami(page);
    console.log(`[WHOAMI] logged_in=${whoami.logged_in} handle=${whoami.handle || 'unknown'} url=${whoami.url} title=${whoami.title} reason=${whoami.reason}`);
    
    // Determine auth status: If tweets found AND whoami says logged in => ok
    authOk = tweetsFound > 0 && whoami.logged_in;
    
    // Determine reason if auth failed
    if (!authOk) {
      if (!whoami.logged_in) {
        authReason = whoami.reason || 'not_logged_in';
      } else if (tweetsFound === 0) {
        authReason = 'no_tweets';
      } else {
        authReason = 'unknown';
      }
    }
    
    // Log auth diagnostic
    console.log(`[HARVESTER_AUTH] ok=${authOk} url=${finalUrl} tweets_found=${tweetsFound} reason=${authReason} whoami_logged_in=${whoami.logged_in}`);
    
    // If auth failed, check if retry is needed
    if (!authOk) {
      // 🎯 RETRY LOGIC: If no_tweets and page shows errorContainer or problematic title, retry once
      if (authReason === 'no_tweets' && whoami.logged_in) {
        const pageContent = await page.content().catch(() => '');
        const hasErrorContainer = pageContent.includes('errorContainer') || pageContent.includes('error-container');
        const isProfilePage = pageTitle.includes('Profile / X') || pageTitle.includes('Page not found / X') || pageTitle.includes('Something went wrong');
        
        if (hasErrorContainer || isProfilePage) {
          console.log(`[SEED_HARVEST] 🔄 Retry: no_tweets with errorContainer/problematic title, reloading... retry=1`);
          
          let retrySuccess = false;
          let retryPage = page;
          
          // Retry strategy 1: page.reload with domcontentloaded (faster, more reliable)
          try {
            await retryPage.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
            await retryPage.waitForTimeout(2000); // Wait for content
            
            const retryTweets = await extractTweetsFromProfile(retryPage, max_tweets);
            if (retryTweets.length > 0) {
              console.log(`[SEED_HARVEST] ✅ Retry successful (reload): found ${retryTweets.length} tweets retry=1`);
              tweets.length = 0;
              tweets.push(...retryTweets);
              result.scraped_count = tweets.length;
              tweetsFound = tweets.length;
              authOk = true;
              authReason = 'ok';
              finalUrl = retryPage.url();
              pageTitle = await retryPage.title().catch(() => 'unknown');
              retrySuccess = true;
            }
          } catch (reloadError: any) {
            console.log(`[SEED_HARVEST] ⚠️ Retry reload failed: ${reloadError.message}, trying page.goto fallback retry=1`);
            
            // Retry strategy 2: page.goto with domcontentloaded
            try {
              await retryPage.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
              await retryPage.waitForTimeout(2000);
              
              const retryTweets2 = await extractTweetsFromProfile(retryPage, max_tweets);
              if (retryTweets2.length > 0) {
                console.log(`[SEED_HARVEST] ✅ Retry successful (goto): found ${retryTweets2.length} tweets retry=1`);
                tweets.length = 0;
                tweets.push(...retryTweets2);
                result.scraped_count = tweets.length;
                tweetsFound = tweets.length;
                authOk = true;
                authReason = 'ok';
                finalUrl = retryPage.url();
                pageTitle = await retryPage.title().catch(() => 'unknown');
                retrySuccess = true;
              }
            } catch (gotoError: any) {
              console.log(`[SEED_HARVEST] ⚠️ Retry goto failed: ${gotoError.message} retry=1`);
              
              // Retry strategy 3: Create new page from context (if page was closed)
              try {
                const context = retryPage.context();
                if (!context) {
                  throw new Error('Page context unavailable');
                }
                const browser = context.browser();
                if (!browser || !browser.isConnected()) {
                  throw new Error('Browser context disconnected');
                }
                const newPage = await context.newPage();
                await newPage.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                await newPage.waitForTimeout(2000);
                
                const retryTweets3 = await extractTweetsFromProfile(newPage, max_tweets);
                if (retryTweets3.length > 0) {
                  console.log(`[SEED_HARVEST] ✅ Retry successful (new page): found ${retryTweets3.length} tweets retry=1`);
                  tweets.length = 0;
                  tweets.push(...retryTweets3);
                  result.scraped_count = tweets.length;
                  tweetsFound = tweets.length;
                  authOk = true;
                  authReason = 'ok';
                  finalUrl = newPage.url();
                  pageTitle = await newPage.title().catch(() => 'unknown');
                  // Note: We can't replace the page parameter, but extraction succeeded
                  retrySuccess = true;
                  // Don't close newPage - let caller handle lifecycle
                } else {
                  await newPage.close().catch(() => {}); // Clean up if no tweets found
                }
              } catch (newPageError: any) {
                console.log(`[SEED_HARVEST] ⚠️ Retry new page failed: ${newPageError.message} retry=1`);
              }
            }
          }
          
          if (!retrySuccess) {
            console.log(`[SEED_HARVEST] ⚠️ All retry strategies failed, marking as blocked_or_empty retry=1`);
            console.log(`[SEED_RESULT] seed=${username} ok=false reason=blocked_or_empty retry=1 final_url=${finalUrl} title=${pageTitle} tweets_found=0`);
            result.error = 'blocked_or_empty';
            return result;
          }
          
          // Update page reference if we created a new one
          if (retryPage !== page) {
            // Note: We can't replace the page parameter, but we'll continue with retryPage
            // The caller should handle page lifecycle
          }
        } else {
          // No retry needed, return failure
          console.log(`[SEED_RESULT] seed=${username} ok=false reason=${authReason} final_url=${finalUrl} title=${pageTitle} tweets_found=${tweetsFound}`);
          result.error = authReason;
          return result;
        }
      } else {
        // Not a retry case, return failure
        console.error(`[HARVESTER_AUTH] ❌ Auth check failed for @${username}`);
        console.error(`[HARVESTER_AUTH]   Final URL: ${finalUrl}`);
        console.error(`[HARVESTER_AUTH]   Page title: ${pageTitle}`);
        console.error(`[HARVESTER_AUTH]   WHOAMI logged_in: ${whoami.logged_in}`);
        console.error(`[HARVESTER_AUTH]   Tweets found: ${tweetsFound}`);
        
        try {
          // Take screenshot
          const screenshotPath = '/tmp/harvester_auth_debug.png';
          await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
          const fs = await import('fs');
          const screenshotSize = fs.existsSync(screenshotPath) ? fs.statSync(screenshotPath).size : 0;
          console.log(`[HARVESTER_AUTH] 📸 Screenshot saved: ${screenshotPath} (${screenshotSize} bytes)`);
          
          // Dump HTML
          const htmlPath = '/tmp/harvester_auth_debug.html';
          const pageContent = await page.content().catch(() => '');
          const bodyText = await page.evaluate(() => document.body?.textContent || '').catch(() => '');
          if (pageContent) {
            fs.writeFileSync(htmlPath, pageContent);
            const htmlSize = fs.statSync(htmlPath).size;
            console.log(`[HARVESTER_AUTH] 📄 HTML dumped: ${htmlPath} (${htmlSize} bytes)`);
            if (bodyText) {
              console.log(`[HARVESTER_AUTH] 📄 First 300 chars of body: ${bodyText.substring(0, 300)}`);
            }
          }
        } catch (debugError: any) {
          console.error(`[HARVESTER_AUTH] ⚠️ Failed to capture debug info: ${debugError.message}`);
        }
        
        // Return structured failure (don't throw)
        console.log(`[SEED_RESULT] seed=${username} ok=false reason=${authReason} final_url=${finalUrl} title=${pageTitle} tweets_found=${tweetsFound}`);
        result.error = authReason;
        return result;
      }
    }
    
    console.log(`[SEED_HARVEST] 📊 @${username}: Extracted ${tweets.length} tweets`);
    
    // Filter ROOT tweets only with TRUE verification
    // A tweet is a root tweet ONLY if:
    // 1. Not a reply (no in_reply_to_tweet_id)
    // 2. Not a retweet
    // 3. conversation_id == tweet_id (best effort)
    const rootTweets = tweets.filter(t => {
      // Hard rejection if in_reply_to is present
      if (t.in_reply_to_tweet_id) {
        console.log(`[SEED_HARVEST] 🚫 REJECTED ${t.tweet_id}: is a reply (in_reply_to=${t.in_reply_to_tweet_id})`);
        return false;
      }
      // Reject retweets
      if (t.is_retweet) {
        return false;
      }
      // Reject if conversation_id != tweet_id (indicates thread participant)
      if (t.conversation_id && t.conversation_id !== t.tweet_id && t.conversation_id !== 'unknown') {
        console.log(`[SEED_HARVEST] 🚫 REJECTED ${t.tweet_id}: conversation_id mismatch`);
        return false;
      }
      return t.is_root_tweet && !t.is_reply_tweet;
    });
  result.root_only_count = rootTweets.length;
  result.blocked_reply_count = tweets.length - rootTweets.length;
  
  console.log(`[SEED_HARVEST] 🎯 @${username}: ${rootTweets.length} root tweets`);
  
  // Store opportunities with quality/freshness filtering
  const scoredTweets: Array<{ tweet: ScrapedTweet; quality: any; freshness: any; tier: string }> = [];
  const storedOpportunities: StoredOpportunity[] = []; // Track stored opportunities for tier counting
  
  for (const tweet of rootTweets) {
    try {
      // Quality filter
      const quality = scoreTargetQuality(
        tweet.tweet_content,
        tweet.author_handle,
        tweet.author_followers,
        tweet.view_count,
        tweet.like_count
      );
      
      // Freshness filter (handle null metrics)
      const freshness = checkFreshness(tweet.like_count ?? 0, tweet.age_minutes, tweet.velocity);
      
      // Determine tier (handle null metrics)
      const tier = determineTier(tweet.like_count ?? 0, tweet.view_count ?? undefined);
      
      // Store scored tweet for potential fallback
      scoredTweets.push({ tweet, quality, freshness, tier });
      
      // Apply filters
      if (!quality.pass) {
        result.blocked_quality_count++;
        console.log(`[SEED_HARVEST] 🚫 Quality blocked: ${tweet.tweet_id} (score=${quality.score})`);
        continue;
      }
      
      // 🔒 NEGATIVE FILTERS: Skip ads/promos/political/memes/low-info tweets
      const disallowedReason = classifyDisallowedTweet(
        tweet.tweet_content,
        tweet.author_handle,
        tweet.tweet_url
      );
      
      if (disallowedReason) {
        result.blocked_disallowed_count = (result.blocked_disallowed_count || 0) + 1;
        console.log(`[SEED_HARVEST] 🚫 Disallowed: ${tweet.tweet_id} reason=${disallowedReason}`);
        continue;
      }
      
      // Additional negative filters (political ragebait, meme accounts, low-info)
      const textLower = tweet.tweet_content.toLowerCase();
      
      // Political ragebait filter
      const politicalPatterns = [
        /\b(trump|biden|election|democrat|republican|liberal|conservative|woke|cancel culture)\b/i,
      ];
      if (politicalPatterns.some(p => p.test(tweet.tweet_content)) && !HEALTH_AUTHORITY_ALLOWLIST.has(tweet.author_handle.toLowerCase())) {
        result.blocked_disallowed_count = (result.blocked_disallowed_count || 0) + 1;
        console.log(`[SEED_HARVEST] 🚫 Political ragebait: ${tweet.tweet_id}`);
        continue;
      }
      
      // Low-info tweet filter (very short, no substance)
      if (tweet.tweet_content.trim().length < 30 && tweet.like_count !== null && tweet.like_count < 100) {
        result.blocked_disallowed_count = (result.blocked_disallowed_count || 0) + 1;
        console.log(`[SEED_HARVEST] 🚫 Low-info tweet: ${tweet.tweet_id} (too short + low engagement)`);
        continue;
      }
      
      // Compute relevance/replyability scores BEFORE storing (needed for tier counting)
      const relevanceReplyability = computeRelevanceReplyabilityScores(
        tweet.tweet_content,
        tweet.author_handle,
        tweet.tweet_url
      );
      
      // If metrics are unknown (null), allow storage with special handling
      if (tweet.like_count === null || tweet.like_count === undefined) {
        // Store with unknown metrics - don't block by freshness
        const storedScores = await storeOpportunity(tweet, quality, tier, 'normal', undefined, undefined, undefined, undefined, 'unknown', relevanceReplyability);
        result.stored_count++;
        // Track stored opportunity with scores
        storedOpportunities.push({
          relevance_score: storedScores.relevance_score,
          replyability_score: storedScores.replyability_score,
          author_handle: tweet.author_handle,
        });
        console.log(`[SEED_HARVEST] ✅ Stored (unknown metrics): ${tweet.tweet_id} tier=${tier} quality=${quality.score} relevance=${storedScores.relevance_score.toFixed(2)} replyability=${storedScores.replyability_score.toFixed(2)}`);
        continue;
      }
      
      if (!freshness.pass) {
        result.blocked_stale_count++;
        // Log detailed block reason
        const ageMin = Math.round(tweet.age_minutes);
        const computedMinLikes = ageMin <= 30 ? 25 : ageMin <= 90 ? 75 : ageMin <= 180 ? 150 : 2500;
        const likesPerMin = tweet.age_minutes > 0 ? (tweet.like_count / tweet.age_minutes) : 0;
        console.log(`[SEED_HARVEST] ⏱️ Stale: ${tweet.tweet_id} (${freshness.reason}) age=${ageMin}min computed_min_likes=${computedMinLikes} likes=${tweet.like_count} likes_per_min=${likesPerMin.toFixed(2)}`);
        continue;
      }
      
      // Store
      const storedScores = await storeOpportunity(tweet, quality, tier, 'normal', undefined, undefined, undefined, undefined, undefined, relevanceReplyability);
      result.stored_count++;
      
      // Track stored opportunity with scores
      storedOpportunities.push({
        relevance_score: storedScores.relevance_score,
        replyability_score: storedScores.replyability_score,
        author_handle: tweet.author_handle,
      });
      
      console.log(`[SEED_HARVEST] ✅ Stored: ${tweet.tweet_id} tier=${tier} quality=${quality.score} likes=${tweet.like_count ?? 'null'} relevance=${storedScores.relevance_score.toFixed(2)} replyability=${storedScores.replyability_score.toFixed(2)}`);
    } catch (storeError: any) {
      console.error(`[SEED_HARVEST] ❌ Store failed for ${tweet.tweet_id}:`, storeError.message);
    }
  }
  
  // 🚨 STARVATION PROTECTION: If we stored 0 opportunities, store top 2 highest-scoring tweets
  if (result.stored_count === 0 && scoredTweets.length > 0) {
    console.log(`[SEED_HARVEST] 🚨 STARVATION PROTECTION: Stored 0 opportunities, storing top 2 fallback candidates`);
    
    // Sort by quality score (highest first), then by age
    // For fallback, we bypass freshness checks but still require minimum engagement
    const MIN_LIKES_FOR_FALLBACK = 100; // Minimum likes to consider for fallback
    const fallbackCandidates = scoredTweets
      .filter(item => {
        // Must have minimum likes (bypass freshness age checks for fallback)
        return item.tweet.like_count >= MIN_LIKES_FOR_FALLBACK;
      })
      .sort((a, b) => {
        // Sort by quality score descending
        if (b.quality.score !== a.quality.score) {
          return b.quality.score - a.quality.score;
        }
        // Then by age (newer first)
        return a.tweet.age_minutes - b.tweet.age_minutes;
      })
      .slice(0, 2);
    
    for (const item of fallbackCandidates) {
      try {
        // Compute scores for fallback opportunities
        const fallbackScores = computeRelevanceReplyabilityScores(
          item.tweet.tweet_content,
          item.tweet.author_handle,
          item.tweet.tweet_url
        );
        
        const storedScores = await storeOpportunity(item.tweet, item.quality, item.tier, undefined, undefined, undefined, undefined, undefined, undefined, fallbackScores);
        result.stored_count++;
        
        // Track stored opportunity with scores
        storedOpportunities.push({
          relevance_score: storedScores.relevance_score,
          replyability_score: storedScores.replyability_score,
          author_handle: item.tweet.author_handle,
        });
        console.log(`[SEED_HARVEST] ✅ Fallback stored: ${item.tweet.tweet_id} tier=${item.tier} quality=${item.quality.score} relevance=${storedScores.relevance_score.toFixed(2)} replyability=${storedScores.replyability_score.toFixed(2)}`);
      } catch (storeError: any) {
        console.error(`[SEED_HARVEST] ❌ Fallback store failed for ${item.tweet.tweet_id}:`, storeError.message);
      }
    }
  }
  
  // Attach stored opportunities to result for tier counting
  result.stored_opportunities = storedOpportunities;
  
  // Log successful seed result
  console.log(`[SEED_RESULT] seed=${username} ok=true reason=ok final_url=${finalUrl} title=${pageTitle} tweets_found=${tweetsFound}`);
  
  return result;
  } catch (navError: any) {
    // Don't throw - return structured failure
    const errorReason = navError.message?.includes('timeout') ? 'navigation_timeout' : 
                       navError.message?.includes('net::ERR') ? 'network_error' :
                       'navigation_failed';
    console.error(`[SEED_HARVEST] ❌ Navigation failed for @${username}: ${navError.message}`);
    console.log(`[SEED_RESULT] seed=${username} ok=false reason=${errorReason} final_url=${finalUrl || 'unknown'} title=${pageTitle} tweets_found=0`);
    result.error = errorReason;
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TWEET EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

async function extractTweetsFromProfile(page: Page, max_tweets: number): Promise<ScrapedTweet[]> {
  const tweets: ScrapedTweet[] = [];
  
  // Scroll and collect tweets
  let scrollAttempts = 0;
  const maxScrollAttempts = 5;
  
  // Scroll loop with small waits to trigger tweet rendering (3 scrolls)
  for (let scrollLoop = 0; scrollLoop < 3 && tweets.length < max_tweets; scrollLoop++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000); // Small wait to trigger rendering
  }
  
  while (tweets.length < max_tweets && scrollAttempts < maxScrollAttempts) {
    // Extract visible tweets
    const newTweets = await page.evaluate(() => {
      // Try multiple selectors (Twitter/X UI changes frequently)
      let tweetCards = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      
      // Fallback selectors if primary doesn't work
      if (tweetCards.length === 0) {
        tweetCards = Array.from(document.querySelectorAll('article[role="article"]'));
      }
      if (tweetCards.length === 0) {
        tweetCards = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
      }
      if (tweetCards.length === 0) {
        tweetCards = Array.from(document.querySelectorAll('div[data-testid="tweet"]'));
      }
      
      console.log(`[SEED_HARVEST_DEBUG] Found ${tweetCards.length} tweet elements on page`);
      
      return tweetCards.map(card => {
        try {
          // Get tweet ID from link
          const tweetLink = card.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          const tweetUrl = tweetLink?.href || '';
          const tweetId = tweetUrl.match(/\/status\/(\d+)/)?.[1] || '';
          
          if (!tweetId) return null;
          
          // Get content
          const textDiv = card.querySelector('[data-testid="tweetText"]');
          const content = textDiv?.textContent || '';
          
          // Check if reply (has "Replying to" text)        
          // More accurate: Check for "Replying to @username" indicator, not just reply button
          const replyingToIndicator = card.querySelector('[data-testid="reply"]')?.closest('div')?.textContent?.includes('Replying to');
          const hasReplyContext = card.textContent?.includes('Replying to');
          // Only mark as reply if we have explicit "Replying to" context, not just @ mentions in content
          const isReply = Boolean(hasReplyContext || replyingToIndicator);
          
          // Extract in_reply_to_tweet_id and conversation_id (Twitter truth)
          let inReplyToTweetId: string | undefined;
          let conversationId: string | undefined;
          
          if (isReply) {
            // Try to get parent tweet ID from "Replying to" link
            const replyLink = card.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
            if (replyLink && replyLink.href.includes('/status/')) {
              // Check if this is a "Replying to" link (usually appears before the tweet content)
              const replyToSection = card.querySelector('[data-testid="reply"]')?.closest('div');
              if (replyToSection) {
                const parentLink = replyToSection.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
                if (parentLink) {
                  inReplyToTweetId = parentLink.href.match(/\/status\/(\d+)/)?.[1];
                }
              }
            }
          }
          
          // Conversation ID is typically the root tweet ID
          // For replies, we need to check if this is part of a thread
          // Best effort: if it's a reply, conversation_id != tweet_id
          conversationId = isReply ? (inReplyToTweetId || 'unknown') : tweetId;
          
          // Check if retweet
          const isRetweet = Boolean(card.querySelector('[data-testid="socialContext"]')?.textContent?.includes('reposted'));
          
          // Get metrics - try aria-label first (more reliable)
          let replyCount: number | null = null, retweetCount: number | null = null, likeCount: number | null = null, viewCount: number | null = null;
          
          // Try aria-label approach first (more reliable for engagement counts)
          const replyButton = card.querySelector('[data-testid="reply"]');
          const retweetButton = card.querySelector('[data-testid="retweet"]');
          const likeButton = card.querySelector('[data-testid="like"]');
          
          if (replyButton) {
            const ariaLabel = replyButton.getAttribute('aria-label') || '';
            const replyMatch = ariaLabel.match(/([\d,]+)/);
            if (replyMatch) {
              replyCount = parseInt(replyMatch[1].replace(/,/g, '')) || null;
            }
          }
          
          if (retweetButton) {
            const ariaLabel = retweetButton.getAttribute('aria-label') || '';
            const retweetMatch = ariaLabel.match(/([\d,]+)/);
            if (retweetMatch) {
              retweetCount = parseInt(retweetMatch[1].replace(/,/g, '')) || null;
            }
          }
          
          if (likeButton) {
            const ariaLabel = likeButton.getAttribute('aria-label') || '';
            const likeMatch = ariaLabel.match(/([\d,]+)/);
            if (likeMatch) {
              likeCount = parseInt(likeMatch[1].replace(/,/g, '')) || null;
            }
          }
          
          // Fallback to text content if aria-label didn't work
          if (replyCount === null || retweetCount === null || likeCount === null) {
            const metrics = card.querySelectorAll('[role="group"] [data-testid*="count"]');
            metrics.forEach(metric => {
              const text = metric.textContent || '';
              const value = parseInt(text.replace(/[^0-9]/g, '')) || null;
              const testId = metric.getAttribute('data-testid') || '';
              
              if (testId.includes('reply') && replyCount === null) replyCount = value;
              if (testId.includes('retweet') && retweetCount === null) retweetCount = value;
              if (testId.includes('like') && likeCount === null) likeCount = value;
            });
          }
          
          // Try to get view count (may not be available)
          const viewElement = Array.from(card.querySelectorAll('[role="group"] a')).find(
            el => el.textContent?.includes('View')
          );
          if (viewElement) {
            const viewText = viewElement.textContent || '';
            const viewMatch = viewText.match(/([\d,]+)\s*Views?/i);
            if (viewMatch) {
              viewCount = parseInt(viewMatch[1].replace(/,/g, ''));
            }
          }
          
          // Get author
          const authorLink = card.querySelector('a[href^="/"][href*="/status/"]') as HTMLAnchorElement;
          const authorHandle = authorLink?.href.match(/\.com\/([^/]+)/)?.[1] || '';
          const authorNameElement = card.querySelector('[data-testid="User-Name"]');
          const authorName = authorNameElement?.textContent?.split('@')[0]?.trim() || '';
          
          // Get timestamp
          const timeElement = card.querySelector('time');
          const datetime = timeElement?.getAttribute('datetime') || '';
          const postedAt = datetime ? new Date(datetime) : new Date();
          const ageMinutes = (Date.now() - postedAt.getTime()) / (60 * 1000);
          
          return {
            tweet_id: tweetId,          
            tweet_url: tweetUrl,        
            author_handle: authorHandle,
            author_name: authorName,    
            tweet_content: content,     
            like_count: likeCount,      
            reply_count: replyCount,    
            retweet_count: retweetCount,
            view_count: viewCount,      
            tweet_posted_at: postedAt.toISOString(),        
            age_minutes: ageMinutes,    
            is_reply: isReply,          
            is_retweet: isRetweet,
            in_reply_to_tweet_id: inReplyToTweetId,
            conversation_id: conversationId,
          };
        } catch (err) {
          return null;
        }
      }).filter(t => t !== null);
    });
    
    // Add new tweets (deduplicate)
    const existingIds = new Set(tweets.map(t => t.tweet_id));
    for (const tweet of newTweets as any[]) {
      if (!existingIds.has(tweet.tweet_id)) {
        tweets.push({
          ...tweet,
          tweet_posted_at: new Date(tweet.tweet_posted_at),
          velocity: tweet.like_count / Math.max(tweet.age_minutes, 10),
          is_root_tweet: !tweet.is_reply && !tweet.is_retweet,
          is_reply_tweet: tweet.is_reply,
          is_quote: false, // TODO: Detect quote tweets
        });
        existingIds.add(tweet.tweet_id);
      }
    }
    
    if (tweets.length >= max_tweets) break;
    
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    scrollAttempts++;
  }
  
  return tweets.slice(0, max_tweets);
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER DETERMINATION
// ═══════════════════════════════════════════════════════════════════════════

function determineTier(likes: number, views?: number): 'A+' | 'A' | 'B' | 'C' | 'D' {
  // Tier A+: 1M+ views OR 100K+ likes
  if ((views && views >= 1000000) || likes >= 100000) return 'A+';
  
  // Tier A: 100K+ likes (if no A+ from views)
  if (likes >= 100000) return 'A';
  
  // Tier B: 25K+ likes
  if (likes >= 25000) return 'B';
  
  // Tier C: 10K+ likes
  if (likes >= 10000) return 'C';
  
  // Tier D: 2.5K+ likes
  return 'D';
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize tier value to match DB constraint
 * DB allows ONLY: 'TITAN' | 'ULTRA' | 'MEGA' | 'SUPER' | 'HIGH' | 'golden' | 'good' | 'acceptable'
 * 
 * Conservative mapping:
 * - If already valid → keep it
 * - Map common patterns (A+, A, B, C, D, S, SS, etc) → allowed values
 * - Otherwise → default to 'acceptable'
 * 
 * @param rawTier The tier string to normalize
 * @param isHighValueTier If true, treats S/A/B as high-value tiers; if false, treats as harvest tiers
 * @returns One of the allowed DB tier values
 */
function normalizeTier(rawTier: string, isHighValueTier: boolean = false): 'TITAN' | 'ULTRA' | 'MEGA' | 'SUPER' | 'HIGH' | 'golden' | 'good' | 'acceptable' {
  const tierStr = String(rawTier || '').trim();
  const upperTier = tierStr.toUpperCase();
  
  // Allowed DB values (exact match, case-sensitive for legacy values)
  const allowedTiers: Array<'TITAN' | 'ULTRA' | 'MEGA' | 'SUPER' | 'HIGH' | 'golden' | 'good' | 'acceptable'> = 
    ['TITAN', 'ULTRA', 'MEGA', 'SUPER', 'HIGH', 'golden', 'good', 'acceptable'];
  
  // If already a valid DB tier, return as-is (preserve case for legacy values)
  if (allowedTiers.includes(tierStr as any)) {
    return tierStr as any;
  }
  
  // Check uppercase match for case-insensitive comparison
  if (upperTier === 'TITAN') return 'TITAN';
  if (upperTier === 'ULTRA') return 'ULTRA';
  if (upperTier === 'MEGA') return 'MEGA';
  if (upperTier === 'SUPER') return 'SUPER';
  if (upperTier === 'HIGH') return 'HIGH';
  if (upperTier === 'GOLDEN') return 'golden';
  if (upperTier === 'GOOD') return 'good';
  if (upperTier === 'ACCEPTABLE') return 'acceptable';
  
  // Map high-value tiers (S/A/B) if flagged as such
  if (isHighValueTier) {
    if (upperTier === 'S' || upperTier === 'SS') return 'SUPER';      // High-value fresh opportunities
    if (upperTier === 'A') return 'HIGH';       // Good engagement opportunities
    if (upperTier === 'B') return 'acceptable'; // Fallback/unknown metrics
  }
  
  // Map harvest tiers (A+/A/B/C/D) and other common patterns
  if (upperTier === 'A+' || upperTier === 'A_PLUS') return 'ULTRA';
  if (upperTier === 'A') return 'MEGA';
  if (upperTier === 'B') return 'SUPER';
  if (upperTier === 'C') return 'HIGH';
  if (upperTier === 'D') return 'acceptable';
  
  // Handle single-letter variations
  if (upperTier === 'S') return 'SUPER';
  if (upperTier === 'SS' || upperTier === 'S+') return 'SUPER';
  
  // Default fallback - always return a valid value
  return 'acceptable';
}

async function storeOpportunity(
  tweet: ScrapedTweet,
  quality: any,
  tier: string,
  storedReason?: string,
  likesPerMin?: number,
  repliesPerMin?: number,
  repostsPerMin?: number,
  opportunityScore?: number,
  metricsStatus?: 'known' | 'unknown',
  precomputedScores?: { relevance_score: number; replyability_score: number }
): Promise<{ relevance_score: number; replyability_score: number }> {
  const supabase = getSupabaseClient();
  
  // 🔢 FIX: Ensure age_minutes is an INTEGER (not float/string)
  const ageMinutesRaw = tweet.age_minutes || 0;
  const ageMinutesInt = Math.floor(Math.max(ageMinutesRaw, 0)); // Always integer, never negative
  
  // Calculate velocity metrics (per minute) - handle null metrics
  const ageMinutes = Math.max(ageMinutesInt, 1); // Avoid division by zero
  const computedLikesPerMin = likesPerMin ?? (tweet.like_count !== null && tweet.like_count !== undefined ? tweet.like_count / ageMinutes : null);
  const computedRepliesPerMin = repliesPerMin ?? (tweet.reply_count !== null && tweet.reply_count !== undefined ? tweet.reply_count / ageMinutes : null);
  const computedRepostsPerMin = repostsPerMin ?? (tweet.retweet_count !== null && tweet.retweet_count !== undefined ? tweet.retweet_count / ageMinutes : null);
  
  // Determine metrics status
  const finalMetricsStatus = metricsStatus || (tweet.like_count === null || tweet.like_count === undefined ? 'unknown' : 'known');
  
  // 🎯 HIGH-VALUE TIER ASSIGNMENT
  // Tier_S: Fresh + high engagement (age<=90 AND (likes>=500 OR likes_per_min>=8))
  // Tier_A: Good engagement (age<=180 AND (likes>=200 OR likes_per_min>=3))
  // Tier_B: Otherwise (or unknown metrics)
  let valueTier: 'S' | 'A' | 'B';
  if (finalMetricsStatus === 'unknown' || tweet.like_count === null || tweet.like_count === undefined) {
    // Unknown metrics -> Tier B
    valueTier = 'B';
  } else if (ageMinutesInt <= 90 && (tweet.like_count >= 500 || (computedLikesPerMin !== null && computedLikesPerMin >= 8))) {
    valueTier = 'S';
  } else if (ageMinutesInt <= 180 && (tweet.like_count >= 200 || (computedLikesPerMin !== null && computedLikesPerMin >= 3))) {
    valueTier = 'A';
  } else {
    valueTier = 'B';
  }
  
  // 🔧 FIX: Normalize tier to match DB constraint
  // valueTier is always 'S' | 'A' | 'B' (high-value tiers)
  // tier is the harvest tier (A+/A/B/C/D or similar)
  const tierNormalized = normalizeTier(valueTier, true); // true = high-value tier
  const harvestTierNormalized = normalizeTier(tier, false); // false = harvest tier
  
  // Calculate score (views-first)
  const baseMetric = tweet.view_count || tweet.like_count;
  const freshnessMultiplier = tweet.age_minutes < 30 ? 2.0 :
                               tweet.age_minutes < 60 ? 1.5 :
                               tweet.age_minutes < 180 ? 1.0 :
                               tweet.age_minutes < 720 ? 0.7 : 0.5;
  
  const velocityMultiplier = Math.min(Math.max(tweet.velocity / 10, 0.8), 2.0);
  const qualityMultiplier = quality.multiplier;
  
  // Boost score for high-value tiers
  const tierMultiplier = valueTier === 'S' ? 2.0 : valueTier === 'A' ? 1.5 : 1.0;
  
  const score = baseMetric * freshnessMultiplier * velocityMultiplier * qualityMultiplier * tierMultiplier;
  
  // 🔢 FIX: Ensure all integer columns are integers
  const likeCountInt = tweet.like_count !== null && tweet.like_count !== undefined ? Math.floor(tweet.like_count) : null;
  const replyCountInt = tweet.reply_count !== null && tweet.reply_count !== undefined ? Math.floor(tweet.reply_count) : null;
  const retweetCountInt = tweet.retweet_count !== null && tweet.retweet_count !== undefined ? Math.floor(tweet.retweet_count) : null;
  const viewCountInt = tweet.view_count !== null && tweet.view_count !== undefined ? Math.floor(tweet.view_count) : null;
  
  // 🎯 COMPUTE RELEVANCE & REPLYABILITY SCORES
  // Note: computeRelevanceReplyabilityScores internally passes relevanceScore to computeReplyabilityScore
  // Use precomputed scores if provided (for consistency), otherwise compute here
  const relevanceReplyability = precomputedScores || computeRelevanceReplyabilityScores(
    tweet.tweet_content,
    tweet.author_handle,
    tweet.tweet_url
  );
  
  // 🎯 COMPUTE CONTEXT SIMILARITY (brand anchor matching)
  const contextSimilarity = computeContextSimilarity(tweet.tweet_content);
  
  // 🎯 COMPUTE FINAL OPPORTUNITY SCORE (weighted formula)
  const opportunityScoreFinal = computeOpportunityScoreFinal(
    relevanceReplyability.relevance_score,
    relevanceReplyability.replyability_score,
    contextSimilarity
  );
  
  // 📊 STRUCTURED LOG BEFORE UPSERT (tier + scores, no secrets)
  const tierSaved = tierNormalized; // What we actually save to DB
  console.log(`[OPP_UPSERT] tweet_id=${tweet.tweet_id} tier_raw=${valueTier} tier_norm=${tierNormalized} tier_saved=${tierSaved} relevance=${relevanceReplyability.relevance_score.toFixed(2)} replyability=${relevanceReplyability.replyability_score.toFixed(2)} context_sim=${contextSimilarity.toFixed(2)} score_final=${opportunityScoreFinal.toFixed(2)}`);
  
  const { error } = await supabase
    .from('reply_opportunities')
    .upsert({
      target_tweet_id: tweet.tweet_id,
      target_tweet_url: tweet.tweet_url,
      target_username: tweet.author_handle,
      target_tweet_content: tweet.tweet_content,
      like_count: likeCountInt,
      reply_count: replyCountInt,
      retweet_count: retweetCountInt,
      view_count: viewCountInt,
      tweet_posted_at: tweet.tweet_posted_at.toISOString(),
      posted_minutes_ago: ageMinutesInt, // 🔢 FIX: Always integer
      opportunity_score: score, // Legacy score (kept for compatibility)
      relevance_score: relevanceReplyability.relevance_score,
      replyability_score: relevanceReplyability.replyability_score,
      context_similarity: contextSimilarity, // 🆕 NEW: Brand anchor similarity
      opportunity_score_final: opportunityScoreFinal, // 🆕 NEW: Weighted final score
      status: 'pending',
      replied_to: false,
      is_root_tweet: true,
      is_reply_tweet: false,
      root_tweet_id: tweet.tweet_id,
      tier: tierSaved, // 🔧 FIX: Use tierSaved (normalized) - matches log
      harvest_tier: harvestTierNormalized, // 🔧 FIX: Normalized harvest tier
      likes_per_min: likesPerMin,
      replies_per_min: repliesPerMin,
      reposts_per_min: repostsPerMin,
      target_quality_score: quality.score,
      target_quality_tier: quality.quality_tier,
      target_quality_reasons: quality.reasons,              
      account_username: 'xBOT_health', // Our account       
      harvest_source: 'seed_account',   
      harvest_source_detail: tweet.author_handle,
      target_in_reply_to_tweet_id: tweet.in_reply_to_tweet_id,
      target_conversation_id: tweet.conversation_id,
      selection_reason: 'harvest_v2', // Track that this was harvested
    }, {
      onConflict: 'target_tweet_id',
    });
  
  if (error) {
    throw new Error(`DB upsert failed: ${error.message}`);
  }
  
  // Return scores for tier counting
  return {
    relevance_score: relevanceReplyability.relevance_score,
    replyability_score: relevanceReplyability.replyability_score,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { SEED_ACCOUNTS, SeedAccount, HarvestResult };

