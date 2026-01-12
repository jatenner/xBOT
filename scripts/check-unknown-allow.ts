#!/usr/bin/env tsx
/**
 * Check for NEW rows with method='unknown' AND decision='ALLOW'
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function checkUnknownAllow() {
  const supabase = getSupabaseClient();
  
  // Deploy time: 2026-01-12 15:20 UTC (approximately)
  const deployTime = new Date('2026-01-12T15:20:00Z');
  
  console.log(`\n🔍 Checking for method='unknown' AND decision='ALLOW' since ${deployTime.toISOString()}\n`);
  
  const { data, error } = await supabase
    .from('reply_decisions')
    .select('*')
    .eq('method', 'unknown')
    .eq('decision', 'ALLOW')
    .gte('created_at', deployTime.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  const count = data?.length || 0;
  
  console.log(`📊 Results:`);
  console.log(`  Total rows: ${count}`);
  
  if (count > 0) {
    console.log(`\n❌ VIOLATION: Found ${count} rows with method='unknown' AND decision='ALLOW'`);
    console.log(`\nSample rows:`);
    data?.slice(0, 5).forEach((row: any, i) => {
      console.log(`\n[${i + 1}] ${row.created_at}`);
      console.log(`    Target: ${row.target_tweet_id}`);
      console.log(`    Status: ${row.status}, Method: ${row.method}, Decision: ${row.decision}`);
      console.log(`    Reason: ${row.reason?.substring(0, 100)}`);
    });
    process.exit(1);
  } else {
    console.log(`\n✅ SUCCESS: No rows with method='unknown' AND decision='ALLOW' since deploy`);
  }
  
  // Also check breakdown by status
  const { data: statusData } = await supabase
    .from('reply_decisions')
    .select('status')
    .eq('method', 'unknown')
    .eq('decision', 'ALLOW')
    .gte('created_at', deployTime.toISOString());
  
  const statusBreakdown = (statusData || []).reduce((acc: Record<string, number>, row: any) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  
  if (Object.keys(statusBreakdown).length > 0) {
    console.log(`\nStatus breakdown:`);
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  }
}

checkUnknownAllow().catch((error) => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
