#!/usr/bin/env tsx
/**
 * Quick check: Count public_search_* opportunities
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .eq('replied_to', false)
    .gte('created_at', twoHoursAgo);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  console.log(`Public candidates (last 2h): ${count || 0}`);
  process.exit(count && count >= 25 ? 0 : 1);
}

main();
