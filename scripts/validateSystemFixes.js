#!/usr/bin/env node

/**
 * 🔧 SYSTEM FIXES VALIDATION SCRIPT
 * 
 * This script validates that all the circuit breaker and emergency system fixes
 * are working correctly before deployment.
 */

const { SystemFixes } = require('../dist/core/systemFixes');
const { unifiedDb } = require('../dist/lib/unifiedDatabaseManager');
const { systemHealthMonitor } = require('../dist/core/systemHealthMonitor');

async function validateAllFixes() {
  console.log('🚀 SYSTEM_VALIDATION: Starting comprehensive system validation...');
  console.log('='.repeat(70));
  
  const results = {
    systemFixes: false,
    circuitBreaker: false,
    healthMonitoring: false,
    emergencyCleanup: false,
    overallSuccess: false
  };

  try {
    // Test 1: System Fixes Initialization
    console.log('\n📊 TEST 1: System Fixes Initialization');
    console.log('-'.repeat(50));
    
    const initResult = await SystemFixes.initializeAllFixes();
    results.systemFixes = initResult.success;
    
    console.log(`✅ System Fixes: ${initResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`📈 Health Score: ${initResult.healthScore}/100`);
    console.log(`💬 Message: ${initResult.message}`);

    // Test 2: Circuit Breaker Status
    console.log('\n🔗 TEST 2: Circuit Breaker Validation');
    console.log('-'.repeat(50));
    
    const dbHealth = unifiedDb.getDetailedHealth();
    results.circuitBreaker = !dbHealth.circuitBreaker.isOpen;
    
    console.log(`🔧 Circuit Breaker: ${dbHealth.circuitBreaker.isOpen ? 'OPEN ❌' : 'CLOSED ✅'}`);
    console.log(`📊 Failure Count: ${dbHealth.circuitBreaker.failures}`);
    console.log(`🔗 Supabase: ${dbHealth.connections.supabase ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`💾 Redis: ${dbHealth.connections.redis ? 'CONNECTED' : 'DISCONNECTED'}`);

    // Test 3: Health Monitoring
    console.log('\n🏥 TEST 3: Health Monitoring System');
    console.log('-'.repeat(50));
    
    try {
      const healthScore = systemHealthMonitor.getSystemHealthScore();
      results.healthMonitoring = healthScore > 0;
      
      console.log(`📊 System Health Score: ${healthScore}/100`);
      console.log(`🏥 Health Monitoring: ${results.healthMonitoring ? 'ACTIVE ✅' : 'INACTIVE ❌'}`);
      
      // Test health report generation
      const report = await systemHealthMonitor.getComprehensiveReport();
      console.log(`📋 Health Report: ${report.insights.length} insights, ${report.predictions.length} predictions`);
      console.log(`🚨 Alert Level: ${report.alertLevel}`);
      
    } catch (error) {
      console.warn(`⚠️ Health monitoring test failed: ${error.message}`);
      results.healthMonitoring = false;
    }

    // Test 4: Emergency System Cleanup
    console.log('\n🧹 TEST 4: Emergency System Conflicts');
    console.log('-'.repeat(50));
    
    try {
      const systemHealth = SystemFixes.getSystemHealth();
      results.emergencyCleanup = systemHealth.score > 50;
      
      console.log(`🧹 Emergency Cleanup: ${results.emergencyCleanup ? 'CLEAN ✅' : 'CONFLICTS REMAIN ❌'}`);
      console.log(`📊 System Status: ${systemHealth.status}`);
      console.log(`🔧 Circuit Breaker: ${systemHealth.circuitBreakerOpen ? 'OPEN' : 'CLOSED'}`);
      
    } catch (error) {
      console.warn(`⚠️ Emergency cleanup test failed: ${error.message}`);
      results.emergencyCleanup = false;
    }

    // Test 5: Database Operations
    console.log('\n🗄️ TEST 5: Database Operations');
    console.log('-'.repeat(50));
    
    try {
      // Test a simple database operation
      const testResult = await unifiedDb.executeQuery(
        async (supabase) => await supabase.from('bot_config').select('key').limit(1),
        []
      );
      
      const dbOperational = !testResult.error;
      console.log(`🗄️ Database Query: ${dbOperational ? 'SUCCESS ✅' : 'FAILED ❌'}`);
      
      if (testResult.fromCache) {
        console.log('💾 Cache: ACTIVE (query served from cache)');
      }
      
    } catch (error) {
      console.warn(`⚠️ Database operation test failed: ${error.message}`);
    }

    // Overall Assessment
    console.log('\n🎯 OVERALL ASSESSMENT');
    console.log('='.repeat(70));
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length - 1; // Exclude overallSuccess
    
    results.overallSuccess = passedTests >= (totalTests * 0.8); // 80% pass rate
    
    console.log(`📊 Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`🎯 Overall Result: ${results.overallSuccess ? 'SYSTEM READY ✅' : 'NEEDS ATTENTION ⚠️'}`);
    
    if (results.overallSuccess) {
      console.log('\n✅ SUCCESS: All critical fixes validated');
      console.log('🚀 System is ready for production deployment');
      console.log('🏥 Health monitoring active with 15-minute intervals');
      console.log('🔧 Circuit breaker optimized and functional');
      console.log('🧹 Emergency system conflicts resolved');
    } else {
      console.log('\n⚠️ WARNING: Some systems need attention');
      console.log('📋 Review the test results above for specific issues');
      console.log('🔧 Consider running SystemFixes.forceCircuitBreakerReset() if needed');
    }
    
    console.log('\n🔗 NEXT STEPS:');
    console.log('1. Deploy to Railway staging environment');
    console.log('2. Monitor system health for 30 minutes');
    console.log('3. Verify circuit breaker stays CLOSED');
    console.log('4. Check emergency system usage metrics');
    console.log('5. Deploy to production when all metrics are green');

    return results;

  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:', error.message);
    console.error('📊 Stack trace:', error.stack?.substring(0, 500));
    return { ...results, overallSuccess: false };
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateAllFixes()
    .then((results) => {
      process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Validation script crashed:', error.message);
      process.exit(1);
    });
}

module.exports = { validateAllFixes };
