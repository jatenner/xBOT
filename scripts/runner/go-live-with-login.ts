#!/usr/bin/env tsx
/**
 * 🚀 GO-LIVE WITH LOGIN WORKFLOW
 * 
 * Orchestrates the full Mac Runner workflow with automatic login handling:
 * 1. Auto-sync env from Railway
 * 2. Check session
 * 3. If expired: launch interactive login, re-check
 * 4. Harvest opportunities
 * 5. Process posting queue
 * 6. Verify POST_SUCCESS and print tweet URL
 * 
 * Usage:
 *   pnpm run runner:go-live2
 */

import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const exec = promisify(execSync);

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

interface ExecResult {
  success: boolean;
  output: string;
  exitCode: number;
}

/**
 * Execute command with live output streaming
 */
function execLive(command: string, description: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 ${description}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true,
    });
    
    let output = '';
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output,
        exitCode: code || 0,
      });
    });
    
    child.on('error', (error) => {
      resolve({
        success: false,
        output: error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Check session status by parsing session-check output
 */
async function checkSessionStatus(): Promise<'SESSION_OK' | 'SESSION_EXPIRED'> {
  try {
    const result = await execLive('pnpm exec tsx scripts/runner/session-check.ts', 'Session check');
    
    // Check exit code: 0 = OK, 2 = EXPIRED, 1 = error
    if (result.exitCode === 0) {
      return 'SESSION_OK';
    } else {
      return 'SESSION_EXPIRED';
    }
  } catch (error: any) {
    console.error(`❌ Session check failed: ${error.message}`);
    return 'SESSION_EXPIRED';
  }
}

/**
 * Run interactive login
 */
async function runLogin(): Promise<boolean> {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ⚠️  LOGIN REQUIRED NOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('The browser will open. Please:');
  console.log('   1. Log in to X.com in the browser window');
  console.log('   2. Verify you see your timeline (not login page)');
  console.log('   3. Press Enter in this terminal when done');
  console.log('');
  
  const result = await execLive('pnpm run runner:login', 'Interactive login');
  return result.success;
}

/**
 * Extract POST_SUCCESS tweet URL from verify output or database
 */
async function extractTweetUrl(): Promise<string | null> {
  try {
    // Load env
    const envLocalPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      require('dotenv').config({ path: envLocalPath });
    }
    
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    // Get most recent POST_SUCCESS in last 240 minutes
    const fourHoursAgo = new Date(Date.now() - 240 * 60 * 1000).toISOString();
    const { data: successEvent } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'POST_SUCCESS')
      .gte('created_at', fourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (successEvent?.event_data) {
      const eventData = typeof successEvent.event_data === 'string'
        ? JSON.parse(successEvent.event_data)
        : successEvent.event_data;
      
      const tweetId = eventData?.posted_reply_tweet_id || eventData?.tweet_id;
      if (tweetId) {
        return `https://x.com/i/status/${tweetId}`;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 MAC RUNNER GO-LIVE WITH LOGIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⚠️  IMPORTANT: If Mac sleeps, bot stops. Keep Mac awake.');
  console.log('   Use: caffeinate -d (prevents display sleep)');
  console.log('   Or: System Settings → Energy Saver → Prevent computer from sleeping');
  console.log('');
  
  // Step 1: Auto-sync env
  console.log('STEP 1: Syncing environment from Railway...');
  const syncResult = await execLive('pnpm run runner:autosync', 'Auto-sync environment');
  if (!syncResult.success) {
    console.error('\n❌ Environment sync failed - cannot proceed');
    console.error('   Check Railway CLI is installed and logged in');
    process.exit(1);
  }
  
  // Verify required env vars exist
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envLocalPath)) {
    console.error('\n❌ .env.local not found after sync - cannot proceed');
    process.exit(1);
  }
  
  // Step 2: Check session
  console.log('\nSTEP 2: Checking X.com session...');
  let sessionStatus = await checkSessionStatus();
  
  // Step 3: Handle expired session or consent/challenge
  if (sessionStatus === 'SESSION_EXPIRED') {
    console.log('\n⚠️  Session expired or consent/challenge detected');
    const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
    if (fs.existsSync(screenshotPath)) {
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
      console.log('   Check screenshot to see if it\'s a consent wall, challenge, or login prompt');
    }
    
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⚠️  LOGIN REQUIRED NOW');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('The browser will open. Please:');
    console.log('   1. Complete any consent/challenge prompts');
    console.log('   2. Log in to X.com if needed');
    console.log('   3. Complete 2FA if prompted');
    console.log('   4. Verify you see your timeline (not login page)');
    console.log('   5. Press Enter in this terminal when done');
    console.log('');
    
    const loginSuccess = await runLogin();
    if (!loginSuccess) {
      console.error('\n❌ Login failed');
      process.exit(1);
    }
    
    // Re-check session after login (with retries)
    console.log('\nSTEP 2b: Re-checking session after login...');
    let retries = 3;
    while (retries > 0 && sessionStatus === 'SESSION_EXPIRED') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before re-check
      sessionStatus = await checkSessionStatus();
      retries--;
    }
    
    if (sessionStatus === 'SESSION_EXPIRED') {
      console.error('\n❌ LOGIN FAILED / STILL BLOCKED');
      console.error(`   Screenshot: ${screenshotPath}`);
      console.error('   Please check the screenshot and try again');
      console.error('   If consent wall persists, wait 24h or use different IP');
      process.exit(1);
    }
  }
  
  console.log('✅ Session OK - proceeding with workflow\n');
  
  // Step 4: Harvest opportunities
  console.log('STEP 3: Harvesting opportunities...');
  const harvestResult = await execLive('pnpm run runner:harvest-once', 'Harvest opportunities');
  if (!harvestResult.success && harvestResult.exitCode === 2) {
    // Exit code 2 = session expired during harvest
    console.error('\n❌ Harvest failed due to session expiry');
    process.exit(1);
  }
  
  // Step 5: Process posting queue
  console.log('\nSTEP 4: Processing posting queue...');
  const postResult = await execLive('pnpm run runner:once', 'Process posting queue');
  // Non-fatal if no candidates
  
  // Step 6: Verify POST_SUCCESS
  console.log('\nSTEP 5: Verifying POST_SUCCESS events...');
  const verifyResult = await execLive('pnpm exec tsx scripts/verify-post-success.ts', 'Verify POST_SUCCESS');
  
  // Extract tweet URL from database
  const tweetUrl = await extractTweetUrl();
  
  // Final status
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 FINAL STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  if (tweetUrl) {
    console.log(`✅ POST_SUCCESS: ${tweetUrl}`);
  } else {
    console.log('⚠️  No POST_SUCCESS in last 240 minutes (this can be normal)');
    console.log('   Check POST_FAILED reasons above if expected posts are missing');
  }
  
  console.log('');
  console.log('✅ Go-live workflow complete');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Go-live workflow failed:', error);
  process.exit(1);
});
