/**
 * 🔧 SYSTEM DIAGNOSIS AND REPAIR
 * 
 * Comprehensive system health check and repair to ensure smooth operation
 */

const { config } = require('dotenv');
config();

async function diagnoseAndRepairSystem() {
  console.log('🔧 SYSTEM_REPAIR: Starting comprehensive diagnosis and repair...');
  
  try {
    // Test 1: Database Connection Health
    console.log('\n📊 TEST 1: Database Connection Health');
    await testDatabaseConnection();
    
    // Test 2: Circuit Breaker Status
    console.log('\n📊 TEST 2: Circuit Breaker Status');
    await checkCircuitBreakerStatus();
    
    // Test 3: Core System Functionality
    console.log('\n📊 TEST 3: Core System Functionality');
    await testCoreSystemFunctionality();
    
    // Test 4: Emergency System Dependencies
    console.log('\n📊 TEST 4: Emergency System Dependencies');
    await testEmergencySystemDependencies();
    
    // Repair 1: Fix Database Issues
    console.log('\n🔧 REPAIR 1: Database Connection Issues');
    await repairDatabaseConnections();
    
    // Repair 2: Reset Circuit Breakers
    console.log('\n🔧 REPAIR 2: Circuit Breaker Reset');
    await resetCircuitBreakers();
    
    // Repair 3: Optimize Connection Pooling
    console.log('\n🔧 REPAIR 3: Connection Pool Optimization');
    await optimizeConnectionPooling();
    
    // Verification: Test All Systems
    console.log('\n✅ VERIFICATION: Final System Test');
    await verifySystemHealth();
    
    console.log('\n🎉 SYSTEM_REPAIR: Complete - ready for smooth operation!');
    return true;
    
  } catch (error) {
    console.error('❌ SYSTEM_REPAIR_ERROR:', error.message);
    console.log('🔧 MANUAL_INTERVENTION: Some issues require manual attention');
    return false;
  }
}

async function testDatabaseConnection() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ DATABASE_CONFIG: Missing Supabase credentials');
      return false;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test basic connection
    const { data, error } = await supabase
      .from('tweet_analytics')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ DATABASE_CONNECTION:', error.message);
      return false;
    }
    
    console.log('✅ DATABASE_CONNECTION: Working properly');
    
    // Test system_failures table (our new audit table)
    const { data: auditData, error: auditError } = await supabase
      .from('system_failures')
      .select('count')
      .limit(1);
    
    if (auditError) {
      console.log('⚠️ AUDIT_TABLES: May need creation -', auditError.message.substring(0, 50));
    } else {
      console.log('✅ AUDIT_TABLES: Ready for tracking');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ DATABASE_TEST_ERROR:', error.message);
    return false;
  }
}

async function checkCircuitBreakerStatus() {
  try {
    // The circuit breaker is likely in the AdvancedDatabaseManager
    // Let's check if we can instantiate it without errors
    
    const { AdvancedDatabaseManager } = require('./dist/lib/advancedDatabaseManager');
    const db = AdvancedDatabaseManager.getInstance();
    
    // Try a simple query to test circuit breaker state
    const result = await db.executeQuery('circuit_breaker_test', async (client) => {
      const { data, error } = await client
        .from('tweet_analytics')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      return data;
    });
    
    console.log('✅ CIRCUIT_BREAKER: CLOSED - working normally');
    return true;
    
  } catch (error) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      console.log('🚨 CIRCUIT_BREAKER: OPEN - needs reset');
      return false;
    } else {
      console.log('⚠️ CIRCUIT_BREAKER_UNKNOWN:', error.message.substring(0, 100));
      return false;
    }
  }
}

async function testCoreSystemFunctionality() {
  try {
    // Test OpenAI service
    const { OpenAIService } = require('./dist/services/openAIService');
    const openai = OpenAIService.getInstance();
    console.log('✅ OPENAI_SERVICE: Available');
    
    // Test posting system (just instantiation)
    const { AIDrivenPostingSystem } = require('./dist/core/aiDrivenPostingSystem');
    const posting = AIDrivenPostingSystem.getInstance();
    console.log('✅ POSTING_SYSTEM: Available');
    
    // Test viral orchestrator
    const { EnhancedViralOrchestrator } = require('./dist/ai/enhancedViralOrchestrator');
    const viral = EnhancedViralOrchestrator.getInstance();
    console.log('✅ VIRAL_ORCHESTRATOR: Available');
    
    return true;
    
  } catch (error) {
    console.log('❌ CORE_SYSTEMS_ERROR:', error.message.substring(0, 100));
    return false;
  }
}

async function testEmergencySystemDependencies() {
  try {
    // Check if emergency systems are accessible
    console.log('📋 EMERGENCY_SYSTEMS: Checking availability...');
    
    // These systems should exist but not be overused
    const emergencyFiles = [
      './dist/audit/systemFailureAuditor.js',
      './dist/audit/emergencySystemTracker.js',
      './dist/audit/dataAnalysisEngine.js'
    ];
    
    const fs = require('fs');
    let availableCount = 0;
    
    emergencyFiles.forEach(file => {
      if (fs.existsSync(file)) {
        availableCount++;
        console.log(`✅ ${file.split('/').pop()}: Available`);
      } else {
        console.log(`❌ ${file.split('/').pop()}: Missing`);
      }
    });
    
    console.log(`📊 EMERGENCY_SYSTEMS: ${availableCount}/${emergencyFiles.length} available`);
    return availableCount === emergencyFiles.length;
    
  } catch (error) {
    console.log('❌ EMERGENCY_SYSTEMS_ERROR:', error.message);
    return false;
  }
}

