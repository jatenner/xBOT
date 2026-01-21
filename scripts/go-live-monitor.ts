#!/usr/bin/env tsx
/**
 * 🚀 GO-LIVE MONITOR
 * 
 * Monitors the go-live process:
 * - Shadow mode (24h)
 * - Enforce mode (48h)
 * - Generates status reports
 */

import 'dotenv/config';
import { Client } from 'pg';

interface GoLiveStatus {
  phase: 'shadow' | 'enforce';
  startTime: string;
  elapsedHours: number;
  plansGenerated: number;
  planReasons: number;
  postsExecuted: number;
  repliesExecuted: number;
  overruns: number;
  alerts: number;
  resistanceEvents: number;
  backoffsApplied: number;
}

async function getStatus(): Promise<GoLiveStatus> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Determine phase
    const controllerEnabled = process.env.GROWTH_CONTROLLER_ENABLED === 'true';
    const phase: 'shadow' | 'enforce' = controllerEnabled ? 'enforce' : 'shadow';

    // Get start time (assume go-live started when first plan was created, or 24h ago for shadow)
    const { rows: firstPlan } = await client.query(`
      SELECT MIN(window_start) as start_time
      FROM growth_plans
      WHERE window_start >= NOW() - INTERVAL '72 hours';
    `);

    const startTime = firstPlan[0]?.start_time || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const elapsedHours = (Date.now() - new Date(startTime).getTime()) / (1000 * 60 * 60);

    // Plans
    const { rows: plans } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans
      WHERE window_start >= $1;
    `, [startTime]);

    const { rows: reasons } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'GROWTH_PLAN_REASON'
        AND created_at >= $1;
    `, [startTime]);

    // Execution
    const { rows: execution } = await client.query(`
      SELECT 
        SUM(ge.posts_done) as posts,
        SUM(ge.replies_done) as replies,
        COUNT(*) FILTER (
          WHERE ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies
        ) as overruns
      FROM growth_execution ge
      JOIN growth_plans gp ON ge.plan_id = gp.plan_id
      WHERE gp.window_start >= $1;
    `, [startTime]);

    // Alerts
    const { rows: alerts } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'ALERT_NO_ACTIVITY'
        AND created_at >= $1;
    `, [startTime]);

    // Resistance
    const { rows: resistance } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'POST_FAILED', 'CHALLENGE')
        AND created_at >= $1;
    `, [startTime]);

    const { rows: backoffs } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans
      WHERE resistance_backoff_applied = true
        AND window_start >= $1;
    `, [startTime]);

    await client.end();

    return {
      phase,
      startTime,
      elapsedHours: Math.floor(elapsedHours),
      plansGenerated: parseInt(plans[0]?.count || '0', 10),
      planReasons: parseInt(reasons[0]?.count || '0', 10),
      postsExecuted: parseInt(execution[0]?.posts || '0', 10),
      repliesExecuted: parseInt(execution[0]?.replies || '0', 10),
      overruns: parseInt(execution[0]?.overruns || '0', 10),
      alerts: parseInt(alerts[0]?.count || '0', 10),
      resistanceEvents: parseInt(resistance[0]?.count || '0', 10),
      backoffsApplied: parseInt(backoffs[0]?.count || '0', 10),
    };
  } catch (err: any) {
    console.error('Error:', err.message);
    await client.end().catch(() => {});
    throw err;
  }
}

async function main() {
  const status = await getStatus();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 GO-LIVE STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Phase: ${status.phase.toUpperCase()}`);
  console.log(`Elapsed: ${status.elapsedHours} hours`);
  console.log(`Start Time: ${status.startTime}`);
  console.log('');
  console.log('📊 Metrics:');
  console.log(`   Plans Generated: ${status.plansGenerated}`);
  console.log(`   Plan Reasons: ${status.planReasons}`);
  console.log(`   Posts Executed: ${status.postsExecuted}`);
  console.log(`   Replies Executed: ${status.repliesExecuted}`);
  console.log(`   Target Overruns: ${status.overruns} ${status.overruns === 0 ? '✅' : '❌'}`);
  console.log(`   Inactivity Alerts: ${status.alerts} ${status.alerts === 0 ? '✅' : '⚠️'}`);
  console.log(`   Resistance Events: ${status.resistanceEvents}`);
  console.log(`   Backoffs Applied: ${status.backoffsApplied}`);
  console.log('');

  // Recommendations
  if (status.phase === 'shadow' && status.elapsedHours >= 24) {
    console.log('✅ Shadow phase complete (24h). Ready to enable enforcement.');
    console.log('   Next: Set GROWTH_CONTROLLER_ENABLED=true in Railway');
  } else if (status.phase === 'shadow') {
    console.log(`⏳ Shadow phase: ${status.elapsedHours}/24 hours complete`);
  } else if (status.phase === 'enforce' && status.elapsedHours >= 72) {
    console.log('✅ Go-live complete (72h total). Generate final report:');
    console.log('   pnpm run bake:report');
  } else if (status.phase === 'enforce') {
    console.log(`⏳ Enforce phase: ${status.elapsedHours - 24}/48 hours complete`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
