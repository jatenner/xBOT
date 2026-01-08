/**
 * Print top seed accounts by performance stats
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  // Check if seed_account_stats table exists and has data
  const { data: stats, error } = await supabase
    .from('seed_account_stats')
    .select('handle, scraped_count, stored_count, avg_score, last_success_at, rolling_7d_success_rate, tier1_pass, tier2_pass, tier3_pass, disallowed_count, last_harvest_at')
    .order('stored_count', { ascending: false })
    .order('rolling_7d_success_rate', { ascending: false })
    .limit(20);
  
  if (error) {
    if (error.code === '42P01') {
      console.log('⚠️  seed_account_stats table does not exist yet');
      console.log('   Run migration: supabase/migrations/20260108_seed_account_stats.sql');
      process.exit(0);
    }
    console.error(`❌ Error querying seed_account_stats: ${error.message}`);
    process.exit(1);
  }
  
  if (!stats || stats.length === 0) {
    console.log('⚠️  0 rows — run harvest to populate');
    console.log('   Run: pnpm harvest:once');
    process.exit(0);
  }
  
  console.log(`📊 Top ${stats.length} Seed Accounts by Performance:\n`);
  
  stats.forEach((stat: any, i) => {
    const successRate = stat.rolling_7d_success_rate ? (Number(stat.rolling_7d_success_rate) * 100).toFixed(1) : 'N/A';
    const lastSuccess = stat.last_success_at ? new Date(stat.last_success_at).toLocaleString() : 'Never';
    const lastHarvest = stat.last_harvest_at ? new Date(stat.last_harvest_at).toLocaleString() : 'Never';
    
    // Calculate pass rate (weighted by tier quality)
    const weightedPasses = (stat.tier1_pass || 0) * 1.0 + (stat.tier2_pass || 0) * 0.6 + (stat.tier3_pass || 0) * 0.3;
    const passRate = stat.stored_count > 0 ? ((weightedPasses / stat.stored_count) * 100).toFixed(1) : '0.0';
    
    console.log(`${i + 1}. @${stat.handle}`);
    console.log(`   Stored: ${stat.stored_count} | Scraped: ${stat.scraped_count} | Avg Score: ${stat.avg_score || 'N/A'}`);
    console.log(`   7d Success Rate: ${successRate}% | Pass Rate: ${passRate}%`);
    if (stat.tier1_pass || stat.tier2_pass || stat.tier3_pass) {
      console.log(`   Tier Passes: T1=${stat.tier1_pass || 0} T2=${stat.tier2_pass || 0} T3=${stat.tier3_pass || 0} | Disallowed: ${stat.disallowed_count || 0}`);
    }
    console.log(`   Last Success: ${lastSuccess} | Last Harvest: ${lastHarvest}`);
    console.log('');
  });
  
  process.exit(0);
}

main().catch(console.error);

