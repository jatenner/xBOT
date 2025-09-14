#!/usr/bin/env ts-node
/**
 * Staging Smoke Test for Budget Enforcement
 * Validates budget tracking and blocking in staging environment
 */

import { budgetedOpenAI, BudgetExceededError } from '../src/services/openaiBudgetedClient';

interface SmokeTestResult {
  success: boolean;
  message: string;
  details: {
    redis_increment: boolean;
    api_usage_row: boolean;
    budget_blocking: boolean;
    error_details?: string;
  };
}

/**
 * Run comprehensive budget enforcement smoke test
 */
async function runSmokeTest(): Promise<SmokeTestResult> {
  console.log('🧪 STAGING_SMOKE_TEST: Starting budget enforcement validation...');
  
  // Verify we're in staging
  if (process.env.NODE_ENV !== 'staging') {
    return {
      success: false,
      message: 'Test must run in staging environment (NODE_ENV=staging)',
      details: {
        redis_increment: false,
        api_usage_row: false,
        budget_blocking: false,
        error_details: 'Wrong environment'
      }
    };
  }
  
  // Verify posting is enabled for test
  if (process.env.POSTING_DISABLED === 'true') {
    return {
      success: false,
      message: 'POSTING_DISABLED=true - cannot test OpenAI calls',
      details: {
        redis_increment: false,
        api_usage_row: false,
        budget_blocking: false,
        error_details: 'Posting disabled'
      }
    };
  }
  
  // Set very low budget for testing
  const originalLimit = process.env.DAILY_OPENAI_LIMIT_USD;
  process.env.DAILY_OPENAI_LIMIT_USD = '0.02'; // 2 cents
  
  try {
    // Test 1: First call should succeed
    console.log('🧪 TEST_1: First small call should succeed...');
    
    const initialStatus = await budgetedOpenAI.getBudgetStatus();
    console.log(`   Initial budget: $${initialStatus.usedTodayUSD}/$${initialStatus.dailyLimitUSD}`);
    
    const firstCall = await budgetedOpenAI.chatComplete({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5 // Minimal tokens
    }, {
      purpose: 'staging_smoke_test_1',
      priority: 'low'
    });
    
    if (!firstCall.choices[0]?.message?.content) {
      throw new Error('First call failed - no response content');
    }
    
    console.log('   ✅ First call succeeded');
    
    // Test 2: Check Redis increment
    const afterFirstStatus = await budgetedOpenAI.getBudgetStatus();
    const redisIncrement = afterFirstStatus.usedTodayUSD > initialStatus.usedTodayUSD;
    
    console.log(`   Budget after first call: $${afterFirstStatus.usedTodayUSD}/$${afterFirstStatus.dailyLimitUSD}`);
    console.log(`   ✅ Redis increment: ${redisIncrement ? 'SUCCESS' : 'FAILED'}`);
    
    // Test 3: Check API usage row
    const apiUsageRow = await checkApiUsageRow('staging_smoke_test_1');
    console.log(`   ✅ API usage row: ${apiUsageRow ? 'SUCCESS' : 'FAILED'}`);
    
    // Test 4: Second call should be blocked (budget exceeded)
    console.log('🧪 TEST_2: Second call should be blocked by budget...');
    
    let budgetBlocking = false;
    try {
      await budgetedOpenAI.chatComplete({
        model: 'gpt-4o', // Expensive model to trigger budget
        messages: [{ role: 'user', content: 'This should be blocked' }],
        max_tokens: 1000
      }, {
        purpose: 'staging_smoke_test_2',
        priority: 'high'
      });
      
      console.log('   ❌ Second call succeeded - budget blocking FAILED');
      
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        budgetBlocking = true;
        console.log('   ✅ Second call blocked by budget enforcement');
        console.log(`   Budget exceeded: attempted=$${error.attempted.toFixed(4)} used=$${error.used.toFixed(4)}/$${error.allowed.toFixed(2)}`);
      } else {
        console.log(`   ❌ Second call failed with unexpected error: ${error.message}`);
      }
    }
    
    // Test 5: Verify /status endpoint
    const finalStatus = await budgetedOpenAI.getBudgetStatus();
    console.log('🧪 TEST_3: Final status check...');
    console.log(`   Final budget: $${finalStatus.usedTodayUSD}/$${finalStatus.dailyLimitUSD} (${finalStatus.percentUsed.toFixed(1)}%)`);
    console.log(`   Total calls: ${finalStatus.totalCallsToday}`);
    console.log(`   Blocked: ${finalStatus.isBlocked}`);
    
    const allTestsPassed = redisIncrement && apiUsageRow && budgetBlocking;
    
    return {
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'All budget enforcement tests passed' 
        : 'Some budget enforcement tests failed',
      details: {
        redis_increment: redisIncrement,
        api_usage_row: apiUsageRow,
        budget_blocking: budgetBlocking
      }
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: `Smoke test failed: ${error.message}`,
      details: {
        redis_increment: false,
        api_usage_row: false,
        budget_blocking: false,
        error_details: error.message
      }
    };
    
  } finally {
    // Restore original limit
    if (originalLimit) {
      process.env.DAILY_OPENAI_LIMIT_USD = originalLimit;
    }
  }
}

/**
 * Check if API usage row was created
 */
async function checkApiUsageRow(purpose: string): Promise<boolean> {
  try {
    const { supaService } = await import('../src/db/supabaseService');
    
    const { data, error } = await supaService
      .from('api_usage')
      .select('id, intent, cost_usd')
      .eq('intent', purpose)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute
      .limit(1);
    
    if (error) {
      console.log(`   API usage check error: ${error.message}`);
      return false;
    }
    
    const found = data && data.length > 0;
    if (found) {
      console.log(`   Found API usage row: cost=$${data[0].cost_usd}`);
    }
    
    return found;
    
  } catch (error: any) {
    console.log(`   API usage check failed: ${error.message}`);
    return false;
  }
}

/**
 * Main execution with concise output
 */
async function main(): Promise<void> {
  const result = await runSmokeTest();
  
  // Concise one-line verdict
  const verdict = result.success ? '✅ PASS' : '❌ FAIL';
  const details = `redis=${result.details.redis_increment ? '✅' : '❌'} db=${result.details.api_usage_row ? '✅' : '❌'} block=${result.details.budget_blocking ? '✅' : '❌'}`;
  
  console.log('');
  console.log('🧪 STAGING_SMOKE_TEST_VERDICT:');
  console.log(`${verdict}: Budget enforcement ${details} - ${result.message}`);
  
  if (!result.success) {
    console.log('');
    console.log('❌ REMEDIATION NEEDED:');
    if (!result.details.redis_increment) {
      console.log('   - Redis budget tracking not working');
    }
    if (!result.details.api_usage_row) {
      console.log('   - Supabase api_usage logging not working');
    }
    if (!result.details.budget_blocking) {
      console.log('   - Budget limit enforcement not working');
    }
    if (result.details.error_details) {
      console.log(`   - Error: ${result.details.error_details}`);
    }
    
    process.exit(1);
  } else {
    console.log('✅ Budget enforcement system is working correctly in staging');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ SMOKE_TEST_CRASH:', error.message);
    process.exit(1);
  });
}
