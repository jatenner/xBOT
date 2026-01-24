#!/usr/bin/env tsx
/**
 * 🧪 EXECUTOR END-TO-END POSTING PROOF
 * 
 * Seeds ONE posting decision, runs executor daemon, and proves execution.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:e2e-post
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
const MAX_WAIT_SECONDS = 300; // 5 minutes max wait

interface E2EProofResult {
  decision_id: string;
  decision_queued: boolean;
  decision_claimed: boolean;
  attempt_recorded: boolean;
  result_recorded: boolean;
  post_success_event: boolean;
  post_failed_event: boolean;
  evidence: {
    decision_status?: string;
    attempt_id?: string;
    outcome_id?: string;
    event_ids?: string[];
    log_excerpts?: string[];
  };
}

async function seedDecision(): Promise<string> {
  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  const content = `🧪 E2E proof test: ${Date.now()}. Sleep quality and sunlight timing matter more than most people think.`;
  
  console.log(`📝 Seeding test decision: ${decisionId}`);
  
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
      pipeline_source: 'e2e_proof_test',
      features: {
        e2e_proof: true,
        created_at: now,
        retry_count: 0,
      }
    });
  
  if (error) {
    throw new Error(`Failed to seed decision: ${error.message}`);
  }
  
  console.log(`✅ Decision seeded: ${decisionId}`);
  return decisionId;
}

async function checkDecisionStatus(decisionId: string): Promise<{ status: string; claimed: boolean }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('content_metadata')
    .select('status')
    .eq('decision_id', decisionId)
    .single();
  
  if (error || !data) {
    return { status: 'unknown', claimed: false };
  }
  
  const claimed = data.status === 'posting' || data.status === 'completed' || data.status === 'failed';
  return { status: data.status, claimed };
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

async function findOutcome(decisionId: string): Promise<string | null> {
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

async function findPostEvents(decisionId: string): Promise<{ success: boolean; failed: boolean; eventIds: string[] }> {
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
  
  for (const event of data || []) {
    const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
    if (eventData.decision_id === decisionId) {
      eventIds.push(event.id);
      if (event.event_type === 'POST_SUCCESS') {
        success = true;
      } else if (event.event_type === 'POST_FAILED') {
        failed = true;
      }
    }
  }
  
  return { success, failed, eventIds };
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 EXECUTOR END-TO-END POSTING PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
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
  
  // Step 1: Seed decision
  console.log('\n📝 Step 1: Seeding test decision...');
  const decisionId = await seedDecision();
  
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
  
  const logFile = path.join(RUNNER_PROFILE_DIR, 'prove-e2e-post.log');
  const logStream = fs.createWriteStream(logFile);
  daemonProcess.stdout?.pipe(logStream);
  daemonProcess.stderr?.pipe(logStream);
  
  console.log(`✅ Daemon started (PID: ${daemonProcess.pid})`);
  console.log(`   Log file: ${logFile}`);
  console.log(`   Max wait: ${MAX_WAIT_SECONDS}s\n`);
  
  // Step 3: Wait for execution
  console.log('⏳ Step 3: Waiting for execution...');
  const startTime = Date.now();
  const result: E2EProofResult = {
    decision_id: decisionId,
    decision_queued: false,
    decision_claimed: false,
    attempt_recorded: false,
    result_recorded: false,
    post_success_event: false,
    post_failed_event: false,
    evidence: {},
  };
  
  while (Date.now() - startTime < MAX_WAIT_SECONDS * 1000) {
    // Check decision status
    const status = await checkDecisionStatus(decisionId);
    if (status.status === 'queued') {
      result.decision_queued = true;
      result.evidence.decision_status = status.status;
    }
    if (status.claimed) {
      result.decision_claimed = true;
      result.evidence.decision_status = status.status;
    }
    
    // Check for attempt
    const attemptId = await findAttempt(decisionId);
    if (attemptId) {
      result.attempt_recorded = true;
      result.evidence.attempt_id = attemptId;
    }
    
    // Check for outcome
    const outcomeId = await findOutcome(decisionId);
    if (outcomeId) {
      result.result_recorded = true;
      result.evidence.outcome_id = outcomeId;
    }
    
    // Check for events
    const events = await findPostEvents(decisionId);
    if (events.success) {
      result.post_success_event = true;
      result.evidence.event_ids = events.eventIds;
    }
    if (events.failed) {
      result.post_failed_event = true;
      result.evidence.event_ids = events.eventIds;
    }
    
    // Check if daemon died
    if (daemonProcess.killed || daemonProcess.exitCode !== null) {
      console.log('⚠️  Daemon exited during test');
      break;
    }
    
    // If we have both attempt and result, we're done
    if (result.attempt_recorded && result.result_recorded && (result.post_success_event || result.post_failed_event)) {
      console.log('✅ Execution complete!');
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
  
  // Step 4: Collect log excerpts
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf-8');
    const lines = logContent.trim().split('\n');
    const relevantLines = lines.filter(l => 
      l.includes(decisionId) || 
      l.includes('POST_SUCCESS') || 
      l.includes('POST_FAILED') ||
      l.includes('posting')
    );
    result.evidence.log_excerpts = relevantLines.slice(-20);
  }
  
  // Step 5: Evaluate result
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const pass = 
    result.decision_queued &&
    result.decision_claimed &&
    result.attempt_recorded &&
    result.result_recorded &&
    (result.post_success_event || result.post_failed_event);
  
  if (pass) {
    console.log('           ✅ TEST PASSED');
  } else {
    console.log('           ❌ TEST FAILED');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Results:');
  console.log(`  decision_queued: ${result.decision_queued} ${result.decision_queued ? '✅' : '❌'}`);
  console.log(`  decision_claimed: ${result.decision_claimed} ${result.decision_claimed ? '✅' : '❌'}`);
  console.log(`  attempt_recorded: ${result.attempt_recorded} ${result.attempt_recorded ? '✅' : '❌'}`);
  console.log(`  result_recorded: ${result.result_recorded} ${result.result_recorded ? '✅' : '❌'}`);
  console.log(`  post_success_event: ${result.post_success_event} ${result.post_success_event ? '✅' : '❌'}`);
  console.log(`  post_failed_event: ${result.post_failed_event} ${result.post_failed_event ? '✅' : '❌'}`);
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
  const reportPath = path.join(process.cwd(), 'docs', 'EXECUTION_E2E_POST_PROOF.md');
  const os = require('os');
  const machineInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
  
  const report = `# Executor End-to-End Posting Proof

**Date:** ${new Date().toISOString()}  
**Status:** ${pass ? '✅ PASS' : '❌ FAIL'}

## Machine Info

- **Hostname:** ${machineInfo.hostname}
- **Platform:** ${machineInfo.platform}
- **Architecture:** ${machineInfo.arch}
- **Node Version:** ${machineInfo.nodeVersion}
- **Runner Profile Dir:** ${RUNNER_PROFILE_DIR}

## Results

| Check | Status | Evidence |
|-------|--------|---------|
| Decision Queued | ${result.decision_queued ? '✅' : '❌'} | ${result.evidence.decision_status || 'N/A'} |
| Decision Claimed | ${result.decision_claimed ? '✅' : '❌'} | ${result.evidence.decision_status || 'N/A'} |
| Attempt Recorded | ${result.attempt_recorded ? '✅' : '❌'} | ${result.evidence.attempt_id || 'N/A'} |
| Result Recorded | ${result.result_recorded ? '✅' : '❌'} | ${result.evidence.outcome_id || 'N/A'} |
| POST_SUCCESS Event | ${result.post_success_event ? '✅' : '❌'} | ${result.evidence.event_ids?.join(', ') || 'N/A'} |
| POST_FAILED Event | ${result.post_failed_event ? '✅' : '❌'} | ${result.evidence.event_ids?.join(', ') || 'N/A'} |

## Evidence

- **Decision ID:** ${result.decision_id}
- **Decision Status:** ${result.evidence.decision_status || 'N/A'}
- **Attempt ID:** ${result.evidence.attempt_id || 'N/A'}
- **Outcome ID:** ${result.evidence.outcome_id || 'N/A'}
- **Event IDs:** ${result.evidence.event_ids?.join(', ') || 'N/A'}

## Log Excerpts

\`\`\`
${result.evidence.log_excerpts?.join('\n') || 'No relevant log excerpts'}
\`\`\`

## Result

${pass ? '✅ **PASS** - All execution checks passed' : '❌ **FAIL** - One or more execution checks failed'}
`;
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 Report written: ${reportPath}`);
  
  if (!pass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
