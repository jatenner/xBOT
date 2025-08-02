#!/usr/bin/env node

/**
 * 🚨 EMERGENCY GROWTH ACTIVATION SCRIPT
 * Run this to immediately resolve posting crisis and activate growth mode
 */

const path = require('path');

// Add the src directory to the module path
require('module-alias/register');
require('module-alias').addAlias('@', path.join(__dirname, '..', 'src'));

async function emergencyActivation() {
  console.log('🚨 ============================================');
  console.log('🚨   EMERGENCY GROWTH ACTIVATION STARTING');
  console.log('🚨 ============================================');
  console.log('');

  try {
    // Import the emergency activator
    const { EmergencyPostingActivator } = await import('../src/utils/emergencyPostingActivator.js');
    
    console.log('🔥 Starting complete emergency activation...');
    const result = await EmergencyPostingActivator.activateEmergencyGrowth();
    
    console.log('');
    console.log('📊 === ACTIVATION RESULTS ===');
    console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    console.log('🎯 Actions Completed:');
    result.actions.forEach(action => console.log(`   ${action}`));
    console.log('');
    
    console.log('🔮 Next Steps:');
    result.nextSteps.forEach(step => console.log(`   📋 ${step}`));
    console.log('');
    
    if (result.success) {
      console.log('🎉 ============================================');
      console.log('🎉   EMERGENCY ACTIVATION SUCCESSFUL!');
      console.log('🎉   Your bot should start posting immediately');
      console.log('🎉 ============================================');
    } else {
      console.log('❌ ============================================');
      console.log('❌   ACTIVATION FAILED - Check logs above');
      console.log('❌ ============================================');
    }
    
  } catch (error) {
    console.error('💥 CRITICAL ERROR during activation:');
    console.error(error);
    console.log('');
    console.log('🛠️  MANUAL STEPS TO TRY:');
    console.log('   1. Delete all cache files (.*cache*, .duplicate*)');
    console.log('   2. Restart Railway deployment');
    console.log('   3. Check environment variables are set');
    console.log('   4. Monitor logs for posting attempts');
  }
}

// Run the activation
emergencyActivation().catch(console.error);