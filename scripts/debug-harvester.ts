/**
 * Debug harvester to diagnose why 0 opportunities are found
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { Page } from 'playwright';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') || process.argv[2] || '120';
const minutes = parseInt(minutesArg, 10);
const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

async function main() {
  console.log(`🔍 Debugging harvester (last ${minutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime.toISOString()}\n`);
  
  const supabase = getSupabaseClient();
  
  // Step 1: Check seed account list
  console.log('=== STEP 1: Seed Account List ===');
  const { harvestSeedAccounts } = await import('../src/ai/seedAccountHarvester');
  const SEED_ACCOUNTS = [
    'hubermanlab', 'foundmyfitness', 'peterattiamd', 'drmarkhyman', 'drgundry',
    'drjasonfung', 'drstevenlin', 'nutrition_facts', 'nutritiontactics', 'biolayne',
    'jeffnippard', 'gregogallagher', 'athleanx', 'drjamesdinic', 'drbrianboxer',
    'drbengreenfield', 'drjockers', 'drchristianson', 'drjoshaxe', 'drhyman',
    'drgundry', 'drstevenlin', 'nutrition_facts', 'nutritiontactics', 'biolayne',
  ];
  
  console.log(`Seed accounts: ${SEED_ACCOUNTS.length}`);
  console.log(`Sample handles: ${SEED_ACCOUNTS.slice(0, 5).join(', ')}...\n`);
  
  // Step 2: Check existing opportunities in DB
  console.log('=== STEP 2: Existing Opportunities in DB ===');
  const { data: existingOpps, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, tweet_posted_at, is_root_tweet, like_count, created_at')
    .gte('created_at', cutoffTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (oppError) {
    console.error(`❌ Error querying opportunities: ${oppError.message}`);
  } else {
    console.log(`Found ${existingOpps?.length || 0} opportunities in last ${minutes} minutes`);
    if (existingOpps && existingOpps.length > 0) {
      console.log(`\nTop 10 opportunities:`);
      existingOpps.slice(0, 10).forEach((opp, i) => {
        const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60));
        console.log(`  ${i + 1}. @${opp.target_username} - tweet_id=${opp.target_tweet_id} - age=${age}min - likes=${opp.like_count} - root=${opp.is_root_tweet}`);
      });
    }
  }
  console.log('');
  
  // Step 3: Test harvesting from seed accounts
  console.log('=== STEP 3: Test Harvesting from Seed Accounts ===');
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('debug_harvester');
  
  try {
    const { harvestSeedAccounts: harvestFn } = await import('../src/ai/seedAccountHarvester');
    
    // Check if --use-db-seeds flag is set
    const useDbSeeds = process.argv.includes('--use-db-seeds');
    const maxSeedsArg = process.argv.find(arg => arg.startsWith('--max-seeds='))?.replace('--max-seeds=', '') || process.argv.find(arg => arg.startsWith('--max-seeds')) && process.argv[process.argv.indexOf('--max-seeds') + 1];
    const maxSeeds = maxSeedsArg ? parseInt(maxSeedsArg, 10) : 5;
    
    if (useDbSeeds) {
      console.log(`Using DB seeds (max_seeds=${maxSeeds})...`);
      // Don't pass accounts - let harvester query DB
      const result = await harvestFn(page, {
        max_tweets_per_account: 20,
        max_accounts: maxSeeds,
      });
    
      console.log(`\nHarvest Result:`);
      console.log(`  Total scraped: ${result.total_scraped}`);
      console.log(`  Total stored: ${result.total_stored}`);
      console.log(`  Results: ${JSON.stringify(result.results, null, 2)}`);
    } else {
      // Test harvesting from first seed account (hardcoded)
      const testAccount = SEED_ACCOUNTS[0];
      console.log(`Testing harvest from @${testAccount} (hardcoded)...`);
      
      const result = await harvestFn(page, {
        accounts: [testAccount],
        max_tweets_per_account: 20,
        max_accounts: 1,
      });
      
      console.log(`\nHarvest Result:`);
      console.log(`  Total scraped: ${result.total_scraped}`);
      console.log(`  Total stored: ${result.total_stored}`);
      console.log(`  Results: ${JSON.stringify(result.results, null, 2)}`);
    }
    
    // Check what was stored
    if (result.total_stored > 0) {
      const { data: newOpps } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_id, target_username, tweet_posted_at, is_root_tweet, like_count')
        .eq('target_username', testAccount)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log(`\nNewly stored opportunities:`);
      if (newOpps && newOpps.length > 0) {
        newOpps.forEach((opp, i) => {
          const tweetAge = opp.tweet_posted_at ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / (1000 * 60)) : 'unknown';
          console.log(`  ${i + 1}. tweet_id=${opp.target_tweet_id} - age=${tweetAge}min - likes=${opp.like_count} - root=${opp.is_root_tweet}`);
        });
      } else {
        console.log(`  ⚠️  No opportunities found in DB after harvest`);
      }
    }
    
  } catch (error: any) {
    console.error(`❌ Harvest test failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await pool.releasePage(page);
  }
  
  // Step 4: Check filtering logic
  console.log('\n=== STEP 4: Filtering Analysis ===');
  const { data: allRecentOpps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, tweet_posted_at, is_root_tweet, like_count, created_at')
    .gte('tweet_posted_at', cutoffTime.toISOString())
    .order('tweet_posted_at', { ascending: false })
    .limit(50);
  
  if (allRecentOpps && allRecentOpps.length > 0) {
    const rootOnly = allRecentOpps.filter(o => o.is_root_tweet === true);
    const withLikes = allRecentOpps.filter(o => (o.like_count || 0) >= 10);
    const fresh = allRecentOpps.filter(o => {
      if (!o.tweet_posted_at) return false;
      const age = (Date.now() - new Date(o.tweet_posted_at).getTime()) / (1000 * 60);
      return age <= 180; // 3 hours
    });
    
    console.log(`Total opportunities in window: ${allRecentOpps.length}`);
    console.log(`  Root-only: ${rootOnly.length}`);
    console.log(`  With likes >= 10: ${withLikes.length}`);
    console.log(`  Fresh (<180min): ${fresh.length}`);
    
    console.log(`\nTop 10 candidates (by age):`);
    fresh.slice(0, 10).forEach((opp, i) => {
      const age = Math.round((Date.now() - new Date(opp.tweet_posted_at!).getTime()) / (1000 * 60));
      console.log(`  ${i + 1}. @${opp.target_username} - tweet_id=${opp.target_tweet_id} - age=${age}min - likes=${opp.like_count} - root=${opp.is_root_tweet}`);
    });
  } else {
    console.log(`⚠️  No opportunities found in window`);
  }
  
  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(console.error);

