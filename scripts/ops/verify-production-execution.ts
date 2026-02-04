#!/usr/bin/env tsx
/**
 * 🔍 VERIFY PRODUCTION EXECUTION
 * 
 * Quick verification script for production execution status
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Production Execution Verification');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Verification Time: ${new Date().toISOString()}\n`);

  // 1. Rate controller state
  console.log('1) Rate Controller State (latest 3 rows):');
  console.log('---');
  const { data: stateRows } = await supabase
    .from('rate_controller_state')
    .select('hour_start, updated_at, target_replies_this_hour, executed_replies, mode')
    .order('updated_at', { ascending: false })
    .limit(3);

  if (stateRows && stateRows.length > 0) {
    stateRows.forEach((row, i) => {
      const ageMinutes = Math.round((Date.now() - new Date(row.updated_at).getTime()) / 60000);
      console.log(`   ${i + 1}. hour_start: ${row.hour_start}`);
      console.log(`      updated_at: ${row.updated_at} (${ageMinutes}m ago)`);
      console.log(`      targets: replies=${row.target_replies_this_hour}, posts=${row.target_posts_this_hour || 0}`);
      console.log(`      executed: replies=${row.executed_replies}, posts=${row.executed_posts || 0}`);
      console.log(`      mode: ${row.mode || 'NORMAL'}\n`);
    });
  } else {
    console.log('   ❌ No rate_controller_state rows found\n');
  }

  // 2. SAFE_GOTO events
  console.log('2) SAFE_GOTO Events (last 3h):');
  console.log('---');
  const { count: attemptCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'SAFE_GOTO_ATTEMPT')
    .gte('created_at', threeHoursAgo);

  const { count: okCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'SAFE_GOTO_OK')
    .gte('created_at', threeHoursAgo);

  const { count: failCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'SAFE_GOTO_FAIL')
    .gte('created_at', threeHoursAgo);

  console.log(`   SAFE_GOTO_ATTEMPT: ${attemptCount || 0}`);
  console.log(`   SAFE_GOTO_OK: ${okCount || 0}`);
  console.log(`   SAFE_GOTO_FAIL: ${failCount || 0}\n`);

  // 3. Posted replies
  console.log('3) Posted Replies (last 3h):');
  console.log('---');
  const { count: repliesCount, data: repliesData } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at', { count: 'exact' })
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', threeHoursAgo)
    .order('posted_at', { ascending: false })
    .limit(3);

  console.log(`   Total posted: ${repliesCount || 0}`);
  if (repliesData && repliesData.length > 0) {
    console.log('   Recent replies:');
    repliesData.forEach((r, i) => {
      console.log(`     ${i + 1}. tweet_id: ${r.tweet_id}, posted_at: ${r.posted_at}`);
    });
  }
  console.log('');

  // 4. Skip reasons (if any)
  console.log('4) Top Skip Reasons (last 3h):');
  console.log('---');
  const { data: skipEvents } = await supabase
    .from('system_events')
    .select('event_data')
    .in('event_type', ['CANDIDATE_SKIPPED', 'REPLY_CANDIDATE_SKIPPED', 'ANCESTRY_SKIP_UNCERTAIN'])
    .gte('created_at', threeHoursAgo)
    .limit(100);

  if (skipEvents && skipEvents.length > 0) {
    const skipReasons: Record<string, number> = {};
    skipEvents.forEach((e) => {
      const reason = (e.event_data as any)?.reason || 'unknown';
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;
    });

    const topReasons = Object.entries(skipReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topReasons.forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count}`);
    });
  } else {
    console.log('   No skip events found');
  }
  console.log('');

  // 5. Infra blocks
  console.log('5) Infra Blocks (last 3h):');
  console.log('---');
  const { data: infraEvents } = await supabase
    .from('system_events')
    .select('event_data')
    .in('event_type', ['INFRA_BLOCK', 'SAFE_GOTO_FAIL', 'CONSENT_WALL_BLOCKED'])
    .gte('created_at', threeHoursAgo)
    .limit(100);

  if (infraEvents && infraEvents.length > 0) {
    const infraReasons: Record<string, number> = {};
    infraEvents.forEach((e) => {
      const reason = (e.event_data as any)?.reason || 'unknown';
      infraReasons[reason] = (infraReasons[reason] || 0) + 1;
    });

    const topInfra = Object.entries(infraReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topInfra.forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count}`);
    });
  } else {
    console.log('   No infra block events found');
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Verification Complete');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error(`❌ Error: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
