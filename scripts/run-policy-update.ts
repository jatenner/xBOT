#!/usr/bin/env tsx
/**
 * Run policy update job (dry-run or live)
 */

import 'dotenv/config';
import { runPolicyUpdate } from '../src/jobs/replyLearning/policyUpdater';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`[POLICY_UPDATE] Running policy update (dry_run=${dryRun})...\n`);
  
  const result = await runPolicyUpdate(dryRun);
  
  console.log('\n═'.repeat(80));
  console.log('📊 POLICY UPDATE RESULT');
  console.log('═'.repeat(80));
  console.log(`Updated: ${result.updated}`);
  console.log(`Outcomes analyzed: ${result.stats.outcomes_analyzed}`);
  console.log(`Templates updated: ${result.stats.templates_updated}`);
  console.log(`Threshold delta: ${result.stats.threshold_delta.toFixed(3)}`);
  console.log('\nBefore state:');
  console.log(JSON.stringify(result.before, null, 2));
  console.log('\nAfter state:');
  console.log(JSON.stringify(result.after, null, 2));
  console.log('═'.repeat(80));
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
