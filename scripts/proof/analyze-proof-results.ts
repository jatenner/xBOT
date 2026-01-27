#!/usr/bin/env tsx
/**
 * Analyze proof results from database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const PROOF_START_TIME = '2026-01-27T18:25:18.000Z';
const PROOF_DURATION_MINUTES = 120;

async function main() {
  const supabase = getSupabaseClient();
  const startTime = new Date(PROOF_START_TIME);
  const endTime = new Date(startTime.getTime() + PROOF_DURATION_MINUTES * 60 * 1000);
  const now = Date.now();
  const elapsedMinutes = Math.floor((now - startTime.getTime()) / 60000);

  // Query HEALTH_OK events
  const { data: healthOkEvents } = await supabase
    .from('system_events')
    .select('id, created_at')
    .eq('event_type', 'EXECUTOR_HEALTH_OK')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: true });

  let maxGap = 0;
  if (healthOkEvents && healthOkEvents.length > 1) {
    for (let i = 1; i < healthOkEvents.length; i++) {
      const prevTime = new Date(healthOkEvents[i - 1].created_at).getTime();
      const currTime = new Date(healthOkEvents[i].created_at).getTime();
      const gapSeconds = (currTime - prevTime) / 1000;
      if (gapSeconds > maxGap) {
        maxGap = gapSeconds;
      }
    }
  }

  // Query boot/ready events
  const { data: bootEvent } = await supabase
    .from('system_events')
    .select('id, created_at')
    .eq('event_type', 'EXECUTOR_HEALTH_BOOT')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: readyEvent } = await supabase
    .from('system_events')
    .select('id, created_at')
    .eq('event_type', 'EXECUTOR_HEALTH_READY')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Query crash events
  const { data: crashEvents } = await supabase
    .from('system_events')
    .select('id, created_at')
    .eq('event_type', 'EXECUTOR_DAEMON_CRASH')
    .gte('created_at', startTime.toISOString())
    .limit(1);

  // Query workload progress (queued -> posted/posting)
  const { data: decisions } = await supabase
    .from('content_metadata')
    .select('decision_id, status, updated_at, features')
    .like('features->>proof_tag', 'control-post-5a4-stability-%')
    .order('created_at', { ascending: false });

  const progressDecisions = decisions?.filter(d => {
    const updatedAt = new Date(d.updated_at);
    return updatedAt >= startTime && (d.status === 'posted' || d.status === 'posting_attempt');
  }) || [];

  // Calculate final gap
  let finalGap = 0;
  if (healthOkEvents && healthOkEvents.length > 0) {
    const lastHealthOkTime = new Date(healthOkEvents[healthOkEvents.length - 1].created_at).getTime();
    finalGap = (now - lastHealthOkTime) / 1000;
  }

  // Determine PASS/FAIL
  const bootSeen = bootEvent !== null;
  const readySeen = readyEvent !== null;
  const healthOkPass = (healthOkEvents?.length || 0) >= Math.floor(PROOF_DURATION_MINUTES * 0.95); // Allow 5% tolerance
  const noGapsOver90 = maxGap <= 90;
  const finalGapOk = finalGap <= 90;
  const noCrash = !crashEvents || crashEvents.length === 0;
  const hasProgress = progressDecisions.length > 0;
  const durationCompleted = elapsedMinutes >= PROOF_DURATION_MINUTES;

  const pass = bootSeen && readySeen && healthOkPass && noGapsOver90 && finalGapOk && noCrash && hasProgress && durationCompleted;

  console.log('=== PROOF ANALYSIS ===');
  console.log(`Elapsed: ${elapsedMinutes}/${PROOF_DURATION_MINUTES} minutes`);
  console.log(`Boot Event: ${bootSeen ? '✅' : '❌'} ${bootEvent?.id || 'N/A'}`);
  console.log(`Ready Event: ${readySeen ? '✅' : '❌'} ${readyEvent?.id || 'N/A'}`);
  console.log(`HEALTH_OK Count: ${healthOkEvents?.length || 0} (min: ${Math.floor(PROOF_DURATION_MINUTES * 0.95)}) ${healthOkPass ? '✅' : '❌'}`);
  console.log(`Max Gap: ${maxGap.toFixed(1)}s ${noGapsOver90 ? '✅' : '❌'}`);
  console.log(`Final Gap: ${finalGap.toFixed(1)}s ${finalGapOk ? '✅' : '❌'}`);
  console.log(`No Crash: ${noCrash ? '✅' : '❌'}`);
  console.log(`Workload Progress: ${hasProgress ? '✅' : '❌'} (${progressDecisions.length} transitions)`);
  console.log(`Duration Completed: ${durationCompleted ? '✅' : '❌'}`);
  console.log(`\nRESULT: ${pass ? '✅ PASS' : '❌ FAIL'}`);

  if (progressDecisions.length > 0) {
    console.log(`\nProgress Decisions:`);
    progressDecisions.slice(0, 5).forEach(d => {
      console.log(`  - ${d.decision_id}: ${d.status}`);
    });
  }
}

main().catch(console.error);
