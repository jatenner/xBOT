/**
 * 🧠 ADAPTIVE GROWTH ENGINE
 * 
 * Learns optimal posting frequency, timing, and engagement strategies
 * specifically for follower growth through continuous A/B testing
 */

import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { IntelligentLearningEngine } from './intelligentLearningEngine';
import { FollowerGrowthOptimizer } from './followerGrowthOptimizer';

export interface GrowthExperiment {
  experimentId: string;
  strategy: 'frequency' | 'timing' | 'content_type' | 'reply_strategy';
  parameters: {
    postsPerDay?: number;
    repliesPerDay?: number;
    targetAccounts?: string[];
    contentTypes?: string[];
    timingWindows?: number[];
  };
  startDate: string;
  endDate?: string;
  results: {
    followersGained: number;
    engagementRate: number;
    reachExpansion: number;
    costPerFollower: number; // in terms of time/posts
  };
  status: 'running' | 'completed' | 'paused';
  confidence: number; // 0-1, how confident we are in these results
}

export interface AdaptiveStrategy {
  optimalPostsPerDay: number;
  optimalRepliesPerDay: number;
  bestPostingHours: number[];
  topTargetAccounts: string[];
  bestContentTypes: string[];
  expectedDailyFollowerGain: number;
  confidence: number;
}

