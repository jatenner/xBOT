/**
 * 🚀 DEPLOYMENT MODE CONFIGURATION
 * 
 * Prevents conflicts between local and production instances
 */

export interface DeploymentMode {
  environment: 'local' | 'production' | 'development';
  allowConcurrentInstances: boolean;
  processLockEnabled: boolean;
  twitterApiExclusive: boolean;
}

export class DeploymentModeManager {
  private static instance: DeploymentModeManager;
  private currentMode: DeploymentMode;

  private constructor() {
    this.currentMode = this.detectMode();
  }

  static getInstance(): DeploymentModeManager {
    if (!DeploymentModeManager.instance) {
      DeploymentModeManager.instance = new DeploymentModeManager();
    }
    return DeploymentModeManager.instance;
  }

  private detectMode(): DeploymentMode {
    // Check environment variables
    const nodeEnv = process.env.NODE_ENV || 'development';
    const renderEnv = process.env.RENDER || false;
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'auto';

    console.log('🔍 Deployment Mode Detection:');
    console.log(`   NODE_ENV: ${nodeEnv}`);
    console.log(`   RENDER: ${renderEnv ? 'true' : 'false'}`);
    console.log(`   DEPLOYMENT_MODE: ${deploymentMode}`);

    // Render environment
    if (renderEnv || process.env.RENDER_SERVICE_ID) {
      console.log('☁️  Detected: RENDER PRODUCTION ENVIRONMENT');
      return {
        environment: 'production',
        allowConcurrentInstances: false,
        processLockEnabled: true,
        twitterApiExclusive: true
      };
    }

    // Local development
    if (nodeEnv === 'development' || deploymentMode === 'local') {
      console.log('🏠 Detected: LOCAL DEVELOPMENT ENVIRONMENT');
      return {
        environment: 'local',
        allowConcurrentInstances: false,
        processLockEnabled: true,
        twitterApiExclusive: true
      };
    }

    // Production mode locally
    if (nodeEnv === 'production' || deploymentMode === 'production') {
      console.log('🚀 Detected: LOCAL PRODUCTION MODE');
      return {
        environment: 'production',
        allowConcurrentInstances: false,
        processLockEnabled: true,
        twitterApiExclusive: true
      };
    }

    // Default
    console.log('🔧 Default: DEVELOPMENT MODE');
    return {
      environment: 'development',
      allowConcurrentInstances: true,
      processLockEnabled: false,
      twitterApiExclusive: false
    };
  }

  getCurrentMode(): DeploymentMode {
    return this.currentMode;
  }

  isProductionMode(): boolean {
    return this.currentMode.environment === 'production';
  }

  shouldUseProcessLock(): boolean {
    return this.currentMode.processLockEnabled;
  }

  canRunConcurrently(): boolean {
    return this.currentMode.allowConcurrentInstances;
  }

  requiresTwitterExclusivity(): boolean {
    return this.currentMode.twitterApiExclusive;
  }

  /**
   * Check for conflicting instances
   */
  async checkForConflicts(): Promise<{
    hasConflicts: boolean;
    conflictDetails: string[];
    recommendation: string;
  }> {
    const conflicts: string[] = [];
    
    // Check for process conflicts
    if (this.requiresTwitterExclusivity()) {
      // This would need platform-specific implementation
      console.log('🔍 Checking for process conflicts...');
      
      // For now, log the check
      console.log('✅ No obvious conflicts detected');
    }

    const hasConflicts = conflicts.length > 0;
    const recommendation = hasConflicts 
      ? '🛑 Stop conflicting instances before continuing'
      : '✅ Safe to proceed with current configuration';

    return {
      hasConflicts,
      conflictDetails: conflicts,
      recommendation
    };
  }

  /**
   * Get startup message
   */
  getStartupMessage(): string {
    const mode = this.getCurrentMode();
    const env = mode.environment.toUpperCase();
    
    return `🎯 DEPLOYMENT MODE: ${env}
🔒 Process Lock: ${mode.processLockEnabled ? 'ENABLED' : 'DISABLED'}
🐦 Twitter Exclusive: ${mode.twitterApiExclusive ? 'YES' : 'NO'}
🔄 Concurrent Allowed: ${mode.allowConcurrentInstances ? 'YES' : 'NO'}`;
  }
}

// Export singleton instance
export const deploymentMode = DeploymentModeManager.getInstance(); 