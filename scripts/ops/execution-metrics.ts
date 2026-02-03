#!/usr/bin/env tsx
/**
 * 📊 OPS:EXECUTION:METRICS - Execution Reliability Metrics & Trends
 * 
 * Aggregates metrics from last 20 execution proof runs.
 * 
 * Usage:
 *   pnpm run ops:execution:metrics
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');

interface ExecutionRun {
  ts: string;
  proof_type: 'e2e-control-reply' | 'e2e-control-post';
  target_tweet_id?: string;
  decision_id?: string;
  passed: boolean;
  failure_classification?: string;
  report_path?: string;
  reply_url?: string;
  tweet_url?: string;
  time_to_success_seconds?: number;
}

function readLedger(): ExecutionRun[] {
  if (!fs.existsSync(LEDGER_PATH)) {
    return [];
  }
  
  const lines = fs.readFileSync(LEDGER_PATH, 'utf-8')
    .split('\n')
    .filter(line => line.trim().length > 0);
  
  return lines.map(line => JSON.parse(line));
}

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 EXECUTION RELIABILITY METRICS & TRENDS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const runs = readLedger();
  
  if (runs.length === 0) {
    console.log('⚠️  No runs found in ledger');
    console.log(`   Ledger path: ${LEDGER_PATH}`);
    console.log('   Run executor:prove:e2e-control-reply or executor:prove:e2e-control-post to generate metrics');
    process.exit(0);
  }
  
  // Get last 20 runs
  const recentRuns = runs.slice(-20);
  
  console.log(`📋 Analyzing last ${recentRuns.length} runs (of ${runs.length} total)\n`);
  
  // Success rate
  const successfulRuns = recentRuns.filter(r => r.passed);
  const successRate = (successfulRuns.length / recentRuns.length) * 100;
  
  // Time to success (for successful runs)
  const timeToSuccessValues = successfulRuns
    .filter(r => r.time_to_success_seconds !== undefined)
    .map(r => r.time_to_success_seconds!)
    .sort((a, b) => a - b);
  
  const medianTimeToSuccess = timeToSuccessValues.length > 0
    ? calculatePercentile(timeToSuccessValues, 50)
    : undefined;
  
  // Failure classification counts
  const failureClassifications: Record<string, number> = {};
  recentRuns.forEach(r => {
    if (!r.passed && r.failure_classification) {
      failureClassifications[r.failure_classification] = (failureClassifications[r.failure_classification] || 0) + 1;
    }
  });
  
  // Last PASS
  const lastPass = recentRuns
    .filter(r => r.passed)
    .slice(-1)[0];
  
  // Last run
  const lastRun = recentRuns[recentRuns.length - 1];
  
  // Print metrics
  console.log('📊 Metrics:');
  console.log(`   Success rate: ${successRate.toFixed(1)}%`);
  console.log(`   Successful runs: ${successfulRuns.length} / ${recentRuns.length}`);
  console.log(`   Failure rate: ${(100 - successRate).toFixed(1)}%`);
  
  if (medianTimeToSuccess !== undefined) {
    console.log(`   Median time-to-success: ${medianTimeToSuccess}s`);
  } else {
    console.log(`   Median time-to-success: N/A (no timing data)`);
  }
  
  if (Object.keys(failureClassifications).length > 0) {
    console.log(`\n📋 Failure Classifications:`);
    Object.entries(failureClassifications)
      .sort((a, b) => b[1] - a[1])
      .forEach(([classification, count]) => {
        console.log(`   ${classification}: ${count}`);
      });
  }
  
  console.log(`\n📋 Last PASS:`);
  if (lastPass) {
    console.log(`   Timestamp: ${lastPass.ts}`);
    console.log(`   Proof Type: ${lastPass.proof_type}`);
    if (lastPass.reply_url) {
      console.log(`   Reply URL: ${lastPass.reply_url}`);
    }
    if (lastPass.tweet_url) {
      console.log(`   Tweet URL: ${lastPass.tweet_url}`);
    }
  } else {
    console.log(`   No PASS runs found in last ${recentRuns.length} runs`);
  }
  
  console.log(`\n📋 Last Run:`);
  console.log(`   Timestamp: ${lastRun.ts}`);
  console.log(`   Proof Type: ${lastRun.proof_type}`);
  console.log(`   Status: ${lastRun.passed ? '✅ PASS' : '❌ FAIL'}`);
  if (lastRun.target_tweet_id) {
    console.log(`   Target Tweet ID: ${lastRun.target_tweet_id}`);
  }
  if (lastRun.decision_id) {
    console.log(`   Decision ID: ${lastRun.decision_id}`);
  }
  if (lastRun.failure_classification) {
    console.log(`   Failure Classification: ${lastRun.failure_classification}`);
  }
  if (lastRun.reply_url) {
    console.log(`   Reply URL: ${lastRun.reply_url}`);
  }
  if (lastRun.tweet_url) {
    console.log(`   Tweet URL: ${lastRun.tweet_url}`);
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
