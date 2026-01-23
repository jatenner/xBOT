#!/usr/bin/env tsx
/**
 * 🚀 MAC EXECUTOR DAEMON
 * 
 * Autonomous executor that runs posting and reply queues continuously.
 * Runs in EXECUTION_MODE=executor with fail-closed behavior.
 * 
 * Usage:
 *   EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile tsx scripts/runner/executor-daemon.ts
 */

import fs from 'fs';
import path from 'path';
import { appendFileSync } from 'fs';

// Load .env.local first, then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Set executor mode environment
process.env.EXECUTION_MODE = 'executor';
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_BROWSER) {
  process.env.RUNNER_BROWSER = 'cdp';
}
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR!;
const LOG_FILE = path.join(RUNNER_PROFILE_DIR, 'executor.log');
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);
const TICK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes base
const JITTER_MS = 15 * 1000; // ±15 seconds jitter
const BACKOFF_MINUTES = 10; // Back off 10 minutes on failure

// Ensure log directory exists
if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
  fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
}

/**
 * Write to both console and log file
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);
  try {
    appendFileSync(LOG_FILE, logLine + '\n');
  } catch (err: any) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

/**
 * Check if CDP is reachable
 */
async function checkCDP(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check session validity
 */
async function checkSession(): Promise<{ valid: boolean; reason?: string }> {
  try {
    const { checkSession } = await import('./session-check');
    const result = await checkSession();
    
    if (result.status === 'SESSION_OK') {
      return { valid: true };
    }
    
    // Check for consent wall or challenge
    const diagnostics = result.diagnostics;
    if (diagnostics?.hasConsentWall) {
      return { valid: false, reason: 'CONSENT_WALL' };
    }
    if (diagnostics?.hasChallenge) {
      return { valid: false, reason: 'CHALLENGE' };
    }
    
    return { valid: false, reason: result.reason || 'SESSION_EXPIRED' };
  } catch (err: any) {
    return { valid: false, reason: `Session check error: ${err.message}` };
  }
}

/**
 * Run posting queue pass
 */
async function runPostingQueue(): Promise<{ attempts_started: number; ready: number; selected: number }> {
  try {
    const { processPostingQueue } = await import('../../src/jobs/postingQueue');
    const result = await processPostingQueue();
    return {
      attempts_started: result.attempts_started,
      ready: result.ready_candidates,
      selected: result.selected_candidates
    };
  } catch (err: any) {
    log(`❌ Posting queue error: ${err.message}`);
    throw err;
  }
}

/**
 * Run reply queue pass
 */
async function runReplyQueue(): Promise<void> {
  try {
    const { replySystemV2Job } = await import('../../src/jobs/replySystemV2/main');
    await replySystemV2Job();
  } catch (err: any) {
    log(`❌ Reply queue error: ${err.message}`);
    throw err;
  }
}

/**
 * Add jitter to interval (±15 seconds)
 */
function getJitteredInterval(): number {
  const jitter = (Math.random() * 2 - 1) * JITTER_MS; // -15s to +15s
  return TICK_INTERVAL_MS + jitter;
}

/**
 * Main daemon loop
 */
async function main(): Promise<void> {
  log('🚀 Executor daemon starting...');
  log(`   EXECUTION_MODE=${process.env.EXECUTION_MODE}`);
  log(`   RUNNER_MODE=${process.env.RUNNER_MODE}`);
  log(`   RUNNER_BROWSER=${process.env.RUNNER_BROWSER}`);
  log(`   RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR}`);
  log(`   CDP_PORT=${CDP_PORT}`);
  log(`   Tick interval: ${TICK_INTERVAL_MS / 1000}s ± ${JITTER_MS / 1000}s`);
  
  let consecutiveFailures = 0;
  
  while (true) {
    try {
      const tickStart = Date.now();
      log(`🔄 Executor tick start`);
      
      // Check CDP first
      const cdpReachable = await checkCDP();
      if (!cdpReachable) {
        log(`❌ CDP not reachable on port ${CDP_PORT} - backing off ${BACKOFF_MINUTES} minutes`);
        consecutiveFailures++;
        await sleep(BACKOFF_MINUTES * 60 * 1000);
        continue;
      }
      
      // Check session
      const sessionCheck = await checkSession();
      if (!sessionCheck.valid) {
        log(`❌ Session invalid: ${sessionCheck.reason} - backing off ${BACKOFF_MINUTES} minutes`);
        consecutiveFailures++;
        await sleep(BACKOFF_MINUTES * 60 * 1000);
        continue;
      }
      
      // Reset failure counter on success
      if (consecutiveFailures > 0) {
        log(`✅ Recovered after ${consecutiveFailures} failures`);
        consecutiveFailures = 0;
      }
      
      // Run posting queue
      log(`📮 Executor tick: Posting queue start`);
      try {
        const postingResult = await runPostingQueue();
        log(`📮 Executor tick: Posting queue complete - ready=${postingResult.ready} selected=${postingResult.selected} attempts_started=${postingResult.attempts_started}`);
        
        if (postingResult.attempts_started === 0) {
          log(`⚠️  Posting queue: attempts_started=0 (may be blocked or queue empty)`);
        }
      } catch (err: any) {
        log(`❌ Posting queue failed: ${err.message}`);
        consecutiveFailures++;
      }
      
      // Run reply queue
      log(`💬 Executor tick: Reply queue start`);
      try {
        await runReplyQueue();
        log(`💬 Executor tick: Reply queue complete`);
      } catch (err: any) {
        log(`❌ Reply queue failed: ${err.message}`);
        consecutiveFailures++;
      }
      
      const tickDuration = Date.now() - tickStart;
      log(`✅ Executor tick complete (took ${(tickDuration / 1000).toFixed(1)}s)`);
      
      // Sleep with jitter
      const sleepMs = getJitteredInterval();
      log(`💤 Sleeping ${(sleepMs / 1000).toFixed(1)}s until next tick...`);
      await sleep(sleepMs);
      
    } catch (err: any) {
      log(`❌ Daemon loop error: ${err.message}`);
      if (err.stack) {
        log(`   Stack: ${err.stack.split('\n').slice(0, 5).join('\n')}`);
      }
      consecutiveFailures++;
      await sleep(BACKOFF_MINUTES * 60 * 1000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('🛑 Received SIGTERM - shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('🛑 Received SIGINT - shutting down gracefully...');
  process.exit(0);
});

main().catch((err) => {
  log(`❌ Fatal error: ${err.message}`);
  if (err.stack) {
    log(`   Stack: ${err.stack}`);
  }
  process.exit(1);
});
