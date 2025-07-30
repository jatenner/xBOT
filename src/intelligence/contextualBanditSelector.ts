/**
 * 🎯 CONTEXTUAL BANDIT SELECTOR
 * 
 * Advanced reinforcement learning algorithm that selects optimal content formats
 * based on contextual features like time of day, recent performance, and audience state.
 * Uses Thompson Sampling with contextual features for intelligent decision-making.
 */

import { supabaseClient } from '../utils/supabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';

interface ContextualFeatures {
  hour: number;
  dayOfWeek: number;
  recentEngagementTrend: 'up' | 'down' | 'stable';
  lastPostPerformance: 'high' | 'medium' | 'low';
  timeSinceLastPost: number; // hours
  followersGrowthRate: number;
  weekdayVsWeekend: 'weekday' | 'weekend';
  engagementMomentum: number; // 0-1 score
}

interface BanditArm {
  armId: string;
  contentFormat: string;
  description: string;
  successCount: number;
  totalCount: number;
  contextualWeights: { [feature: string]: number };
  lastUpdated: Date;
  confidence: number;
  averageReward: number;
}

interface SelectionResult {
  success: boolean;
  selectedArm?: BanditArm;
  format?: string;
  confidence?: number;
  reasoning?: string;
  contextFeatures?: ContextualFeatures;
  alternativeFormats?: string[];
  error?: string;
}

interface RewardFeedback {
  armId: string;
  reward: number; // 0-1 normalized reward
  context: ContextualFeatures;
  engagementMetrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions?: number;
  };
  tweetId: string;
}

export class ContextualBanditSelector {
  private static readonly CONTENT_FORMATS = [
    {
      armId: 'hook_value_cta',
      contentFormat: 'Hook + Value + CTA',
      description: 'Strong attention hook, valuable insight, clear call-to-action'
    },
    {
      armId: 'fact_authority_question',
      contentFormat: 'Fact + Authority + Question',
      description: 'Scientific fact with credible source, engaging question'
    },
    {
      armId: 'story_lesson_application',
      contentFormat: 'Story + Lesson + Application',
      description: 'Personal narrative with actionable takeaway'
    },
    {
      armId: 'controversy_evidence_stance',
      contentFormat: 'Controversy + Evidence + Stance',
      description: 'Challenging popular belief with evidence-based position'
    },
    {
      armId: 'tip_mechanism_benefit',
      contentFormat: 'Tip + Mechanism + Benefit',
      description: 'Actionable advice with scientific explanation and clear benefit'
    },
    {
      armId: 'thread_deep_dive',
      contentFormat: 'Thread Deep Dive',
      description: 'Multi-tweet thread exploring topic comprehensively'
    },
    {
      armId: 'quick_win_hack',
      contentFormat: 'Quick Win Hack',
      description: 'Simple, immediately actionable health optimization'
    },
    {
      armId: 'myth_bust_reveal',
      contentFormat: 'Myth Bust Reveal',
      description: 'Debunking common health misconception with evidence'
    }
  ];

  private static readonly EXPLORATION_RATE = 0.1; // 10% exploration vs exploitation
  private static readonly MIN_SAMPLES_FOR_CONFIDENCE = 5;
  private static readonly CONTEXT_WEIGHT_DECAY = 0.95; // Learning rate for context adaptation

