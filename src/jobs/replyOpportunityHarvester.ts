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
    
    // Step 0.5: 🔒 VISIBILITY-AWARE FRESHNESS GATE
    // High-visibility tweets get longer windows before being purged
    // - 100K+ likes: Keep up to 72 hours
    // - 25K+ likes:  Keep up to 48 hours
    // - 10K+ likes:  Keep up to 24 hours
    // - <10K likes:  Keep up to 3 hours (original gate)
    const now = Date.now();
    let totalPurged = 0;
    
    // Purge low-engagement tweets older than 3 hours
    const lowEngagementThreshold = new Date(now - 180 * 60 * 1000).toISOString();
    const { error: lowPurgeError, count: lowPurgeCount } = await supabase
      .from('reply_opportunities')
      .delete()
      .lt('tweet_posted_at', lowEngagementThreshold)
      .lt('like_count', 10000);
    if (!lowPurgeError && lowPurgeCount) totalPurged += lowPurgeCount;
    
    // Purge 10K-25K tweets older than 24 hours
    const midEngagementThreshold = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { error: midPurgeError, count: midPurgeCount } = await supabase
      .from('reply_opportunities')
      .delete()
      .lt('tweet_posted_at', midEngagementThreshold)
      .gte('like_count', 10000)
      .lt('like_count', 25000);
    if (!midPurgeError && midPurgeCount) totalPurged += midPurgeCount;
    
    // Purge 25K-100K tweets older than 48 hours
    const highEngagementThreshold = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const { error: highPurgeError, count: highPurgeCount } = await supabase
      .from('reply_opportunities')
      .delete()
      .lt('tweet_posted_at', highEngagementThreshold)
      .gte('like_count', 25000)
      .lt('like_count', 100000);
    if (!highPurgeError && highPurgeCount) totalPurged += highPurgeCount;
    
    // Purge mega-viral (100K+) tweets older than 72 hours
    const megaViralThreshold = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const { error: megaPurgeError, count: megaPurgeCount } = await supabase
      .from('reply_opportunities')
      .delete()
      .lt('tweet_posted_at', megaViralThreshold)
      .gte('like_count', 100000);
    if (!megaPurgeError && megaPurgeCount) totalPurged += megaPurgeCount;
    
    if (totalPurged > 0) {
      console.log(`[HARVESTER] 🧹 FRESHNESS GATE: Purged ${totalPurged} stale opportunities (visibility-adjusted)`);
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
  // 🎯 FIXED STRATEGY (Jan 2, 2026):
  // 1. Search HEALTH-FOCUSED queries FIRST (highest AI judge pass rate)
  // 2. Add politics/news exclusions to reduce garbage
  // 3. Lower engagement thresholds (2K-5K) for health content
  // 4. Fallback to mega-viral only if health pool insufficient
  // 
  // Result: 80%+ AI judge pass rate → populated pool → replies flow
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 HIGH-VISIBILITY TIERED HARVESTING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  // Strategy: Target 10K-1M+ likes tweets for MAXIMUM reach
  // Tiers: A (100K+) → B (25K+) → C (10K+) → D (2.5K+ fallback only if pool low)
  // 
  // Why high visibility matters:
  // - 100K+ like tweets = millions of impressions = massive follower potential
  // - Reply to viral = get seen by viral audience
  // - Low engagement tweets = wasted effort (no one sees our replies)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Shared exclusions for all queries
  const POLITICS_EXCLUSION = ' -trump -biden -election -gaza -ukraine -war -breaking -celebrity -shooting -killed -died';
  const SPAM_EXCLUSION = ' -airdrop -giveaway -crypto -nft -betting -casino -OnlyFans -porn';
  
  // Comprehensive health keyword bundle
  const HEALTH_KEYWORDS = '(health OR wellness OR fitness OR nutrition OR diet OR protein OR sleep OR exercise OR workout OR running OR lifting OR cardio OR metabolism OR longevity OR supplement OR creatine OR testosterone OR cortisol OR inflammation OR recovery OR fasting OR glucose OR insulin OR gut OR microbiome OR immune OR vitamin OR mineral OR hydration)';
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER A: MEGA-VIRAL HEALTH (100K+ likes) - SEARCH FIRST
  // ═══════════════════════════════════════════════════════════════════════════
  const tierAQueries = [
    { tier: 'A', label: 'TIER_A_HEALTH_100K', minLikes: 100000, maxReplies: 1000, maxAgeHours: 72, 
      query: `${HEALTH_KEYWORDS} min_faves:100000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
  ];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER B: VIRAL HEALTH (25K+ likes) - SEARCH SECOND
  // ═══════════════════════════════════════════════════════════════════════════
  const tierBQueries = [
    { tier: 'B', label: 'TIER_B_HEALTH_25K', minLikes: 25000, maxReplies: 600, maxAgeHours: 48, 
      query: `${HEALTH_KEYWORDS} min_faves:25000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
    { tier: 'B', label: 'TIER_B_FITNESS_25K', minLikes: 25000, maxReplies: 600, maxAgeHours: 48, 
      query: `(gym OR gains OR muscle OR bodybuilding OR "weight loss" OR running OR marathon) min_faves:25000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
  ];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER C: HIGH-ENGAGEMENT HEALTH (10K+ likes) - SEARCH THIRD
  // ═══════════════════════════════════════════════════════════════════════════
  const tierCQueries = [
    { tier: 'C', label: 'TIER_C_HEALTH_10K', minLikes: 10000, maxReplies: 400, maxAgeHours: 36, 
      query: `${HEALTH_KEYWORDS} min_faves:10000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
    { tier: 'C', label: 'TIER_C_NUTRITION_10K', minLikes: 10000, maxReplies: 400, maxAgeHours: 36, 
      query: `(nutrition OR protein OR diet OR fasting OR calories OR macros OR "seed oils" OR ozempic) min_faves:10000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
    { tier: 'C', label: 'TIER_C_SLEEP_10K', minLikes: 10000, maxReplies: 400, maxAgeHours: 36, 
      query: `(sleep OR insomnia OR melatonin OR circadian OR caffeine OR "deep sleep") min_faves:10000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
  ];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER D: FALLBACK (2.5K+ likes) - ONLY IF POOL CRITICALLY LOW
  // ═══════════════════════════════════════════════════════════════════════════
  const tierDFallback = [
    { tier: 'D', label: 'TIER_D_HEALTH_2500', minLikes: 2500, maxReplies: 200, maxAgeHours: 24, 
      query: `${HEALTH_KEYWORDS} min_faves:2500 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
    { tier: 'D', label: 'TIER_D_BIOHACK_2500', minLikes: 2500, maxReplies: 200, maxAgeHours: 24, 
      query: `(biohacking OR peptides OR sauna OR "cold plunge" OR testosterone OR HRT OR supplements) min_faves:2500 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}` },
  ];
  
  // Build query list based on priority (A → B → C, D only if critical)
  const searchQueries = [...tierAQueries, ...tierBQueries, ...tierCQueries];
  const fallbackQueries = tierDFallback;
  
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

  console.log(`[HARVESTER] 🔥 Configured ${searchQueries.length} HIGH-VISIBILITY tiered queries`);
  console.log(`[HARVESTER] 🎯 Strategy: VISIBILITY-FIRST (10K-1M+ likes for maximum reach)`);
  console.log(`[HARVESTER]   🏆 TIER A: 100K+ likes (mega-viral health)`);
  console.log(`[HARVESTER]   🚀 TIER B: 25K+ likes (viral health/fitness)`);
  console.log(`[HARVESTER]   📈 TIER C: 10K+ likes (high-engagement health)`);
  console.log(`[HARVESTER]   🔄 TIER D: 2.5K+ likes (fallback only if pool critical)`);
  console.log(`[HARVESTER] 🏥 Health keywords: ${HEALTH_KEYWORDS.substring(0, 80)}...`);
  console.log(`[HARVESTER] 🚫 Exclusions: politics, crypto, spam, drama`);
  
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
      const tierLabel = (searchQuery as any).tier || 'X';
      console.log(`[HARVEST_TIER] tier=${tierLabel} query="${searchQuery.label}" min_likes=${searchQuery.minLikes}`);
      
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
      
      // Filter out any reply tweets that slipped through
      const rootOnlyOpps = opportunities.filter((opp: any) => {
        const content = String(opp.tweet_content || opp.target_tweet_content || '');
        // Hard-skip tweets starting with @mention (reply indicators)
        if (content.startsWith('@') || content.toLowerCase().startsWith('replying to @')) {
          console.log(`[HARVEST_TIER] SKIP_REPLY tweet_id=${opp.tweet_id || opp.target_tweet_id} reason=starts_with_@`);
          return false;
        }
        return true;
      });
      
      const skippedReplyCount = opportunities.length - rootOnlyOpps.length;
      
      if (rootOnlyOpps.length > 0) {
        totalHarvested += rootOnlyOpps.length;
        console.log(`[HARVEST_TIER] tier=${tierLabel} query="${searchQuery.label}" scraped=${opportunities.length} kept=${rootOnlyOpps.length} skipped_reply=${skippedReplyCount}`);
        
        // 💾 CRITICAL: Store opportunities in database with tier classification
        try {
          // Add engagement tier + harvest tier + ensure root fields
          const opportunitiesWithTiers = rootOnlyOpps.map((opp: any) => ({
            ...opp,
            engagement_tier: classifyEngagementTier(opp.like_count || 0),
            harvest_tier: tierLabel,
            is_root_tweet: true,
            root_tweet_id: opp.tweet_id || opp.target_tweet_id
          }));
          
          await realTwitterDiscovery.storeOpportunities(opportunitiesWithTiers);
          
          // Log per-opportunity with [HARVEST_STORE]
          for (const opp of opportunitiesWithTiers.slice(0, 5)) { // Log first 5
            const tweetId = opp.tweet_id || opp.target_tweet_id;
            const likes = opp.like_count || 0;
            const ageMin = opp.posted_minutes_ago || 0;
            console.log(`[HARVEST_STORE] tweet_id=${tweetId} likes=${likes} age_min=${ageMin} tier=${tierLabel}`);
          }
          if (opportunitiesWithTiers.length > 5) {
            console.log(`[HARVEST_STORE] ... and ${opportunitiesWithTiers.length - 5} more`);
          }
          
          // Log tier breakdown (updated classification)
          const extreme = rootOnlyOpps.filter((o: any) => o.like_count >= 100000).length;
          const ultra = rootOnlyOpps.filter((o: any) => o.like_count >= 50000 && o.like_count < 100000).length;
          const mega = rootOnlyOpps.filter((o: any) => o.like_count >= 25000 && o.like_count < 50000).length;
          const viral = rootOnlyOpps.filter((o: any) => o.like_count >= 10000 && o.like_count < 25000).length;
          const trending = rootOnlyOpps.filter((o: any) => o.like_count >= 5000 && o.like_count < 10000).length;
          
          console.log(`[HARVEST_TIER] breakdown: ${extreme}×100K+ ${ultra}×50K+ ${mega}×25K+ ${viral}×10K+ ${trending}×5K+`);
        } catch (error: any) {
          console.error(`[HARVEST_TIER] STORE_FAILED tier=${tierLabel} error=${error.message}`);
        }
      } else {
        console.log(`[HARVEST_TIER] tier=${tierLabel} query="${searchQuery.label}" scraped=0`);
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🕐 Report to Autonomous Freshness Controller
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const { reportHarvestResults, getState: getFreshnessState } = await import('../ai/freshnessController');
    const freshnessResult = await reportHarvestResults({
      tier_a_count: extremeCount || 0,
      tier_b_count: (ultraCount || 0) + (megaCount || 0), // 25K-100K combined
      tier_c_count: viralCount || 0,
      tier_d_count: trendingCount || 0,
      total_scraped: searchesProcessed,
      total_stored: totalHarvested,
    });
    
    if (freshnessResult.adjusted) {
      console.log(`[FRESHNESS_CONTROLLER] 🔄 Policy ${freshnessResult.direction}: ${freshnessResult.reason}`);
    }
    
    const freshnessState = getFreshnessState();
    console.log(`[FRESHNESS_CONTROLLER] Current limits: A=${Math.round(freshnessState.current_tier_a_max/60)}h B=${Math.round(freshnessState.current_tier_b_max/60)}h C=${Math.round(freshnessState.current_tier_c_max/60)}h D=${freshnessState.current_tier_d_max}m`);
  } catch (freshnessError: any) {
    console.warn(`[FRESHNESS_CONTROLLER] Failed to report:`, freshnessError.message);
  }
  
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

    // ═══════════════════════════════════════════════════════════════════════
    // 🌟 SEED ACCOUNT FALLBACK - Try scraping known health accounts directly
    // ═══════════════════════════════════════════════════════════════════════
    if (recoveryAttempt === 0) {
      console.log(`[HARVESTER] 🌟 Attempting SEED ACCOUNT FALLBACK (search may be failing)...`);
      try {
        const seedOpportunities = await realTwitterDiscovery.harvestFromSeedAccounts(8);
        if (seedOpportunities.length > 0) {
          console.log(`[HARVESTER] 🌟 Seed harvest returned ${seedOpportunities.length} opportunities!`);
          
          // Mark as root and add expiry
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const processedSeedOpps = seedOpportunities.map(opp => ({
            ...opp,
            is_root_tweet: true,
            root_tweet_id: opp.tweet_id,
            is_reply_tweet: false,
            expires_at: expiresAt.toISOString(),
            harvest_source: 'seed_account_fallback'
          }));
          
          await realTwitterDiscovery.storeOpportunities(processedSeedOpps);
          console.log(`[HARVESTER] ✅ Stored ${processedSeedOpps.length} seed account opportunities`);
          
          // Log tier breakdown from seed harvest
          const seedTierA = processedSeedOpps.filter(o => (o.like_count || 0) >= 100000).length;
          const seedTierB = processedSeedOpps.filter(o => (o.like_count || 0) >= 25000 && (o.like_count || 0) < 100000).length;
          const seedTierC = processedSeedOpps.filter(o => (o.like_count || 0) >= 10000 && (o.like_count || 0) < 25000).length;
          console.log(`[SEED_HARVEST] Tier breakdown: A=${seedTierA} B=${seedTierB} C=${seedTierC}`);
          
          // Check if pool is now acceptable
          const { count: newPoolCount } = await supabase
            .from('reply_opportunities')
            .select('*', { count: 'exact', head: true })
            .eq('replied_to', false)
            .gt('expires_at', new Date().toISOString());
          
          if ((newPoolCount || 0) >= MIN_POOL_SIZE) {
            console.log(`[HARVESTER] ✅ Pool recovered to ${newPoolCount} via seed fallback!`);
            return;
          }
        }
      } catch (seedError: any) {
        console.error(`[HARVESTER] ⚠️ Seed fallback failed:`, seedError.message);
      }
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

