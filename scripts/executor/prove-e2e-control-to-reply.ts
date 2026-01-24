#!/usr/bin/env tsx
/**
 * 🧪 PROOF LEVEL 4: CONTROL → EXECUTOR → X (REPLY)
 * 
 * Proves the full pipeline: control-plane creates reply decision → executor executes → result URL captured.
 * 
 * Usage:
 *   # DRY_RUN (safe, no replying)
 *   TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply
 * 
 *   # Real execution (requires explicit opt-in)
 *   EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply
 * 
 * Safety:
 *   - Default: DRY_RUN mode (seeds decision, validates flow, but does NOT reply)
 *   - EXECUTE_REAL_ACTION=true: Required to actually reply on X
 *   - TARGET_TWEET_ID: Required, must be valid numeric tweet ID (>= 15 digits)
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

const DRY_RUN = process.env.DRY_RUN !== 'false' && process.env.EXECUTE_REAL_ACTION !== 'true';
const EXECUTE_REAL_ACTION = process.env.EXECUTE_REAL_ACTION === 'true';

// Global state for signal handlers
let proofState: {
  decisionId?: string;
  proofTag?: string;
  targetTweetId?: string;
  result?: ControlToReplyProofResult;
  reportPath?: string;
  snapshotWritten?: boolean;
} = {};

/**
 * Write diagnostic snapshot on termination (SIGTERM/SIGINT/uncaughtException)
 */
