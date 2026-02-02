#!/usr/bin/env tsx
/**
 * 🌾 Local Production Harvester - Public Search Only
 * 
 * Runs ONE public-only harvest cycle against production DB.
 * No auth required - uses public Twitter search.
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/run-harvester-local-prod.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { realTwitterDiscovery } from '../../src/ai/realTwitterDiscovery';

async function main() {
  console.log('🌾 Local Production Harvester - Public Search Only');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Ensure we're in public-only mode (no auth required)
  process.env.EXECUTION_MODE = 'control'; // Railway mode = public discovery only
  process.env.HARVESTING_ENABLED = 'true';
  process.env.P1_MODE = 'true'; // Enable P1 mode to get public_search_* queries
  process.env.P1_TARGET_MAX_AGE_HOURS = '12'; // Enable P1 queries
  
  try {
    const supabase = getSupabaseClient();
    
    // Count public_search_* opportunities before
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { count: beforeCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('discovery_source', 'public_search_%')
      .eq('replied_to', false)
      .gte('created_at', twoHoursAgo);
    
    console.log(`[HARVEST] 📊 Public candidates before: ${beforeCount || 0}`);
    
    // Import harvester
    const { replyOpportunityHarvester } = await import('../../src/jobs/replyOpportunityHarvester');
    
    console.log('[HARVEST] 🚀 Starting public-only harvest cycle...\n');
    await replyOpportunityHarvester();
    
    // Count public_search_* opportunities after
    const { count: afterCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('discovery_source', 'public_search_%')
      .eq('replied_to', false)
      .gte('created_at', twoHoursAgo);
    
    const added = (afterCount || 0) - (beforeCount || 0);
    
    console.log(`\n[HARVEST] 📊 Public candidates after: ${afterCount || 0}`);
    console.log(`[HARVEST] ✅ Stored public candidates: ${added}`);
    
    // Emit result
    console.log(`\n[HARVEST] stored_public_candidates=${added}`);
    
    if (added > 0) {
      console.log(`✅ SUCCESS: Added ${added} public candidates`);
      process.exit(0);
    } else {
      console.log(`⚠️  No new public candidates added this cycle`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Harvest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
