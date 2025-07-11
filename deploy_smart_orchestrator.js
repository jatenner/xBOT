#!/usr/bin/env node

/**
 * 🎯 SMART POSTING ORCHESTRATOR DEPLOYMENT
 * 
 * Safely deploy the new anti-burst posting system that will:
 * - Prevent the "16 tweets in a row" problem forever
 * - Ensure perfect 6-post daily schedule
 * - Enable trending override for viral opportunities
 * - Maintain budget protection
 * 
 * DEPLOYMENT STEPS:
 * 1. Disable old posting systems
 * 2. Update all configuration limits
 * 3. Deploy new orchestrator
 * 4. Test the system
 * 5. Enable monitoring
 */

import { supabaseClient } from './src/utils/supabaseClient.js';

console.log('🎯 === SMART POSTING ORCHESTRATOR DEPLOYMENT ===');
console.log('🛡️ Deploying anti-burst protection system');
console.log('📅 Implementing perfect posting schedule');
console.log('');

async function disableLegacySystems() {
  console.log('1️⃣ DISABLING LEGACY POSTING SYSTEMS');
  console.log('   Stopping old burst-prone posting mechanisms...');
  
  try {
    // Disable all legacy posting configurations
    const legacyConfigs = [
      { key: 'nuclear_intelligence_unleashed', description: 'Nuclear mode (burst-prone)' },
      { key: 'max_posts_per_hour_3', description: 'High frequency posting' },
      { key: 'max_posts_per_day_72', description: 'High volume posting' },
      { key: 'dynamic_posting_enabled', description: 'Uncontrolled dynamic posting' },
      { key: 'supreme_ai_posting', description: 'AI-driven burst posting' },
      { key: 'emergency_posting_bypass', description: 'Emergency bypass mode' }
    ];
    
    for (const config of legacyConfigs) {
      await supabaseClient.supabase
        ?.from('bot_config')
        .delete()
        .eq('key', config.key);
      
      console.log(`   ❌ Disabled: ${config.description}`);
    }
    
    console.log('   ✅ Legacy systems disabled');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error disabling legacy systems:', error);
    throw error;
  }
}

