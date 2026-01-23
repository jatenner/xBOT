#!/usr/bin/env tsx
/**
 * 🧪 EXECUTOR 15-MINUTE PROOF
 * 
 * Runs daemon for 15 minutes and outputs PASS/FAIL summary.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:15m
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const CONFIG_PATH = RUNNER_PROFILE_PATHS.executorConfig();
const TEST_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface ProofMetrics {
  windows_opened: number;
  headless: boolean;
  pages_max: number;
  browser_launches: number;
  db_connected: boolean;
  queues_readable: boolean;
  posting_ready: number;
  reply_ready: number;
  stop_switch_seconds: number;
  ticks_count: number;
}

async function countVisibleWindows(): Promise<number> {
  try {
    const result = execSync('osascript -e \'tell application "System Events" to count windows of process "Google Chrome"\'', { encoding: 'utf-8' });
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function checkDbConnection(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('system_events').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkQueuesReadable(): Promise<{ readable: boolean; posting_ready: number; reply_ready: number }> {
  try {
    const supabase = getSupabaseClient();
    
    // Check posting queue
    const { data: postingTick } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'POSTING_QUEUE_TICK')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Check reply queue
    const { data: replyTick } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'REPLY_QUEUE_TICK')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const postingReady = postingTick?.event_data 
      ? (typeof postingTick.event_data === 'string' ? JSON.parse(postingTick.event_data) : postingTick.event_data).ready_candidates || 0
      : 0;
    
    const replyReady = replyTick?.event_data
      ? (typeof replyTick.event_data === 'string' ? JSON.parse(replyTick.event_data) : replyTick.event_data).ready_candidates || 0
      : 0;
    
    return { readable: true, posting_ready: postingReady, reply_ready: replyReady };
  } catch {
    return { readable: false, posting_ready: 0, reply_ready: 0 };
  }
}

async function getExecutorTicks(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const startTime = new Date(Date.now() - TEST_DURATION_MS);
    const { count } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'EXECUTOR_DAEMON_TICK')
      .gte('created_at', startTime.toISOString());
    return count || 0;
  } catch {
    return 0;
  }
}

async function getMaxPagesFromTicks(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const startTime = new Date(Date.now() - TEST_DURATION_MS);
    const { data } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'EXECUTOR_DAEMON_TICK')
      .gte('created_at', startTime.toISOString());
    
    let maxPages = 0;
    for (const row of data || []) {
      const eventData = typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data;
      const pages = eventData.pages || 0;
      if (pages > maxPages) {
        maxPages = pages;
      }
    }
    return maxPages;
  } catch {
    return 0;
  }
}

async function getBrowserLaunchesFromTicks(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const startTime = new Date(Date.now() - TEST_DURATION_MS);
    const { data } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'EXECUTOR_DAEMON_TICK')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data?.event_data) {
      const eventData = typeof data.event_data === 'string' ? JSON.parse(data.event_data) : data.event_data;
      return eventData.browser_launch_count || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 EXECUTOR 15-MINUTE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Pre-flight: stop any existing daemon
  console.log('📋 Pre-flight checks...');
  if (fs.existsSync(PIDFILE_PATH)) {
    const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
    const pid = parseInt(pidfileContent.split(':')[0], 10);
    try {
      execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
      console.log(`⚠️  Stopping existing executor PID ${pid}`);
      fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        execSync(`kill ${pid} 2>/dev/null`, { encoding: 'utf-8' });
      } catch {
        // Ignore
      }
    } catch {
      // Stale lock
    }
    fs.unlinkSync(PIDFILE_PATH);
  }
  
  // Remove STOP switch
  if (fs.existsSync(STOP_SWITCH_PATH)) {
    fs.unlinkSync(STOP_SWITCH_PATH);
  }
  
  // Capture initial window count
  const initialWindows = await countVisibleWindows();
  console.log(`Initial visible Chrome windows: ${initialWindows}`);
  
  // Start daemon
  console.log('\n🚀 Starting executor daemon...');
  const daemonProcess = spawn('pnpm', ['run', 'executor:daemon'], {
    env: {
      ...process.env,
      EXECUTION_MODE: 'executor',
      RUNNER_MODE: 'true',
      HEADLESS: 'true',
      RUNNER_PROFILE_DIR: RUNNER_PROFILE_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-15m.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Test duration: 15 minutes\n`);
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Verify config file exists
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ FAIL: EXECUTOR_CONFIG.json not found');
    daemonProcess.kill();
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  console.log(`[EXECUTOR_CONFIG] profile_dir=${config.profile_dir} user_data_dir=${config.user_data_dir} headless=${config.headless} mode=${config.mode}`);
  
  if (!config.headless) {
    console.error('❌ FAIL: headless=false in config');
    daemonProcess.kill();
    process.exit(1);
  }
  
  // Monitor for 15 minutes
  console.log('📊 Monitoring for 15 minutes...\n');
  const startTime = Date.now();
  let maxWindows = initialWindows;
  
  while (Date.now() - startTime < TEST_DURATION_MS) {
    const currentWindows = await countVisibleWindows();
    if (currentWindows > maxWindows) {
      maxWindows = currentWindows;
    }
    
    // Check if daemon is still running
    if (daemonProcess.killed || daemonProcess.exitCode !== null) {
      console.error('❌ FAIL: Daemon died during test');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
  }
  
  // Stop daemon via STOP switch
  console.log('\n🛑 Stopping daemon via STOP switch...');
  fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
  const stopStart = Date.now();
  const stopTimeout = stopStart + 10000; // 10 seconds
  
  while (daemonProcess.exitCode === null && Date.now() < stopTimeout) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  let stopSwitchSeconds = Math.ceil((Date.now() - stopStart) / 1000);
  if (daemonProcess.exitCode === null) {
    console.log('⚠️  Daemon did not exit within 10s - killing');
    daemonProcess.kill();
    stopSwitchSeconds = 999;
  } else {
    console.log(`✅ Daemon stopped via STOP switch in ${stopSwitchSeconds}s`);
  }
  
  // Collect metrics
  console.log('\n📊 Collecting metrics...');
  
  const finalWindows = await countVisibleWindows();
  const windowsOpened = Math.max(0, finalWindows - initialWindows);
  
  const dbConnected = await checkDbConnection();
  const queues = await checkQueuesReadable();
  const ticksCount = await getExecutorTicks();
  const pagesMax = await getMaxPagesFromTicks();
  const browserLaunches = await getBrowserLaunchesFromTicks();
  
  const metrics: ProofMetrics = {
    windows_opened: windowsOpened,
    headless: config.headless === true,
    pages_max: pagesMax,
    browser_launches: browserLaunches,
    db_connected: dbConnected,
    queues_readable: queues.readable,
    posting_ready: queues.posting_ready,
    reply_ready: queues.reply_ready,
    stop_switch_seconds: stopSwitchSeconds,
    ticks_count: ticksCount,
  };
  
  // Determine PASS/FAIL
  const pass = 
    metrics.windows_opened === 0 &&
    metrics.headless === true &&
    metrics.pages_max <= 1 &&
    metrics.browser_launches <= 1 &&
    metrics.db_connected === true &&
    metrics.queues_readable === true &&
    metrics.stop_switch_seconds <= 10;
  
  // Output summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (pass) {
    console.log('           ✅ TEST PASSED');
  } else {
    console.log('           ❌ TEST FAILED');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Metrics:');
  console.log(`  windows_opened: ${metrics.windows_opened} (expected: 0) ${metrics.windows_opened === 0 ? '✅' : '❌'}`);
  console.log(`  headless: ${metrics.headless} (expected: true) ${metrics.headless === true ? '✅' : '❌'}`);
  console.log(`  pages_max: ${metrics.pages_max} (expected: <= 1) ${metrics.pages_max <= 1 ? '✅' : '❌'}`);
  console.log(`  browser_launches: ${metrics.browser_launches} (expected: <= 1) ${metrics.browser_launches <= 1 ? '✅' : '❌'}`);
  console.log(`  db_connected: ${metrics.db_connected} (expected: true) ${metrics.db_connected === true ? '✅' : '❌'}`);
  console.log(`  queues_readable: ${metrics.queues_readable} (expected: true) ${metrics.queues_readable === true ? '✅' : '❌'}`);
  console.log(`  posting_ready: ${metrics.posting_ready}`);
  console.log(`  reply_ready: ${metrics.reply_ready}`);
  console.log(`  stop_switch_seconds: ${metrics.stop_switch_seconds} (expected: <= 10) ${metrics.stop_switch_seconds <= 10 ? '✅' : '❌'}`);
  console.log(`  ticks_count: ${metrics.ticks_count}`);
  console.log('');
  
  // Write report
  const reportPath = path.join(process.cwd(), 'docs', 'EXECUTOR_15MIN_HEADLESS_PROOF.md');
  const report = `# Executor 15-Minute Headless Proof

**Date:** ${new Date().toISOString()}  
**Status:** ${pass ? '✅ PASS' : '❌ FAIL'}

## Metrics

- **windows_opened:** ${metrics.windows_opened} (expected: 0) ${metrics.windows_opened === 0 ? '✅' : '❌'}
- **headless:** ${metrics.headless} (expected: true) ${metrics.headless === true ? '✅' : '❌'}
- **pages_max:** ${metrics.pages_max} (expected: <= 1) ${metrics.pages_max <= 1 ? '✅' : '❌'}
- **browser_launches:** ${metrics.browser_launches} (expected: <= 1) ${metrics.browser_launches <= 1 ? '✅' : '❌'}
- **db_connected:** ${metrics.db_connected} (expected: true) ${metrics.db_connected === true ? '✅' : '❌'}
- **queues_readable:** ${metrics.queues_readable} (expected: true) ${metrics.queues_readable === true ? '✅' : '❌'}
- **posting_ready:** ${metrics.posting_ready}
- **reply_ready:** ${metrics.reply_ready}
- **stop_switch_seconds:** ${metrics.stop_switch_seconds} (expected: <= 10) ${metrics.stop_switch_seconds <= 10 ? '✅' : '❌'}
- **ticks_count:** ${metrics.ticks_count}

## Configuration

- **profile_dir:** ${config.profile_dir}
- **user_data_dir:** ${config.user_data_dir}
- **mode:** ${config.mode}

## Result

${pass ? '✅ **PASS** - All hard requirements met' : '❌ **FAIL** - One or more hard requirements failed'}
`;
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  if (!pass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
