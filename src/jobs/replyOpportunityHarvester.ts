/**
 * 🌾 REPLY OPPORTUNITY HARVESTER - TWEET-FIRST STRATEGY
 * 
 * Searches Twitter directly for viral health tweets (5k-50k+ likes)
 * Instead of scraping accounts, we search for tweets that meet our criteria
 * 
 * Strategy:
 * - Search Twitter for health content with min_faves (5k/10k/20k/50k)
 * - Find ALL viral tweets regardless of account
 * - Guaranteed high engagement (search filters it)
 * - No wasted scraping on accounts with no viral tweets
 * 
 * Goals:
 * - Keep 200-300 opportunities in pool at all times
 * - Only harvest tweets <24 hours old
 * - Run 8-10 searches per cycle (different topics + engagement levels)
 * - Run every 20 minutes (optimized frequency)
 */

import { getSupabaseClient } from '../db';
import { realTwitterDiscovery } from '../ai/realTwitterDiscovery';

const MAX_RECOVERY_ATTEMPTS = Number(process.env.HARVESTER_RECOVERY_ATTEMPTS ?? 2);

/**
 * Classify opportunity by engagement tier
 * Used for performance analytics and adaptive targeting
 */
function classifyEngagementTier(likeCount: number): string {
  if (likeCount >= 100000) return 'EXTREME_VIRAL';
  if (likeCount >= 50000) return 'ULTRA_VIRAL';
  if (likeCount >= 25000) return 'MEGA_VIRAL';
  if (likeCount >= 10000) return 'VIRAL';
  if (likeCount >= 5000) return 'TRENDING';
  if (likeCount >= 2000) return 'POPULAR';
  if (likeCount >= 1000) return 'RISING';
  return 'MODERATE';
}

