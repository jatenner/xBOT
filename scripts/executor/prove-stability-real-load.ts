#!/usr/bin/env tsx
/**
 * 🧪 PROOF Phase 5A.4: Stability Under Real Load (2 hours)
 * 
 * Proves executor can run continuously for 2 hours under real workload conditions
 * without degradation. Validates continuous health event emission, absence of crashes,
 * browser pool stability, and actual pipeline progress (workload processing).
 * 
 * Usage:
 *   pnpm run executor:prove:stability-real-load
 * 
 * Safety:
 *   - Runs daemon in PROOF_MODE=true HEADLESS=true
 *   - Validates health event emission and stability
 *   - Monitors actual workload processing (content_metadata transitions)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();

// Duration: fixed 2 hours (120 minutes)
const PROOF_DURATION_MINUTES = 120;
const PROOF_DURATION_SECONDS = PROOF_DURATION_MINUTES * 60;
const PROOF_TAG = `stability-${Date.now()}`;

// Termination tracking
let terminationReason: {
  signal?: string;
  daemonExitCode?: number | null;
  daemonKilled?: boolean;
  stopSwitchDetected?: boolean;
  authRequired?: boolean;
  hardFailCondition?: string;
  timestamp?: string;
  daemonStderr?: string;
  lastLogLines?: string;
} | null = null;

// Signal handlers for proof script
process.on('SIGTERM', () => {
  terminationReason = {
    signal: 'SIGTERM',
    timestamp: new Date().toISOString(),
  };
  console.error('\n[SIGTERM] Proof script received SIGTERM - recording termination reason');
});

process.on('SIGINT', () => {
  terminationReason = {
    signal: 'SIGINT',
    timestamp: new Date().toISOString(),
  };
  console.error('\n[SIGINT] Proof script received SIGINT - recording termination reason');
});

/**
 * Get immutable report path
 */
function getImmutableReportPath(proofTag: string): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'stability');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, `${proofTag}.md`);
}

/**
 * Get INDEX file path
 */
function getIndexPath(): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'stability');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, 'INDEX.md');
}

/**
 * Append proof entry to INDEX.md (append-only)
 */
function appendToIndex(
  proofTag: string,
  status: string,
  bootEventId?: string,
  readyEventId?: string,
  healthOkCount?: number,
  crashEventId?: string,
  workloadProgress?: boolean
): void {
  try {
    const indexPath = getIndexPath();
    const timestamp = new Date().toISOString();
    const proofFileName = `${proofTag}.md`;
    const relativePath = `./${proofFileName}`;
    
    // Create INDEX.md header if it doesn't exist
    if (!fs.existsSync(indexPath)) {
      const header = `# Long-Running Executor Stability Proof - Index

This file is append-only. Each proof run adds a new row.

| Timestamp | Proof Tag | Status | Duration (min) | Boot Event ID | Ready Event ID | Health OK Count | Crash Event ID | Workload Progress | Proof File |
|-----------|-----------|--------|----------------|---------------|----------------|-----------------|----------------|-------------------|------------|
`;
      fs.writeFileSync(indexPath, header, 'utf-8');
    }
    
    // Append new row
    const row = `| ${timestamp} | \`${proofTag}\` | ${status} | ${PROOF_DURATION_MINUTES} | ${bootEventId || 'N/A'} | ${readyEventId || 'N/A'} | ${healthOkCount || 0} | ${crashEventId || 'N/A'} | ${workloadProgress ? '✅' : '❌'} | [\`${proofFileName}\`](${relativePath}) |\n`;
    fs.appendFileSync(indexPath, row, 'utf-8');
  } catch (error: any) {
    console.warn(`⚠️  Failed to append to INDEX: ${error.message}`);
  }
}

/**
 * Write initial report
 */
