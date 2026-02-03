#!/usr/bin/env tsx
require('dotenv').config({ path: '.env.control' });
const { getSupabaseClient } = require('../../src/db/index');

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error, count } = await supabase
    .from('reply_opportunities')
    .select('discovery_source, id', { count: 'exact' })
    .like('discovery_source', 'public_search_%');
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  const counts: Record<string, number> = {};
  data?.forEach(row => {
    counts[row.discovery_source] = (counts[row.discovery_source] || 0) + 1;
  });
  
  console.log(`Total public_search_* opportunities: ${count || 0}`);
  console.log('Breakdown by source:');
  Object.entries(counts).forEach(([source, cnt]) => {
    console.log(`  ${source}: ${cnt}`);
  });
}

main().catch(console.error);
