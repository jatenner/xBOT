#!/usr/bin/env tsx
/**
 * Check: Count ONLY genuine public_search_* opportunities
 * 
 * Strict count excludes:
 * - public_search_manual (relabeled)
 * - Only counts opportunities from actual public search pages
 * 
 * Requirements:
 * - discovery_source LIKE 'public_search_%'
 * - discovery_source != 'public_search_manual'
 * - created_at within window
 * - replied_to = false
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  // Use 3h window to match harvest window
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  // Strict count: ONLY genuine public_search_* (excludes manual relabeled)
  const { count: strictCount, error: strictError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .neq('discovery_source', 'public_search_manual')
    .eq('replied_to', false)
    .gte('created_at', threeHoursAgo);
  
  // Manual count: relabeled ones (for comparison)
  const { count: manualCount, error: manualError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('discovery_source', 'public_search_manual')
    .eq('replied_to', false)
    .gte('created_at', threeHoursAgo);
  
  if (strictError || manualError) {
    console.error('Error:', strictError || manualError);
    process.exit(1);
  }
  
  console.log(`[PUBLIC_COUNT] strict_count=${strictCount || 0} (genuine public_search_*)`);
  console.log(`[PUBLIC_COUNT] manual_count=${manualCount || 0} (relabeled, excluded from target)`);
  
  const targetMet = (strictCount || 0) >= 25;
  if (targetMet) {
    console.log(`[PUBLIC_COUNT] ✅ Target met: ${strictCount} >= 25`);
  } else {
    console.log(`[PUBLIC_COUNT] ⚠️  Target not met: ${strictCount} < 25 (need ${25 - (strictCount || 0)} more)`);
  }
  
  process.exit(targetMet ? 0 : 1);
}

main();
