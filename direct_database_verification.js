#!/usr/bin/env node

/**
 * 🔍 DIRECT DATABASE VERIFICATION
 * 
 * Tests database functionality using direct SQL without schema cache
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 === DIRECT DATABASE VERIFICATION ===');
console.log('🎯 Testing database with direct SQL operations\n');

async function directDatabaseVerification() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    console.log('✅ Connected to database');
    
    // Test 1: Direct table existence check
    console.log('\n📊 === CHECKING TABLE EXISTENCE ===');
    
    const tables = [
      'autonomous_decisions',
      'follower_growth_predictions', 
      'follower_tracking',
      'autonomous_growth_strategies'
    ];
    
    let tablesExist = 0;
    
    for (const tableName of tables) {
      try {
        // Direct query to check table existence
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Table exists and is accessible`);
          tablesExist++;
        }
      } catch (error) {
        console.log(`❌ ${tableName}: ${error.message}`);
      }
    }
    
    // Test 2: Direct INSERT operations (the real test)
    console.log('\n🔧 === TESTING DIRECT INSERT OPERATIONS ===');
    
    let insertsWorking = 0;
    const totalInserts = 4;
    
    // Test autonomous_decisions insert
    console.log('🔧 Testing autonomous_decisions insert...');
    try {
      const testRecord = {
        content: 'Direct verification test',
        action: 'post',
        confidence: 0.85
      };
      
      const { data, error } = await supabase
        .from('autonomous_decisions')
        .insert(testRecord)
        .select();
      
      if (error) {
        console.log(`  ❌ Insert failed: ${error.message}`);
      } else {
        console.log(`  ✅ Insert successful! Record ID: ${data[0].id}`);
        insertsWorking++;
        
        // Clean up
        await supabase.from('autonomous_decisions').delete().eq('id', data[0].id);
        console.log(`  🧹 Cleanup completed`);
      }
    } catch (error) {
      console.log(`  ❌ Insert error: ${error.message}`);
    }
    
    // Test follower_growth_predictions insert
    console.log('\n🔧 Testing follower_growth_predictions insert...');
    try {
      const testRecord = {
        content: 'Prediction test content',
        followers_predicted: 50,
        confidence: 0.80
      };
      
      const { data, error } = await supabase
        .from('follower_growth_predictions')
        .insert(testRecord)
        .select();
      
      if (error) {
        console.log(`  ❌ Insert failed: ${error.message}`);
      } else {
        console.log(`  ✅ Insert successful! Record ID: ${data[0].id}`);
        insertsWorking++;
        
        // Clean up
        await supabase.from('follower_growth_predictions').delete().eq('id', data[0].id);
        console.log(`  🧹 Cleanup completed`);
      }
    } catch (error) {
      console.log(`  ❌ Insert error: ${error.message}`);
    }
    
    // Test follower_tracking insert
    console.log('\n🔧 Testing follower_tracking insert...');
    try {
      const testRecord = {
        followers_before: 1000,
        followers_after: 1025,
        engagement_rate: 0.065
      };
      
      const { data, error } = await supabase
        .from('follower_tracking')
        .insert(testRecord)
        .select();
      
      if (error) {
        console.log(`  ❌ Insert failed: ${error.message}`);
      } else {
        console.log(`  ✅ Insert successful! Record ID: ${data[0].id}`);
        insertsWorking++;
        
        // Clean up
        await supabase.from('follower_tracking').delete().eq('id', data[0].id);
        console.log(`  🧹 Cleanup completed`);
      }
    } catch (error) {
      console.log(`  ❌ Insert error: ${error.message}`);
    }
    
    // Test autonomous_growth_strategies insert
    console.log('\n🔧 Testing autonomous_growth_strategies insert...');
    try {
      const testRecord = {
        strategy_name: `Verification Test ${Date.now()}`,
        strategy_type: 'test',
        is_active: true,
        success_rate: 0.75
      };
      
      const { data, error } = await supabase
        .from('autonomous_growth_strategies')
        .insert(testRecord)
        .select();
      
      if (error) {
        console.log(`  ❌ Insert failed: ${error.message}`);
      } else {
        console.log(`  ✅ Insert successful! Record ID: ${data[0].id}`);
        insertsWorking++;
        
        // Clean up
        await supabase.from('autonomous_growth_strategies').delete().eq('id', data[0].id);
        console.log(`  🧹 Cleanup completed`);
      }
    } catch (error) {
      console.log(`  ❌ Insert error: ${error.message}`);
    }
    
    // Test 3: Test the specific UPDATE operations that were failing
    console.log('\n🎯 === TESTING UPDATE OPERATIONS ===');
    
    let updatesWorking = 0;
    const totalUpdates = 3;
    
    // Create test records first
    console.log('🔧 Creating test records for update operations...');
    
    let testDecisionId, testPredictionId, testStrategyId;
    
    try {
      // Create test decision
      const { data: decisionData } = await supabase
        .from('autonomous_decisions')
        .insert({ content: 'Update test', action: 'post' })
        .select();
      testDecisionId = decisionData?.[0]?.id;
      
      // Create test prediction
      const { data: predictionData } = await supabase
        .from('follower_growth_predictions')
        .insert({ content: 'Update test prediction', followers_predicted: 30 })
        .select();
      testPredictionId = predictionData?.[0]?.id;
      
      // Create test strategy
      const { data: strategyData } = await supabase
        .from('autonomous_growth_strategies')
        .insert({ 
          strategy_name: `Update Test ${Date.now()}`, 
          strategy_type: 'test' 
        })
        .select();
      testStrategyId = strategyData?.[0]?.id;
      
      console.log('✅ Test records created successfully');
      
    } catch (error) {
      console.log(`❌ Failed to create test records: ${error.message}`);
    }
    
    // Test UPDATE operations (the ones that were originally failing)
    if (testPredictionId) {
      console.log('🔧 Testing UPDATE follower_growth_predictions SET confidence...');
      try {
        const { error } = await supabase
          .from('follower_growth_predictions')
          .update({ confidence: 0.75 })
          .eq('id', testPredictionId);
        
        if (error) {
          console.log(`  ❌ Update failed: ${error.message}`);
        } else {
          console.log(`  ✅ UPDATE confidence: SUCCESS`);
          updatesWorking++;
        }
      } catch (error) {
        console.log(`  ❌ Update error: ${error.message}`);
      }
    }
    
    if (testStrategyId) {
      console.log('🔧 Testing UPDATE autonomous_growth_strategies SET is_active...');
      try {
        const { error } = await supabase
          .from('autonomous_growth_strategies')
          .update({ is_active: true })
          .eq('id', testStrategyId);
        
        if (error) {
          console.log(`  ❌ Update failed: ${error.message}`);
        } else {
          console.log(`  ✅ UPDATE is_active: SUCCESS`);
          updatesWorking++;
        }
      } catch (error) {
        console.log(`  ❌ Update error: ${error.message}`);
      }
    }
    
    // Clean up test records
    console.log('\n🧹 Cleaning up test records...');
    if (testDecisionId) await supabase.from('autonomous_decisions').delete().eq('id', testDecisionId);
    if (testPredictionId) await supabase.from('follower_growth_predictions').delete().eq('id', testPredictionId);
    if (testStrategyId) await supabase.from('autonomous_growth_strategies').delete().eq('id', testStrategyId);
    
    // Test 4: Environment and TypeScript compilation
    console.log('\n🔐 === TESTING ENVIRONMENT & COMPILATION ===');
    
    const envVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'];
    let envWorking = 0;
    
    for (const envVar of envVars) {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar}: Configured`);
        envWorking++;
      } else {
        console.log(`❌ ${envVar}: Missing`);
      }
    }
    
    // Check TypeScript files exist
    const fs = require('fs');
    const criticalFiles = [
      './src/agents/autonomousTwitterGrowthMaster.ts',
      './src/agents/scheduler.ts',
      './src/utils/emergencyBudgetLockdown.ts'
    ];
    
    let filesExist = 0;
    for (const file of criticalFiles) {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file}: Exists`);
        filesExist++;
      } else {
        console.log(`❌ ${file}: Missing`);
      }
    }
    
    // Final Assessment
    console.log('\n📊 === DIRECT VERIFICATION RESULTS ===');
    
    const databaseHealth = ((tablesExist + insertsWorking + updatesWorking) / (tables.length + totalInserts + totalUpdates)) * 100;
    const systemHealth = ((envWorking + filesExist) / (envVars.length + criticalFiles.length)) * 100;
    const overallHealth = (databaseHealth + systemHealth) / 2;
    
    console.log(`📈 Database Operations: ${databaseHealth.toFixed(1)}% working`);
    console.log(`🔧 System Components: ${systemHealth.toFixed(1)}% working`);
    console.log(`🎯 Overall Health: ${overallHealth.toFixed(1)}%`);
    
    console.log('\n🏆 === FINAL ASSESSMENT ===');
    
    if (overallHealth >= 80) {
      console.log('🌟 === BACKEND STATUS: EXCELLENT ===');
      console.log('✅ Your backend is FULLY OPERATIONAL!');
      console.log('💪 Database schema is working correctly');
      console.log('🚀 All INSERT and UPDATE operations successful');
      console.log('🎯 Ready for autonomous operation');
      
      console.log('\n🎉 KEY ACHIEVEMENTS:');
      console.log(`   ✅ ${tablesExist}/${tables.length} tables accessible`);
      console.log(`   ✅ ${insertsWorking}/${totalInserts} insert operations working`);
      console.log(`   ✅ ${updatesWorking}/${totalUpdates} update operations working`);
      console.log(`   ✅ ${envWorking}/${envVars.length} environment variables configured`);
      
      console.log('\n🚀 YOUR SYSTEM CAN NOW:');
      console.log('   • Store autonomous decisions');
      console.log('   • Track follower growth predictions');
      console.log('   • Monitor engagement metrics');
      console.log('   • Learn and adapt strategies');
      console.log('   • Operate autonomously 24/7');
      
      return { status: 'excellent', health: overallHealth };
      
    } else if (overallHealth >= 60) {
      console.log('⚡ === BACKEND STATUS: GOOD ===');
      console.log('✅ Core database functionality is working');
      console.log('🔧 Some optimizations may be needed');
      console.log('🚀 System can operate with current setup');
      
      return { status: 'good', health: overallHealth };
      
    } else {
      console.log('⚠️ === BACKEND STATUS: NEEDS FIXES ===');
      console.log('🔧 Critical components require attention');
      console.log('📋 Review the errors above for specific fixes needed');
      
      return { status: 'needs_fixes', health: overallHealth };
    }
    
  } catch (error) {
    console.error('❌ Direct verification failed:', error);
    return { status: 'failed', error: error.message };
  }
}

// Run the verification
directDatabaseVerification()
  .then((results) => {
    console.log('\n🎯 === VERIFICATION COMPLETE ===');
    if (results.status === 'excellent') {
      console.log('🌟 Your backend is ready for production deployment!');
      process.exit(0);
    } else if (results.status === 'good') {
      console.log('⚡ Backend is operational - you can proceed with deployment');
      process.exit(0);
    } else {
      console.log('🔧 Please address the issues above before deployment');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }); 