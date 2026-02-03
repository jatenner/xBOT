#!/usr/bin/env tsx
/**
 * 📊 OPS:AUTH:METRICS - Auth Reliability Metrics & Trends
 * 
 * Aggregates metrics from last 20 ops:up:fast runs.
 * 
 * Usage:
 *   pnpm run ops:auth:metrics
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');
const REPORTS_DIR = path.join(process.cwd(), 'docs', 'proofs', 'auth');

interface UpFastRun {
  timestamp: string;
  passed: boolean;
  reason?: string;
  soak_minutes: number;
  minutes_ok?: number;
  first_failure_minute?: number | null;
  failure_reason?: string;
  report_path?: string;
  screenshot_path?: string;
}

function readLedger(): UpFastRun[] {
  if (!fs.existsSync(LEDGER_PATH)) {
    return [];
  }
  
  const lines = fs.readFileSync(LEDGER_PATH, 'utf-8')
    .split('\n')
    .filter(line => line.trim().length > 0);
  
  return lines.map(line => JSON.parse(line));
}

function parseAuthPersistenceReport(reportPath: string): { minutes_ok: number; first_failure_minute: number | null; failure_reason?: string } | null {
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(reportPath, 'utf-8');
    
    // Extract minutes_ok
    const minutesOkMatch = content.match(/- \*\*Minutes OK:\*\* (\d+)/);
    const minutesOk = minutesOkMatch ? parseInt(minutesOkMatch[1], 10) : 0;
    
    // Extract first failure minute
    const firstFailureMatch = content.match(/- \*\*First Failure Minute:\*\* (\d+|N\/A)/);
    const firstFailureMinute = firstFailureMatch && firstFailureMatch[1] !== 'N/A' 
      ? parseInt(firstFailureMatch[1], 10) 
      : null;
    
    // Extract failure reason from fingerprint table
    const fingerprintMatch = content.match(/\| (.+?) \| (.+?) \| (\d+) \|/);
    const failureReason = fingerprintMatch ? fingerprintMatch[1] : undefined;
    
    return {
      minutes_ok: minutesOk,
      first_failure_minute: firstFailureMinute,
      failure_reason: failureReason,
    };
  } catch (e) {
    return null;
  }
}

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 AUTH RELIABILITY METRICS & TRENDS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const runs = readLedger();
  
  if (runs.length === 0) {
    console.log('⚠️  No runs found in ledger');
    console.log(`   Ledger path: ${LEDGER_PATH}`);
    console.log('   Run ops:up:fast to generate metrics');
    process.exit(0);
  }
  
  // Get last 20 runs
  const recentRuns = runs.slice(-20);
  
  console.log(`📋 Analyzing last ${recentRuns.length} runs (of ${runs.length} total)\n`);
  
  // Extract minutes_ok for successful runs
  const successfulRuns = recentRuns.filter(r => r.passed && r.minutes_ok !== undefined);
  const minutesOkValues = successfulRuns
    .map(r => r.minutes_ok!)
    .sort((a, b) => a - b);
  
  // Calculate statistics
  const median = minutesOkValues.length > 0 
    ? calculatePercentile(minutesOkValues, 50)
    : 0;
  const p25 = minutesOkValues.length > 0 
    ? calculatePercentile(minutesOkValues, 25)
    : 0;
  const p75 = minutesOkValues.length > 0 
    ? calculatePercentile(minutesOkValues, 75)
    : 0;
  
  // Best run length
  const bestRunLength = minutesOkValues.length > 0 
    ? Math.max(...minutesOkValues)
    : 0;
  
  // Failure reason counts
  const failureReasons: Record<string, number> = {};
  recentRuns.forEach(r => {
    if (!r.passed && r.failure_reason) {
      failureReasons[r.failure_reason] = (failureReasons[r.failure_reason] || 0) + 1;
    }
  });
  
  // Last run
  const lastRun = recentRuns[recentRuns.length - 1];
  
  // Print metrics
  console.log('📊 Metrics:');
  console.log(`   Median minutes_ok: ${median}`);
  console.log(`   P25: ${p25}`);
  console.log(`   P75: ${p75}`);
  console.log(`   Best run length: ${bestRunLength} minutes`);
  console.log(`   Successful runs: ${successfulRuns.length} / ${recentRuns.length}`);
  console.log(`   Failure rate: ${((recentRuns.length - successfulRuns.length) / recentRuns.length * 100).toFixed(1)}%`);
  
  if (Object.keys(failureReasons).length > 0) {
    console.log(`\n📋 Failure Reasons:`);
    Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
  }
  
  console.log(`\n📋 Last Run:`);
  console.log(`   Timestamp: ${lastRun.timestamp}`);
  console.log(`   Status: ${lastRun.passed ? '✅ PASS' : '❌ FAIL'}`);
  if (lastRun.minutes_ok !== undefined) {
    console.log(`   Minutes OK: ${lastRun.minutes_ok}`);
  }
  if (lastRun.failure_reason) {
    console.log(`   Failure Reason: ${lastRun.failure_reason}`);
  }
  if (lastRun.report_path) {
    console.log(`   Report: ${lastRun.report_path}`);
  }
  
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
