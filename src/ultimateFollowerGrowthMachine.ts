/**
 * 🚀 ULTIMATE FOLLOWER GROWTH MACHINE
 * 
 * Data-driven AI system that optimizes EVERYTHING for follower acquisition:
 * - Real-time follower tracking & A/B testing
 * - Viral content prediction & optimization 
 * - Strategic engagement for maximum conversion
 * - Predictive analytics for follower growth
 * - Automated learning from every post/reply
 */

import { FollowerGrowthOptimizer } from './intelligence/followerGrowthOptimizer';
import { getFollowerGrowthAccelerator } from './intelligence/followerGrowthAccelerator';
import { AdaptiveGrowthEngine } from './intelligence/adaptiveGrowthEngine';
import { getUnifiedLearningCoordinator } from './intelligence/unifiedLearningCoordinator';
import { admin } from './lib/supabaseClients';
import { getOpenAIService } from './services/openAIService';

interface FollowerGrowthGoals {
  currentFollowers: number;
  targetFollowers: number;
  timeframe: number; // days
  targetDailyGrowthRate: number;
  maxPostsPerDay: number;
  maxRepliesPerDay: number;
}

interface GrowthExperiment {
  id: string;
  hypothesis: string;
  strategy: 'content_type' | 'posting_frequency' | 'engagement_timing' | 'viral_hooks' | 'thread_vs_single';
  parameters: any;
  startTime: Date;
  duration: number; // hours
  expectedImpact: number; // predicted follower gain
  actualResults?: {
    followersGained: number;
    engagementRate: number;
    viralityScore: number;
  };
}

interface FollowerConversionInsights {
  topConvertingContentTypes: string[];
  bestTimesForFollowerGain: number[];
  highestConvertingTopics: string[];
  viralTriggers: string[];
  engagementToFollowerRatio: number;
  averageFollowersPerPost: number;
  conversionOptimizations: string[];
}

export class UltimateFollowerGrowthMachine {
  private static instance: UltimateFollowerGrowthMachine;
  
  private growthOptimizer = FollowerGrowthOptimizer.getInstance();
  private growthAccelerator = getFollowerGrowthAccelerator();
  private adaptiveEngine: AdaptiveGrowthEngine;
  private learningCoordinator = getUnifiedLearningCoordinator();
  private openaiService = getOpenAIService();
  
  private currentExperiments: GrowthExperiment[] = [];
  private followerBaseline: number = 0;
  private dailyGrowthTarget: number = 10;

  private constructor() {
    this.adaptiveEngine = AdaptiveGrowthEngine.getInstance();
  }

  public static getInstance(): UltimateFollowerGrowthMachine {
    if (!UltimateFollowerGrowthMachine.instance) {
      UltimateFollowerGrowthMachine.instance = new UltimateFollowerGrowthMachine();
    }
    return UltimateFollowerGrowthMachine.instance;
  }

  /**
   * 🎯 MAIN GROWTH ENGINE: Make AI-driven decisions for maximum follower growth
   */
  public async executeUltimateGrowthStrategy(): Promise<{
    contentStrategy: string;
    contentType: 'single' | 'thread';
    optimalTopic: string;
    viralHooks: string[];
    expectedFollowerGain: number;
    confidence: number;
    experiment?: GrowthExperiment;
  }> {
    console.log('🚀 ULTIMATE_GROWTH: Executing data-driven follower acquisition strategy...');

    // Step 1: Get current follower count and growth rate
    const currentMetrics = await this.getCurrentGrowthMetrics();
    
    // Step 2: Analyze what's converting followers best
    const conversionInsights = await this.analyzeFollowerConversionPatterns();
    
    // Step 3: Get optimal growth strategy from AI
    const optimalStrategy = await this.growthOptimizer.getOptimalGrowthStrategy();
    
    // Step 4: Determine if we should run a growth experiment
    const experimentDecision = await this.shouldRunGrowthExperiment(currentMetrics);
    
    // Step 5: Generate AI-optimized content strategy
    const contentStrategy = await this.generateAIOptimizedContentStrategy(
      conversionInsights,
      optimalStrategy,
      experimentDecision.experiment
    );

    console.log(`🎯 GROWTH_STRATEGY: ${contentStrategy.contentStrategy}`);
    console.log(`📈 EXPECTED_GAIN: +${contentStrategy.expectedFollowerGain} followers (${Math.round(contentStrategy.confidence * 100)}% confidence)`);
    console.log(`🧪 EXPERIMENT: ${experimentDecision.experiment ? experimentDecision.experiment.hypothesis : 'None'}`);

    return contentStrategy;
  }

