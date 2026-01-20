#!/usr/bin/env tsx
/**
 * 🚀 RUNNER ONE-SHOT
 * 
 * Orchestrates the full Mac Runner workflow in a single run:
 * 1. Auto-sync env from Railway
 * 2. Reset Chrome CDP
 * 3. Session check
 * 4. Harvest opportunities
 * 5. Evaluate opportunities → candidate_evaluations
 * 6. Refresh candidate queue
 * 7. Schedule decisions
 * 8. Process posting queue
 * 9. Verify POST_SUCCESS and print summary
 * 
 * Usage:
 *   pnpm run runner:one-shot
 */

import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { enforceCDPMode } from './enforce-cdp';

const exec = promisify(execSync);

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

// Enforce CDP mode
enforceCDPMode();

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
 * Extract POST_SUCCESS tweet URL from database
 */
async function extractTweetUrl(runStartedAt?: string): Promise<string | null> {
  try {
    // Load env
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envLocalPath)) {
      require('dotenv').config({ path: envLocalPath });
    } else if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
    
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    // Get most recent POST_SUCCESS (filtered by run start time if provided)
    const cutoffTime = runStartedAt || new Date(Date.now() - 240 * 60 * 1000).toISOString();
    const { data: successEvent } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'POST_SUCCESS')
      .gte('created_at', cutoffTime)
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
 * Main workflow
 */
