/**
 * Multi-Armed Bandit Optimizer
 * Optimizes hook patterns, posting times, and content templates based on performance
 * Uses epsilon-greedy strategy with confidence intervals
 */

interface BanditArm {
  id: string;
  category: 'hook_pattern' | 'posting_time' | 'template_type' | 'content_style';
  name: string;
  description: string;
  attempts: number;
  successes: number;
  totalReward: number;
  lastUsed: number;
  confidence: number; // Upper confidence bound
}

interface BanditReward {
  engagement: number; // likes + replies + retweets
  qualityScore: number;
  viral: boolean; // Did it get >100 likes?
  timeToFirst10Likes: number; // Speed of initial engagement
}

interface BanditSelection {
  arm: BanditArm;
  strategy: 'exploit' | 'explore';
  confidence: number;
  alternatives: Array<{ arm: BanditArm; score: number }>;
}

export class BanditOptimizer {
  private arms: Map<string, BanditArm> = new Map();
  private epsilon = parseFloat(process.env.BANDIT_EPSILON || '0.15'); // 15% exploration
  private confidenceLevel = 1.96; // 95% confidence interval
  private decayFactor = 0.95; // Older rewards count less

  constructor() {
    this.initializeDefaultArms();
  }

  private initializeDefaultArms() {
    const defaultArms: Omit<BanditArm, 'attempts' | 'successes' | 'totalReward' | 'lastUsed' | 'confidence'>[] = [
      // Hook Patterns
      {
        id: 'hook_counter_intuitive',
        category: 'hook_pattern',
        name: 'Counter-intuitive',
        description: 'The #1 {topic} advice is backwards'
      },
      {
        id: 'hook_personal_result',
        category: 'hook_pattern',
        name: 'Personal Result',
        description: 'I fixed my {topic} in {timeframe}'
      },
      {
        id: 'hook_myth_busting',
        category: 'hook_pattern',
        name: 'Myth Busting',
        description: 'Myth: {common belief}. Reality: {truth}'
      },
      {
        id: 'hook_framework',
        category: 'hook_pattern',
        name: 'Framework',
        description: 'Simple 3-step framework for {topic}'
      },
      {
        id: 'hook_checklist',
        category: 'hook_pattern',
        name: 'Checklist',
        description: '80/20 {topic} checklist'
      },
      {
        id: 'hook_question',
        category: 'hook_pattern',
        name: 'Question',
        description: 'What if {surprising insight about topic}?'
      },

      // Posting Times
      {
        id: 'time_morning_peak',
        category: 'posting_time',
        name: 'Morning Peak',
        description: '8-10 AM EST (high engagement window)'
      },
      {
        id: 'time_lunch_break',
        category: 'posting_time',
        name: 'Lunch Break',
        description: '12-2 PM EST (scroll time)'
      },
      {
        id: 'time_evening_wind_down',
        category: 'posting_time',
        name: 'Evening Wind-down',
        description: '6-8 PM EST (reflect & learn time)'
      },
      {
        id: 'time_weekend_morning',
        category: 'posting_time',
        name: 'Weekend Morning',
        description: 'Saturday/Sunday 9-11 AM (leisure learning)'
      },

      // Template Types
      {
        id: 'template_story_based',
        category: 'template_type',
        name: 'Story-based',
        description: 'Personal narrative with lessons'
      },
      {
        id: 'template_data_driven',
        category: 'template_type',
        name: 'Data-driven',
        description: 'Research-backed insights with numbers'
      },
      {
        id: 'template_actionable',
        category: 'template_type',
        name: 'Actionable',
        description: 'Step-by-step instructions'
      },
      {
        id: 'template_contrarian',
        category: 'template_type',
        name: 'Contrarian',
        description: 'Challenge conventional wisdom'
      },

      // Content Styles
      {
        id: 'style_conversational',
        category: 'content_style',
        name: 'Conversational',
        description: 'Casual, friendly tone with questions'
      },
      {
        id: 'style_authoritative',
        category: 'content_style',
        name: 'Authoritative',
        description: 'Expert tone with definitive statements'
      },
      {
        id: 'style_vulnerable',
        category: 'content_style',
        name: 'Vulnerable',
        description: 'Share struggles and failures'
      },
      {
        id: 'style_enthusiastic',
        category: 'content_style',
        name: 'Enthusiastic',
        description: 'High energy, excited about topic'
      }
    ];

    defaultArms.forEach(armData => {
      const arm: BanditArm = {
        ...armData,
        attempts: 1, // Start with 1 to avoid division by zero
        successes: 1,
        totalReward: 50, // Neutral starting reward
        lastUsed: 0,
        confidence: 0
      };
      this.arms.set(arm.id, arm);
    });

    this.updateConfidenceBounds();
  }

