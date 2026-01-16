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
  
  // Set CDP mode for login
  process.env.RUNNER_BROWSER = 'cdp';
  const result = await execLive('RUNNER_BROWSER=cdp pnpm run runner:login', 'Interactive login');
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

/**
 * End-to-end go-live flow: autosync -> reset-chrome -> session-check -> harvest -> schedule -> post -> verify
 */
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
  
  // Step 2: Reset Chrome CDP
  console.log('\nSTEP 2: Resetting Chrome CDP...');
  const resetResult = await execLive('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' tsx scripts/runner/reset-chrome.ts', 'Reset Chrome CDP');
  if (!resetResult.success) {
    console.error('\n❌ Failed to reset Chrome CDP');
    process.exit(1);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for Chrome to start
  
  // Step 3: Check session
  console.log('\nSTEP 3: Checking X.com session...');
  let sessionStatus = await checkSessionStatus();
  
  // Step 4: Handle expired session
  if (sessionStatus === 'SESSION_EXPIRED') {
    console.log('\n⚠️  Session expired or consent/challenge detected');
    const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
    if (fs.existsSync(screenshotPath)) {
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
    }
    
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⚠️  LOGIN REQUIRED NOW');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Chrome is open. Please:');
    console.log('   1. Complete any consent/challenge prompts');
    console.log('   2. Log in to X.com if needed');
    console.log('   3. Complete 2FA if prompted');
    console.log('   4. Verify you see your Home timeline (left nav visible)');
    console.log('   5. Press Enter in this terminal when done');
    console.log('');
    
    const loginSuccess = await runLogin();
    if (!loginSuccess) {
      console.error('\n❌ Login failed');
      process.exit(1);
    }
    
    // Re-check session after login (with retries)
    console.log('\nSTEP 3b: Re-checking session after login...');
    let retries = 3;
    while (retries > 0 && sessionStatus === 'SESSION_EXPIRED') {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s before re-check
      console.log(`   Attempt ${4 - retries}/3...`);
      sessionStatus = await checkSessionStatus();
      retries--;
    }
    
    if (sessionStatus === 'SESSION_EXPIRED') {
      console.error('\n❌ LOGIN FAILED / STILL BLOCKED');
      console.error(`   Screenshot: ${screenshotPath}`);
      console.error('   HTML: ' + path.join(RUNNER_PROFILE_DIR, 'session_check.html'));
      console.error('   Please check the artifacts and try again');
      process.exit(1);
    }
  }
  
  console.log('✅ Session OK - proceeding with workflow\n');
  
  // Step 4: Harvest opportunities
  console.log('\nSTEP 4: Harvesting opportunities...');
  let opportunitiesInserted = 0;
  try {
    const harvestOutput = execSync(
      'HARVEST_MODE=search_queries RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:harvest-search',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 }
    );
    
    const insertMatch = harvestOutput.match(/Inserted:\s*(\d+)/);
    opportunitiesInserted = insertMatch ? parseInt(insertMatch[1], 10) : 0;
    console.log(`✅ Harvest complete: ${opportunitiesInserted} opportunities inserted`);
    console.log(harvestOutput);
  } catch (error: any) {
    console.error(`⚠️  Harvest failed: ${error.message}`);
  }
  
  // Step 5: Schedule and create decisions
  console.log('\nSTEP 5: Scheduling decisions...');
  let candidatesProcessed = 0;
  let decisionsCreated = 0;
  try {
    const scheduleOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:schedule-once',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 }
    );
    
    const candidatesMatch = scheduleOutput.match(/Candidates fetched:\s*(\d+)/);
    candidatesProcessed = candidatesMatch ? parseInt(candidatesMatch[1], 10) : 0;
    
    const decisionsMatch = scheduleOutput.match(/Decisions created:\s*(\d+)/);
    decisionsCreated = decisionsMatch ? parseInt(decisionsMatch[1], 10) : 0;
    
    console.log(`✅ Schedule complete: ${candidatesProcessed} candidates processed, ${decisionsCreated} decisions created`);
    console.log(scheduleOutput);
  } catch (error: any) {
    console.error(`⚠️  Schedule failed: ${error.message}`);
  }
  
  // Step 6: Process posting queue
  console.log('\nSTEP 6: Processing posting queue...');
  const postResult = await execLive('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:once', 'Process posting queue');
  // Non-fatal if no candidates
  
  // Step 7: Verify POST_SUCCESS
  console.log('\nSTEP 7: Verifying POST_SUCCESS events...');
  const verifyResult = await execLive('pnpm exec tsx scripts/verify-post-success.ts --minutes=240', 'Verify POST_SUCCESS');
  
  // Load env before DB import
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
  }
  
  // Get final counts from DB
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  const { count: queuedDecisions } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  
  const { data: recentDenies } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .eq('decision', 'DENY')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  
  const denyCounts: Record<string, number> = {};
  recentDenies?.forEach(d => {
    const code = d.deny_reason_code || 'NO_CODE';
    denyCounts[code] = (denyCounts[code] || 0) + 1;
  });
  
  const consentWallCount = denyCounts['CONSENT_WALL'] || 0;
  
  // Extract tweet URL from database
  const tweetUrl = await extractTweetUrl();
  
  // Final summary
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 FINAL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  console.log(`Opportunities inserted: ${opportunitiesInserted}`);
  console.log(`Candidates processed: ${candidatesProcessed}`);
  console.log(`Decisions created: ${decisionsCreated}`);
  console.log(`Queued decisions: ${queuedDecisions || 0}`);
  console.log(`POST_SUCCESS count: ${tweetUrl ? 1 : 0}`);
  console.log(`CONSENT_WALL count: ${consentWallCount}`);
  
  if (tweetUrl) {
    console.log(`\n✅ POST_SUCCESS: ${tweetUrl}`);
  } else {
    console.log('\n⚠️  No POST_SUCCESS found');
    
    // Print top 3 deny reasons
    const topDenies = Object.entries(denyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topDenies.length > 0) {
      console.log('\nTop 3 deny reasons:');
      topDenies.forEach(([code, count], i) => {
        console.log(`   ${i + 1}. ${code}: ${count}`);
      });
    }
    
    // Print debug artifact paths
    const consentDebugDir = path.join(RUNNER_PROFILE_DIR, 'consent_debug');
    if (fs.existsSync(consentDebugDir)) {
      const artifacts = fs.readdirSync(consentDebugDir).filter(f => f.includes('consent_wall_'));
      if (artifacts.length > 0) {
        console.log('\nDebug artifacts:');
        artifacts.slice(0, 3).forEach(artifact => {
          console.log(`   ${path.join(consentDebugDir, artifact)}`);
        });
      }
    }
  }
  
  console.log('');
  console.log('✅ Go-live workflow complete');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Go-live workflow failed:', error);
  process.exit(1);
});
