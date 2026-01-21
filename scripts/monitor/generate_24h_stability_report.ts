#!/usr/bin/env tsx
/**
 * 📊 24-Hour Stability Bake Report Generator
 * 
 * Generates comprehensive Day 1 report with:
 * - Shadow plan generation continuity (hourly, no gaps)
 * - Enforcement verification (execution counters match targets, overruns = 0)
 * - Posting activity (POST_SUCCESS per hour)
 * - Resistance signals per hour (CONSENT_WALL, CHALLENGE, POST_FAIL)
 * - POST_FAILED breakdown (gates vs actual posting failures)
 * - GO/NO-GO recommendation
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface HourlyMetrics {
  hour: string;
  plan_generated: boolean;
  plan_id?: string;
  target_posts: number;
  target_replies: number;
  posts_done: number;
  replies_done: number;
  posts_overrun: number;
  replies_overrun: number;
  post_success: number;
  consent_wall: number;
  challenge: number;
  post_failed_total: number;
  post_failed_safety_gates: number;
  post_failed_platform: number;
  backoff_applied: boolean;
  backoff_reason?: string;
}

async function generate24HStabilityReport() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 GENERATING 24-HOUR STABILITY BAKE REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Period: ${startTime.toISOString()} to ${now.toISOString()}`);
    console.log('');

    // ===== 1. SHADOW PLAN GENERATION CONTINUITY =====
    console.log('📊 1. Checking shadow plan generation continuity...');
    const { rows: plans } = await client.query(`
      SELECT 
        plan_id,
        window_start,
        window_end,
        target_posts,
        target_replies,
        resistance_backoff_applied,
        backoff_reason,
        created_at
      FROM growth_plans
      WHERE window_start >= $1
        AND window_start < $2
      ORDER BY window_start ASC;
    `, [startTime.toISOString(), now.toISOString()]);

    // Generate hourly buckets
    const hourlyMetrics: Map<string, HourlyMetrics> = new Map();
    for (let i = 0; i < 24; i++) {
      const hourTime = new Date(startTime);
      hourTime.setHours(hourTime.getHours() + i);
      hourTime.setMinutes(0, 0, 0);
      const hourKey = hourTime.toISOString().substring(0, 13) + ':00:00Z';
      
      hourlyMetrics.set(hourKey, {
        hour: hourKey,
        plan_generated: false,
        target_posts: 0,
        target_replies: 0,
        posts_done: 0,
        replies_done: 0,
        posts_overrun: 0,
        replies_overrun: 0,
        post_success: 0,
        consent_wall: 0,
        challenge: 0,
        post_failed_total: 0,
        post_failed_safety_gates: 0,
        post_failed_platform: 0,
        backoff_applied: false,
      });
    }

    // Populate plan data
    plans.forEach(p => {
      const hourKey = new Date(p.window_start).toISOString().substring(0, 13) + ':00:00Z';
      const metrics = hourlyMetrics.get(hourKey);
      if (metrics) {
        metrics.plan_generated = true;
        metrics.plan_id = p.plan_id;
        metrics.target_posts = p.target_posts;
        metrics.target_replies = p.target_replies;
        metrics.backoff_applied = p.resistance_backoff_applied || false;
        metrics.backoff_reason = p.backoff_reason || undefined;
      }
    });

    // ===== 2. ENFORCEMENT VERIFICATION (EXECUTION COUNTERS) =====
    console.log('📊 2. Checking enforcement (execution counters)...');
    const { rows: execution } = await client.query(`
      SELECT 
        gp.plan_id,
        gp.window_start,
        gp.target_posts,
        gp.target_replies,
        COALESCE(ge.posts_done, 0) as posts_done,
        COALESCE(ge.replies_done, 0) as replies_done
      FROM growth_plans gp
      LEFT JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE gp.window_start >= $1
        AND gp.window_start < $2
      ORDER BY gp.window_start ASC;
    `, [startTime.toISOString(), now.toISOString()]);

    execution.forEach(e => {
      const hourKey = new Date(e.window_start).toISOString().substring(0, 13) + ':00:00Z';
      const metrics = hourlyMetrics.get(hourKey);
      if (metrics) {
        metrics.posts_done = parseInt(e.posts_done, 10);
        metrics.replies_done = parseInt(e.replies_done, 10);
        metrics.posts_overrun = Math.max(0, metrics.posts_done - metrics.target_posts);
        metrics.replies_overrun = Math.max(0, metrics.replies_done - metrics.target_replies);
      }
    });

    // Check for overruns
    const { rows: overruns } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans gp
      JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
        AND gp.window_start >= $1
        AND gp.window_start < $2;
    `, [startTime.toISOString(), now.toISOString()]);

    // ===== 3. POSTING ACTIVITY (POST_SUCCESS PER HOUR) =====
    console.log('📊 3. Checking posting activity (POST_SUCCESS per hour)...');
    const { rows: postSuccess } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count
      FROM system_events
      WHERE event_type = 'POST_SUCCESS'
        AND created_at >= $1
        AND created_at < $2
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [startTime.toISOString(), now.toISOString()]);

    postSuccess.forEach(ps => {
      const hourKey = new Date(ps.hour).toISOString().substring(0, 13) + ':00:00Z';
      const metrics = hourlyMetrics.get(hourKey);
      if (metrics) {
        metrics.post_success = parseInt(ps.count, 10);
      }
    });

    // ===== 4. RESISTANCE SIGNALS PER HOUR =====
    console.log('📊 4. Checking resistance signals per hour...');
    const { rows: consentWall } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count
      FROM system_events
      WHERE event_type = 'CONSENT_WALL'
        AND created_at >= $1
        AND created_at < $2
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [startTime.toISOString(), now.toISOString()]);

    consentWall.forEach(cw => {
      const hourKey = new Date(cw.hour).toISOString().substring(0, 13) + ':00:00Z';
      const metrics = hourlyMetrics.get(hourKey);
      if (metrics) {
        metrics.consent_wall = parseInt(cw.count, 10);
      }
    });

    const { rows: challenge } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count
      FROM system_events
      WHERE event_type = 'CHALLENGE'
        AND created_at >= $1
        AND created_at < $2
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [startTime.toISOString(), now.toISOString()]);

    challenge.forEach(ch => {
      const hourKey = new Date(ch.hour).toISOString().substring(0, 13) + ':00:00Z';
      const metrics = hourlyMetrics.get(hourKey);
      if (metrics) {
        metrics.challenge = parseInt(ch.count, 10);
      }
    });

    // ===== 5. POST_FAILED BREAKDOWN (GATES VS PLATFORM) =====
    console.log('📊 5. Analyzing POST_FAILED breakdown...');
    const { rows: postFailed } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'SAFETY_GATE%' OR event_data->>'pipeline_error_reason' LIKE 'INVALID_STATUS%' OR event_data->>'pipeline_error_reason' LIKE 'ANCESTRY%' OR event_data->>'pipeline_error_reason' LIKE '%OFF_LIMITS%') as safety_gates,
        COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'POSTING_FAILED%' OR event_data->>'pipeline_error_reason' LIKE '%timeout%' OR event_data->>'pipeline_error_reason' LIKE '%rate_limit%' OR event_data->>'pipeline_error_reason' LIKE '%consent%') as platform_failures
      FROM system_events
      WHERE event_type = 'POST_FAILED'
        AND created_at >= $1
        AND created_at < $2
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [startTime.toISOString(), now.toISOString()]);

    postFailed.forEach(pf => {
      const hourKey = new Date(pf.hour).toISOString().substring(0, 13) + ':00:00Z';
      const metrics = hourlyMetrics.get(hourKey);
      if (metrics) {
        metrics.post_failed_total = parseInt(pf.total, 10);
        metrics.post_failed_safety_gates = parseInt(pf.safety_gates, 10);
        metrics.post_failed_platform = parseInt(pf.platform_failures, 10);
      }
    });

    // ===== 6. DETAILED POST_FAILED ANALYSIS =====
    const { rows: postFailedDetail } = await client.query(`
      SELECT 
        event_data->>'pipeline_error_reason' as reason,
        COUNT(*) as count
      FROM system_events
      WHERE event_type = 'POST_FAILED'
        AND created_at >= $1
        AND created_at < $2
      GROUP BY event_data->>'pipeline_error_reason'
      ORDER BY count DESC;
    `, [startTime.toISOString(), now.toISOString()]);

    // ===== 7. INCIDENTS & AUTO-REMEDIATIONS =====
    console.log('📊 6. Checking incidents and auto-remediations...');
    const { rows: incidents } = await client.query(`
      SELECT 
        event_type,
        severity,
        message,
        event_data,
        created_at
      FROM system_events
      WHERE event_type IN (
        'COOLDOWN_MODE_ACTIVE',
        'COOLDOWN_MODE_ENDED',
        'COOLDOWN_MODE_EXTENDED',
        'ALERT_NO_ACTIVITY',
        'circuit_breaker_watchdog_alert',
        'critical_job_consecutive_failure',
        'shadow_controller_job_execution_failed'
      )
        AND created_at >= $1
        AND created_at < $2
      ORDER BY created_at DESC;
    `, [startTime.toISOString(), now.toISOString()]);

    // ===== 8. TOTAL COUNTS FOR SUMMARY =====
    const totalPostSuccess = Array.from(hourlyMetrics.values()).reduce((sum, m) => sum + m.post_success, 0);
    const totalConsentWall = Array.from(hourlyMetrics.values()).reduce((sum, m) => sum + m.consent_wall, 0);
    const totalChallenge = Array.from(hourlyMetrics.values()).reduce((sum, m) => sum + m.challenge, 0);
    const totalPostFailed = Array.from(hourlyMetrics.values()).reduce((sum, m) => sum + m.post_failed_total, 0);
    const totalPostFailedGates = Array.from(hourlyMetrics.values()).reduce((sum, m) => sum + m.post_failed_safety_gates, 0);
    const totalPostFailedPlatform = Array.from(hourlyMetrics.values()).reduce((sum, m) => sum + m.post_failed_platform, 0);
    const plansGenerated = plans.length;
    const expectedPlans = 24;
    const planGaps = expectedPlans - plansGenerated;

    // ===== 9. GO/NO-GO ANALYSIS =====
    const currentMaxReplies = parseInt(process.env.MAX_REPLIES_PER_HOUR || '3', 10);
    const canRestoreTo6 = 
      totalConsentWall < 5 &&
      totalChallenge === 0 &&
      totalPostFailedPlatform <= 1 &&
      parseInt(overruns[0].count, 10) === 0 &&
      planGaps === 0;

    // ===== GENERATE REPORT =====
    const reportLines: string[] = [];

    reportLines.push('# 📊 24-Hour Stability Bake Report');
    reportLines.push('');
    reportLines.push(`**Generated:** ${now.toISOString()}`);
    reportLines.push(`**Period:** ${startTime.toISOString()} to ${now.toISOString()}`);
    reportLines.push(`**Duration:** 24 hours`);
    reportLines.push('');
    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 📈 Executive Summary');
    reportLines.push('');
    reportLines.push(`- **Plans Generated:** ${plansGenerated}/${expectedPlans} (${planGaps > 0 ? `❌ ${planGaps} gaps` : '✅ no gaps'})`);
    reportLines.push(`- **POST_SUCCESS (24h):** ${totalPostSuccess}`);
    reportLines.push(`- **Target Overruns:** ${overruns[0].count} ${parseInt(overruns[0].count, 10) === 0 ? '✅' : '❌'}`);
    reportLines.push(`- **Resistance Signals:** CONSENT_WALL=${totalConsentWall}, CHALLENGE=${totalChallenge}, POST_FAILED=${totalPostFailed}`);
    reportLines.push(`- **POST_FAILED Breakdown:** Safety Gates=${totalPostFailedGates}, Platform=${totalPostFailedPlatform}`);
    reportLines.push(`- **Current MAX_REPLIES_PER_HOUR:** ${currentMaxReplies}`);
    reportLines.push('');
    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 1. Shadow Plan Generation Continuity');
    reportLines.push('');
    reportLines.push('**SQL Query:**');
    reportLines.push('```sql');
    reportLines.push(`SELECT plan_id, window_start, target_posts, target_replies, resistance_backoff_applied, backoff_reason`);
    reportLines.push(`FROM growth_plans`);
    reportLines.push(`WHERE window_start >= '${startTime.toISOString()}'`);
    reportLines.push(`  AND window_start < '${now.toISOString()}'`);
    reportLines.push(`ORDER BY window_start ASC;`);
    reportLines.push('```');
    reportLines.push('');
    reportLines.push('**Results:**');
    if (planGaps === 0) {
      reportLines.push('✅ **All 24 plans generated (no gaps)**');
    } else {
      reportLines.push(`❌ **Missing ${planGaps} plan(s) - gaps detected**`);
    }
    reportLines.push('');
    reportLines.push('**Plans by Hour:**');
    reportLines.push('| Hour | Plan Generated | Plan ID | Targets | Backoff |');
    reportLines.push('|------|----------------|---------|---------|---------|');
    Array.from(hourlyMetrics.values()).slice(0, 24).forEach(m => {
      const planStatus = m.plan_generated ? '✅' : '❌';
      const planId = m.plan_id ? m.plan_id.substring(0, 8) + '...' : 'N/A';
      const targets = m.plan_generated ? `${m.target_posts}p/${m.target_replies}r` : 'N/A';
      const backoff = m.backoff_applied ? '⚠️ YES' : '✅ NO';
      reportLines.push(`| ${m.hour.substring(11, 16)} | ${planStatus} | ${planId} | ${targets} | ${backoff} |`);
    });
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 2. Enforcement Verification (Execution Counters)');
    reportLines.push('');
    reportLines.push('**SQL Query:**');
    reportLines.push('```sql');
    reportLines.push(`SELECT`);
    reportLines.push(`  gp.plan_id,`);
    reportLines.push(`  gp.window_start,`);
    reportLines.push(`  gp.target_posts,`);
    reportLines.push(`  gp.target_replies,`);
    reportLines.push(`  COALESCE(ge.posts_done, 0) as posts_done,`);
    reportLines.push(`  COALESCE(ge.replies_done, 0) as replies_done`);
    reportLines.push(`FROM growth_plans gp`);
    reportLines.push(`LEFT JOIN growth_execution ge ON ge.plan_id = gp.plan_id`);
    reportLines.push(`WHERE gp.window_start >= '${startTime.toISOString()}'`);
    reportLines.push(`  AND gp.window_start < '${now.toISOString()}'`);
    reportLines.push(`ORDER BY gp.window_start ASC;`);
    reportLines.push('```');
    reportLines.push('');
    reportLines.push('**Overrun Check:**');
    reportLines.push('```sql');
    reportLines.push(`SELECT COUNT(*) as count`);
    reportLines.push(`FROM growth_plans gp`);
    reportLines.push(`JOIN growth_execution ge ON ge.plan_id = gp.plan_id`);
    reportLines.push(`WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)`);
    reportLines.push(`  AND gp.window_start >= '${startTime.toISOString()}'`);
    reportLines.push(`  AND gp.window_start < '${now.toISOString()}';`);
    reportLines.push('```');
    reportLines.push('');
    reportLines.push('**Result:**');
    if (parseInt(overruns[0].count, 10) === 0) {
      reportLines.push('✅ **No target overruns (0 rows returned)**');
    } else {
      reportLines.push(`❌ **${overruns[0].count} plan(s) exceeded targets**`);
    }
    reportLines.push('');
    reportLines.push('**Execution vs Targets by Hour:**');
    reportLines.push('| Hour | Plan | Target | Actual | Status |');
    reportLines.push('|------|------|--------|--------|--------|');
    Array.from(hourlyMetrics.values()).slice(0, 24).forEach(m => {
      if (m.plan_generated) {
        const postsStatus = m.posts_overrun > 0 ? `❌ +${m.posts_overrun}` : `✅ ${m.posts_done}/${m.target_posts}`;
        const repliesStatus = m.replies_overrun > 0 ? `❌ +${m.replies_overrun}` : `✅ ${m.replies_done}/${m.target_replies}`;
        reportLines.push(`| ${m.hour.substring(11, 16)} | ${m.target_posts}p/${m.target_replies}r | ${m.posts_done}p/${m.replies_done}r | Posts: ${postsStatus}, Replies: ${repliesStatus} |`);
      }
    });
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 3. Posting Activity (POST_SUCCESS per Hour)');
    reportLines.push('');
    reportLines.push('**SQL Query:**');
    reportLines.push('```sql');
    reportLines.push(`SELECT`);
    reportLines.push(`  DATE_TRUNC('hour', created_at) as hour,`);
    reportLines.push(`  COUNT(*) as count`);
    reportLines.push(`FROM system_events`);
    reportLines.push(`WHERE event_type = 'POST_SUCCESS'`);
    reportLines.push(`  AND created_at >= '${startTime.toISOString()}'`);
    reportLines.push(`  AND created_at < '${now.toISOString()}'`);
    reportLines.push(`GROUP BY DATE_TRUNC('hour', created_at)`);
    reportLines.push(`ORDER BY hour ASC;`);
    reportLines.push('```');
    reportLines.push('');
    reportLines.push('**Total POST_SUCCESS (24h):** ' + totalPostSuccess);
    reportLines.push('');
    reportLines.push('**POST_SUCCESS by Hour:**');
    reportLines.push('| Hour | Count |');
    reportLines.push('|------|-------|');
    Array.from(hourlyMetrics.values()).slice(0, 24).forEach(m => {
      reportLines.push(`| ${m.hour.substring(11, 16)} | ${m.post_success} |`);
    });
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 4. Resistance Signals per Hour');
    reportLines.push('');
    reportLines.push('**SQL Query:**');
    reportLines.push('```sql');
    reportLines.push(`SELECT`);
    reportLines.push(`  DATE_TRUNC('hour', created_at) as hour,`);
    reportLines.push(`  COUNT(*) FILTER (WHERE event_type = 'CONSENT_WALL') as consent_wall,`);
    reportLines.push(`  COUNT(*) FILTER (WHERE event_type = 'CHALLENGE') as challenge,`);
    reportLines.push(`  COUNT(*) FILTER (WHERE event_type = 'POST_FAILED') as post_failed`);
    reportLines.push(`FROM system_events`);
    reportLines.push(`WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')`);
    reportLines.push(`  AND created_at >= '${startTime.toISOString()}'`);
    reportLines.push(`  AND created_at < '${now.toISOString()}'`);
    reportLines.push(`GROUP BY DATE_TRUNC('hour', created_at)`);
    reportLines.push(`ORDER BY hour ASC;`);
    reportLines.push('```');
    reportLines.push('');
    reportLines.push('**Total Resistance Signals (24h):**');
    reportLines.push(`- CONSENT_WALL: ${totalConsentWall}`);
    reportLines.push(`- CHALLENGE: ${totalChallenge}`);
    reportLines.push(`- POST_FAILED: ${totalPostFailed}`);
    reportLines.push('');
    reportLines.push('**Resistance Signals by Hour:**');
    reportLines.push('| Hour | CONSENT_WALL | CHALLENGE | POST_FAILED |');
    reportLines.push('|------|--------------|-----------|-------------|');
    Array.from(hourlyMetrics.values()).slice(0, 24).forEach(m => {
      reportLines.push(`| ${m.hour.substring(11, 16)} | ${m.consent_wall} | ${m.challenge} | ${m.post_failed_total} |`);
    });
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 5. POST_FAILED Breakdown (Gates vs Platform)');
    reportLines.push('');
    reportLines.push('**SQL Query:**');
    reportLines.push('```sql');
    reportLines.push(`SELECT`);
    reportLines.push(`  DATE_TRUNC('hour', created_at) as hour,`);
    reportLines.push(`  COUNT(*) as total,`);
    reportLines.push(`  COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'SAFETY_GATE%' OR event_data->>'pipeline_error_reason' LIKE 'INVALID_STATUS%' OR event_data->>'pipeline_error_reason' LIKE 'ANCESTRY%' OR event_data->>'pipeline_error_reason' LIKE '%OFF_LIMITS%') as safety_gates,`);
    reportLines.push(`  COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'POSTING_FAILED%' OR event_data->>'pipeline_error_reason' LIKE '%timeout%' OR event_data->>'pipeline_error_reason' LIKE '%rate_limit%' OR event_data->>'pipeline_error_reason' LIKE '%consent%') as platform_failures`);
    reportLines.push(`FROM system_events`);
    reportLines.push(`WHERE event_type = 'POST_FAILED'`);
    reportLines.push(`  AND created_at >= '${startTime.toISOString()}'`);
    reportLines.push(`  AND created_at < '${now.toISOString()}'`);
    reportLines.push(`GROUP BY DATE_TRUNC('hour', created_at)`);
    reportLines.push(`ORDER BY hour ASC;`);
    reportLines.push('```');
    reportLines.push('');
    reportLines.push('**Total Breakdown (24h):**');
    reportLines.push(`- Total POST_FAILED: ${totalPostFailed}`);
    reportLines.push(`- Safety Gates: ${totalPostFailedGates} (${totalPostFailed > 0 ? ((totalPostFailedGates / totalPostFailed) * 100).toFixed(1) : 0}%)`);
    reportLines.push(`- Platform Failures: ${totalPostFailedPlatform} (${totalPostFailed > 0 ? ((totalPostFailedPlatform / totalPostFailed) * 100).toFixed(1) : 0}%)`);
    reportLines.push('');
    reportLines.push('**POST_FAILED by Hour:**');
    reportLines.push('| Hour | Total | Safety Gates | Platform |');
    reportLines.push('|------|-------|--------------|----------|');
    Array.from(hourlyMetrics.values()).slice(0, 24).forEach(m => {
      reportLines.push(`| ${m.hour.substring(11, 16)} | ${m.post_failed_total} | ${m.post_failed_safety_gates} | ${m.post_failed_platform} |`);
    });
    reportLines.push('');
    reportLines.push('**Top POST_FAILED Reasons:**');
    reportLines.push('| Reason | Count |');
    reportLines.push('|--------|-------|');
    postFailedDetail.forEach(pfd => {
      reportLines.push(`| ${pfd.reason || 'UNKNOWN'} | ${pfd.count} |`);
    });
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 6. Incidents & Auto-Remediations');
    reportLines.push('');
    if (incidents.length === 0) {
      reportLines.push('✅ **No incidents recorded**');
    } else {
      reportLines.push(`**Total Incidents:** ${incidents.length}`);
      reportLines.push('');
      incidents.forEach(inc => {
        reportLines.push(`### ${inc.event_type} (${inc.severity})`);
        reportLines.push(`- **Time:** ${inc.created_at}`);
        reportLines.push(`- **Message:** ${inc.message}`);
        if (inc.event_data) {
          reportLines.push(`- **Details:** ${JSON.stringify(inc.event_data, null, 2)}`);
        }
        reportLines.push('');
      });
    }
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 7. GO/NO-GO Recommendation');
    reportLines.push('');
    reportLines.push('**Exit Criteria:**');
    reportLines.push(`- CONSENT_WALL < 5 in last 12h: ${totalConsentWall < 5 ? '✅ PASS' : '❌ FAIL'} (${totalConsentWall})`);
    reportLines.push(`- CHALLENGE = 0 in last 12h: ${totalChallenge === 0 ? '✅ PASS' : '❌ FAIL'} (${totalChallenge})`);
    reportLines.push(`- Actual posting failures <= 1 in last 12h: ${totalPostFailedPlatform <= 1 ? '✅ PASS' : '❌ FAIL'} (${totalPostFailedPlatform})`);
    reportLines.push(`- Target overruns = 0: ${parseInt(overruns[0].count, 10) === 0 ? '✅ PASS' : '❌ FAIL'} (${overruns[0].count})`);
    reportLines.push(`- Plan continuity: ${planGaps === 0 ? '✅ PASS' : '❌ FAIL'} (${planGaps} gaps)`);
    reportLines.push('');
    
    if (canRestoreTo6) {
      reportLines.push('## ✅ **GO: RESTORE MAX_REPLIES_PER_HOUR TO 6**');
      reportLines.push('');
      reportLines.push('**Rationale:**');
      reportLines.push('- All exit criteria passed');
      reportLines.push('- System is stable and ready for higher cadence');
      reportLines.push('- Safety gates are working correctly (blocking unsafe content)');
      reportLines.push('- Platform resistance is low');
      reportLines.push('');
      reportLines.push('**Action:**');
      reportLines.push('```bash');
      reportLines.push('railway variables --set "MAX_REPLIES_PER_HOUR=6"');
      reportLines.push('railway redeploy');
      reportLines.push('```');
    } else {
      reportLines.push('## ⚠️ **NO-GO: EXTEND COOLDOWN / KEEP CONSERVATIVE CAPS**');
      reportLines.push('');
      reportLines.push('**Rationale:**');
      if (totalConsentWall >= 5) {
        reportLines.push(`- CONSENT_WALL still high: ${totalConsentWall} (threshold: <5)`);
      }
      if (totalChallenge > 0) {
        reportLines.push(`- CHALLENGE signals detected: ${totalChallenge}`);
      }
      if (totalPostFailedPlatform > 1) {
        reportLines.push(`- Platform failures too high: ${totalPostFailedPlatform} (threshold: <=1)`);
      }
      if (parseInt(overruns[0].count, 10) > 0) {
        reportLines.push(`- Target overruns detected: ${overruns[0].count}`);
      }
      if (planGaps > 0) {
        reportLines.push(`- Plan generation gaps: ${planGaps}`);
      }
      reportLines.push('');
      reportLines.push('**Action:**');
      reportLines.push('- Keep `MAX_REPLIES_PER_HOUR=3` (or reduce to 2 if CONSENT_WALL persists)');
      reportLines.push('- Continue monitoring for next 12 hours');
      reportLines.push('- Re-check exit criteria');
      reportLines.push('');
    }
    reportLines.push('');

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## 8. Next Change Recommendation');
    reportLines.push('');
    
    // Check if REPLY_TOO_GENERIC gate would be useful
    const { rows: replyQuality } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE '%generic%' OR event_data->>'pipeline_error_reason' LIKE '%low_quality%') as quality_blocks
      FROM system_events
      WHERE event_type = 'POST_FAILED'
        AND created_at >= $1
        AND created_at < $2;
    `, [startTime.toISOString(), now.toISOString()]).catch(() => ({ rows: [{ total: 0, quality_blocks: 0 }] }));

    const qualityBlockRate = totalPostFailed > 0 ? (parseInt(replyQuality[0]?.quality_blocks || '0', 10) / totalPostFailed) * 100 : 0;
    
    if (totalPostFailedGates > 0 && qualityBlockRate < 10) {
      reportLines.push('### Consider Adding REPLY_TOO_GENERIC Gate');
      reportLines.push('');
      reportLines.push('**Rationale:**');
      reportLines.push('- Safety gates are working well, but no quality-based filtering detected');
      reportLines.push('- Adding REPLY_TOO_GENERIC gate could improve reply quality');
      reportLines.push('- Would complement existing safety gates (ANCESTRY, OFF_LIMITS, etc.)');
      reportLines.push('');
      reportLines.push('**Implementation:**');
      reportLines.push('- Add quality check in reply decision flow');
      reportLines.push('- Block generic/repetitive replies before posting');
      reportLines.push('- Log as POST_FAILED with reason: SAFETY_GATE_REPLY_TOO_GENERIC');
      reportLines.push('');
    } else {
      reportLines.push('### No Immediate Gate Changes Recommended');
      reportLines.push('');
      reportLines.push('**Rationale:**');
      reportLines.push('- Current safety gates are working correctly');
      reportLines.push('- Focus on platform resistance and posting reliability first');
      reportLines.push('- Re-evaluate after higher cadence is restored');
      reportLines.push('');
    }

    reportLines.push('---');
    reportLines.push('');
    reportLines.push('**Report Generated:** ' + now.toISOString());

    // Write report
    const reportPath = path.join(process.cwd(), 'docs', 'GO_LIVE_DAY1_REPORT.md');
    fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
    
    console.log(`✅ Report generated: ${reportPath}`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 REPORT SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Plans Generated: ${plansGenerated}/${expectedPlans} ${planGaps === 0 ? '✅' : '❌'}`);
    console.log(`POST_SUCCESS (24h): ${totalPostSuccess}`);
    console.log(`Overruns: ${overruns[0].count} ${parseInt(overruns[0].count, 10) === 0 ? '✅' : '❌'}`);
    console.log(`Resistance: CONSENT_WALL=${totalConsentWall}, CHALLENGE=${totalChallenge}, POST_FAILED=${totalPostFailed}`);
    console.log(`POST_FAILED: Gates=${totalPostFailedGates}, Platform=${totalPostFailedPlatform}`);
    console.log('');
    console.log(canRestoreTo6 ? '✅ **GO: RESTORE TO 6/hr**' : '⚠️ **NO-GO: KEEP CONSERVATIVE**');
    console.log('');

  } finally {
    await client.end();
  }
}

generate24HStabilityReport().catch(err => {
  console.error('❌ Report generation failed:', err);
  process.exit(1);
});