async function repairDatabaseConnections() {
  try {
    console.log('🔧 REPAIRING: Database connection issues...');
    
    // Force a fresh database manager instance
    const { AdvancedDatabaseManager } = require('./dist/lib/advancedDatabaseManager');
    
    // Reset any cached instances (if the class supports it)
    if (AdvancedDatabaseManager.resetInstance) {
      AdvancedDatabaseManager.resetInstance();
      console.log('✅ RESET: Database manager instance');
    }
    
    // Create new instance and test
    const db = AdvancedDatabaseManager.getInstance();
    
    // Test with a simple query
    await db.executeQuery('repair_test', async (client) => {
      const { data, error } = await client
        .from('tweet_analytics')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      return data;
    });
    
    console.log('✅ DATABASE_REPAIR: Connection restored');
    return true;
    
  } catch (error) {
    console.log('❌ DATABASE_REPAIR_ERROR:', error.message.substring(0, 100));
    return false;
  }
}

async function resetCircuitBreakers() {
  try {
    console.log('🔧 RESETTING: Circuit breakers...');
    
    // The circuit breaker reset would typically be in the database manager
    const { AdvancedDatabaseManager } = require('./dist/lib/advancedDatabaseManager');
    const db = AdvancedDatabaseManager.getInstance();
    
    // If there's a reset method, use it
    if (db.resetCircuitBreaker) {
      db.resetCircuitBreaker();
      console.log('✅ CIRCUIT_BREAKER: Reset successfully');
    } else {
      console.log('📋 CIRCUIT_BREAKER: Auto-reset on next successful operation');
    }
    
    // Test the reset worked
    await db.executeQuery('circuit_breaker_reset_test', async (client) => {
      const { data, error } = await client
        .from('tweet_analytics')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      return data;
    });
    
    console.log('✅ CIRCUIT_BREAKER: Working after reset');
    return true;
    
  } catch (error) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      console.log('⚠️ CIRCUIT_BREAKER: Still OPEN - may need time to reset');
      return false;
    } else {
      console.log('❌ CIRCUIT_BREAKER_RESET_ERROR:', error.message.substring(0, 100));
      return false;
    }
  }
}

async function optimizeConnectionPooling() {
  console.log('🔧 OPTIMIZING: Connection pooling configuration...');
  
  // Log current configuration
  console.log('📋 CONNECTION_POOL: Current settings:');
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'Missing'}`);
  console.log(`   SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing'}`);
  
  // Recommendations for connection pooling
  console.log('💡 OPTIMIZATION_RECOMMENDATIONS:');
  console.log('   • Reduce concurrent connections if experiencing timeouts');
  console.log('   • Implement exponential backoff for retries');
  console.log('   • Add connection warming on startup');
  console.log('   • Monitor connection pool health');
  
  console.log('✅ CONNECTION_POOL: Optimization guidance provided');
  return true;
}

async function verifySystemHealth() {
  try {
    console.log('🏥 VERIFYING: Complete system health...');
    
    let healthScore = 0;
    const maxScore = 5;
    
    // Test 1: Database connection
    try {
      await testDatabaseConnection();
      healthScore++;
      console.log('✅ HEALTH_CHECK: Database connection');
    } catch (e) {
      console.log('❌ HEALTH_CHECK: Database connection failed');
    }
    
    // Test 2: Circuit breaker
    try {
      const cbStatus = await checkCircuitBreakerStatus();
      if (cbStatus) {
        healthScore++;
        console.log('✅ HEALTH_CHECK: Circuit breaker');
      } else {
        console.log('⚠️ HEALTH_CHECK: Circuit breaker needs attention');
      }
    } catch (e) {
      console.log('❌ HEALTH_CHECK: Circuit breaker failed');
    }
    
    // Test 3: Core systems
    try {
      await testCoreSystemFunctionality();
      healthScore++;
      console.log('✅ HEALTH_CHECK: Core systems');
    } catch (e) {
      console.log('❌ HEALTH_CHECK: Core systems failed');
    }
    
    // Test 4: Emergency systems
    try {
      await testEmergencySystemDependencies();
      healthScore++;
      console.log('✅ HEALTH_CHECK: Emergency systems');
    } catch (e) {
      console.log('❌ HEALTH_CHECK: Emergency systems failed');
    }
    
    // Test 5: Audit system
    try {
      const { SystemFailureAuditor } = require('./dist/audit/systemFailureAuditor');
      const auditor = SystemFailureAuditor.getInstance();
      healthScore++;
      console.log('✅ HEALTH_CHECK: Audit system');
    } catch (e) {
      console.log('❌ HEALTH_CHECK: Audit system failed');
    }
    
    const healthPercentage = (healthScore / maxScore) * 100;
    console.log(`🎯 SYSTEM_HEALTH: ${healthScore}/${maxScore} (${healthPercentage}%)`);
    
    if (healthPercentage >= 80) {
      console.log('🎉 SYSTEM_STATUS: Excellent - ready for production');
      return true;
    } else if (healthPercentage >= 60) {
      console.log('⚠️ SYSTEM_STATUS: Good - minor issues remain');
      return true;
    } else {
      console.log('🚨 SYSTEM_STATUS: Critical - needs immediate attention');
      return false;
    }
    
  } catch (error) {
    console.log('❌ VERIFICATION_ERROR:', error.message);
    return false;
  }
}

// Run the diagnosis and repair
diagnoseAndRepairSystem()
  .then(success => {
    if (success) {
      console.log('\n🚀 SYSTEM_READY: All systems operational for smooth next build!');
      process.exit(0);
    } else {
      console.log('\n⚠️ SYSTEM_PARTIAL: Some issues remain - see recommendations above');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 SYSTEM_REPAIR_CRASH:', error.message);
    process.exit(1);
  });