async function main() {
  // Capture run start time for filtering counts
  const runStartedAt = new Date().toISOString();
  
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 RUNNER ONE-SHOT WORKFLOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Step 1: Auto-sync env from Railway
  console.log('STEP 1: Auto-syncing env from Railway...');
  await execLive('pnpm run runner:autosync', 'Auto-sync env');
  
  // Step 2: Reset Chrome CDP
  console.log('\nSTEP 2: Resetting Chrome CDP...');
  await execLive('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' tsx scripts/runner/reset-chrome.ts', 'Reset Chrome');
  
  // Step 3: Session check
  console.log('\nSTEP 3: Checking session...');
  const sessionResult = await execLive('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:session', 'Session check');
  
  if (sessionResult.exitCode !== 0 || sessionResult.output.includes('SESSION_EXPIRED')) {
    console.error('\n❌ SESSION_EXPIRED - Login required');
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           🔐 LOGIN REQUIRED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('\nPlease complete login/2FA in Chrome until you are on https://x.com/home');
    console.error('Then rerun:');
    console.error('  HARVEST_IGNORE_STATE=true ONE_SHOT_FRESH_ONLY=true pnpm run runner:one-shot');
    console.error('');
    
    // Try to run login helper
    console.log('Running login helper...');
    await execLive('pnpm run runner:login', 'Login helper');
    console.error('\n⚠️  Please complete login in Chrome, then rerun the command above\n');
    process.exit(2);
  }
  
  console.log('✅ Session OK - proceeding with workflow\n');
  
  // Step 4: Harvest opportunities (default mode is curated_profile_posts) - 90s timeout
  // Use HARVEST_IGNORE_STATE=true to ignore harvest_state.json for this run
  console.log('\nSTEP 4: Harvesting opportunities...');
  let opportunitiesInserted = 0;
  try {
    const harvestOutput = execSync(
      'HARVEST_MODE=curated_profile_posts HARVEST_IGNORE_STATE=true RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm exec tsx scripts/runner/harvest-curated.ts',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 } // 120s timeout (harvest can be slow, ~110s observed)
    );
    
    const insertMatch = harvestOutput.match(/Inserted:\s*(\d+)/);
    opportunitiesInserted = insertMatch ? parseInt(insertMatch[1], 10) : 0;
    console.log(`✅ Harvest complete: ${opportunitiesInserted} opportunities inserted`);
    console.log(harvestOutput);
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Harvest TIMED OUT after 120s - step hung at harvest`);
      process.exit(1);
    }
    console.error(`⚠️  Harvest failed: ${error.message}`);
  }
  
  // Step 5: Evaluate opportunities → candidate_evaluations (handled by scheduler)
  console.log('\nSTEP 5: Evaluation will be handled by scheduler...');
  let evaluated = 0;
  let passed = 0;
  
  // Step 5a: Cleanup stale candidates from queue
  console.log('\nSTEP 5a: Cleaning up candidate queue...');
  try {
    const cleanupOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' pnpm exec tsx scripts/runner/cleanup-candidate-queue.ts',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 30000 } // 30s timeout
    );
    console.log(cleanupOutput);
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Cleanup TIMED OUT after 30s - step hung at cleanup`);
      process.exit(1);
    }
    console.error(`⚠️  Cleanup failed: ${error.message}`);
  }
  
  // Step 5b: Refresh candidate queue (evaluations → queue) - 30s timeout
  console.log('\nSTEP 5b: Refreshing candidate queue...');
  let candidatesQueued = 0;
  try {
    // Load env before import
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envLocalPath)) {
      require('dotenv').config({ path: envLocalPath });
    } else if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
    
    const queueStartTime = Date.now();
    const { refreshCandidateQueue } = await import('../../src/jobs/replySystemV2/queueManager');
    const queueResult = await refreshCandidateQueue();
    const queueDuration = Date.now() - queueStartTime;
    
    if (queueDuration > 30000) {
      console.error(`❌ Queue refresh TIMED OUT after ${queueDuration}ms - step hung at queue refresh`);
      process.exit(1);
    }
    
    candidatesQueued = queueResult.queued || 0;
    console.log(`✅ Queue refresh complete: ${candidatesQueued} candidates queued`);
  } catch (error: any) {
    console.error(`⚠️  Queue refresh failed: ${error.message}`);
  }
  
  // Step 6: Schedule and create decisions - 60s timeout
  console.log('\nSTEP 6: Scheduling decisions...');
  let candidatesProcessed = 0;
  let decisionsCreated = 0;
  let gateReasons: Record<string, number> = {};
  try {
    // Pass runStartedAt to scheduler so it prefers fresh candidates
    const scheduleOutput = execSync(
      `RUN_STARTED_AT=${runStartedAt} RUNNER_MODE=true RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR} RUNNER_BROWSER=cdp pnpm run runner:schedule-once`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 } // 60s timeout
    );
    
    const candidatesMatch = scheduleOutput.match(/Candidates fetched:\s*(\d+)/);
    candidatesProcessed = candidatesMatch ? parseInt(candidatesMatch[1], 10) : 0;
    
    const decisionsMatch = scheduleOutput.match(/Decisions created:\s*(\d+)/);
    decisionsCreated = decisionsMatch ? parseInt(decisionsMatch[1], 10) : 0;
    
    // Extract gate reasons from scheduler output
    const gateReasonLines = scheduleOutput.split('\n').filter(line => 
      line.includes('🚫') || line.includes('BLOCKED') || line.includes('Skipped')
    );
    gateReasonLines.forEach(line => {
      const match = line.match(/(NON_HEALTH_TOPIC|CONSENT_WALL|ANCESTRY|TARGET_QUALITY|queue_empty|RUNNER_MODE_NOT_SET)/);
      if (match) {
        gateReasons[match[1]] = (gateReasons[match[1]] || 0) + 1;
      }
    });
    
    console.log(`✅ Schedule complete: ${candidatesProcessed} candidates processed, ${decisionsCreated} decisions created`);
    console.log(scheduleOutput);
    
    if (Object.keys(gateReasons).length > 0) {
      console.log('\nGate reasons from scheduler:');
      Object.entries(gateReasons).forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
    }
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Schedule TIMED OUT after 60s - step hung at schedule`);
      process.exit(1);
    }
    console.error(`⚠️  Schedule failed: ${error.message}`);
  }
  
  // Step 7: Process posting queue - 60s timeout
  console.log('\nSTEP 7: Processing posting queue...');
  try {
    const postOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:once',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 } // 60s timeout
    );
    console.log(postOutput);
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Post queue TIMED OUT after 60s - step hung at post queue`);
      process.exit(1);
    }
    console.error(`⚠️  Post queue failed: ${error.message}`);
  }
  
  // Step 8: Verify POST_SUCCESS
  console.log('\nSTEP 8: Verifying POST_SUCCESS events...');
  await execLive('pnpm exec tsx scripts/verify-post-success.ts --minutes=240', 'Verify POST_SUCCESS');
  
  // Load env before DB import
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
  } else if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  
  // Get final counts from DB (filtered by run start time)
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  const { count: queuedDecisions } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gte('created_at', runStartedAt);
  
  const { data: recentDenies } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .eq('decision', 'DENY')
    .gte('created_at', runStartedAt);
  
  const denyCounts: Record<string, number> = {};
  recentDenies?.forEach(d => {
    const code = d.deny_reason_code || 'NO_CODE';
    denyCounts[code] = (denyCounts[code] || 0) + 1;
  });
  
  const consentWallCount = denyCounts['CONSENT_WALL'] || 0;
  
  // Get candidate queue count
  const { count: candidatesQueuedCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString())
    .gte('created_at', runStartedAt);
  
  // Get POST_SUCCESS count (filtered by run start time)
  const { count: postSuccessCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', runStartedAt);
  
  // Extract tweet URL from database (filtered by run start time)
  const tweetUrl = await extractTweetUrl(runStartedAt);
  
  // Check ONE_SHOT_FRESH_ONLY flag
  const freshOnly = process.env.ONE_SHOT_FRESH_ONLY === 'true';
  if (freshOnly && opportunitiesInserted === 0 && (candidatesQueuedCount || 0) === 0) {
    console.error('\n❌ ONE_SHOT_FRESH_ONLY=true: FAIL-CLOSED');
    console.error(`   Opportunities inserted: ${opportunitiesInserted}`);
    console.error(`   Candidates queued after ${runStartedAt}: ${candidatesQueuedCount || 0}`);
    console.error('   Pipeline ran but did nothing - this indicates a systemic issue');
    process.exit(1);
  }
  
  // Final summary
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 FINAL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  console.log(`Run started at: ${runStartedAt}`);
  console.log(`Opportunities inserted: ${opportunitiesInserted}`);
  console.log(`Candidates queued (after run start): ${candidatesQueuedCount || 0}`);
  console.log(`Candidates processed: ${candidatesProcessed}`);
  console.log(`Decisions created: ${decisionsCreated}`);
  console.log(`Queued decisions: ${queuedDecisions || 0}`);
  console.log(`POST_SUCCESS count: ${postSuccessCount || 0}`);
  console.log(`CONSENT_WALL count: ${consentWallCount}`);
  
  // Print example inserted opportunities
  if (opportunitiesInserted > 0) {
    const { data: insertedOpps } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_tweet_url, target_tweet_content, target_username')
      .gte('created_at', runStartedAt)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (insertedOpps && insertedOpps.length > 0) {
      console.log('\nExample inserted opportunities:');
      insertedOpps.slice(0, 2).forEach((opp, i) => {
        const contentPreview = opp.target_tweet_content ? opp.target_tweet_content.substring(0, 120) : 'N/A';
        console.log(`   ${i + 1}. ${opp.target_tweet_url || `https://x.com/i/status/${opp.target_tweet_id}`}`);
        console.log(`      Author: @${opp.target_username || 'unknown'}`);
        console.log(`      Text: ${contentPreview}${opp.target_tweet_content && opp.target_tweet_content.length > 120 ? '...' : ''}`);
      });
    }
  }
  
  // Print top skip reasons
  const topDenies = Object.entries(denyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (topDenies.length > 0) {
    console.log('\nTop skip reasons:');
    topDenies.forEach(([code, count], i) => {
      console.log(`   ${i + 1}. ${code}: ${count}`);
    });
  }
  
  // Get top 10 denied tweets with URLs and details
  const { data: deniedTweets } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id, deny_reason_code, deny_reason_detail, created_at')
    .eq('decision', 'DENY')
    .gte('created_at', runStartedAt)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (deniedTweets && deniedTweets.length > 0) {
    console.log('\nTop 10 denied tweets from this run:');
    deniedTweets.forEach((d, i) => {
      const url = `https://x.com/i/status/${d.target_tweet_id}`;
      console.log(`   ${i + 1}. ${url}`);
      console.log(`      Deny reason: ${d.deny_reason_code || 'NO_CODE'}`);
      if (d.deny_reason_detail) {
        const detail = typeof d.deny_reason_detail === 'string' ? JSON.parse(d.deny_reason_detail) : d.deny_reason_detail;
        if (detail.isCurated !== undefined) console.log(`      isCurated: ${detail.isCurated}`);
        if (detail.author_handle_norm) console.log(`      Handle: @${detail.author_handle_norm}`);
        if (detail.extracted_text_len) console.log(`      Text length: ${detail.extracted_text_len}`);
        if (detail.first_120_chars) console.log(`      Preview: ${detail.first_120_chars.substring(0, 80)}...`);
      }
    });
  }
  
  if (tweetUrl) {
    console.log(`\n✅ POST_SUCCESS: ${tweetUrl}`);
  } else {
    console.log('\n⚠️  No POST_SUCCESS found');
    
    // Identify where pipeline died
    let pipelineStage = 'unknown';
    if (opportunitiesInserted === 0) {
      pipelineStage = 'harvest';
    } else if ((candidatesQueuedCount || 0) === 0) {
      pipelineStage = 'evaluate/queue';
    } else if (decisionsCreated === 0) {
      pipelineStage = 'schedule';
    } else if ((queuedDecisions || 0) === 0) {
      pipelineStage = 'decisions';
    } else if (postSuccessCount === 0) {
      pipelineStage = 'post';
    }
    
    console.log(`\nPipeline stopped at: ${pipelineStage}`);
    
    // Print top 5 skip/deny reasons
    const allReasons: Record<string, number> = { ...denyCounts };
    
    // Add skip reasons from harvest if available (would need to parse from harvest output)
    // For now, just show deny reasons from scheduler
    
    const top5Reasons = Object.entries(allReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (top5Reasons.length > 0) {
      console.log('\nTop skip/deny reasons:');
      top5Reasons.forEach(([reason, count], i) => {
        console.log(`   ${i + 1}. ${reason}: ${count}`);
      });
    }
    
    // Print debug artifact paths
    const consentDebugDir = path.join(RUNNER_PROFILE_DIR, 'consent_debug');
    const harvestDebugDir = path.join(RUNNER_PROFILE_DIR, 'harvest_debug');
    const debugPaths: string[] = [];
    
    if (fs.existsSync(consentDebugDir)) {
      const artifacts = fs.readdirSync(consentDebugDir).filter(f => f.includes('consent_wall_'));
      artifacts.slice(0, 3).forEach(artifact => {
        debugPaths.push(path.join(consentDebugDir, artifact));
      });
    }
    
    if (fs.existsSync(harvestDebugDir)) {
      const artifacts = fs.readdirSync(harvestDebugDir);
      artifacts.slice(0, 3).forEach(artifact => {
        debugPaths.push(path.join(harvestDebugDir, artifact));
      });
    }
    
    if (debugPaths.length > 0) {
      console.log('\nDebug artifacts:');
      debugPaths.forEach(path => {
        console.log(`   ${path}`);
      });
    }
  }
  
  console.log('');
  console.log('✅ One-shot workflow complete');
  console.log('');
}

main().catch((error) => {
  console.error('❌ One-shot workflow failed:', error);
  process.exit(1);
});
