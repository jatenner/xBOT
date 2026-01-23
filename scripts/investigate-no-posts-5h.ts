#!/usr/bin/env tsx
/**
 * 🔍 NO POSTS 5H ROOT CAUSE INVESTIGATION
 * 
 * Investigates why there have been ~0 new timeline posts in the last ~5 hours
 * even though the system is "running."
 * 
 * Produces: docs/NO_POSTS_5H_ROOT_CAUSE_REPORT.md
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:00 UTC`;
}

const NOW_UTC = new Date();
const FIVE_HOURS_AGO_UTC = new Date(NOW_UTC.getTime() - 5 * 60 * 60 * 1000);
const GRACE_MINUTES = 5;
const GRACE_WINDOW = new Date(NOW_UTC.getTime() + GRACE_MINUTES * 60 * 1000);

interface Report {
  executiveSummary: string[];
  partA: {
    readyNow: number;
    readyPerHour: Array<{ hour: string; count: number }>;
    oldestReady: Array<{
      decision_id: string;
      status: string;
      scheduled_at: string;
      created_at: string;
      pipeline_source: string | null;
      is_test_post: boolean | null;
      skip_reason: string | null;
    }>;
  };
  partB: {
    postSuccessPerHour: Array<{ hour: string; count: number }>;
    postFailedPerHour: Array<{ hour: string; count: number; reasons: Record<string, number> }>;
    consentWallPerHour: Array<{ hour: string; count: number }>;
    challengePerHour: Array<{ hour: string; count: number }>;
    testLaneBlockPerHour: Array<{ hour: string; count: number }>;
    denyEventsPerHour: Array<{ hour: string; count: number }>;
    blockingDiagnosis: {
      primaryBlocker: string;
      secondaryFactors: string[];
    };
    logExcerpts: string[];
  };
  partC: {
    planWindows: Array<{ window: string; expected: boolean; actual: boolean; targetPosts: number; targetReplies: number }>;
    latestPlanAge: string;
    latestPlanTargets: { posts: number; replies: number };
    decisionsCreatedPerHour: Array<{ hour: string; posts: number; replies: number }>;
    scheduledAtOffsets: Array<{ offset_hours: number; count: number }>;
    jobSkipping: {
      shadowControllerSkipped: boolean;
      missingPlanWindows: string[];
    };
  };
  rootCause: string;
  patchPlan: string[];
  verificationPlan: string[];
}

async function main() {
  console.log('🔍 Starting 5H posting silence investigation...');
  console.log(`📅 Time window: ${FIVE_HOURS_AGO_UTC.toISOString()} to ${NOW_UTC.toISOString()} (UTC)`);
  
  const supabase = getSupabaseClient();
  const report: Report = {
    executiveSummary: [],
    partA: {
      readyNow: 0,
      readyPerHour: [],
      oldestReady: [],
    },
    partB: {
      postSuccessPerHour: [],
      postFailedPerHour: [],
      consentWallPerHour: [],
      challengePerHour: [],
      testLaneBlockPerHour: [],
      denyEventsPerHour: [],
      blockingDiagnosis: {
        primaryBlocker: '',
        secondaryFactors: [],
      },
      logExcerpts: [],
    },
    partC: {
      planWindows: [],
      latestPlanAge: '',
      latestPlanTargets: { posts: 0, replies: 0 },
      decisionsCreatedPerHour: [],
      scheduledAtOffsets: [],
      jobSkipping: {
        shadowControllerSkipped: false,
        missingPlanWindows: [],
      },
    },
    rootCause: '',
    patchPlan: [],
    verificationPlan: [],
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PART A: Are there PROD decisions ready to post?
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📊 PART A: Checking ready PROD decisions...');
  
  // Count ready NOW
  const { data: readyNowData, error: readyNowError } = await supabase
    .from('content_metadata')
    .select('decision_id', { count: 'exact' })
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', GRACE_WINDOW.toISOString())
    .or('is_test_post.is.null,is_test_post.eq.false');
  
  if (readyNowError) {
    console.error(`❌ Error counting ready now: ${readyNowError.message}`);
  } else {
    report.partA.readyNow = readyNowData?.length || 0;
    console.log(`✅ Ready NOW: ${report.partA.readyNow}`);
  }

  // Count ready per hour for last 5 hours
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .lte('scheduled_at', hourEnd.toISOString())
      .or('is_test_post.is.null,is_test_post.eq.false');
    
    report.partA.readyPerHour.push({
      hour: hourLabel,
      count: count || 0,
    });
  }

  // List oldest ready items (pipeline_source may not exist in content_metadata)
  const { data: oldestReadyData, error: oldestReadyError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, scheduled_at, created_at, is_test_post, skip_reason, generator_name')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', GRACE_WINDOW.toISOString())
    .or('is_test_post.is.null,is_test_post.eq.false')
    .order('scheduled_at', { ascending: true })
    .limit(20);
  
  if (oldestReadyError) {
    console.error(`❌ Error fetching oldest ready: ${oldestReadyError.message}`);
  } else {
    report.partA.oldestReady = (oldestReadyData || []).map(d => ({
      decision_id: d.decision_id,
      status: d.status,
      scheduled_at: d.scheduled_at,
      created_at: d.created_at,
      pipeline_source: d.generator_name || null, // Use generator_name as proxy
      is_test_post: d.is_test_post,
      skip_reason: d.skip_reason,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART B: If ready > 0, what is blocking posting?
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📊 PART B: Checking blocking events...');
  
  // POST_SUCCESS per hour
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { count } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'POST_SUCCESS')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    report.partB.postSuccessPerHour.push({
      hour: hourLabel,
      count: count || 0,
    });
  }

  // POST_FAILED per hour with breakdown
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { data: failedData } = await supabase
      .from('system_events')
      .select('event_type, event_data, message')
      .eq('event_type', 'POST_FAILED')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    const reasons: Record<string, number> = {};
    (failedData || []).forEach(event => {
      const reason = (event.event_data as any)?.reason || 
                     (event.event_data as any)?.error_message || 
                     event.message || 
                     'unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    
    report.partB.postFailedPerHour.push({
      hour: hourLabel,
      count: failedData?.length || 0,
      reasons,
    });
  }

  // CONSENT_WALL and CHALLENGE counts
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { count: consentCount } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['CONSENT_WALL', 'consent_wall_detected'])
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    const { count: challengeCount } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['CHALLENGE', 'challenge_detected', 'challenge_required'])
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    report.partB.consentWallPerHour.push({
      hour: hourLabel,
      count: consentCount || 0,
    });
    
    report.partB.challengePerHour.push({
      hour: hourLabel,
      count: challengeCount || 0,
    });
  }

  // TEST_LANE_BLOCK events
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { count } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['TEST_LANE_BLOCK', 'test_lane_block', 'posting_queue_noop'])
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    report.partB.testLaneBlockPerHour.push({
      hour: hourLabel,
      count: count || 0,
    });
  }

  // DENY/gate events
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { count } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['permit_rejected', 'posting_blocked', 'DENY', 'deny'])
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    report.partB.denyEventsPerHour.push({
      hour: hourLabel,
      count: count || 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART C: If ready = 0, why aren't we producing/queuing?
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📊 PART C: Checking planning health...');
  
  // Check plan windows (using growth_plans table)
  const { data: plansData } = await supabase
    .from('growth_plans')
    .select('*')
    .gte('window_start', FIVE_HOURS_AGO_UTC.toISOString())
    .order('window_start', { ascending: false })
    .limit(10);
  
  // Build plan windows report
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const plan = (plansData || []).find(p => {
      const planStart = new Date(p.window_start);
      return planStart >= hourStart && planStart < hourEnd;
    });
    
    report.partC.planWindows.push({
      window: hourLabel,
      expected: true,
      actual: !!plan,
      targetPosts: plan?.target_posts || 0,
      targetReplies: plan?.target_replies || 0,
    });
    
    if (!plan) {
      report.partC.jobSkipping.missingPlanWindows.push(hourLabel);
    }
  }
  
  // Get latest plan
  if (plansData && plansData.length > 0) {
    const latestPlan = plansData[0];
    const latestPlanTime = new Date(latestPlan.window_start);
    const ageMinutes = Math.round((NOW_UTC.getTime() - latestPlanTime.getTime()) / (60 * 1000));
    report.partC.latestPlanAge = `${ageMinutes} minutes ago`;
    report.partC.latestPlanTargets = {
      posts: latestPlan.target_posts || 0,
      replies: latestPlan.target_replies || 0,
    };
  }
  
  // Check decisions created per hour
  for (let h = 0; h < 5; h++) {
    const hourStart = new Date(NOW_UTC.getTime() - (h + 1) * 60 * 60 * 1000);
    const hourEnd = new Date(NOW_UTC.getTime() - h * 60 * 60 * 1000);
    const hourLabel = formatDate(hourStart);
    
    const { count: postsCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    const { count: repliesCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());
    
    report.partC.decisionsCreatedPerHour.push({
      hour: hourLabel,
      posts: postsCount || 0,
      replies: repliesCount || 0,
    });
  }

  // Check scheduled_at offsets for queued decisions
  const { data: scheduledData } = await supabase
    .from('content_metadata')
    .select('scheduled_at, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .not('scheduled_at', 'is', null);
  
  const offsetCounts: Record<number, number> = {};
  (scheduledData || []).forEach(d => {
    if (d.scheduled_at) {
      const scheduled = new Date(d.scheduled_at);
      const offsetHours = Math.round((scheduled.getTime() - NOW_UTC.getTime()) / (60 * 60 * 1000));
      const bucket = Math.floor(offsetHours / 6) * 6; // 6-hour buckets
      offsetCounts[bucket] = (offsetCounts[bucket] || 0) + 1;
    }
  });
  
  report.partC.scheduledAtOffsets = Object.entries(offsetCounts)
    .map(([offset, count]) => ({ offset_hours: parseInt(offset), count }))
    .sort((a, b) => a.offset_hours - b.offset_hours);

  // ═══════════════════════════════════════════════════════════════════════
  // Generate blocking diagnosis
  // ═══════════════════════════════════════════════════════════════════════
  
  const totalPostSuccess = report.partB.postSuccessPerHour.reduce((sum, h) => sum + h.count, 0);
  const totalPostFailed = report.partB.postFailedPerHour.reduce((sum, h) => sum + h.count, 0);
  const totalConsentWall = report.partB.consentWallPerHour.reduce((sum, h) => sum + h.count, 0);
  const totalChallenge = report.partB.challengePerHour.reduce((sum, h) => sum + h.count, 0);
  const totalTestLaneBlock = report.partB.testLaneBlockPerHour.reduce((sum, h) => sum + h.count, 0);
  const totalDeny = report.partB.denyEventsPerHour.reduce((sum, h) => sum + h.count, 0);
  
  if (report.partA.readyNow > 0) {
    // Ready posts exist but not posting
    if (totalTestLaneBlock > 0) {
      report.partB.blockingDiagnosis.primaryBlocker = `TEST_LANE_BLOCK: ${totalTestLaneBlock} blocks in last 5h (ALLOW_TEST_POSTS not set or test posts filtered)`;
    } else if (totalConsentWall > 0) {
      report.partB.blockingDiagnosis.primaryBlocker = `CONSENT_WALL: ${totalConsentWall} consent wall detections blocking posts`;
    } else if (totalChallenge > 0) {
      report.partB.blockingDiagnosis.primaryBlocker = `CHALLENGE: ${totalChallenge} challenge detections blocking posts`;
    } else if (totalDeny > 0) {
      report.partB.blockingDiagnosis.primaryBlocker = `DENY/GATE: ${totalDeny} deny events blocking posts`;
    } else if (totalPostFailed > 0) {
      report.partB.blockingDiagnosis.primaryBlocker = `POST_FAILED: ${totalPostFailed} failures in last 5h`;
    } else {
      report.partB.blockingDiagnosis.primaryBlocker = `NO_EXECUTION: ${report.partA.readyNow} ready posts but 0 POST_SUCCESS events - posting queue not executing`;
    }
  } else {
    report.partB.blockingDiagnosis.primaryBlocker = 'NO_READY_POSTS: Zero ready posts in queue';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Generate report
  // ═══════════════════════════════════════════════════════════════════════
  
  report.executiveSummary = [
    `Ready posts NOW: ${report.partA.readyNow}`,
    `POST_SUCCESS in last 5h: ${totalPostSuccess}`,
    `Primary blocker: ${report.partB.blockingDiagnosis.primaryBlocker}`,
  ];
  
  // Determine root cause
  if (report.partA.readyNow === 0) {
    const totalDecisionsCreated = report.partC.decisionsCreatedPerHour.reduce((sum, h) => sum + h.posts, 0);
    if (totalDecisionsCreated === 0) {
      report.rootCause = 'Planning system not generating decisions (planJob may be failing or skipped)';
    } else {
      report.rootCause = 'Decisions created but not scheduled for immediate posting (scheduled_at too far in future)';
    }
  } else {
    report.rootCause = report.partB.blockingDiagnosis.primaryBlocker;
  }
  
  // Generate patch plan (placeholder - will be refined based on findings)
  report.patchPlan = [
    'TBD based on root cause',
  ];
  
  report.verificationPlan = [
    'Re-run PART A query to verify ready count > 0',
    'Monitor POST_SUCCESS events in system_events',
    'Check postingQueue logs for execution',
  ];

  // Write report
  const reportMarkdown = generateMarkdownReport(report);
  const fs = await import('fs/promises');
  await fs.writeFile('docs/NO_POSTS_5H_ROOT_CAUSE_REPORT.md', reportMarkdown);
  
  console.log('\n✅ Report generated: docs/NO_POSTS_5H_ROOT_CAUSE_REPORT.md');
  console.log('\n📋 Executive Summary:');
  report.executiveSummary.forEach(line => console.log(`   • ${line}`));
}

function formatDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second} UTC`;
}

function generateMarkdownReport(report: Report): string {
  const now = formatDateTime(NOW_UTC);
  const fiveHAgo = formatDateTime(FIVE_HOURS_AGO_UTC);
  
  return `# 🔍 NO POSTS 5H ROOT CAUSE REPORT

**Generated:** ${now}  
**Time Window:** ${fiveHAgo} to ${now} (5 hours)

---

## 📋 EXECUTIVE SUMMARY

${report.executiveSummary.map(s => `- ${s}`).join('\n')}

---

## PART A: Are there PROD decisions ready to post?

### Ready Count NOW

\`\`\`sql
SELECT COUNT(*) 
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
  AND scheduled_at <= NOW() + INTERVAL '5 minutes'
  AND (is_test_post IS NULL OR is_test_post = false);
\`\`\`

**Result:** ${report.partA.readyNow} ready posts

### Ready Count Per Hour (Last 5 Hours)

| Hour (UTC) | Ready Count |
|------------|-------------|
${report.partA.readyPerHour.map(h => `| ${h.hour} | ${h.count} |`).join('\n')}

### Oldest Ready Items (Top 20)

| decision_id | status | scheduled_at | created_at | pipeline_source | is_test_post | skip_reason |
|-------------|--------|---------------|------------|-----------------|--------------|-------------|
${report.partA.oldestReady.map(d => `| ${d.decision_id.substring(0, 8)}... | ${d.status} | ${d.scheduled_at} | ${d.created_at} | ${d.pipeline_source || 'NULL'} | ${d.is_test_post ?? 'NULL'} | ${d.skip_reason || 'NULL'} |`).join('\n')}

---

## PART B: If ready > 0, what is blocking posting?

### POST_SUCCESS Per Hour

| Hour (UTC) | Count |
|------------|-------|
${report.partB.postSuccessPerHour.map(h => `| ${h.hour} | ${h.count} |`).join('\n')}

### POST_FAILED Per Hour

| Hour (UTC) | Count | Reasons |
|------------|-------|---------|
${report.partB.postFailedPerHour.map(h => {
  const reasonsStr = Object.entries(h.reasons).map(([r, c]) => `${r}:${c}`).join(', ') || 'none';
  return `| ${h.hour} | ${h.count} | ${reasonsStr} |`;
}).join('\n')}

### CONSENT_WALL Per Hour

| Hour (UTC) | Count |
|------------|-------|
${report.partB.consentWallPerHour.map(h => `| ${h.hour} | ${h.count} |`).join('\n')}

### CHALLENGE Per Hour

| Hour (UTC) | Count |
|------------|-------|
${report.partB.challengePerHour.map(h => `| ${h.hour} | ${h.count} |`).join('\n')}

### TEST_LANE_BLOCK Per Hour

| Hour (UTC) | Count |
|------------|-------|
${report.partB.testLaneBlockPerHour.map(h => `| ${h.hour} | ${h.count} |`).join('\n')}

### DENY/GATE Events Per Hour

| Hour (UTC) | Count |
|------------|-------|
${report.partB.denyEventsPerHour.map(h => `| ${h.hour} | ${h.count} |`).join('\n')}

### Blocking Diagnosis

**Primary Blocker:** ${report.partB.blockingDiagnosis.primaryBlocker}

**Secondary Factors:**
${report.partB.blockingDiagnosis.secondaryFactors.map(f => `- ${f}`).join('\n') || '- None identified'}

---

## PART C: If ready = 0, why aren't we producing/queuing?

### Plan Windows (Expected vs Actual)

| Hour (UTC) | Expected | Actual | Target Posts | Target Replies |
|------------|----------|--------|--------------|----------------|
${report.partC.planWindows.map(w => `| ${w.window} | ${w.expected ? '✅' : '❌'} | ${w.actual ? '✅' : '❌'} | ${w.targetPosts} | ${w.targetReplies} |`).join('\n')}

### Latest Plan

- **Age:** ${report.partC.latestPlanAge || 'No plan found'}
- **Targets:** ${report.partC.latestPlanTargets.posts} posts, ${report.partC.latestPlanTargets.replies} replies

### Decisions Created Per Hour

| Hour (UTC) | Posts | Replies |
|------------|-------|---------|
${report.partC.decisionsCreatedPerHour.map(h => `| ${h.hour} | ${h.posts} | ${h.replies} |`).join('\n')}

### Scheduled At Offsets (How Far Ahead)

| Offset (hours) | Count |
|----------------|-------|
${report.partC.scheduledAtOffsets.map(o => `| ${o.offset_hours} | ${o.count} |`).join('\n') || '| No scheduled decisions |'}

### Job Skipping

- **Shadow Controller Skipped:** ${report.partC.jobSkipping.shadowControllerSkipped ? 'Yes' : 'No'}
- **Missing Plan Windows:** ${report.partC.jobSkipping.missingPlanWindows.length > 0 ? report.partC.jobSkipping.missingPlanWindows.join(', ') : 'None'}

---

## 🎯 ROOT CAUSE

**${report.rootCause}**

---

## 🔧 PATCH PLAN

${report.patchPlan.map((step, i) => `${i + 1}. ${step}`).join('\n')}

---

## ✅ VERIFICATION PLAN

After applying the patch, run these commands to verify posts resume:

${report.verificationPlan.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

---

**Report End**
`;
}

main().catch(console.error);
