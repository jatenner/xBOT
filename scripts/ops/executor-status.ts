#!/usr/bin/env tsx
/**
 * 📊 EXECUTOR STATUS
 * 
 * Prints comprehensive executor status:
 * - LaunchAgent installed/loaded status
 * - Daemon running status and PID
 * - chrome-cdp.ts processes running
 * - Bot-owned Chromium process count
 * - Last 20 lines of executor.log
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const CONFIG_PATH = RUNNER_PROFILE_PATHS.executorConfig();
const LOG_FILE = RUNNER_PROFILE_PATHS.logs();
const PLIST_FILE = path.join(process.env.HOME || '', 'Library/LaunchAgents/com.xbot.executor.plist');

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 EXECUTOR STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Check LaunchAgent
  console.log('1️⃣  LaunchAgent Status:');
  let launchAgentInstalled = false;
  let launchAgentLoaded = false;
  
  if (fs.existsSync(PLIST_FILE)) {
    launchAgentInstalled = true;
    console.log(`   ✅ Installed: ${PLIST_FILE}`);
    
    try {
      const result = execSync('launchctl list | grep com.xbot.executor', { encoding: 'utf-8' });
      if (result.trim()) {
        launchAgentLoaded = true;
        console.log(`   ✅ Loaded: Yes`);
      } else {
        console.log(`   ❌ Loaded: No`);
      }
    } catch {
      console.log(`   ❌ Loaded: No`);
    }
  } else {
    console.log(`   ❌ Installed: No`);
  }
  console.log('');
  
  // 2. Check daemon PID
  console.log('2️⃣  Daemon Status:');
  let pid: number | null = null;
  let running = false;
  
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      pid = parseInt(pidfileContent.split(':')[0], 10);
      
      // Check if process is running
      try {
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        running = true;
        console.log(`   ✅ Running: Yes (PID: ${pid})`);
      } catch {
        running = false;
        console.log(`   ❌ Running: No (stale PID file)`);
      }
    } catch {
      console.log(`   ❌ Running: No (invalid PID file)`);
    }
  } else {
    console.log(`   ❌ Running: No (no PID file)`);
  }
  console.log('');
  
  // 3. Check chrome-cdp.ts processes
  console.log('3️⃣  chrome-cdp.ts Processes:');
  try {
    const result = execSync('ps aux | grep "chrome-cdp.ts" | grep -v grep', { encoding: 'utf-8' });
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      console.log(`   ⚠️  Found ${lines.length} process(es):`);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        console.log(`      PID ${pid}`);
      }
    } else {
      console.log(`   ✅ None running`);
    }
  } catch {
    console.log(`   ✅ None running`);
  }
  console.log('');
  
  // 4. Check bot-owned Chromium processes
  console.log('4️⃣  Bot-Owned Chromium Processes:');
  try {
    const result = execSync(`ps aux | grep -i "chromium\|chrome" | grep -i "executor-chrome-profile\|runner-profile" | grep -v grep`, { encoding: 'utf-8' });
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      console.log(`   ⚠️  Found ${lines.length} process(es)`);
      // Show first few PIDs
      for (const line of lines.slice(0, 5)) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        console.log(`      PID ${pid}`);
      }
      if (lines.length > 5) {
        console.log(`      ... and ${lines.length - 5} more`);
      }
    } else {
      console.log(`   ✅ None running`);
    }
  } catch {
    console.log(`   ✅ None running`);
  }
  console.log('');
  
  // Check config
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      console.log(`Configuration:`);
      console.log(`  profile_dir: ${config.profile_dir}`);
      console.log(`  user_data_dir: ${config.user_data_dir}`);
      console.log(`  headless: ${config.headless}`);
      console.log(`  mode: ${config.mode}`);
      console.log('');
    } catch {
      // Ignore
    }
  }
  
  // Get last tick time
  try {
    const supabase = getSupabaseClient();
    const { data: lastTick } = await supabase
      .from('system_events')
      .select('created_at, event_data')
      .eq('event_type', 'EXECUTOR_DAEMON_TICK')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastTick) {
      const eventData = typeof lastTick.event_data === 'string' 
        ? JSON.parse(lastTick.event_data) 
        : lastTick.event_data;
      const lastTickTime = new Date(lastTick.created_at);
      const ageSeconds = Math.floor((Date.now() - lastTickTime.getTime()) / 1000);
      
      console.log(`Last Tick:`);
      console.log(`  Time: ${lastTickTime.toISOString()}`);
      console.log(`  Age: ${ageSeconds}s ago`);
      console.log(`  Pages: ${eventData.pages || 'N/A'}`);
      console.log(`  Browser Launches: ${eventData.browser_launch_count || 'N/A'}`);
      console.log(`  Posting Ready: ${eventData.posting_ready || 'N/A'}`);
      console.log(`  Reply Ready: ${eventData.reply_ready || 'N/A'}`);
      console.log('');
    } else {
      console.log(`Last Tick: None found\n`);
    }
  } catch (e: any) {
    console.log(`Last Tick: Error querying DB (${e.message})\n`);
  }
  
  // Check proof report for windows_opened expectation
  const proofReportPath = path.join(process.cwd(), 'docs', 'EXECUTOR_15MIN_HEADLESS_PROOF.md');
  if (fs.existsSync(proofReportPath)) {
    try {
      const report = fs.readFileSync(proofReportPath, 'utf-8');
      const windowsMatch = report.match(/windows_opened.*?(\d+)/);
      if (windowsMatch) {
        const windowsOpened = parseInt(windowsMatch[1], 10);
        console.log(`Windows Opened (from last proof): ${windowsOpened}`);
        console.log(`  Expectation: windows_opened=0 ✅`);
        console.log('');
      }
    } catch {
      // Ignore
    }
  }
  
  // 5. Last 20 lines of executor.log
  console.log('5️⃣  Last 20 Lines of Executor Log:');
  if (fs.existsSync(LOG_FILE)) {
    try {
      const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = logContent.trim().split('\n');
      const lastLines = lines.slice(-20);
      if (lastLines.length > 0) {
        console.log(`   ${LOG_FILE}:`);
        for (const line of lastLines) {
          console.log(`   ${line}`);
        }
      } else {
        console.log(`   Log file is empty`);
      }
    } catch (e: any) {
      console.log(`   ⚠️  Error reading log: ${e.message}`);
    }
  } else {
    console.log(`   ❌ Log file not found: ${LOG_FILE}`);
  }
  console.log('');
  
  // 6. Check visible windows
  console.log('6️⃣  Visible Chrome Windows:');
  try {
    const visibleWindows = execSync('osascript -e \'tell application "System Events" to count windows of process "Google Chrome"\'', { encoding: 'utf-8' }).trim();
    const count = parseInt(visibleWindows, 10) || 0;
    console.log(`   Count: ${count}`);
    if (count === 0) {
      console.log(`   ✅ Expectation met: 0 windows (no visible windows from executor)`);
    } else {
      console.log(`   ⚠️  Expectation: 0 windows (executor should not open visible windows)`);
    }
  } catch {
    console.log(`   ⚠️  Unable to check (Chrome may not be running)`);
  }
  console.log('');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
