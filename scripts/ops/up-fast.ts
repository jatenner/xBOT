#!/usr/bin/env tsx
/**
 * 🚀 OPS:UP:FAST - Deterministic System Bring-Up & Proof
 * 
 * One command to bring the system up and prove it's actually running.
 * 
 * Usage:
 *   SOAK_MINUTES=20 DELAY_MINUTES=5 pnpm run ops:up:fast
 *   REQUIRE_EXECUTION_PROOF=true TARGET_TWEET_ID=1234567890123456789 pnpm run ops:up:fast
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const SOAK_MINUTES = parseInt(process.env.SOAK_MINUTES || '20', 10);
const DELAY_MINUTES = parseInt(process.env.DELAY_MINUTES || '5', 10);
const REQUIRE_DECISION_PROGRESS = process.env.REQUIRE_DECISION_PROGRESS === 'true';
const REQUIRE_EXECUTION_PROOF = process.env.REQUIRE_EXECUTION_PROOF === 'true';
const TARGET_TWEET_ID = process.env.TARGET_TWEET_ID;

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
    .filter(f => f.includes(pattern) && (f.endsWith('.md') || f.endsWith('.jsonl')))
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
  console.log(`   REQUIRE_EXECUTION_PROOF: ${REQUIRE_EXECUTION_PROOF}`);
  if (REQUIRE_EXECUTION_PROOF) {
    console.log(`   TARGET_TWEET_ID: ${TARGET_TWEET_ID || 'NOT SET (required)'}`);
  }
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
    // Write failure to ledger
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
    const ledgerDir = path.dirname(ledgerPath);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
    const ledgerEntry = {
      timestamp: new Date().toISOString(),
      passed: false,
      reason: 'preflight_failed',
      soak_minutes: SOAK_MINUTES,
    };
    fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
    
    recordResult('Preflight', false, `Preflight failed: ${e.message}`, undefined, undefined, 'pnpm run ops:sync:openai-key-from-railway:xbot');
    console.error('\n❌ FATAL: Preflight failed - cannot proceed');
    console.error('OPS_UP_FAST=FAIL reason=preflight_failed');
    process.exit(1);
  }
  
  // STEP 3: Cookie persistence proof (before auth)
  logStep('STEP 3: Cookie Persistence Proof', 'Checking cookie persistence...');
  try {
    // Before auth phase (always run if AUTH_OK doesn't exist)
    if (!fs.existsSync(AUTH_OK_PATH)) {
      console.log('\n📋 Phase: BEFORE_AUTH');
      await runCommand('BEFORE_AUTH=true pnpm run executor:prove:cookie-persist', 'Cookie check before auth');
    } else {
      console.log('✅ AUTH_OK marker exists - skipping before_auth phase');
    }
    
    // Auth step (required for after_auth) - only if AUTH_OK doesn't exist
    if (!fs.existsSync(AUTH_OK_PATH)) {
      console.log('\n📋 Phase: Auth (operator action required)');
      console.log('⚠️  If browser opens, complete login manually, then press ENTER in terminal');
      await runCommand('pnpm run executor:auth', 'Executor auth');
    }
    
    // Verify AUTH_OK exists now
    if (!fs.existsSync(AUTH_OK_PATH)) {
      throw new Error('AUTH_OK marker not created after executor:auth');
    }
    
    // After auth phase
    console.log('\n📋 Phase: AFTER_AUTH');
    await runCommand('AFTER_AUTH=true pnpm run executor:prove:cookie-persist', 'Cookie check after auth');
    
    // Delayed check
    console.log(`\n📋 Phase: Delayed check (waiting ${DELAY_MINUTES} minutes)...`);
    await new Promise(resolve => setTimeout(resolve, DELAY_MINUTES * 60 * 1000));
    await runCommand(`DELAY_MINUTES=${DELAY_MINUTES} pnpm run executor:prove:cookie-persist`, 'Cookie check delayed');
    
    // Run full check to get analysis (compares all phases)
    console.log('\n📋 Phase: Full analysis check...');
    const fullCheckResult = await runCommand(`DELAY_MINUTES=${DELAY_MINUTES} pnpm run executor:prove:cookie-persist`, 'Full cookie persistence check', true);
    
    if (!fullCheckResult.success) {
      // Check exit code - cookie-persist exits 1 if cookies didn't increase/persist
      const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
      const cookieReport = findLatestReport('cookie-persistence', reportsDir);
      throw new Error('Cookies did not increase after auth or did not persist after delay');
    }
    
    // Find latest cookie persist report
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const cookieReport = findLatestReport('cookie-persistence', reportsDir);
    
    recordResult('Cookie Persistence', true, undefined, cookieReport || undefined);
  } catch (e: any) {
    // Write failure to ledger
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
    const ledgerDir = path.dirname(ledgerPath);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const cookieReport = findLatestReport('cookie-persistence', reportsDir);
    const ledgerEntry = {
      timestamp: new Date().toISOString(),
      passed: false,
      reason: 'COOKIE_NOT_PERSISTING',
      soak_minutes: SOAK_MINUTES,
      report_path: cookieReport || undefined,
    };
    fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
    
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
    // Write failure to ledger
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
    const ledgerDir = path.dirname(ledgerPath);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
    const ledgerEntry = {
      timestamp: new Date().toISOString(),
      passed: false,
      reason: 'auth_readwrite_failed',
      soak_minutes: SOAK_MINUTES,
    };
    fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
    
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
    // Write failure to ledger
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
    const ledgerDir = path.dirname(ledgerPath);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
    const ledgerEntry = {
      timestamp: new Date().toISOString(),
      passed: false,
      reason: 'daemon_start_failed',
      soak_minutes: SOAK_MINUTES,
    };
    fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
    
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
        
        // Write failure to ledger before exiting
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
    const ledgerDir = path.dirname(ledgerPath);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
    
    let minutesOk: number | undefined;
    let firstFailureMinute: number | null | undefined;
    
    if (persistenceReport && fs.existsSync(persistenceReport)) {
      try {
        const content = fs.readFileSync(persistenceReport, 'utf-8');
        const minutesOkMatch = content.match(/- \*\*Minutes OK:\*\* (\d+)/);
        minutesOk = minutesOkMatch ? parseInt(minutesOkMatch[1], 10) : undefined;
        
        const firstFailureMatch = content.match(/- \*\*First Failure Minute:\*\* (\d+|N\/A)/);
        firstFailureMinute = firstFailureMatch && firstFailureMatch[1] !== 'N/A' 
          ? parseInt(firstFailureMatch[1], 10) 
          : null;
      } catch (e) {
        // Ignore
      }
    }
    
    const ledgerEntry = {
      timestamp: new Date().toISOString(),
      passed: false,
      reason: bucket,
      soak_minutes: SOAK_MINUTES,
      minutes_ok: minutesOk,
      first_failure_minute: firstFailureMinute,
      failure_reason: bucket,
      report_path: persistenceReport || undefined,
      screenshot_path: screenshotPath || undefined,
    };
    
    fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
    
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
    
    // STEP 7: Execution proof (if required)
    if (REQUIRE_EXECUTION_PROOF) {
      logStep('STEP 7: Execution Proof', 'Running real execution proof...');
      
      if (!TARGET_TWEET_ID) {
        recordResult('Execution Proof', false, 'TARGET_TWEET_ID not provided', undefined, undefined, 'Set TARGET_TWEET_ID environment variable');
        console.error('\n❌ FATAL: REQUIRE_EXECUTION_PROOF=true but TARGET_TWEET_ID not set');
        console.error('OPS_UP_FAST=FAIL reason=EXECUTION_PROOF_FAILED classification=TARGET_TWEET_ID_MISSING');
        process.exit(1);
      }
      
      try {
        console.log(`\n📋 Running execution proof with TARGET_TWEET_ID=${TARGET_TWEET_ID}...`);
        
        // Get ledger state before running proof
        const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');
        const ledgerBeforeLines = fs.existsSync(ledgerPath)
          ? fs.readFileSync(ledgerPath, 'utf-8').split('\n').filter(line => line.trim().length > 0)
          : [];
        
        // Run the proof (will throw if it fails)
        await runCommand(
          `EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=${TARGET_TWEET_ID} pnpm run executor:prove:e2e-control-reply`,
          'Execution proof (e2e-control-reply)'
        );
        
        // Wait a moment for ledger to be written
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Find latest execution report
        const executionReportsDir = path.join(process.cwd(), 'docs', 'proofs', 'control-reply');
        const executionReport = findLatestReport('control-reply-', executionReportsDir);
        
        // Check ledger for this run (should have new entry)
        let executionClassification: string | undefined;
        let executionPassed = false;
        let replyUrl: string | undefined;
        
        if (fs.existsSync(ledgerPath)) {
          try {
            const lines = fs.readFileSync(ledgerPath, 'utf-8')
              .split('\n')
              .filter(line => line.trim().length > 0);
            
            // Find the new entry (after our before count)
            if (lines.length > ledgerBeforeLines.length) {
              const lastEntry = JSON.parse(lines[lines.length - 1]);
              if (lastEntry.proof_type === 'e2e-control-reply' && lastEntry.target_tweet_id === TARGET_TWEET_ID) {
                executionPassed = lastEntry.passed === true;
                executionClassification = lastEntry.failure_classification;
                replyUrl = lastEntry.reply_url;
              }
            }
          } catch (e) {
            // Ignore ledger read errors - use command exit code as fallback
          }
        }
        
        // If command succeeded (didn't throw), assume pass unless ledger says otherwise
        if (executionPassed === false && executionClassification === undefined) {
          // Command succeeded but ledger unclear - assume pass (command exit code is authoritative)
          executionPassed = true;
        }
        
        if (executionPassed) {
          recordResult('Execution Proof', true, undefined, executionReport || undefined);
          console.log('\n✅ Execution proof PASSED');
          if (replyUrl) {
            console.log(`   Reply URL: ${replyUrl}`);
          }
          console.log(`   Report: ${executionReport || 'N/A'}`);
        } else {
          recordResult('Execution Proof', false, executionClassification || 'UNKNOWN', executionReport || undefined, undefined, 'Check execution report for details');
          console.error('\n❌ Execution proof FAILED');
          console.error(`   Classification: ${executionClassification || 'UNKNOWN'}`);
          console.error(`   Report: ${executionReport || 'N/A'}`);
          console.error('OPS_UP_FAST=FAIL reason=EXECUTION_PROOF_FAILED');
          if (executionClassification) {
            console.error(`classification=${executionClassification}`);
          }
          if (executionReport) {
            console.error(`report=${executionReport}`);
          }
          process.exit(1);
        }
      } catch (e: any) {
        const executionReportsDir = path.join(process.cwd(), 'docs', 'proofs', 'control-reply');
        const executionReport = findLatestReport('control-reply-', executionReportsDir);
        
        // Try to get classification from ledger
        let executionClassification = 'UNKNOWN';
        const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');
        if (fs.existsSync(ledgerPath)) {
          try {
            const lines = fs.readFileSync(ledgerPath, 'utf-8')
              .split('\n')
              .filter(line => line.trim().length > 0);
            if (lines.length > 0) {
              const lastEntry = JSON.parse(lines[lines.length - 1]);
              if (lastEntry.proof_type === 'e2e-control-reply' && lastEntry.target_tweet_id === TARGET_TWEET_ID) {
                executionClassification = lastEntry.failure_classification || 'UNKNOWN';
              }
            }
          } catch (e) {
            // Ignore
          }
        }
        
        recordResult('Execution Proof', false, executionClassification, executionReport || undefined, undefined, 'Check execution report for details');
        console.error('\n❌ FATAL: Execution proof failed');
        console.error('OPS_UP_FAST=FAIL reason=EXECUTION_PROOF_FAILED');
        console.error(`classification=${executionClassification}`);
        if (executionReport) {
          console.error(`report=${executionReport}`);
        }
        process.exit(1);
      }
    }
  } catch (e: any) {
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const persistenceReport = findLatestReport('auth-persistence', reportsDir);
    const screenshotDir = path.join(reportsDir);
    const screenshots = fs.existsSync(screenshotDir) 
      ? fs.readdirSync(screenshotDir).filter(f => f.includes('auth-persistence-fail')).map(f => path.join(screenshotDir, f))
      : [];
    const latestScreenshot = screenshots.length > 0 ? screenshots[screenshots.length - 1] : undefined;
    
    // Write failure to ledger
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
    const ledgerDir = path.dirname(ledgerPath);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
    
    const ledgerEntry = {
      timestamp: new Date().toISOString(),
      passed: false,
      reason: 'soak_failed',
      soak_minutes: SOAK_MINUTES,
      minutes_ok: undefined,
      first_failure_minute: undefined,
      failure_reason: 'soak_failed',
      report_path: persistenceReport || undefined,
      screenshot_path: latestScreenshot || undefined,
    };
    
    fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
    
    recordResult('Short Soak Run', false, `Soak run failed: ${e.message}`, persistenceReport || undefined, latestScreenshot, 'pnpm run ops:recover:x-auth');
    console.error('\n❌ FATAL: Soak run failed');
    console.error('OPS_UP_FAST=FAIL reason=soak_failed');
    if (persistenceReport) console.error(`Report: ${persistenceReport}`);
    if (latestScreenshot) console.error(`Screenshot: ${latestScreenshot}`);
    console.error('Next: pnpm run ops:recover:x-auth');
    process.exit(1);
  }
  
  // Write to ledger
  const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  
  // Find latest auth persistence report for metrics
  const persistenceReport = findLatestReport('auth-persistence', reportsDir);
  let minutesOk: number | undefined;
  let firstFailureMinute: number | null | undefined;
  let failureReason: string | undefined;
  
  if (persistenceReport && fs.existsSync(persistenceReport)) {
    try {
      const content = fs.readFileSync(persistenceReport, 'utf-8');
      const minutesOkMatch = content.match(/- \*\*Minutes OK:\*\* (\d+)/);
      minutesOk = minutesOkMatch ? parseInt(minutesOkMatch[1], 10) : undefined;
      
      const firstFailureMatch = content.match(/- \*\*First Failure Minute:\*\* (\d+|N\/A)/);
      firstFailureMinute = firstFailureMatch && firstFailureMatch[1] !== 'N/A' 
        ? parseInt(firstFailureMatch[1], 10) 
        : null;
      
      const fingerprintMatch = content.match(/\| (.+?) \| (.+?) \| (\d+) \|/);
      failureReason = fingerprintMatch ? fingerprintMatch[1] : undefined;
    } catch (e) {
      // Ignore
    }
  }
  
  const ledgerEntry = {
    timestamp: new Date().toISOString(),
    passed: true,
    soak_minutes: SOAK_MINUTES,
    minutes_ok: minutesOk,
    first_failure_minute: firstFailureMinute,
    failure_reason: failureReason,
    report_path: persistenceReport || undefined,
  };
  
  // Ensure ledger directory exists
  const ledgerDir = path.dirname(ledgerPath);
  if (!fs.existsSync(ledgerDir)) {
    fs.mkdirSync(ledgerDir, { recursive: true });
  }
  
  // Append to ledger
  fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf-8');
  
  // SUCCESS
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ ALL STEPS PASSED');
  if (REQUIRE_EXECUTION_PROOF) {
    console.log('           (Execution verified)');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📊 Summary:');
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`   ${icon} ${r.step}`);
  });
  
  console.log('\n✅ OPS_UP_FAST=PASS');
  if (REQUIRE_EXECUTION_PROOF) {
    console.log('   Execution verified: Real reply proof passed');
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    console.error('OPS_UP_FAST=FAIL reason=fatal_error');
    process.exit(1);
  });
}
