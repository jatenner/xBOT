#!/usr/bin/env tsx
/**
 * 🧪 EXECUTOR END-TO-END REPLY PROOF
 * 
 * Seeds ONE reply decision, runs executor daemon, and proves execution.
 * 
 * Usage:
 *   TARGET_TWEET_ID=1234567890123456789 RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:e2e-reply
 *   DRY_RUN=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply  # Seed only, no execution
 * 
 * Requirements:
 *   - TARGET_TWEET_ID: Required, must be valid numeric tweet ID (>= 15 digits)
 *   - Extract tweet ID from URL: https://x.com/username/status/1234567890123456789
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const MAX_WAIT_SECONDS = 300; // 5 minutes max wait

const DRY_RUN = process.env.DRY_RUN === 'true';

// Validate TARGET_TWEET_ID - FAIL FAST if missing or invalid
function validateTargetTweetId(): string {
  const targetTweetId = process.env.TARGET_TWEET_ID;
  
  if (!targetTweetId) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           ❌ FATAL: TARGET_TWEET_ID is required');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('Usage:');
    console.error('  TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply');
    console.error('  DRY_RUN=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply\n');
    console.error('How to extract tweet ID from URL:');
    console.error('  URL: https://x.com/username/status/1234567890123456789');
    console.error('  Extract: 1234567890123456789 (the number after /status/)\n');
    process.exit(1);
  }
  
  // Validate: must be numeric and >= 15 digits (Twitter tweet IDs are 18-20 digits)
  if (!/^\d+$/.test(targetTweetId)) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           ❌ FATAL: TARGET_TWEET_ID must be numeric');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error(`Provided: ${targetTweetId}`);
    console.error('Expected: Numeric string with >= 15 digits\n');
    console.error('How to extract tweet ID from URL:');
    console.error('  URL: https://x.com/username/status/1234567890123456789');
    console.error('  Extract: 1234567890123456789 (the number after /status/)\n');
    process.exit(1);
  }
  
  if (targetTweetId.length < 15) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           ❌ FATAL: TARGET_TWEET_ID must be >= 15 digits');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error(`Provided: ${targetTweetId} (${targetTweetId.length} digits)`);
    console.error('Expected: >= 15 digits\n');
    console.error('How to extract tweet ID from URL:');
    console.error('  URL: https://x.com/username/status/1234567890123456789');
    console.error('  Extract: 1234567890123456789 (the number after /status/)\n');
    process.exit(1);
  }
  
  return targetTweetId;
}

interface E2EReplyProofResult {
  decision_id: string;
  target_tweet_id: string;
  proof_tag: string;
  reply_decision_queued: boolean;
  reply_decision_claimed: boolean;
  reply_attempt_recorded: boolean;
  reply_result_recorded: boolean;
  reply_success_event: boolean;
  reply_failed_event: boolean;
  reply_url?: string;
  executor_safety: {
    windows_opened: number;
    chrome_cdp_processes: number;
    pages_max: number;
  };
  evidence: {
    decision_status?: string;
    attempt_id?: string;
    outcome_id?: string;
    event_ids?: string[];
    log_excerpts?: string[];
    reply_count?: number;
  };
}

async function countVisibleWindows(): Promise<number> {
  try {
    const result = execSync('osascript -e \'tell application "System Events" to count windows of process "Google Chrome"\'', { encoding: 'utf-8' });
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function countChromeCdpProcesses(): Promise<number> {
  try {
    const result = execSync('ps aux | grep "chrome-cdp.ts" | grep -v grep', { encoding: 'utf-8' });
    const lines = result.trim().split('\n').filter(l => l.trim());
    return lines.length;
  } catch {
    return 0;
  }
}

async function getMaxPagesFromTicks(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const startTime = new Date(Date.now() - MAX_WAIT_SECONDS * 1000);
    const { data } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'EXECUTOR_DAEMON_TICK')
      .gte('created_at', startTime.toISOString());
    
    let maxPages = 0;
    for (const row of data || []) {
      const eventData = typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data;
      const pages = eventData.pages || 0;
      if (pages > maxPages) {
        maxPages = pages;
      }
    }
    return maxPages;
  } catch {
    return 0;
  }
}

async function seedReplyDecision(targetTweetId: string, proofTag: string): Promise<string> {
  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  // Safe, short reply text
  const replyContent = "Quick note: sleep quality and sunlight timing matter more than most people think.";
  
  // Required fields for reply decisions
  const targetTweetSnapshot = "This is a test tweet content snapshot for reply proof. It must be at least 20 characters long to pass FINAL_REPLY_GATE.";
  const targetTweetHash = crypto.createHash('sha256').update(targetTweetSnapshot).digest('hex').substring(0, 32);
  
  console.log(`📝 Seeding test reply decision: ${decisionId}`);
  console.log(`   Target tweet ID: ${targetTweetId}`);
  console.log(`   Proof tag: ${proofTag}`);
  
  const { error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      target_tweet_id: targetTweetId,
      status: 'queued',
      scheduled_at: now,
      // Required fields for FINAL_REPLY_GATE (stored in features if columns don't exist)
      quality_score: 0.8,
      predicted_er: 0.5,
      bandit_arm: 'test',
      topic_cluster: 'test',
      generation_source: 'real',
      features: {
        e2e_reply_proof: true,
        proof_tag: proofTag,
        pipeline_source: 'reply_proof',
        // Store FINAL_REPLY_GATE fields in features
        target_tweet_content_snapshot: targetTweetSnapshot, // Must be >= 20 chars
        target_tweet_content_hash: targetTweetHash, // Required for context lock
        semantic_similarity: 0.75, // Must be >= 0.30
        root_tweet_id: targetTweetId, // For replies, root = target
        created_at: now,
        retry_count: 0,
      },
      created_at: now,
      updated_at: now
    });
  
  if (error) {
    throw new Error(`Failed to seed reply decision: ${error.message}`);
  }
  
  console.log(`✅ Reply decision seeded: ${decisionId}`);
  return decisionId;
}

async function checkReplyDecisionStatus(decisionId: string): Promise<{ status: string; claimed: boolean }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('content_metadata')
    .select('status')
    .eq('decision_id', decisionId)
    .single();
  
  if (error || !data) {
    return { status: 'unknown', claimed: false };
  }
  
  // Reply status transitions: queued → replying → replied/failed
  const claimed = data.status === 'replying' || data.status === 'replied' || data.status === 'failed';
  return { status: data.status, claimed };
}

async function findReplyAttempt(decisionId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('outcomes')
    .select('id')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data?.id || null;
}

async function findReplyOutcome(decisionId: string): Promise<{ id: string | null; result: any }> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('outcomes')
    .select('id, result')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return { id: data?.id || null, result: data?.result || null };
}

async function findReplyEvents(decisionId: string): Promise<{ success: boolean; failed: boolean; eventIds: string[]; eventData: any[] }> {
  const supabase = getSupabaseClient();
  const startTime = new Date(Date.now() - MAX_WAIT_SECONDS * 1000);
  
  const { data } = await supabase
    .from('system_events')
    .select('id, event_type, event_data')
    .in('event_type', ['REPLY_SUCCESS', 'REPLY_FAILED'])
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: false });
  
  let success = false;
  let failed = false;
  const eventIds: string[] = [];
  const eventData: any[] = [];
  
  for (const event of data || []) {
    const eventDataParsed = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
    if (eventDataParsed.decision_id === decisionId) {
      eventIds.push(event.id);
      eventData.push(eventDataParsed);
      if (event.event_type === 'REPLY_SUCCESS') {
        success = true;
      } else if (event.event_type === 'REPLY_FAILED') {
        failed = true;
      }
    }
  }
  
  return { success, failed, eventIds, eventData };
}

async function extractReplyUrl(decisionId: string, eventData: any[], outcomeResult: any): Promise<string | undefined> {
  // Try to extract from REPLY_SUCCESS event_data first
  for (const event of eventData) {
    if (event.tweet_url) {
      return event.tweet_url;
    }
    if (event.tweet_id) {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      return `https://x.com/${username}/status/${event.tweet_id}`;
    }
    if (event.reply_tweet_id) {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      return `https://x.com/${username}/status/${event.reply_tweet_id}`;
    }
  }
  
  // Try to extract from outcomes.result
  if (outcomeResult) {
    const resultParsed = typeof outcomeResult === 'string' ? JSON.parse(outcomeResult) : outcomeResult;
    if (resultParsed.tweet_url) {
      return resultParsed.tweet_url;
    }
    if (resultParsed.tweet_id) {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      return `https://x.com/${username}/status/${resultParsed.tweet_id}`;
    }
    if (resultParsed.reply_tweet_id) {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      return `https://x.com/${username}/status/${resultParsed.reply_tweet_id}`;
    }
  }
  
  return undefined;
}

async function countReplyAttempts(decisionId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('decision_id', decisionId);
  
  return count || 0;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 EXECUTOR END-TO-END REPLY PROOF');
  if (DRY_RUN) {
    console.log('                    [DRY_RUN MODE - NO EXECUTION]');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Validate TARGET_TWEET_ID - FAIL FAST
  const targetTweetId = validateTargetTweetId();
  
  // Generate PROOF_TAG (timestamp-based for readability)
  const proofTag = `proof-${Date.now()}`;
  console.log(`📋 Proof Tag: ${proofTag}\n`);
  
  // Pre-flight: stop any existing daemon
  console.log('📋 Pre-flight checks...');
  if (fs.existsSync(PIDFILE_PATH)) {
    const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
    const pid = parseInt(pidfileContent.split(':')[0], 10);
    try {
      execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
      console.log(`⚠️  Stopping existing executor PID ${pid}`);
      fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        execSync(`kill ${pid} 2>/dev/null`, { encoding: 'utf-8' });
      } catch {
        // Ignore
      }
    } catch {
      // Stale lock
    }
    fs.unlinkSync(PIDFILE_PATH);
  }
  
  if (fs.existsSync(STOP_SWITCH_PATH)) {
    fs.unlinkSync(STOP_SWITCH_PATH);
  }
  
  // Capture initial executor safety metrics
  const initialWindows = await countVisibleWindows();
  const initialCdpProcesses = await countChromeCdpProcesses();
  
  // Step 1: Seed reply decision
  console.log('\n📝 Step 1: Seeding test reply decision...');
  const decisionId = await seedReplyDecision(targetTweetId, proofTag);
  
  // DRY_RUN mode: exit after seeding
  if (DRY_RUN) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ DRY_RUN COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Decision seeded (no execution):');
    console.log(`  decision_id: ${decisionId}`);
    console.log(`  target_tweet_id: ${targetTweetId}`);
    console.log(`  proof_tag: ${proofTag}`);
    console.log('');
    
    // Write DRY_RUN report
    const reportPath = path.join(process.cwd(), 'docs', 'EXECUTION_E2E_REPLY_PROOF.md');
    const os = require('os');
    const machineInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };
    
    const report = `# Executor End-to-End Reply Proof [DRY_RUN]

**Date:** ${new Date().toISOString()}  
**Status:** ✅ DRY_RUN COMPLETE (no execution)

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Seeded Decision

- **Decision ID:** ${decisionId}
- **Target Tweet ID:** ${targetTweetId}
- **Proof Tag:** ${proofTag}
- **Status:** queued (not executed)

## Result

✅ **DRY_RUN COMPLETE** - Decision seeded successfully, no execution performed
`;
    
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`📄 Report written: ${reportPath}`);
    process.exit(0);
  }
  
  // Step 2: Start daemon
  console.log('\n🚀 Step 2: Starting executor daemon...');
  const daemonProcess = spawn('pnpm', ['run', 'executor:daemon'], {
    env: {
      ...process.env,
      EXECUTION_MODE: 'executor',
      RUNNER_MODE: 'true',
      HEADLESS: 'true',
      RUNNER_PROFILE_DIR: RUNNER_PROFILE_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-e2e-reply.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Max wait: ${MAX_WAIT_SECONDS}s\n`);
  
  // Step 3: Wait for execution
  console.log('⏳ Step 3: Waiting for reply execution...');
  const startTime = Date.now();
  const result: E2EReplyProofResult = {
    decision_id: decisionId,
    target_tweet_id: targetTweetId,
    proof_tag: proofTag,
    reply_decision_queued: false,
    reply_decision_claimed: false,
    reply_attempt_recorded: false,
    reply_result_recorded: false,
    reply_success_event: false,
    reply_failed_event: false,
    executor_safety: {
      windows_opened: 0,
      chrome_cdp_processes: 0,
      pages_max: 0,
    },
    evidence: {},
  };
  
  let eventData: any[] = [];
  let outcomeResult: any = null;
  
  while (Date.now() - startTime < MAX_WAIT_SECONDS * 1000) {
    // Check decision status
    const status = await checkReplyDecisionStatus(decisionId);
    if (status.status === 'queued') {
      result.reply_decision_queued = true;
      result.evidence.decision_status = status.status;
    }
    if (status.claimed) {
      result.reply_decision_claimed = true;
      result.evidence.decision_status = status.status;
    }
    
    // Check for attempt
    const attemptId = await findReplyAttempt(decisionId);
    if (attemptId) {
      result.reply_attempt_recorded = true;
      result.evidence.attempt_id = attemptId;
    }
    
    // Check for outcome
    const outcome = await findReplyOutcome(decisionId);
    if (outcome.id) {
      result.reply_result_recorded = true;
      result.evidence.outcome_id = outcome.id;
      outcomeResult = outcome.result;
    }
    
    // Check for events
    const events = await findReplyEvents(decisionId);
    eventData = events.eventData;
    if (events.success) {
      result.reply_success_event = true;
      result.evidence.event_ids = events.eventIds;
    }
    if (events.failed) {
      result.reply_failed_event = true;
      result.evidence.event_ids = events.eventIds;
    }
    
    // Check reply attempt count (must be exactly 1)
    const replyCount = await countReplyAttempts(decisionId);
    result.evidence.reply_count = replyCount;
    
    // Check executor safety invariants
    const currentWindows = await countVisibleWindows();
    result.executor_safety.windows_opened = Math.max(0, currentWindows - initialWindows);
    result.executor_safety.chrome_cdp_processes = await countChromeCdpProcesses();
    result.executor_safety.pages_max = await getMaxPagesFromTicks();
    
    // Check if daemon died
    if (daemonProcess.killed || daemonProcess.exitCode !== null) {
      console.log('⚠️  Daemon exited during test');
      break;
    }
    
    // If we have both attempt and result, we're done
    if (result.reply_attempt_recorded && result.reply_result_recorded && (result.reply_success_event || result.reply_failed_event)) {
      console.log('✅ Reply execution complete!');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
  }
  
  // Stop daemon
  console.log('\n🛑 Stopping daemon...');
  fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
  await new Promise(resolve => setTimeout(resolve, 10000));
  if (daemonProcess.exitCode === null) {
    daemonProcess.kill();
  }
  
  // Final executor safety check
  const finalWindows = await countVisibleWindows();
  result.executor_safety.windows_opened = Math.max(0, finalWindows - initialWindows);
  result.executor_safety.chrome_cdp_processes = await countChromeCdpProcesses();
  result.executor_safety.pages_max = await getMaxPagesFromTicks();
  
  // Extract reply URL
  result.reply_url = await extractReplyUrl(decisionId, eventData, outcomeResult);
  
  // Step 4: Collect log excerpts
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf-8');
    const lines = logContent.trim().split('\n');
    const relevantLines = lines.filter(l => 
      l.includes(decisionId) || 
      l.includes('REPLY_SUCCESS') || 
      l.includes('REPLY_FAILED') ||
      l.includes('replying') ||
      l.includes('reply')
    );
    result.evidence.log_excerpts = relevantLines.slice(-20);
  }
  
  // Step 5: Evaluate result
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Hard assertions
  const executorSafetyPass = 
    result.executor_safety.windows_opened === 0 &&
    result.executor_safety.chrome_cdp_processes === 0 &&
    result.executor_safety.pages_max <= 1;
  
  const replyExecutionPass = 
    result.reply_decision_queued &&
    result.reply_decision_claimed &&
    result.reply_attempt_recorded &&
    result.reply_result_recorded &&
    (result.reply_success_event || result.reply_failed_event) &&
    result.evidence.reply_count === 1; // Exactly ONE reply attempt
  
  const pass = executorSafetyPass && replyExecutionPass;
  
  if (pass) {
    console.log('           ✅ TEST PASSED');
  } else {
    console.log('           ❌ TEST FAILED');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Reply Execution Results:');
  console.log(`  reply_decision_queued: ${result.reply_decision_queued} ${result.reply_decision_queued ? '✅' : '❌'}`);
  console.log(`  reply_decision_claimed: ${result.reply_decision_claimed} ${result.reply_decision_claimed ? '✅' : '❌'}`);
  console.log(`  reply_attempt_recorded: ${result.reply_attempt_recorded} ${result.reply_attempt_recorded ? '✅' : '❌'}`);
  console.log(`  reply_result_recorded: ${result.reply_result_recorded} ${result.reply_result_recorded ? '✅' : '❌'}`);
  console.log(`  reply_success_event: ${result.reply_success_event} ${result.reply_success_event ? '✅' : '❌'}`);
  console.log(`  reply_failed_event: ${result.reply_failed_event} ${result.reply_failed_event ? '✅' : '❌'}`);
  console.log(`  reply_count: ${result.evidence.reply_count} (expected: 1) ${result.evidence.reply_count === 1 ? '✅' : '❌'} [HARD ASSERTION]`);
  if (result.reply_url) {
    console.log(`  reply_url: ${result.reply_url}`);
  }
  console.log('');
  
  console.log('Executor Safety Invariants:');
  console.log(`  windows_opened: ${result.executor_safety.windows_opened} (expected: 0) ${result.executor_safety.windows_opened === 0 ? '✅' : '❌'} [HARD ASSERTION]`);
  console.log(`  chrome_cdp_processes: ${result.executor_safety.chrome_cdp_processes} (expected: 0) ${result.executor_safety.chrome_cdp_processes === 0 ? '✅' : '❌'} [HARD ASSERTION]`);
  console.log(`  pages_max: ${result.executor_safety.pages_max} (expected: <= 1) ${result.executor_safety.pages_max <= 1 ? '✅' : '❌'} [HARD ASSERTION]`);
  console.log('');
  
  if (result.evidence.decision_status) {
    console.log(`Evidence:`);
    console.log(`  decision_status: ${result.evidence.decision_status}`);
    if (result.evidence.attempt_id) {
      console.log(`  attempt_id: ${result.evidence.attempt_id}`);
    }
    if (result.evidence.outcome_id) {
      console.log(`  outcome_id: ${result.evidence.outcome_id}`);
    }
    if (result.evidence.event_ids && result.evidence.event_ids.length > 0) {
      console.log(`  event_ids: ${result.evidence.event_ids.join(', ')}`);
    }
    console.log('');
  }
  
  // Write report
  const reportPath = path.join(process.cwd(), 'docs', 'EXECUTION_E2E_REPLY_PROOF.md');
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const report = `# Executor End-to-End Reply Proof

**Date:** ${new Date().toISOString()}  
**Status:** ${pass ? '✅ PASS' : '❌ FAIL'}

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Reply Decision Queued | ${result.reply_decision_queued ? '✅' : '❌'} | ${result.evidence.decision_status || 'N/A'} | - |
| Reply Decision Claimed | ${result.reply_decision_claimed ? '✅' : '❌'} | ${result.evidence.decision_status || 'N/A'} | - |
| Reply Attempt Recorded | ${result.reply_attempt_recorded ? '✅' : '❌'} | ${result.evidence.attempt_id || 'N/A'} | - |
| Reply Result Recorded | ${result.reply_result_recorded ? '✅' : '❌'} | ${result.evidence.outcome_id || 'N/A'} | - |
| REPLY_SUCCESS Event | ${result.reply_success_event ? '✅' : '❌'} | ${result.evidence.event_ids?.join(', ') || 'N/A'} | - |
| REPLY_FAILED Event | ${result.reply_failed_event ? '✅' : '❌'} | ${result.evidence.event_ids?.join(', ') || 'N/A'} | - |
| Reply Count (exactly 1) | ${result.evidence.reply_count === 1 ? '✅' : '❌'} | ${result.evidence.reply_count || 0} | HARD |
| Windows Opened | ${result.executor_safety.windows_opened === 0 ? '✅' : '❌'} | ${result.executor_safety.windows_opened} | HARD |
| Chrome CDP Processes | ${result.executor_safety.chrome_cdp_processes === 0 ? '✅' : '❌'} | ${result.executor_safety.chrome_cdp_processes} | HARD |
| Pages Max | ${result.executor_safety.pages_max <= 1 ? '✅' : '❌'} | ${result.executor_safety.pages_max} | HARD |

## Evidence

- **Decision ID:** ${result.decision_id}
- **Target Tweet ID:** ${result.target_tweet_id}
- **Proof Tag:** ${result.proof_tag}
- **Decision Status:** ${result.evidence.decision_status || 'N/A'}
- **Attempt ID:** ${result.evidence.attempt_id || 'N/A'}
- **Outcome ID:** ${result.evidence.outcome_id || 'N/A'}
- **Event IDs:** ${result.evidence.event_ids?.join(', ') || 'N/A'}
- **Reply Count:** ${result.evidence.reply_count || 0}
${result.reply_url ? `- **Reply URL:** ${result.reply_url}` : ''}

## Log Excerpts

\`\`\`
${result.evidence.log_excerpts?.join('\n') || 'No relevant log excerpts'}
\`\`\`

## Result

${pass ? '✅ **PASS** - All execution checks and executor safety invariants passed' : '❌ **FAIL** - One or more checks failed'}
`;
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  if (!pass) {
    console.error('\n❌ HARD ASSERTIONS FAILED:');
    if (!result.reply_decision_queued) {
      console.error('   - reply_decision_queued=false');
    }
    if (!result.reply_decision_claimed) {
      console.error('   - reply_decision_claimed=false');
    }
    if (!result.reply_attempt_recorded) {
      console.error('   - reply_attempt_recorded=false');
    }
    if (!result.reply_result_recorded) {
      console.error('   - reply_result_recorded=false');
    }
    if (!result.reply_success_event && !result.reply_failed_event) {
      console.error('   - No REPLY_SUCCESS or REPLY_FAILED event');
    }
    if (result.evidence.reply_count !== 1) {
      console.error(`   - reply_count=${result.evidence.reply_count} (expected: 1)`);
    }
    if (result.executor_safety.windows_opened !== 0) {
      console.error(`   - windows_opened=${result.executor_safety.windows_opened} (expected: 0)`);
    }
    if (result.executor_safety.chrome_cdp_processes !== 0) {
      console.error(`   - chrome_cdp_processes=${result.executor_safety.chrome_cdp_processes} (expected: 0)`);
    }
    if (result.executor_safety.pages_max > 1) {
      console.error(`   - pages_max=${result.executor_safety.pages_max} (expected: <= 1)`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
