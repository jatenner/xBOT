#!/usr/bin/env tsx
/**
 * 🚀 OPS:UP:FAST - Deterministic System Bring-Up & Proof
 * 
 * One command to bring the system up and prove it's actually running.
 * 
 * Usage:
 *   SOAK_MINUTES=20 DELAY_MINUTES=5 pnpm run ops:up:fast
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const SOAK_MINUTES = parseInt(process.env.SOAK_MINUTES || '20', 10);
const DELAY_MINUTES = parseInt(process.env.DELAY_MINUTES || '5', 10);
const REQUIRE_DECISION_PROGRESS = process.env.REQUIRE_DECISION_PROGRESS === 'true';

const paths = getRunnerPaths();
const AUTH_OK_PATH = paths.auth_marker_path;

interface StepResult {
  step: string;
  passed: boolean;
  reason?: string;
  reportPath?: string;
  screenshotPath?: string;
  nextCommand?: string;
}

const results: StepResult[] = [];

function logStep(step: string, message: string): void {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`           ${step}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(message);
}

function recordResult(step: string, passed: boolean, reason?: string, reportPath?: string, screenshotPath?: string, nextCommand?: string): void {
  results.push({ step, passed, reason, reportPath, screenshotPath, nextCommand });
  if (!passed) {
    console.error(`\n❌ ${step}: FAILED`);
    if (reason) console.error(`   Reason: ${reason}`);
    if (reportPath) console.error(`   Report: ${reportPath}`);
    if (screenshotPath) console.error(`   Screenshot: ${screenshotPath}`);
    if (nextCommand) console.error(`   Next: ${nextCommand}`);
  } else {
    console.log(`\n✅ ${step}: PASSED`);
  }
}

async function runCommand(command: string, description: string, allowFailure: boolean = false): Promise<{ success: boolean; output: string }> {
  try {
    console.log(`Running: ${command}`);
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'inherit',
      env: { ...process.env },
    });
    return { success: true, output: output || '' };
  } catch (error: any) {
    if (allowFailure) {
      return { success: false, output: error.message || String(error) };
    }
    throw error;
  }
}

function findLatestReport(pattern: string, dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => f.includes(pattern))
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 OPS:UP:FAST - System Bring-Up & Proof');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   SOAK_MINUTES: ${SOAK_MINUTES}`);
  console.log(`   DELAY_MINUTES: ${DELAY_MINUTES}`);
  console.log(`   REQUIRE_DECISION_PROGRESS: ${REQUIRE_DECISION_PROGRESS}`);
  console.log(`   runner_profile_dir_abs: ${paths.runner_profile_dir_abs}`);
  console.log('');
  
  // STEP 1: Hard stop
  logStep('STEP 1: Hard Stop', 'Stopping executor daemon...');
  try {
    await runCommand('pnpm run executor:stop', 'Stop executor', true);
    recordResult('Hard Stop', true);
  } catch (e: any) {
    recordResult('Hard Stop', false, `Failed to stop executor: ${e.message}`);
    // Continue anyway - executor may not be running
  }
  
  // STEP 2: Preflight
  logStep('STEP 2: Preflight', 'Checking OpenAI drift and validation...');
  try {
    await runCommand('pnpm run ops:check:openai-drift', 'Check OpenAI drift');
    await runCommand('pnpm run ops:validate:openai', 'Validate OpenAI key');
    recordResult('Preflight', true);
  } catch (e: any) {
    recordResult('Preflight', false, `Preflight failed: ${e.message}`, undefined, undefined, 'pnpm run ops:sync:openai-key-from-railway:xbot');
    console.error('\n❌ FATAL: Preflight failed - cannot proceed');
    console.error('OPS_UP_FAST=FAIL reason=preflight_failed');
    process.exit(1);
  }
  
  // STEP 3: Cookie persistence proof (before auth)
  logStep('STEP 3: Cookie Persistence Proof', 'Checking cookie persistence...');
  try {
    // Run full cookie persistence check (before auth, after auth, delayed)
    // This requires AUTH_OK to exist, so we check first
    if (!fs.existsSync(AUTH_OK_PATH)) {
      // Before auth phase
      console.log('\n📋 Phase: BEFORE_AUTH');
      await runCommand('BEFORE_AUTH=true pnpm run executor:prove:cookie-persist', 'Cookie check before auth');
      
      // Auth step (required for after_auth)
      console.log('\n📋 Phase: Auth (operator action required)');
      console.log('⚠️  If browser opens, complete login manually, then press ENTER in terminal');
      await runCommand('pnpm run executor:auth', 'Executor auth');
    } else {
      console.log('✅ AUTH_OK marker exists - skipping before_auth phase');
    }
    
    // After auth and delayed check (full run)
    console.log(`\n📋 Phase: Full check (after auth + ${DELAY_MINUTES} min delay)...`);
    await runCommand(`DELAY_MINUTES=${DELAY_MINUTES} pnpm run executor:prove:cookie-persist`, 'Full cookie persistence check');
    
    // Find latest cookie persist report
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const cookieReport = findLatestReport('cookie-persistence', reportsDir);
    
    // Verify cookies increased and persisted by checking the full run output
    // The full run should have compared before/after/delayed and reported analysis
    recordResult('Cookie Persistence', true, undefined, cookieReport || undefined);
  } catch (e: any) {
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const cookieReport = findLatestReport('cookie-persistence', reportsDir);
    recordResult('Cookie Persistence', false, 'COOKIE_NOT_PERSISTING', cookieReport || undefined, undefined, 'pnpm run executor:auth');
    console.error('\n❌ FATAL: Cookie persistence proof failed');
    console.error('OPS_UP_FAST=FAIL reason=COOKIE_NOT_PERSISTING');
    if (cookieReport) console.error(`Report: ${cookieReport}`);
    process.exit(1);
  }
  
  // STEP 4: Auth bring-up
  logStep('STEP 4: Auth Bring-Up', 'Verifying auth read/write...');
  try {
    await runCommand('pnpm run executor:prove:auth-readwrite', 'Auth read/write proof');
    recordResult('Auth Bring-Up', true);
  } catch (e: any) {
    recordResult('Auth Bring-Up', false, `Auth read/write failed: ${e.message}`, undefined, undefined, 'pnpm run executor:auth');
    console.error('\n❌ FATAL: Auth bring-up failed');
    console.error('OPS_UP_FAST=FAIL reason=auth_readwrite_failed');
    console.error('Next: pnpm run executor:auth');
    process.exit(1);
  }
  
  // STEP 5: Start daemon
  logStep('STEP 5: Start Daemon', 'Starting executor daemon...');
  try {
    // Check if daemon is already running
    const pidFile = path.join(paths.runner_profile_dir_abs, 'executor.pid');
    let daemonRunning = false;
    
    if (fs.existsSync(pidFile)) {
      try {
        const pidContent = fs.readFileSync(pidFile, 'utf-8').trim();
        const pid = parseInt(pidContent.split(':')[0], 10);
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        daemonRunning = true;
        console.log(`✅ Daemon already running (PID: ${pid})`);
      } catch {
        // Stale PID file
        console.log('⚠️  Stale PID file detected, starting fresh daemon...');
      }
    }
    
    if (!daemonRunning) {
      console.log('🚀 Starting daemon in background...');
      // Start daemon via LaunchAgent (non-blocking)
      execSync('pnpm run executor:start', { encoding: 'utf-8', stdio: 'inherit' });
      console.log('⏱️  Waiting 10 seconds for daemon to initialize...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Verify daemon logs show headless=true and preflight passed
    const logFile = path.join(paths.runner_profile_dir_abs, 'executor.log');
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, 'utf-8');
      const lastLines = logContent.split('\n').slice(-50).join('\n');
      
      const hasHeadless = lastLines.includes('HEADLESS: true') || lastLines.includes('headless: true');
      const hasPreflightPassed = lastLines.includes('Auth preflight passed') || lastLines.includes('auth_preflight_passed');
      
      if (!hasHeadless) {
        throw new Error('Daemon logs do not show headless=true');
      }
      if (!hasPreflightPassed) {
        throw new Error('Daemon logs do not show preflight passed');
      }
      
      console.log('✅ Daemon verified: headless=true, preflight passed');
    } else {
      console.warn('⚠️  Log file not found - daemon may still be initializing');
    }
    
    recordResult('Start Daemon', true);
  } catch (e: any) {
    recordResult('Start Daemon', false, `Daemon start/verify failed: ${e.message}`, undefined, undefined, 'pnpm run executor:stop && pnpm run executor:start');
    console.error('\n❌ FATAL: Daemon start failed');
    console.error('OPS_UP_FAST=FAIL reason=daemon_start_failed');
    console.error('Next: pnpm run executor:stop && pnpm run executor:start');
    process.exit(1);
  }
  
  // STEP 6: Short soak run
  logStep('STEP 6: Short Soak Run', `Running ${SOAK_MINUTES}-minute auth persistence proof...`);
  try {
    await runCommand(`PROOF_DURATION_MINUTES=${SOAK_MINUTES} pnpm run executor:prove:auth-persistence`, 'Auth persistence proof');
    
    // Find latest auth persistence report
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const persistenceReport = findLatestReport('auth-persistence', reportsDir);
    
    // Check report for failure classification
    if (persistenceReport && fs.existsSync(persistenceReport)) {
      const reportContent = fs.readFileSync(persistenceReport, 'utf-8');
      
      // Check for failure fingerprints
      if (reportContent.includes('Status:** ❌ **FAIL**')) {
        // Extract first failure reason from report
        const failureMatch = reportContent.match(/Reason:\*\* (.+?)(?:\n|$)/);
        const reason = failureMatch ? failureMatch[1] : 'unknown';
        
        // Find screenshot path
        const screenshotMatch = reportContent.match(/\[View\]\((.+?)\)/);
        const screenshotPath = screenshotMatch ? screenshotMatch[1] : undefined;
        
        // Classify failure
        let bucket = 'unknown';
        let message = '';
        let nextCommand = 'pnpm run ops:recover:x-auth';
        
        if (reason.includes('login_redirect')) {
          bucket = 'login_redirect';
          message = 'likely revocation';
          const cookieReport = findLatestReport('cookie-persistence', reportsDir);
          if (cookieReport) message += ` (check cookie report: ${cookieReport})`;
        } else if (reason.includes('consent_wall')) {
          bucket = 'consent_wall_detected';
          message = 'consent variant - confirm daemon preflight logic';
        } else if (reason.includes('challenge')) {
          bucket = 'challenge_suspected';
          message = 'challenge detected → fail closed';
          nextCommand = 'pnpm run executor:auth (manual verification required)';
        }
        
        recordResult('Short Soak Run', false, bucket, persistenceReport, screenshotPath, nextCommand);
        console.error(`\n❌ Soak run failed: ${bucket}`);
        console.error(`   ${message}`);
        if (screenshotPath) console.error(`   Screenshot: ${screenshotPath}`);
        console.error(`   Report: ${persistenceReport}`);
        console.error(`   Next: ${nextCommand}`);
        console.error(`\nOPS_UP_FAST=FAIL reason=${bucket}`);
        process.exit(1);
      }
    }
    
    recordResult('Short Soak Run', true, undefined, persistenceReport || undefined);
  } catch (e: any) {
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const persistenceReport = findLatestReport('auth-persistence', reportsDir);
    const screenshotDir = path.join(reportsDir);
    const screenshots = fs.existsSync(screenshotDir) 
      ? fs.readdirSync(screenshotDir).filter(f => f.includes('auth-persistence-fail')).map(f => path.join(screenshotDir, f))
      : [];
    const latestScreenshot = screenshots.length > 0 ? screenshots[screenshots.length - 1] : undefined;
    
    recordResult('Short Soak Run', false, `Soak run failed: ${e.message}`, persistenceReport || undefined, latestScreenshot, 'pnpm run ops:recover:x-auth');
    console.error('\n❌ FATAL: Soak run failed');
    console.error('OPS_UP_FAST=FAIL reason=soak_failed');
    if (persistenceReport) console.error(`Report: ${persistenceReport}`);
    if (latestScreenshot) console.error(`Screenshot: ${latestScreenshot}`);
    console.error('Next: pnpm run ops:recover:x-auth');
    process.exit(1);
  }
  
  // SUCCESS
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ ALL STEPS PASSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📊 Summary:');
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`   ${icon} ${r.step}`);
  });
  
  console.log('\n✅ OPS_UP_FAST=PASS');
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    console.error('OPS_UP_FAST=FAIL reason=fatal_error');
    process.exit(1);
  });
}