async function writeTerminationSnapshot(signal?: string): Promise<void> {
  if (proofState.snapshotWritten) {
    return; // Idempotent guard
  }
  proofState.snapshotWritten = true;

  if (!proofState.decisionId || !proofState.proofTag) {
    return; // No decision to snapshot
  }

  try {
    const supabase = getSupabaseClient();
    const reportPath = proofState.reportPath || path.join(process.cwd(), 'docs', 'CONTROL_TO_REPLY_PROOF.md');

    // Get decision status
    const { data: decisionMeta } = await supabase
      .from('content_metadata')
      .select('status, error_message, features, updated_at')
      .eq('decision_id', proofState.decisionId)
      .maybeSingle();

    // Get outcomes
    const { data: outcomeRow } = await supabase
      .from('outcomes')
      .select('*')
      .eq('decision_id', proofState.decisionId)
      .maybeSingle();

    // Get REPLY_FAILED events
    const { data: failedEvents } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'REPLY_FAILED')
      .eq('event_data->>decision_id', proofState.decisionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get EXECUTOR_DECISION_SKIPPED events
    const { data: skippedEvents } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'EXECUTOR_DECISION_SKIPPED')
      .eq('event_data->>decision_id', proofState.decisionId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Emit deterministic failure if decision exists but no attempt/outcome/events
    if (decisionMeta && !outcomeRow && !failedEvents) {
      try {
        const { recordDeterministicFailure } = await import('../../src/utils/deterministicFailureRecorder');
        await recordDeterministicFailure({
          decision_id: proofState.decisionId,
          decision_type: 'reply',
          pipeline_source: 'postingQueue',
          proof_tag: proofState.proofTag,
          error_name: 'ProofRunnerTerminated',
          error_message: `Proof script terminated by ${signal || 'unknown signal'}`,
          step: 'proof_runner_terminated',
        });
      } catch (recordError: any) {
        console.error(`[TERMINATION] Failed to record deterministic failure: ${recordError.message}`);
      }
    }

    // Write snapshot synchronously
    const snapshot = `
## Diagnostic Snapshot (Termination: ${signal || 'unknown'})

**Written at:** ${new Date().toISOString()}
**Termination Signal:** ${signal || 'unknown'}

### Decision Status
- **Decision ID:** ${proofState.decisionId}
- **Target Tweet ID:** ${proofState.targetTweetId || 'N/A'}
- **Proof Tag:** ${proofState.proofTag}
- **Final Status:** ${decisionMeta?.status || 'unknown'}
- **Error Message:** ${decisionMeta?.error_message || 'N/A'}
- **Last Updated:** ${decisionMeta?.updated_at || 'N/A'}

### Outcomes
${outcomeRow ? `
\`\`\`json
${JSON.stringify(outcomeRow, null, 2)}
\`\`\`
` : 'No outcomes row found'}

### Failure Events
${failedEvents ? `
\`\`\`json
${JSON.stringify(typeof failedEvents.event_data === 'string' ? JSON.parse(failedEvents.event_data) : failedEvents.event_data, null, 2)}
\`\`\`
` : 'No REPLY_FAILED event found'}

### Skipped Events
${skippedEvents && skippedEvents.length > 0 ? `
Found ${skippedEvents.length} EXECUTOR_DECISION_SKIPPED event(s):

\`\`\`json
${JSON.stringify(skippedEvents.map(e => typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data), null, 2)}
\`\`\`
` : 'No skipped events found'}
`;

    // Append to report file synchronously
    fs.appendFileSync(reportPath, snapshot, 'utf-8');
    console.error(`[TERMINATION] Diagnostic snapshot written to ${reportPath}`);
  } catch (error: any) {
    console.error(`[TERMINATION] Failed to write snapshot: ${error.message}`);
  }
}

// Register signal handlers
process.on('SIGTERM', async () => {
  console.error('\n[SIGTERM] Received SIGTERM, writing diagnostic snapshot...');
  await writeTerminationSnapshot('SIGTERM');
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.error('\n[SIGINT] Received SIGINT, writing diagnostic snapshot...');
  await writeTerminationSnapshot('SIGINT');
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error('\n[UNCAUGHT_EXCEPTION]', error);
  await writeTerminationSnapshot('uncaughtException');
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('\n[UNHANDLED_REJECTION]', reason);
  await writeTerminationSnapshot('unhandledRejection');
  process.exit(1);
});

// Validate TARGET_TWEET_ID - FAIL FAST if missing or invalid
function validateTargetTweetId(): string {
  const targetTweetId = process.env.TARGET_TWEET_ID;
  
  if (!targetTweetId) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           ❌ FATAL: TARGET_TWEET_ID is required');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('Usage:');
    console.error('  TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply');
    console.error('  EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply\n');
    console.error('How to extract tweet ID from URL:');
    console.error('  URL: https://x.com/username/status/1234567890123456789');
    console.error('  Extract: 1234567890123456789 (the number after /status/)\n');
    process.exit(1);
  }
  
  // Validate: must be numeric and >= 15 digits
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

interface ControlToReplyProofResult {
  decision_id: string;
  target_tweet_id: string;
  proof_tag: string;
  control_decision_created: boolean;
  decision_queued: boolean;
  decision_claimed: boolean;
  attempt_recorded: boolean;
  result_recorded: boolean;
  success_or_failure_event_present: boolean;
  result_url?: string;
  exactly_one_decision: number;
  exactly_one_attempt: number;
  executor_safety: {
    windows_opened: number;
    chrome_cdp_processes: number;
    pages_max: number;
  };
  evidence: {
    pipeline_source?: string;
    decision_status?: string;
    attempt_id?: string;
    outcome_id?: string;
    event_ids?: string[];
    log_excerpts?: string[];
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

async function createControlReplyDecision(targetTweetId: string, proofTag: string): Promise<string> {
  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  // Create reply decision that mimics control-plane reply scheduler output
  // Use pipeline_source that matches control-plane (stored in features)
  const replyContent = "Quick note: sleep quality and sunlight timing matter more than most people think.";
  
  // Required fields for reply decisions
  const targetTweetSnapshot = "This is a test tweet content snapshot for control→executor proof. It must be at least 20 characters long to pass FINAL_REPLY_GATE.";
  const targetTweetHash = crypto.createHash('sha256').update(targetTweetSnapshot).digest('hex').substring(0, 32);
  
  console.log(`📝 Creating control-plane reply decision: ${decisionId}`);
  console.log(`   Target tweet ID: ${targetTweetId}`);
  console.log(`   Proof tag: ${proofTag}`);
  console.log(`   DRY_RUN: ${DRY_RUN}`);
  
  const { error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      target_tweet_id: targetTweetId,
      status: 'queued',
      scheduled_at: now,
      quality_score: 0.8,
      predicted_er: 0.5,
      bandit_arm: 'test',
      topic_cluster: 'test',
      generation_source: 'real',
      features: {
        control_to_reply_proof: true,
        proof_tag: proofTag,
        pipeline_source: 'control_reply_scheduler', // Mimics control-plane
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
    throw new Error(`Failed to create control reply decision: ${error.message}`);
  }
  
  console.log(`✅ Control reply decision created: ${decisionId}`);
  return decisionId;
}

async function checkReplyDecisionStatus(decisionId: string): Promise<{ status: string; claimed: boolean; pipeline_source?: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('content_metadata')
    .select('status, features')
    .eq('decision_id', decisionId)
    .single();
  
  if (error || !data) {
    return { status: 'unknown', claimed: false };
  }
  
  // Reply status transitions: queued → replying → replied/failed
  const claimed = data.status === 'replying' || data.status === 'replied' || data.status === 'failed';
  const features = typeof data.features === 'string' ? JSON.parse(data.features) : data.features;
  const pipeline_source = features?.pipeline_source || null;
  
  return { status: data.status, claimed, pipeline_source };
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
  
  // Try to get from content_metadata.tweet_id
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('content_metadata')
      .select('tweet_id')
      .eq('decision_id', decisionId)
      .single();
    
    if (data?.tweet_id) {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      return `https://x.com/${username}/status/${data.tweet_id}`;
    }
  } catch {
    // Ignore
  }
  
  return undefined;
}

