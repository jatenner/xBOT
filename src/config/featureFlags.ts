/**
 * 🎛️ FEATURE FLAGS SYSTEM
 * 
 * Allows gradual rollout of learning and advanced features
 * Features can be enabled/disabled without code changes
 */

export interface FeatureFlags {
  // Core features (always enabled)
  core: {
    bulletproofContentGeneration: boolean;
    safetyChecking: boolean;
    budgetEnforcement: boolean;
  };
  
  // AI features (gradual rollout)
  ai: {
    eliteContentStrategist: boolean;
    banditLearning: boolean;
    engagementOptimization: boolean;
    contentQualityPrediction: boolean;
  };
  
  // Advanced features (experimental)
  advanced: {
    autonomousEngagement: boolean;
    predictivePosting: boolean;
    dynamicScheduling: boolean;
    competitiveIntelligence: boolean;
  };
  
  // Debug features (development)
  debug: {
    verboseLogging: boolean;
    simulationMode: boolean;
    dryRunMode: boolean;
  };
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: FeatureFlags;
  
  private constructor() {
    this.flags = this.getDefaultFlags();
    this.loadFromEnvironment();
  }
  
  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }
  
  private getDefaultFlags(): FeatureFlags {
    return {
      core: {
        bulletproofContentGeneration: true,
        safetyChecking: true,
        budgetEnforcement: true
      },
      ai: {
        eliteContentStrategist: false,    // Disabled until stable
        banditLearning: false,            // Disabled until data collected
        engagementOptimization: false,    // Disabled until proven
        contentQualityPrediction: false   // Disabled until trained
      },
      advanced: {
        autonomousEngagement: false,      // Disabled for safety
        predictivePosting: false,         // Disabled until proven
        dynamicScheduling: false,         // Disabled until stable
        competitiveIntelligence: false    // Disabled for now
      },
      debug: {
        verboseLogging: process.env.NODE_ENV === 'development',
        simulationMode: false,
        dryRunMode: false
      }
    };
  }
  
  private loadFromEnvironment(): void {
    // AI Features
    if (process.env.ENABLE_ELITE_STRATEGIST === 'true') {
      this.flags.ai.eliteContentStrategist = true;
      console.log('🎯 Elite Content Strategist ENABLED via environment');
    }
    
    if (process.env.ENABLE_BANDIT_LEARNING === 'true') {
      this.flags.ai.banditLearning = true;
      console.log('🎰 Bandit Learning ENABLED via environment');
    }
    
    if (process.env.ENABLE_ENGAGEMENT_OPT === 'true') {
      this.flags.ai.engagementOptimization = true;
      console.log('📈 Engagement Optimization ENABLED via environment');
    }
    
    // Advanced Features
    if (process.env.ENABLE_AUTO_ENGAGEMENT === 'true') {
      this.flags.advanced.autonomousEngagement = true;
      console.log('🤝 Autonomous Engagement ENABLED via environment');
    }
    
    // Debug Features
    if (process.env.VERBOSE_LOGGING === 'true') {
      this.flags.debug.verboseLogging = true;
    }
    
    if (process.env.DRY_RUN === 'true') {
      this.flags.debug.dryRunMode = true;
      console.log('🧪 DRY RUN MODE enabled - no actual posting');
    }
  }
  
  // Getters for each feature flag
  isEnabled(category: keyof FeatureFlags, feature: string): boolean {
    const categoryFlags = this.flags[category] as Record<string, boolean>;
    return categoryFlags[feature] ?? false;
  }
  
  // Convenience methods for common checks
  canUseEliteStrategist(): boolean {
    return this.isEnabled('ai', 'eliteContentStrategist');
  }
  
  canUseBanditLearning(): boolean {
    return this.isEnabled('ai', 'banditLearning');
  }
  
  canOptimizeEngagement(): boolean {
    return this.isEnabled('ai', 'engagementOptimization');
  }
  
  canUseAutonomousEngagement(): boolean {
    return this.isEnabled('advanced', 'autonomousEngagement');
  }
  
  isVerboseLogging(): boolean {
    return this.isEnabled('debug', 'verboseLogging');
  }
  
  isDryRun(): boolean {
    return this.isEnabled('debug', 'dryRunMode');
  }
  
  // Get all flags (for dashboard/monitoring)
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }
  
  // Enable/disable features dynamically (for testing)
  setFlag(category: keyof FeatureFlags, feature: string, enabled: boolean): void {
    const categoryFlags = this.flags[category] as Record<string, boolean>;
    if (categoryFlags.hasOwnProperty(feature)) {
      categoryFlags[feature] = enabled;
      console.log(`🎛️ Feature ${category}.${feature} ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
  }
  
  // Gradual rollout helper
  enableFeatureGradually(category: keyof FeatureFlags, feature: string, rolloutPercentage: number = 10): boolean {
    const random = Math.random() * 100;
    const shouldEnable = random < rolloutPercentage;
    
    if (shouldEnable) {
      this.setFlag(category, feature, true);
      console.log(`🎲 Gradual rollout: ${category}.${feature} enabled for this instance (${rolloutPercentage}% chance)`);
    }
    
    return shouldEnable;
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance();

// Export convenience functions
export const isFeatureEnabled = (category: keyof FeatureFlags, feature: string): boolean => {
  return featureFlags.isEnabled(category, feature);
};

export const canUseEliteStrategist = (): boolean => featureFlags.canUseEliteStrategist();
export const canUseBanditLearning = (): boolean => featureFlags.canUseBanditLearning();
export const canOptimizeEngagement = (): boolean => featureFlags.canOptimizeEngagement();
export const isVerboseLogging = (): boolean => featureFlags.isVerboseLogging();
export const isDryRun = (): boolean => featureFlags.isDryRun();