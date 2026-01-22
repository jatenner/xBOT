#!/usr/bin/env tsx
/**
 * 📊 24H FINAL BAKE REPORT GENERATOR
 * 
 * Generates comprehensive 24h bake report with all required sections:
 * A) Plan continuity: expected vs actual hourly windows
 * B) Posting outcomes: POST_SUCCESS count by hour + URLs verified
 * C) Replies: reply attempts / successes / DENY reasons
 * D) Resistance: CONSENT_WALL / CHALLENGE / POST_FAILED by hour
 * E) Overruns: must be 0
 * F) PROD vs TEST: TEST must be 0
 * G) Stuck states: content_metadata statuses + oldest ages
 */

import 'dotenv/config';
import { pool } from '../../src/db/client';
import { assertValidTweetId } from '../../src/posting/tweetIdValidator';
import { writeFileSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

async function checkUrlExists(url: string): Promise<{ exists: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; xBOT-verification/1.0)'
      }
    }, (res) => {
      const statusCode = res.statusCode || 0;
      res.destroy();
      
      if (statusCode >= 200 && statusCode < 400) {
        resolve({ exists: true, statusCode });
      } else if (statusCode === 404) {
        resolve({ exists: false, statusCode, error: 'Not found' });
      } else {
        resolve({ exists: false, statusCode, error: `HTTP ${statusCode}` });
      }
    });
    
    req.on('error', (err: any) => {
      resolve({ exists: false, error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ exists: false, error: 'Timeout' });
    });
    
    req.setTimeout(10000);
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 24H FINAL BAKE REPORT GENERATOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();
  const now = new Date();
  const reportStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  console.log(`📅 Generating report for last 24 hours (${reportStart.toISOString()} to ${now.toISOString()})...\n`);

  try {
    const reportLines: string[] = [];
    reportLines.push('# 📊 24H FINAL BAKE REPORT');
    reportLines.push('');
    reportLines.push(`**Generated:** ${now.toISOString()}`);
    reportLines.push(`**Period:** ${reportStart.toISOString()} to ${now.toISOString()}`);
    reportLines.push(`**Duration:** 24 hours`);
    reportLines.push(`**Mode:** PROD-ONLY (ALLOW_TEST_POSTS unset)`);
    reportLines.push('');
    reportLines.push('---');
    reportLines.push('');

    // A) PLAN CONTINUITY: Expected vs Actual Hourly Windows
    console.log('📊 A) Plan Continuity: Expected vs Actual Hourly Windows...');
    reportLines.push('## A) Plan Continuity: Expected vs Actual Hourly Windows');
    reportLines.push('');

    // Generate expected hourly windows
    const expectedHours: string[] = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStr = hour.toISOString().substring(0, 13) + ':00:00Z';
      expectedHours.push(hourStr);
    }

    // Get actual plans
    const { rows: actualPlans } = await client.query(`
      SELECT 
        window_start,
        plan_id,
        target_posts,
        target_replies,
        created_at
      FROM growth_plans
      WHERE window_start >= $1
      ORDER BY window_start ASC;
    `, [reportStart.toISOString()]);

    const planMap = new Map<string, any>();
    actualPlans.forEach((plan: any) => {
      const hourStr = new Date(plan.window_start).toISOString().substring(0, 13) + ':00:00Z';
      planMap.set(hourStr, plan);
    });

    reportLines.push('| Hour (UTC) | Expected | Actual | Plan ID | Targets | Status |');
    reportLines.push('|------------|----------|--------|---------|---------|--------|');

    let plansPresent = 0;
    let plansMissing = 0;

    expectedHours.forEach(hour => {
      const plan = planMap.get(hour);
      if (plan) {
        plansPresent++;
        reportLines.push(`| ${hour} | ✅ | ✅ | ${plan.plan_id.substring(0, 8)}... | ${plan.target_posts}p/${plan.target_replies}r | Present |`);
      } else {
        plansMissing++;
        reportLines.push(`| ${hour} | ✅ | ❌ | - | - | **MISSING** |`);
      }
    });

    reportLines.push('');
    reportLines.push(`**Summary:** ${plansPresent}/${expectedHours.length} plans present, ${plansMissing} missing`);
    reportLines.push('');

    // B) POSTING OUTCOMES: POST_SUCCESS count by hour + URLs verified
    console.log('📊 B) Posting Outcomes: POST_SUCCESS count by hour...');
    reportLines.push('## B) Posting Outcomes: POST_SUCCESS Count by Hour + URLs Verified');
    reportLines.push('');

    const { rows: postSuccessByHour } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count,
        array_agg(id ORDER BY created_at) as event_ids
      FROM system_events
      WHERE event_type IN ('POST_SUCCESS', 'POST_SUCCESS_PROD', 'POST_SUCCESS_TEST')
        AND created_at >= $1
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [reportStart.toISOString()]);

    reportLines.push('| Hour (UTC) | POST_SUCCESS Count |');
    reportLines.push('|------------|---------------------|');

    let totalPostSuccess = 0;
    for (const row of postSuccessByHour) {
      const count = parseInt(row.count, 10);
      totalPostSuccess += count;
      const hourStr = new Date(row.hour).toISOString();
      reportLines.push(`| ${hourStr} | ${count} |`);
    }

    reportLines.push('');
    reportLines.push(`**Total POST_SUCCESS:** ${totalPostSuccess}`);
    reportLines.push('');

    // Get all POST_SUCCESS events for URL verification
    const { rows: allPostSuccess } = await client.query(`
      SELECT 
        id,
        created_at,
        event_data
      FROM system_events
      WHERE event_type IN ('POST_SUCCESS', 'POST_SUCCESS_PROD', 'POST_SUCCESS_TEST')
        AND created_at >= $1
      ORDER BY created_at ASC;
    `, [reportStart.toISOString()]);

    reportLines.push('### URL Verification');
    reportLines.push('');
    reportLines.push('| Decision ID | Tweet ID | Length | Valid | URL | URL Status |');
    reportLines.push('|------------|---------|--------|-------|-----|------------|');

    let validCount = 0;
    let urlLoadCount = 0;

    for (const event of allPostSuccess) {
      const eventData = typeof event.event_data === 'string' 
        ? JSON.parse(event.event_data) 
        : event.event_data;
      
      const tweetId = eventData.tweet_id;
      const decisionId = eventData.decision_id || 'unknown';
      const tweetUrl = eventData.tweet_url || `https://x.com/Signal_Synapse/status/${tweetId}`;

      const validation = assertValidTweetId(tweetId);
      const isValid = validation.valid;
      if (isValid) validCount++;

      let urlStatus = 'Not checked';
      if (isValid && tweetUrl) {
        console.log(`🔍 Checking URL: ${tweetUrl}...`);
        const check = await checkUrlExists(tweetUrl);
        urlStatus = check.exists ? `✅ Loads (${check.statusCode})` : `❌ ${check.error || 'Failed'}`;
        if (check.exists) urlLoadCount++;
      }

      reportLines.push(`| ${decisionId.substring(0, 8)}... | ${tweetId} | ${tweetId.length} | ${isValid ? '✅' : '❌'} | [Link](${tweetUrl}) | ${urlStatus} |`);
    }

    reportLines.push('');
    reportLines.push(`**Valid Tweet IDs:** ${validCount}/${allPostSuccess.length}`);
    reportLines.push(`**URLs Load:** ${urlLoadCount}/${allPostSuccess.length}`);
    reportLines.push('');

    // C) REPLIES: Reply attempts / successes / DENY reasons
    console.log('📊 C) Replies: Attempts / Successes / DENY reasons...');
    reportLines.push('## C) Replies: Attempts / Successes / DENY Reasons');
    reportLines.push('');

    // Reply attempts (POST_ATTEMPT with decision_type=reply)
    const { rows: replyAttempts } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count
      FROM system_events
      WHERE event_type = 'POST_ATTEMPT'
        AND event_data->>'decision_type' = 'reply'
        AND created_at >= $1
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [reportStart.toISOString()]);

    // Reply successes (REPLY_SUCCESS)
    const { rows: replySuccesses } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count
      FROM system_events
      WHERE event_type = 'REPLY_SUCCESS'
        AND created_at >= $1
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour ASC;
    `, [reportStart.toISOString()]);

    // DENY reasons from reply_decisions
    const { rows: denyReasons } = await client.query(`
      SELECT 
        deny_reason_code,
        COUNT(*) as count
      FROM reply_decisions
      WHERE created_at >= $1
        AND deny_reason_code IS NOT NULL
      GROUP BY deny_reason_code
      ORDER BY count DESC;
    `, [reportStart.toISOString()]);

    reportLines.push('### Reply Attempts by Hour');
    reportLines.push('| Hour (UTC) | Attempts |');
    reportLines.push('|------------|----------|');
    
    let totalReplyAttempts = 0;
    replyAttempts.forEach((row: any) => {
      const count = parseInt(row.count, 10);
      totalReplyAttempts += count;
      const hourStr = new Date(row.hour).toISOString();
      reportLines.push(`| ${hourStr} | ${count} |`);
    });

    reportLines.push('');
    reportLines.push(`**Total Reply Attempts:** ${totalReplyAttempts}`);
    reportLines.push('');

    reportLines.push('### Reply Successes by Hour');
    reportLines.push('| Hour (UTC) | Successes |');
    reportLines.push('|------------|-----------|');
    
    let totalReplySuccesses = 0;
    replySuccesses.forEach((row: any) => {
      const count = parseInt(row.count, 10);
      totalReplySuccesses += count;
      const hourStr = new Date(row.hour).toISOString();
      reportLines.push(`| ${hourStr} | ${count} |`);
    });

    reportLines.push('');
    reportLines.push(`**Total Reply Successes:** ${totalReplySuccesses}`);
    reportLines.push(`**Reply Success Rate:** ${totalReplyAttempts > 0 ? ((totalReplySuccesses / totalReplyAttempts) * 100).toFixed(2) : 0}%`);
    reportLines.push('');

    reportLines.push('### DENY Reasons Breakdown');
    reportLines.push('| Reason Code | Count |');
    reportLines.push('|-------------|-------|');
    
    denyReasons.forEach((row: any) => {
      reportLines.push(`| ${row.deny_reason_code} | ${row.count} |`);
    });

    if (denyReasons.length === 0) {
      reportLines.push('| (none) | 0 |');
    }

    reportLines.push('');

    // D) RESISTANCE: CONSENT_WALL / CHALLENGE / POST_FAILED by hour
    console.log('📊 D) Resistance: CONSENT_WALL / CHALLENGE / POST_FAILED...');
    reportLines.push('## D) Resistance: CONSENT_WALL / CHALLENGE / POST_FAILED by Hour');
    reportLines.push('');

    const { rows: resistanceEvents } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        event_type,
        COUNT(*) as count
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')
        AND created_at >= $1
      GROUP BY DATE_TRUNC('hour', created_at), event_type
      ORDER BY hour ASC, event_type;
    `, [reportStart.toISOString()]);

    reportLines.push('| Hour (UTC) | CONSENT_WALL | CHALLENGE | POST_FAILED |');
    reportLines.push('|------------|--------------|-----------|-------------|');

    const resistanceByHour = new Map<string, { consent_wall: number; challenge: number; post_failed: number }>();
    
    resistanceEvents.forEach((row: any) => {
      const hourStr = new Date(row.hour).toISOString();
      if (!resistanceByHour.has(hourStr)) {
        resistanceByHour.set(hourStr, { consent_wall: 0, challenge: 0, post_failed: 0 });
      }
      const hourData = resistanceByHour.get(hourStr)!;
      if (row.event_type === 'CONSENT_WALL') hourData.consent_wall = parseInt(row.count, 10);
      if (row.event_type === 'CHALLENGE') hourData.challenge = parseInt(row.count, 10);
      if (row.event_type === 'POST_FAILED') hourData.post_failed = parseInt(row.count, 10);
    });

    let totalConsentWall = 0;
    let totalChallenge = 0;
    let totalPostFailed = 0;

    resistanceByHour.forEach((data, hour) => {
      totalConsentWall += data.consent_wall;
      totalChallenge += data.challenge;
      totalPostFailed += data.post_failed;
      reportLines.push(`| ${hour} | ${data.consent_wall} | ${data.challenge} | ${data.post_failed} |`);
    });

    reportLines.push('');
    reportLines.push(`**Total CONSENT_WALL:** ${totalConsentWall}`);
    reportLines.push(`**Total CHALLENGE:** ${totalChallenge}`);
    reportLines.push(`**Total POST_FAILED:** ${totalPostFailed}`);
    reportLines.push('');

    // E) OVERRUNS: Must be 0
    console.log('📊 E) Overruns: Must be 0...');
    reportLines.push('## E) Overruns: Must be 0');
    reportLines.push('');

    const { rows: overruns } = await client.query(`
      SELECT 
        gp.plan_id,
        gp.window_start,
        gp.target_posts,
        gp.target_replies,
        ge.posts_done,
        ge.replies_done,
        (ge.posts_done - gp.target_posts) as posts_overrun,
        (ge.replies_done - gp.target_replies) as replies_overrun
      FROM growth_plans gp
      JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE gp.window_start >= $1
        AND (
          (ge.posts_done > gp.target_posts AND gp.target_posts > 0)
          OR (ge.replies_done > gp.target_replies AND gp.target_replies > 0)
        )
      ORDER BY gp.window_start DESC;
    `, [reportStart.toISOString()]);

    if (overruns.length === 0) {
      reportLines.push('✅ **PASS** - No target overruns');
      reportLines.push('');
    } else {
      reportLines.push('❌ **FAIL** - Target overruns detected:');
      reportLines.push('');
      reportLines.push('| Plan ID | Window Start | Targets | Actual | Overrun |');
      reportLines.push('|---------|--------------|---------|--------|---------|');
      
      overruns.forEach((row: any) => {
        reportLines.push(`| ${row.plan_id.substring(0, 8)}... | ${row.window_start} | ${row.target_posts}p/${row.target_replies}r | ${row.posts_done}p/${row.replies_done}r | ${row.posts_overrun}p/${row.replies_overrun}r |`);
      });
      reportLines.push('');
    }

    // F) PROD vs TEST: TEST must be 0
    console.log('📊 F) PROD vs TEST: TEST must be 0...');
    reportLines.push('## F) PROD vs TEST: TEST Must be 0');
    reportLines.push('');

    // Get all POST_SUCCESS events and check is_test_post from content_metadata
    const { rows: allPostSuccessEvents } = await client.query(`
      SELECT 
        id,
        event_type,
        created_at,
        event_data->>'decision_id' as decision_id,
        event_data->>'tweet_id' as tweet_id
      FROM system_events
      WHERE event_type IN ('POST_SUCCESS', 'POST_SUCCESS_PROD', 'POST_SUCCESS_TEST', 'REPLY_SUCCESS')
        AND created_at >= $1
      ORDER BY created_at ASC;
    `, [reportStart.toISOString()]);

    let postSuccessProd = 0;
    let postSuccessTest = 0;
    let replySuccess = 0;

    // Check each event's decision_id in content_metadata for is_test_post
    for (const event of allPostSuccessEvents) {
      if (event.event_type === 'REPLY_SUCCESS') {
        replySuccess++;
        continue;
      }

      if (event.event_type === 'POST_SUCCESS_TEST') {
        postSuccessTest++;
        continue;
      }

      if (event.event_type === 'POST_SUCCESS_PROD') {
        postSuccessProd++;
        continue;
      }

      // For generic POST_SUCCESS, check content_metadata
      if (event.decision_id) {
        const { rows: contentCheck } = await client.query(`
          SELECT is_test_post 
          FROM content_metadata 
          WHERE decision_id = $1
          LIMIT 1;
        `, [event.decision_id]);

        if (contentCheck.length > 0 && contentCheck[0].is_test_post === true) {
          postSuccessTest++;
        } else {
          postSuccessProd++;
        }
      } else {
        // No decision_id, treat as PROD (fail-closed)
        postSuccessProd++;
      }
    }

    // Check content_metadata for is_test_post
    const { rows: testPostCheck } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_test_post = true) as test_posts,
        COUNT(*) FILTER (WHERE is_test_post = false OR is_test_post IS NULL) as prod_posts
      FROM content_metadata
      WHERE status = 'posted'
        AND posted_at >= $1;
    `, [reportStart.toISOString()]);

    reportLines.push('### POST_SUCCESS Breakdown');
    reportLines.push('| Event Type | Count |');
    reportLines.push('|------------|-------|');
    reportLines.push(`| POST_SUCCESS_PROD | ${postSuccessProd} |`);
    reportLines.push(`| POST_SUCCESS_TEST | ${postSuccessTest} |`);
    reportLines.push(`| REPLY_SUCCESS | ${replySuccess} |`);
    reportLines.push('');

    reportLines.push('### Content Metadata Test Post Check');
    reportLines.push(`**Test Posts Posted:** ${testPostCheck[0]?.test_posts || 0}`);
    reportLines.push(`**Prod Posts Posted:** ${testPostCheck[0]?.prod_posts || 0}`);
    reportLines.push('');

    // Final check: both must be 0
    const testPostsInEvents = postSuccessTest;
    const testPostsInMetadata = parseInt(testPostCheck[0]?.test_posts || '0', 10);
    const totalTestPosts = testPostsInEvents + testPostsInMetadata;

    if (totalTestPosts === 0) {
      reportLines.push('✅ **PASS** - No test posts in POST_SUCCESS or content_metadata');
    } else {
      reportLines.push(`❌ **FAIL** - Test posts detected: ${testPostsInEvents} in events, ${testPostsInMetadata} in metadata`);
    }
    reportLines.push('');

    // G) STUCK STATES: content_metadata statuses + oldest ages
    console.log('📊 G) Stuck States: content_metadata statuses...');
    reportLines.push('## G) Stuck States: Content Metadata Statuses + Oldest Ages');
    reportLines.push('');

    const { rows: stuckStates } = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest,
        EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/3600 as oldest_hours
      FROM content_metadata
      WHERE status IN ('queued', 'posting', 'failed', 'blocked')
      GROUP BY status
      ORDER BY status;
    `);

    reportLines.push('| Status | Count | Oldest | Newest | Age (hours) |');
    reportLines.push('|--------|-------|--------|--------|-------------|');

    stuckStates.forEach((row: any) => {
      const ageHours = parseFloat(row.oldest_hours).toFixed(2);
      reportLines.push(`| ${row.status} | ${row.count} | ${row.oldest} | ${row.newest} | ${ageHours} |`);
    });

    reportLines.push('');

    // Summary
    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## Summary');
    reportLines.push('');
    reportLines.push(`- **Plans Present:** ${plansPresent}/${expectedHours.length}`);
    reportLines.push(`- **Total POST_SUCCESS:** ${totalPostSuccess}`);
    reportLines.push(`- **Valid Tweet IDs:** ${validCount}/${allPostSuccess.length}`);
    reportLines.push(`- **URLs Load:** ${urlLoadCount}/${allPostSuccess.length}`);
    reportLines.push(`- **Reply Attempts:** ${totalReplyAttempts}`);
    reportLines.push(`- **Reply Successes:** ${totalReplySuccesses}`);
    reportLines.push(`- **Reply Success Rate:** ${totalReplyAttempts > 0 ? ((totalReplySuccesses / totalReplyAttempts) * 100).toFixed(2) : 0}%`);
    reportLines.push(`- **CONSENT_WALL:** ${totalConsentWall}`);
    reportLines.push(`- **CHALLENGE:** ${totalChallenge}`);
    reportLines.push(`- **POST_FAILED:** ${totalPostFailed}`);
    reportLines.push(`- **Overruns:** ${overruns.length} (must be 0)`);
    reportLines.push(`- **POST_SUCCESS_TEST:** ${postSuccessTest} (must be 0)`);
    reportLines.push('');

    // Write report
    const reportPath = join(process.cwd(), 'docs', 'BAKE_24H_FINAL_REPORT.md');
    writeFileSync(reportPath, reportLines.join('\n'));
    
    console.log(`✅ Report generated: ${reportPath}`);
    console.log(`   Total POST_SUCCESS: ${totalPostSuccess}`);
    console.log(`   Valid tweet IDs: ${validCount}/${allPostSuccess.length}`);
    console.log(`   URLs verified: ${urlLoadCount}/${allPostSuccess.length}`);
    console.log(`   Overruns: ${overruns.length}`);
    console.log(`   POST_SUCCESS_TEST: ${postSuccessTest}\n`);

  } catch (error: any) {
    console.error('❌ Report generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