  /**
   * 📊 REAL-TIME FOLLOWER TRACKING: Get current growth metrics
   */
  private async getCurrentGrowthMetrics(): Promise<{
    currentFollowers: number;
    dailyGrowthRate: number;
    weeklyGrowthRate: number;
    averageEngagementRate: number;
    followerToEngagementRatio: number;
  }> {
    try {
      // Get follower count from real metrics
      const { data: recentMetrics } = await admin
        .from('real_tweet_metrics')
        .select('followers_count, collected_at')
        .order('collected_at', { ascending: false })
        .limit(100);

      if (!recentMetrics || recentMetrics.length === 0) {
        return {
          currentFollowers: 25, // Baseline
          dailyGrowthRate: 0,
          weeklyGrowthRate: 0,
          averageEngagementRate: 0.02,
          followerToEngagementRatio: 0.1
        };
      }

      const currentFollowers = recentMetrics[0].followers_count || 25;
      
      // Calculate growth rates
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      const dayOldMetrics = recentMetrics.find(m => 
        new Date(m.collected_at).getTime() < oneDayAgo
      );
      const weekOldMetrics = recentMetrics.find(m => 
        new Date(m.collected_at).getTime() < oneWeekAgo
      );

      const dailyGrowthRate = dayOldMetrics ? 
        ((currentFollowers - dayOldMetrics.followers_count) / dayOldMetrics.followers_count) * 100 : 0;
      
      const weeklyGrowthRate = weekOldMetrics ?
        ((currentFollowers - weekOldMetrics.followers_count) / weekOldMetrics.followers_count) * 100 : 0;

      console.log(`📊 CURRENT_METRICS: ${currentFollowers} followers (+${dailyGrowthRate.toFixed(1)}% daily, +${weeklyGrowthRate.toFixed(1)}% weekly)`);

      return {
        currentFollowers,
        dailyGrowthRate,
        weeklyGrowthRate,
        averageEngagementRate: 0.03, // Will be calculated from real data
        followerToEngagementRatio: 0.15
      };

    } catch (error: any) {
      console.warn('⚠️ METRICS_ERROR:', error.message);
      return {
        currentFollowers: 25,
        dailyGrowthRate: 0,
        weeklyGrowthRate: 0,
        averageEngagementRate: 0.02,
        followerToEngagementRatio: 0.1
      };
    }
  }

  /**
   * 🔍 FOLLOWER CONVERSION ANALYSIS: What content converts viewers to followers?
   */
  private async analyzeFollowerConversionPatterns(): Promise<FollowerConversionInsights> {
    console.log('🔍 CONVERSION_ANALYSIS: Analyzing what content converts followers...');

    try {
      // Get posts with follower gain data
      const { data: posts } = await admin
        .from('learning_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!posts || posts.length === 0) {
        return this.getDefaultConversionInsights();
      }

      // Analyze patterns in high-converting content
      const highConverters = posts.filter(p => (p.followers_gained || 0) > 2);
      
      const topContentTypes = this.extractTopPatterns(highConverters, 'content_type');
      const bestTimes = this.extractOptimalTimes(highConverters);
      const topTopics = this.extractTopPatterns(highConverters, 'topic');

      return {
        topConvertingContentTypes: topContentTypes,
        bestTimesForFollowerGain: bestTimes,
        highestConvertingTopics: topTopics,
        viralTriggers: ['controversial takes', 'surprising statistics', 'personal stories'],
        engagementToFollowerRatio: 0.15,
        averageFollowersPerPost: 3.2,
        conversionOptimizations: [
          'Use specific numbers in headlines',
          'Include contrarian perspectives',
          'End with strong calls to action',
          'Use thread format for complex topics'
        ]
      };

    } catch (error: any) {
      console.warn('⚠️ CONVERSION_ANALYSIS_ERROR:', error.message);
      return this.getDefaultConversionInsights();
    }
  }

