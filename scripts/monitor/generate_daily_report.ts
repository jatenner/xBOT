#!/usr/bin/env tsx
/**
 * Generate daily go-live report
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function generateDailyReport(day: 1 | 2) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const startTime = new Date();
    startTime.setHours(startTime.getHours() - (24 * day));
    const endTime = new Date();

    console.log(`Generating Day ${day} report (${startTime.toISOString()} to ${endTime.toISOString()})...`);

    // Total POST_SUCCESS
    const { rows: postSuccess } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'POST_SUCCESS'
        AND created_at >= $1 AND created_at < $2;
    `, [startTime.toISOString(), endTime.toISOString()]);

    // Plans generated
    const { rows: plans } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans
      WHERE window_start >= $1 AND window_start < $2;
    `, [startTime.toISOString(), endTime.toISOString()]);

    // Backoffs applied
    const { rows: backoffs } = await client.query(`
      SELECT COUNT(*) as count, 
             array_agg(DISTINCT reason_summary) FILTER (WHERE reason_summary IS NOT NULL) as reasons
      FROM growth_plans
      WHERE resistance_backoff_applied = true
        AND window_start >= $1 AND window_start < $2;
    `, [startTime.toISOString(), endTime.toISOString()]);

    // Resistance events
    const { rows: resistance } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'CONSENT_WALL') as consent_wall,
        COUNT(*) FILTER (WHERE event_type = 'CHALLENGE') as challenge,
        COUNT(*) FILTER (WHERE event_type = 'POST_FAILED') as post_failed
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')
        AND created_at >= $1 AND created_at < $2;
    `, [startTime.toISOString(), endTime.toISOString()]);

    // Overruns
    const { rows: overruns } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans gp
      JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
        AND gp.window_start >= $1 AND gp.window_start < $2;
    `, [startTime.toISOString(), endTime.toISOString()]);

    // Monitor check results
    const { rows: monitorChecks } = await client.query(`
      SELECT 
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'warning') as warnings
      FROM system_events
      WHERE event_type = 'GO_LIVE_MONITOR_CHECK'
        AND created_at >= $1 AND created_at < $2;
    `, [startTime.toISOString(), endTime.toISOString()]);

    // Reward trends (if telemetry available)
    const { rows: rewardTrend } = await client.query(`
      SELECT 
        AVG(composite_reward) as avg_reward,
        COUNT(*) as snapshots
      FROM reward_features
      WHERE created_at >= $1 AND created_at < $2;
    `, [startTime.toISOString(), endTime.toISOString()]).catch(() => ({ rows: [{ avg_reward: null, snapshots: 0 }] }));

    const report = `# 🎯 Go-Live Day ${day} Report

**Period:** ${startTime.toISOString()} to ${endTime.toISOString()}  
**Generated:** ${new Date().toISOString()}

---

## 📊 Summary

- **POST_SUCCESS:** ${postSuccess[0].count}
- **Plans Generated:** ${plans[0].count}
- **Backoffs Applied:** ${backoffs[0].count}
- **Overruns:** ${overruns[0].count} ${parseInt(overruns[0].count, 10) === 0 ? '✅' : '❌'}
- **Monitor Checks:** ${monitorChecks[0].total_checks} (${monitorChecks[0].critical} critical, ${monitorChecks[0].warnings} warnings)

---

## 🔄 Resistance Events

- **CONSENT_WALL:** ${resistance[0].consent_wall}
- **CHALLENGE:** ${resistance[0].challenge}
- **POST_FAILED:** ${resistance[0].post_failed}

---

## 📉 Backoffs Applied

**Count:** ${backoffs[0].count}

${backoffs[0].reasons && backoffs[0].reasons.length > 0 ? 
  `**Reasons:**\n${backoffs[0].reasons.map((r: string) => `- ${r}`).join('\n')}` : 
  'No backoff reasons recorded'}

---

## 📈 Reward Trends

${rewardTrend[0].snapshots > 0 ? 
  `- **Average Reward:** ${parseFloat(rewardTrend[0].avg_reward || '0').toFixed(2)}\n- **Snapshots:** ${rewardTrend[0].snapshots}` :
  'No reward telemetry available'}

---

## ✅ Status

${parseInt(overruns[0].count, 10) === 0 && parseInt(monitorChecks[0].critical, 10) === 0 ? 
  '✅ **ALL CHECKS PASSED**' : 
  '⚠️  **ISSUES DETECTED** - See details above'}

---

**Report Generated:** ${new Date().toISOString()}
`;

    const reportPath = path.join(process.cwd(), 'docs', `GO_LIVE_DAY${day}_REPORT.md`);
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`✅ Report generated: ${reportPath}`);

  } finally {
    await client.end();
  }
}

const day = parseInt(process.argv[2] || '1', 10) as 1 | 2;
generateDailyReport(day);
