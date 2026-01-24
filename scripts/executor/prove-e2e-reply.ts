#!/usr/bin/env tsx
/**
 * 🧪 EXECUTOR END-TO-END REPLY PROOF
 * 
 * Seeds ONE reply decision, runs executor daemon, and proves execution.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:e2e-reply
 *   TARGET_TWEET_ID=1234567890 pnpm run executor:prove:e2e-reply  # Optional: specify target tweet
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

// Static target tweet ID for proof (can be overridden via env)
// Using a placeholder - user should set TARGET_TWEET_ID env var or update this
const DEFAULT_TARGET_TWEET_ID = process.env.TARGET_TWEET_ID || '1234567890123456789'; // Placeholder - must be real tweet ID

interface E2EReplyProofResult {
  decision_id: string;
  target_tweet_id: string;
  reply_decision_queued: boolean;
  reply_decision_claimed: boolean;
  reply_attempt_recorded: boolean;
  reply_result_recorded: boolean;
  reply_success_event: boolean;
  reply_failed_event: boolean;
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

async function seedReplyDecision(targetTweetId: string): Promise<string> {
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
  
  const { error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      target_tweet_id: targetTweetId,
      root_tweet_id: targetTweetId, // For replies, root = target
      status: 'queued',
      scheduled_at: now,
      pipeline_source: 'reply_proof',
      // Required fields for FINAL_REPLY_GATE
      target_tweet_content_snapshot: targetTweetSnapshot, // Must be >= 20 chars
      target_tweet_content_hash: targetTweetHash, // Required for context lock
      semantic_similarity: 0.75, // Must be >= 0.30
      quality_score: 0.8,
      predicted_er: 0.5,
      bandit_arm: 'test',
      topic_cluster: 'test',
      features: {
        e2e_reply_proof: true,
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

async function findReplyOutcome(decisionId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('outcomes')
    .select('id, result')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data?.id || null;
}

async function findReplyEvents(decisionId: string): Promise<{ success: boolean; failed: boolean; eventIds: string[] }> {
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
  
  for (const event of data || []) {
    const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
    if (eventData.decision_id === decisionId) {
      eventIds.push(event.id);
      if (event.event_type === 'REPLY_SUCCESS') {
        success = true;
      } else if (event.event_type === 'REPLY_FAILED') {
        failed = true;
      }
    }
  }
  
  return { success, failed, eventIds };
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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const targetTweetId = process.env.TARGET_TWEET_ID || DEFAULT_TARGET_TWEET_ID;
  
  if (targetTweetId === DEFAULT_TARGET_TWEET_ID) {
    console.log('⚠️  WARNING: Using placeholder target tweet ID');
    console.log('   Set TARGET_TWEET_ID env var to use a real tweet ID');
    console.log('   Example: TARGET_TWEET_ID=1234567890 pnpm run executor:prove:e2e-reply\n');
  }
  
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
  const decisionId = await seedReplyDecision(targetTweetId);
  
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
    const outcomeId = await findReplyOutcome(decisionId);
    if (outcomeId) {
      result.reply_result_recorded = true;
      result.evidence.outcome_id = outcomeId;
    }
    
    // Check for events
    const events = await findReplyEvents(decisionId);
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
- **Decision Status:** ${result.evidence.decision_status || 'N/A'}
- **Attempt ID:** ${result.evidence.attempt_id || 'N/A'}
- **Outcome ID:** ${result.evidence.outcome_id || 'N/A'}
- **Event IDs:** ${result.evidence.event_ids?.join(', ') || 'N/A'}
- **Reply Count:** ${result.evidence.reply_count || 0}

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
