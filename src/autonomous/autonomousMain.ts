/**
 * 🚀 AUTONOMOUS MAIN ENTRY POINT
 * Replaces hardcoded posting with fully autonomous AI-driven system
 */

import AutonomousPostingSystem from './autonomousPostingSystem';
import AutonomousIntegration from './autonomousIntegration';
import { getRedisSafeClient } from '../lib/redisSafe';
import { getSafeDatabase } from '../lib/db';

export class AutonomousMain {
  private autonomousSystem = AutonomousPostingSystem.getInstance();
  private integration = AutonomousIntegration.getInstance();
  private redis = getRedisSafeClient();
  private db = getSafeDatabase();

  /**
   * 🚀 START AUTONOMOUS SYSTEM
   * Main entry point for completely autonomous operation
   */
  async startAutonomousSystem(): Promise<void> {
    console.log('🚀 AUTONOMOUS_MAIN: Initializing complete autonomous system...');
    console.log('===============================================================');
    
    try {
      // 1. Initialize system integration
      console.log('\n📋 PHASE 1: System Integration');
      await this.performSystemIntegration();
      
      // 2. Validate all components
      console.log('\n🧪 PHASE 2: Component Validation');
      await this.validateAllComponents();
      
      // 3. Start autonomous loop
      console.log('\n🤖 PHASE 3: Starting Autonomous Loop');
      await this.startAutonomousLoop();
      
    } catch (error) {
      console.error('❌ AUTONOMOUS_STARTUP_FAILED:', error);
      throw error;
    }
  }

  /**
   * 📋 PERFORM SYSTEM INTEGRATION
   */
  private async performSystemIntegration(): Promise<void> {
    console.log('📋 INTEGRATING: Autonomous components...');
    
    // Replace hardcoded systems with AI-driven ones
    await this.integration.replaceHardcodedTopics();
    await this.integration.replaceHardcodedTiming();
    await this.integration.integrateContinuousMetrics();
    
    console.log('✅ INTEGRATION_COMPLETE: All systems updated');
  }

  /**
   * 🧪 VALIDATE ALL COMPONENTS
   */
  private async validateAllComponents(): Promise<void> {
    console.log('🧪 VALIDATING: All autonomous components...');
    
    const integrationPassed = await this.integration.testFullIntegration();
    
    if (!integrationPassed) {
      throw new Error('Component validation failed');
    }
    
    console.log('✅ VALIDATION_COMPLETE: All components operational');
  }

  /**
   * 🤖 START AUTONOMOUS LOOP
   */
  private async startAutonomousLoop(): Promise<void> {
    console.log('🤖 STARTING: Fully autonomous posting loop...');
    
    // Enable autonomous mode
    await this.integration.enableAutonomousMode();
    
    // Start the main autonomous loop
    console.log('🔄 AUTONOMOUS_LOOP: Starting infinite learning loop...');
    
    // In production, this would run indefinitely
    // For testing, we'll just initialize it
    if (process.env.DRY_RUN === '1') {
      console.log('🧪 DRY_RUN: Autonomous system initialized (not starting loop)');
      await this.runSingleAutonomousCycle();
    } else {
      console.log('🚀 LIVE_MODE: Starting continuous autonomous loop...');
      await this.autonomousSystem.startAutonomousLoop();
    }
  }

  /**
   * 🔄 RUN SINGLE AUTONOMOUS CYCLE (for testing)
   */
  private async runSingleAutonomousCycle(): Promise<void> {
    console.log('🔄 TESTING: Single autonomous cycle...');
    
    try {
      // Get system status
      const status = await this.autonomousSystem.getSystemStatus();
      console.log(`📊 SYSTEM_STATUS:`);
      console.log(`   Health: ${status.systemHealth}`);
      console.log(`   Autonomy Level: ${status.autonomyLevel}%`);
      console.log(`   Posts Today: ${status.postsToday}`);
      console.log(`   Last Post: ${status.lastPost?.toLocaleString() || 'Never'}`);
      
      console.log('✅ SINGLE_CYCLE_COMPLETE: System is ready for autonomous operation');
      
    } catch (error) {
      console.error('❌ SINGLE_CYCLE_FAILED:', error);
    }
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  async getSystemStatus(): Promise<any> {
    const [autonomousStatus, integrationStatus] = await Promise.all([
      this.autonomousSystem.getSystemStatus(),
      this.integration.getIntegrationStatus()
    ]);
    
    return {
      autonomous: autonomousStatus,
      integration: integrationStatus,
      timestamp: new Date()
    };
  }

  /**
   * 🛑 STOP AUTONOMOUS SYSTEM
   */
  stopAutonomousSystem(): void {
    console.log('🛑 STOPPING: Autonomous system...');
    this.autonomousSystem.stopAutonomousLoop();
    console.log('✅ AUTONOMOUS_SYSTEM_STOPPED');
  }
}

// Export singleton instance
export const autonomousMain = new AutonomousMain();

// Main execution function
export async function runAutonomousSystem(): Promise<void> {
  await autonomousMain.startAutonomousSystem();
}

// CLI integration
if (require.main === module) {
  console.log('🚀 AUTONOMOUS_CLI: Starting from command line...');
  
  runAutonomousSystem()
    .then(() => {
      console.log('✅ AUTONOMOUS_SYSTEM: Successfully started');
    })
    .catch((error) => {
      console.error('❌ AUTONOMOUS_SYSTEM_FAILED:', error);
      process.exit(1);
    });
}

export default AutonomousMain;
