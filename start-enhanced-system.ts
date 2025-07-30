#!/usr/bin/env node

/**
 * 🚀 ENHANCED AUTONOMOUS SYSTEM STARTUP
 * 
 * This script starts the enhanced autonomous Twitter growth system
 * with all learning components active.
 */

import { enhancedAutonomousController } from './src/core/enhancedAutonomousController';
import { EmergencyBudgetLockdown } from './src/utils/emergencyBudgetLockdown';

async function startEnhancedSystem() {
  console.log('🚀 === ENHANCED AUTONOMOUS TWITTER GROWTH SYSTEM ===');
  console.log('🧠 Starting intelligent learning-based autonomous operation...');
  console.log('');

  try {
    // Check budget status
    const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
    console.log(`💰 Budget Status: ${budgetStatus.lockdownActive ? 'LOCKED DOWN' : 'ACTIVE'}`);
    console.log(`💵 Daily Utilization: ${((budgetStatus.totalSpent / budgetStatus.dailyLimit) * 100).toFixed(1)}%`);
    console.log(`💰 Remaining Budget: $${(budgetStatus.dailyLimit - budgetStatus.totalSpent).toFixed(2)}`);
    console.log('');

    // Start the enhanced system
    await enhancedAutonomousController.startEnhancedSystem();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received shutdown signal...');
      await enhancedAutonomousController.stopEnhancedSystem();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received termination signal...');
      await enhancedAutonomousController.stopEnhancedSystem();
      process.exit(0);
    });

    // Keep the process running
    console.log('🔄 Enhanced system is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('❌ Failed to start enhanced system:', error);
    process.exit(1);
  }
}

// Start the system
startEnhancedSystem();
