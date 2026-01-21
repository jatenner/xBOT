#!/usr/bin/env tsx
/**
 * 🧊 COOLDOWN MONITOR
 * 
 * Monitors resistance signals during cooldown period
 * Runs every 2 hours and records trends
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), '.runner-profile', 'cooldown-monitor');
const LOG_FILE = path.join(LOG_DIR, `cooldown-${new Date().toISOString().split('T')[0]}.log`);

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

async function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(logLine.trim());
}

async function monitorCooldown() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('           🧊 COOLDOWN MONITOR CHECK');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('');

    // Get cooldown status
    const { rows: cooldown } = await client.query(`
      SELECT event_data, created_at
      FROM system_events
      WHERE event_type = 'COOLDOWN_MODE_ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    if (cooldown.length === 0) {
      log('No active cooldown found', 'warn');
      await client.end();
      return;
    }

    const cooldownData = cooldown[0].event_data;
    const cooldownEnd = new Date(cooldownData.end_time);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - new Date(cooldownData.start_time).getTime()) / (60 * 60 * 1000));
    const remaining = Math.floor((cooldownEnd.getTime() - now.getTime()) / (60 * 60 * 1000));

    log(`Cooldown Status: ${remaining > 0 ? 'ACTIVE' : 'ENDED'}`);
    log(`   Elapsed: ${elapsed}h`);
    log(`   Remaining: ${remaining}h`);
    log('');

    // 1) CONSENT_WALL count last 2h and last 12h
    const { rows: consentWall } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '2 hours') as last_2h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '12 hours') as last_12h
      FROM system_events
      WHERE event_type = 'CONSENT_WALL'
        AND created_at >= NOW() - INTERVAL '12 hours';
    `);

    log(`CONSENT_WALL: ${consentWall[0].last_2h} (2h), ${consentWall[0].last_12h} (12h)`);

    // 2) POST_FAIL vs POST_FAILED breakdown
    const { rows: postFail } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'SAFETY_GATE%' OR event_data->>'pipeline_error_reason' LIKE '%ANCESTRY%' OR event_data->>'pipeline_error_reason' LIKE '%OFF_LIMITS%') as safety_gates,
        COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'POSTING_FAILED%' AND event_data->>'pipeline_error_reason' NOT LIKE '%SAFETY_GATE%') as platform_failures
      FROM system_events
      WHERE event_type = 'POST_FAILED'
        AND created_at >= NOW() - INTERVAL '12 hours';
    `);

    log(`POST_FAILED Breakdown (12h):`);
    log(`   Safety Gates: ${postFail[0].safety_gates} (expected)`);
    log(`   Platform Failures: ${postFail[0].platform_failures}`);

    // 3) POST_SUCCESS last 6h
    const { rows: postSuccess } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'POST_SUCCESS'
        AND created_at >= NOW() - INTERVAL '6 hours';
    `);

    log(`POST_SUCCESS (6h): ${postSuccess[0].count}`);

    // 4) Overruns check
    const { rows: overruns } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans gp
      JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
        AND gp.window_start >= NOW() - INTERVAL '24 hours';
    `);

    log(`Overruns: ${overruns[0].count} ${parseInt(overruns[0].count, 10) === 0 ? '✅' : '❌'}`);

    // Check if resistance is trending down
    const consentWall2h = parseInt(consentWall[0].last_2h, 10);
    const consentWall12h = parseInt(consentWall[0].last_12h, 10);
    const avgPer2h = consentWall12h / 6; // Average per 2h window
    const trendingDown = consentWall2h < avgPer2h * 1.2; // Within 20% of average or lower

    log('');
    log(`Resistance Trend: ${trendingDown ? '✅ DOWN' : '⚠️  STABLE/UP'} (2h: ${consentWall2h}, 12h avg: ${avgPer2h.toFixed(1)})`);

    // Log to system_events
    await client.query(`
      INSERT INTO system_events (event_type, severity, message, event_data, created_at)
      VALUES ('COOLDOWN_MONITOR_CHECK', 'info', 'Cooldown monitor check', $1, $2)
    `, [JSON.stringify({
      cooldown_elapsed_hours: elapsed,
      cooldown_remaining_hours: remaining,
      consent_wall_2h: consentWall2h,
      consent_wall_12h: consentWall12h,
      post_failed_safety_gates: parseInt(postFail[0].safety_gates, 10),
      post_failed_platform: parseInt(postFail[0].platform_failures, 10),
      post_success_6h: parseInt(postSuccess[0].count, 10),
      overruns: parseInt(overruns[0].count, 10),
      resistance_trending_down: trendingDown
    }), new Date().toISOString()]);

    log('');
    log('✅ Cooldown check complete and logged');

    await client.end();

  } catch (err: any) {
    log(`Error: ${err.message}`, 'error');
    await client.end().catch(() => {});
    process.exit(1);
  }
}

monitorCooldown();