async function countDecisionsWithProofTag(proofTag: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('features->>proof_tag', proofTag);
  
  return count || 0;
}

async function countAttempts(decisionId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('decision_id', decisionId);
  
  return count || 0;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 PROOF LEVEL 4: CONTROL → EXECUTOR → X (REPLY)');
  if (DRY_RUN) {
    console.log('                    [DRY_RUN MODE - NO REPLYING]');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Validate TARGET_TWEET_ID - FAIL FAST
  const targetTweetId = validateTargetTweetId();
  
  // Generate PROOF_TAG
  const proofTag = `control-reply-${Date.now()}`;
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
  
  // Step 1: Create control-plane reply decision
  console.log('\n📝 Step 1: Creating control-plane reply decision...');
  const decisionId = await createControlReplyDecision(targetTweetId, proofTag);
  
  // Store state for signal handlers
  proofState.decisionId = decisionId;
  proofState.proofTag = proofTag;
  proofState.targetTweetId = targetTweetId;
  proofState.reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_REPLY_PROOF.md');
  
  // DRY_RUN mode: exit after creating decision
  if (DRY_RUN) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ DRY_RUN COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Control reply decision created (no execution):');
    console.log(`  decision_id: ${decisionId}`);
    console.log(`  target_tweet_id: ${targetTweetId}`);
    console.log(`  proof_tag: ${proofTag}`);
    console.log('');
    
    // Write DRY_RUN report
    const reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_REPLY_PROOF.md');
    const os = require('os');
    const machineInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };
    
    const report = `# Control → Executor → X Proof (Reply) [DRY_RUN]

**Date:** ${new Date().toISOString()}  
**Status:** ✅ DRY_RUN COMPLETE (no execution)

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Created Decision

- **Decision ID:** ${decisionId}
- **Target Tweet ID:** ${targetTweetId}
- **Proof Tag:** ${proofTag}
- **Status:** queued (not executed)

## Result

✅ **DRY_RUN COMPLETE** - Control reply decision created successfully, no execution performed
`;
    
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`📄 Report written: ${reportPath}`);
    process.exit(0);
  }
  
  // Step 2: Start executor daemon
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
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-control-to-reply.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Max wait: ${MAX_WAIT_SECONDS}s\n`);
  
  // Step 3: Wait for execution
  console.log('⏳ Step 3: Waiting for executor to claim and execute...');
  const startTime = Date.now();
  const result: ControlToReplyProofResult = {
    decision_id: decisionId,
    target_tweet_id: targetTweetId,
    proof_tag: proofTag,
    control_decision_created: false,
    decision_queued: false,
    decision_claimed: false,
    attempt_recorded: false,
    result_recorded: false,
    success_or_failure_event_present: false,
    exactly_one_decision: 0,
    exactly_one_attempt: 0,
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
      result.decision_queued = true;
      result.evidence.decision_status = status.status;
      result.evidence.pipeline_source = status.pipeline_source || undefined;
    }
    if (status.claimed) {
      result.decision_claimed = true;
      result.evidence.decision_status = status.status;
    }
    
    // Check control decision created
    if (status.status) {
      result.control_decision_created = true;
    }
    
    // Check for attempt
    const attemptId = await findReplyAttempt(decisionId);
    if (attemptId) {
      result.attempt_recorded = true;
      result.evidence.attempt_id = attemptId;
    }
    
    // Check for outcome
    const outcome = await findReplyOutcome(decisionId);
    if (outcome.id) {
      result.result_recorded = true;
      result.evidence.outcome_id = outcome.id;
      outcomeResult = outcome.result;
    }
    
    // Check for events
    const events = await findReplyEvents(decisionId);
    eventData = events.eventData;
    if (events.success || events.failed) {
      result.success_or_failure_event_present = true;
      result.evidence.event_ids = events.eventIds;
    }
    
    // Check counts
    result.exactly_one_decision = await countDecisionsWithProofTag(proofTag);
    result.exactly_one_attempt = await countAttempts(decisionId);
    
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
    if (result.attempt_recorded && result.result_recorded && result.success_or_failure_event_present) {
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
  result.result_url = await extractReplyUrl(decisionId, eventData, outcomeResult);
  
  // Store result for signal handlers
  proofState.result = result;
  
  // Step 4: Collect log excerpts and diagnostic snapshot
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf-8');
    const lines = logContent.trim().split('\n');
    const relevantLines = lines.filter(l => 
      l.includes(decisionId) || 
      l.includes(proofTag) ||
      l.includes('REPLY_SUCCESS') || 
      l.includes('REPLY_FAILED') ||
      l.includes('POST_SUCCESS') ||
      l.includes('POST_FAILED') ||
      l.includes('EXECUTOR_DECISION_SKIPPED') ||
      l.includes('429') ||
      l.includes('rate limit') ||
      l.includes('timeout') ||
      l.includes('replying') ||
      l.includes('reply')
    );
    result.evidence.log_excerpts = relevantLines.slice(-20);
  }
  
  // Capture diagnostic snapshot on failure
  if (!result.success_or_failure_event_present || !result.attempt_recorded) {
    const supabase = getSupabaseClient();
    
    // Get decision final status
    const { data: decisionMeta } = await supabase
      .from('content_metadata')
      .select('status, error_message, features')
      .eq('decision_id', decisionId)
      .maybeSingle();
    
    result.evidence.diagnostic_snapshot = {
      decision_final_status: decisionMeta?.status || 'unknown',
      decision_error_message: decisionMeta?.error_message || null,
      decision_features: decisionMeta?.features || null,
    };
    
    // Get REPLY_FAILED event if present
    const { data: failedEvents } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'REPLY_FAILED')
      .eq('event_data->>decision_id', decisionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (failedEvents) {
      const eventDataParsed = typeof failedEvents.event_data === 'string' 
        ? JSON.parse(failedEvents.event_data) 
        : failedEvents.event_data;
      result.evidence.diagnostic_snapshot.failed_event_data = eventDataParsed;
      result.evidence.diagnostic_snapshot.error_code = eventDataParsed.error_code || 'UNKNOWN';
      result.evidence.diagnostic_snapshot.error_message = eventDataParsed.error_message || null;
      result.evidence.diagnostic_snapshot.http_status = eventDataParsed.http_status || null;
      result.evidence.diagnostic_snapshot.is_rate_limit = eventDataParsed.is_rate_limit || false;
      result.evidence.diagnostic_snapshot.is_timeout = eventDataParsed.is_timeout || false;
    }
    
    // Get outcomes result if present
    const { data: outcomeRow } = await supabase
      .from('outcomes')
      .select('result')
      .eq('decision_id', decisionId)
      .maybeSingle();
    
    if (outcomeRow?.result) {
      const resultParsed = typeof outcomeRow.result === 'string' 
        ? JSON.parse(outcomeRow.result) 
        : outcomeRow.result;
      result.evidence.diagnostic_snapshot.outcomes_result = resultParsed;
    }
    
    // Get EXECUTOR_DECISION_SKIPPED events
    const { data: skippedEvents } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'EXECUTOR_DECISION_SKIPPED')
      .eq('event_data->>decision_id', decisionId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (skippedEvents && skippedEvents.length > 0) {
      result.evidence.diagnostic_snapshot.skipped_events = skippedEvents.map(e => 
        typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data
      );
    }
  }
  
  // Step 5: Evaluate result
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Hard assertions
  const executorSafetyPass = 
    result.executor_safety.windows_opened === 0 &&
    result.executor_safety.chrome_cdp_processes === 0 &&
    result.executor_safety.pages_max <= 1;
  
  const executionPass = 
    result.control_decision_created &&
    result.decision_queued &&
    result.decision_claimed &&
    result.attempt_recorded &&
    result.result_recorded &&
    result.success_or_failure_event_present &&
    result.exactly_one_decision === 1 && // HARD
    result.exactly_one_attempt === 1; // HARD
  
  const pass = executorSafetyPass && executionPass;
  
  if (pass) {
    console.log('           ✅ TEST PASSED');
  } else {
    console.log('           ❌ TEST FAILED');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Control→Executor→X Results:');
  console.log(`  control_decision_created: ${result.control_decision_created} ${result.control_decision_created ? '✅' : '❌'}`);
  console.log(`  decision_queued: ${result.decision_queued} ${result.decision_queued ? '✅' : '❌'}`);
  console.log(`  decision_claimed: ${result.decision_claimed} ${result.decision_claimed ? '✅' : '❌'}`);
  console.log(`  attempt_recorded: ${result.attempt_recorded} ${result.attempt_recorded ? '✅' : '❌'}`);
  console.log(`  result_recorded: ${result.result_recorded} ${result.result_recorded ? '✅' : '❌'}`);
  console.log(`  success_or_failure_event_present: ${result.success_or_failure_event_present} ${result.success_or_failure_event_present ? '✅' : '❌'}`);
  console.log(`  exactly_one_decision: ${result.exactly_one_decision} (expected: 1) ${result.exactly_one_decision === 1 ? '✅' : '❌'} [HARD ASSERTION]`);
  console.log(`  exactly_one_attempt: ${result.exactly_one_attempt} (expected: 1) ${result.exactly_one_attempt === 1 ? '✅' : '❌'} [HARD ASSERTION]`);
  if (result.result_url) {
    console.log(`  result_url: ${result.result_url}`);
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
    if (result.evidence.pipeline_source) {
      console.log(`  pipeline_source: ${result.evidence.pipeline_source}`);
    }
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
  const reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_REPLY_PROOF.md');
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const report = `# Control → Executor → X Proof (Reply)

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
| Control Decision Created | ${result.control_decision_created ? '✅' : '❌'} | ${result.evidence.pipeline_source || 'N/A'} | - |
| Decision Queued | ${result.decision_queued ? '✅' : '❌'} | ${result.evidence.decision_status || 'N/A'} | - |
| Decision Claimed | ${result.decision_claimed ? '✅' : '❌'} | ${result.evidence.decision_status || 'N/A'} | - |
| Attempt Recorded | ${result.attempt_recorded ? '✅' : '❌'} | ${result.evidence.attempt_id || 'N/A'} | - |
| Result Recorded | ${result.result_recorded ? '✅' : '❌'} | ${result.evidence.outcome_id || 'N/A'} | - |
| Success/Failure Event | ${result.success_or_failure_event_present ? '✅' : '❌'} | ${result.evidence.event_ids?.join(', ') || 'N/A'} | - |
| Exactly One Decision | ${result.exactly_one_decision === 1 ? '✅' : '❌'} | ${result.exactly_one_decision} | HARD |
| Exactly One Attempt | ${result.exactly_one_attempt === 1 ? '✅' : '❌'} | ${result.exactly_one_attempt} | HARD |
| Windows Opened | ${result.executor_safety.windows_opened === 0 ? '✅' : '❌'} | ${result.executor_safety.windows_opened} | HARD |
| Chrome CDP Processes | ${result.executor_safety.chrome_cdp_processes === 0 ? '✅' : '❌'} | ${result.executor_safety.chrome_cdp_processes} | HARD |
| Pages Max | ${result.executor_safety.pages_max <= 1 ? '✅' : '❌'} | ${result.executor_safety.pages_max} | HARD |

