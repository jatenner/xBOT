/**
 * 🌾 STANDALONE LOCAL HARVESTER RUNNER
 * 
 * Runs harvesting locally (not on Railway) to avoid X blocking.
 * Writes opportunities directly to Supabase.
 * 
 * Usage:
 *   pnpm exec tsx scripts/run-harvester-once.ts
 * 
 * Exit codes:
 *   0: Success (stored_count > 0)
 *   1: Failure (stored_count == 0 or error)
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { BrowserPriority } from '../src/browser/BrowserSemaphore';
import { harvestSeedAccounts } from '../src/ai/seedAccountHarvester';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  console.log('🌾 Standalone Local Harvester Runner');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check environment
  const harvestingEnabled = process.env.HARVESTING_ENABLED !== 'false';
  if (!harvestingEnabled) {
    console.log('[HARVEST] ⚠️  HARVESTING_ENABLED=false, but this script is meant for local execution');
    console.log('[HARVEST]    Overriding for local run...');
  }

  const seedsPerRun = parseInt(process.env.SEEDS_PER_RUN || '10', 10);
  const maxTweetsPerAccount = parseInt(process.env.MAX_TWEETS_PER_ACCOUNT || '20', 10);

  console.log(`[HARVEST] Configuration:`);
  console.log(`[HARVEST]   SEEDS_PER_RUN: ${seedsPerRun}`);
  console.log(`[HARVEST]   MAX_TWEETS_PER_ACCOUNT: ${maxTweetsPerAccount}`);
  console.log(`[HARVEST]   Using DB seeds: true\n`);

  // Check session
  const hasSession = !!process.env.TWITTER_SESSION_B64;
  if (!hasSession) {
    console.error('[HARVEST] ❌ TWITTER_SESSION_B64 not found in environment');
    console.error('[HARVEST]    Please set TWITTER_SESSION_B64 or run refresh-x-session.ts');
    process.exit(1);
  }

  console.log('[HARVEST] ✅ Session detected\n');

  // Acquire browser page
  const pool = UnifiedBrowserPool.getInstance();
  let page;
  try {
    page = await pool.acquirePage(BrowserPriority.HARVESTING, 'local_harvester');
    console.log('[HARVEST] ✅ Browser page acquired\n');
  } catch (error: any) {
    console.error(`[HARVEST] ❌ Failed to acquire browser page: ${error.message}`);
    process.exit(1);
  }

  try {
    // Run harvest
    console.log('[HARVEST] 🚀 Starting harvest...\n');
    const result = await harvestSeedAccounts(page, {
      accounts: undefined, // Use DB seeds
      max_tweets_per_account: maxTweetsPerAccount,
      max_accounts: seedsPerRun,
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🌾 Harvest Complete');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total scraped: ${result.total_scraped}`);
    console.log(`Total stored: ${result.total_stored}`);
    console.log(`Accounts processed: ${result.results.length}\n`);

    // Print per-account results
    result.results.forEach((r, i) => {
      console.log(`${i + 1}. @${r.account}:`);
      console.log(`   Scraped: ${r.scraped_count}`);
      console.log(`   Root tweets: ${r.root_only_count}`);
      console.log(`   Stored: ${r.stored_count}`);
      console.log(`   Blocked: quality=${r.blocked_quality_count} stale=${r.blocked_stale_count} reply=${r.blocked_reply_count}`);
    });

    // Check tier distribution
    const supabase = getSupabaseClient();
    const { data: recentOpps } = await supabase
      .from('reply_opportunities')
      .select('tier, target_tweet_id, target_username, like_count, posted_minutes_ago, likes_per_min, opportunity_score')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('opportunity_score', { ascending: false })
      .limit(20);

    if (recentOpps && recentOpps.length > 0) {
      const tierDist: Record<string, number> = {};
      recentOpps.forEach(opp => {
        const tier = String(opp.tier || 'B').toUpperCase();
        tierDist[tier] = (tierDist[tier] || 0) + 1;
      });

      console.log('\n📊 Tier Distribution (last 5 minutes):');
      console.log(`   Tier S: ${tierDist['S'] || 0}`);
      console.log(`   Tier A: ${tierDist['A'] || 0}`);
      console.log(`   Tier B: ${tierDist['B'] || 0}`);

      if (tierDist['S'] && tierDist['S'] > 0) {
        console.log('\n🏆 Top Tier_S Opportunities:');
        recentOpps
          .filter(opp => String(opp.tier || '').toUpperCase() === 'S')
          .slice(0, 5)
          .forEach((opp, i) => {
            console.log(`   ${i + 1}. @${opp.target_username} tweet_id=${opp.target_tweet_id}`);
            console.log(`      Likes: ${opp.like_count || 'null'}, Age: ${Math.round(opp.posted_minutes_ago || 0)}min`);
            console.log(`      Likes/min: ${(opp.likes_per_min || 0).toFixed(2)}, Score: ${Math.round(opp.opportunity_score || 0)}`);
          });
      }
    }

    // Exit with appropriate code
    if (result.total_stored === 0) {
      console.log('\n⚠️  WARNING: No opportunities stored (stored_count=0)');
      console.log('   This may indicate:');
      console.log('   - All tweets blocked by filters');
      console.log('   - Session expired');
      console.log('   - Seed accounts have no fresh tweets');
      process.exit(1);
    } else {
      console.log(`\n✅ Success: ${result.total_stored} opportunities stored`);
      process.exit(0);
    }
  } catch (error: any) {
    console.error(`\n❌ Harvest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Release browser page
    try {
      await pool.releasePage(page);
      console.log('\n[HARVEST] ✅ Browser page released');
    } catch (releaseError: any) {
      console.error(`[HARVEST] ⚠️  Failed to release page: ${releaseError.message}`);
    }
  }
}

main().catch(console.error);

