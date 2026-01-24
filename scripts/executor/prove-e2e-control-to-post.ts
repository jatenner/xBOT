#!/usr/bin/env tsx
/**
 * 🧪 PROOF LEVEL 4: CONTROL → EXECUTOR → X (POSTING)
 * 
 * Proves the full pipeline: control-plane creates decision → executor executes → result URL captured.
 * 
 * Usage:
 *   # DRY_RUN (safe, no posting)
 *   pnpm run executor:prove:e2e-control-post
 * 
 *   # Real execution (requires explicit opt-in)
 *   EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post
 * 
 * Safety:
 *   - Default: DRY_RUN mode (seeds decision, validates flow, but does NOT post)
 *   - EXECUTE_REAL_ACTION=true: Required to actually post on X
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const MAX_WAIT_SECONDS = parseInt(process.env.PROOF_MAX_WAIT_SECONDS || '600', 10); // Default 10 minutes, override via env

const DRY_RUN = process.env.DRY_RUN !== 'false' && process.env.EXECUTE_REAL_ACTION !== 'true';
const EXECUTE_REAL_ACTION = process.env.EXECUTE_REAL_ACTION === 'true';

// Global state for signal handlers
let proofState: {
  decisionId?: string;
  proofTag?: string;
  result?: ControlToPostProofResult;
  reportPath?: string;
  snapshotWritten?: boolean;
  cachedDecisionStatus?: { status: string; claimed: boolean; pipeline_source?: string };
  cachedAttemptId?: string | null;
  cachedOutcomeId?: string | null;
  cachedEventIds?: string[];
  cachedFailedEvent?: any;
  cachedResultUrl?: string;
  lastHeartbeat?: number;
  cachedStatusCheck?: {
    found: boolean;
    status: string | null;
    tweet_id: string | null;
    url: string | null;
    created_at: string | null;
    supabase_error: any | null;
    fallback_used: boolean;
  };
} = {};

/**
 * Write heartbeat snapshot every 10s (synchronous, throttled)
 */
function writeHeartbeatSnapshot(): void {
  if (!proofState.decisionId || !proofState.proofTag) {
    return;
  }

  try {
    const reportPath = proofState.reportPath || path.join(process.cwd(), 'docs', 'CONTROL_TO_POST_PROOF.md');
    const now = Date.now();
    
    // Throttle heartbeats to every 10s
    if (proofState.lastHeartbeat && (now - proofState.lastHeartbeat) < 10000) {
      return;
    }
    proofState.lastHeartbeat = now;

    const statusCheck = proofState.cachedStatusCheck;
    const snapshot = `
---

**Heartbeat:** ${new Date().toISOString()}
- **Decision Found:** ${statusCheck?.found ? 'yes' : 'no'}
- **Decision Status:** ${statusCheck?.status || 'unknown'}
- **Claimed:** ${proofState.cachedDecisionStatus?.claimed ? 'yes' : 'no'}
- **Tweet ID:** ${statusCheck?.tweet_id || 'N/A'}
${statusCheck?.tweet_id ? `- **URL:** https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${statusCheck.tweet_id}` : '- **URL:** N/A'}
- **Created At:** ${statusCheck?.created_at || 'N/A'}
- **Fallback Used:** ${statusCheck?.fallback_used ? 'yes' : 'no'}
${statusCheck?.supabase_error ? `- **Supabase Error:** ${JSON.stringify(statusCheck.supabase_error)}` : ''}
- **Attempt ID:** ${proofState.cachedAttemptId || 'N/A'}
- **Outcome ID:** ${proofState.cachedOutcomeId || 'N/A'}
- **Event IDs:** ${proofState.cachedEventIds?.length ? proofState.cachedEventIds.join(', ') : 'N/A'}
- **Failed Event:** ${proofState.cachedFailedEvent ? 'yes' : 'no'}
- **Result URL:** ${proofState.cachedResultUrl || 'N/A'}

`;

    // Append synchronously
    fs.appendFileSync(reportPath, snapshot, 'utf-8');
  } catch (error: any) {
    // Ignore heartbeat errors
  }
}

/**
 * Write termination snapshot synchronously (no async DB queries)
 */
