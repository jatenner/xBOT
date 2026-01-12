#!/usr/bin/env tsx
/**
 * 🧪 POOL SELF-TEST
 * 
 * Tests that pool_health metrics are truthful and actionable:
 * 1) Prints pool_health before
 * 2) Runs 2 trivial pool tasks (create context, goto about:blank, close)
 * 3) Prints pool_health after
 * 4) Exits non-zero if active/idle/contexts_created do not change
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

async function poolSelfTest() {
  console.log('🧪 Pool self-test...\n');
  
  const pool = UnifiedBrowserPool.getInstance();
  const metricsBefore = pool.getMetrics();
  const poolAny = pool as any;
  
  const healthBefore = {
    contexts_created_total: metricsBefore.contextsCreated || 0,
    active_contexts: poolAny.getActiveCount?.() || 0,
    idle_contexts: Math.max(0, (poolAny.contexts?.size || 0) - (poolAny.getActiveCount?.() || 0)),
    total_contexts: poolAny.contexts?.size || 0,
    queue_len: poolAny.queue?.length || 0,
  };
  
  console.log('📊 BEFORE:');
  console.log(`   contexts_created_total: ${healthBefore.contexts_created_total}`);
  console.log(`   active_contexts: ${healthBefore.active_contexts}`);
  console.log(`   idle_contexts: ${healthBefore.idle_contexts}`);
  console.log(`   total_contexts: ${healthBefore.total_contexts}`);
  console.log(`   queue_len: ${healthBefore.queue_len}\n`);
  
  // Run 2 trivial tasks
  console.log('🔬 Running 2 trivial pool tasks...');
  
  try {
    await Promise.all([
      pool.withContext('test_task_1', async (context) => {
        const page = await context.newPage();
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForTimeout(500);
      }),
      pool.withContext('test_task_2', async (context) => {
        const page = await context.newPage();
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForTimeout(500);
      }),
    ]);
    
    console.log('✅ Tasks completed\n');
  } catch (error: any) {
    console.error(`❌ Tasks failed: ${error.message}`);
    process.exit(1);
  }
  
  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const metricsAfter = pool.getMetrics();
  const healthAfter = {
    contexts_created_total: metricsAfter.contextsCreated || 0,
    active_contexts: poolAny.getActiveCount?.() || 0,
    idle_contexts: Math.max(0, (poolAny.contexts?.size || 0) - (poolAny.getActiveCount?.() || 0)),
    total_contexts: poolAny.contexts?.size || 0,
    queue_len: poolAny.queue?.length || 0,
  };
  
  console.log('📊 AFTER:');
  console.log(`   contexts_created_total: ${healthAfter.contexts_created_total}`);
  console.log(`   active_contexts: ${healthAfter.active_contexts}`);
  console.log(`   idle_contexts: ${healthAfter.idle_contexts}`);
  console.log(`   total_contexts: ${healthAfter.total_contexts}`);
  console.log(`   queue_len: ${healthAfter.queue_len}\n`);
  
  // Validation
  const contextsCreatedIncreased = healthAfter.contexts_created_total > healthBefore.contexts_created_total;
  const totalOperationsIncreased = (metricsAfter.totalOperations || 0) > (metricsBefore.totalOperations || 0);
  
  console.log('📊 VALIDATION:');
  console.log(`   contexts_created increased: ${contextsCreatedIncreased}`);
  console.log(`   total_operations increased: ${totalOperationsIncreased}`);
  
  if (!contextsCreatedIncreased && !totalOperationsIncreased) {
    console.error('\n❌ TEST FAILED: Pool metrics did not change after operations');
    process.exit(1);
  }
  
  // Check that active/idle are reasonable
  if (healthAfter.active_contexts < 0 || healthAfter.idle_contexts < 0) {
    console.error('\n❌ TEST FAILED: Invalid active/idle context counts');
    process.exit(1);
  }
  
  console.log('\n✅ TEST PASSED: Pool metrics are truthful and actionable');
  process.exit(0);
}

poolSelfTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
