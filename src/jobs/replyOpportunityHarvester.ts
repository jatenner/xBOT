/**
 * 🌾 REPLY OPPORTUNITY HARVESTER
 * 
 * Continuously harvests fresh reply opportunities from discovered accounts
 * 
 * Goals:
 * - Keep 200-300 opportunities in pool at all times
 * - Only harvest tweets <24 hours old
 * - Scrape 10-20 accounts per cycle
 * - Run every 30 minutes
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
    const MIN_POOL_SIZE = 100;
    const TARGET_POOL_SIZE = 300;
    
    if (poolSize >= TARGET_POOL_SIZE) {
      console.log(`[HARVESTER] ✅ Pool is full (${poolSize}/${TARGET_POOL_SIZE}), skipping harvest`);
      return;
    }
    
    const needToHarvest = TARGET_POOL_SIZE - poolSize;
    console.log(`[HARVESTER] 🎯 Need to harvest ~${needToHarvest} opportunities`);
    
  // Step 3: Get discovered accounts (UNLIMITED - sorted by priority)
  const { data: accounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, quality_score, engagement_rate, scrape_priority')
    .gte('follower_count', 50000)  // 10K → 50K (bigger reach)
    .lte('follower_count', 500000)
    .order('scrape_priority', { ascending: false })  // Best quality first
    .order('last_scraped_at', { ascending: true, nullsFirst: true })  // Least recently scraped
    .limit(100); // Top 100 candidates (not a hard limit, just query size)
  
  if (!accounts || accounts.length === 0) {
    console.log('[HARVESTER] ⚠️ No accounts in pool, waiting for discovery job');
    return;
  }
  
  console.log(`[HARVESTER] 📋 Found ${accounts.length} high-quality accounts in pool`);
  
  // Step 4: TIME-BOXED PARALLEL HARVESTING (NO hardcoded account limits!)
  const { realTwitterDiscovery } = await import('../ai/realTwitterDiscovery');
  const { getReplyQualityScorer } = await import('../intelligence/replyQualityScorer');
  
  let totalHarvested = 0;
  let accountsProcessed = 0;
  
  const TIME_BUDGET = 25 * 60 * 1000; // 25 minutes max
  const BATCH_SIZE = 3; // Process 3 accounts simultaneously (MAX_CONTEXTS)
  const startTime = Date.now();
  
  console.log(`[HARVESTER] 🌐 Starting UNLIMITED parallel harvesting (time budget: 25min, batch size: 3)...`);
  
  // Process accounts in parallel batches until time runs out
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    // Check time budget
    const elapsed = Date.now() - startTime;
    if (elapsed >= TIME_BUDGET) {
      console.log(`[HARVESTER] ⏰ Time budget exhausted (${(elapsed/1000).toFixed(1)}s) - processed ${accountsProcessed} accounts`);
      break;
    }
    
    // Get next batch (3 accounts)
    const batch = accounts.slice(i, i + BATCH_SIZE);
    
    console.log(`[HARVESTER]   Batch ${Math.floor(i/BATCH_SIZE) + 1}: Processing ${batch.length} accounts in parallel...`);
    
    // Scrape all 3 accounts IN PARALLEL
    const batchResults = await Promise.allSettled(
      batch.map(async (account) => {
        try {
          console.log(`[HARVESTER]     → @${account.username} (${account.follower_count?.toLocaleString()} followers, priority: ${account.scrape_priority || 50})...`);
          
          const opportunities = await realTwitterDiscovery.findReplyOpportunitiesFromAccount(
            String(account.username),
            Number(account.follower_count) || 0,  // NEW: Pass follower count for engagement rate
            account.engagement_rate ? Number(account.engagement_rate) : undefined  // NEW: Pass account engagement rate
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
    
    // Collect results
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.opportunities.length > 0) {
        const { account, opportunities } = result.value;
        totalHarvested += opportunities.length;
        accountsProcessed++;
        
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
    
    // Check if we have enough GOLDEN opportunities to stop early
    const { count: goldenCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'golden')
      .eq('replied_to', false)
      .gt('expires_at', new Date().toISOString());
    
    if ((goldenCount || 0) >= 30) {
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
  console.log(`[HARVESTER] 🏆 Quality breakdown:`);
  console.log(`[HARVESTER]   GOLDEN: ${goldenCount || 0} (0.5%+ eng, <60min, <5 replies)`);
  console.log(`[HARVESTER]   GOOD: ${goodCount || 0} (0.2%+ eng, <180min, <12 replies)`);
  console.log(`[HARVESTER]   ACCEPTABLE: ${acceptableCount || 0} (0.05%+ eng, <720min, <20 replies)`);
  
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

