#!/usr/bin/env tsx
/**
 * 🧪 PROOF Phase 5A.4: Stability Under Real Load - SMOKE TEST (10 minutes)
 * 
 * Quick smoke test to validate daemon stability and workload processing before full 2-hour proof.
 * 
 * Usage:
 *   pnpm run executor:prove:stability-smoke
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

// Duration: configurable via env var, default 10 minutes for smoke test
const PROOF_DURATION_MINUTES = parseInt(process.env.PROOF_DURATION_MINUTES || '10', 10);
const PROOF_DURATION_SECONDS = PROOF_DURATION_MINUTES * 60;
const PROOF_TAG = `stability-smoke-${Date.now()}`;

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
 * Check for workload progress (content_metadata transitions from queued to posted/posting)
 */
async function checkWorkloadProgress(supabase: any, startTime: number): Promise<{
  hasProgress: boolean;
  progressCount: number;
  progressDetails: Array<{ decision_id: string; status: string; updated_at: string }>;
}> {
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
  
  const validProgress = progressEntries.filter(entry => {
    const createdAt = new Date(entry.created_at).getTime();
    return createdAt <= startTime + (PROOF_DURATION_SECONDS * 1000);
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
  console.log(`   🧪 PROOF Phase 5A.4: Stability Smoke Test (${PROOF_DURATION_MINUTES} minutes)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Proof Tag: ${PROOF_TAG}`);
  console.log(`⏱️  Duration: ${PROOF_DURATION_MINUTES} minutes (${PROOF_DURATION_SECONDS} seconds)\n`);
  
  const reportPath = getImmutableReportPath(PROOF_TAG);
  
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
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-stability-smoke.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  // Capture daemon stderr separately
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
  
  const bootDeadline = startTime + 20 * 1000;
  const readyDeadline = startTime + 90 * 1000;
  const endTime = startTime + PROOF_DURATION_SECONDS * 1000;
  
  let lastHealthOkTime: number | null = null;
  let maxHealthOkGap = 0;
  
  const pollInterval = 10000; // Poll every 10 seconds
  
  console.log('⏳ Monitoring executor stability and workload progress...\n');
  
  if (fs.existsSync(STOP_SWITCH_PATH)) {
    console.log('🔧 Preflight: Clearing STOP switch for proof run...');
    fs.unlinkSync(STOP_SWITCH_PATH);
  }
  
  while (Date.now() < endTime) {
    if (terminationReason?.signal) {
      console.error(`\n⚠️  Proof script received ${terminationReason.signal} - exiting loop`);
      break;
    }
    
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const remainingSeconds = Math.floor((endTime - Date.now()) / 1000);
    
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
    
    // Check for HEALTH_OK events
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
        
        // Log progress every 2 minutes
        if (elapsedSeconds % 120 === 0 && elapsedSeconds > 0) {
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
    const { data: exhaustionEvents } = await supabase
      .from('system_events')
      .select('id, created_at, event_data')
      .in('event_type', ['EXECUTOR_HEALTH_DEGRADED', 'BROWSER_POOL_EXHAUSTED', 'BROWSER_POOL_SATURATED'])
      .gte('created_at', new Date(startTime).toISOString())
      .limit(10);
    
    if (exhaustionEvents && exhaustionEvents.length > 0) {
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
      
      try {
        const logContent = fs.readFileSync(logFile, 'utf-8');
        const logLines = logContent.split('\n');
        terminationReason.daemonStderr = daemonStderr.substring(daemonStderr.length - 2000);
        terminationReason.lastLogLines = logLines.slice(-50).join('\n');
      } catch (logError: any) {
        console.warn(`⚠️  Failed to read log file: ${logError.message}`);
      }
      
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  // Smoke test: require at least 1 HEALTH_OK event and no gaps >90s
  const idealHealthOk = Math.floor(PROOF_DURATION_SECONDS / 60);
  const minHealthOkWithTolerance = Math.max(1, Math.floor(idealHealthOk * 0.5)); // 50% tolerance for smoke test
  const actualHealthOk = healthOkEvents.length;
  
  const healthOkPass = maxHealthOkGap <= 90 && actualHealthOk >= minHealthOkWithTolerance;
  
  const finalGap = lastHealthOkTime ? (Date.now() - lastHealthOkTime) / 1000 : Infinity;
  const finalGapPass = finalGap <= 90;
  
  const durationCompleted = Date.now() >= endTime;
  
  workloadProgress = await checkWorkloadProgress(supabase, startTime);
  
  // Stop daemon
  console.log('\n🛑 Stopping daemon...');
  fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
  await new Promise(resolve => setTimeout(resolve, 5000));
  if (daemonProcess.exitCode === null) {
    daemonProcess.kill();
  }
  
  const pass = bootSeen && readySeen && healthOkPass && finalGapPass && !hasCrash && !hasBrowserPoolExhaustion && workloadProgress.hasProgress && durationCompleted;
  
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  
  const report = `# Stability Smoke Test Proof (Phase 5A.4)

**Date:** ${new Date().toISOString()}  
**Status:** ${pass ? '✅ PASS' : '❌ FAIL'}
**Proof Tag:** ${PROOF_TAG}
**Duration:** ${PROOF_DURATION_MINUTES} minutes (actual: ${elapsedMinutes} minutes)

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Boot Event (20s) | ${bootSeen ? '✅' : '❌'} | ${bootEventId || 'N/A'} | HARD |
| Ready Event (90s) | ${readySeen ? '✅' : '❌'} | ${readyEventId || 'N/A'} | HARD |
| Health OK Events (≥1) | ${healthOkPass ? '✅' : '❌'} | ${actualHealthOk} events (min: ≥${minHealthOkWithTolerance}) | HARD |
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
- **Max Health OK Gap:** ${maxHealthOkGap.toFixed(1)}s
- **Final Gap:** ${finalGap.toFixed(1)}s
- **Workload Progress:** ${workloadProgress.hasProgress ? `Yes (${workloadProgress.progressCount} transition(s))` : 'No'}
${workloadProgress.progressDetails.length > 0 ? `- **Progress Details:** ${workloadProgress.progressDetails.map(p => `${p.decision_id} (${p.status})`).join(', ')}` : ''}

## Result

${pass ? '✅ **PASS** - Smoke test passed. Daemon stable, health events emitted, workload processing confirmed.' : '❌ **FAIL** - Smoke test failed. See details above.'}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  if (!pass) {
    console.error('\n❌ SMOKE TEST FAILED:');
    if (!bootSeen) console.error('   - Boot event not seen within 20s');
    if (!readySeen) console.error('   - Ready event not seen within 90s');
    if (!healthOkPass) console.error(`   - Health OK events: ${actualHealthOk} (expected: ≥${minHealthOkWithTolerance})`);
    if (maxHealthOkGap > 90) console.error(`   - Max Health OK gap: ${maxHealthOkGap.toFixed(1)}s (max allowed: 90s)`);
    if (finalGap > 90) console.error(`   - Final gap: ${finalGap.toFixed(1)}s (max allowed: 90s)`);
    if (hasCrash) console.error(`   - Crash event detected: ${crashEventId}`);
    if (hasBrowserPoolExhaustion) console.error('   - Browser pool exhaustion detected');
    if (!workloadProgress.hasProgress) console.error(`   - Workload progress: No content_metadata transitions found`);
    if (!durationCompleted) console.error(`   - Duration not completed: ${elapsedMinutes}/${PROOF_DURATION_MINUTES} minutes`);
    process.exit(1);
  }
  
  console.log(`\n✅ Smoke test passed: ${actualHealthOk} HEALTH_OK events over ${elapsedMinutes} minutes, ${workloadProgress.progressCount} workload progress transition(s)`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
