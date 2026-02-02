#!/usr/bin/env tsx
/**
 * Quick check: Count public_search_* opportunities
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  // Use 3h window to match harvest window
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  // Strict count: real public_search_* (excludes manual)
  const { count: strictCount, error: strictError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .neq('discovery_source', 'public_search_manual')
    .eq('replied_to', false)
    .gte('created_at', threeHoursAgo);
  
  // Manual count: relabeled ones
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
  
  console.log(`Public candidates (strict, last 3h): ${strictCount || 0}`);
  console.log(`Public candidates (manual relabeled, last 3h): ${manualCount || 0}`);
  process.exit(strictCount && strictCount >= 25 ? 0 : 1);
}

main();
