#!/usr/bin/env tsx
/**
 * 🛑 EXECUTOR STOP - Emergency Stop Everything
 * 
 * Stops ALL executor-related processes:
 * - Creates STOP switch
 * - Kills daemon PID if present
 * - Kills chrome-cdp.ts runner processes
 * - Kills Playwright/Chromium child processes created by bot
 * - Unloads LaunchAgent if installed
 * 
 * Usage:
 *   pnpm run executor:stop
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const PLIST_FILE = path.join(process.env.HOME || '', 'Library/LaunchAgents/com.xbot.executor.plist');

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🛑 EXECUTOR EMERGENCY STOP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  let stopped = false;
  
  // 1. Create STOP switch
  console.log('1️⃣  Creating STOP switch...');
  try {
    fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
    console.log(`   ✅ STOP switch created: ${STOP_SWITCH_PATH}`);
    stopped = true;
  } catch (e: any) {
    console.error(`   ⚠️  Failed to create STOP switch: ${e.message}`);
  }
  
  // 2. Kill daemon PID if present
  console.log('\n2️⃣  Checking daemon PID...');
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      const pid = parseInt(pidfileContent.split(':')[0], 10);
      
      try {
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        console.log(`   🎯 Found running daemon PID: ${pid}`);
        console.log(`   🔪 Killing daemon PID ${pid}...`);
        execSync(`kill ${pid} 2>/dev/null`, { encoding: 'utf-8' });
        // Wait synchronously
        const { execSync: execSyncSync } = require('child_process');
        execSyncSync('sleep 2', { encoding: 'utf-8' });
        try {
          execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
          console.log(`   ⚠️  Process still running, force killing...`);
          execSync(`kill -9 ${pid} 2>/dev/null`, { encoding: 'utf-8' });
        } catch {
          console.log(`   ✅ Daemon PID ${pid} killed`);
        }
        stopped = true;
      } catch {
        console.log(`   ✅ Daemon PID ${pid} not running (stale lock)`);
      }
      
      // Remove PID file
      try {
        fs.unlinkSync(PIDFILE_PATH);
        console.log(`   ✅ Removed PID file`);
      } catch {
        // Ignore
      }
    } catch (e: any) {
      console.error(`   ⚠️  Error reading PID file: ${e.message}`);
    }
  } else {
    console.log(`   ✅ No PID file found`);
  }
  
  // 3. Kill chrome-cdp.ts runner processes
  console.log('\n3️⃣  Checking chrome-cdp.ts processes...');
  try {
    const result = execSync('ps aux | grep "chrome-cdp.ts" | grep -v grep', { encoding: 'utf-8' });
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      console.log(`   🎯 Found ${lines.length} chrome-cdp.ts process(es)`);
      for (const line of lines) {
        const pid = parseInt(line.trim().split(/\s+/)[1], 10);
        if (!isNaN(pid)) {
          console.log(`   🔪 Killing chrome-cdp.ts PID ${pid}...`);
          try {
            execSync(`kill ${pid} 2>/dev/null`, { encoding: 'utf-8' });
            execSync('sleep 1', { encoding: 'utf-8' });
            try {
              execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
              execSync(`kill -9 ${pid} 2>/dev/null`, { encoding: 'utf-8' });
            } catch {
              console.log(`   ✅ chrome-cdp.ts PID ${pid} killed`);
            }
            stopped = true;
          } catch {
            // Ignore
          }
        }
      }
    } else {
      console.log(`   ✅ No chrome-cdp.ts processes found`);
    }
  } catch {
    console.log(`   ✅ No chrome-cdp.ts processes found`);
  }
  
  // 4. Kill Playwright/Chromium child processes created by bot
  console.log('\n4️⃣  Checking bot-owned Chromium processes...');
  try {
    // Find Chromium processes with executor profile path
    const result = execSync(`ps aux | grep -i "chromium\|chrome" | grep -i "executor-chrome-profile\|runner-profile" | grep -v grep`, { encoding: 'utf-8' });
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      console.log(`   🎯 Found ${lines.length} bot-owned Chromium process(es)`);
      for (const line of lines) {
        const pid = parseInt(line.trim().split(/\s+/)[1], 10);
        if (!isNaN(pid)) {
          console.log(`   🔪 Killing Chromium PID ${pid}...`);
          try {
            execSync(`kill ${pid} 2>/dev/null`, { encoding: 'utf-8' });
            execSync('sleep 1', { encoding: 'utf-8' });
            try {
              execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
              execSync(`kill -9 ${pid} 2>/dev/null`, { encoding: 'utf-8' });
            } catch {
              console.log(`   ✅ Chromium PID ${pid} killed`);
            }
            stopped = true;
          } catch {
            // Ignore
          }
        }
      }
    } else {
      console.log(`   ✅ No bot-owned Chromium processes found`);
    }
  } catch {
    console.log(`   ✅ No bot-owned Chromium processes found`);
  }
  
  // 5. Unload LaunchAgent if installed
  console.log('\n5️⃣  Checking LaunchAgent...');
  try {
    const result = execSync('launchctl list | grep com.xbot.executor', { encoding: 'utf-8' });
    if (result.trim()) {
      console.log(`   🎯 LaunchAgent is loaded`);
      console.log(`   🔪 Unloading LaunchAgent...`);
      try {
        execSync(`launchctl unload "${PLIST_FILE}" 2>/dev/null`, { encoding: 'utf-8' });
        console.log(`   ✅ LaunchAgent unloaded`);
        stopped = true;
      } catch (e: any) {
        console.error(`   ⚠️  Failed to unload LaunchAgent: ${e.message}`);
      }
    } else {
      console.log(`   ✅ LaunchAgent not loaded`);
    }
  } catch {
    console.log(`   ✅ LaunchAgent not loaded`);
  }
  
  // Wait a moment for processes to exit
  if (stopped) {
    console.log('\n⏳ Waiting 3 seconds for processes to exit...');
    execSync('sleep 3', { encoding: 'utf-8' });
  }
  
  // Final check
  console.log('\n📊 Final status check...');
  let stillRunning = false;
  
  // Check daemon
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      const pid = parseInt(pidfileContent.split(':')[0], 10);
      try {
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        console.log(`   ⚠️  Daemon PID ${pid} still running`);
        stillRunning = true;
      } catch {
        // Good
      }
    } catch {
      // Ignore
    }
  }
  
  // Check chrome-cdp.ts
  try {
    const result = execSync('ps aux | grep "chrome-cdp.ts" | grep -v grep', { encoding: 'utf-8' });
    if (result.trim()) {
      console.log(`   ⚠️  chrome-cdp.ts processes still running`);
      stillRunning = true;
    }
  } catch {
    // Good
  }
  
  // Check Chromium
  try {
    const result = execSync(`ps aux | grep -i "chromium\|chrome" | grep -i "executor-chrome-profile\|runner-profile" | grep -v grep`, { encoding: 'utf-8' });
    if (result.trim()) {
      console.log(`   ⚠️  Bot-owned Chromium processes still running`);
      stillRunning = true;
    }
  } catch {
    // Good
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (stillRunning) {
    console.log('           ⚠️  STOP COMPLETE (some processes may still be running)');
  } else {
    console.log('           ✅ STOP COMPLETE - All executor processes stopped');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (stillRunning) {
    console.log('💡 If processes are still running, try:');
    console.log('   pkill -9 -f "executor/daemon"');
    console.log('   pkill -9 -f "chrome-cdp.ts"');
    console.log('   pkill -9 "Google Chrome"');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
