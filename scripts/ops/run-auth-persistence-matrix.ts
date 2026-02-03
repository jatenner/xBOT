#!/usr/bin/env tsx
/**
 * 🔬 AUTH PERSISTENCE MATRIX RUNNER
 * 
 * Runs controlled persistence tests with different tick intervals:
 * A) Baseline: 60s ticks, 60 min duration
 * B) Human-ish: 180s ticks with jitter, 60 min duration
 * C) More human: 300s ticks with jitter, 60 min duration
 * 
 * Stops on first PASS.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MATRIX_RESULTS_FILE = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'auth-persistence-matrix.jsonl');
const REPORTS_DIR = path.join(process.cwd(), 'docs', 'proofs', 'auth');

interface MatrixResult {
  ts: string;
  tick_seconds: number;
  jitter: boolean;
  duration: number;
  pass: boolean;
  first_failure_minute: number | null;
  reason: string | null;
  report_path: string;
}

async function runVariant(
  variant: 'A' | 'B' | 'C',
  tickSeconds: number,
  jitter: boolean,
  durationMinutes: number
): Promise<MatrixResult> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Variant ${variant}: ${tickSeconds}s ticks${jitter ? ' + jitter' : ''}, ${durationMinutes} min`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const envVars: Record<string, string> = {
    PROOF_DURATION_MINUTES: durationMinutes.toString(),
    TICK_SECONDS: tickSeconds.toString(),
    HUMAN_JITTER: jitter ? 'true' : 'false',
  };
  
  const envString = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  
  const command = `${envString} pnpm run executor:prove:auth-b64-persistence`;
  
  console.log(`Running: ${command}\n`);
  
  try {
    execSync(command, { stdio: 'inherit', encoding: 'utf-8' });
    
    // Find latest report
    const reports = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.includes('b64-auth-persistence') && f.endsWith('.md'))
      .map(f => ({
        name: f,
        path: path.join(REPORTS_DIR, f),
        mtime: fs.statSync(path.join(REPORTS_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    const latestReport = reports[0];
    const reportContent = fs.readFileSync(latestReport.path, 'utf-8');
    
    // Parse report
    const statusMatch = reportContent.match(/\*\*Status:\*\* (.+)/);
    const minutesOkMatch = reportContent.match(/Minutes OK:\*\* (\d+)/);
    const firstFailureMatch = reportContent.match(/First Failure Minute:\*\* (.+)/);
    const failureReasonMatch = reportContent.match(/\*\*Failure Reason:\*\* (.+)/);
    
    const passed = statusMatch?.[1]?.includes('✅') || statusMatch?.[1]?.includes('PASS') || false;
    const minutesOk = minutesOkMatch ? parseInt(minutesOkMatch[1], 10) : 0;
    const firstFailureMinute = firstFailureMatch && firstFailureMatch[1] !== 'N/A' 
      ? parseInt(firstFailureMatch[1], 10) 
      : null;
    const reason = failureReasonMatch?.[1]?.trim() || null;
    
    return {
      ts: new Date().toISOString(),
      tick_seconds: tickSeconds,
      jitter,
      duration: durationMinutes,
      pass: passed,
      first_failure_minute: firstFailureMinute,
      reason,
      report_path: latestReport.path,
    };
    
  } catch (error: any) {
    // Command failed (non-zero exit)
    const reports = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.includes('b64-auth-persistence') && f.endsWith('.md'))
      .map(f => ({
        name: f,
        path: path.join(REPORTS_DIR, f),
        mtime: fs.statSync(path.join(REPORTS_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    const latestReport = reports[0];
    let reportContent = '';
    if (latestReport && fs.existsSync(latestReport.path)) {
      reportContent = fs.readFileSync(latestReport.path, 'utf-8');
    }
    
    const firstFailureMatch = reportContent.match(/First Failure Minute:\*\* (.+)/);
    const failureReasonMatch = reportContent.match(/\*\*Failure Reason:\*\* (.+)/);
    
    return {
      ts: new Date().toISOString(),
      tick_seconds: tickSeconds,
      jitter,
      duration: durationMinutes,
      pass: false,
      first_failure_minute: firstFailureMatch && firstFailureMatch[1] !== 'N/A' 
        ? parseInt(firstFailureMatch[1], 10) 
        : null,
      reason: failureReasonMatch?.[1]?.trim() || 'unknown',
      report_path: latestReport?.path || 'N/A',
    };
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🔬 AUTH PERSISTENCE MATRIX RUNNER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Ensure results file exists
  if (!fs.existsSync(path.dirname(MATRIX_RESULTS_FILE))) {
    fs.mkdirSync(path.dirname(MATRIX_RESULTS_FILE), { recursive: true });
  }
  
  const results: MatrixResult[] = [];
  
  // Variant A: Baseline (60s ticks, no jitter)
  const resultA = await runVariant('A', 60, false, 60);
  results.push(resultA);
  
  if (resultA.pass) {
    console.log(`\n✅ Variant A PASSED - stopping matrix`);
    appendResult(resultA);
    process.exit(0);
  }
  
  console.log(`\n❌ Variant A FAILED (minute ${resultA.first_failure_minute}, reason: ${resultA.reason})`);
  appendResult(resultA);
  
  // Variant B: Human-ish (180s ticks, with jitter)
  const resultB = await runVariant('B', 180, true, 60);
  results.push(resultB);
  
  if (resultB.pass) {
    console.log(`\n✅ Variant B PASSED - stopping matrix`);
    appendResult(resultB);
    process.exit(0);
  }
  
  console.log(`\n❌ Variant B FAILED (minute ${resultB.first_failure_minute}, reason: ${resultB.reason})`);
  appendResult(resultB);
  
  // Variant C: More human (300s ticks, with jitter)
  const resultC = await runVariant('C', 300, true, 60);
  results.push(resultC);
  appendResult(resultC);
  
  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`                    MATRIX SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  console.log(`Variant A (60s, no jitter): ${resultA.pass ? '✅ PASS' : `❌ FAIL (min ${resultA.first_failure_minute}, ${resultA.reason})`}`);
  console.log(`Variant B (180s, jitter):   ${resultB.pass ? '✅ PASS' : `❌ FAIL (min ${resultB.first_failure_minute}, ${resultB.reason})`}`);
  console.log(`Variant C (300s, jitter):   ${resultC.pass ? '✅ PASS' : `❌ FAIL (min ${resultC.first_failure_minute}, ${resultC.reason})`}`);
  
  const allPassed = results.every(r => r.pass);
  if (allPassed) {
    console.log(`\n✅ All variants PASSED`);
    process.exit(0);
  } else {
    console.log(`\n❌ All variants FAILED - check reports for forensics`);
    process.exit(1);
  }
}

function appendResult(result: MatrixResult): void {
  const line = JSON.stringify(result);
  fs.appendFileSync(MATRIX_RESULTS_FILE, line + '\n', 'utf-8');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
