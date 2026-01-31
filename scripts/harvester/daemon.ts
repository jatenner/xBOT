#!/usr/bin/env tsx
/**
 * 🌾 MAC HARVESTER DAEMON - Always-On Root Opportunity Harvesting
 * 
 * Long-running daemon that:
 * - Runs harvester every 10-15 minutes
 * - Loads TWITTER_SESSION_B64 from .env (same as executor)
 * - Writes logs to .runner-profile/harvester.log
 * - Heartbeat logging every cycle
 * - Exponential backoff on failures
 * - Single-instance lock
 * - STOP switch (exits within 10s)
 * 
 * Usage:
 *   HARVESTING_ENABLED=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run harvester:daemon
 */

import * as fs from 'fs';
import * as path from 'path';
import { appendFileSync } from 'fs';

// Load .env.local first, then .env (same pattern as executor)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

let envFileLoaded: string | null = null;

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  envFileLoaded = envLocalPath;
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  envFileLoaded = envPath;
}

if (!envFileLoaded) {
  console.error('❌ No .env or .env.local file found');
  process.exit(1);
}

console.log(`[HARVESTER_DAEMON] ✅ Loaded env from: ${envFileLoaded}`);

// Verify TWITTER_SESSION_B64 is present
if (!process.env.TWITTER_SESSION_B64) {
  console.error('❌ TWITTER_SESSION_B64 not found in environment');
  process.exit(1);
}

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const LOG_FILE = path.join(RUNNER_PROFILE_DIR, 'harvester.log');
const LOCK_FILE = path.join(RUNNER_PROFILE_DIR, 'harvester.lock');
const STOP_FILE = path.join(RUNNER_PROFILE_DIR, 'harvester.stop');

// Ensure log directory exists
if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
  fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
}

// Single-instance lock
if (fs.existsSync(LOCK_FILE)) {
  const lockPid = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
  try {
    // Check if process is still running
    process.kill(parseInt(lockPid, 10), 0);
    console.error(`❌ Harvester daemon already running (PID: ${lockPid})`);
    process.exit(1);
  } catch {
    // Process doesn't exist, remove stale lock
    fs.unlinkSync(LOCK_FILE);
  }
}

// Write lock file
fs.writeFileSync(LOCK_FILE, String(process.pid));

// Cleanup on exit
process.on('exit', () => {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
});

process.on('SIGINT', () => {
  log('[HARVESTER_DAEMON] SIGINT received, exiting...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('[HARVESTER_DAEMON] SIGTERM received, exiting...');
  process.exit(0);
});

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

const HARVEST_INTERVAL_MS = parseInt(process.env.HARVESTER_INTERVAL_MIN || '12', 10) * 60 * 1000; // Default 12 minutes
const JITTER_MS = 2 * 60 * 1000; // ±2 minutes jitter
const BACKOFF_MINUTES = 5; // Back off 5 minutes on failure
const MAX_BACKOFF_MINUTES = 30; // Max backoff 30 minutes

let consecutiveFailures = 0;
let nextHarvestTime = Date.now();

/**
 * Check if STOP file exists
 */
function shouldStop(): boolean {
  return fs.existsSync(STOP_FILE);
}

/**
 * Run one harvest cycle
 */
async function runHarvestCycle(): Promise<boolean> {
  try {
    log(`[HARVESTER_DAEMON] 🔄 Starting harvest cycle...`);
    
    // Ensure HARVESTING_ENABLED is set
    process.env.HARVESTING_ENABLED = 'true';
    
    const { replyOpportunityHarvester } = await import('../../src/jobs/replyOpportunityHarvester');
    
    await replyOpportunityHarvester();
    
    consecutiveFailures = 0;
    log(`[HARVESTER_DAEMON] ✅ Harvest cycle complete`);
    return true;
  } catch (error: any) {
    consecutiveFailures++;
    log(`[HARVESTER_DAEMON] ❌ Harvest cycle failed: ${error.message}`);
    if (error.stack) {
      log(`[HARVESTER_DAEMON] Stack: ${error.stack}`);
    }
    return false;
  }
}

/**
 * Main daemon loop
 */
async function main(): Promise<void> {
  log(`[HARVESTER_DAEMON] 🚀 Starting harvester daemon`);
  log(`[HARVESTER_DAEMON] 📊 Config: interval=${HARVEST_INTERVAL_MS / 1000 / 60}min, log=${LOG_FILE}`);
  log(`[HARVESTER_DAEMON] 🔐 TWITTER_SESSION_B64: ${process.env.TWITTER_SESSION_B64 ? 'present' : 'missing'}`);
  
  // Run initial harvest immediately
  await runHarvestCycle();
  
  // Main loop
  while (true) {
    if (shouldStop()) {
      log(`[HARVESTER_DAEMON] 🛑 STOP file detected, exiting...`);
      break;
    }
    
    // Calculate next harvest time with jitter
    const jitter = Math.floor(Math.random() * JITTER_MS * 2) - JITTER_MS;
    const backoffMs = Math.min(consecutiveFailures * BACKOFF_MINUTES * 60 * 1000, MAX_BACKOFF_MINUTES * 60 * 1000);
    nextHarvestTime = Date.now() + HARVEST_INTERVAL_MS + jitter + backoffMs;
    
    const waitSeconds = Math.floor((nextHarvestTime - Date.now()) / 1000);
    log(`[HARVESTER_DAEMON] 💓 Heartbeat: next harvest in ${waitSeconds}s (failures: ${consecutiveFailures})`);
    
    // Wait until next harvest time (check STOP file every 10s)
    while (Date.now() < nextHarvestTime) {
      if (shouldStop()) {
        log(`[HARVESTER_DAEMON] 🛑 STOP file detected, exiting...`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10s
    }
    
    // Run harvest cycle
    await runHarvestCycle();
  }
}

main().catch((error: any) => {
  log(`[HARVESTER_DAEMON] 💥 Fatal error: ${error.message}`);
  if (error.stack) {
    log(`[HARVESTER_DAEMON] Stack: ${error.stack}`);
  }
  process.exit(1);
});
