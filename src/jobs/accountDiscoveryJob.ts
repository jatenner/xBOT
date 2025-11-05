/**
 * 🔍 ACCOUNT DISCOVERY JOB
 * 
 * Discovers and maintains a pool of high-quality health accounts for reply targeting
 * 
 * Runs: Every 6 hours (or 90 minutes in staggered mode)
 * Purpose: Keep discovered_accounts table populated with 100-200 optimal targets
 * Strategy: 
 *   - Search health hashtags on Twitter
 *   - Find 10k-500k follower accounts
 *   - Score for reply potential
 *   - Store in database for reply system
 * 
 * EXTENDED: Also discovers micro-influencer accounts for Visual Intelligence (weekly)
 */

import { getSupabaseClient } from '../db/index';
import { runVIAccountDiscovery } from './vi-job-extensions';

// Metrics tracking
let discoveryMetrics = {
  runs: 0,
  accounts_found: 0,
  accounts_stored: 0,
  errors: 0,
  last_run: null as Date | null
};

export function getDiscoveryMetrics() {
  return { ...discoveryMetrics };
}

/**
 * Main discovery job - runs every 6 hours
 */
export async function runAccountDiscovery(): Promise<void> {
  console.log('[ACCOUNT_DISCOVERY] 🔍 Starting account discovery cycle...');
  discoveryMetrics.runs++;
  discoveryMetrics.last_run = new Date();
  
  try {
    // Import discovery system
    const { aiAccountDiscovery } = await import('../ai/accountDiscovery');
    
    // Get current pool size
    const supabase = getSupabaseClient();
    const { count: currentCount } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true });
    
    console.log(`[ACCOUNT_DISCOVERY] 📊 Current pool size: ${currentCount || 0} accounts`);
    
    // Run discovery loop
    console.log('[ACCOUNT_DISCOVERY] 🌐 Searching Twitter for health accounts...');
    await aiAccountDiscovery.runDiscoveryLoop();
    
    // Get updated pool size
    const { count: newCount } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true });
    
    const accountsAdded = (newCount || 0) - (currentCount || 0);
    
    console.log(`[ACCOUNT_DISCOVERY] ✅ Discovery complete:`);
    console.log(`  💾 New accounts stored: ${accountsAdded}`);
    console.log(`  📊 Total pool size: ${newCount || 0}`);
    
    discoveryMetrics.accounts_found += accountsAdded;
    discoveryMetrics.accounts_stored += accountsAdded;
    
    // Cleanup old/low-quality accounts if pool is too large
    if (newCount && newCount > 1000) {
      console.log('[ACCOUNT_DISCOVERY] 🧹 Cleaning up old accounts (keeping top 1000)...');
      await supabase.rpc('cleanup_old_discovered_accounts');
      console.log('[ACCOUNT_DISCOVERY] ✅ Cleanup complete');
    }
    
    // Verify we have enough accounts for reply system
    if (!newCount || newCount < 20) {
      console.warn('[ACCOUNT_DISCOVERY] ⚠️ Low account pool! Reply system needs 50+ accounts for best results');
      console.log('[ACCOUNT_DISCOVERY] 💡 Will run discovery again next cycle to build pool');
    } else if (newCount >= 50) {
      console.log('[ACCOUNT_DISCOVERY] ✅ Account pool healthy - reply system ready');
    }
    
    // NEW: Visual Intelligence micro-influencer discovery (weekly, feature flagged)
    await runVIAccountDiscovery();
    
  } catch (error: any) {
    discoveryMetrics.errors++;
    console.error('[ACCOUNT_DISCOVERY] ❌ Discovery failed:', error.message);
    console.error('[ACCOUNT_DISCOVERY] 💡 Will retry next cycle');
    throw error; // Let job manager handle retry logic
  }
}

/**
 * Get account pool health status
 */
export async function getAccountPoolHealth(): Promise<{
  total_accounts: number;
  high_quality: number;
  recent_discoveries: number;
  status: 'healthy' | 'low' | 'critical';
}> {
  try {
    const supabase = getSupabaseClient();
    
    // Total accounts
    const { count: total } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true });
    
    // High quality accounts (score > 60)
    const { count: highQuality } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true })
      .gte('final_score', 60);
    
    // Recent discoveries (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: recent } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true })
      .gte('discovery_date', oneDayAgo.toISOString());
    
    const totalAccounts = total || 0;
    
    let status: 'healthy' | 'low' | 'critical';
    if (totalAccounts >= 50) {
      status = 'healthy';
    } else if (totalAccounts >= 20) {
      status = 'low';
    } else {
      status = 'critical';
    }
    
    return {
      total_accounts: totalAccounts,
      high_quality: highQuality || 0,
      recent_discoveries: recent || 0,
      status
    };
  } catch (error: any) {
    console.error('[ACCOUNT_POOL_HEALTH] ❌ Failed to check health:', error.message);
    return {
      total_accounts: 0,
      high_quality: 0,
      recent_discoveries: 0,
      status: 'critical'
    };
  }
}

