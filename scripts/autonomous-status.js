#!/usr/bin/env node

/**
 * 📊 AUTONOMOUS STATUS CHECKER
 * Displays current status of the autonomous system
 */

const { autonomousMain } = require('../dist/autonomous/autonomousMain');

async function checkAutonomousStatus() {
  console.log('📊 AUTONOMOUS_STATUS: Checking system status...\n');
  
  try {
    const status = await autonomousMain.getSystemStatus();
    
    console.log('🤖 AUTONOMOUS SYSTEM STATUS');
    console.log('============================');
    console.log(`Health: ${status.autonomous.systemHealth}`);
    console.log(`Autonomy Level: ${status.autonomous.autonomyLevel}%`);
    console.log(`Posts Today: ${status.autonomous.postsToday}`);
    console.log(`Last Post: ${status.autonomous.lastPost?.toLocaleString() || 'Never'}`);
    console.log(`Learning Active: ${status.autonomous.learningActive ? 'Yes' : 'No'}`);
    console.log(`System Running: ${status.autonomous.isRunning ? 'Yes' : 'No'}`);
    
    console.log('\n🔧 INTEGRATION STATUS');
    console.log('=====================');
    console.log(`Topics Replaced: ${status.integration.topicsReplaced ? 'Yes' : 'No'}`);
    console.log(`Timing Replaced: ${status.integration.timingReplaced ? 'Yes' : 'No'}`);
    console.log(`Metrics Integrated: ${status.integration.metricsIntegrated ? 'Yes' : 'No'}`);
    console.log(`Autonomous Enabled: ${status.integration.autonomousEnabled ? 'Yes' : 'No'}`);
    console.log(`Overall Status: ${status.integration.overallStatus.toUpperCase()}`);
    
    console.log(`\n⏰ Timestamp: ${status.timestamp.toLocaleString()}`);
    console.log('\n✅ Status check complete');
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkAutonomousStatus();
}

module.exports = { checkAutonomousStatus };
