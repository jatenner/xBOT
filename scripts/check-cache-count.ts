#!/usr/bin/env tsx
/**
 * Check cache table row count
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function checkCacheCount() {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('reply_ancestry_cache')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    if (error.code === '42P01') {
      console.log('❌ Table reply_ancestry_cache does not exist');
      process.exit(1);
    }
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Total rows in reply_ancestry_cache: ${count || 0}`);
  
  if ((count || 0) === 0) {
    console.log('⚠️  Cache table is empty (will populate as resolutions occur)');
  } else {
    console.log('✅ Cache table has entries');
  }
}

checkCacheCount().catch((error) => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
