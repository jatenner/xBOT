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
    // Handle phased rollout first
    this.loadPhaseBasedFlags();
    
    // AI Features (can override phase defaults)
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
  
  private loadPhaseBasedFlags(): void {
    const phase = process.env.BOT_PHASE || 'data_collection';
    console.log(`🎯 Bot Phase: ${phase}`);
    
    switch (phase) {
      case 'data_collection':
        // Phase 1: Template-only, data collection
        console.log('📊 Phase 1: Data Collection Mode - Templates only');
        break;
        
      case 'ai_trial':
        // Phase 2: Enable AI strategist at 40% usage
        this.flags.ai.eliteContentStrategist = true;
        console.log('🧠 Phase 2: AI Trial Mode - 40% AI content generation');
        break;
        
      case 'learning_loop':
        // Phase 3: Enable bandit learning + higher AI usage
        this.flags.ai.eliteContentStrategist = true;
        this.flags.ai.banditLearning = true;
        console.log('🎓 Phase 3: Learning Loop - AI optimization active');
        break;
        
      case 'growth_mode':
        // Phase 4: Full engagement optimization
        this.flags.ai.eliteContentStrategist = true;
        this.flags.ai.banditLearning = true;
        this.flags.ai.engagementOptimization = true;
        this.flags.advanced.autonomousEngagement = true;
        console.log('🚀 Phase 4: Growth Mode - Full AI engagement system');
        break;
        
      default:
        console.log('⚠️ Unknown phase, defaulting to data collection mode');
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
  
  // Phase management
  getCurrentPhase(): { phase: string; description: string; aiUsage: number } {
    const phase = process.env.BOT_PHASE || 'data_collection';
    const phases = {
      data_collection: { description: 'Data Collection - Template-only posting for baseline metrics', aiUsage: 0 },
      ai_trial: { description: 'AI Content Trial - 40% AI generation vs templates', aiUsage: 0.4 },
      learning_loop: { description: 'Learning Loop - 60% AI with bandit optimization', aiUsage: 0.6 },
      growth_mode: { description: 'Growth Mode - 80% AI with full engagement automation', aiUsage: 0.8 }
    };
    
    return {
      phase,
      description: phases[phase]?.description || 'Unknown phase',
      aiUsage: phases[phase]?.aiUsage || 0
    };
  }
  
  getStrategistUsageRate(): number {
    const customRate = parseFloat(process.env.STRATEGIST_USAGE_RATE || '0');
    if (customRate > 0) return Math.min(customRate, 1.0);
    
    const phase = this.getCurrentPhase();
    return phase.aiUsage;
  }
  
  getMaxDailyPosts(): number {
    const base = parseInt(process.env.MAX_DAILY_POSTS || '6');
    const phase = process.env.BOT_PHASE || 'data_collection';
    
    const limits = {
      data_collection: 6,
      ai_trial: 8,
      learning_loop: 10,
      growth_mode: 12
    };
    
    return Math.min(base, limits[phase] || 6);
  }
  
  getFactCheckThreshold(): number {
    const threshold = parseFloat(process.env.FACT_CHECK_THRESHOLD || '0.7');
    return Math.max(0.5, Math.min(1.0, threshold));
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

// Phase management exports
export const getCurrentPhase = () => featureFlags.getCurrentPhase();
export const getStrategistUsageRate = () => featureFlags.getStrategistUsageRate();
export const getMaxDailyPosts = () => featureFlags.getMaxDailyPosts();
export const getFactCheckThreshold = () => featureFlags.getFactCheckThreshold();