  /**
   * 🧪 GROWTH EXPERIMENT DECISION: Should we test a new growth strategy?
   */
  private async shouldRunGrowthExperiment(metrics: any): Promise<{
    shouldExperiment: boolean;
    experiment?: GrowthExperiment;
    reason: string;
  }> {
    // Run experiments if growth is slow or we haven't tested recently
    const isSlowGrowth = metrics.dailyGrowthRate < 5; // Less than 5% daily growth
    const hasActiveExperiments = this.currentExperiments.length > 0;

    if (isSlowGrowth && !hasActiveExperiments) {
      const experiment = await this.generateGrowthExperiment(metrics);
      return {
        shouldExperiment: true,
        experiment,
        reason: 'Growth rate below target, testing new strategy'
      };
    }

    return {
      shouldExperiment: false,
      reason: 'Growth rate satisfactory or experiment already running'
    };
  }

  /**
   * 🤖 AI-OPTIMIZED CONTENT STRATEGY: Use AI to optimize every aspect for follower growth
   */
  private async generateAIOptimizedContentStrategy(
    conversionInsights: FollowerConversionInsights,
    optimalStrategy: any,
    experiment?: GrowthExperiment
  ): Promise<{
    contentStrategy: string;
    contentType: 'single' | 'thread';
    optimalTopic: string;
    viralHooks: string[];
    expectedFollowerGain: number;
    confidence: number;
  }> {
    const prompt = `You are an AI growth expert optimizing Twitter content for maximum follower acquisition.

CURRENT PERFORMANCE DATA:
- Top converting content types: ${conversionInsights.topConvertingContentTypes.join(', ')}
- Best follower gain times: ${conversionInsights.bestTimesForFollowerGain.join(', ')}
- Highest converting topics: ${conversionInsights.highestConvertingTopics.join(', ')}
- Average followers per post: ${conversionInsights.averageFollowersPerPost}

GROWTH STRATEGY: ${optimalStrategy.strategy || 'Maximize viral potential'}
CURRENT EXPERIMENT: ${experiment ? experiment.hypothesis : 'None'}

TOPIC DIVERSITY REQUIREMENT:
Choose from diverse health domains (avoid repetition):
- Sleep Science & Circadian Biology
- Mitochondrial Health & Energy
- Gut Microbiome & Digestion  
- Hormonal Optimization
- Exercise Physiology & Performance
- Mental Health & Neuroscience
- Longevity & Anti-Aging
- Nutrition Science & Metabolism
- Stress Management & Recovery
- Biohacking & Technology
- Environmental Health
- Alternative Medicine
- Disease Prevention

Create the optimal content strategy for MAXIMUM follower growth. Focus on:
1. Content that makes people want to follow for more
2. Topics that establish authority and expertise  
3. Hooks that create curiosity and urgency
4. Format that maximizes shareability
5. DIVERSE topic selection (not just trending topics)

Respond with JSON:
{
  "contentStrategy": "specific strategy for this post",
  "contentType": "single" | "thread", 
  "optimalTopic": "exact topic focus",
  "viralHooks": ["hook1", "hook2", "hook3"],
  "expectedFollowerGain": estimated_followers,
  "confidence": 0.85,
  "reasoning": "why this will gain followers"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 500
      });

      const strategy = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        contentStrategy: strategy.contentStrategy || 'Authority-building health insights',
        contentType: strategy.contentType || 'single',
        optimalTopic: strategy.optimalTopic || 'Advanced health optimization',
        viralHooks: strategy.viralHooks || ['Surprising research findings'],
        expectedFollowerGain: strategy.expectedFollowerGain || 5,
        confidence: strategy.confidence || 0.7
      };

    } catch (error: any) {
      console.warn('⚠️ AI_STRATEGY_ERROR:', error.message);
      return {
        contentStrategy: 'High-value health insights with authority positioning',
        contentType: 'thread',
        optimalTopic: 'Cutting-edge health research',
        viralHooks: ['Counterintuitive findings', 'Expert-level insights'],
        expectedFollowerGain: 5,
        confidence: 0.6
      };
    }
  }

  /**
   * 🔬 GENERATE GROWTH EXPERIMENT: Create data-driven tests for follower acquisition
   */
  private async generateGrowthExperiment(metrics: any): Promise<GrowthExperiment> {
    const experimentTypes = [
      {
        strategy: 'thread_vs_single' as const,
        hypothesis: 'Threads get 3x more followers than single tweets',
        parameters: { format: 'thread', expected_boost: 3 }
      },
      {
        strategy: 'viral_hooks' as const,
        hypothesis: 'Controversial takes get 5x more followers',
        parameters: { controversy_level: 'high', expected_boost: 5 }
      },
      {
        strategy: 'posting_frequency' as const,
        hypothesis: 'Posting every 4 hours maximizes follower growth',
        parameters: { interval: 240, expected_boost: 2 }
      }
    ];

    const randomExperiment = experimentTypes[Math.floor(Math.random() * experimentTypes.length)];

    return {
      id: `exp_${Date.now()}`,
      hypothesis: randomExperiment.hypothesis,
      strategy: randomExperiment.strategy,
      parameters: randomExperiment.parameters,
      startTime: new Date(),
      duration: 24, // 24 hours
      expectedImpact: randomExperiment.parameters.expected_boost * 3 // Expected followers
    };
  }

  /**
   * 📈 RECORD GROWTH RESULTS: Track follower gains from each post for learning
   */
  public async recordFollowerGrowthResults(
    contentStrategy: string,
    contentType: string,
    initialFollowers: number,
    finalFollowers: number,
    experiment?: GrowthExperiment
  ): Promise<void> {
    const followersGained = finalFollowers - initialFollowers;
    const growthRate = (followersGained / initialFollowers) * 100;

    console.log(`📈 GROWTH_RESULTS: ${contentStrategy} gained ${followersGained} followers (${growthRate.toFixed(2)}% growth)`);

    try {
      // Store results for learning
      await admin
        .from('follower_growth_experiments')
        .upsert([{
          strategy: contentStrategy,
          content_type: contentType,
          initial_followers: initialFollowers,
          final_followers: finalFollowers,
          followers_gained: followersGained,
          growth_rate: growthRate,
          experiment_id: experiment?.id,
          created_at: new Date().toISOString()
        }]);

      // Update growth accelerator
      await this.growthAccelerator.trackGrowthPerformance(
        contentType,
        initialFollowers,
        finalFollowers,
        { followersGained, growthRate }
      );

      console.log('✅ GROWTH_TRACKING: Results stored for AI learning');

    } catch (error: any) {
      console.warn('⚠️ GROWTH_TRACKING_ERROR:', error.message);
    }
  }

  // Helper methods
  private getDefaultConversionInsights(): FollowerConversionInsights {
    return {
      topConvertingContentTypes: ['threads', 'controversial_takes', 'value_bombs'],
      bestTimesForFollowerGain: [9, 14, 19],
      highestConvertingTopics: ['health_optimization', 'biohacking', 'longevity'],
      viralTriggers: ['specific numbers', 'contrarian views', 'personal results'],
      engagementToFollowerRatio: 0.12,
      averageFollowersPerPost: 2.5,
      conversionOptimizations: [
        'Use authority-building language',
        'Include surprising statistics',
        'End with follow-worthy promises'
      ]
    };
  }

  private extractTopPatterns(posts: any[], field: string): string[] {
    const patterns = posts.map(p => p[field]).filter(Boolean);
    const counts = patterns.reduce((acc, pattern) => {
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  private extractOptimalTimes(posts: any[]): number[] {
    const times = posts.map(p => new Date(p.created_at).getHours());
    const timeCounts = times.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return Object.entries(timeCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }
}

export const getUltimateFollowerGrowthMachine = () => UltimateFollowerGrowthMachine.getInstance();
