#!/usr/bin/env tsx
/**
 * Query latest reply_decisions and cache rows
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function queryRows() {
  const supabase = getSupabaseClient();
  
  console.log('\n📊 LATEST REPLY_DECISIONS (10 rows):\n');
  const { data: decisions } = await supabase
    .from('reply_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(JSON.stringify(decisions, null, 2));
  
  console.log('\n📊 LATEST REPLY_ANCESTRY_CACHE (10 rows):\n');
  const { data: cache } = await supabase
    .from('reply_ancestry_cache')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10);
  
  console.log(JSON.stringify(cache, null, 2));
}

queryRows().catch(console.error);