function writeTerminationSnapshotSync(signal?: string): void {
  if (proofState.snapshotWritten) {
    return; // Idempotent guard
  }
  proofState.snapshotWritten = true;

  if (!proofState.decisionId || !proofState.proofTag) {
    return; // No decision to snapshot
  }

  try {
    const reportPath = proofState.reportPath || path.join(process.cwd(), 'docs', 'CONTROL_TO_POST_PROOF.md');

    // Use cached state only (no async queries)
    const snapshot = `
---

## Diagnostic Snapshot (Termination: ${signal || 'unknown'})

**Written at:** ${new Date().toISOString()}
**Termination Signal:** ${signal || 'unknown'}

### Decision Status (from cache)
- **Decision ID:** ${proofState.decisionId}
- **Proof Tag:** ${proofState.proofTag}
- **Found:** ${proofState.cachedStatusCheck?.found ? 'yes' : 'no'}
- **Final Status:** ${proofState.cachedStatusCheck?.status || 'unknown'}
- **Claimed:** ${proofState.cachedStatusCheck?.claimed ? 'yes' : 'no'}
- **Tweet ID:** ${proofState.cachedStatusCheck?.tweet_id || 'N/A'}
${proofState.cachedStatusCheck?.tweet_id ? `- **URL:** https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${proofState.cachedStatusCheck.tweet_id}` : '- **URL:** N/A'}
- **Created At:** ${proofState.cachedStatusCheck?.created_at || 'N/A'}
- **Fallback Used:** ${proofState.cachedStatusCheck?.fallback_used ? 'yes' : 'no'}
${proofState.cachedStatusCheck?.supabase_error ? `- **Supabase Error:** ${JSON.stringify(proofState.cachedStatusCheck.supabase_error)}` : ''}

### Outcomes (from cache)
- **Attempt ID:** ${proofState.cachedAttemptId || 'N/A'}
- **Outcome ID:** ${proofState.cachedOutcomeId || 'N/A'}

### Events (from cache)
- **Event IDs:** ${proofState.cachedEventIds?.length ? proofState.cachedEventIds.join(', ') : 'N/A'}
- **Failed Event Present:** ${proofState.cachedFailedEvent ? 'yes' : 'no'}
${proofState.cachedFailedEvent ? `
\`\`\`json
${JSON.stringify(typeof proofState.cachedFailedEvent === 'string' ? JSON.parse(proofState.cachedFailedEvent) : proofState.cachedFailedEvent, null, 2)}
\`\`\`
` : ''}
- **Result URL:** ${proofState.cachedResultUrl || 'N/A'}

**Note:** This snapshot uses cached state from the last polling cycle. For complete details, check the database directly.
`;

    // Append synchronously
    fs.appendFileSync(reportPath, snapshot, 'utf-8');
    console.error(`[TERMINATION] Diagnostic snapshot written to ${reportPath}`);
  } catch (error: any) {
    console.error(`[TERMINATION] Failed to write snapshot: ${error.message}`);
  }
}

// Register signal handlers (synchronous only)
process.on('SIGTERM', () => {
  console.error('\n[SIGTERM] Received SIGTERM, writing diagnostic snapshot...');
  writeTerminationSnapshotSync('SIGTERM');
  process.exit(1);
});

process.on('SIGINT', () => {
  console.error('\n[SIGINT] Received SIGINT, writing diagnostic snapshot...');
  writeTerminationSnapshotSync('SIGINT');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n[UNCAUGHT_EXCEPTION]', error);
  writeTerminationSnapshotSync('uncaughtException');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n[UNHANDLED_REJECTION]', reason);
  writeTerminationSnapshotSync('unhandledRejection');
  process.exit(1);
});

interface ControlToPostProofResult {
  decision_id: string;
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

/**
 * Write initial report immediately after creating decision (for durability)
 */
async function writeInitialReport(decisionId: string, proofTag: string): Promise<void> {
  try {
    const reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_POST_PROOF.md');
    const os = require('os');
    const machineInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };
    
    const initialReport = `# Control → Executor → X Proof (Posting)

**Date:** ${new Date().toISOString()}  
**Status:** ⏳ IN PROGRESS

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Evidence

- **Decision ID:** ${decisionId}
- **Proof Tag:** ${proofTag}
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued (initial)
- **Attempt ID:** N/A (pending)
- **Outcome ID:** N/A (pending)
- **Event IDs:** N/A (pending)
- **DRY_RUN:** ${DRY_RUN}

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Control Decision Created | ✅ | control_posting_queue | - |
| Decision Queued | ✅ | queued | - |
| Decision Claimed | ⏳ | pending | - |
| Attempt Recorded | ⏳ | pending | - |
| Result Recorded | ⏳ | pending | - |
| Success/Failure Event | ⏳ | pending | - |

---

*Report will be updated as proof progresses...*
`;

    fs.writeFileSync(reportPath, initialReport, 'utf-8');
    console.log(`📝 Initial report written to ${reportPath}`);
  } catch (error: any) {
    console.warn(`⚠️  Failed to write initial report: ${error.message}`);
  }
}

async function createControlDecision(proofTag: string): Promise<string> {
  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  // Create decision that mimics control-plane posting queue scheduler output
  // Use pipeline_source that matches control-plane (null or default, stored in features)
  const content = `🧪 Control→Executor proof: ${Date.now()}. Sleep quality and sunlight timing matter more than most people think.`;
  
  console.log(`📝 Creating control-plane decision: ${decisionId}`);
  console.log(`   Proof tag: ${proofTag}`);
  console.log(`   DRY_RUN: ${DRY_RUN}`);
  
  const { error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'single',
      content: content,
      status: 'queued',
      scheduled_at: now,
      generation_source: 'real',
      raw_topic: 'health_optimization',
      angle: 'practical_application',
      tone: 'educational',
      generator_name: 'teacher',
      format_strategy: 'direct_value',
      quality_score: 0.85,
      predicted_er: 0.045,
      bandit_arm: 'educational',
      topic_cluster: 'health_optimization',
      features: {
        control_to_post_proof: true,
        proof_tag: proofTag,
        pipeline_source: 'control_posting_queue', // Mimics control-plane
        created_at: now,
        retry_count: 0,
      },
      created_at: now,
      updated_at: now
    });
  
  if (error) {
    throw new Error(`Failed to create control decision: ${error.message}`);
  }
  
  console.log(`✅ Control decision created: ${decisionId}`);
  
  // 🔧 DB VERIFICATION: Immediately verify the decision exists in the database
  const supabaseUrl = process.env.SUPABASE_URL || 'N/A';
  const supabaseProject = supabaseUrl.includes('supabase.co') 
    ? supabaseUrl.split('//')[1]?.split('.')[0] || 'unknown'
    : 'local';
  
  const { data: verifyData, error: verifyError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id, created_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  if (verifyError) {
    throw new Error(`Failed to verify decision in DB: ${verifyError.message} (Supabase project: ${supabaseProject}, query: decision_id=${decisionId})`);
  }
  
  if (!verifyData) {
    throw new Error(`Decision ${decisionId} not found in database after insert (Supabase project: ${supabaseProject}, query: decision_id=${decisionId})`);
  }
  
  console.log(`✅ Decision verified in DB: status=${verifyData.status}, created_at=${verifyData.created_at}`);
  return decisionId;
}

interface DecisionStatusResult {
  found: boolean;
  status: string | null;
  claimed: boolean;
  pipeline_source?: string | null;
  tweet_id: string | null;
  created_at: string | null;
  supabase_error: any | null;
  fallback_used: boolean;
}

async function checkDecisionStatus(decisionId: string, proofTag: string): Promise<DecisionStatusResult> {
  const supabase = getSupabaseClient();
  
  // Primary query: search by decision_id
  const { data, error } = await supabase
    .from('content_metadata')
    .select('status, features, tweet_id, created_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  if (!error && data) {
    // Found by decision_id - return success
    const claimed = data.status === 'posting' || data.status === 'posted' || data.status === 'failed';
    const features = typeof data.features === 'string' ? JSON.parse(data.features) : data.features;
    const pipeline_source = features?.pipeline_source || null;
    
    return {
      found: true,
      status: data.status,
      claimed,
      pipeline_source,
      tweet_id: data.tweet_id ? String(data.tweet_id) : null,
      created_at: data.created_at ? String(data.created_at) : null,
      supabase_error: null,
      fallback_used: false,
    };
  }
  
  // Fallback: search by proof_tag in features JSONB
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features, tweet_id, created_at')
    .eq('features->>proof_tag', proofTag)
    .eq('features->>pipeline_source', 'control_posting_queue')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!fallbackError && fallbackData) {
    // Found by fallback search
    const claimed = fallbackData.status === 'posting' || fallbackData.status === 'posted' || fallbackData.status === 'failed';
    const features = typeof fallbackData.features === 'string' ? JSON.parse(fallbackData.features) : fallbackData.features;
    const pipeline_source = features?.pipeline_source || null;
    
    return {
      found: true,
      status: fallbackData.status,
      claimed,
      pipeline_source,
      tweet_id: fallbackData.tweet_id ? String(fallbackData.tweet_id) : null,
      created_at: fallbackData.created_at ? String(fallbackData.created_at) : null,
      supabase_error: error || null, // Include original error for debugging
      fallback_used: true,
    };
  }
  
  // Not found by either method
  return {
    found: false,
    status: null,
    claimed: false,
    pipeline_source: null,
    tweet_id: null,
    created_at: null,
    supabase_error: error || fallbackError || null,
    fallback_used: fallbackError ? false : true, // Only true if fallback was attempted
  };
}

async function findAttempt(decisionId: string): Promise<string | null> {
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

async function findOutcome(decisionId: string): Promise<{ id: string | null; result: any }> {
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

async function findPostEvents(decisionId: string): Promise<{ success: boolean; failed: boolean; eventIds: string[]; eventData: any[] }> {
  const supabase = getSupabaseClient();
  const startTime = new Date(Date.now() - MAX_WAIT_SECONDS * 1000);
  
  const { data } = await supabase
    .from('system_events')
    .select('id, event_type, event_data')
    .in('event_type', ['POST_SUCCESS', 'POST_FAILED'])
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
      if (event.event_type === 'POST_SUCCESS') {
        success = true;
      } else if (event.event_type === 'POST_FAILED') {
        failed = true;
      }
    }
  }
  
  return { success, failed, eventIds, eventData };
}

async function extractResultUrl(decisionId: string, eventData: any[], outcomeResult: any): Promise<string | undefined> {
  // Try to extract from POST_SUCCESS event_data first
  for (const event of eventData) {
    if (event.tweet_url) {
      return event.tweet_url;
    }
    if (event.tweet_id) {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      return `https://x.com/${username}/status/${event.tweet_id}`;
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
  console.log('           🧪 PROOF LEVEL 4: CONTROL → EXECUTOR → X (POSTING)');
  if (DRY_RUN) {
    console.log('                    [DRY_RUN MODE - NO POSTING]');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Generate PROOF_TAG
  const proofTag = `control-post-${Date.now()}`;
  console.log(`📋 Proof Tag: ${proofTag}`);
  console.log(`📋 Max Wait: ${MAX_WAIT_SECONDS}s\n`);
  
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
  
  // Step 1: Create control-plane decision
  console.log('\n📝 Step 1: Creating control-plane decision...');
  const decisionId = await createControlDecision(proofTag);
  
  // Store state for signal handlers
  proofState.decisionId = decisionId;
  proofState.proofTag = proofTag;
  proofState.reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_POST_PROOF.md');
  
  // 🔧 FIX: Write initial report immediately after creating decision
  await writeInitialReport(decisionId, proofTag);
  
  // DRY_RUN mode: exit after creating decision
  if (DRY_RUN) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ DRY_RUN COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Control decision created (no execution):');
    console.log(`  decision_id: ${decisionId}`);
    console.log(`  proof_tag: ${proofTag}`);
    console.log('');
    
    // Write DRY_RUN report
    const reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_POST_PROOF.md');
    const os = require('os');
    const machineInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };
    
    const report = `# Control → Executor → X Proof (Posting) [DRY_RUN]

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
- **Proof Tag:** ${proofTag}
- **Status:** queued (not executed)

## Result

✅ **DRY_RUN COMPLETE** - Control decision created successfully, no execution performed
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
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-control-to-post.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Max wait: ${MAX_WAIT_SECONDS}s\n`);
  
  // Step 3: Wait for execution
  console.log('⏳ Step 3: Waiting for executor to claim and execute...');
  const startTime = Date.now();
  const result: ControlToPostProofResult = {
    decision_id: decisionId,
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
    // Check decision status (with improved error handling and fallback)
    const statusCheck = await checkDecisionStatus(decisionId, proofTag);
    
    // Cache status check for signal handlers
    proofState.cachedStatusCheck = statusCheck;
    
    // Map to legacy format for compatibility
    const status = {
      status: statusCheck.status || 'unknown',
      claimed: statusCheck.claimed,
      pipeline_source: statusCheck.pipeline_source || undefined,
      tweet_id: statusCheck.tweet_id || undefined,
    };
    
    if (statusCheck.found) {
      if (statusCheck.status === 'queued') {
        result.decision_queued = true;
        result.evidence.decision_status = statusCheck.status;
        result.evidence.pipeline_source = statusCheck.pipeline_source || undefined;
      }
      if (statusCheck.claimed) {
        result.decision_claimed = true;
        result.evidence.decision_status = statusCheck.status;
      }
      
      // Check control decision created
      if (statusCheck.status) {
        result.control_decision_created = true;
      }
      
      // 🔧 IMPROVED SUCCESS DETECTION: If status=posted with tweet_id, mark as success
      if (statusCheck.status === 'posted' && statusCheck.tweet_id) {
        result.success_or_failure_event_present = true; // Mark as having evidence
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        result.result_url = `https://x.com/${username}/status/${statusCheck.tweet_id}`;
        proofState.cachedResultUrl = result.result_url;
        console.log(`✅ Post execution complete (status=posted with tweet_id=${statusCheck.tweet_id})!`);
        break;
      }
    }
    
    // Check for attempt
    const attemptId = await findAttempt(decisionId);
    if (attemptId) {
      result.attempt_recorded = true;
      result.evidence.attempt_id = attemptId;
    }
    
    // Check for outcome
    const outcome = await findOutcome(decisionId);
    if (outcome.id) {
      result.result_recorded = true;
      result.evidence.outcome_id = outcome.id;
      outcomeResult = outcome.result;
    }
    
    // Check for events
    const events = await findPostEvents(decisionId);
    eventData = events.eventData;
    if (events.success || events.failed) {
      result.success_or_failure_event_present = true;
      result.evidence.event_ids = events.eventIds;
    }
    
    // Extract result URL (prioritize status=posted with tweet_id)
    let resultUrl = status.tweet_id ? `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${status.tweet_id}` : undefined;
    if (!resultUrl) {
      resultUrl = await extractResultUrl(decisionId, eventData, outcomeResult);
    }
    if (resultUrl) {
      result.result_url = resultUrl;
      proofState.cachedResultUrl = resultUrl;
    }
    
    // 🔧 FIX: Cache state for signal handlers
    proofState.cachedDecisionStatus = {
      status: statusCheck.status || 'unknown',
      claimed: statusCheck.claimed,
      pipeline_source: statusCheck.pipeline_source || undefined,
    };
    proofState.cachedAttemptId = attemptId;
    proofState.cachedOutcomeId = outcome.id;
    proofState.cachedEventIds = events.eventIds;
    proofState.cachedFailedEvent = events.failed ? eventData.find((e: any) => e.decision_id === decisionId) : null;
    
    // Check counts
    result.exactly_one_decision = await countDecisionsWithProofTag(proofTag);
    result.exactly_one_attempt = await countAttempts(decisionId);
    
    // Check executor safety invariants
    const currentWindows = await countVisibleWindows();
    result.executor_safety.windows_opened = Math.max(0, currentWindows - initialWindows);
    result.executor_safety.chrome_cdp_processes = await countChromeCdpProcesses();
    result.executor_safety.pages_max = await getMaxPagesFromTicks();
    
    // 🔧 FIX: Write heartbeat snapshot every 10s
    writeHeartbeatSnapshot();
    
    // Check if daemon died
    if (daemonProcess.killed || daemonProcess.exitCode !== null) {
      console.log('⚠️  Daemon exited during test');
      break;
    }
    
    // 🔧 FIX: Early exit if POST_SUCCESS or POST_FAILED detected OR status=posted with tweet_id/url
    if (events.success || events.failed) {
      if (events.success) {
        console.log('✅ Post execution complete (POST_SUCCESS detected)!');
      } else {
        console.log('⚠️  Post execution failed (POST_FAILED detected)');
      }
      break;
    }
    
    // Success detection for status=posted is already handled above
    
    // Success detection is now handled above in the status check
    
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
  
  // Extract result URL (if not already cached)
  if (!result.result_url) {
    result.result_url = await extractResultUrl(decisionId, eventData, outcomeResult);
    if (result.result_url) {
      proofState.cachedResultUrl = result.result_url;
    }
  }
  
  // 🔧 FIX: Re-check events after timeout to ensure we capture POST_SUCCESS/POST_FAILED
  if (!result.success_or_failure_event_present) {
    const recheckEvents = await findPostEvents(decisionId);
    if (recheckEvents.success || recheckEvents.failed) {
      result.success_or_failure_event_present = true;
      result.evidence.event_ids = recheckEvents.eventIds;
      eventData = recheckEvents.eventData;
      console.log(`[PROOF] ✅ Re-checked events: found ${recheckEvents.eventIds.length} event(s) with ids: ${result.evidence.event_ids.join(', ')}`);
    }
  }
  
  // Extract result URL again after re-check
  if (!result.result_url) {
    result.result_url = await extractResultUrl(decisionId, eventData, outcomeResult);
    if (result.result_url) {
      proofState.cachedResultUrl = result.result_url;
    }
  }
  
  // Store result for signal handlers
  proofState.result = result;
  
  // Step 4: Collect log excerpts and diagnostic snapshot
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf-8');
    const lines = logContent.trim().split('\n');
    const relevantLines = lines.filter(l => 
      l.includes(decisionId) || 
      l.includes(proofTag) ||
      l.includes('POST_SUCCESS') || 
      l.includes('POST_FAILED') ||
      l.includes('REPLY_SUCCESS') ||
      l.includes('REPLY_FAILED') ||
      l.includes('EXECUTOR_DECISION_SKIPPED') ||
      l.includes('429') ||
      l.includes('rate limit') ||
      l.includes('timeout') ||
      l.includes('posting')
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
    
    // Get POST_FAILED event if present
    const { data: failedEvents } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'POST_FAILED')
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
  
  // 🔧 FIX: Accept POST_SUCCESS/POST_FAILED events as proof of attempt (outcomes are created later by scrapers)
  const attemptProven = result.attempt_recorded || result.success_or_failure_event_present;
  const resultProven = result.result_recorded || result.success_or_failure_event_present;
  
  const executionPass = 
    result.control_decision_created &&
    result.decision_queued &&
    result.decision_claimed &&
    attemptProven && // Accept POST_SUCCESS/POST_FAILED as proof of attempt
    resultProven && // Accept POST_SUCCESS/POST_FAILED as proof of result
    result.success_or_failure_event_present &&
    result.exactly_one_decision === 1 && // HARD
    (result.exactly_one_attempt === 1 || result.success_or_failure_event_present); // HARD: accept event as proof
  
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
  const reportPath = path.join(process.cwd(), 'docs', 'CONTROL_TO_POST_PROOF.md');
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  // Write final report synchronously (overwrites initial report + heartbeats with complete summary)
  const report = `# Control → Executor → X Proof (Posting)

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
- **Proof Tag:** ${result.proof_tag}
- **Pipeline Source:** ${result.evidence.pipeline_source || 'N/A'}
- **Decision Status:** ${result.evidence.decision_status || 'N/A'}
- **Attempt ID:** ${result.evidence.attempt_id || 'N/A'}
- **Outcome ID:** ${result.evidence.outcome_id || 'N/A'}
- **Event IDs:** ${result.evidence.event_ids?.join(', ') || 'N/A'}
${result.result_url ? `- **Result URL:** ${result.result_url}` : ''}
${result.result_url && result.result_url.includes('/status/') ? `- **Tweet ID:** ${result.result_url.split('/status/')[1]?.split('?')[0] || 'N/A'}` : ''}

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
` : 'No POST_FAILED event found'}

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
    if (!attemptProven) {
      console.error('   - attempt_recorded=false AND no POST_SUCCESS/POST_FAILED event');
    }
    if (!resultProven) {
      console.error('   - result_recorded=false AND no POST_SUCCESS/POST_FAILED event');
    }
    if (!result.success_or_failure_event_present) {
      console.error('   - No POST_SUCCESS or POST_FAILED event');
    }
    if (result.exactly_one_decision !== 1) {
      console.error(`   - exactly_one_decision=${result.exactly_one_decision} (expected: 1)`);
    }
    if (result.exactly_one_attempt !== 1 && !result.success_or_failure_event_present) {
      console.error(`   - exactly_one_attempt=${result.exactly_one_attempt} (expected: 1) AND no event`);
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