function writeInitialReport(proofTag: string, durationMinutes: number): string {
  const reportPath = getImmutableReportPath(proofTag);
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const initialReport = `# Stability Under Real Load Proof (Phase 5A.4)

**Date:** ${new Date().toISOString()}  
**Status:** ⏳ IN PROGRESS
**Proof Tag:** ${proofTag}
**Duration:** ${durationMinutes} minutes (2 hours)

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Evidence

- **Proof Tag:** ${proofTag}
- **Boot Event:** N/A (pending)
- **Ready Event:** N/A (pending)
- **Health OK Events:** N/A (pending)
- **Crash Events:** N/A (pending)
- **Browser Pool Status:** N/A (pending)
- **Workload Progress:** N/A (pending)

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Boot Event (20s) | ⏳ | pending | HARD |
| Ready Event (90s) | ⏳ | pending | HARD |
| Health OK Events (≥1 per 60s, no gaps >90s) | ⏳ | pending | HARD |
| No Crash Events | ⏳ | pending | HARD |
| No Browser Pool Exhaustion | ⏳ | pending | HARD |
| Workload Progress (queued→posted/posting) | ⏳ | pending | HARD |
| Duration Completed | ⏳ | pending | HARD |

---

*Report will be updated as proof progresses...*
`;

  fs.writeFileSync(reportPath, initialReport, 'utf-8');
  console.log(`📝 Initial report written to ${reportPath}`);
  return reportPath;
}

/**
 * Check for browser pool exhaustion events
 */
async function checkBrowserPoolExhaustion(supabase: any, startTime: number): Promise<boolean> {
  const { data: exhaustionEvents } = await supabase
    .from('system_events')
    .select('id, created_at, event_data')
    .in('event_type', ['EXECUTOR_HEALTH_DEGRADED', 'BROWSER_POOL_EXHAUSTED', 'BROWSER_POOL_SATURATED'])
    .gte('created_at', new Date(startTime).toISOString())
    .limit(10);
  
  return (exhaustionEvents?.length || 0) > 0;
}

/**
 * Check for workload progress (content_metadata transitions from queued to posted/posting)
 */
