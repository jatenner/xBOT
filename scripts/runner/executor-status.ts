#!/usr/bin/env tsx
/**
 * 📊 EXECUTOR STATUS
 * 
 * Shows executor daemon status:
 * - CDP reachability
 * - Last 20 lines of executor.log
 * - Last 20 minutes system_events counts
 */

// Set SSL config before imports
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Load .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const LOG_FILE = path.join(RUNNER_PROFILE_DIR, 'executor.log');
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);

/**
 * Check CDP reachability
 */
async function checkCDP(): Promise<{ reachable: boolean; details: string }> {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      const data = await response.json();
      return { reachable: true, details: `CDP reachable - ${data.Browser || 'Chrome'}` };
    }
    return { reachable: false, details: 'CDP not responding' };
  } catch (err: any) {
    return { reachable: false, details: `CDP error: ${err.message.split('\n')[0]}` };
  }
}

/**
 * Get last N lines from log file
 */
function getLastLogLines(filePath: string, lines: number = 20): string[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [`Log file not found: ${filePath}`];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(l => l.trim());
    return allLines.slice(-lines);
  } catch (err: any) {
    return [`Error reading log: ${err.message}`];
  }
}

/**
 * Query system_events for last 20 minutes
 */
async function getSystemEventsCounts(): Promise<{
  posting_ticks: number;
  reply_ticks: number;
  post_success: number;
  post_failed: number;
  attempts_started_gt_zero: number;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return {
      posting_ticks: 0,
      reply_ticks: 0,
      post_success: 0,
      post_failed: 0,
      attempts_started_gt_zero: 0
    };
  }

  try {
    const { Pool } = await import('pg');
    // Use same SSL config as other scripts
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'POSTING_QUEUE_TICK') as posting_ticks,
        COUNT(*) FILTER (WHERE event_type = 'REPLY_QUEUE_TICK') as reply_ticks,
        COUNT(*) FILTER (WHERE event_type = 'POST_SUCCESS') as post_success,
        COUNT(*) FILTER (WHERE event_type = 'POST_FAILED') as post_failed,
        COUNT(*) FILTER (
          WHERE event_type = 'POSTING_QUEUE_TICK' 
          AND (event_data->>'attempts_started')::int > 0
        ) as attempts_started_gt_zero
      FROM system_events
      WHERE created_at >= NOW() - INTERVAL '20 minutes';
    `);

    await pool.end();

    return {
      posting_ticks: parseInt(result.rows[0].posting_ticks || '0'),
      reply_ticks: parseInt(result.rows[0].reply_ticks || '0'),
      post_success: parseInt(result.rows[0].post_success || '0'),
      post_failed: parseInt(result.rows[0].post_failed || '0'),
      attempts_started_gt_zero: parseInt(result.rows[0].attempts_started_gt_zero || '0')
    };
  } catch (err: any) {
    console.error(`❌ Database query failed: ${err.message}`);
    return {
      posting_ticks: 0,
      reply_ticks: 0,
      post_success: 0,
      post_failed: 0,
      attempts_started_gt_zero: 0
    };
  }
}

async function main(): Promise<void> {
  console.log('\n📊 EXECUTOR STATUS');
  console.log('='.repeat(60));
  
  // 1. CDP Status
  console.log('\n1️⃣  CDP Status');
  console.log('-'.repeat(60));
  const cdpStatus = await checkCDP();
  console.log(`   Reachable: ${cdpStatus.reachable ? '✅ YES' : '❌ NO'}`);
  console.log(`   Details: ${cdpStatus.details}`);
  
  // 2. Log File
  console.log('\n2️⃣  Executor Log (Last 20 lines)');
  console.log('-'.repeat(60));
  const logLines = getLastLogLines(LOG_FILE, 20);
  if (logLines.length === 0) {
    console.log('   (Log file is empty)');
  } else {
    logLines.forEach(line => {
      console.log(`   ${line}`);
    });
  }
  
  // 3. System Events (Last 20 minutes)
  console.log('\n3️⃣  System Events (Last 20 minutes)');
  console.log('-'.repeat(60));
  const events = await getSystemEventsCounts();
  console.log(`   POSTING_QUEUE_TICK: ${events.posting_ticks}`);
  console.log(`   REPLY_QUEUE_TICK: ${events.reply_ticks}`);
  console.log(`   POST_SUCCESS: ${events.post_success}`);
  console.log(`   POST_FAILED: ${events.post_failed}`);
  console.log(`   POSTING_QUEUE_TICK with attempts_started > 0: ${events.attempts_started_gt_zero}`);
  
  // 4. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   CDP: ${cdpStatus.reachable ? '✅' : '❌'}`);
  console.log(`   Executor running: ${events.posting_ticks > 0 || events.reply_ticks > 0 ? '✅' : '⚠️  (no ticks in last 20 min)'}`);
  console.log(`   Attempts started: ${events.attempts_started_gt_zero > 0 ? '✅ YES' : '⚠️  NO (may be normal if queue empty)'}`);
  console.log(`   Posts successful: ${events.post_success > 0 ? '✅ YES' : '⚠️  NO'}`);
  console.log('');
}

main().catch((err) => {
  console.error(`❌ Status check failed: ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