export async function replyOpportunityHarvester(recoveryAttempt = 0): Promise<void> {
  console.log('[HARVESTER] 🔍 Starting TWEET-FIRST viral search harvesting...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Step 0: Purge opportunities we already replied to
    const { data: repliedRows, error: repliedError } = await supabase
      .from('content_metadata')
      .select('target_tweet_id')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .not('target_tweet_id', 'is', null)
      .gte('posted_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
    
    if (repliedError) {
      console.warn('[HARVESTER] ⚠️ Unable to fetch replied tweet IDs for cleanup:', repliedError.message);
    } else if (repliedRows && repliedRows.length > 0) {
      const repliedIds = repliedRows
        .map(row => String(row.target_tweet_id || '').trim())
        .filter(id => id.length > 0);
      if (repliedIds.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < repliedIds.length; i += chunkSize) {
          const chunk = repliedIds.slice(i, i + chunkSize);
          const { error: cleanupError } = await supabase
            .from('reply_opportunities')
            .delete()
            .in('target_tweet_id', chunk);
          if (cleanupError) {
            console.warn('[HARVESTER] ⚠️ Failed to clean replied opportunities chunk:', cleanupError.message);
            break;
          }
        }
      }
    }
    
    // Step 1: Check current pool size
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const thirtySixHoursAgo = new Date(Date.now() - 36 * 60 * 60 * 1000);
    
    const { count: currentOpportunities } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
    
    const poolSize = currentOpportunities || 0;
    const initialPoolSize = poolSize;
    const MIN_POOL_SIZE = 150;
    const TARGET_POOL_SIZE = 250;
  const poolWasCritical = poolSize < MIN_POOL_SIZE;
    const harvestStartIso = new Date().toISOString();
    console.log(`[HARVESTER] 📊 Current pool: ${poolSize} opportunities (<24h old)`);
    
    // Step 2: Decide if we need to harvest
    // Need ~200 opportunities for 4 replies/hour (96/day with safety buffer)
    
    if (poolSize >= TARGET_POOL_SIZE) {
      console.log(`[HARVESTER] ✅ Pool is full (${poolSize}/${TARGET_POOL_SIZE}), skipping harvest`);
      return;
    }
    
    const needToHarvest = TARGET_POOL_SIZE - poolSize;
    console.log(`[HARVESTER] 🎯 Need to harvest ~${needToHarvest} opportunities`);
    
  // Step 2.5: PROVEN ACCOUNT PRIORITY SEARCH (🧠 LEARNING-POWERED)
  // Query discovered_accounts for high performers and search them FIRST
  let provenAccountOpportunities = 0;
  try {
    const { data: topAccounts, error: accountError } = await supabase
      .from('discovered_accounts')
      .select('username, avg_followers_per_reply, total_replies_count')
      .gte('avg_followers_per_reply', 8) // Accounts that drive 8+ followers per reply
      .order('avg_followers_per_reply', { ascending: false })
      .limit(15);

    if (!accountError && topAccounts && topAccounts.length > 0) {
      console.log(`[HARVESTER] 🧠 Found ${topAccounts.length} PROVEN PERFORMERS - searching them FIRST`);
      
      // Build priority search query
      const accountQuery = topAccounts.map(a => `from:${a.username}`).join(' OR ');
      const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
      
      const provenQuery = {
        label: 'PROVEN PERFORMERS (Priority)',
        minLikes: 3000, // Lower threshold for proven accounts
        maxReplies: 300,
        maxAgeHours: 12, // Fresh tweets only
        query: `(${accountQuery}) min_faves:3000 -filter:replies lang:en`
      };

      console.log(`[HARVESTER] 🚀 Priority search: ${topAccounts.map(a => '@' + a.username).join(', ')}`);
      
      const provenOpps = await withBrowserLock(
        'search_proven_performers',
        BrowserPriority.HARVESTING,
        async () => {
          return await realTwitterDiscovery.findViralTweetsViaSearch(
            provenQuery.minLikes,
            provenQuery.maxReplies,
            provenQuery.label,
            provenQuery.maxAgeHours,
            provenQuery.query
          );
        }
      );

      if (provenOpps && provenOpps.length > 0) {
        provenAccountOpportunities = provenOpps.length;
        
        // Add engagement tier classification
        const oppsWithTiers = provenOpps.map((opp: any) => ({
          ...opp,
          engagement_tier: classifyEngagementTier(opp.like_count || 0)
        }));
        
        await realTwitterDiscovery.storeOpportunities(oppsWithTiers);
        console.log(`[HARVESTER] ✅ PROVEN PERFORMERS: Found ${provenAccountOpportunities} opportunities from high-value accounts`);
      }
    } else {
      console.log(`[HARVESTER] ℹ️  No proven performers yet (need more reply data with followers_gained metadata)`);
    }
  } catch (provenError: any) {
    console.warn(`[HARVESTER] ⚠️ Proven account search failed:`, provenError.message);
  }
    
  // Step 3: Define Twitter search queries (🔥 ENGAGEMENT-FIRST STRATEGY)
  // 
  // 🚀 NEW PRIORITY ORDER:
  // Search HIGH-ENGAGEMENT tweets FIRST (100K+ → 50K+ → 25K+ → 10K+)
  // Then health-focused for quality, then lower engagement as fallback
  // 
  // Strategy:
  // 1. Target mega-viral first (100K+, 50K+, 25K+) - maximum reach
  // 2. AI judges health relevance (GPT-4o-mini)
  // 3. Returns ONLY health-relevant viral tweets
  // 4. Fallback to health-specific if mega-viral pool low
  // 
  // Result: Higher avg engagement per reply = more followers!
  const searchQueries = [
    // TIER 1: MEGA-VIRAL (100K+, 50K+, 25K+) - SEARCH FIRST
    { label: 'EXTREME (100K+)', minLikes: 100000, maxReplies: 1200, maxAgeHours: 96, query: 'min_faves:100000 -filter:replies lang:en -airdrop -giveaway -crypto -nft' },
    { label: 'ULTRA (50K+)', minLikes: 50000, maxReplies: 900, maxAgeHours: 72, query: 'min_faves:50000 -filter:replies lang:en -airdrop -giveaway -crypto -nft' },
    { label: 'MEGA (25K+)', minLikes: 25000, maxReplies: 600, maxAgeHours: 48, query: 'min_faves:25000 -filter:replies lang:en -airdrop -giveaway -crypto -nft -betting -casino' },
    
    // TIER 2: VIRAL (10K+, 5K+) - SEARCH SECOND
    { label: 'VIRAL (10K+)', minLikes: 10000, maxReplies: 400, maxAgeHours: 48, query: 'min_faves:10000 -filter:replies lang:en -airdrop -giveaway -crypto -nft -betting -casino' },
    { label: 'TRENDING (5K+)', minLikes: 5000, maxReplies: 250, maxAgeHours: 24, query: 'min_faves:5000 -filter:replies lang:en -airdrop -giveaway -crypto -nft -betting -casino' },
    
    // TIER 3: HEALTH-FOCUSED HIGH-ENGAGEMENT - SEARCH THIRD
    { label: 'HEALTH VIRAL (5K+)', minLikes: 5000, maxReplies: 250, maxAgeHours: 24, query: '("health" OR "wellness" OR "fitness" OR "nutrition" OR "longevity") min_faves:5000 -filter:replies lang:en -crypto -nft -betting' },
    { label: 'HEALTH TRENDING (2K+)', minLikes: 2000, maxReplies: 200, maxAgeHours: 24, query: '("health" OR "wellness" OR "workout" OR "diet") min_faves:2000 -filter:replies lang:en -crypto -nft -betting' },
    
    // TIER 4: FRESH & QUALITY - SEARCH FOURTH (only if pool needs filling)
    { label: 'BIOHACK (1K+)', minLikes: 1000, maxReplies: 150, maxAgeHours: 48, query: '("biohack" OR "peptide" OR "sauna" OR "cold plunge" OR "hrv" OR "ozempic" OR "testosterone") min_faves:1000 -filter:replies lang:en -crypto -nft' },
    { label: 'FRESH (1K+)', minLikes: 1000, maxReplies: 120, maxAgeHours: 12, query: 'min_faves:1000 -filter:replies lang:en -airdrop -giveaway -crypto -nft -betting -casino -nfl -nba' }
  ];

  const fallbackQueries = [
    { label: 'RESCUE HEALTH (250+)', minLikes: 250, maxReplies: 150, maxAgeHours: 24, query: '("sleep" OR "insulin" OR "glucose" OR "longevity" OR "diet" OR "exercise") min_faves:250 -filter:replies lang:en -giveaway -crypto -nft' },
    { label: 'RESCUE GENERAL (200+)', minLikes: 200, maxReplies: 140, maxAgeHours: 18, query: '(health OR wellness OR recovery OR hospital OR clinic OR doctor OR patients) min_faves:200 -filter:replies lang:en -crypto -nft -betting' },
    { label: 'RESCUE FAST RISING (150+)', minLikes: 150, maxReplies: 100, maxAgeHours: 12, query: '(sleep OR cortisol OR metabolism OR gut OR workout OR gym OR immunity) min_faves:150 -filter:replies lang:en -airdrop -crypto -nft' }
  ];
  
  const testLimitRaw = process.env.HARVESTER_TEST_LIMIT;
  const testLimit = testLimitRaw ? Math.max(1, Math.min(searchQueries.length, parseInt(testLimitRaw, 10) || 1)) : searchQueries.length;
  let queriesToRun = searchQueries.slice(0, testLimit);
  if (poolSize < MIN_POOL_SIZE) {
    queriesToRun.push(...fallbackQueries);
  }
  // 🔧 PERMANENT FIX #1: Support degraded mode operation
  const isDegradedMode = process.env.HARVESTER_DEGRADED_MODE === 'true';
  const baseMaxSearches = Number(process.env.HARVESTER_MAX_SEARCHES_PER_RUN ?? 3);
  const baseMaxCriticalSearches = Number(process.env.HARVESTER_MAX_CRITICAL_SEARCHES_PER_RUN ?? 6);
  
  // In degraded mode, reduce search count but still operate
  const maxSearchesPerRun = isDegradedMode ? Math.max(1, Math.floor(baseMaxSearches / 2)) : baseMaxSearches;
  const maxCriticalSearches = isDegradedMode ? Math.max(2, Math.floor(baseMaxCriticalSearches / 2)) : baseMaxCriticalSearches;
  
  if (isDegradedMode) {
    console.warn('[HARVESTER] ⚠️ DEGRADED MODE: Reduced search count for stability');
  }
  
  const searchLimit = poolWasCritical ? maxCriticalSearches : maxSearchesPerRun;
  if (queriesToRun.length > searchLimit) {
    console.log(`[HARVESTER] ⏳ Limiting to ${searchLimit} searches this cycle (remaining will run next loop)`);
    queriesToRun = queriesToRun.slice(0, searchLimit);
  }
  if (poolWasCritical) {
    console.warn('[HARVESTER] 🚨 CRITICAL MODE: Pool is dangerously low, running extended discovery cycle');
  }

  console.log(`[HARVESTER] 🔥 Configured ${searchQueries.length} ENGAGEMENT-FIRST discovery tiers`);
  console.log(`[HARVESTER] 🎯 Strategy: HIGH-ENGAGEMENT FIRST (100K+ → 50K+ → 25K+ → 10K+)`);
  console.log(`[HARVESTER]   💎 EXTREME tier: 100K+ likes (maximum reach)`);
  console.log(`[HARVESTER]   🚀 ULTRA tier: 50K-100K likes (mega-viral)`);
  console.log(`[HARVESTER]   ⚡ MEGA tier: 25K-50K likes (super-viral)`);
  console.log(`[HARVESTER]   🔥 VIRAL tier: 10K-25K likes (viral reach)`);
  console.log(`[HARVESTER]   📈 TRENDING tier: 5K-10K likes (trending)`);
  console.log(`[HARVESTER] 🤖 AI-powered: GPT-4o-mini judges health relevance (score 0-10)`);
  console.log(`[HARVESTER] 🚫 No topic restrictions - AI filters AFTER scraping`);
  
  // Step 4: TIME-BOXED SEARCH-BASED HARVESTING
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  let totalHarvested = 0;
  let searchesProcessed = 0;
  let highImpactCount = 0;
  
  const TIME_BUDGET = 30 * 60 * 1000; // 30 minutes max
  const startTime = Date.now();
  
  console.log(`[HARVESTER] 🚀 Starting TWEET-FIRST search harvesting (time budget: 30min)...`);
  
  // Process search queries sequentially (can't parallelize searches easily)
  for (const searchQuery of queriesToRun) {
    // Check time budget
    const elapsed = Date.now() - startTime;
    if (elapsed >= TIME_BUDGET) {
      console.log(`[HARVESTER] ⏰ Time budget exhausted (${(elapsed/1000).toFixed(1)}s) - processed ${searchesProcessed} searches`);
      break;
    }
    
    try {
      console.log(`[HARVESTER]   🔍 Searching: ${searchQuery.label} (${searchQuery.minLikes}+ likes)...`);
      
      // 🔒 BROWSER SEMAPHORE: Acquire browser lock for search (priority 3)
      const opportunities = await withBrowserLock(
        `search_${searchQuery.label}`,
        BrowserPriority.HARVESTING,
        async () => {
          return await realTwitterDiscovery.findViralTweetsViaSearch(
            searchQuery.minLikes,
            searchQuery.maxReplies,
            searchQuery.label,
            searchQuery.maxAgeHours || 24, // Pass age limit, default to 24h
            searchQuery.query
          );
        }
      );
      
      searchesProcessed++;
      
      if (opportunities.length > 0) {
        totalHarvested += opportunities.length;
        
        // 💾 CRITICAL: Store opportunities in database with tier classification
        try {
          // Add engagement tier classification to each opportunity
          const opportunitiesWithTiers = opportunities.map((opp: any) => ({
            ...opp,
            engagement_tier: classifyEngagementTier(opp.like_count || 0)
          }));
          
          await realTwitterDiscovery.storeOpportunities(opportunitiesWithTiers);
          
          // Log tier breakdown (updated classification)
          const extreme = opportunities.filter((o: any) => o.like_count >= 100000).length;
          const ultra = opportunities.filter((o: any) => o.like_count >= 50000 && o.like_count < 100000).length;
          const mega = opportunities.filter((o: any) => o.like_count >= 25000 && o.like_count < 50000).length;
          const viral = opportunities.filter((o: any) => o.like_count >= 10000 && o.like_count < 25000).length;
          const trending = opportunities.filter((o: any) => o.like_count >= 5000 && o.like_count < 10000).length;
          
          console.log(`[HARVESTER]     ✓ Found ${opportunities.length} opps: ${extreme} extreme, ${ultra} ultra, ${mega} mega, ${viral} viral, ${trending} trending`);
        } catch (error: any) {
          console.error(`[HARVESTER]     ❌ Failed to store opportunities:`, error.message);
        }
      } else {
        console.log(`[HARVESTER]     ✗ No opportunities found for ${searchQuery.label}`);
      }
      
    } catch (error: any) {
      console.error(`[HARVESTER]     ✗ Search failed for ${searchQuery.label}:`, error.message);
    }
    
    // Check if we have enough high-impact opportunities (5K+ likes) to stop early
    const { count: highImpactCountResult } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('like_count', 5000)
      .eq('replied_to', false)
      .gt('expires_at', new Date().toISOString());
    
    // Need ~100 high-impact for 4 replies/hour (96/day) - stop at 150 to be safe
    highImpactCount = highImpactCountResult || 0;
    if (highImpactCount >= 150) {
      console.log(`[HARVESTER] 🎯 Found ${highImpactCount} high-impact opportunities (5K+ likes) - stopping early!`);
      break;
    }
    
    // Small delay between searches (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Step 5: Clean up old opportunities (only ones older than 36h or already replied/expired)
  const { error: cleanupError } = await supabase
    .from('reply_opportunities')
    .delete()
    .or(`tweet_posted_at.lt.${thirtySixHoursAgo.toISOString()},status.eq.expired,replied_to.eq.true`);
    
    if (cleanupError) {
      console.warn(`[HARVESTER] ⚠️ Failed to clean up old opportunities:`, cleanupError.message);
    } else {
      console.log(`[HARVESTER] 🧹 Cleaned up stale opportunities (>36h or marked expired)`);
    }
    
  // Step 6: Report final status with tier breakdown
  const { count: finalCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
  
  const finalPoolSize = finalCount || 0;
  
  // Get tier breakdown by like_count (NEW TIER STRUCTURE)
  const { count: extremeCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 100000)
    .lt('reply_count', 1200)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: ultraCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 50000)
    .lt('like_count', 100000)
    .lt('reply_count', 900)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: megaCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 25000)
    .lt('like_count', 50000)
    .lt('reply_count', 600)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: viralCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 10000)
    .lt('like_count', 25000)
    .lt('reply_count', 400)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: trendingCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 5000)
    .lt('like_count', 10000)
    .lt('reply_count', 300)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`[HARVESTER] ✅ Harvest complete in ${elapsed}s!`);
  console.log(`[HARVESTER] 📊 Pool size: ${poolSize} → ${finalPoolSize}`);
  console.log(`[HARVESTER] 🔍 Searches processed: ${searchesProcessed}/${searchQueries.length}`);
  console.log(`[HARVESTER] 🌾 Harvested: ${totalHarvested} new viral tweet opportunities`);
  console.log(`[HARVESTER] 🏆 ENGAGEMENT TIER breakdown (total in pool):`);
  console.log(`[HARVESTER]   💎 EXTREME (100K+ likes): ${extremeCount || 0} tweets`);
  console.log(`[HARVESTER]   🚀 ULTRA (50K-100K likes): ${ultraCount || 0} tweets`);
  console.log(`[HARVESTER]   ⚡ MEGA (25K-50K likes): ${megaCount || 0} tweets`);
  console.log(`[HARVESTER]   🔥 VIRAL (10K-25K likes): ${viralCount || 0} tweets`);
  console.log(`[HARVESTER]   📈 TRENDING (5K-10K likes): ${trendingCount || 0} tweets`);
  
  if (finalPoolSize < MIN_POOL_SIZE) {
    console.warn(`[HARVESTER] ⚠️ Pool still low (${finalPoolSize}/${MIN_POOL_SIZE})`);
    console.log(`[HARVESTER] 💡 Auto-recovery logic engaged (attempt ${recoveryAttempt}/${MAX_RECOVERY_ATTEMPTS})`);
    
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_harvester_low_pool',
        severity: 'warning',
        event_data: {
          initial_pool: initialPoolSize,
          final_pool: finalPoolSize,
          harvested: totalHarvested,
          recovery_attempt: recoveryAttempt
        },
        created_at: new Date().toISOString()
      });
    } catch (eventError: any) {
      console.warn('[HARVESTER] ⚠️ Failed to log low pool event:', eventError.message);
    }

    if (recoveryAttempt < MAX_RECOVERY_ATTEMPTS) {
      const waitMs = Math.min(60000, 15000 * (recoveryAttempt + 1));
      console.log(`[HARVESTER] 🔁 Recovery attempt ${recoveryAttempt + 1}/${MAX_RECOVERY_ATTEMPTS} starting in ${Math.round(waitMs / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      await replyOpportunityHarvester(recoveryAttempt + 1);
      return;
    }

    console.error(`[HARVESTER] ❌ Pool remained critical after ${MAX_RECOVERY_ATTEMPTS} recovery attempts`);
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_harvester_recovery_failed',
        severity: 'critical',
        event_data: {
          final_pool: finalPoolSize,
          attempts: MAX_RECOVERY_ATTEMPTS
        },
        created_at: new Date().toISOString()
      });
    } catch (eventError: any) {
      console.warn('[HARVESTER] ⚠️ Failed to log recovery failure:', eventError.message);
    }
  } else {
    console.log(`[HARVESTER] ✅ Pool healthy (${finalPoolSize}/${TARGET_POOL_SIZE})`);
  }
  
  try {
    await supabase
      .from('system_events')
      .insert({
        event_type: 'reply_harvest_summary',
        severity: finalPoolSize < MIN_POOL_SIZE ? 'warning' : poolWasCritical ? 'info' : 'notice',
        event_data: {
          started_at: harvestStartIso,
          initial_pool: initialPoolSize,
          final_pool: finalPoolSize,
          harvested_count: totalHarvested,
          searches_processed: searchesProcessed,
          high_impact_count: highImpactCount || 0,
          extreme: extremeCount || 0,
          ultra: ultraCount || 0,
          mega: megaCount || 0,
          viral: viralCount || 0,
          trending: trendingCount || 0,
          pool_was_critical: poolWasCritical
        },
        created_at: new Date().toISOString()
      });
  } catch (eventError: any) {
    console.warn('[HARVESTER] ⚠️ Failed to log harvest summary event:', eventError.message);
  }
    
  } catch (error: any) {
    console.error('[HARVESTER] ❌ Harvest failed:', error.message);
    throw error;
  }
}