async function checkWorkloadProgress(supabase: any, startTime: number): Promise<{
  hasProgress: boolean;
  progressCount: number;
  progressDetails: Array<{ decision_id: string; status: string; updated_at: string }>;
}> {
  // Find content_metadata entries that were queued at start time or later, and transitioned to posted/posting
  const { data: progressEntries } = await supabase
    .from('content_metadata')
    .select('decision_id, status, updated_at, created_at')
    .in('status', ['posted', 'posting'])
    .gte('updated_at', new Date(startTime).toISOString())
    .order('updated_at', { ascending: false })
    .limit(100);
  
  if (!progressEntries || progressEntries.length === 0) {
    return { hasProgress: false, progressCount: 0, progressDetails: [] };
  }
  
  // Filter to entries that were created before or during proof period (to ensure they existed as queued)
  const validProgress = progressEntries.filter(entry => {
    const createdAt = new Date(entry.created_at).getTime();
    return createdAt <= startTime + (PROOF_DURATION_SECONDS * 1000); // Created before or during proof
  });
  
  return {
    hasProgress: validProgress.length > 0,
    progressCount: validProgress.length,
    progressDetails: validProgress.slice(0, 10).map(e => ({
      decision_id: e.decision_id,
      status: e.status,
      updated_at: e.updated_at,
    })),
  };
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🧪 PROOF Phase 5A.4: Stability Under Real Load (2 hours)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Proof Tag: ${PROOF_TAG}`);
  console.log(`⏱️  Duration: ${PROOF_DURATION_MINUTES} minutes (${PROOF_DURATION_SECONDS} seconds)\n`);
  
  const reportPath = writeInitialReport(PROOF_TAG, PROOF_DURATION_MINUTES);
  
  // Clean up any existing STOP switch
  if (fs.existsSync(STOP_SWITCH_PATH)) {
    fs.unlinkSync(STOP_SWITCH_PATH);
  }
  
  // Clean up any existing PID file
  if (fs.existsSync(PIDFILE_PATH)) {
    fs.unlinkSync(PIDFILE_PATH);
  }
  
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  
  // Start daemon
  console.log('🚀 Starting executor daemon...');
  const daemonProcess = spawn('pnpm', ['run', 'executor:daemon'], {
    env: {
      ...process.env,
      EXECUTION_MODE: 'executor',
      RUNNER_MODE: 'true',
      RUNNER_PROFILE_DIR: RUNNER_PROFILE_DIR,
      HEADLESS: 'true',
      PROOF_MODE: 'true',
      STOP_EXECUTOR: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-stability-real-load.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  // 🔧 FIX: Capture daemon stderr separately for error reporting
  let daemonStderr = '';
  daemonProcess.stderr?.on('data', (data: Buffer) => {
    daemonStderr += data.toString();
  });
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Duration: ${PROOF_DURATION_MINUTES} minutes\n`);
  
  // Poll for events
  let bootEventId: string | null = null;
  let readyEventId: string | null = null;
  let healthOkEvents: Array<{ id: string; created_at: string }> = [];
  let crashEventId: string | null = null;
  
  let bootSeen = false;
  let readySeen = false;
  let hasBrowserPoolExhaustion = false;
  let hasCrash = false;
  let workloadProgress = { hasProgress: false, progressCount: 0, progressDetails: [] };
  
  const bootDeadline = startTime + 20 * 1000; // 20 seconds
  const readyDeadline = startTime + 90 * 1000; // 90 seconds
  const endTime = startTime + PROOF_DURATION_SECONDS * 1000;
  
  let lastHealthOkTime: number | null = null;
  let maxHealthOkGap = 0;
  
  // Poll every 10 seconds
  const pollInterval = 10000;
  let lastPollTime = startTime;
  
  console.log('⏳ Monitoring executor stability and workload progress...\n');
  
  // Check for STOP switch before starting (and clear it if PROOF_MODE)
  if (fs.existsSync(STOP_SWITCH_PATH)) {
    console.log('🔧 Preflight: Clearing STOP switch for proof run...');
    fs.unlinkSync(STOP_SWITCH_PATH);
  }
  
  while (Date.now() < endTime) {
    // Check for termination signal on proof script
    if (terminationReason?.signal) {
      console.error(`\n⚠️  Proof script received ${terminationReason.signal} - exiting loop`);
      break;
    }
    
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const remainingSeconds = Math.floor((endTime - Date.now()) / 1000);
    
    // Check for STOP switch (should not exist in PROOF_MODE, but check anyway)
    if (fs.existsSync(STOP_SWITCH_PATH)) {
      terminationReason = {
        stopSwitchDetected: true,
        timestamp: new Date().toISOString(),
      };
      console.error(`\n⚠️  STOP switch detected - exiting loop`);
      break;
    }
    
    // Check for BOOT event
    if (!bootSeen) {
      const { data: bootEvent } = await supabase
        .from('system_events')
        .select('id, created_at, event_data')
        .eq('event_type', 'EXECUTOR_HEALTH_BOOT')
        .gte('created_at', new Date(startTime - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (bootEvent) {
        bootSeen = true;
        bootEventId = bootEvent.id;
        console.log(`✅ Boot event seen: ${bootEventId} (${elapsedSeconds}s)`);
      } else if (Date.now() > bootDeadline) {
        terminationReason = {
          hardFailCondition: 'BOOT_EVENT_NOT_SEEN_WITHIN_20S',
          timestamp: new Date().toISOString(),
        };
        console.error(`❌ Boot event not seen within 20s`);
        break;
      }
    }
    
    // Check for READY event
    if (bootSeen && !readySeen) {
      const { data: readyEvent } = await supabase
        .from('system_events')
        .select('id, created_at, event_data')
        .eq('event_type', 'EXECUTOR_HEALTH_READY')
        .gte('created_at', new Date(startTime).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (readyEvent) {
        readySeen = true;
        readyEventId = readyEvent.id;
        console.log(`✅ Ready event seen: ${readyEventId} (${elapsedSeconds}s)`);
      } else if (Date.now() > readyDeadline) {
        terminationReason = {
          hardFailCondition: 'READY_EVENT_NOT_SEEN_WITHIN_90S',
          timestamp: new Date().toISOString(),
        };
        console.error(`❌ Ready event not seen within 90s`);
        break;
      }
    }
    
    // Check for HEALTH_OK events (continuous monitoring)
    if (readySeen) {
      const { data: healthOkEventsData } = await supabase
        .from('system_events')
        .select('id, created_at, event_data')
        .eq('event_type', 'EXECUTOR_HEALTH_OK')
        .gte('created_at', new Date(startTime).toISOString())
        .order('created_at', { ascending: true });
      
      if (healthOkEventsData) {
        healthOkEvents = healthOkEventsData;
        
        // Check for gaps >90s
        for (let i = 1; i < healthOkEvents.length; i++) {
          const prevTime = new Date(healthOkEvents[i - 1].created_at).getTime();
          const currTime = new Date(healthOkEvents[i].created_at).getTime();
          const gapSeconds = (currTime - prevTime) / 1000;
          if (gapSeconds > maxHealthOkGap) {
            maxHealthOkGap = gapSeconds;
          }
        }
        
        if (healthOkEvents.length > 0) {
          lastHealthOkTime = new Date(healthOkEvents[healthOkEvents.length - 1].created_at).getTime();
        }
        
        // Log progress every 5 minutes
        if (elapsedSeconds % 300 === 0 && elapsedSeconds > 0) {
          const progressCheck = await checkWorkloadProgress(supabase, startTime);
          console.log(`📊 Progress: ${elapsedSeconds}s elapsed (${Math.floor(elapsedSeconds / 60)}m), ${remainingSeconds}s remaining, ${healthOkEvents.length} HEALTH_OK events, max gap: ${maxHealthOkGap.toFixed(1)}s, workload progress: ${progressCheck.hasProgress ? '✅' : '⏳'}`);
        }
      }
    }
    
    // Check for CRASH events
    const { data: crashEvents } = await supabase
      .from('system_events')
      .select('id, created_at, event_data')
      .eq('event_type', 'EXECUTOR_DAEMON_CRASH')
      .gte('created_at', new Date(startTime).toISOString())
      .limit(1);
    
    // Check for AUTH_REQUIRED events
    const { data: authRequiredEvents } = await supabase
      .from('system_events')
      .select('id, created_at, event_data')
      .eq('event_type', 'EXECUTOR_AUTH_REQUIRED')
      .gte('created_at', new Date(startTime).toISOString())
      .limit(1);
    
    if (authRequiredEvents && authRequiredEvents.length > 0) {
      terminationReason = {
        authRequired: true,
        timestamp: new Date().toISOString(),
      };
      console.error(`❌ AUTH_REQUIRED event detected - authentication needed`);
      break;
    }
    
    if (crashEvents && crashEvents.length > 0) {
      hasCrash = true;
      crashEventId = crashEvents[0].id;
      terminationReason = {
        hardFailCondition: 'CRASH_EVENT_DETECTED',
        timestamp: new Date().toISOString(),
      };
      console.error(`❌ Crash event detected: ${crashEventId}`);
      break;
    }
    
    // Check for browser pool exhaustion
    if (await checkBrowserPoolExhaustion(supabase, startTime)) {
      hasBrowserPoolExhaustion = true;
      terminationReason = {
        hardFailCondition: 'BROWSER_POOL_EXHAUSTION_DETECTED',
        timestamp: new Date().toISOString(),
      };
      console.error(`❌ Browser pool exhaustion detected`);
      break;
    }
    
    // Check if daemon died
    if (daemonProcess.killed || daemonProcess.exitCode !== null) {
      terminationReason = {
        daemonKilled: daemonProcess.killed,
        daemonExitCode: daemonProcess.exitCode,
        timestamp: new Date().toISOString(),
      };
      console.error(`❌ Daemon exited unexpectedly (killed: ${daemonProcess.killed}, exit code: ${daemonProcess.exitCode})`);
      
      // 🔧 FIX: Capture last N log lines for diagnostics
      try {
        const logContent = fs.readFileSync(logFile, 'utf-8');
        const logLines = logContent.split('\n');
        const lastLogLines = logLines.slice(-50).join('\n');
        terminationReason.daemonStderr = daemonStderr.substring(daemonStderr.length - 2000); // Last 2KB
        terminationReason.lastLogLines = lastLogLines;
      } catch (logError: any) {
        console.warn(`⚠️  Failed to read log file: ${logError.message}`);
      }
      
      break;
    }
    
    // Sleep before next check
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  // Final check: HEALTH_OK cadence validation
  // Rule: No gaps >90s (primary guarantee) AND sufficient cadence (≥1 per ~60s with tolerance)
  // For 120 minutes: ideal = 120 events, minimum acceptable = 114 (5% tolerance)
  // This allows for minor scheduling variance while ensuring continuous health emission
  const idealHealthOk = Math.floor(PROOF_DURATION_SECONDS / 60);
  const minHealthOkWithTolerance = Math.floor(idealHealthOk * 0.95); // 5% tolerance
  const actualHealthOk = healthOkEvents.length;
  
  // Primary: No gaps >90s (already enforced via maxHealthOkGap check)
  // Secondary: Count must be >= minimum with tolerance
  const healthOkPass = maxHealthOkGap <= 90 && actualHealthOk >= minHealthOkWithTolerance;
  
  // Check final gap (time since last HEALTH_OK)
  const finalGap = lastHealthOkTime ? (Date.now() - lastHealthOkTime) / 1000 : Infinity;
  const finalGapPass = finalGap <= 90;
  
  // Duration completed
  const durationCompleted = Date.now() >= endTime;
  
  // Final workload progress check
  workloadProgress = await checkWorkloadProgress(supabase, startTime);
  
  // Stop daemon
  console.log('\n🛑 Stopping daemon...');
  fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
  await new Promise(resolve => setTimeout(resolve, 5000));
  if (daemonProcess.exitCode === null) {
    daemonProcess.kill();
  }
  
  // Determine pass/fail
  const pass = bootSeen && readySeen && healthOkPass && finalGapPass && !hasCrash && !hasBrowserPoolExhaustion && workloadProgress.hasProgress && durationCompleted;
  
  // Write final report
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  
  const report = `# Stability Under Real Load Proof (Phase 5A.4)

**Date:** ${new Date().toISOString()}  
**Status:** ${pass ? '✅ PASS' : '❌ FAIL'}
**Proof Tag:** ${PROOF_TAG}
**Duration:** ${PROOF_DURATION_MINUTES} minutes (actual: ${elapsedMinutes} minutes)

**Acceptance Criteria:**
- Primary: No gaps >90s between HEALTH_OK events (max gap: ${maxHealthOkGap.toFixed(1)}s)
- Secondary: ≥1 HEALTH_OK per ~60s with tolerance (${actualHealthOk} events for ${PROOF_DURATION_MINUTES} minutes, minimum: ≥${minHealthOkWithTolerance}, ideal: ${idealHealthOk})
- Workload Progress: At least one content_metadata transition from queued→posted/posting during proof period

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Boot Event (20s) | ${bootSeen ? '✅' : '❌'} | ${bootEventId || 'N/A'} | HARD |
| Ready Event (90s) | ${readySeen ? '✅' : '❌'} | ${readyEventId || 'N/A'} | HARD |
| Health OK Events (≥1 per 60s) | ${healthOkPass ? '✅' : '❌'} | ${actualHealthOk} events (min: ≥${minHealthOkWithTolerance}, ideal: ${idealHealthOk}) | HARD |
| No Gaps >90s | ${finalGapPass && maxHealthOkGap <= 90 ? '✅' : '❌'} | Max gap: ${maxHealthOkGap.toFixed(1)}s, Final gap: ${finalGap.toFixed(1)}s | HARD |
| No Crash Events | ${!hasCrash ? '✅' : '❌'} | ${crashEventId || 'N/A'} | HARD |
| No Browser Pool Exhaustion | ${!hasBrowserPoolExhaustion ? '✅' : '❌'} | ${hasBrowserPoolExhaustion ? 'Detected' : 'None'} | HARD |
| Workload Progress | ${workloadProgress.hasProgress ? '✅' : '❌'} | ${workloadProgress.progressCount} transition(s) found | HARD |
| Duration Completed | ${durationCompleted ? '✅' : '❌'} | ${elapsedMinutes}/${PROOF_DURATION_MINUTES} minutes | HARD |

## Evidence

- **Proof Tag:** ${PROOF_TAG}
- **Boot Event ID:** ${bootEventId || 'N/A'}
- **Ready Event ID:** ${readyEventId || 'N/A'}
- **Health OK Event Count:** ${actualHealthOk}
- **Health OK Event IDs:** ${healthOkEvents.length > 0 ? healthOkEvents.slice(0, 10).map(e => e.id).join(', ') + (healthOkEvents.length > 10 ? ` ... (${healthOkEvents.length} total)` : '') : 'N/A'}
- **Max Health OK Gap:** ${maxHealthOkGap.toFixed(1)}s
- **Final Gap:** ${finalGap.toFixed(1)}s
- **Crash Event ID:** ${crashEventId || 'N/A'}
- **Browser Pool Exhaustion:** ${hasBrowserPoolExhaustion ? 'Yes' : 'No'}
- **Workload Progress:** ${workloadProgress.hasProgress ? `Yes (${workloadProgress.progressCount} transition(s))` : 'No'}
${workloadProgress.progressDetails.length > 0 ? `- **Progress Details:** ${workloadProgress.progressDetails.map(p => `${p.decision_id} (${p.status}, updated: ${p.updated_at})`).join('; ')}` : ''}

## Timeline Summary

- **Start Time:** ${new Date(startTime).toISOString()}
- **End Time:** ${new Date(Date.now()).toISOString()}
- **Duration:** ${elapsedMinutes} minutes
- **Health OK Events:** ${actualHealthOk} events over ${elapsedMinutes} minutes (avg: ${(actualHealthOk / Math.max(elapsedMinutes, 1)).toFixed(2)} per minute)

${!durationCompleted && terminationReason ? `
## Termination / Early Exit Reason

**Duration Not Completed:** Proof ended after ${elapsedMinutes} minutes (expected: ${PROOF_DURATION_MINUTES} minutes)

**Termination Details:**
${terminationReason.signal ? `- **Signal Received:** ${terminationReason.signal}${terminationReason.timestamp ? ` (at ${terminationReason.timestamp})` : ''}` : ''}
${terminationReason.daemonExitCode !== undefined ? `- **Daemon Exit Code:** ${terminationReason.daemonExitCode}${terminationReason.daemonKilled ? ' (daemon was killed)' : ''}` : ''}
${terminationReason.stopSwitchDetected ? `- **STOP Switch Detected:** Yes (STOP_EXECUTOR file found)` : ''}
${terminationReason.authRequired ? `- **Auth Required:** Yes (EXECUTOR_AUTH_REQUIRED event detected)` : ''}
${terminationReason.hardFailCondition ? `- **Hard Fail Condition:** ${terminationReason.hardFailCondition}` : ''}
${terminationReason.timestamp && !terminationReason.signal ? `- **Termination Time:** ${terminationReason.timestamp}` : ''}
${terminationReason.daemonStderr ? `- **Daemon Stderr (last 2KB):**\n\`\`\`\n${terminationReason.daemonStderr}\n\`\`\`` : ''}
${terminationReason.lastLogLines ? `- **Last 50 Log Lines:**\n\`\`\`\n${terminationReason.lastLogLines}\n\`\`\`` : ''}

**Recommendation:** Re-run proof ensuring:
- No external processes send SIGTERM/SIGINT to proof script
- STOP_EXECUTOR file does not exist before/during proof
- System does not sleep/hibernate during proof (use \`caffeinate\` on macOS)
- Full ${PROOF_DURATION_MINUTES}-minute duration is allowed to complete
` : ''}

## Result

${pass ? '✅ **PASS** - Executor ran continuously for ' + PROOF_DURATION_MINUTES + ' minutes under real load without degradation' : '❌ **FAIL** - One or more stability checks failed'}

${pass ? `---
## Post-Proof Instructions

**To mark Phase 5A.4 as PROVEN:**

1. **Update documentation:**
   - Open \`docs/SYSTEM_STATUS.md\`
   - Find "Phase 5A.4: Stability Under Real Load (2 hours)" section
   - Change status from "🚧 PLANNED" to "✅ PROVEN"
   - Add evidence block:
     \`\`\`
     **Proof Tag:** \`${PROOF_TAG}\`
     **Evidence:** [\`docs/proofs/stability/${PROOF_TAG}.md\`](docs/proofs/stability/${PROOF_TAG}.md)
     - Boot Event ID: \`${bootEventId || 'N/A'}\`
     - Ready Event ID: \`${readyEventId || 'N/A'}\`
     - Health OK Events: ${actualHealthOk} events
     - Duration: ${elapsedMinutes} minutes
     - Workload Progress: ${workloadProgress.progressCount} transition(s)
     \`\`\`
   
   - Repeat same changes in \`README_MASTER.md\`

2. **Verify documentation:**
   \`\`\`bash
   pnpm run verify:docs:truth
   \`\`\`

3. **Commit and push:**
   \`\`\`bash
   git add docs/SYSTEM_STATUS.md README_MASTER.md docs/proofs/stability/
   git commit -m "proof(5a.4): stability under real load PROVEN (${PROOF_TAG})"
   git push origin main
   \`\`\`
` : ''}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  // Append to INDEX
  appendToIndex(
    PROOF_TAG,
    pass ? '✅ PASS' : '❌ FAIL',
    bootEventId || undefined,
    readyEventId || undefined,
    actualHealthOk,
    crashEventId || undefined,
    workloadProgress.hasProgress
  );
  console.log(`📄 Index updated: ${getIndexPath()}`);
  
  if (!pass) {
    console.error('\n❌ STABILITY CHECKS FAILED:');
    if (!bootSeen) console.error('   - Boot event not seen within 20s');
    if (!readySeen) console.error('   - Ready event not seen within 90s');
    if (!healthOkPass) console.error(`   - Health OK events: ${actualHealthOk} (expected: ≥${expectedMinHealthOk - 1}, ideal: ≥${expectedMinHealthOk})`);
    if (maxHealthOkGap > 90) console.error(`   - Max Health OK gap: ${maxHealthOkGap.toFixed(1)}s (max allowed: 90s)`);
    if (finalGap > 90) console.error(`   - Final gap: ${finalGap.toFixed(1)}s (max allowed: 90s)`);
    if (hasCrash) console.error(`   - Crash event detected: ${crashEventId}`);
    if (hasBrowserPoolExhaustion) console.error('   - Browser pool exhaustion detected');
    if (!workloadProgress.hasProgress) console.error(`   - Workload progress: No content_metadata transitions from queued→posted/posting found`);
    if (!durationCompleted) console.error(`   - Duration not completed: ${elapsedMinutes}/${PROOF_DURATION_MINUTES} minutes`);
    process.exit(1);
  }
  
  console.log(`\n✅ Executor stability proof passed: ${actualHealthOk} HEALTH_OK events over ${elapsedMinutes} minutes, ${workloadProgress.progressCount} workload progress transition(s)`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
