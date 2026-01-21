#!/usr/bin/env tsx
/**
 * 📊 72H BAKE REPORT GENERATOR
 * 
 * Generates a comprehensive report after 72h of operation (24h shadow + 48h enforce)
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface BakeReport {
  startTime: string;
  endTime: string;
  durationHours: number;
  uptime: {
    daemonHeartbeats: number;
    lastHeartbeat: string | null;
    cdpChecks: number;
    sessionChecks: number;
  };
  plans: {
    total: number;
    withBackoff: number;
    avgTargetPosts: number;
    avgTargetReplies: number;
  };
  execution: {
    totalPosts: number;
    totalReplies: number;
    overruns: number;
  };
  rewards: {
    avgReward24h: number;
    avgReward72h: number;
    trend: string;
    followerDelta: number;
  };
  resistance: {
    consentWalls: number;
    postFails: number;
    challenges: number;
    backoffsApplied: number;
  };
  incidents: Array<{
    type: string;
    timestamp: string;
    description: string;
    resolved: boolean;
  }>;
}

async function generateReport(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('📊 Generating 72h Bake Report...\n');

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 72 * 60 * 60 * 1000);
    const durationHours = 72;

    // Uptime
    const { rows: heartbeats } = await client.query(`
      SELECT COUNT(*) as count, MAX(created_at) as last
      FROM system_events
      WHERE event_type = 'RUNNER_DAEMON_HEARTBEAT'
        AND created_at >= $1;
    `, [startTime.toISOString()]);

    // Plans
    const { rows: plansStats } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE resistance_backoff_applied = true) as with_backoff,
        AVG(target_posts) as avg_posts,
        AVG(target_replies) as avg_replies
      FROM growth_plans
      WHERE window_start >= $1;
    `, [startTime.toISOString()]);

    // Execution
    const { rows: executionStats } = await client.query(`
      SELECT 
        SUM(ge.posts_done) as total_posts,
        SUM(ge.replies_done) as total_replies,
        COUNT(*) FILTER (
          WHERE ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies
        ) as overruns
      FROM growth_execution ge
      JOIN growth_plans gp ON ge.plan_id = gp.plan_id
      WHERE gp.window_start >= $1;
    `, [startTime.toISOString()]);

    // Explicit overrun query (Step E verification)
    const { rows: overrunDetails } = await client.query(`
      SELECT 
        gp.window_start,
        gp.target_posts,
        gp.target_replies,
        ge.posts_done,
        ge.replies_done
      FROM growth_plans gp
      JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
        AND gp.window_start >= $1
      ORDER BY gp.window_start DESC;
    `, [startTime.toISOString()]);

    // Rewards (try reward_features, fallback to performance_snapshots)
    let avgReward24h = 0;
    let avgReward72h = 0;
    let trend = 'unknown';
    let followerDelta = 0;

    try {
      const { rows: rewards24h } = await client.query(`
        SELECT AVG(reward_score) as avg
        FROM reward_features
        WHERE posted_at >= NOW() - INTERVAL '24 hours';
      `);
      avgReward24h = parseFloat(rewards24h[0]?.avg || '0');

      const { rows: rewards72h } = await client.query(`
        SELECT AVG(reward_score) as avg
        FROM reward_features
        WHERE posted_at >= $1;
      `, [startTime.toISOString()]);
      avgReward72h = parseFloat(rewards72h[0]?.avg || '0');

      if (avgReward24h > avgReward72h * 1.05) {
        trend = 'increasing';
      } else if (avgReward24h < avgReward72h * 0.95) {
        trend = 'decreasing';
      } else {
        trend = 'flat';
      }
    } catch (err: any) {
      console.warn('⚠️  Could not compute rewards from reward_features:', err.message);
    }

    // Follower delta
    try {
      const { rows: snapshots } = await client.query(`
        SELECT 
          (SELECT followers_count FROM account_snapshots 
           WHERE timestamp >= NOW() - INTERVAL '24 hours' 
           ORDER BY timestamp DESC LIMIT 1) as current,
          (SELECT followers_count FROM account_snapshots 
           WHERE timestamp >= $1 
           ORDER BY timestamp ASC LIMIT 1) as start;
      `, [startTime.toISOString()]);
      
      if (snapshots[0]?.current && snapshots[0]?.start) {
        followerDelta = parseInt(snapshots[0].current, 10) - parseInt(snapshots[0].start, 10);
      }
    } catch (err: any) {
      console.warn('⚠️  Could not compute follower delta:', err.message);
    }

    // Resistance
    const { rows: resistance } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'CONSENT_WALL') as consent_walls,
        COUNT(*) FILTER (WHERE event_type = 'POST_FAILED') as post_fails,
        COUNT(*) FILTER (WHERE event_type = 'CHALLENGE') as challenges
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'POST_FAILED', 'CHALLENGE')
        AND created_at >= $1;
    `, [startTime.toISOString()]);

    const { rows: backoffs } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans
      WHERE resistance_backoff_applied = true
        AND window_start >= $1;
    `, [startTime.toISOString()]);

    // Incidents (inactivity alerts, errors, etc.)
    const { rows: incidents } = await client.query(`
      SELECT 
        event_type,
        created_at,
        message,
        event_data
      FROM system_events
      WHERE event_type IN ('ALERT_NO_ACTIVITY', 'RUNNER_DAEMON_HEARTBEAT')
        AND (
          event_data->>'status' IN ('ERROR', 'CDP_DOWN', 'SESSION_INVALID')
          OR event_type = 'ALERT_NO_ACTIVITY'
        )
        AND created_at >= $1
      ORDER BY created_at DESC;
    `, [startTime.toISOString()]);

    const report: BakeReport = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationHours,
      uptime: {
        daemonHeartbeats: parseInt(heartbeats[0]?.count || '0', 10),
        lastHeartbeat: heartbeats[0]?.last || null,
        cdpChecks: 0, // Would need separate tracking
        sessionChecks: 0, // Would need separate tracking
      },
      plans: {
        total: parseInt(plansStats[0]?.total || '0', 10),
        withBackoff: parseInt(plansStats[0]?.with_backoff || '0', 10),
        avgTargetPosts: parseFloat(plansStats[0]?.avg_posts || '0'),
        avgTargetReplies: parseFloat(plansStats[0]?.avg_replies || '0'),
      },
      execution: {
        totalPosts: parseInt(executionStats[0]?.total_posts || '0', 10),
        totalReplies: parseInt(executionStats[0]?.total_replies || '0', 10),
        overruns: parseInt(executionStats[0]?.overruns || '0', 10),
      },
      rewards: {
        avgReward24h,
        avgReward72h,
        trend,
        followerDelta,
      },
      resistance: {
        consentWalls: parseInt(resistance[0]?.consent_walls || '0', 10),
        postFails: parseInt(resistance[0]?.post_fails || '0', 10),
        challenges: parseInt(resistance[0]?.challenges || '0', 10),
        backoffsApplied: parseInt(backoffs[0]?.count || '0', 10),
      },
      incidents: incidents.map(i => ({
        type: i.event_type,
        timestamp: i.created_at,
        description: i.message || JSON.stringify(i.event_data),
        resolved: i.event_type !== 'ALERT_NO_ACTIVITY', // Assume alerts are ongoing
      })),
    };

    // Generate markdown report
    const reportPath = path.join(process.cwd(), 'docs', 'GO_LIVE_72H_BAKE_REPORT.md');
    const reportContent = `# 🍞 72H Bake Report

**Period:** ${startTime.toISOString()} → ${endTime.toISOString()}  
**Duration:** ${durationHours} hours  
**Generated:** ${new Date().toISOString()}

---

## Executive Summary

**Status:** ${report.execution.overruns === 0 && report.incidents.filter(i => !i.resolved).length === 0 ? '✅ PASS' : '⚠️  ISSUES DETECTED'}

**Key Metrics:**
- Plans Generated: ${report.plans.total}
- Posts Executed: ${report.execution.totalPosts}
- Replies Executed: ${report.execution.totalReplies}
- Target Overruns: ${report.execution.overruns} ${report.execution.overruns === 0 ? '✅' : '❌'}
- Reward Trend: ${report.rewards.trend} (24h: ${report.rewards.avgReward24h.toFixed(2)}, 72h: ${report.rewards.avgReward72h.toFixed(2)})
- Follower Delta: ${report.rewards.followerDelta > 0 ? '+' : ''}${report.rewards.followerDelta}

---

## Uptime

**Daemon Heartbeats:** ${report.uptime.daemonHeartbeats}  
**Last Heartbeat:** ${report.uptime.lastHeartbeat || 'N/A'}

**Uptime Status:** ${report.uptime.daemonHeartbeats > 0 ? '✅ Operational' : '❌ No heartbeats detected'}

---

## Plans Generated

**Total Plans:** ${report.plans.total}  
**Plans with Backoff:** ${report.plans.withBackoff}  
**Average Target Posts:** ${report.plans.avgTargetPosts.toFixed(1)}/hour  
**Average Target Replies:** ${report.plans.avgTargetReplies.toFixed(1)}/hour

**Plan Generation Status:** ${report.plans.total >= 70 ? '✅ Healthy' : '⚠️  Missing plans'}

---

## Execution

**Total Posts:** ${report.execution.totalPosts}  
**Total Replies:** ${report.execution.totalReplies}  
**Target Overruns:** ${report.execution.overruns}

**Execution Status:** ${report.execution.overruns === 0 ? '✅ No overruns' : '❌ Overruns detected'}

**Overrun Details:**
${overrunDetails.length === 0 ? 'None ✅' : overrunDetails.map(o => `
- ${o.window_start}: Posts ${o.posts_done}/${o.target_posts}, Replies ${o.replies_done}/${o.target_replies}
`).join('')}

---

## Reward Trends

**24h Average Reward:** ${report.rewards.avgReward24h.toFixed(2)}  
**72h Average Reward:** ${report.rewards.avgReward72h.toFixed(2)}  
**Trend:** ${report.rewards.trend}  
**Follower Delta (72h):** ${report.rewards.followerDelta > 0 ? '+' : ''}${report.rewards.followerDelta}

**Reward Status:** ${report.rewards.trend === 'increasing' ? '✅ Improving' : report.rewards.trend === 'decreasing' ? '⚠️  Declining' : '➡️  Stable'}

---

## Platform Resistance

**Consent Walls:** ${report.resistance.consentWalls}  
**Post Failures:** ${report.resistance.postFails}  
**Challenges:** ${report.resistance.challenges}  
**Backoffs Applied:** ${report.resistance.backoffsApplied}

**Resistance Status:** ${report.resistance.backoffsApplied > 0 ? '⚠️  Backoff triggered' : '✅ No resistance'}

---

## Incidents

${report.incidents.length === 0 ? '**No incidents detected** ✅' : report.incidents.map(i => `
### ${i.type}

**Timestamp:** ${i.timestamp}  
**Description:** ${i.description}  
**Resolved:** ${i.resolved ? '✅' : '❌'}
`).join('\n')}

---

## Recommendations

${report.execution.overruns > 0 ? '- ⚠️  **CRITICAL:** Target overruns detected - review enforcement logic\n' : ''}${report.incidents.filter(i => !i.resolved).length > 0 ? '- ⚠️  **CRITICAL:** Unresolved incidents - investigate immediately\n' : ''}${report.plans.total < 70 ? '- ⚠️  Missing plans - verify JobManager is running shadow controller job\n' : ''}${report.rewards.trend === 'decreasing' ? '- 📉 Reward trend declining - consider adjusting strategy\n' : ''}${report.resistance.backoffsApplied > 0 ? '- ⚠️  Platform resistance detected - monitor closely\n' : ''}${report.execution.overruns === 0 && report.incidents.filter(i => !i.resolved).length === 0 ? '- ✅ **System operating normally** - ready for continued operation\n' : ''}

---

**Report Generated:** ${new Date().toISOString()}
`;

    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`✅ Report generated: ${reportPath}`);
    console.log('\n📊 Summary:');
    console.log(`   Plans: ${report.plans.total}`);
    console.log(`   Posts: ${report.execution.totalPosts}`);
    console.log(`   Replies: ${report.execution.totalReplies}`);
    console.log(`   Overruns: ${report.execution.overruns}`);
    console.log(`   Trend: ${report.rewards.trend}`);
    console.log(`   Status: ${report.execution.overruns === 0 ? '✅ PASS' : '❌ FAIL'}`);

    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error generating report:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    await client.end().catch(() => {});
    process.exit(1);
  }
}

generateReport();
