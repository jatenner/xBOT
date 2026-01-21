#!/usr/bin/env tsx
/**
 * 🍞 DAILY BAKE CHECK
 * 
 * Runs SQL checks to verify system health:
 * - Plan target overruns (must be zero)
 * - Missing plans in last 6 hours (must be zero)
 * - Inactivity alerts (must be zero unless explained)
 * - Resistance signals count + whether backoff applied correctly
 */

import 'dotenv/config';
import { Client } from 'pg';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

async function runBakeCheck(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🍞 DAILY BAKE CHECK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const results: CheckResult[] = [];

    // CHECK 1: Plan target overruns (must be zero)
    console.log('📊 Check 1: Plan target overruns...');
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
      LEFT JOIN growth_execution ge ON gp.plan_id = ge.plan_id
      WHERE gp.window_start >= NOW() - INTERVAL '24 hours'
        AND (
          (ge.posts_done > gp.target_posts AND gp.target_posts > 0)
          OR (ge.replies_done > gp.target_replies AND gp.target_replies > 0)
        )
      ORDER BY gp.window_start DESC;
    `);

    if (overruns.length === 0) {
      results.push({
        name: 'Plan Target Overruns',
        passed: true,
        message: '✅ No target overruns in last 24h'
      });
      console.log('   ✅ PASS: No target overruns');
    } else {
      results.push({
        name: 'Plan Target Overruns',
        passed: false,
        message: `❌ FAIL: ${overruns.length} plan(s) exceeded targets`,
        details: overruns
      });
      console.log(`   ❌ FAIL: ${overruns.length} plan(s) exceeded targets`);
      overruns.forEach(o => {
        console.log(`      Plan ${o.plan_id}: posts ${o.posts_done}/${o.target_posts}, replies ${o.replies_done}/${o.target_replies}`);
      });
    }
    console.log('');

    // CHECK 2: Missing plans in last 6 hours (must be zero)
    console.log('📊 Check 2: Missing plans in last 6 hours...');
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const expectedHours = Math.floor((Date.now() - sixHoursAgo.getTime()) / (60 * 60 * 1000));
    
    const { rows: recentPlans } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans
      WHERE window_start >= $1
        AND window_start < NOW();
    `, [sixHoursAgo.toISOString()]);

    const planCount = parseInt(recentPlans[0].count, 10);
    const missingPlans = Math.max(0, expectedHours - planCount);

    if (missingPlans === 0) {
      results.push({
        name: 'Missing Plans (6h)',
        passed: true,
        message: `✅ All plans present: ${planCount}/${expectedHours} hours`
      });
      console.log(`   ✅ PASS: ${planCount}/${expectedHours} plans present`);
    } else {
      results.push({
        name: 'Missing Plans (6h)',
        passed: false,
        message: `❌ FAIL: Missing ${missingPlans} plan(s) in last 6 hours`,
        details: { expected: expectedHours, found: planCount, missing: missingPlans }
      });
      console.log(`   ❌ FAIL: Missing ${missingPlans} plan(s) (expected ${expectedHours}, found ${planCount})`);
    }
    console.log('');

  // CHECK 3: POST_SUCCESS activity (last 6 hours)
  console.log('📊 Check 3: POST_SUCCESS activity...');
  const { rows: postSuccess } = await client.query(`
    SELECT COUNT(*) as count
    FROM system_events
    WHERE event_type = 'POST_SUCCESS'
      AND created_at >= NOW() - INTERVAL '6 hours';
  `);
  
  const postSuccessCount = parseInt(postSuccess[0]?.count || '0', 10);
  if (postSuccessCount > 0) {
    results.push({
      name: 'POST_SUCCESS Activity',
      passed: true,
      message: `✅ ${postSuccessCount} POST_SUCCESS events in last 6h`
    });
    console.log(`   ✅ PASS: ${postSuccessCount} POST_SUCCESS events`);
  } else {
    results.push({
      name: 'POST_SUCCESS Activity',
      passed: false,
      message: `❌ FAIL: No POST_SUCCESS events in last 6h`
    });
    console.log(`   ❌ FAIL: No POST_SUCCESS events`);
  }
  console.log('');

  // CHECK 4: Inactivity alerts (must be zero unless explained)
  console.log('📊 Check 4: Inactivity alerts...');
  const { rows: alerts } = await client.query(`
    SELECT 
      event_data->>'hours_since_post' as hours_since_post,
      event_data->>'hours_since_plan' as hours_since_plan,
      event_data->>'threshold_hours' as threshold,
      created_at
    FROM system_events
    WHERE event_type = 'ALERT_NO_ACTIVITY'
      AND created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC;
  `);

    if (alerts.length === 0) {
      results.push({
        name: 'Inactivity Alerts',
        passed: true,
        message: '✅ No inactivity alerts in last 24h'
      });
      console.log('   ✅ PASS: No inactivity alerts');
    } else {
      results.push({
        name: 'Inactivity Alerts',
        passed: false,
        message: `⚠️  WARNING: ${alerts.length} inactivity alert(s) in last 24h`,
        details: alerts
      });
      console.log(`   ⚠️  WARNING: ${alerts.length} inactivity alert(s)`);
      alerts.forEach(a => {
        console.log(`      ${a.created_at}: ${a.hours_since_post || a.hours_since_plan}h since activity (threshold: ${a.threshold}h)`);
      });
    }
    console.log('');

  // CHECK 5: Resistance signals + backoff correctness
  console.log('📊 Check 5: Resistance signals and backoff...');
    const { rows: resistanceEvents } = await client.query(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'POST_FAILED', 'CHALLENGE')
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY event_type
      ORDER BY event_type;
    `);

    const { rows: backoffPlans } = await client.query(`
      SELECT 
        COUNT(*) as count,
        STRING_AGG(DISTINCT backoff_reason, '; ') as reasons
      FROM growth_plans
      WHERE resistance_backoff_applied = true
        AND window_start >= NOW() - INTERVAL '24 hours';
    `);

    const resistanceCount = resistanceEvents.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
    const backoffCount = parseInt(backoffPlans[0]?.count || '0', 10);

    // Check if backoff was applied when resistance signals present
    const consentWallCount = resistanceEvents.find(r => r.event_type === 'CONSENT_WALL')?.count || '0';
    const postFailCount = resistanceEvents.find(r => r.event_type === 'POST_FAILED')?.count || '0';
    const challengeCount = resistanceEvents.find(r => r.event_type === 'CHALLENGE')?.count || '0';

    const consentWallThreshold = parseInt(process.env.RESISTANCE_CONSENT_WALL_THRESHOLD || '5', 10);
    const postFailThreshold = parseInt(process.env.RESISTANCE_POST_FAIL_THRESHOLD || '10', 10);

    const shouldHaveBackoff = 
      parseInt(consentWallCount, 10) >= consentWallThreshold ||
      parseInt(postFailCount, 10) >= postFailThreshold ||
      parseInt(challengeCount, 10) > 0;

    let backoffCorrect = true;
    let backoffMessage = '';

    if (shouldHaveBackoff && backoffCount === 0) {
      backoffCorrect = false;
      backoffMessage = '❌ FAIL: Resistance signals present but no backoff applied';
    } else if (!shouldHaveBackoff && backoffCount > 0) {
      backoffMessage = '⚠️  WARNING: Backoff applied but no resistance signals (may be from earlier)';
    } else if (shouldHaveBackoff && backoffCount > 0) {
      backoffMessage = '✅ PASS: Backoff correctly applied for resistance signals';
    } else {
      backoffMessage = '✅ PASS: No resistance signals, no backoff needed';
    }

    results.push({
      name: 'Resistance Signals & Backoff',
      passed: backoffCorrect,
      message: backoffMessage,
      details: {
        resistance_events: {
          CONSENT_WALL: parseInt(consentWallCount, 10),
          POST_FAILED: parseInt(postFailCount, 10),
          CHALLENGE: parseInt(challengeCount, 10),
          total: resistanceCount
        },
        backoff_applied: backoffCount,
        should_have_backoff: shouldHaveBackoff,
        backoff_reasons: backoffPlans[0]?.reasons || null
      }
    });

    console.log(`   Resistance events: CONSENT_WALL=${consentWallCount}, POST_FAILED=${postFailCount}, CHALLENGE=${challengeCount}`);
    console.log(`   Backoff applied: ${backoffCount} plan(s)`);
    console.log(`   ${backoffMessage}`);
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(r => {
      const icon = r.passed ? '✅' : (r.name.includes('Activity') ? '⚠️' : '❌');
      console.log(`${icon} ${r.name}: ${r.message}`);
    });

    console.log('');
    console.log(`Total: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('');
      console.log('🎉 ALL CHECKS PASSED');
      process.exit(0);
    } else {
      console.log('');
      console.log('⚠️  SOME CHECKS FAILED - Review details above');
      process.exit(1);
    }

  } catch (err: any) {
    console.error('❌ Bake check error:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runBakeCheck();
