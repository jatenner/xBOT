#!/usr/bin/env tsx
/**
 * 🔍 POSTING SILENCE DIAGNOSTIC
 * 
 * Diagnoses why posting has been silent for extended periods.
 * Classifies root cause into 3 cases:
 * - CASE 1: No ready decisions (generation/queueing issue)
 * - CASE 2: Ready decisions exist but no executions (runner stale / CDP not acting)
 * - CASE 3: Executions failing/deferring (errors/resistance)
 */

import 'dotenv/config';
import { pool } from '../../src/db/client';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 POSTING SILENCE DIAGNOSTIC');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();
  const now = new Date();
  const nowUTC = now.toISOString();
  const nowLocal = now.toLocaleString();

  // 1) Print current time and git SHA
  let gitSHA = 'unknown';
  try {
    gitSHA = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    // Ignore
  }

  console.log('📅 Current Time:');
  console.log(`   UTC: ${nowUTC}`);
  console.log(`   Local: ${nowLocal}`);
  console.log(`   Git SHA: ${gitSHA}\n`);

  const reportLines: string[] = [];
  reportLines.push('# 🔍 POSTING SILENCE DIAGNOSIS');
  reportLines.push('');
  reportLines.push(`**Generated:** ${nowUTC} (${nowLocal})`);
  reportLines.push(`**Git SHA:** ${gitSHA}`);
  reportLines.push('');

  // 2) Query POST_SUCCESS and failures
  console.log('📊 Querying POST_SUCCESS and failures...\n');

  const { rows: lastPostSuccess } = await client.query(`
    SELECT 
      created_at,
      event_data->>'tweet_id' as tweet_id,
      event_data->>'decision_id' as decision_id
    FROM system_events
    WHERE event_type IN ('POST_SUCCESS', 'POST_SUCCESS_PROD', 'REPLY_SUCCESS')
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  const lastSuccess = lastPostSuccess[0];
  const hoursSinceLastSuccess = lastSuccess 
    ? (now.getTime() - new Date(lastSuccess.created_at).getTime()) / (1000 * 60 * 60)
    : null;

  console.log('📈 Last POST_SUCCESS:');
  if (lastSuccess) {
    console.log(`   Timestamp: ${lastSuccess.created_at}`);
    console.log(`   Tweet ID: ${lastSuccess.tweet_id}`);
    console.log(`   Decision ID: ${lastSuccess.decision_id}`);
    console.log(`   Hours ago: ${hoursSinceLastSuccess?.toFixed(2)}`);
  } else {
    console.log('   ❌ No POST_SUCCESS found');
  }
  console.log('');

  const isSilenced = hoursSinceLastSuccess !== null && hoursSinceLastSuccess > 2;

  const { rows: postSuccessByHour } = await client.query(`
    SELECT 
      DATE_TRUNC('hour', created_at) as hour,
      COUNT(*) as count
    FROM system_events
    WHERE event_type IN ('POST_SUCCESS', 'POST_SUCCESS_PROD', 'REPLY_SUCCESS')
      AND created_at >= NOW() - INTERVAL '6 hours'
    GROUP BY DATE_TRUNC('hour', created_at)
    ORDER BY hour DESC;
  `);

  const { rows: failuresByHour } = await client.query(`
    SELECT 
      DATE_TRUNC('hour', created_at) as hour,
      event_type,
      COUNT(*) as count
    FROM system_events
    WHERE event_type IN ('POST_FAILED', 'CONSENT_WALL', 'CHALLENGE')
      AND created_at >= NOW() - INTERVAL '6 hours'
    GROUP BY DATE_TRUNC('hour', created_at), event_type
    ORDER BY hour DESC, event_type;
  `);

  reportLines.push('## Key Facts');
  reportLines.push('');
  reportLines.push(`- **Last POST_SUCCESS:** ${lastSuccess ? `${lastSuccess.created_at} (${hoursSinceLastSuccess?.toFixed(2)}h ago)` : 'None found'}`);
  reportLines.push(`- **Silence Status:** ${isSilenced ? '🔴 SILENCED (>2h since last success)' : '🟢 Active'}`);
  reportLines.push('');

  // 3) Inspect pipeline state
  console.log('📦 Inspecting pipeline state...\n');

  const { rows: statusCounts } = await client.query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM content_metadata
    WHERE created_at >= NOW() - INTERVAL '6 hours'
    GROUP BY status
    ORDER BY count DESC;
  `);

  console.log('📊 Content Status Counts (last 6h):');
  statusCounts.forEach((row: any) => {
    console.log(`   ${row.status}: ${row.count}`);
  });
  console.log('');

  const { rows: oldestQueued } = await client.query(`
    SELECT 
      decision_id,
      status,
      scheduled_at,
      created_at,
      is_test_post
    FROM content_metadata
    WHERE status IN ('queued', 'scheduled')
    ORDER BY COALESCE(scheduled_at, created_at) ASC
    LIMIT 20;
  `);

  console.log('📋 Oldest Queued/Scheduled Decisions:');
  if (oldestQueued.length > 0) {
    oldestQueued.slice(0, 5).forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'unknown'}... status=${row.status} scheduled_at=${row.scheduled_at || 'null'} is_test_post=${row.is_test_post}`);
    });
    console.log(`   ... and ${oldestQueued.length - 5} more`);
  } else {
    console.log('   ❌ No queued/scheduled decisions found');
  }
  console.log('');

  const { rows: readyToPost } = await client.query(`
    SELECT COUNT(*) as count
    FROM content_metadata
    WHERE status = 'queued'
      AND (scheduled_at IS NULL OR scheduled_at <= NOW() + INTERVAL '5 minutes')
      AND (is_test_post IS NULL OR is_test_post = false);
  `);

  const readyCount = parseInt(readyToPost[0]?.count || '0', 10);
  console.log(`✅ Ready to Post Now: ${readyCount} decisions\n`);

  reportLines.push('### Pipeline State');
  reportLines.push('');
  reportLines.push('**Status Counts (last 6h):**');
  statusCounts.forEach((row: any) => {
    reportLines.push(`- ${row.status}: ${row.count}`);
  });
  reportLines.push('');
  reportLines.push(`**Ready to Post Now:** ${readyCount} decisions`);
  reportLines.push('');

  // 4) Inspect planning
  console.log('📅 Inspecting planning...\n');

  const { rows: latestPlan } = await client.query(`
    SELECT 
      created_at,
      target_posts,
      target_replies,
      window_start
    FROM growth_plans
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  if (latestPlan[0]) {
    const plan = latestPlan[0];
    const planAge = (now.getTime() - new Date(plan.created_at).getTime()) / (1000 * 60 * 60);
    console.log('📊 Latest Plan:');
    console.log(`   Created: ${plan.created_at} (${planAge.toFixed(2)}h ago)`);
    console.log(`   Window: ${plan.window_start}`);
    console.log(`   Targets: ${plan.target_posts} posts, ${plan.target_replies} replies`);
    console.log('');
  }

  const { rows: planWindows } = await client.query(`
    WITH expected_hours AS (
      SELECT generate_series(
        NOW() - INTERVAL '6 hours',
        NOW(),
        '1 hour'::interval
      ) AS hour
    )
    SELECT 
      eh.hour as expected_hour,
      gp.window_start as actual_window,
      gp.target_posts,
      gp.target_replies
    FROM expected_hours eh
    LEFT JOIN growth_plans gp ON DATE_TRUNC('hour', gp.window_start) = DATE_TRUNC('hour', eh.hour)
    ORDER BY eh.hour DESC;
  `);

  console.log('📊 Plan Windows (last 6h):');
  planWindows.slice(0, 6).forEach((row: any) => {
    const status = row.actual_window ? '✅' : '❌';
    console.log(`   ${status} ${row.expected_hour}: ${row.actual_window ? `plan exists (${row.target_posts}p/${row.target_replies}r)` : 'MISSING'}`);
  });
  console.log('');

  reportLines.push('### Planning');
  reportLines.push('');
  if (latestPlan[0]) {
    const plan = latestPlan[0];
    const planAge = (now.getTime() - new Date(plan.created_at).getTime()) / (1000 * 60 * 60);
    reportLines.push(`- **Latest Plan:** ${plan.created_at} (${planAge.toFixed(2)}h ago)`);
    reportLines.push(`- **Targets:** ${plan.target_posts} posts, ${plan.target_replies} replies`);
  } else {
    reportLines.push('- **Latest Plan:** ❌ No plans found');
  }
  reportLines.push('');

  // 5) Runner/heartbeat signals
  console.log('💓 Checking runner/heartbeat signals...\n');

  const { rows: shadowController } = await client.query(`
    SELECT 
      MAX(created_at) as latest_event
    FROM system_events
    WHERE event_type IN ('GROWTH_PLAN_GENERATED', 'shadow_controller_job_success', 'shadow_controller_heartbeat');
  `);

  const { rows: runnerHeartbeats } = await client.query(`
    SELECT 
      event_type,
      MAX(created_at) as latest_event
    FROM system_events
    WHERE event_type LIKE '%RUNNER%' 
       OR event_type LIKE '%JOB_HEARTBEAT%'
       OR event_type LIKE '%GO_LIVE_MONITOR%'
       OR event_type LIKE '%posting_queue_started%'
    GROUP BY event_type
    ORDER BY latest_event DESC
    LIMIT 10;
  `);

  if (shadowController[0]?.latest_event) {
    const age = (now.getTime() - new Date(shadowController[0].latest_event).getTime()) / (1000 * 60);
    console.log(`🕐 Shadow Controller: ${shadowController[0].latest_event} (${age.toFixed(0)} min ago)`);
  } else {
    console.log('❌ Shadow Controller: No events found');
  }

  console.log('\n💓 Runner/Job Heartbeats:');
  if (runnerHeartbeats.length > 0) {
    runnerHeartbeats.forEach((row: any) => {
      const age = (now.getTime() - new Date(row.latest_event).getTime()) / (1000 * 60);
      console.log(`   ${row.event_type}: ${age.toFixed(0)} min ago`);
    });
  } else {
    console.log('   ❌ No runner heartbeats found');
  }
  console.log('');

  reportLines.push('### Runner/Heartbeat Signals');
  reportLines.push('');
  if (shadowController[0]?.latest_event) {
    const age = (now.getTime() - new Date(shadowController[0].latest_event).getTime()) / (1000 * 60);
    reportLines.push(`- **Shadow Controller:** ${shadowController[0].latest_event} (${age.toFixed(0)} min ago)`);
  } else {
    reportLines.push('- **Shadow Controller:** ❌ No events found');
  }
  reportLines.push('');
  if (runnerHeartbeats.length > 0) {
    runnerHeartbeats.forEach((row: any) => {
      const age = (now.getTime() - new Date(row.latest_event).getTime()) / (1000 * 60);
      reportLines.push(`- **${row.event_type}:** ${age.toFixed(0)} min ago`);
    });
  } else {
    reportLines.push('- **Runner Heartbeats:** ❌ No events found');
  }
  reportLines.push('');

  // 6) Root cause classification
  console.log('🔍 Classifying root cause...\n');

  let matchedCase = 'UNKNOWN';
  let caseReason = '';
  let evidence: string[] = [];

  if (readyCount === 0) {
    matchedCase = 'CASE 1: No ready decisions';
    caseReason = 'No decisions are ready to post (generation/queueing issue)';
    evidence.push(`Ready to post count: ${readyCount}`);
    evidence.push(`Total queued/scheduled: ${oldestQueued.length}`);
    if (oldestQueued.length === 0) {
      evidence.push('No queued or scheduled decisions exist');
    } else {
      evidence.push('Decisions exist but not ready (scheduled for future or blocked)');
    }
  } else {
    // Check if there are recent execution attempts
    const { rows: recentAttempts } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type IN ('POST_ATTEMPT', 'POST_FAILED', 'POST_SUCCESS')
        AND created_at >= NOW() - INTERVAL '2 hours';
    `);

    const attemptCount = parseInt(recentAttempts[0]?.count || '0', 10);

    if (attemptCount === 0) {
      matchedCase = 'CASE 2: Ready decisions exist but no executions';
      caseReason = 'Decisions are ready but runner is not executing them (runner stale / CDP not acting)';
      evidence.push(`Ready to post count: ${readyCount}`);
      evidence.push(`Recent execution attempts (last 2h): ${attemptCount}`);
      evidence.push('Runner may be stale or CDP connection lost');
    } else {
      matchedCase = 'CASE 3: Executions failing/deferring';
      caseReason = 'Execution attempts are happening but failing or being deferred (errors/resistance)';
      evidence.push(`Ready to post count: ${readyCount}`);
      evidence.push(`Recent execution attempts (last 2h): ${attemptCount}`);
      
      const failureCount = failuresByHour.reduce((sum: number, row: any) => sum + parseInt(row.count, 10), 0);
      evidence.push(`Failures in last 6h: ${failureCount}`);
    }
  }

  console.log(`🎯 Matched: ${matchedCase}`);
  console.log(`   Reason: ${caseReason}\n`);
  console.log('📋 Evidence:');
  evidence.forEach(e => console.log(`   - ${e}`));
  console.log('');

  reportLines.push('## Root Cause Classification');
  reportLines.push('');
  reportLines.push(`**Matched Case:** ${matchedCase}`);
  reportLines.push(`**Reason:** ${caseReason}`);
  reportLines.push('');
  reportLines.push('**Evidence:**');
  evidence.forEach(e => reportLines.push(`- ${e}`));
  reportLines.push('');

  // Immediate and follow-up fixes
  reportLines.push('## Immediate Fix (Next 10 Minutes)');
  reportLines.push('');

  if (matchedCase === 'CASE 1: No ready decisions') {
    reportLines.push('1. Check content generation pipeline:');
    reportLines.push('   - Verify generators are running');
    reportLines.push('   - Check for errors in generation logs');
    reportLines.push('   - Verify plan targets are being met');
    reportLines.push('');
    reportLines.push('2. Check queueing logic:');
    reportLines.push('   - Verify decisions are being created');
    reportLines.push('   - Check if decisions are being blocked/filtered');
    reportLines.push('   - Review scheduled_at timestamps');
  } else if (matchedCase === 'CASE 2: Ready decisions exist but no executions') {
    reportLines.push('1. Check runner status:');
    reportLines.push('   - Verify runner process is running: `launchctl list | grep com.xbot.runner`');
    reportLines.push('   - Check runner logs: `tail -f .runner-profile/runner.log`');
    reportLines.push('   - Verify CDP connection: `curl -s http://127.0.0.1:9222/json | head -3`');
    reportLines.push('');
    reportLines.push('2. Restart runner if needed:');
    reportLines.push('   - `pnpm run runner:restart`');
  } else if (matchedCase === 'CASE 3: Executions failing/deferring') {
    reportLines.push('1. Check failure reasons:');
    reportLines.push('   - Review POST_FAILED events in system_events');
    reportLines.push('   - Check for CONSENT_WALL / CHALLENGE events');
    reportLines.push('   - Review error messages in posting queue logs');
    reportLines.push('');
    reportLines.push('2. Check resistance signals:');
    reportLines.push('   - Verify backoff state');
    reportLines.push('   - Check if rate limits are being hit');
  }

  reportLines.push('');
  reportLines.push('## Follow-up Fix (Code/Monitoring Improvements)');
  reportLines.push('');
  reportLines.push('1. Add automated alerts for posting silence > 2 hours');
  reportLines.push('2. Improve monitoring dashboard with ready-to-post counts');
  reportLines.push('3. Add health checks for runner/CDP connection');
  reportLines.push('4. Improve error logging and classification');
  reportLines.push('');

  // Write report
  const reportPath = join(process.cwd(), 'docs', 'POSTING_SILENCE_DIAGNOSIS.md');
  writeFileSync(reportPath, reportLines.join('\n'));

  console.log(`✅ Report written: ${reportPath}\n`);

  // Print executive summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📋 EXECUTIVE SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const execSummary = isSilenced
    ? `Posting has been silent for ${hoursSinceLastSuccess?.toFixed(2)} hours. ${matchedCase}: ${caseReason}`
    : `Posting is active (last success ${hoursSinceLastSuccess?.toFixed(2)}h ago). System appears healthy.`;

  console.log(execSummary);
  console.log(`\nMatched Case: ${matchedCase}`);
  console.log(`\nBest Next Action: ${evidence[0] || 'Review report for details'}`);
  console.log('');

  client.release();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