  /**
   * 🎯 SELECT OPTIMAL CONTENT FORMAT
   */
  static async selectOptimalFormat(overrideContext?: Partial<ContextualFeatures>): Promise<SelectionResult> {
    try {
      console.log('🎯 === CONTEXTUAL BANDIT FORMAT SELECTION ===');
      
      // Get current contextual features
      const context = await this.extractContextualFeatures(overrideContext);
      console.log('📊 Context features:', {
        hour: context.hour,
        dayOfWeek: context.dayOfWeek,
        trend: context.recentEngagementTrend,
        lastPerf: context.lastPostPerformance,
        momentum: context.engagementMomentum.toFixed(2)
      });

      // Get current bandit arm states
      const arms = await this.loadBanditArms();
      
      if (!arms.success || !arms.arms) {
        return {
          success: false,
          error: 'Failed to load bandit arms: ' + arms.error
        };
      }

      // Decide between exploration and exploitation
      const shouldExplore = Math.random() < this.EXPLORATION_RATE;
      
      let selectedArm: BanditArm;
      let reasoning: string;
      
      if (shouldExplore) {
        // Exploration: select arm with highest uncertainty
        selectedArm = this.selectExplorationArm(arms.arms, context);
        reasoning = `Exploration mode: testing ${selectedArm.contentFormat} for learning`;
        console.log('🔍 EXPLORATION MODE: Testing format with high uncertainty');
      } else {
        // Exploitation: select arm with highest expected reward
        selectedArm = this.selectExploitationArm(arms.arms, context);
        reasoning = `Exploitation mode: using ${selectedArm.contentFormat} (${(selectedArm.confidence * 100).toFixed(1)}% confidence)`;
        console.log('⚡ EXPLOITATION MODE: Using best-performing format');
      }

      // Generate alternative formats for fallback
      const alternatives = arms.arms
        .filter(arm => arm.armId !== selectedArm.armId)
        .sort((a, b) => this.calculateContextualScore(b, context) - this.calculateContextualScore(a, context))
        .slice(0, 3)
        .map(arm => arm.contentFormat);

      console.log(`🎯 Selected: ${selectedArm.contentFormat}`);
      console.log(`🧠 Reasoning: ${reasoning}`);
      console.log(`📈 Confidence: ${(selectedArm.confidence * 100).toFixed(1)}%`);
      
      return {
        success: true,
        selectedArm,
        format: selectedArm.contentFormat,
        confidence: selectedArm.confidence,
        reasoning,
        contextFeatures: context,
        alternativeFormats: alternatives
      };

    } catch (error) {
      console.error('❌ Contextual bandit selection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Selection failed'
      };
    }
  }

