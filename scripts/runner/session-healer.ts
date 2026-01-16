#!/usr/bin/env tsx
/**
 * 🔧 SESSION HEALER
 * Tracks consecutive CONSENT_WALL events and triggers auto-login recovery
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

const CONSENT_WALL_THRESHOLD = 3;
const CONSENT_WALL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BACKOFF_MS = 30 * 60 * 1000; // 30 minutes

interface ConsentWallEvent {
  timestamp: number;
  mode: string;
  url: string;
  debug?: any;
}

let consentWallHistory: ConsentWallEvent[] = [];

/**
 * Record a CONSENT_WALL event and check if recovery is needed
 */
export async function recordConsentWallEvent(mode: string, url: string, debug?: any): Promise<{
  shouldRecover: boolean;
  consecutiveCount: number;
}> {
  const now = Date.now();
  
  // Add event
  consentWallHistory.push({
    timestamp: now,
    mode,
    url,
    debug,
  });
  
  // Filter to last 10 minutes
  consentWallHistory = consentWallHistory.filter(e => now - e.timestamp < CONSENT_WALL_WINDOW_MS);
  
  // Check if we have 3+ consecutive CONSENT_WALL events
  const consecutiveCount = consentWallHistory.length;
  const shouldRecover = consecutiveCount >= CONSENT_WALL_THRESHOLD;
  
  if (shouldRecover) {
    console.log(`[SESSION_HEALER] ⚠️  ${consecutiveCount} consecutive CONSENT_WALL events detected - triggering recovery`);
    
    // Emit RUNNER_ALERT system event
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    await supabase.from('system_events').insert({
      event_type: 'RUNNER_ALERT',
      severity: 'warning',
      message: `Session recovery triggered: ${consecutiveCount} consecutive CONSENT_WALL events`,
      event_data: {
        consecutive_count: consecutiveCount,
        events: consentWallHistory,
        recovery_action: 'auto_login',
      },
      created_at: new Date().toISOString(),
    });
  }
  
  return { shouldRecover, consecutiveCount };
}

/**
 * Trigger recovery: open login flow and wait for manual completion
 */
export async function triggerRecovery(): Promise<boolean> {
  console.log('[SESSION_HEALER] 🔧 Triggering session recovery...');
  
  try {
    // Use existing login flow
    const { execSync } = require('child_process');
    
    console.log('[SESSION_HEALER] 📱 Opening X.com/home in Chrome - please complete login/2FA if prompted');
    console.log('[SESSION_HEALER] ⏸️  Waiting for you to complete login, then press Enter...');
    
    // Open Chrome to home page
    const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
    const context = await launchRunnerPersistent(false); // headed
    const page = await context.newPage();
    
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    
    // Wait for user input
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    await new Promise<void>((resolve) => {
      rl.question('Press Enter after completing login/2FA in Chrome... ', () => {
        rl.close();
        resolve();
      });
    });
    
    await page.close();
    await context.close();
    
    // Re-run session check
    console.log('[SESSION_HEALER] 🔍 Re-checking session...');
    const sessionOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm exec tsx scripts/runner/session-check.ts',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    if (sessionOutput.includes('SESSION_OK')) {
      console.log('[SESSION_HEALER] ✅ Session recovery successful');
      consentWallHistory = []; // Clear history on success
      return true;
    } else {
      console.log('[SESSION_HEALER] ❌ Session still expired after recovery');
      return false;
    }
  } catch (error: any) {
    console.error(`[SESSION_HEALER] ❌ Recovery failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if we're in backoff period
 */
export function isInBackoff(): boolean {
  const backoffFile = path.join(process.env.RUNNER_PROFILE_DIR || '.runner-profile', 'session_backoff.json');
  
  if (!fs.existsSync(backoffFile)) {
    return false;
  }
  
  try {
    const backoffData = JSON.parse(fs.readFileSync(backoffFile, 'utf-8'));
    const backoffUntil = backoffData.backoff_until || 0;
    
    if (Date.now() < backoffUntil) {
      const remainingMinutes = Math.ceil((backoffUntil - Date.now()) / 60000);
      console.log(`[SESSION_HEALER] ⏸️  In backoff period (${remainingMinutes}m remaining)`);
      return true;
    }
    
    // Backoff expired, remove file
    fs.unlinkSync(backoffFile);
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Start backoff period
 */
export function startBackoff(): void {
  const backoffFile = path.join(process.env.RUNNER_PROFILE_DIR || '.runner-profile', 'session_backoff.json');
  const backoffUntil = Date.now() + BACKOFF_MS;
  
  fs.writeFileSync(backoffFile, JSON.stringify({
    backoff_until: backoffUntil,
    started_at: Date.now(),
  }));
  
  console.log(`[SESSION_HEALER] ⏸️  Starting backoff period (30 minutes)`);
}