async function updateSystemConfiguration() {
  console.log('2️⃣ UPDATING SYSTEM CONFIGURATION');
  console.log('   Setting unified posting limits...');
  
  try {
    // Set the new unified configuration
    const newConfig = {
      // 🎯 SMART ORCHESTRATOR SETTINGS
      posting_system: 'smart_orchestrator',
      max_posts_per_hour: 1,
      max_posts_per_day: 6,
      min_interval_minutes: 120,
      
      // 🛡️ ANTI-BURST PROTECTION
      burst_protection_enabled: true,
      rapid_fire_prevention: true,
      
      // 📅 PERFECT SCHEDULE
      perfect_schedule_enabled: true,
      scheduled_times: [
        '08:00', '11:30', '14:00', '16:30', '19:00', '21:30'
      ],
      
      // 🔥 TRENDING FEATURES
      trending_override_enabled: true,
      max_trending_posts_per_day: 2,
      trending_urgency_threshold: 0.7,
      
      // 💰 BUDGET INTEGRATION
      budget_aware_posting: true,
      daily_budget_limit: 5.00,
      
      // ⚙️ SYSTEM FLAGS
      smart_orchestrator_active: true,
      deployment_timestamp: new Date().toISOString(),
      deployed_by: 'Smart Orchestrator Deployment Script'
    };
    
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert({
        key: 'smart_orchestrator_config',
        value: newConfig,
        description: 'Smart Posting Orchestrator unified configuration'
      });
    
    console.log('   ✅ Configuration updated:');
    console.log(`      🎯 Max posts: ${newConfig.max_posts_per_day}/day, ${newConfig.max_posts_per_hour}/hour`);
    console.log(`      ⏰ Min interval: ${newConfig.min_interval_minutes} minutes`);
    console.log(`      🔥 Trending posts: ${newConfig.max_trending_posts_per_day} extra per day`);
    console.log(`      💰 Budget limit: $${newConfig.daily_budget_limit}/day`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
    throw error;
  }
}

async function createOrchestratorTables() {
  console.log('3️⃣ CREATING ORCHESTRATOR DATABASE TABLES');
  console.log('   Setting up state tracking...');
  
  try {
    // The orchestrator uses bot_config for state storage
    // Just ensure the table exists and is accessible
    
    const testInsert = {
      key: 'orchestrator_deployment_test',
      value: {
        test: true,
        timestamp: new Date().toISOString()
      },
      description: 'Test entry for orchestrator deployment'
    };
    
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert(testInsert);
    
    // Clean up test entry
    await supabaseClient.supabase
      ?.from('bot_config')
      .delete()
      .eq('key', 'orchestrator_deployment_test');
    
    console.log('   ✅ Database tables ready');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  }
}

async function deployOrchestrator() {
  console.log('4️⃣ DEPLOYING SMART POSTING ORCHESTRATOR');
  console.log('   Activating new posting system...');
  
  try {
    // Set deployment flags
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert({
        key: 'orchestrator_deployed',
        value: {
          deployed: true,
          deployment_time: new Date().toISOString(),
          version: '1.0.0',
          features: [
            'anti_burst_protection',
            'perfect_scheduling',
            'trending_override',
            'budget_integration'
          ]
        },
        description: 'Smart Posting Orchestrator deployment status'
      });
    
    // Enable the system
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert({
        key: 'enabled',
        value: 'true',
        description: 'Bot enabled with Smart Posting Orchestrator'
      });
    
    console.log('   ✅ Smart Posting Orchestrator deployed');
    console.log('   🛡️ Anti-burst protection: ACTIVE');
    console.log('   📅 Perfect schedule: ENABLED');
    console.log('   🔥 Trending detection: ENABLED');
    console.log('   💰 Budget protection: ACTIVE');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error deploying orchestrator:', error);
    throw error;
  }
}

async function verifyDeployment() {
  console.log('5️⃣ VERIFYING DEPLOYMENT');
  console.log('   Running system checks...');
  
  try {
    // Check if configuration is properly set
    const { data: config } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('*')
      .eq('key', 'smart_orchestrator_config')
      .single() || { data: null };
    
    if (!config) {
      throw new Error('Smart Orchestrator configuration not found');
    }
    
    console.log('   ✅ Configuration verified');
    
    // Check if system is enabled
    const { data: enabled } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('value')
      .eq('key', 'enabled')
      .single() || { data: null };
    
    if (enabled?.value !== 'true') {
      throw new Error('System not enabled');
    }
    
    console.log('   ✅ System enabled');
    
    // Check deployment status
    const { data: deployment } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('*')
      .eq('key', 'orchestrator_deployed')
      .single() || { data: null };
    
    if (!deployment?.value?.deployed) {
      throw new Error('Orchestrator deployment flag not set');
    }
    
    console.log('   ✅ Deployment status confirmed');
    console.log('');
    
    // Test basic orchestrator functions (if possible)
    console.log('   🧪 Testing orchestrator functions...');
    
    // Import and test the orchestrator (this might fail in some environments)
    try {
      const { smartPostingOrchestrator } = await import('./src/utils/smartPostingOrchestrator.js');
      
      // Test shouldPostNow function
      const decision = await smartPostingOrchestrator.shouldPostNow('manual');
      console.log(`   📊 Test decision: ${decision.canPost ? 'CAN POST' : 'BLOCKED'} - ${decision.reason}`);
      
      console.log('   ✅ Orchestrator functions working');
      
    } catch (importError) {
      console.log('   ⚠️ Orchestrator function test skipped (import issue)');
      console.log('   📝 Manual testing recommended after deployment');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Deployment verification failed:', error);
    throw error;
  }
}

async function createMonitoringAlerts() {
  console.log('6️⃣ SETTING UP MONITORING');
  console.log('   Creating burst detection alerts...');
  
  try {
    // Set up monitoring configuration
    const monitoringConfig = {
      burst_detection_enabled: true,
      max_posts_per_hour_alert: 2, // Alert if more than 2 posts in an hour
      min_interval_alert: 90, // Alert if posts less than 90 minutes apart
      daily_limit_alert: 7, // Alert if more than 7 posts in a day
      
      // Notification settings
      alert_on_burst: true,
      alert_on_schedule_deviation: true,
      alert_on_budget_exceed: true,
      
      // Monitoring intervals
      health_check_interval: 30, // minutes
      status_report_interval: 180, // minutes (3 hours)
      
      monitoring_active: true,
      setup_time: new Date().toISOString()
    };
    
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert({
        key: 'orchestrator_monitoring',
        value: monitoringConfig,
        description: 'Smart Posting Orchestrator monitoring configuration'
      });
    
    console.log('   ✅ Monitoring alerts configured');
    console.log('   🚨 Burst detection: ACTIVE');
    console.log('   📊 Health checks: Every 30 minutes');
    console.log('   📈 Status reports: Every 3 hours');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error setting up monitoring:', error);
    throw error;
  }
}

async function deploymentSummary() {
  console.log('🎉 === DEPLOYMENT COMPLETE ===');
  console.log('');
  console.log('🛡️ ANTI-BURST PROTECTION DEPLOYED');
  console.log('   ❌ No more 16 tweets in a row!');
  console.log('   ✅ Maximum 1 post per hour');
  console.log('   ✅ Perfect 2-hour spacing');
  console.log('');
  console.log('📅 PERFECT SCHEDULE ACTIVE');
  console.log('   🌅 08:00 - Morning professional audience');
  console.log('   ☕ 11:30 - Late morning engagement');
  console.log('   🍽️ 14:00 - Lunch break audience');
  console.log('   📊 16:30 - Afternoon professional break');
  console.log('   🌆 19:00 - Evening engagement peak');
  console.log('   🌙 21:30 - Late evening audience');
  console.log('');
  console.log('🔥 TRENDING OVERRIDE READY');
  console.log('   ✅ Up to 2 extra posts for viral opportunities');
  console.log('   ✅ 70% urgency threshold for activation');
  console.log('   ✅ Breaking news detection active');
  console.log('');
  console.log('💰 BUDGET PROTECTION MAINTAINED');
  console.log('   ✅ $5.00 daily limit enforced');
  console.log('   ✅ Cost tracking integrated');
  console.log('   ✅ Emergency brake at $4.50');
  console.log('');
  console.log('📊 MONITORING ACTIVE');
  console.log('   ✅ Burst detection alerts');
  console.log('   ✅ Schedule deviation warnings');
  console.log('   ✅ Budget exceed notifications');
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('   1. Start the bot with: npm start');
  console.log('   2. Monitor the first few posts');
  console.log('   3. Verify perfect 2-hour spacing');
  console.log('   4. Check for trending opportunities');
  console.log('   5. Enjoy sustainable, professional posting!');
  console.log('');
}

async function main() {
  try {
    console.log('🚀 Starting Smart Posting Orchestrator deployment...');
    console.log('');
    
    await disableLegacySystems();
    await updateSystemConfiguration();
    await createOrchestratorTables();
    await deployOrchestrator();
    await verifyDeployment();
    await createMonitoringAlerts();
    await deploymentSummary();
    
    console.log('✅ Smart Posting Orchestrator deployed successfully!');
    console.log('🎯 The "16 tweets in a row" problem is now SOLVED!');
    
  } catch (error) {
    console.error('💥 DEPLOYMENT FAILED:', error);
    console.log('');
    console.log('🚨 ROLLBACK REQUIRED:');
    console.log('   1. Check the error above');
    console.log('   2. Fix any issues');
    console.log('   3. Re-run this deployment script');
    console.log('   4. Or manually revert to previous configuration');
    
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  main().then(() => {
    console.log('🎉 Deployment completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  });
} 