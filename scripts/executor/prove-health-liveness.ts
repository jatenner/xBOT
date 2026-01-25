#!/usr/bin/env tsx
/**
 * 🧪 PROOF Phase 5A.1: Executor Health & Liveness
 * 
 * Proves executor daemon health and liveness signals are working correctly.
 * 
 * Usage:
 *   pnpm run executor:prove:health-liveness
 * 
 * Safety:
 *   - Runs daemon in PROOF_MODE=true HEADLESS=true
 *   - No posting/reply actions performed
 *   - Only validates health event emission
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const MAX_WAIT_SECONDS = 300; // 5 minutes max wait

const PROOF_TAG = `health-${Date.now()}`;

/**
 * Get immutable report path
 */
function getImmutableReportPath(proofTag: string): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'health');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, `${proofTag}.md`);
}

/**
 * Get INDEX file path
 */
function getIndexPath(): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'health');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, 'INDEX.md');
}

/**
 * Append proof entry to INDEX.md (append-only)
 */
function appendToIndex(proofTag: string, status: string, bootEventId?: string, readyEventId?: string, healthOkEventId?: string): void {
  try {
    const indexPath = getIndexPath();
    const timestamp = new Date().toISOString();
    const proofFileName = `${proofTag}.md`;
    const relativePath = `./${proofFileName}`;
    
    // Create INDEX.md header if it doesn't exist
    if (!fs.existsSync(indexPath)) {
      const header = `# Executor Health & Liveness Proof - Index

This file is append-only. Each proof run adds a new row.

| Timestamp | Proof Tag | Status | Boot Event ID | Ready Event ID | Health OK Event ID | Proof File |
|-----------|-----------|--------|---------------|----------------|-------------------|------------|
`;
      fs.writeFileSync(indexPath, header, 'utf-8');
    }
    
    // Append new row
    const row = `| ${timestamp} | \`${proofTag}\` | ${status} | ${bootEventId || 'N/A'} | ${readyEventId || 'N/A'} | ${healthOkEventId || 'N/A'} | [\`${proofFileName}\`](${relativePath}) |\n`;
    fs.appendFileSync(indexPath, row, 'utf-8');
  } catch (error: any) {
    console.warn(`⚠️  Failed to append to INDEX: ${error.message}`);
  }
}

/**
 * Write initial report
 */
