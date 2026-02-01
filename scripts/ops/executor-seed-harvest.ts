#!/usr/bin/env tsx
/**
 * Executor-Side Seed Account Harvest
 * 
 * Runs seed account harvesting using executor's authenticated Chrome profile.
 * Only runs in executor mode (EXECUTION_MODE=executor, RUNNER_MODE=true).
 * 
 * Usage:
 *   EXECUTION_MODE=executor RUNNER_MODE=true pnpm exec tsx scripts/ops/executor-seed-harvest.ts
 */

import 'dotenv/config';
import { requireExecutorMode } from '../../src/infra/executionMode';
import { harvestSeedAccounts } from '../../src/ai/seedAccountHarvester';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { withBrowserLock, BrowserPriority } from '../../src/browser/BrowserSemaphore';

async function main() {
  console.log('🌱 Executor-Side Seed Account Harvest');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 🔒 GUARD: Must be executor mode
  try {
    requireExecutorMode();
  } catch (error: any) {
    console.error(`❌ ${error.message}`);
    console.error('   This script requires EXECUTION_MODE=executor AND RUNNER_MODE=true');
    process.exit(1);
  }

  console.log('[SEED_HARVEST_EXECUTOR] ✅ Executor mode verified');
  console.log('[SEED_HARVEST_EXECUTOR] 🔐 Using local Chrome profile for authentication\n');

  try {
    const result = await withBrowserLock(
      'executor_seed_harvest',
      BrowserPriority.HARVESTING,
      async () => {
        const pool = UnifiedBrowserPool.getInstance();
        const page = await pool.acquirePage('executor_seed_harvest');
        try {
          return await harvestSeedAccounts(page, {
            max_tweets_per_account: 50,
            max_accounts: 6,
          });
        } finally {
          await pool.releasePage(page);
        }
      }
    );

    console.log(`\n[SEED_HARVEST_EXECUTOR] ✅ Complete:`);
    console.log(`   Scraped: ${result.total_scraped} tweets`);
    console.log(`   Stored: ${result.total_stored} opportunities`);
    console.log(`   Accounts processed: ${result.results.length}`);

    if (result.total_stored > 0) {
      console.log(`\n✅ SUCCESS: ${result.total_stored} opportunities stored from executor seed harvest`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  No opportunities stored (may need different accounts or filters)`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Seed harvest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
