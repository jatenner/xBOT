#!/usr/bin/env tsx
/**
 * Check DB delta for public_search_* opportunities after one harvest cycle
 * Uses .env.control for environment variables
 */

// Load .env.control BEFORE any imports that might validate env vars
require('dotenv').config({ path: '.env.control' });

// Now import modules (they will use the loaded env vars)
const { getSupabaseClient } = require('../../src/db/index');
const { replyOpportunityHarvester } = require('../../src/jobs/replyOpportunityHarvester');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        📊 PUBLIC_SEARCH_* DELTA CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // STEP 1: Get baseline count
  console.log('STEP 1 — Baseline Count\n');
  
  const baselineResult = await supabase
    .from('reply_opportunities')
    .select('discovery_source, id', { count: 'exact' })
    .like('discovery_source', 'public_search_%');
  
  const baselineCount = baselineResult.count || 0;
  const baselineBySource: Record<string, number> = {};
  
  if (baselineResult.data) {
    baselineResult.data.forEach(row => {
      baselineBySource[row.discovery_source] = (baselineBySource[row.discovery_source] || 0) + 1;
    });
  }
  
  console.log(`   Total public_search_* opportunities: ${baselineCount}`);
  console.log(`   Breakdown by source:`);
  Object.entries(baselineBySource).forEach(([source, count]) => {
    console.log(`     ${source}: ${count}`);
  });
  console.log('');

  // STEP 2: Run one harvest cycle
  console.log('STEP 2 — Running Harvest Cycle\n');
  
  process.env.HARVESTING_ENABLED = 'true';
  process.env.EXECUTION_MODE = process.env.EXECUTION_MODE || 'control';
  process.env.P1_MODE = process.env.P1_MODE || 'true';
  
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE}`);
  console.log(`   P1_MODE: ${process.env.P1_MODE}`);
  console.log(`   HARVESTING_ENABLED: ${process.env.HARVESTING_ENABLED}\n`);
  
  try {
    await replyOpportunityHarvester();
    console.log('   ✅ Harvest cycle completed\n');
  } catch (error: any) {
    console.error(`   ❌ Harvest cycle failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  // STEP 3: Get final count and delta
  console.log('STEP 3 — Final Count & Delta\n');
  
  const finalResult = await supabase
    .from('reply_opportunities')
    .select('discovery_source, id', { count: 'exact' })
    .like('discovery_source', 'public_search_%');
  
  const finalCount = finalResult.count || 0;
  const finalBySource: Record<string, number> = {};
  
  if (finalResult.data) {
    finalResult.data.forEach(row => {
      finalBySource[row.discovery_source] = (finalBySource[row.discovery_source] || 0) + 1;
    });
  }
  
  const delta = finalCount - baselineCount;
  
  console.log(`   Total public_search_* opportunities: ${finalCount}`);
  console.log(`   Delta: ${delta > 0 ? '+' : ''}${delta}`);
  console.log(`\n   Breakdown by source:`);
  Object.entries(finalBySource).forEach(([source, count]) => {
    const sourceDelta = count - (baselineBySource[source] || 0);
    console.log(`     ${source}: ${count} (${sourceDelta > 0 ? '+' : ''}${sourceDelta})`);
  });
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (delta > 0) {
    console.log(`✅ SUCCESS: Added ${delta} public_search_* opportunities`);
  } else if (delta === 0) {
    console.log(`⚠️  NO CHANGE: No new public_search_* opportunities added`);
  } else {
    console.log(`❌ DECREASE: Lost ${Math.abs(delta)} public_search_* opportunities`);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
