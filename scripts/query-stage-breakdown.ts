#!/usr/bin/env tsx
/**
 * Query stage-specific deny_reason_code breakdown
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function queryStageBreakdown() {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code, deny_reason_detail, created_at, target_tweet_id, error')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  console.log('\n📊 STAGE-SPECIFIC DENY REASON BREAKDOWN (last 60 min):\n');
  
  const breakdown: Record<string, number> = {};
  const samples: Record<string, any[]> = {};
  
  (data || []).forEach((row: any) => {
    const code = row.deny_reason_code || 'NULL';
    breakdown[code] = (breakdown[code] || 0) + 1;
    
    if (!samples[code]) {
      samples[code] = [];
    }
    if (samples[code].length < 3) {
      samples[code].push({
        target_tweet_id: row.target_tweet_id,
        deny_reason_detail: row.deny_reason_detail,
        error: row.error,
        created_at: row.created_at,
      });
    }
  });
  
  Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      console.log(`   ${code}: ${count}`);
      if (samples[code] && samples[code].length > 0) {
        samples[code].forEach((sample, idx) => {
          console.log(`      Sample ${idx + 1}:`);
          console.log(`         target=${sample.target_tweet_id}`);
          console.log(`         detail=${sample.deny_reason_detail || '(null)'}`);
          console.log(`         error=${(sample.error || '').substring(0, 100)}`);
        });
      }
    });
  
  console.log(`\n   TOTAL decisions: ${data?.length || 0}`);
}

queryStageBreakdown().catch(console.error);
