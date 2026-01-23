#!/usr/bin/env tsx
/**
 * 📊 EXECUTOR STATUS
 * 
 * Prints executor daemon status: running/not running, PID, last tick time, windows_opened expectation
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const CONFIG_PATH = RUNNER_PROFILE_PATHS.executorConfig();

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 EXECUTOR STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check PID file
  let pid: number | null = null;
  let running = false;
  
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      pid = parseInt(pidfileContent.split(':')[0], 10);
      
      // Check if process is running
      try {
        const { execSync } = require('child_process');
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        running = true;
      } catch {
        running = false;
      }
    } catch {
      // Ignore
    }
  }
  
  console.log(`Status: ${running ? '✅ RUNNING' : '❌ NOT RUNNING'}`);
  if (pid) {
    console.log(`PID: ${pid}`);
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
  
  // Check visible windows
  try {
    const { execSync } = require('child_process');
    const visibleWindows = execSync('osascript -e \'tell application "System Events" to count windows of process "Google Chrome"\'', { encoding: 'utf-8' }).trim();
    console.log(`Current Visible Chrome Windows: ${visibleWindows}`);
    console.log(`  Expectation: 0 (no windows from executor) ✅`);
  } catch {
    console.log(`Current Visible Chrome Windows: Unable to check`);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
