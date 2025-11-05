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

export async function replyOpportunityHarvester(): Promise<void> {
  console.log('[HARVESTER] 🔍 Starting TWEET-FIRST viral search harvesting...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Step 1: Check current pool size
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { count: currentOpportunities } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
    
    const poolSize = currentOpportunities || 0;
    console.log(`[HARVESTER] 📊 Current pool: ${poolSize} opportunities (<24h old)`);
    
    // Step 2: Decide if we need to harvest
    // Need ~200 opportunities for 4 replies/hour (96/day with safety buffer)
    const MIN_POOL_SIZE = 150;
    const TARGET_POOL_SIZE = 250;
    
    if (poolSize >= TARGET_POOL_SIZE) {
      console.log(`[HARVESTER] ✅ Pool is full (${poolSize}/${TARGET_POOL_SIZE}), skipping harvest`);
      return;
    }
    
    const needToHarvest = TARGET_POOL_SIZE - poolSize;
    console.log(`[HARVESTER] 🎯 Need to harvest ~${needToHarvest} opportunities`);
    
  // Step 3: Define Twitter search queries (TWEET-FIRST STRATEGY)
  // Search directly for viral health tweets by engagement level
  // Format: {query, minLikes, maxReplies, label}
  
  const searchQueries = [
    // MEGA-VIRAL (50k+ likes) - Ultra high-impact
    { query: 'health OR longevity OR biohacking', minLikes: 50000, maxReplies: 1000, label: 'MEGA-VIRAL (Health)' },
    { query: 'fitness OR nutrition OR wellness', minLikes: 50000, maxReplies: 1000, label: 'MEGA-VIRAL (Fitness)' },
    
    // SUPER-VIRAL (20k+ likes) - Super high-impact
    { query: 'health OR longevity OR sleep', minLikes: 20000, maxReplies: 600, label: 'SUPER-VIRAL (Health)' },
    { query: 'nutrition OR diet OR supplements', minLikes: 20000, maxReplies: 600, label: 'SUPER-VIRAL (Nutrition)' },
    
    // VIRAL (10k+ likes) - High-impact
    { query: 'health OR wellness OR mental', minLikes: 10000, maxReplies: 400, label: 'VIRAL (Health)' },
    { query: 'fitness OR exercise OR workout', minLikes: 10000, maxReplies: 400, label: 'VIRAL (Fitness)' },
    
    // TRENDING (5k+ likes) - Good impact
    { query: 'health OR medical OR doctor', minLikes: 5000, maxReplies: 300, label: 'TRENDING (Health)' },
    { query: 'nutrition OR food OR eating', minLikes: 5000, maxReplies: 300, label: 'TRENDING (Nutrition)' },
    { query: 'sleep OR energy OR recovery', minLikes: 5000, maxReplies: 300, label: 'TRENDING (Recovery)' },
    { query: 'longevity OR aging OR biohacking', minLikes: 5000, maxReplies: 300, label: 'TRENDING (Longevity)' }
  ];
  
  console.log(`[HARVESTER] 🔍 Configured ${searchQueries.length} search queries for viral health content`);
  
  // Step 4: TIME-BOXED SEARCH-BASED HARVESTING
  const { realTwitterDiscovery } = await import('../ai/realTwitterDiscovery');
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  let totalHarvested = 0;
  let searchesProcessed = 0;
  
  const TIME_BUDGET = 30 * 60 * 1000; // 30 minutes max
  const startTime = Date.now();
  
  console.log(`[HARVESTER] 🚀 Starting TWEET-FIRST search harvesting (time budget: 30min)...`);
  
  // Process search queries sequentially (can't parallelize searches easily)
  for (const searchQuery of searchQueries) {
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
            searchQuery.query,
            searchQuery.minLikes,
            searchQuery.maxReplies
          );
        }
      );
      
      searchesProcessed++;
      
      if (opportunities.length > 0) {
        totalHarvested += opportunities.length;
        
        // 💾 CRITICAL: Store opportunities in database
        try {
          await realTwitterDiscovery.storeOpportunities(opportunities);
          
          // Log tier breakdown
          const megaViral = opportunities.filter((o: any) => o.like_count >= 50000).length;
          const superViral = opportunities.filter((o: any) => o.like_count >= 20000 && o.like_count < 50000).length;
          const viral = opportunities.filter((o: any) => o.like_count >= 10000 && o.like_count < 20000).length;
          const trending = opportunities.filter((o: any) => o.like_count >= 5000 && o.like_count < 10000).length;
          
          console.log(`[HARVESTER]     ✓ Found ${opportunities.length} opps: ${megaViral} mega, ${superViral} super, ${viral} viral, ${trending} trending`);
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
    const { count: highImpactCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('like_count', 5000)
      .eq('replied_to', false)
      .gt('expires_at', new Date().toISOString());
    
    // Need ~100 high-impact for 4 replies/hour (96/day) - stop at 150 to be safe
    if ((highImpactCount || 0) >= 150) {
      console.log(`[HARVESTER] 🎯 Found ${highImpactCount} high-impact opportunities (5K+ likes) - stopping early!`);
      break;
    }
    
    // Small delay between searches (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
    
    // Step 5: Clean up old opportunities (>24 hours)
    const { error: cleanupError } = await supabase
      .from('reply_opportunities')
      .delete()
      .lt('tweet_posted_at', twentyFourHoursAgo.toISOString());
    
    if (cleanupError) {
      console.warn(`[HARVESTER] ⚠️ Failed to clean up old opportunities:`, cleanupError.message);
    } else {
      console.log(`[HARVESTER] 🧹 Cleaned up opportunities >24h old`);
    }
    
  // Step 6: Report final status with tier breakdown
  const { count: finalCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
  
  const finalPoolSize = finalCount || 0;
  
  // Get tier breakdown by like_count (MEGA-IMPACT tiers)
  const { count: megaViralCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 50000)
    .lt('reply_count', 1000)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: superViralCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 20000)
    .lt('like_count', 50000)
    .lt('reply_count', 600)
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: viralCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('like_count', 10000)
    .lt('like_count', 20000)
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
  console.log(`[HARVESTER] 🏆 MEGA-IMPACT breakdown (total in pool):`);
  console.log(`[HARVESTER]   🚀 MEGA-VIRAL (50K+ likes): ${megaViralCount || 0} tweets`);
  console.log(`[HARVESTER]   💎 SUPER-VIRAL (20K+ likes): ${superViralCount || 0} tweets`);
  console.log(`[HARVESTER]   ⭐ VIRAL (10K+ likes): ${viralCount || 0} tweets`);
  console.log(`[HARVESTER]   📈 TRENDING (5K+ likes): ${trendingCount || 0} tweets`);
  
  if (finalPoolSize < MIN_POOL_SIZE) {
    console.warn(`[HARVESTER] ⚠️ Pool still low (${finalPoolSize}/${MIN_POOL_SIZE})`);
    console.log(`[HARVESTER] 💡 Will harvest more in next cycle`);
  } else {
    console.log(`[HARVESTER] ✅ Pool healthy (${finalPoolSize}/${TARGET_POOL_SIZE})`);
  }
    
  } catch (error: any) {
    console.error('[HARVESTER] ❌ Harvest failed:', error.message);
    throw error;
  }
}

