#!/usr/bin/env ts-node
/**
 * 🧪 SYSTEM INTEGRATION TESTS
 * Minimal smoke tests for end-to-end live posting system
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class SystemTester {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    console.log(`\n🧪 Testing: ${name}`);
    
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({ 
        name, 
        passed: false, 
        error: error.message, 
        duration 
      });
      console.log(`❌ ${name} - FAILED (${duration}ms): ${error.message}`);
    }
  }

  async testDatabaseTables(): Promise<void> {
    // Check that required tables exist
    const { getSupabaseClient } = await import('../src/db/index');
    const supabase = getSupabaseClient();
    
    const requiredTables = [
      'unified_ai_intelligence',
      'outcomes', 
      'tweet_analytics',
      'content_metadata',
      'bandit_arms'
    ];
    
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        throw new Error(`Table ${table} not accessible: ${error.message}`);
      }
    }
  }

  async testKVStore(): Promise<void> {
    // Test Redis KV operations
    const { setKV, getKV, deleteKV } = await import('../src/utils/kv');
    
    const testKey = 'test:integration';
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });
    
    // Set
    await setKV(testKey, testValue);
    
    // Get
    const retrieved = await getKV(testKey);
    if (retrieved !== testValue) {
      throw new Error('KV store get/set mismatch');
    }
    
    // Delete
    await deleteKV(testKey);
    
    // Verify deleted
    const deleted = await getKV(testKey);
    if (deleted !== null) {
      throw new Error('KV store delete failed');
    }
  }

  async testOpenAIBudget(): Promise<void> {
    // Test OpenAI budget checking
    const { OpenAIService } = await import('../src/services/openAIService');
    const service = OpenAIService.getInstance();
    
    const budget = await service.getBudgetStatus();
    
    if (typeof budget.spent !== 'number' || typeof budget.limit !== 'number') {
      throw new Error('Invalid budget status structure');
    }
    
    if (budget.limit <= 0) {
      throw new Error('Budget limit must be positive');
    }
  }

  async testGateChain(): Promise<void> {
    // Test content validation gates
    const { prePostValidation } = await import('../src/posting/gateChain');
    
    // Test valid content
    const validResult = await prePostValidation('This is a high-quality health tip about nutrition.', {
      decision_id: 'test_decision',
      topic_cluster: 'nutrition',
      content_type: 'educational',
      quality_score: 0.85
    });
    
    if (!validResult.passed) {
      throw new Error(`Valid content failed gates: ${validResult.reason}`);
    }
    
    // Test invalid content (low quality)
    const invalidResult = await prePostValidation('Bad content', {
      decision_id: 'test_decision_2',
      topic_cluster: 'test',
      content_type: 'test',
      quality_score: 0.3
    });
    
    if (invalidResult.passed) {
      throw new Error('Low quality content should have failed gates');
    }
  }

  async testJobManager(): Promise<void> {
    // Test job manager functionality
    const { JobManager } = await import('../src/jobs/jobManager');
    const manager = JobManager.getInstance();
    
    const stats = manager.getStats();
    
    if (typeof stats.planRuns !== 'number' || 
        typeof stats.replyRuns !== 'number' ||
        typeof stats.learnRuns !== 'number') {
      throw new Error('Invalid job stats structure');
    }
  }

  async testContentGeneration(): Promise<void> {
    // Test content generation in shadow mode
    process.env.MODE = 'shadow';
    
    const { planContent } = await import('../src/jobs/planJob');
    
    // Should complete without error
    await planContent();
  }

  async testReplyGeneration(): Promise<void> {
    // Test reply generation in shadow mode
    process.env.MODE = 'shadow';
    
    const { generateReplies } = await import('../src/jobs/replyJob');
    
    // Should complete without error
    await generateReplies();
  }

  async testLearningCycle(): Promise<void> {
    // Test learning cycle
    const { runLearningCycle } = await import('../src/jobs/learnJob');
    
    // Should complete without error
    await runLearningCycle();
  }

  async testPredictorTraining(): Promise<void> {
    // Test predictor training
    const { trainWeeklyModel } = await import('../src/jobs/predictorTrainer');
    
    const coefficients = await trainWeeklyModel();
    
    if (!coefficients.version || !coefficients.ridge || !coefficients.logit) {
      throw new Error('Invalid predictor coefficients structure');
    }
  }

  async testApiEndpoints(): Promise<void> {
    // Test that key endpoints are accessible
    const baseUrl = process.env.APP_URL || 'http://localhost:8080';
    
    const endpoints = [
      '/metrics',
      '/status', 
      '/admin/jobs/schedule'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: endpoint.includes('admin') ? 
            { 'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'test-token'}` } : 
            {}
        });
        
        if (!response.ok && response.status !== 401) {
          throw new Error(`${endpoint} returned ${response.status}`);
        }
      } catch (error) {
        if (endpoint.includes('admin') && error.message.includes('401')) {
          // Expected for admin endpoints without proper token
          continue;
        }
        throw new Error(`${endpoint} failed: ${error.message}`);
      }
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 SYSTEM INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = total - passed;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  • ${r.name}: ${r.error}`));
    }
    
    console.log('='.repeat(60));
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! System ready for live deployment.');
      process.exit(0);
    } else {
      console.log('⚠️ Some tests failed. Review issues before live deployment.');
      process.exit(1);
    }
  }
}

async function runSystemTests() {
  console.log('🚀 Starting xBOT System Integration Tests...');
  console.log('This will validate the end-to-end live posting & learning system.');
  
  const tester = new SystemTester();
  
  // Core infrastructure tests
  await tester.runTest('Database Tables', () => tester.testDatabaseTables());
  await tester.runTest('KV Store (Redis)', () => tester.testKVStore());
  await tester.runTest('OpenAI Budget System', () => tester.testOpenAIBudget());
  
  // Content generation & validation
  await tester.runTest('Gate Chain Validation', () => tester.testGateChain());
  await tester.runTest('Content Generation', () => tester.testContentGeneration());
  await tester.runTest('Reply Generation', () => tester.testReplyGeneration());
  
  // Learning system
  await tester.runTest('Learning Cycle', () => tester.testLearningCycle());
  await tester.runTest('Predictor Training', () => tester.testPredictorTraining());
  
  // System components
  await tester.runTest('Job Manager', () => tester.testJobManager());
  await tester.runTest('API Endpoints', () => tester.testApiEndpoints());
  
  tester.printSummary();
}

// Run tests if called directly
if (require.main === module) {
  runSystemTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}
