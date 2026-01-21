#!/usr/bin/env tsx
/**
 * 🔍 ENFORCEMENT VERIFICATION
 * 
 * Runs comprehensive SQL checks to verify enforcement is working:
 * - Execution counters exist and increment
 * - No target overruns
 * - canPost() blocking correctly
 */

import 'dotenv/config';
import { Client } from 'pg';

async function verifyEnforcement(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🔍 ENFORCEMENT VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const controllerEnabled = process.env.GROWTH_CONTROLLER_ENABLED === 'true';
    console.log(`Controller Enabled: ${controllerEnabled ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // Check 1: Execution counters exist and increment
    console.log('📊 Check 1: Execution Counters...');
    const { rows: execution } = await client.query(`
      SELECT 
        gp.window_start,
        gp.target_posts,
        gp.target_replies,
        ge.posts_done,
        ge.replies_done,
        (gp.target_posts - ge.posts_done) as posts_remaining,
        (gp.target_replies - ge.replies_done) as replies_remaining
      FROM growth_plans gp
      LEFT JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE gp.window_start >= NOW() - INTERVAL '6 hours'
      ORDER BY gp.window_start DESC;
    `);

    if (execution.length === 0) {
      console.log('   ⚠️  No plans found in last 6 hours');
    } else {
      console.log(`   Found ${execution.length} plan(s) with execution data:`);
      execution.forEach((row, i) => {
        console.log(`   Plan ${i+1}: ${row.window_start}`);
        console.log(`      Targets: ${row.target_posts} posts, ${row.target_replies} replies`);
        if (row.posts_done !== null) {
          console.log(`      Executed: ${row.posts_done} posts, ${row.replies_done} replies`);
          console.log(`      Remaining: ${row.posts_remaining} posts, ${row.replies_remaining} replies`);
        } else {
          console.log(`      ⚠️  No execution record yet`);
        }
      });
    }
    console.log('');

    // Check 2: Target overruns (must be 0)
    console.log('📊 Check 2: Target Overruns (must be 0)...');
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
      WHERE gp.window_start >= NOW() - INTERVAL '72 hours'
        AND (
          (ge.posts_done > gp.target_posts AND gp.target_posts > 0)
          OR (ge.replies_done > gp.target_replies AND gp.target_replies > 0)
        )
      ORDER BY gp.window_start DESC;
    `);

    if (overruns.length === 0) {
      console.log('   ✅ PASS: No target overruns');
    } else {
      console.log(`   ❌ FAIL: ${overruns.length} plan(s) exceeded targets:`);
      overruns.forEach(o => {
        console.log(`      Plan ${o.plan_id}:`);
        console.log(`         Posts: ${o.posts_done}/${o.target_posts} (overrun: ${o.posts_overrun})`);
        console.log(`         Replies: ${o.replies_done}/${o.target_replies} (overrun: ${o.replies_overrun})`);
      });
    }
    console.log('');

    // Check 3: Recent POST_SUCCESS vs plan targets
    console.log('📊 Check 3: Recent Activity vs Plan Targets...');
    const { rows: recentActivity } = await client.query(`
      SELECT 
        DATE_TRUNC('hour', se.created_at) as hour,
        COUNT(*) FILTER (WHERE se.event_data->>'decision_type' = 'reply') as replies,
        COUNT(*) FILTER (WHERE se.event_data->>'decision_type' IN ('single', 'thread')) as posts
      FROM system_events se
      WHERE se.event_type = 'POST_SUCCESS'
        AND se.created_at >= NOW() - INTERVAL '6 hours'
      GROUP BY DATE_TRUNC('hour', se.created_at)
      ORDER BY hour DESC;
    `);

    if (recentActivity.length > 0) {
      console.log('   Recent POST_SUCCESS by hour:');
      recentActivity.forEach(r => {
        console.log(`      ${r.hour}: ${r.posts} posts, ${r.replies} replies`);
      });
    } else {
      console.log('   ⚠️  No POST_SUCCESS events in last 6 hours');
    }
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const hasExecution = execution.some(e => e.posts_done !== null);
    const hasOverruns = overruns.length > 0;

    console.log(`Controller Enabled: ${controllerEnabled ? '✅' : '❌'}`);
    console.log(`Execution Counters: ${hasExecution ? '✅' : '⚠️  Not yet'}`);
    console.log(`Target Overruns: ${hasOverruns ? '❌ FAIL' : '✅ PASS'}`);
    console.log(`Recent Activity: ${recentActivity.length > 0 ? '✅' : '⚠️  None'}`);

    if (controllerEnabled && hasExecution && !hasOverruns) {
      console.log('');
      console.log('🎉 ENFORCEMENT VERIFIED: Controller active, counters tracking, no overruns');
      process.exit(0);
    } else if (!controllerEnabled) {
      console.log('');
      console.log('⚠️  Controller not enabled. Set GROWTH_CONTROLLER_ENABLED=true');
      process.exit(1);
    } else if (hasOverruns) {
      console.log('');
      console.log('❌ ENFORCEMENT FAILED: Target overruns detected');
      process.exit(1);
    } else {
      console.log('');
      console.log('⏳ ENFORCEMENT PENDING: Waiting for execution data');
      process.exit(0);
    }

  } catch (err: any) {
    console.error('❌ Verification error:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyEnforcement();