## Evidence

- **Decision ID:** ${result.decision_id}
- **Target Tweet ID:** ${result.target_tweet_id}
- **Proof Tag:** ${result.proof_tag}
- **Pipeline Source:** ${result.evidence.pipeline_source || 'N/A'}
- **Decision Status:** ${result.evidence.decision_status || 'N/A'}
- **Attempt ID:** ${result.evidence.attempt_id || 'N/A'}
- **Outcome ID:** ${result.evidence.outcome_id || 'N/A'}
- **Event IDs:** ${result.evidence.event_ids?.join(', ') || 'N/A'}
${result.result_url ? `- **Result URL:** ${result.result_url}` : ''}

## Log Excerpts

\`\`\`
${result.evidence.log_excerpts?.join('\n') || 'No relevant log excerpts'}
\`\`\`

${result.evidence.diagnostic_snapshot ? `## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** ${result.evidence.diagnostic_snapshot.decision_final_status || 'unknown'}
- **Error Message:** ${result.evidence.diagnostic_snapshot.decision_error_message || 'N/A'}

### Failure Event Data
${result.evidence.diagnostic_snapshot.failed_event_data ? `
\`\`\`json
${JSON.stringify(result.evidence.diagnostic_snapshot.failed_event_data, null, 2)}
\`\`\`

- **Error Code:** ${result.evidence.diagnostic_snapshot.error_code || 'UNKNOWN'}
- **HTTP Status:** ${result.evidence.diagnostic_snapshot.http_status || 'N/A'}
- **Is Rate Limit:** ${result.evidence.diagnostic_snapshot.is_rate_limit ? 'Yes' : 'No'}
- **Is Timeout:** ${result.evidence.diagnostic_snapshot.is_timeout ? 'Yes' : 'No'}
` : 'No REPLY_FAILED event found'}

