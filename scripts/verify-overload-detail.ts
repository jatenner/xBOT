#!/usr/bin/env tsx
/**
 * Verify overload detail in SKIPPED_OVERLOAD decisions
 * Shows which condition is firing and pool stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== Overload Detail Verification ===\n');
  
  // Allow cutoff to be specified via env var (for post-deploy window)
  const deployCutoff = process.env.DEPLOY_CUTOFF || process.env.BOOT_TIME;
  const cutoff = deployCutoff 
    ? new Date(deployCutoff)
    : new Date(Date.now() - 60 * 60 * 1000); // Default: last 60 minutes
  
  console.log(`Using cutoff: ${cutoff.toISOString()}\n`);
  
  // Breakdown by deny_reason_code
  const { data: breakdown, error: breakdownError } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .gte('created_at', cutoff.toISOString())
    .eq('decision', 'DENY');
  
  if (breakdownError) {
    console.error('Error fetching breakdown:', breakdownError);
    return;
  }
  
  const counts: Record<string, number> = {};
  breakdown?.forEach(row => {
    const code = row.deny_reason_code || 'UNKNOWN';
    counts[code] = (counts[code] || 0) + 1;
  });
  
  // Get ALLOW count
  const { data: allowData, error: allowError } = await supabase
    .from('reply_decisions')
    .select('decision')
    .gte('created_at', cutoff.toISOString())
    .eq('decision', 'ALLOW');
  
  const allowCount = allowData?.length || 0;
  const denyCount = breakdown?.length || 0;
  const total = allowCount + denyCount;
  
  console.log(`Decision Breakdown (since ${cutoff.toISOString()}):`);
  console.log(`  ALLOW: ${allowCount} (${total > 0 ? (allowCount / total * 100).toFixed(1) : '0'}%)`);
  console.log(`  DENY: ${denyCount} (${total > 0 ? (denyCount / total * 100).toFixed(1) : '0'}%)`);
  console.log(`  Total: ${total}`);
  console.log('\nDENY Breakdown by reason:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      const pct = denyCount > 0 ? (count / denyCount * 100).toFixed(1) : '0';
      console.log(`  ${code}: ${count} (${pct}%)`);
    });
  
  console.log('\n=== Sample SKIPPED_OVERLOAD Rows (newest 5) ===\n');
  
  const { data: samples, error: samplesError } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, deny_reason_code, deny_reason_detail, created_at')
    .gte('created_at', cutoff.toISOString())
    .eq('deny_reason_code', 'ANCESTRY_SKIPPED_OVERLOAD')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (samplesError) {
    console.error('Error fetching samples:', samplesError);
    return;
  }
  
  if (!samples || samples.length === 0) {
    console.log('No SKIPPED_OVERLOAD decisions found in last 60 minutes');
    return;
  }
  
  samples.forEach((row, idx) => {
    console.log(`\n${idx + 1}. Decision ID: ${row.decision_id}`);
    console.log(`   Target Tweet: ${row.target_tweet_id}`);
    console.log(`   Created: ${row.created_at}`);
    console.log(`   Detail: ${row.deny_reason_detail || '(null)'}`);
    
    // Try to parse JSON if present
    if (row.deny_reason_detail) {
      // Check if it's a JSON string (starts with {)
      if (row.deny_reason_detail.trim().startsWith('{')) {
        try {
          const detail = JSON.parse(row.deny_reason_detail);
          console.log(`   ✅ JSON Found (detail_version=${detail.detail_version || 'missing'})`);
          console.log(`   Parsed JSON:`);
          console.log(`     - detail_version: ${detail.detail_version || 'missing'}`);
          console.log(`     - overload_reason: ${detail.overloadedByCeiling ? 'CEILING' : (detail.overloadedBySaturation ? 'SATURATION' : 'UNKNOWN')}`);
          console.log(`     - overloadedByCeiling: ${detail.overloadedByCeiling}`);
          console.log(`     - overloadedBySaturation: ${detail.overloadedBySaturation}`);
          console.log(`     - queueLen: ${detail.queueLen}`);
          console.log(`     - hardQueueCeiling: ${detail.hardQueueCeiling}`);
          console.log(`     - activeContexts: ${detail.activeContexts}`);
          console.log(`     - maxContexts: ${detail.maxContexts}`);
          console.log(`     - pool_id: ${detail.pool_id}`);
          console.log(`     - pool_instance_uid: ${detail.pool_instance_uid}`);
        } catch (e) {
          console.log(`   ❌ Could not parse JSON: ${e}`);
          console.log(`   Raw detail: ${row.deny_reason_detail.substring(0, 200)}`);
        }
      } else {
        // Try to extract JSON from embedded format
        const jsonMatch = row.deny_reason_detail.match(/\{[\s\S]*"overloadedByCeiling"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const detail = JSON.parse(jsonMatch[0]);
            console.log(`   ✅ JSON Found (embedded, detail_version=${detail.detail_version || 'missing'})`);
            console.log(`   Parsed JSON:`);
            console.log(`     - detail_version: ${detail.detail_version || 'missing'}`);
            console.log(`     - overload_reason: ${detail.overloadedByCeiling ? 'CEILING' : (detail.overloadedBySaturation ? 'SATURATION' : 'UNKNOWN')}`);
            console.log(`     - overloadedByCeiling: ${detail.overloadedByCeiling}`);
            console.log(`     - overloadedBySaturation: ${detail.overloadedBySaturation}`);
            console.log(`     - queueLen: ${detail.queueLen}`);
            console.log(`     - hardQueueCeiling: ${detail.hardQueueCeiling}`);
            console.log(`     - activeContexts: ${detail.activeContexts}`);
            console.log(`     - maxContexts: ${detail.maxContexts}`);
            console.log(`     - pool_id: ${detail.pool_id}`);
            console.log(`     - pool_instance_uid: ${detail.pool_instance_uid}`);
          } catch (e) {
            console.log(`   ❌ Could not parse embedded JSON: ${e}`);
            console.log(`   Raw detail: ${row.deny_reason_detail.substring(0, 200)}`);
          }
        } else {
          // Check for structured format without JSON
          console.log(`   ⚠️ No JSON found - may be old format`);
          console.log(`   Raw detail: ${row.deny_reason_detail.substring(0, 200)}`);
        }
      }
    }
  });
  
  console.log('\n=== Summary ===');
  console.log(`Total SKIPPED_OVERLOAD: ${samples.length}`);
  console.log(`Total DENY decisions: ${breakdown?.length || 0}`);
}

main().catch(console.error);