  /**
   * 📊 EXTRACT CONTEXTUAL FEATURES
   */
  private static async extractContextualFeatures(override?: Partial<ContextualFeatures>): Promise<ContextualFeatures> {
    const now = new Date();
    const hour = override?.hour ?? now.getHours();
    const dayOfWeek = override?.dayOfWeek ?? now.getDay();
    const weekdayVsWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'weekday';

    try {
      // Get recent post performance data
      const { data: recentPosts, error } = await supabaseClient
        .from('learning_posts')
        .select('*')
        .eq('was_posted', true)
        .not('tweet_id', 'is', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !recentPosts || recentPosts.length === 0) {
        // Return default context if no data
        return {
          hour,
          dayOfWeek,
          recentEngagementTrend: 'stable',
          lastPostPerformance: 'medium',
          timeSinceLastPost: override?.timeSinceLastPost ?? 4,
          followersGrowthRate: 0.02,
          weekdayVsWeekend,
          engagementMomentum: 0.5,
          ...override
        };
      }

      // Calculate engagement trend
      const recentEngagementTrend = this.calculateEngagementTrend(recentPosts);
      
      // Determine last post performance
      const lastPost = recentPosts[0];
      const lastPostEngagement = (lastPost.likes_count || 0) + (lastPost.retweets_count || 0) * 2 + (lastPost.replies_count || 0) * 3;
      const avgEngagement = recentPosts.reduce((sum, post) => 
        sum + (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3, 0
      ) / recentPosts.length;
      
      const lastPostPerformance = lastPostEngagement > avgEngagement * 1.2 ? 'high' :
                                 lastPostEngagement < avgEngagement * 0.8 ? 'low' : 'medium';

      // Calculate time since last post
      const timeSinceLastPost = (Date.now() - new Date(lastPost.created_at).getTime()) / (1000 * 60 * 60);
      
      // Calculate engagement momentum (recent performance vs historical)
      const engagementMomentum = Math.min(1, Math.max(0, (lastPostEngagement / Math.max(1, avgEngagement))));
      
      // Estimate followers growth rate (simplified)
      const followersGrowthRate = 0.02; // Default 2% daily growth estimate

      return {
        hour,
        dayOfWeek,
        recentEngagementTrend,
        lastPostPerformance,
        timeSinceLastPost,
        followersGrowthRate,
        weekdayVsWeekend,
        engagementMomentum,
        ...override
      };

    } catch (error) {
      console.error('⚠️ Error extracting context features:', error);
      return {
        hour,
        dayOfWeek,
        recentEngagementTrend: 'stable',
        lastPostPerformance: 'medium',
        timeSinceLastPost: 4,
        followersGrowthRate: 0.02,
        weekdayVsWeekend,
        engagementMomentum: 0.5,
        ...override
      };
    }
  }

  /**
   * 📈 CALCULATE ENGAGEMENT TREND
   */
  private static calculateEngagementTrend(posts: any[]): 'up' | 'down' | 'stable' {
    if (posts.length < 3) return 'stable';
    
    const recent = posts.slice(0, Math.ceil(posts.length / 2));
    const older = posts.slice(Math.ceil(posts.length / 2));
    
    const recentAvg = recent.reduce((sum, post) => 
      sum + (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3, 0
    ) / recent.length;
    
    const olderAvg = older.reduce((sum, post) => 
      sum + (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3, 0
    ) / older.length;
    
    const changeRatio = recentAvg / Math.max(1, olderAvg);
    
    if (changeRatio > 1.15) return 'up';
    if (changeRatio < 0.85) return 'down';
    return 'stable';
  }

  /**
   * 🏋️ LOAD BANDIT ARMS
   */
  private static async loadBanditArms(): Promise<{
    success: boolean;
    arms?: BanditArm[];
    error?: string;
  }> {
    try {
      const { data: existingArms, error } = await supabaseClient
        .from('contextual_bandit_arms')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('Database error loading bandit arms:', error);
        return { success: false, error: error.message };
      }

      // Initialize arms if none exist
      if (!existingArms || existingArms.length === 0) {
        console.log('🚀 Initializing bandit arms...');
        const initializedArms = await this.initializeBanditArms();
        if (!initializedArms.success) {
          return { success: false, error: initializedArms.error };
        }
        return { success: true, arms: initializedArms.arms };
      }

      // Convert database format to BanditArm objects
      const arms: BanditArm[] = existingArms.map(arm => ({
        armId: arm.arm_id,
        contentFormat: arm.content_format,
        description: arm.description,
        successCount: arm.success_count || 0,
        totalCount: arm.total_count || 0,
        contextualWeights: arm.contextual_weights || {},
        lastUpdated: new Date(arm.last_updated),
        confidence: this.calculateConfidence(arm.success_count || 0, arm.total_count || 0),
        averageReward: (arm.total_count || 0) > 0 ? (arm.success_count || 0) / (arm.total_count || 0) : 0
      }));

      return { success: true, arms };

    } catch (error) {
      console.error('❌ Failed to load bandit arms:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Load failed'
      };
    }
  }

  /**
   * 🚀 INITIALIZE BANDIT ARMS
   */
  private static async initializeBanditArms(): Promise<{
    success: boolean;
    arms?: BanditArm[];
    error?: string;
  }> {
    try {
      const armsToInsert = this.CONTENT_FORMATS.map(format => ({
        arm_id: format.armId,
        content_format: format.contentFormat,
        description: format.description,
        success_count: 1, // Optimistic initialization
        total_count: 2,
        contextual_weights: {},
        last_updated: new Date().toISOString()
      }));

      const { data, error } = await supabaseClient
        .from('contextual_bandit_arms')
        .insert(armsToInsert)
        .select();

      if (error) {
        console.error('Database error initializing arms:', error);
        return { success: false, error: error.message };
      }

      const arms: BanditArm[] = this.CONTENT_FORMATS.map(format => ({
        armId: format.armId,
        contentFormat: format.contentFormat,
        description: format.description,
        successCount: 1,
        totalCount: 2,
        contextualWeights: {},
        lastUpdated: new Date(),
        confidence: 0.5,
        averageReward: 0.5
      }));

      console.log(`✅ Initialized ${arms.length} bandit arms`);
      return { success: true, arms };

    } catch (error) {
      console.error('❌ Failed to initialize bandit arms:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      };
    }
  }

  /**
   * 🔍 SELECT EXPLORATION ARM
   */
  private static selectExplorationArm(arms: BanditArm[], context: ContextualFeatures): BanditArm {
    // Select arm with highest uncertainty (lowest confidence)
    const uncertaintyScores = arms.map(arm => {
      const uncertainty = 1 - arm.confidence;
      const contextualBonus = this.calculateContextualBonus(arm, context);
      return { arm, score: uncertainty + contextualBonus * 0.3 };
    });

    uncertaintyScores.sort((a, b) => b.score - a.score);
    return uncertaintyScores[0].arm;
  }

  /**
   * ⚡ SELECT EXPLOITATION ARM
   */
  private static selectExploitationArm(arms: BanditArm[], context: ContextualFeatures): BanditArm {
    // Select arm with highest expected reward given context
    const exploitationScores = arms.map(arm => {
      const baseScore = arm.averageReward * arm.confidence;
      const contextualScore = this.calculateContextualScore(arm, context);
      return { arm, score: baseScore * 0.7 + contextualScore * 0.3 };
    });

    exploitationScores.sort((a, b) => b.score - a.score);
    return exploitationScores[0].arm;
  }

  /**
   * 🎯 CALCULATE CONTEXTUAL SCORE
   */
  private static calculateContextualScore(arm: BanditArm, context: ContextualFeatures): number {
    let score = arm.averageReward;
    
    // Apply contextual weights if available
    const weights = arm.contextualWeights;
    
    if (weights[`hour_${context.hour}`]) {
      score *= (1 + weights[`hour_${context.hour}`] * 0.2);
    }
    
    if (weights[`day_${context.dayOfWeek}`]) {
      score *= (1 + weights[`day_${context.dayOfWeek}`] * 0.2);
    }
    
    if (weights[`trend_${context.recentEngagementTrend}`]) {
      score *= (1 + weights[`trend_${context.recentEngagementTrend}`] * 0.3);
    }
    
    if (weights[`performance_${context.lastPostPerformance}`]) {
      score *= (1 + weights[`performance_${context.lastPostPerformance}`] * 0.25);
    }
    
    if (weights[context.weekdayVsWeekend]) {
      score *= (1 + weights[context.weekdayVsWeekend] * 0.15);
    }
    
    // Momentum bonus
    score *= (0.8 + context.engagementMomentum * 0.4);
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 🎁 CALCULATE CONTEXTUAL BONUS
   */
  private static calculateContextualBonus(arm: BanditArm, context: ContextualFeatures): number {
    // Bonus for arms that haven't been tested much in this context
    const contextKey = `${context.hour}_${context.dayOfWeek}_${context.recentEngagementTrend}`;
    const contextualExperience = arm.contextualWeights[contextKey] || 0;
    
    // Higher bonus for less experienced contexts
    return Math.max(0, 0.5 - contextualExperience);
  }

  /**
   * 📊 CALCULATE CONFIDENCE
   */
  private static calculateConfidence(successCount: number, totalCount: number): number {
    if (totalCount === 0) return 0;
    if (totalCount < this.MIN_SAMPLES_FOR_CONFIDENCE) {
      return Math.min(0.6, totalCount / this.MIN_SAMPLES_FOR_CONFIDENCE * 0.6);
    }
    
    // Use Wilson score interval for confidence
    const p = successCount / totalCount;
    const n = totalCount;
    const z = 1.96; // 95% confidence
    
    const denominator = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const variance = (p * (1 - p) + (z * z) / (4 * n)) / n;
    
    return Math.max(0, Math.min(1, (centre - z * Math.sqrt(variance)) / denominator));
  }

  /**
   * 📈 UPDATE ARM WITH REWARD
   */
  static async updateWithReward(feedback: RewardFeedback): Promise<{
    success: boolean;
    updatedArm?: BanditArm;
    error?: string;
  }> {
    try {
      console.log(`🎯 Updating arm ${feedback.armId} with reward ${feedback.reward.toFixed(3)}`);
      
      // Load current arm state
      const { data: currentArm, error: fetchError } = await supabaseClient
        .from('contextual_bandit_arms')
        .select('*')
        .eq('arm_id', feedback.armId)
        .single();

      if (fetchError || !currentArm) {
        return { success: false, error: 'Failed to load arm for update' };
      }

      // Update success/total counts
      const newSuccessCount = (currentArm.success_count || 0) + feedback.reward;
      const newTotalCount = (currentArm.total_count || 0) + 1;
      
      // Update contextual weights
      const updatedWeights = { ...currentArm.contextual_weights };
      const contextKeys = [
        `hour_${feedback.context.hour}`,
        `day_${feedback.context.dayOfWeek}`,
        `trend_${feedback.context.recentEngagementTrend}`,
        `performance_${feedback.context.lastPostPerformance}`,
        feedback.context.weekdayVsWeekend
      ];
      
      for (const key of contextKeys) {
        const currentWeight = updatedWeights[key] || 0;
        updatedWeights[key] = currentWeight * this.CONTEXT_WEIGHT_DECAY + feedback.reward * (1 - this.CONTEXT_WEIGHT_DECAY);
      }

      // Update database
      const { data: updatedData, error: updateError } = await supabaseClient
        .from('contextual_bandit_arms')
        .update({
          success_count: newSuccessCount,
          total_count: newTotalCount,
          contextual_weights: updatedWeights,
          last_updated: new Date().toISOString()
        })
        .eq('arm_id', feedback.armId)
        .select()
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Store reward feedback history
      await supabaseClient
        .from('contextual_bandit_history')
        .insert({
          arm_id: feedback.armId,
          reward: feedback.reward,
          context_features: feedback.context,
          engagement_metrics: feedback.engagementMetrics,
          tweet_id: feedback.tweetId,
          timestamp: new Date().toISOString()
        });

      const updatedArm: BanditArm = {
        armId: feedback.armId,
        contentFormat: updatedData.content_format,
        description: updatedData.description,
        successCount: newSuccessCount,
        totalCount: newTotalCount,
        contextualWeights: updatedWeights,
        lastUpdated: new Date(),
        confidence: this.calculateConfidence(newSuccessCount, newTotalCount),
        averageReward: newSuccessCount / newTotalCount
      };

      console.log(`✅ Updated arm ${feedback.armId}: ${(updatedArm.averageReward * 100).toFixed(1)}% success rate`);
      
      return { success: true, updatedArm };

    } catch (error) {
      console.error('❌ Failed to update arm with reward:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  /**
   * 📊 GET BANDIT STATISTICS
   */
  static async getBanditStatistics(): Promise<{
    success: boolean;
    statistics?: {
      totalSelections: number;
      topPerformingArms: Array<{ format: string; successRate: number; confidence: number }>;
      contextualInsights: Array<{ context: string; bestFormat: string; performance: number }>;
      explorationRate: number;
      learningProgress: number;
    };
    error?: string;
  }> {
    try {
      const arms = await this.loadBanditArms();
      
      if (!arms.success || !arms.arms) {
        return { success: false, error: 'Failed to load arms for statistics' };
      }

      const totalSelections = arms.arms.reduce((sum, arm) => sum + arm.totalCount, 0);
      
      const topPerformingArms = arms.arms
        .filter(arm => arm.totalCount >= 3)
        .sort((a, b) => b.averageReward - a.averageReward)
        .slice(0, 5)
        .map(arm => ({
          format: arm.contentFormat,
          successRate: arm.averageReward,
          confidence: arm.confidence
        }));

      // Calculate learning progress (how much we've reduced uncertainty)
      const avgConfidence = arms.arms.reduce((sum, arm) => sum + arm.confidence, 0) / arms.arms.length;
      const learningProgress = Math.min(1, avgConfidence / 0.8); // Target 80% confidence

      return {
        success: true,
        statistics: {
          totalSelections,
          topPerformingArms,
          contextualInsights: [], // TODO: Implement contextual insights analysis
          explorationRate: this.EXPLORATION_RATE,
          learningProgress
        }
      };

    } catch (error) {
      console.error('❌ Failed to get bandit statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Statistics failed'
      };
    }
  }

  /**
   * 🧪 TEST BANDIT SYSTEM
   */
  static async testBanditSystem(): Promise<{
    success: boolean;
    testResults: any;
    summary: string;
  }> {
    try {
      console.log('🧪 Testing contextual bandit system...');
      
      // Test selection
      const selectionResult = await this.selectOptimalFormat();
      
      // Test reward update with mock data
      if (selectionResult.success && selectionResult.selectedArm) {
        const mockReward: RewardFeedback = {
          armId: selectionResult.selectedArm.armId,
          reward: 0.7,
          context: selectionResult.contextFeatures!,
          engagementMetrics: { likes: 15, retweets: 3, replies: 2 },
          tweetId: 'test_tweet_' + Date.now()
        };
        
        const rewardResult = await this.updateWithReward(mockReward);
        
        const testResults = {
          selectionWorked: selectionResult.success,
          rewardUpdateWorked: rewardResult.success,
          selectedFormat: selectionResult.format,
          confidence: selectionResult.confidence
        };
        
        const success = selectionResult.success && rewardResult.success;
        const summary = `Contextual bandit test: ${success ? 'PASSED' : 'FAILED'}. Selected ${selectionResult.format}.`;
        
        return { success, testResults, summary };
      }
      
      return {
        success: false,
        testResults: { error: 'Selection failed' },
        summary: 'Contextual bandit test failed'
      };

    } catch (error) {
      return {
        success: false,
        testResults: { error: error instanceof Error ? error.message : 'Test failed' },
        summary: 'Contextual bandit test failed'
      };
    }
  }
}

export const contextualBanditSelector = ContextualBanditSelector;