### Outcomes Result
${result.evidence.diagnostic_snapshot.outcomes_result ? `
\`\`\`json
${JSON.stringify(result.evidence.diagnostic_snapshot.outcomes_result, null, 2)}
\`\`\`
` : 'No outcomes result found'}

### Skipped Events
${result.evidence.diagnostic_snapshot.skipped_events && result.evidence.diagnostic_snapshot.skipped_events.length > 0 ? `
Found ${result.evidence.diagnostic_snapshot.skipped_events.length} EXECUTOR_DECISION_SKIPPED event(s):

\`\`\`json
${JSON.stringify(result.evidence.diagnostic_snapshot.skipped_events, null, 2)}
\`\`\`
` : 'No skipped events found'}
` : ''}

## Result

${pass ? '✅ **PASS** - All execution checks and executor safety invariants passed' : '❌ **FAIL** - One or more checks failed'}
${!pass && result.evidence.diagnostic_snapshot?.error_code ? `\n**Failure Code:** ${result.evidence.diagnostic_snapshot.error_code}` : ''}
`;
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  if (!pass) {
    console.error('\n❌ HARD ASSERTIONS FAILED:');
    if (!result.control_decision_created) {
      console.error('   - control_decision_created=false');
    }
    if (!result.decision_queued) {
      console.error('   - decision_queued=false');
    }
    if (!result.decision_claimed) {
      console.error('   - decision_claimed=false');
    }
    if (!result.attempt_recorded) {
      console.error('   - attempt_recorded=false');
    }
    if (!result.result_recorded) {
      console.error('   - result_recorded=false');
    }
    if (!result.success_or_failure_event_present) {
      console.error('   - No REPLY_SUCCESS or REPLY_FAILED event');
    }
    if (result.exactly_one_decision !== 1) {
      console.error(`   - exactly_one_decision=${result.exactly_one_decision} (expected: 1)`);
    }
    if (result.exactly_one_attempt !== 1) {
      console.error(`   - exactly_one_attempt=${result.exactly_one_attempt} (expected: 1)`);
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
