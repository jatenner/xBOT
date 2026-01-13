/**
 * 🔍 VERIFY DENY REASON DETAIL
 * 
 * Queries reply_decisions table for the last 1 hour and:
 * - Prints breakdown of deny_reason_code
 * - Displays 5 newest rows with deny_reason_detail (must be non-null for ancestry stage failures)
 */

import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('[VERIFY_DENY_REASON_DETAIL] 🔍 Querying reply_decisions for last 1 hour...\n');
  
  // Query last 1 hour of DENY decisions
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: decisions, error } = await supabase
    .from('reply_decisions')
    .select('*')
    .eq('decision', 'DENY')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`[VERIFY_DENY_REASON_DETAIL] ❌ Query error: ${error.message}`);
    process.exit(1);
  }
  
  if (!decisions || decisions.length === 0) {
    console.log('[VERIFY_DENY_REASON_DETAIL] ⚠️ No DENY decisions found in last 1 hour');
    return;
  }
  
  console.log(`[VERIFY_DENY_REASON_DETAIL] ✅ Found ${decisions.length} DENY decisions in last 1 hour\n`);
  
  // Breakdown by deny_reason_code
  const breakdown: Record<string, number> = {};
  const withDetail: Array<any> = [];
  const ancestryFailures: Array<any> = [];
  
  for (const decision of decisions) {
    const code = decision.deny_reason_code || 'NULL';
    breakdown[code] = (breakdown[code] || 0) + 1;
    
    if (decision.deny_reason_detail) {
      withDetail.push(decision);
    }
    
    // Track ancestry stage failures (should have deny_reason_detail)
    const ancestryCodes = [
      'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT',
      'ANCESTRY_NAV_TIMEOUT',
      'ANCESTRY_PARSE_TIMEOUT',
      'ANCESTRY_QUEUE_TIMEOUT',
      'ANCESTRY_SKIPPED_OVERLOAD',
      'ANCESTRY_TIMEOUT',
      'ANCESTRY_PLAYWRIGHT_DROPPED',
      'ANCESTRY_NAV_FAIL',
      'ANCESTRY_PARSE_FAIL',
      'ANCESTRY_UNCERTAIN',
      'ANCESTRY_ERROR',
    ];
    
    if (ancestryCodes.includes(decision.deny_reason_code || '')) {
      ancestryFailures.push(decision);
    }
  }
  
  // Print breakdown
  console.log('═'.repeat(80));
  console.log('📊 BREAKDOWN BY deny_reason_code (last 1h):');
  console.log('═'.repeat(80));
  const sortedBreakdown = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sortedBreakdown) {
    console.log(`  ${code.padEnd(40)} ${count.toString().padStart(6)}`);
  }
  console.log('═'.repeat(80));
  console.log(`  ${'TOTAL'.padEnd(40)} ${decisions.length.toString().padStart(6)}\n`);
  
  // Check ancestry failures
  console.log('═'.repeat(80));
  console.log(`🔍 ANCESTRY STAGE FAILURES (should have deny_reason_detail):`);
  console.log('═'.repeat(80));
  console.log(`  Total ancestry failures: ${ancestryFailures.length}`);
  const ancestryWithDetail = ancestryFailures.filter(d => d.deny_reason_detail);
  const ancestryWithoutDetail = ancestryFailures.filter(d => !d.deny_reason_detail);
  console.log(`  With deny_reason_detail: ${ancestryWithDetail.length}`);
  console.log(`  Without deny_reason_detail: ${ancestryWithoutDetail.length}`);
  
  if (ancestryWithoutDetail.length > 0) {
    console.log(`\n  ⚠️ WARNING: ${ancestryWithoutDetail.length} ancestry failures missing deny_reason_detail:`);
    for (const decision of ancestryWithoutDetail.slice(0, 5)) {
      console.log(`    - ${decision.created_at} ${decision.deny_reason_code || 'NULL'} target=${decision.target_tweet_id}`);
    }
  }
  console.log('═'.repeat(80) + '\n');
  
  // Show 5 newest rows with deny_reason_detail
  const newestWithDetail = withDetail
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  
  console.log('═'.repeat(80));
  console.log('📋 5 NEWEST ROWS WITH deny_reason_detail:');
  console.log('═'.repeat(80));
  
  if (newestWithDetail.length === 0) {
    console.log('  ⚠️ No rows with deny_reason_detail found in last 1 hour');
  } else {
    for (let i = 0; i < newestWithDetail.length; i++) {
      const decision = newestWithDetail[i];
      console.log(`\n[${i + 1}] ${decision.created_at}`);
      console.log(`    target_tweet_id: ${decision.target_tweet_id}`);
      console.log(`    deny_reason_code: ${decision.deny_reason_code || 'NULL'}`);
      console.log(`    deny_reason_detail:`);
      const detail = decision.deny_reason_detail || '';
      // Wrap long lines
      const maxLineLength = 70;
      const words = detail.split(' ');
      let line = '      ';
      for (const word of words) {
        if ((line + word).length > maxLineLength) {
          console.log(line);
          line = '      ' + word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line.trim() !== '') {
        console.log(line);
      }
    }
  }
  console.log('═'.repeat(80));
  
  // Summary
  console.log('\n📈 SUMMARY:');
  console.log(`  Total DENY decisions (last 1h): ${decisions.length}`);
  console.log(`  With deny_reason_detail: ${withDetail.length}`);
  console.log(`  Ancestry failures: ${ancestryFailures.length}`);
  console.log(`  Ancestry failures with detail: ${ancestryWithDetail.length}`);
  console.log(`  Ancestry failures without detail: ${ancestryWithoutDetail.length}`);
  
  if (ancestryFailures.length > 0 && ancestryWithoutDetail.length === 0) {
    console.log('\n  ✅ SUCCESS: All ancestry failures have deny_reason_detail populated!');
  } else if (ancestryFailures.length > 0) {
    console.log(`\n  ⚠️ WARNING: ${ancestryWithoutDetail.length}/${ancestryFailures.length} ancestry failures missing deny_reason_detail`);
  }
}

main().catch((error) => {
  console.error('[VERIFY_DENY_REASON_DETAIL] ❌ Error:', error);
  process.exit(1);
});
