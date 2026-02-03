#!/usr/bin/env tsx
/**
 * 🚀 OPS:EXECUTION:STATUS - Execution Status Check
 * 
 * Prints last known execution status from ledger.
 * 
 * Usage:
 *   pnpm run ops:execution:status
 *   pnpm run ops:execution:status --one-line
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');

const ONE_LINE = process.argv.includes('--one-line');

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

async function main(): Promise<void> {
  const runs = readLedger();
  
  if (runs.length === 0) {
    if (ONE_LINE) {
      console.log('EXECUTION=DOWN last_fail_reason=no_runs next=pnpm run executor:prove:e2e-control-reply');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('           🚀 EXECUTION STATUS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('⚠️  No runs found in ledger');
      console.log(`   Ledger path: ${LEDGER_PATH}`);
      console.log('   Run executor:prove:e2e-control-reply or executor:prove:e2e-control-post to generate data');
    }
    process.exit(1);
  }
  
  // Find last PASS
  const lastPass = runs
    .filter(r => r.passed)
    .slice(-1)[0];
  
  // Find last run
  const lastRun = runs[runs.length - 1];
  
  // Calculate last pass age
  let lastPassAge: number | undefined;
  if (lastPass) {
    const lastPassTime = new Date(lastPass.ts).getTime();
    const now = Date.now();
    lastPassAge = Math.floor((now - lastPassTime) / 1000 / 60); // minutes
  }
  
  // Determine status
  const status: 'OK' | 'DOWN' = lastRun.passed ? 'OK' : 'DOWN';
  
  if (ONE_LINE) {
    if (status === 'OK') {
      const lastUrl = lastRun.reply_url || lastRun.tweet_url || 'N/A';
      console.log(`EXECUTION=OK last_pass_age=${lastPassAge || 0}m last_url=${lastUrl}`);
    } else {
      const reason = lastRun.failure_classification || 'unknown';
      console.log(`EXECUTION=DOWN last_fail_reason=${reason} next=pnpm run executor:prove:e2e-control-reply`);
    }
    process.exit(status === 'OK' ? 0 : 1);
  }
  
  // Full output
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 EXECUTION STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📊 Status: ${status === 'OK' ? '✅ OK' : '❌ DOWN'}`);
  
  if (lastPass) {
    console.log(`\n📋 Last PASS:`);
    console.log(`   Timestamp: ${lastPass.ts}`);
    console.log(`   Age: ${lastPassAge !== undefined ? `${lastPassAge} minutes` : 'N/A'}`);
    console.log(`   Proof Type: ${lastPass.proof_type}`);
    if (lastPass.reply_url) {
      console.log(`   Reply URL: ${lastPass.reply_url}`);
    }
    if (lastPass.tweet_url) {
      console.log(`   Tweet URL: ${lastPass.tweet_url}`);
    }
  } else {
    console.log(`\n⚠️  No PASS runs found`);
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
  
  if (status === 'DOWN') {
    console.log(`\n📋 Next Steps:`);
    console.log(`   Run: pnpm run executor:prove:e2e-control-reply`);
  }
  
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    if (ONE_LINE) {
      console.log('EXECUTION=DOWN last_fail_reason=fatal_error next=pnpm run executor:prove:e2e-control-reply');
    } else {
      console.error('❌ Fatal error:', error);
    }
    process.exit(1);
  });
}