export class AdaptiveGrowthEngine {
  private static instance: AdaptiveGrowthEngine;
  private db: AdvancedDatabaseManager;
  private learningEngine: IntelligentLearningEngine;
  private followerOptimizer: FollowerGrowthOptimizer;
  private currentExperiments: Map<string, GrowthExperiment> = new Map();
  private baselineFollowers: number = 0;
  private strategyCycle: number = 0; // Which strategy we're currently testing

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
    this.learningEngine = IntelligentLearningEngine.getInstance();
    this.followerOptimizer = FollowerGrowthOptimizer.getInstance();
  }

  public static getInstance(): AdaptiveGrowthEngine {
    if (!AdaptiveGrowthEngine.instance) {
      AdaptiveGrowthEngine.instance = new AdaptiveGrowthEngine();
    }
    return AdaptiveGrowthEngine.instance;
  }

  /**
   * 🎯 MAIN INTELLIGENCE: Should we post now and how much?
   */
  public async getOptimalPostingDecision(): Promise<{
    shouldPost: boolean;
    shouldReply: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    currentStrategy: AdaptiveStrategy;
    experimentsRunning: string[];
  }> {
    console.log('🧠 ADAPTIVE_GROWTH: Analyzing optimal posting decision...');

    const currentStrategy = await this.getCurrentOptimalStrategy();
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    
    // Get today's posting activity
    const todaysPosts = await this.getTodaysPostingActivity();
    const todaysReplies = await this.getTodaysReplyActivity();
    
    // Check if we're in a high-value time window
    const isOptimalHour = currentStrategy.bestPostingHours.includes(currentHour);
    
    // Determine posting urgency based on current strategy and experiments
    let shouldPost = false;
    let shouldReply = false;
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let reason = '';

    // FOLLOWER-FIRST DECISION MAKING
    if (todaysPosts < currentStrategy.optimalPostsPerDay) {
      if (isOptimalHour) {
        shouldPost = true;
        urgency = 'high';
        reason = `Optimal posting hour (${currentStrategy.optimalPostsPerDay - todaysPosts} posts remaining today)`;
      } else if (todaysPosts < Math.floor(currentStrategy.optimalPostsPerDay * 0.5)) {
        shouldPost = true;
        urgency = 'medium';
        reason = `Behind on daily targets (${todaysPosts}/${currentStrategy.optimalPostsPerDay})`;
      }
    }

    if (todaysReplies < currentStrategy.optimalRepliesPerDay) {
      shouldReply = true;
      if (shouldPost) urgency = 'critical'; // Both posting and replying
      reason += ` + Reply deficit (${todaysReplies}/${currentStrategy.optimalRepliesPerDay})`;
    }

    // Get running experiments
    const runningExperiments = Array.from(this.currentExperiments.values())
      .filter(exp => exp.status === 'running')
      .map(exp => exp.experimentId);

    return {
      shouldPost,
      shouldReply,
      urgency,
      reason: reason.trim(),
      currentStrategy,
      experimentsRunning: runningExperiments
    };
  }

  /**
   * 🔬 Learn optimal strategy through continuous experimentation
   */
  public async getCurrentOptimalStrategy(): Promise<AdaptiveStrategy> {
    console.log('📊 ADAPTIVE_GROWTH: Calculating optimal strategy from experiments...');

    // Get historical results from completed experiments
    const completedExperiments = await this.getCompletedExperiments();
    
    if (completedExperiments.length === 0) {
      return this.getDefaultStrategy();
    }

    // Analyze what's working best for follower growth
    const frequencyAnalysis = this.analyzeFrequencyExperiments(completedExperiments);
    const timingAnalysis = this.analyzeTimingExperiments(completedExperiments);
    const contentAnalysis = this.analyzeContentExperiments(completedExperiments);
    const replyAnalysis = this.analyzeReplyExperiments(completedExperiments);

    const strategy: AdaptiveStrategy = {
      optimalPostsPerDay: frequencyAnalysis.bestFrequency,
      optimalRepliesPerDay: replyAnalysis.bestReplyCount,
      bestPostingHours: timingAnalysis.bestHours,
      topTargetAccounts: replyAnalysis.bestTargets,
      bestContentTypes: contentAnalysis.bestTypes,
      expectedDailyFollowerGain: frequencyAnalysis.expectedFollowers,
      confidence: Math.min(
        frequencyAnalysis.confidence,
        timingAnalysis.confidence,
        contentAnalysis.confidence,
        replyAnalysis.confidence
      )
    };

    console.log(`🎯 OPTIMAL_STRATEGY: ${strategy.optimalPostsPerDay} posts/day, ${strategy.optimalRepliesPerDay} replies/day`);
    console.log(`📈 Expected: +${strategy.expectedDailyFollowerGain} followers/day (${Math.round(strategy.confidence * 100)}% confidence)`);

    return strategy;
  }

  /**
   * 🧪 Start a new growth experiment
   */
  public async startGrowthExperiment(
    strategy: 'frequency' | 'timing' | 'content_type' | 'reply_strategy',
    parameters: any
  ): Promise<string> {
    const experimentId = `exp_${strategy}_${Date.now()}`;
    
    const experiment: GrowthExperiment = {
      experimentId,
      strategy,
      parameters,
      startDate: new Date().toISOString(),
      results: {
        followersGained: 0,
        engagementRate: 0,
        reachExpansion: 0,
        costPerFollower: 0
      },
      status: 'running',
      confidence: 0
    };

    this.currentExperiments.set(experimentId, experiment);
    
    // Store in database
    await this.db.executeQuery(
      'startGrowthExperiment', // operation name
      async (client) => {
        const { error } = await client
          .from('growth_experiments')
          .insert([{
            experiment_id: experimentId,
            strategy,
            parameters,
            start_date: experiment.startDate,
            status: 'running'
          }]);
        
        return { data: null, error };
      }
    );

    console.log(`🧪 EXPERIMENT_STARTED: ${experimentId} (${strategy})`);
    return experimentId;
  }

  /**
   * 📊 Record experiment results
   */
  public async recordExperimentResult(
    experimentId: string,
    followersGained: number,
    engagementData: any
  ): Promise<void> {
    const experiment = this.currentExperiments.get(experimentId);
    if (!experiment) return;

    experiment.results.followersGained += followersGained;
    experiment.results.engagementRate = engagementData.rate || 0;
    experiment.results.reachExpansion = engagementData.reach || 0;
    
    // Update in database
    await this.db.executeQuery(
      'recordExperimentResult', // operation name
      async (client) => {
        const { error } = await client
          .from('growth_experiments')
          .update({
            results: experiment.results,
            updated_at: new Date().toISOString()
          })
          .eq('experiment_id', experimentId);
        
        return { data: null, error };
      }
    );

    console.log(`📈 EXPERIMENT_UPDATE: ${experimentId} (+${followersGained} followers)`);
  }

  /**
   * 🎲 Intelligent experiment selection (A/B testing)
   */
  public async selectNextExperiment(): Promise<GrowthExperiment | null> {
    // Cycle through different strategies systematically
    const strategies = ['frequency', 'timing', 'content_type', 'reply_strategy'];
    const currentStrategy = strategies[this.strategyCycle % strategies.length];
    
    switch (currentStrategy) {
      case 'frequency':
        return await this.createFrequencyExperiment();
      case 'timing':
        return await this.createTimingExperiment();
      case 'content_type':
        return await this.createContentExperiment();
      case 'reply_strategy':
        return await this.createReplyExperiment();
      default:
        return null;
    }
  }

  /**
   * 📊 FREQUENCY EXPERIMENTS: Test 5 vs 10 vs 20 vs 50 posts per day
   */
  private async createFrequencyExperiment(): Promise<GrowthExperiment> {
    const testFrequencies = [5, 10, 15, 20, 30, 50];
    const randomFrequency = testFrequencies[Math.floor(Math.random() * testFrequencies.length)];
    
    return {
      experimentId: `freq_${randomFrequency}_${Date.now()}`,
      strategy: 'frequency',
      parameters: {
        postsPerDay: randomFrequency
      },
      startDate: new Date().toISOString(),
      results: {
        followersGained: 0,
        engagementRate: 0,
        reachExpansion: 0,
        costPerFollower: 0
      },
      status: 'running',
      confidence: 0
    };
  }

  /**
   * 📝 CONTENT EXPERIMENTS: Test different content types
   */
  private async createContentExperiment(): Promise<GrowthExperiment> {
    const contentStrategies = [
      ['threads', 'questions'],
      ['controversy', 'value_bombs'],
      ['stories', 'personal'],
      ['research', 'data'],
      ['humor', 'relatable']
    ];
    
    const randomStrategy = contentStrategies[Math.floor(Math.random() * contentStrategies.length)];
    
    return {
      experimentId: `content_${Date.now()}`,
      strategy: 'content_type',
      parameters: {
        contentTypes: randomStrategy
      },
      startDate: new Date().toISOString(),
      results: {
        followersGained: 0,
        engagementRate: 0,
        reachExpansion: 0,
        costPerFollower: 0
      },
      status: 'running',
      confidence: 0
    };
  }

  /**
   * ⏰ TIMING EXPERIMENTS: Test different posting windows
   */
  private async createTimingExperiment(): Promise<GrowthExperiment> {
    const timingStrategies = [
      [6, 12, 18], // Morning, noon, evening
      [7, 14, 21], // Slightly later
      [9, 15, 19], // Business hours focused
      [8, 11, 16, 20], // 4-times strategy
      [10, 13, 16, 19, 22] // 5-times strategy
    ];
    
    const randomStrategy = timingStrategies[Math.floor(Math.random() * timingStrategies.length)];
    
    return {
      experimentId: `timing_${Date.now()}`,
      strategy: 'timing',
      parameters: {
        timingWindows: randomStrategy
      },
      startDate: new Date().toISOString(),
      results: {
        followersGained: 0,
        engagementRate: 0,
        reachExpansion: 0,
        costPerFollower: 0
      },
      status: 'running',
      confidence: 0
    };
  }

  /**
   * 💬 REPLY EXPERIMENTS: Test different reply strategies
   */
  private async createReplyExperiment(): Promise<GrowthExperiment> {
    const replyStrategies = [
      { repliesPerDay: 10, targets: ['PeterAttiaMD', 'hubermanlab'] },
      { repliesPerDay: 25, targets: ['DrRobertLustig', 'nutrition_stripped'] },
      { repliesPerDay: 50, targets: ['tim_ferris', 'RobertGreeneMD'] },
      { repliesPerDay: 100, targets: ['trending_health_topics'] }
    ];
    
    const randomStrategy = replyStrategies[Math.floor(Math.random() * replyStrategies.length)];
    
    return {
      experimentId: `reply_${randomStrategy.repliesPerDay}_${Date.now()}`,
      strategy: 'reply_strategy',
      parameters: {
        repliesPerDay: randomStrategy.repliesPerDay,
        targetAccounts: randomStrategy.targets
      },
      startDate: new Date().toISOString(),
      results: {
        followersGained: 0,
        engagementRate: 0,
        reachExpansion: 0,
        costPerFollower: 0
      },
      status: 'running',
      confidence: 0
    };
  }

  // Analysis methods for different experiment types
  private analyzeFrequencyExperiments(experiments: GrowthExperiment[]): {
    bestFrequency: number;
    expectedFollowers: number;
    confidence: number;
  } {
    const frequencyResults = experiments
      .filter(exp => exp.strategy === 'frequency')
      .map(exp => ({
        frequency: exp.parameters.postsPerDay || 10,
        followersPerPost: exp.results.followersGained / (exp.parameters.postsPerDay || 1),
        totalFollowers: exp.results.followersGained
      }))
      .sort((a, b) => b.followersPerPost - a.followersPerPost);

    if (frequencyResults.length === 0) {
      return { bestFrequency: 12, expectedFollowers: 5, confidence: 0.3 };
    }

    const best = frequencyResults[0];
    return {
      bestFrequency: best.frequency,
      expectedFollowers: best.totalFollowers,
      confidence: Math.min(frequencyResults.length / 5, 1) // More experiments = higher confidence
    };
  }

  private analyzeTimingExperiments(experiments: GrowthExperiment[]): {
    bestHours: number[];
    confidence: number;
  } {
    // Analyze which hours perform best for follower growth
    const hourlyPerformance: { [hour: number]: number[] } = {};
    
    experiments
      .filter(exp => exp.strategy === 'timing')
      .forEach(exp => {
        const hours = exp.parameters.timingWindows || [];
        const followersPerHour = exp.results.followersGained / hours.length;
        
        hours.forEach(hour => {
          if (!hourlyPerformance[hour]) hourlyPerformance[hour] = [];
          hourlyPerformance[hour].push(followersPerHour);
        });
      });

    // Calculate average performance per hour
    const hourlyAverages = Object.entries(hourlyPerformance)
      .map(([hour, results]) => ({
        hour: parseInt(hour),
        avgFollowers: results.reduce((a, b) => a + b, 0) / results.length,
        confidence: results.length
      }))
      .sort((a, b) => b.avgFollowers - a.avgFollowers);

    if (hourlyAverages.length === 0) {
      return { bestHours: [9, 13, 17], confidence: 0.3 };
    }

    // Take top 3-5 hours
    const bestHours = hourlyAverages.slice(0, 4).map(h => h.hour);
    const confidence = Math.min(hourlyAverages.length / 10, 1);

    return { bestHours, confidence };
  }

  private analyzeContentExperiments(experiments: GrowthExperiment[]): {
    bestTypes: string[];
    confidence: number;
  } {
    // Placeholder - would analyze which content types gain most followers
    return {
      bestTypes: ['controversy', 'threads', 'questions', 'value_bombs'],
      confidence: 0.5
    };
  }

  private analyzeReplyExperiments(experiments: GrowthExperiment[]): {
    bestReplyCount: number;
    bestTargets: string[];
    confidence: number;
  } {
    const replyResults = experiments
      .filter(exp => exp.strategy === 'reply_strategy')
      .map(exp => ({
        repliesPerDay: exp.parameters.repliesPerDay || 10,
        followersGained: exp.results.followersGained,
        efficiency: exp.results.followersGained / (exp.parameters.repliesPerDay || 1)
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    if (replyResults.length === 0) {
      return { bestReplyCount: 20, bestTargets: ['hubermanlab'], confidence: 0.3 };
    }

    const best = replyResults[0];
    return {
      bestReplyCount: best.repliesPerDay,
      bestTargets: ['hubermanlab', 'PeterAttiaMD', 'tim_ferris'], // Would be learned
      confidence: Math.min(replyResults.length / 3, 1)
    };
  }

  private getDefaultStrategy(): AdaptiveStrategy {
    return {
      optimalPostsPerDay: 12,
      optimalRepliesPerDay: 25,
      bestPostingHours: [9, 13, 17, 20],
      topTargetAccounts: ['hubermanlab', 'PeterAttiaMD'],
      bestContentTypes: ['threads', 'questions', 'controversy'],
      expectedDailyFollowerGain: 5,
      confidence: 0.3
    };
  }

  // Helper methods for database operations
  private async getTodaysPostingActivity(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await this.db.executeQuery(
      'getTodaysPostingActivity', // operation name
      async (client) => {
        const { data, error } = await client
          .from('tweets')
          .select('count')
          .gte('created_at', today + 'T00:00:00Z')
          .lt('created_at', today + 'T23:59:59Z');
        
        return data || [];
      }
    );

    return (result as any)?.length || 0;
  }

  private async getTodaysReplyActivity(): Promise<number> {
    // Would track replies posted today
    return 0; // Placeholder
  }

  private async getCompletedExperiments(): Promise<GrowthExperiment[]> {
    const result = await this.db.executeQuery(
      'getCompletedExperiments', // operation name
      async (client) => {
        const { data, error } = await client
          .from('growth_experiments')
          .select('*')
          .eq('status', 'completed')
          .order('start_date', { ascending: false })
          .limit(50);
        
        return data || [];
      }
    );

    return (result as any) || [];
  }
}
