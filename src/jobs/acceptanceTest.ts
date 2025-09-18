/**
 * 🧪 ACCEPTANCE TEST
 * Runs one complete cycle on first boot to validate learning loop
 */

import { getConfig } from '../config/config';
import { JobManager } from './jobManager';
import { getCurrentMetrics } from '../api/metrics';

export async function runAcceptanceTest(): Promise<void> {
  const config = getConfig();
  
  console.log('🧪 ACCEPTANCE_TEST: Running one complete learning cycle...');
  console.log('='.repeat(60));
  
  try {
    const jobManager = JobManager.getInstance();
    const startTime = Date.now();
    
    // Run one cycle: plan → shadowOutcomes → learn
    console.log('🧪 [1/3] Running plan job...');
    await jobManager.runJobNow('plan');
    
    if (config.MODE === 'shadow') {
      console.log('🧪 [2/3] Running shadowOutcomes job...');
      await jobManager.runJobNow('shadowOutcomes');
    }
    
    console.log('🧪 [3/3] Running learn job...');
    await jobManager.runJobNow('learn');
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Get final metrics
    const metrics = getCurrentMetrics();
    const stats = jobManager.getStats();
    
    // Print acceptance block
    console.log('✅ ACCEPTANCE_TEST: Cycle completed successfully');
    console.log('📊 ACCEPTANCE_RESULTS:');
    console.log(`   • Duration: ${duration}s`);
    console.log(`   • Plans: ${stats.planRuns}`);
    console.log(`   • Outcomes: ${stats.outcomeRuns}`);
    console.log(`   • Learn runs: ${stats.learnRuns}`);
    console.log(`   • OpenAI calls: ${metrics.openaiCalls}`);
    console.log(`   • Mock completions: ${metrics.mockCompletions}`);
    console.log(`   • Mock embeddings: ${metrics.mockEmbeddings}`);
    console.log(`   • Explore ratio: ${metrics.exploreRatio.toFixed(3)}`);
    console.log(`   • Mode: ${config.MODE}`);
    console.log(`   • Errors: ${metrics.errors}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ ACCEPTANCE_TEST: Failed:', error.message);
    console.log('='.repeat(60));
    throw error;
  }
}
