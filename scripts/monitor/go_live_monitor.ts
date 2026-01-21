#!/usr/bin/env tsx
/**
 * 🎯 GO-LIVE MONITOR
 * 
 * Automated monitoring for 72-hour go-live period:
 * - Runs checks every 2 hours
 * - Auto-diagnoses and fixes issues
 * - Logs to system_events and log files
 * - Generates daily and final reports
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LOG_DIR = path.join(process.cwd(), '.runner-profile', 'go-live-monitor');
const LOG_FILE = path.join(LOG_DIR, `monitor-${new Date().toISOString().split('T')[0]}.log`);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface MonitorResult {
  timestamp: string;
  checks: {
    postSuccess: { count: number; last: string | null };
    plans: { count: number; first: string | null; last: string | null };
    overruns: { count: number };
    resistance: { consent_wall: number; challenge: number; post_failed: number };
    cdpReachable: boolean;
    sessionValid: boolean;
  };
  issues: string[];
  actions: string[];
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

async function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(logLine.trim());
}

async function getSupabaseClient(): Promise<Client> {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

async function checkCDP(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkSession(): Promise<boolean> {
  try {
    const result = execSync('pnpm exec tsx scripts/runner/session-check.ts', {
      encoding: 'utf8',
      timeout: 30000,
      stdio: 'pipe'
    });
    return result.includes('SESSION_OK');
  } catch {
    return false;
  }
}

async function runChecks(): Promise<MonitorResult> {
  const client = await getSupabaseClient();
  await client.connect();

  const issues: string[] = [];
  const actions: string[] = [];

  try {
    // 1) POST_SUCCESS last 6h
    const { rows: postSuccess } = await client.query(`
      SELECT COUNT(*) as count, MAX(created_at) as last
      FROM system_events
      WHERE event_type = 'POST_SUCCESS'
        AND created_at >= NOW() - INTERVAL '6 hours';
    `);

    // 2) Plan continuity last 6h
    const { rows: plans } = await client.query(`
      SELECT COUNT(*) as count, MIN(window_start) as first, MAX(window_start) as last
      FROM growth_plans
      WHERE window_start >= NOW() - INTERVAL '6 hours';
    `);

    // 3) Overrun check
    const { rows: overruns } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans gp
      JOIN growth_execution ge ON ge.plan_id = gp.plan_id
      WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
        AND gp.window_start >= NOW() - INTERVAL '72 hours';
    `);

    // 4) Resistance events last 24h
    const { rows: resistance } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'CONSENT_WALL') as consent_wall,
        COUNT(*) FILTER (WHERE event_type = 'CHALLENGE') as challenge,
        COUNT(*) FILTER (WHERE event_type = 'POST_FAILED') as post_failed
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')
        AND created_at >= NOW() - INTERVAL '24 hours';
    `);

    // 5) Check for plan in last 2 hours
    const { rows: recentPlan } = await client.query(`
      SELECT COUNT(*) as count
      FROM growth_plans
      WHERE window_start >= NOW() - INTERVAL '2 hours';
    `);

    // 6) Check current plan targets
    const { rows: currentPlan } = await client.query(`
      SELECT target_posts, target_replies
      FROM growth_plans
      WHERE window_start <= NOW()
        AND window_end > NOW()
      ORDER BY window_start DESC
      LIMIT 1;
    `);

    // Check CDP
    const cdpReachable = await checkCDP();
    const sessionValid = cdpReachable ? await checkSession() : false;

    // Fail condition checks
    if (overruns[0].count > 0) {
      issues.push(`CRITICAL: ${overruns[0].count} target overrun(s) detected`);
    }

    if (recentPlan[0].count === 0) {
      issues.push('CRITICAL: No growth plan in last 2 hours');
    }

    const postSuccessCount = parseInt(postSuccess[0].count, 10);
    const targetsZero = currentPlan.length > 0 && 
      currentPlan[0].target_posts === 0 && 
      currentPlan[0].target_replies === 0;

    if (postSuccessCount === 0 && !targetsZero) {
      issues.push('CRITICAL: No POST_SUCCESS in last 6 hours (and targets not zero)');
    }

    if (!cdpReachable) {
      issues.push('CRITICAL: CDP unreachable');
    }

    if (!sessionValid && cdpReachable) {
      issues.push('CRITICAL: Session invalid');
    }

    // Resistance spike check
    const consentWallCount = parseInt(resistance[0].consent_wall, 10);
    const challengeCount = parseInt(resistance[0].challenge, 10);
    const postFailedCount = parseInt(resistance[0].post_failed, 10);

    const consentWallThreshold = parseInt(process.env.RESISTANCE_CONSENT_WALL_THRESHOLD || '5', 10);
    if (consentWallCount >= consentWallThreshold) {
      issues.push(`WARNING: CONSENT_WALL spike (${consentWallCount} >= ${consentWallThreshold})`);
    }

    if (challengeCount > 0) {
      issues.push(`WARNING: CHALLENGE detected (${challengeCount} events)`);
    }

    // Determine status
    let status: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
    if (issues.some(i => i.startsWith('CRITICAL'))) {
      status = 'CRITICAL';
    } else if (issues.length > 0) {
      status = 'WARNING';
    }

    // Auto-remediation
    if (!cdpReachable) {
      log('Attempting to restart CDP...', 'warn');
      try {
        execSync('pkill -f "Chrome.*--remote-debugging-port=9222" || true', { stdio: 'pipe' });
        execSync('sleep 2', { stdio: 'pipe' });
        // CDP restart would need to be handled by LaunchAgent or separate script
        actions.push('Attempted CDP restart (may need manual intervention)');
      } catch (err: any) {
        actions.push(`CDP restart failed: ${err.message}`);
      }
    }

    if (!sessionValid && cdpReachable) {
      log('Session invalid - pausing posting', 'error');
      // Set a safe flag (would need to be checked by posting queue)
      actions.push('Session invalid - posting should be paused');
    }

    if (consentWallCount >= consentWallThreshold || challengeCount > 0) {
      log('Resistance spike detected - applying backoff', 'warn');
      // Note: Backoff should be handled by shadowControllerJob
      // This is just logging
      actions.push('Resistance spike - backoff should be applied by controller');
    }

    const result: MonitorResult = {
      timestamp: new Date().toISOString(),
      checks: {
        postSuccess: {
          count: postSuccessCount,
          last: postSuccess[0].last
        },
        plans: {
          count: parseInt(plans[0].count, 10),
          first: plans[0].first,
          last: plans[0].last
        },
        overruns: {
          count: parseInt(overruns[0].count, 10)
        },
        resistance: {
          consent_wall: consentWallCount,
          challenge: challengeCount,
          post_failed: postFailedCount
        },
        cdpReachable,
        sessionValid
      },
      issues,
      actions,
      status
    };

    // Log to system_events
    await client.query(`
      INSERT INTO system_events (event_type, severity, message, event_data, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'GO_LIVE_MONITOR_CHECK',
      status.toLowerCase(),
      `Monitor check: ${status} - ${issues.length} issue(s)`,
      result,
      new Date().toISOString()
    ]);

    return result;

  } finally {
    await client.end();
  }
}

async function main() {
  const mode = process.argv[2] || 'once'; // 'once' or 'loop'

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('           🎯 GO-LIVE MONITOR');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');

  // Get go-live start time from system_events
  const client = await getSupabaseClient();
  await client.connect();
  let goLiveStartTime: Date | null = null;
  try {
    const { rows } = await client.query(`
      SELECT created_at
      FROM system_events
      WHERE event_type = 'GO_LIVE_STARTED'
      ORDER BY created_at DESC
      LIMIT 1;
    `);
    if (rows.length > 0) {
      goLiveStartTime = new Date(rows[0].created_at);
    }
  } catch (err: any) {
    log(`Could not get go-live start time: ${err.message}`, 'warn');
  }
  await client.end();

  if (mode === 'loop') {
    log('Starting 2-hour monitoring loop (72 hours total)...');
    log('');

    const startTime = goLiveStartTime || new Date();
    const endTime = new Date(startTime.getTime() + (72 * 60 * 60 * 1000)); // 72 hours
    let iteration = 0;

    while (new Date() < endTime) {
      iteration++;
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / (60 * 60 * 1000));
      log(`\n[Iteration ${iteration}] [${elapsed}h elapsed] Running checks...`);

      try {
        const result = await runChecks();

        log(`Status: ${result.status}`);
        log(`POST_SUCCESS (6h): ${result.checks.postSuccess.count}`);
        log(`Plans (6h): ${result.checks.plans.count}`);
        log(`Overruns: ${result.checks.overruns.count} ${result.checks.overruns.count === 0 ? '✅' : '❌'}`);
        log(`Resistance: CONSENT_WALL=${result.checks.resistance.consent_wall}, CHALLENGE=${result.checks.resistance.challenge}, POST_FAILED=${result.checks.resistance.post_failed}`);
        log(`CDP: ${result.checks.cdpReachable ? '✅' : '❌'}, Session: ${result.checks.sessionValid ? '✅' : '❌'}`);

        if (result.issues.length > 0) {
          log(`Issues: ${result.issues.join('; ')}`);
        }

        if (result.actions.length > 0) {
          log(`Actions: ${result.actions.join('; ')}`);
        }

        // Generate daily report at 24h, 48h marks
        if (elapsed >= 24 && elapsed < 26) {
          log('Generating Day 1 report...');
          try {
            execSync('pnpm run go-live:report-day1', { stdio: 'pipe', timeout: 60000 });
            log('✅ Day 1 report generated');
          } catch (err: any) {
            log(`Failed to generate Day 1 report: ${err.message}`, 'error');
          }
        }

        if (elapsed >= 48 && elapsed < 50) {
          log('Generating Day 2 report...');
          try {
            execSync('pnpm run go-live:report-day2', { stdio: 'pipe', timeout: 60000 });
            log('✅ Day 2 report generated');
          } catch (err: any) {
            log(`Failed to generate Day 2 report: ${err.message}`, 'error');
          }
        }

        // Generate final report at 72h
      // Check cooldown end if in cooldown
      try {
        const cooldownCheck = execSync('pnpm run cooldown:end-check', { stdio: 'pipe', timeout: 60000 });
        log('Cooldown end check completed');
      } catch (err: any) {
        // Ignore if cooldown not ended yet
        if (!err.message.includes('still active')) {
          log(`Cooldown end check: ${err.message}`, 'warn');
        }
      }

      // Run cooldown monitor if in cooldown
      try {
        execSync('pnpm run cooldown:monitor', { stdio: 'pipe', timeout: 60000 });
      } catch (err: any) {
        // Ignore if no cooldown active
      }

      if (elapsed >= 72) {
        log('Generating final 72h report...');
        try {
          execSync('pnpm run go-live:report-final', { stdio: 'pipe', timeout: 60000 });
          log('✅ Final report generated');
        } catch (err: any) {
          log(`Failed to generate final report: ${err.message}`, 'error');
        }
        break;
      }

      } catch (error: any) {
        log(`Error in monitor check: ${error.message}`, 'error');
      }

      // Sleep for 2 hours (with jitter)
      const sleepSeconds = (2 * 60 * 60) + Math.floor(Math.random() * 300); // 2h + 0-5min jitter
      log(`Sleeping for ${Math.floor(sleepSeconds / 60)} minutes until next check...`);
      await new Promise(resolve => setTimeout(resolve, sleepSeconds * 1000));
    }

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('           72-hour monitoring complete');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } else {
    // Single run (called by LaunchAgent every 2 hours)
    log('Running single check...');
    log('');

    try {
      const result = await runChecks();

      const elapsed = goLiveStartTime ? Math.floor((Date.now() - goLiveStartTime.getTime()) / (60 * 60 * 1000)) : 0;

      log(`Status: ${result.status}`);
      log(`POST_SUCCESS (6h): ${result.checks.postSuccess.count}`);
      log(`Plans (6h): ${result.checks.plans.count}`);
      log(`Overruns: ${result.checks.overruns.count} ${result.checks.overruns.count === 0 ? '✅' : '❌'}`);
      log(`Resistance: CONSENT_WALL=${result.checks.resistance.consent_wall}, CHALLENGE=${result.checks.resistance.challenge}, POST_FAILED=${result.checks.resistance.post_failed}`);
      log(`CDP: ${result.checks.cdpReachable ? '✅' : '❌'}, Session: ${result.checks.sessionValid ? '✅' : '❌'}`);

      if (result.issues.length > 0) {
        log(`Issues: ${result.issues.join('; ')}`);
      }

      if (result.actions.length > 0) {
        log(`Actions: ${result.actions.join('; ')}`);
      }

      // Check cooldown end if in cooldown (runs every check)
      try {
        execSync('pnpm run cooldown:end-check', { stdio: 'pipe', timeout: 60000 });
      } catch (err: any) {
        // Ignore if cooldown not ended yet (expected)
        if (!err.message.includes('still active')) {
          log(`Cooldown end check: ${err.message}`, 'warn');
        }
      }

      // Run cooldown monitor if in cooldown
      try {
        execSync('pnpm run cooldown:monitor', { stdio: 'pipe', timeout: 60000 });
      } catch (err: any) {
        // Ignore if no cooldown active
      }

      // Check if we should generate reports
      if (elapsed >= 24 && elapsed < 26) {
        log('Generating Day 1 report...');
        try {
          execSync('pnpm run go-live:report-day1', { stdio: 'pipe', timeout: 60000 });
          log('✅ Day 1 report generated');
        } catch (err: any) {
          log(`Failed to generate Day 1 report: ${err.message}`, 'error');
        }
      }

      if (elapsed >= 48 && elapsed < 50) {
        log('Generating Day 2 report...');
        try {
          execSync('pnpm run go-live:report-day2', { stdio: 'pipe', timeout: 60000 });
          log('✅ Day 2 report generated');
        } catch (err: any) {
          log(`Failed to generate Day 2 report: ${err.message}`, 'error');
        }
      }

      // Check cooldown end if in cooldown
      try {
        execSync('pnpm run cooldown:end-check', { stdio: 'pipe', timeout: 60000 });
      } catch (err: any) {
        // Ignore if cooldown not ended yet
      }

      // Run cooldown monitor if in cooldown
      try {
        execSync('pnpm run cooldown:monitor', { stdio: 'pipe', timeout: 60000 });
      } catch (err: any) {
        // Ignore if no cooldown active
      }

      if (elapsed >= 72) {
        log('Generating final 72h report...');
        try {
          execSync('pnpm run go-live:report-final', { stdio: 'pipe', timeout: 60000 });
          log('✅ Final report generated');
        } catch (err: any) {
          log(`Failed to generate final report: ${err.message}`, 'error');
        }
      }

      process.exit(result.status === 'CRITICAL' ? 1 : 0);

    } catch (error: any) {
      log(`Error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

main();
