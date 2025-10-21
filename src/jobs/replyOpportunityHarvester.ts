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
    
    // Step 3: Get discovered accounts
    const { data: accounts } = await supabase
      .from('discovered_accounts')
      .select('username, follower_count')
      .gte('follower_count', 10000)
      .lte('follower_count', 500000)
      .order('last_updated', { ascending: false })
      .limit(50); // Get top 50 accounts
    
    if (!accounts || accounts.length === 0) {
      console.log('[HARVESTER] ⚠️ No accounts in pool, waiting for discovery job');
      return;
    }
    
    console.log(`[HARVESTER] 📋 Found ${accounts.length} accounts to harvest from`);
    
    // Step 4: Harvest opportunities
    const { realTwitterDiscovery } = await import('../ai/realTwitterDiscovery');
    let totalHarvested = 0;
    const accountsToScrape = Math.min(20, accounts.length); // Scrape up to 20 accounts per cycle
    
    console.log(`[HARVESTER] 🌐 Scraping ${accountsToScrape} accounts...`);
    
    for (let i = 0; i < accountsToScrape; i++) {
      const account = accounts[i];
      
      try {
        console.log(`[HARVESTER]   ${i + 1}/${accountsToScrape} → @${account.username}...`);
        
        const opportunities = await realTwitterDiscovery.findReplyOpportunitiesFromAccount(
          String(account.username)
        );
        
        if (opportunities && opportunities.length > 0) {
          // Filter for <24 hours old (uses posted_minutes_ago field)
          const fresh = opportunities.filter(opp => {
            if (!opp.posted_minutes_ago) return false;
            const tweetAgeHours = opp.posted_minutes_ago / 60;
            return tweetAgeHours < 24;
          });
          
          console.log(`[HARVESTER]     ✓ Found ${fresh.length} fresh opportunities (<24h)`);
          
          // Store in database
          if (fresh.length > 0) {
            await realTwitterDiscovery.storeOpportunities(fresh);
            totalHarvested += fresh.length;
          }
        } else {
          console.log(`[HARVESTER]     ✗ No opportunities found`);
        }
        
        // Small delay between accounts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Stop early if we've harvested enough
        if (totalHarvested >= needToHarvest) {
          console.log(`[HARVESTER] 🎯 Target reached! Harvested ${totalHarvested} opportunities`);
          break;
        }
        
      } catch (error: any) {
        console.error(`[HARVESTER]     ✗ Failed to scrape @${account.username}:`, error.message);
        continue;
      }
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
    
    // Step 6: Report final status
    const { count: finalCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
    
    const finalPoolSize = finalCount || 0;
    
    console.log(`[HARVESTER] ✅ Harvest complete!`);
    console.log(`[HARVESTER] 📊 Pool size: ${poolSize} → ${finalPoolSize}`);
    console.log(`[HARVESTER] 🌾 Harvested: ${totalHarvested} new opportunities`);
    
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

