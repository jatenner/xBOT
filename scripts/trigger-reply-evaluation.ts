#!/usr/bin/env tsx
/**
 * Trigger reply evaluation to generate fresh decisions
 */

import { fetchAndEvaluateCandidates } from '../src/jobs/replySystemV2/orchestrator';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('=== Triggering Reply Evaluation ===\n');
  
  const cycles = parseInt(process.env.CYCLES || '3', 10);
  console.log(`Running ${cycles} evaluation cycles...\n`);
  
  for (let i = 0; i < cycles; i++) {
    console.log(`\n--- Cycle ${i + 1}/${cycles} ---`);
    try {
      const result = await fetchAndEvaluateCandidates();
      console.log(`✅ Cycle ${i + 1} complete:`);
      console.log(`   Fetched: ${result.fetched}`);
      console.log(`   Evaluated: ${result.evaluated}`);
      console.log(`   Passed filters: ${result.passed_filters}`);
      console.log(`   Feed run ID: ${result.feed_run_id}`);
      
      // Wait a bit between cycles
      if (i < cycles - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error: any) {
      console.error(`❌ Cycle ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('\n=== Evaluation Complete ===');
}

main().catch(console.error);
