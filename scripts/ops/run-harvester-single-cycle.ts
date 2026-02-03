#!/usr/bin/env tsx
/**
 * 🌾 Single-Cycle Harvester Runner
 * 
 * Runs one complete harvest cycle and exits cleanly.
 * Checks backoff state and budgets, falls back to profile harvester if search is blocked.
 * 
 * Usage:
 *   pnpm tsx scripts/ops/run-harvester-single-cycle.ts
 */

import 'dotenv/config';
import { replyOpportunityHarvester } from '../../src/jobs/replyOpportunityHarvester';
import { getSupabaseClient } from '../../src/db/index';
import { isBlocked } from '../../src/utils/backoffStore';
import { getBudgets } from '../../src/utils/budgetStore';

interface HarvestSummary {
  mode: 'search' | 'profile' | 'skipped';
  dom_cards: number;
  status_urls: number;
  inserted_rows: number;
  rate_limited: boolean;
  blocked_until: string | null;
  budgets_remaining: { nav: number; search: number };
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🌾 SINGLE-CYCLE HARVESTER RUNNER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Override HARVESTING_ENABLED for local execution
  const originalHarvestingEnabled = process.env.HARVESTING_ENABLED;
  process.env.HARVESTING_ENABLED = 'true';
  
  const summary: HarvestSummary = {
    mode: 'skipped',
    dom_cards: 0,
    status_urls: 0,
    inserted_rows: 0,
    rate_limited: false,
    blocked_until: null,
    budgets_remaining: { nav: 0, search: 0 },
  };
  
  try {
    // Check backoff state
    const backoffCheck = await isBlocked('harvest_search');
    const budgets = await getBudgets();
    summary.budgets_remaining = { nav: budgets.navRemaining, search: budgets.searchRemaining };
    
    if (backoffCheck.blocked) {
      summary.blocked_until = backoffCheck.blockedUntil?.toISOString() || null;
      console.log(`[BACKOFF_STORE] Search blocked until ${backoffCheck.blockedUntil?.toISOString()} (${backoffCheck.minutesRemaining} minutes remaining)`);
      console.log(`[BACKOFF_STORE] Falling back to profile harvester...\n`);
      
      // Fallback to profile harvester
      summary.mode = 'profile';
      const { execSync } = await import('child_process');
      try {
        execSync('pnpm tsx scripts/ops/run-profile-harvester-single-cycle.ts', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: 'inherit',
          env: { ...process.env },
        });
        // Profile harvester outputs its own JSON summary
        return;
      } catch (profileError: any) {
        console.error(`[HARVEST] Profile harvester failed: ${profileError.message}`);
        summary.rate_limited = true;
      }
    } else if (budgets.searchRemaining < 1) {
      console.log(`[BUDGET_STORE] Search budget exhausted (${budgets.searchRemaining} remaining)`);
      console.log(`[BUDGET_STORE] Falling back to profile harvester...\n`);
      
      // Fallback to profile harvester
      summary.mode = 'profile';
      const { execSync } = await import('child_process');
      try {
        execSync('pnpm tsx scripts/ops/run-profile-harvester-single-cycle.ts', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: 'inherit',
          env: { ...process.env },
        });
        // Profile harvester outputs its own JSON summary
        return;
      } catch (profileError: any) {
        console.error(`[HARVEST] Profile harvester failed: ${profileError.message}`);
      }
    } else {
      // Run search harvester
      summary.mode = 'search';
      console.log('[HARVEST] 🚀 Starting search harvest cycle...\n');
      
      const beforeCount = await getSupabaseClient()
        .from('reply_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('replied_to', false);
      
      const beforeTotal = beforeCount.count || 0;
      console.log(`[HARVEST] 📊 Opportunities before: ${beforeTotal}`);
      
      await replyOpportunityHarvester();
      
      const afterCount = await getSupabaseClient()
        .from('reply_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('replied_to', false);
      
      const afterTotal = afterCount.count || 0;
      summary.inserted_rows = afterTotal - beforeTotal;
      
      console.log(`\n[HARVEST] 📊 Opportunities after: ${afterTotal}`);
      console.log(`[HARVEST] ✅ Added: ${summary.inserted_rows} opportunities`);
    }
    
    // Output JSON summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(JSON.stringify(summary));
    
  } catch (error: any) {
    console.error(`\n❌ Harvest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    summary.rate_limited = true;
    console.log(JSON.stringify(summary));
    process.exit(1);
  } finally {
    // Restore original value
    if (originalHarvestingEnabled !== undefined) {
      process.env.HARVESTING_ENABLED = originalHarvestingEnabled;
    }
  }
}

main().catch(console.error);
