/**
 * 🌾 REPLY OPPORTUNITY HARVESTER
 * 
 * Continuously harvests fresh reply opportunities from discovered accounts
 * 
 * Goals:
 * - Keep 200-300 opportunities in pool at all times
 * - Only harvest tweets <24 hours old
 * - Scrape 10-20 accounts per cycle
 * - Run every 20 minutes (optimized frequency)
 */

import { getSupabaseClient } from '../db';

export async function replyOpportunityHarvester(): Promise<void> {
  console.log('[HARVESTER] 🌾 Starting reply opportunity harvesting...');
  
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
    
  // Step 3: Get discovered accounts (MEGA-IMPACT STRATEGY - tiered by viral potential)
  // 🚀 TIER 1: MEGA-ACCOUNTS (1M+ followers) - produce 50k+ like tweets
  // 🎯 TIER 2: SUPER-ACCOUNTS (500k-1M followers) - produce 20k+ like tweets  
  // ✅ TIER 3: HIGH-ACCOUNTS (100k-500k followers) - produce 10k+ like tweets
  // 📊 TIER 4: REGULAR-ACCOUNTS (50k-100k followers) - produce 5k+ like tweets
  
  // Get MEGA accounts first (highest viral potential)
  const { data: megaAccounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, quality_score, engagement_rate, scrape_priority')
    .gte('follower_count', 1000000)  // 🚀 1M+ followers (mega-accounts)
    .gte('engagement_rate', 0.005)     // 0.5%+ engagement (viral potential)
    .order('follower_count', { ascending: false })  // Biggest first
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(50); // Scrape top 50 mega accounts
  
  // Get SUPER accounts (high viral potential)
  const { data: superAccounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, quality_score, engagement_rate, scrape_priority')
    .gte('follower_count', 500000)
    .lt('follower_count', 1000000)   // 500k-1M followers
    .gte('engagement_rate', 0.008)     // 0.8%+ engagement
    .order('follower_count', { ascending: false })
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(100);
  
  // Get HIGH accounts (good viral potential)
  const { data: highAccounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, quality_score, engagement_rate, scrape_priority')
    .gte('follower_count', 100000)
    .lt('follower_count', 500000)    // 100k-500k followers
    .gte('engagement_rate', 0.01)     // 1%+ engagement
    .order('follower_count', { ascending: false })
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(150);
  
  // Combine with prioritization: MEGA first, then SUPER, then HIGH
  const accounts = [
    ...(megaAccounts || []),
    ...(superAccounts || []),
    ...(highAccounts || [])
  ];
  
  if (!accounts || accounts.length === 0) {
    console.log('[HARVESTER] ⚠️ No accounts in pool, waiting for discovery job');
    return;
  }
  
  console.log(`[HARVESTER] 📋 Found ${accounts.length} high-quality accounts in pool`);
  
  // Step 4: TIME-BOXED PARALLEL HARVESTING (OPTIMIZED FOR STABILITY)
  const { realTwitterDiscovery } = await import('../ai/realTwitterDiscovery');
  const { getReplyQualityScorer } = await import('../intelligence/replyQualityScorer');
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  let totalHarvested = 0;
  let accountsProcessed = 0;
  
  const TIME_BUDGET = 45 * 60 * 1000; // 45 minutes max (increased for mega-account scraping)
  const BATCH_SIZE = 3; // Process 3 accounts simultaneously (increased for speed)
  const startTime = Date.now();
  
  console.log(`[HARVESTER] 🚀 Starting MEGA-IMPACT harvesting (time budget: 45min, batch size: 3)...`);
  console.log(`[HARVESTER] 📊 Account tiers: ${megaAccounts?.length || 0} MEGA (1M+), ${superAccounts?.length || 0} SUPER (500k-1M), ${highAccounts?.length || 0} HIGH (100k-500k)`);
  
  // Process accounts in parallel batches until time runs out
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    // Check time budget
    const elapsed = Date.now() - startTime;
    if (elapsed >= TIME_BUDGET) {
      console.log(`[HARVESTER] ⏰ Time budget exhausted (${(elapsed/1000).toFixed(1)}s) - processed ${accountsProcessed} accounts`);
      break;
    }
    
    // Get next batch (10 accounts)
    const batch = accounts.slice(i, i + BATCH_SIZE);
    
    console.log(`[HARVESTER]   Batch ${Math.floor(i/BATCH_SIZE) + 1}: Processing ${batch.length} accounts in parallel...`);
    
    // Scrape accounts IN PARALLEL (with semaphore protection)
    const batchResults = await Promise.allSettled(
      batch.map(async (account) => {
        try {
          console.log(`[HARVESTER]     → @${account.username} (${account.follower_count?.toLocaleString()} followers, priority: ${account.scrape_priority || 50})...`);
          
          // 🔒 BROWSER SEMAPHORE: Acquire browser lock for harvesting (priority 3)
          const opportunities = await withBrowserLock(
            `harvest_${account.username}`,
            BrowserPriority.HARVESTING,
            async () => {
              return await realTwitterDiscovery.findReplyOpportunitiesFromAccount(
                String(account.username),
                Number(account.follower_count) || 0,  // Pass follower count for engagement rate
                account.engagement_rate ? Number(account.engagement_rate) : undefined  // Pass account engagement rate
              );
            }
          );
          
          // Update last_scraped_at
          await supabase
            .from('discovered_accounts')
            .update({ last_scraped_at: new Date().toISOString() })
            .eq('username', account.username);
          
          return { account, opportunities };
        } catch (error: any) {
          console.error(`[HARVESTER]       ✗ Failed @${account.username}:`, error.message);
          return { account, opportunities: [] };
        }
      })
    );
    
    // Collect results and store opportunities in database
    const allOpportunitiesInBatch: any[] = [];
    
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.opportunities.length > 0) {
        const { account, opportunities } = result.value;
        totalHarvested += opportunities.length;
        accountsProcessed++;
        
        // Collect for batch storage
        allOpportunitiesInBatch.push(...opportunities);
        
        // Log tier breakdown
        const golden = opportunities.filter((o: any) => o.tier === 'golden').length;
        const good = opportunities.filter((o: any) => o.tier === 'good').length;
        const acceptable = opportunities.filter((o: any) => o.tier === 'acceptable').length;
        
        console.log(`[HARVESTER]       ✓ ${account.username}: ${opportunities.length} opps (${golden} golden, ${good} good, ${acceptable} acceptable)`);
      } else if (result.status === 'fulfilled') {
        accountsProcessed++;
        console.log(`[HARVESTER]       ✗ ${batch[idx].username}: No opportunities`);
      }
    });
    
    // 💾 CRITICAL: Store opportunities in database
    if (allOpportunitiesInBatch.length > 0) {
      try {
        await realTwitterDiscovery.storeOpportunities(allOpportunitiesInBatch);
        console.log(`[HARVESTER]     💾 Stored ${allOpportunitiesInBatch.length} opportunities in database`);
      } catch (error: any) {
        console.error(`[HARVESTER]     ❌ Failed to store opportunities:`, error.message);
      }
    }
    
    // Check if we have enough GOLDEN opportunities to stop early
    const { count: goldenCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'golden')
      .eq('replied_to', false)
      .gt('expires_at', new Date().toISOString());
    
    // Need ~100 golden for 4 replies/hour (96/day) - stop at 120 to be safe
    if ((goldenCount || 0) >= 120) {
      console.log(`[HARVESTER] 🎯 Found ${goldenCount} golden opportunities - stopping early!`);
      break;
    }
    
    // Small delay between batches
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
  
  // Get tier breakdown
  const { count: goldenCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('tier', 'golden')
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: goodCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('tier', 'good')
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const { count: acceptableCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('tier', 'acceptable')
    .eq('replied_to', false)
    .gt('expires_at', new Date().toISOString());
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`[HARVESTER] ✅ Harvest complete in ${elapsed}s!`);
  console.log(`[HARVESTER] 📊 Pool size: ${poolSize} → ${finalPoolSize}`);
  console.log(`[HARVESTER] 🌾 Harvested: ${totalHarvested} new opportunities from ${accountsProcessed} accounts`);
  console.log(`[HARVESTER] 🏆 MEGA-IMPACT breakdown:`);
  console.log(`[HARVESTER]   🚀 MEGA-VIRAL (50K+): ${goldenCount || 0} tweets`);
  console.log(`[HARVESTER]   💎 SUPER-VIRAL (20K+): ${goodCount || 0} tweets`);
  console.log(`[HARVESTER]   ⭐ VIRAL (10K+): ${acceptableCount || 0} tweets`);
  console.log(`[HARVESTER]   📈 TRENDING (5K+): ${(finalPoolSize || 0) - (goldenCount || 0) - (goodCount || 0) - (acceptableCount || 0)} tweets`);
  
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

