#!/usr/bin/env tsx
/**
 * 🌾 Single-Cycle Harvester Runner
 * 
 * Runs one complete harvest cycle and exits cleanly.
 * Designed for one-off production runs.
 * 
 * Usage:
 *   pnpm tsx scripts/ops/run-harvester-single-cycle.ts
 */

import 'dotenv/config';
import { replyOpportunityHarvester } from '../../src/jobs/replyOpportunityHarvester';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('🌾 Single-Cycle Harvester Runner');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Override HARVESTING_ENABLED for local execution
  const originalHarvestingEnabled = process.env.HARVESTING_ENABLED;
  process.env.HARVESTING_ENABLED = 'true';
  
  try {
    console.log('[HARVEST] 🚀 Starting single harvest cycle...\n');
    
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
    const added = afterTotal - beforeTotal;
    
    console.log(`\n[HARVEST] 📊 Opportunities after: ${afterTotal}`);
    console.log(`[HARVEST] ✅ Added: ${added} opportunities`);
    
    // Check fresh opportunities (<6h)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const freshCount = await getSupabaseClient()
      .from('reply_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('replied_to', false)
      .gte('created_at', sixHoursAgo);
    
    const freshTotal = freshCount.count || 0;
    console.log(`[HARVEST] 🆕 Fresh opportunities (<6h): ${freshTotal}`);
    
    if (freshTotal >= 25) {
      console.log(`\n✅ SUCCESS: Target met (${freshTotal} >= 25 fresh opportunities)`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  WARNING: Target not met (${freshTotal} < 25 fresh opportunities)`);
      console.log(`   May need additional harvest cycles or check harvester filters`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Harvest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Restore original value
    if (originalHarvestingEnabled !== undefined) {
      process.env.HARVESTING_ENABLED = originalHarvestingEnabled;
    }
  }
}

main().catch(console.error);
