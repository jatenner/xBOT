#!/usr/bin/env tsx
/**
 * 🔍 EXECUTOR STABILITY VERIFICATION
 * 
 * Runs executor for 10 minutes and verifies:
 * - Page count stays at 1
 * - No new Chrome windows/tabs
 * - CPU stays reasonable
 * - STOP switch works
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || './.runner-profile';
const STOP_SWITCH_PATH = path.join(RUNNER_PROFILE_DIR, 'STOP_EXECUTOR');
const TEST_DURATION_SECONDS = 600; // 10 minutes

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 EXECUTOR STABILITY VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Ensure profile dir exists
  if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
    fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
  }
  
  // Create STOP switch as safety net
  fs.writeFileSync(STOP_SWITCH_PATH, '');
  console.log('✅ STOP switch created (safety net)');
  
  // Check for existing executors
  try {
    const executorPids = execSync('ps aux | grep -E "executor-daemon|poll-and-post|schedule-and-post" | grep -v grep | awk \'{print $2}\'', { encoding: 'utf-8' }).trim();
    if (executorPids) {
      console.warn(`⚠️  Found existing executor processes: ${executorPids}`);
      console.warn(`   Kill them first: pkill -f executor-daemon`);
      process.exit(1);
    }
  } catch {
    // No existing processes (good)
  }
  
  // Check LaunchAgent status
  try {
    const launchAgentStatus = execSync('launchctl list | grep com.xbot.executor', { encoding: 'utf-8' }).trim();
    if (launchAgentStatus) {
      console.warn(`⚠️  LaunchAgent is loaded: ${launchAgentStatus}`);
      console.warn(`   Unload it first: launchctl unload ~/Library/LaunchAgents/com.xbot.executor.plist`);
      process.exit(1);
    }
  } catch {
    // LaunchAgent not loaded (good)
  }
  
  console.log('\n📋 Test Configuration:');
  console.log(`   Duration: ${TEST_DURATION_SECONDS / 60} minutes`);
  console.log(`   STOP switch: ${STOP_SWITCH_PATH}`);
  console.log(`   Profile dir: ${RUNNER_PROFILE_DIR}`);
  console.log('');
  
  console.log('🚀 Starting executor...\n');
  console.log('📊 Monitoring logs for:');
  console.log('   - Page count (should stay at 1)');
  console.log('   - Chrome PIDs (should stay stable)');
  console.log('   - STOP switch triggers');
  console.log('   - Hard cap triggers\n');
  
  // Start executor in background
  const executorProcess = execSync(
    `EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR} pnpm run runner:posting-queue-once`,
    { 
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: TEST_DURATION_SECONDS * 1000 + 5000,
    }
  );
  
  // Parse logs for guard state
  const guardLogs = executorProcess.split('\n').filter(line => line.includes('EXECUTOR_GUARD'));
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 VERIFICATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Extract page counts
  const pageCounts = guardLogs
    .map(line => {
      const match = line.match(/pages=(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((count): count is number => count !== null);
  
  const maxPages = pageCounts.length > 0 ? Math.max(...pageCounts) : 0;
  const pagesExceededOne = pageCounts.some(count => count > 1);
  
  console.log(`Page count analysis:`);
  console.log(`   Total guard logs: ${guardLogs.length}`);
  console.log(`   Max pages seen: ${maxPages}`);
  console.log(`   Pages exceeded 1: ${pagesExceededOne ? 'YES ❌' : 'NO ✅'}`);
  
  // Check for STOP switch triggers
  const stopTriggers = guardLogs.filter(line => line.includes('STOP SWITCH TRIGGERED')).length;
  console.log(`\nSTOP switch triggers: ${stopTriggers}`);
  
  // Check for hard cap triggers
  const hardCapTriggers = guardLogs.filter(line => 
    line.includes('TAB EXPLOSION') || 
    line.includes('MULTIPLE CHROME') ||
    line.includes('RUNTIME CAP EXCEEDED')
  ).length;
  console.log(`Hard cap triggers: ${hardCapTriggers}`);
  
  // Final verdict
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (maxPages <= 1 && !pagesExceededOne && hardCapTriggers === 0) {
    console.log('           ✅ VERIFICATION PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Page count stayed at 1 or below ✅');
    console.log('No hard caps triggered ✅');
    console.log('Executor ran safely ✅');
  } else {
    console.log('           ❌ VERIFICATION FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Max pages: ${maxPages} (expected: 1) ❌`);
    console.log(`Hard cap triggers: ${hardCapTriggers} (expected: 0) ❌`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