function writeInitialReport(proofTag: string): string {
  const reportPath = getImmutableReportPath(proofTag);
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const initialReport = `# Executor Health & Liveness Proof (Phase 5A.1)

**Date:** ${new Date().toISOString()}  
**Status:** ⏳ IN PROGRESS
**Proof Tag:** ${proofTag}

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
- **Tick Events:** N/A (pending)
- **Health OK Event:** N/A (pending)

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Boot Event (20s) | ⏳ | pending | HARD |
| Ready Event (90s) | ⏳ | pending | HARD |
| Tick Events (≥2 in 180s) | ⏳ | pending | HARD |
| Health OK Event (240s) | ⏳ | pending | HARD |

---

*Report will be updated as proof progresses...*
`;

  fs.writeFileSync(reportPath, initialReport, 'utf-8');
  console.log(`📝 Initial report written to ${reportPath}`);
  return reportPath;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🧪 PROOF Phase 5A.1: Executor Health & Liveness');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const reportPath = writeInitialReport(PROOF_TAG);
  
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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-health-liveness.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Max wait: ${MAX_WAIT_SECONDS}s\n`);
  
  // Poll for events
  let bootEventId: string | null = null;
  let readyEventId: string | null = null;
  let tickEventIds: string[] = [];
  let healthOkEventId: string | null = null;
  
  let bootSeen = false;
  let readySeen = false;
  let tickCount = 0;
  let healthOkSeen = false;
  
  const bootDeadline = startTime + 20 * 1000; // 20 seconds
  const readyDeadline = startTime + 90 * 1000; // 90 seconds
  const tickDeadline = startTime + 180 * 1000; // 180 seconds
  const healthOkDeadline = startTime + 240 * 1000; // 240 seconds
  
  let loopIteration = 0;
  
  while (Date.now() - startTime < MAX_WAIT_SECONDS * 1000) {
    loopIteration++;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    
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
        console.error(`❌ Ready event not seen within 90s`);
        break;
      }
    }
    
    // Check for TICK events
    if (readySeen) {
      const { data: tickEvents } = await supabase
        .from('system_events')
        .select('id, created_at, event_data')
        .eq('event_type', 'EXECUTOR_HEALTH_TICK')
        .gte('created_at', new Date(startTime).toISOString())
        .order('created_at', { ascending: false });
      
      if (tickEvents) {
        tickEventIds = tickEvents.map(e => e.id);
        tickCount = tickEvents.length;
        if (tickCount >= 2 && Date.now() <= tickDeadline) {
          console.log(`✅ Tick events seen: ${tickCount} (${elapsedSeconds}s)`);
        } else if (Date.now() > tickDeadline && tickCount < 2) {
          console.error(`❌ Only ${tickCount} tick events seen within 180s (need ≥2)`);
          break;
        }
      } else if (Date.now() > tickDeadline) {
        console.error(`❌ Tick events not seen within 180s`);
        break;
      }
    }
    
    // Check for HEALTH_OK event
    if (tickCount >= 2) {
      const { data: healthOkEvent } = await supabase
        .from('system_events')
        .select('id, created_at, event_data')
        .eq('event_type', 'EXECUTOR_HEALTH_OK')
        .gte('created_at', new Date(startTime).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (healthOkEvent) {
        healthOkSeen = true;
        healthOkEventId = healthOkEvent.id;
        console.log(`✅ Health OK event seen: ${healthOkEventId} (${elapsedSeconds}s)`);
        break; // All conditions met
      } else if (Date.now() > healthOkDeadline) {
        console.error(`❌ Health OK event not seen within 240s`);
        break;
      }
    }
    
    // Sleep 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Stop daemon
  console.log('\n🛑 Stopping daemon...');
  fs.writeFileSync(STOP_SWITCH_PATH, '', 'utf-8');
  await new Promise(resolve => setTimeout(resolve, 5000));
  if (daemonProcess.exitCode === null) {
    daemonProcess.kill();
  }
  
  // Determine pass/fail
  const pass = bootSeen && readySeen && tickCount >= 2 && healthOkSeen;
  
  // Write final report
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const report = `# Executor Health & Liveness Proof (Phase 5A.1)

**Date:** ${new Date().toISOString()}  
**Status:** ${pass ? '✅ PASS' : '❌ FAIL'}
**Proof Tag:** ${PROOF_TAG}

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
| Tick Events (≥2 in 180s) | ${tickCount >= 2 ? '✅' : '❌'} | ${tickCount} events (${tickEventIds.slice(0, 2).join(', ')}) | HARD |
| Health OK Event (240s) | ${healthOkSeen ? '✅' : '❌'} | ${healthOkEventId || 'N/A'} | HARD |

## Evidence

- **Proof Tag:** ${PROOF_TAG}
- **Boot Event ID:** ${bootEventId || 'N/A'}
- **Ready Event ID:** ${readyEventId || 'N/A'}
- **Tick Event Count:** ${tickCount}
- **Tick Event IDs:** ${tickEventIds.length > 0 ? tickEventIds.slice(0, 5).join(', ') : 'N/A'}
- **Health OK Event ID:** ${healthOkEventId || 'N/A'}

## Result

${pass ? '✅ **PASS** - All health and liveness checks passed' : '❌ **FAIL** - One or more health checks failed'}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  // Append to INDEX
  appendToIndex(
    PROOF_TAG,
    pass ? '✅ PASS' : '❌ FAIL',
    bootEventId || undefined,
    readyEventId || undefined,
    healthOkEventId || undefined
  );
  console.log(`📄 Index updated: ${getIndexPath()}`);
  
  if (!pass) {
    console.error('\n❌ HEALTH CHECKS FAILED:');
    if (!bootSeen) console.error('   - Boot event not seen within 20s');
    if (!readySeen) console.error('   - Ready event not seen within 90s');
    if (tickCount < 2) console.error(`   - Only ${tickCount} tick events seen (need ≥2)`);
    if (!healthOkSeen) console.error('   - Health OK event not seen within 240s');
    process.exit(1);
  }
  
  console.log('\n✅ All health and liveness checks passed');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