  /**
   * Select the best arm using epsilon-greedy with confidence bounds
   */
  selectArm(category: BanditArm['category'], context?: {
    timeOfDay?: number; // 0-23
    dayOfWeek?: number; // 0-6
    recentPerformance?: 'high' | 'medium' | 'low';
    topic?: string;
  }): BanditSelection {
    const availableArms = Array.from(this.arms.values())
      .filter(arm => arm.category === category)
      .filter(arm => this.isArmAvailable(arm, context));

    if (availableArms.length === 0) {
      throw new Error(`No available arms for category: ${category}`);
    }

    // Update confidence bounds
    this.updateConfidenceBounds();

    // Epsilon-greedy selection
    const shouldExplore = Math.random() < this.epsilon;
    
    let selectedArm: BanditArm;
    let strategy: 'exploit' | 'explore';

    if (shouldExplore) {
      // Exploration: select randomly among less-tried arms
      const underExploredArms = availableArms
        .filter(arm => arm.attempts < Math.max(3, availableArms.length / 2))
        .sort((a, b) => a.attempts - b.attempts);
      
      selectedArm = underExploredArms.length > 0 
        ? underExploredArms[Math.floor(Math.random() * underExploredArms.length)]
        : availableArms[Math.floor(Math.random() * availableArms.length)];
      
      strategy = 'explore';
    } else {
      // Exploitation: select arm with highest confidence bound
      const sortedArms = availableArms.sort((a, b) => b.confidence - a.confidence);
      selectedArm = sortedArms[0];
      strategy = 'exploit';
    }

    // Create alternatives list
    const alternatives = availableArms
      .filter(arm => arm.id !== selectedArm.id)
      .map(arm => ({ arm, score: arm.confidence }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      arm: selectedArm,
      strategy,
      confidence: selectedArm.confidence,
      alternatives
    };
  }

  /**
   * Record reward for an arm based on performance
   */
  recordReward(armId: string, reward: BanditReward) {
    const arm = this.arms.get(armId);
    if (!arm) {
      console.warn(`BANDIT: Arm ${armId} not found`);
      return;
    }

    // Calculate composite reward (0-100)
    const normalizedEngagement = Math.min(100, reward.engagement / 2); // Cap at 200 engagement = 100 points
    const qualityBonus = reward.qualityScore - 80; // Bonus/penalty from 80 baseline
    const viralBonus = reward.viral ? 20 : 0;
    const speedBonus = reward.timeToFirst10Likes < 3600 ? 10 : 0; // Bonus for quick engagement

    const compositeReward = Math.max(0, Math.min(100, 
      normalizedEngagement + qualityBonus + viralBonus + speedBonus
    ));

    // Update arm statistics with decay for older rewards
    const decayedTotal = arm.totalReward * this.decayFactor;
    const decayedAttempts = arm.attempts * this.decayFactor;

    arm.attempts = decayedAttempts + 1;
    arm.totalReward = decayedTotal + compositeReward;
    arm.lastUsed = Date.now();

    // Count as success if reward > threshold
    if (compositeReward > 60) {
      arm.successes = (arm.successes * this.decayFactor) + 1;
    } else {
      arm.successes = arm.successes * this.decayFactor;
    }

    console.log(`BANDIT: ${arm.name} reward=${compositeReward.toFixed(1)} (eng:${reward.engagement}, qual:${reward.qualityScore}, viral:${reward.viral})`);
  }

  /**
   * Check if an arm is available based on context
   */
  private isArmAvailable(arm: BanditArm, context?: {
    timeOfDay?: number;
    dayOfWeek?: number;
    recentPerformance?: 'high' | 'medium' | 'low';
    topic?: string;
  }): boolean {
    // Time-based filtering for posting times
    if (arm.category === 'posting_time' && context?.timeOfDay !== undefined) {
      const hour = context.timeOfDay;
      
      if (arm.id === 'time_morning_peak' && (hour < 8 || hour > 10)) return false;
      if (arm.id === 'time_lunch_break' && (hour < 12 || hour > 14)) return false;
      if (arm.id === 'time_evening_wind_down' && (hour < 18 || hour > 20)) return false;
      if (arm.id === 'time_weekend_morning' && context.dayOfWeek !== undefined) {
        const isWeekend = context.dayOfWeek === 0 || context.dayOfWeek === 6;
        if (!isWeekend || hour < 9 || hour > 11) return false;
      }
    }

    // Performance-based filtering
    if (context?.recentPerformance === 'low') {
      // When performance is low, avoid risky/experimental strategies
      if (arm.id.includes('contrarian') || arm.id.includes('vulnerable')) return false;
    }

    // Cooldown: don't use the same arm too frequently
    const timeSinceLastUse = Date.now() - arm.lastUsed;
    const minCooldown = arm.category === 'hook_pattern' ? 2 * 60 * 60 * 1000 : 30 * 60 * 1000; // 2h for hooks, 30m for others
    
    if (timeSinceLastUse < minCooldown) return false;

    return true;
  }

  /**
   * Update confidence bounds for all arms (Upper Confidence Bound)
   */
  private updateConfidenceBounds() {
    const totalAttempts = Array.from(this.arms.values())
      .reduce((sum, arm) => sum + arm.attempts, 0);

    this.arms.forEach(arm => {
      if (arm.attempts === 0) {
        arm.confidence = 100; // Untried arms get max confidence
        return;
      }

      const meanReward = arm.totalReward / arm.attempts;
      const confidenceWidth = this.confidenceLevel * Math.sqrt(
        Math.log(totalAttempts) / arm.attempts
      );
      
      arm.confidence = meanReward + confidenceWidth;
    });
  }

  /**
   * Get performance analytics for all arms
   */
  getAnalytics(): {
    topPerformers: Array<{ arm: BanditArm; avgReward: number; successRate: number }>;
    underPerformers: Array<{ arm: BanditArm; avgReward: number; successRate: number }>;
    needsExploration: Array<{ arm: BanditArm; attempts: number }>;
    recommendations: string[];
  } {
    const armStats = Array.from(this.arms.values()).map(arm => ({
      arm,
      avgReward: arm.attempts > 0 ? arm.totalReward / arm.attempts : 0,
      successRate: arm.attempts > 0 ? arm.successes / arm.attempts : 0
    }));

    const topPerformers = armStats
      .filter(stat => stat.arm.attempts >= 3)
      .sort((a, b) => b.avgReward - a.avgReward)
      .slice(0, 5);

    const underPerformers = armStats
      .filter(stat => stat.arm.attempts >= 3 && stat.avgReward < 40)
      .sort((a, b) => a.avgReward - b.avgReward)
      .slice(0, 3);

    const needsExploration = armStats
      .filter(stat => stat.arm.attempts < 3)
      .sort((a, b) => a.attempts - b.attempts);

    const recommendations: string[] = [];
    
    if (topPerformers.length > 0) {
      recommendations.push(`Double down on ${topPerformers[0].arm.name} (${topPerformers[0].avgReward.toFixed(1)} avg reward)`);
    }
    
    if (needsExploration.length > 0) {
      recommendations.push(`Explore ${needsExploration[0].arm.name} more (only ${needsExploration[0].attempts} attempts)`);
    }
    
    if (underPerformers.length > 0) {
      recommendations.push(`Consider retiring ${underPerformers[0].arm.name} (${underPerformers[0].avgReward.toFixed(1)} avg reward)`);
    }

    return {
      topPerformers,
      underPerformers,
      needsExploration,
      recommendations
    };
  }

  /**
   * Get recommendations for specific context
   */
  getContextualRecommendations(context: {
    timeOfDay?: number;
    dayOfWeek?: number;
    topic?: string;
    goal?: 'engagement' | 'education' | 'viral';
  }): {
    hookPattern: BanditSelection;
    contentStyle: BanditSelection;
    template: BanditSelection;
    reasoning: string[];
  } {
    const hookPattern = this.selectArm('hook_pattern', context);
    const contentStyle = this.selectArm('content_style', context);
    const template = this.selectArm('template_type', context);

    const reasoning: string[] = [];
    
    if (hookPattern.strategy === 'explore') {
      reasoning.push(`Exploring ${hookPattern.arm.name} hook (${hookPattern.arm.attempts} attempts so far)`);
    } else {
      reasoning.push(`Using proven ${hookPattern.arm.name} hook (${hookPattern.confidence.toFixed(1)} confidence)`);
    }

    if (context.goal === 'viral' && template.arm.name === 'Contrarian') {
      reasoning.push('Contrarian content has higher viral potential');
    }

    if (context.timeOfDay && context.timeOfDay >= 18) {
      reasoning.push('Evening posting favors educational content');
    }

    return {
      hookPattern,
      contentStyle,
      template,
      reasoning
    };
  }

  /**
   * Reset bandit (for testing or fresh start)
   */
  reset() {
    this.arms.clear();
    this.initializeDefaultArms();
  }

  /**
   * Export current arm states
   */
  exportState(): Record<string, BanditArm> {
    const state: Record<string, BanditArm> = {};
    this.arms.forEach((arm, id) => {
      state[id] = { ...arm };
    });
    return state;
  }

  /**
   * Import arm states (for persistence)
   */
  importState(state: Record<string, BanditArm>) {
    this.arms.clear();
    Object.entries(state).forEach(([id, arm]) => {
      this.arms.set(id, arm);
    });
    this.updateConfidenceBounds();
  }
}

export const banditOptimizer = new BanditOptimizer();
