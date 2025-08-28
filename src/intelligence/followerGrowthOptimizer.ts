/**
 * FOLLOWER GROWTH OPTIMIZER
 * The core engine for maximizing Twitter followers and audience building
 * Learns from viral content patterns and Twitter algorithm signals
 */

import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { TweetPerformanceTracker } from './tweetPerformanceTracker';

export interface ViralPattern {
  id: string;
  contentType: 'hook' | 'controversy' | 'value_bomb' | 'story' | 'question' | 'list' | 'thread';
  followerConversionRate: number; // Followers gained per 1000 impressions
  engagementMultiplier: number;   // How much it boosts overall engagement
  viralScore: number;             // 0-100 likelihood of going viral
  reachAmplification: number;     // How much it extends reach beyond followers
  optimalTiming: {
    hour: number;
    dayOfWeek: number;
    confidence: number;
  };
  contentPattern: string;
  successMetrics: {
    avgLikes: number;
    avgRetweets: number;
    avgReplies: number;
    avgFollowersGained: number;
    impressionToFollowerRatio: number;
  };
}

export interface GrowthStrategy {
  strategy: 'viral_thread' | 'controversial_take' | 'value_drop' | 'trending_hijack' | 'story_hook';
  description: string;
  expectedFollowerGrowth: number;
  riskLevel: 'low' | 'medium' | 'high';
  contentRequirements: string[];
  timingRequirements: string[];
}

export class FollowerGrowthOptimizer {
  private static instance: FollowerGrowthOptimizer;
  private db: AdvancedDatabaseManager;
  private performanceTracker: TweetPerformanceTracker;
  private viralPatterns: Map<string, ViralPattern> = new Map();
  private currentFollowerGoal: number = 10000; // Start with 10K goal

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
    this.performanceTracker = TweetPerformanceTracker.getInstance();
  }

  public static getInstance(): FollowerGrowthOptimizer {
    if (!FollowerGrowthOptimizer.instance) {
      FollowerGrowthOptimizer.instance = new FollowerGrowthOptimizer();
    }
    return FollowerGrowthOptimizer.instance;
  }

  /**
   * Initialize the follower growth optimization system
   */
  public async initialize(): Promise<void> {
    console.log('🎯 Initializing Follower Growth Optimizer...');
    
    try {
      await this.loadViralPatterns();
      await this.analyzeCurrentGrowthRate();
      await this.setDynamicFollowerGoals();
      
      console.log('✅ Follower Growth Optimizer ready for viral content creation!');
    } catch (error) {
      console.error('❌ Failed to initialize Follower Growth Optimizer:', error);
    }
  }

  /**
   * Get the most effective content strategy for maximum follower growth
   */
  public async getOptimalGrowthStrategy(): Promise<GrowthStrategy> {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    const currentFollowers = await this.performanceTracker.getCurrentFollowerCount();
    
    // Analyze what's working best for follower acquisition
    const topPatterns = await this.getTopFollowerGrowthPatterns(5);
    
    if (topPatterns.length === 0) {
      return this.getDefaultGrowthStrategy();
    }

    // Choose strategy based on current followers and growth phase
    const strategy = this.selectOptimalStrategy(currentFollowers, topPatterns);
    
    console.log(`🎯 Optimal growth strategy: ${strategy.strategy} (Expected: +${strategy.expectedFollowerGrowth} followers)`);
    
    return strategy;
  }

  /**
   * Record performance baseline for learning
   */
  public async recordPostBaseline(data: {
    tweetId: string;
    content: string;
    contentType: string;
    predictedLikes: number;
    predictedFollowers: number;
    confidenceScore: number;
    postedAt: string;
  }): Promise<void> {
    try {
      console.log(`📊 GROWTH_OPTIMIZER: Recording baseline for ${data.tweetId}`);
      
      // Store in learning database for future analysis
      const { admin } = await import('../lib/supabaseClients');
      const supabase = admin;
      
      const { error } = await supabase
        .from('learning_posts')
        .upsert([{
          tweet_id: data.tweetId,
          content: data.content,
          content_type: data.contentType,
          predicted_likes: data.predictedLikes,
          predicted_followers: data.predictedFollowers,
          confidence_score: data.confidenceScore,
          posted_at: data.postedAt,
          baseline_recorded: true
        }], { onConflict: 'tweet_id' });

      if (error) {
        console.warn('⚠️ GROWTH_OPTIMIZER: Baseline storage failed:', error.message);
      } else {
        console.log('✅ GROWTH_OPTIMIZER: Baseline stored successfully');
      }
      
    } catch (error: any) {
      console.error('❌ GROWTH_OPTIMIZER: recordPostBaseline failed:', error.message);
    }
  }

  /**
   * Analyze content for viral potential and follower conversion
   */
  public async analyzeViralPotential(content: string): Promise<{
    viralScore: number;
    followerPotential: number;
    improvementSuggestions: string[];
    algorithmOptimization: string[];
  }> {
    const analysis = {
      viralScore: 0,
      followerPotential: 0,
      improvementSuggestions: [] as string[],
      algorithmOptimization: [] as string[]
    };

    // Viral indicators
    const viralIndicators = [
      { pattern: /^(Just|Pro tip|Anyone else|Fun fact|Hot take)/i, points: 15, reason: 'Strong hook' },
      { pattern: /\?$/, points: 10, reason: 'Engagement question' },
      { pattern: /(myth|truth|secret|hack|trick)/i, points: 12, reason: 'Value proposition' },
      { pattern: /\b(you|your)\b/gi, points: 8, reason: 'Personal connection' },
      { pattern: /^[^#]*$/, points: 10, reason: 'No hashtags (better reach)' },
      { pattern: /.{50,200}/, points: 8, reason: 'Optimal length' },
      { pattern: /(\d+|\w+:)/g, points: 6, reason: 'Structure/lists' }
    ];

    let viralScore = 30; // Base score
    viralIndicators.forEach(({ pattern, points, reason }) => {
      if (pattern.test(content)) {
        viralScore += points;
        analysis.algorithmOptimization.push(`✅ ${reason} (+${points}pts)`);
      }
    });

    // Follower conversion indicators
    const followerIndicators = [
      { pattern: /(thread|🧵|1\/)/i, bonus: 20, reason: 'Threads drive follows' },
      { pattern: /(controversial|unpopular|hot take)/i, bonus: 15, reason: 'Controversial content spreads' },
      { pattern: /(tip|hack|secret|strategy)/i, bonus: 12, reason: 'Value content attracts follows' },
      { pattern: /(study|research|data)/i, bonus: 8, reason: 'Authority builds trust' }
    ];

    let followerPotential = viralScore * 0.6;
    followerIndicators.forEach(({ pattern, bonus, reason }) => {
      if (pattern.test(content)) {
        followerPotential += bonus;
        analysis.algorithmOptimization.push(`🎯 ${reason} (+${bonus}pts)`);
      }
    });

    // Improvement suggestions
    if (viralScore < 60) {
      analysis.improvementSuggestions.push('Add a stronger hook (Just learned, Pro tip, Anyone else...)');
    }
    if (!content.includes('?')) {
      analysis.improvementSuggestions.push('Add an engagement question to boost replies');
    }
    if (content.includes('#')) {
      analysis.improvementSuggestions.push('Remove hashtags - they limit organic reach');
    }
    if (content.length > 250) {
      analysis.improvementSuggestions.push('Shorten to under 200 characters for better engagement');
    }

    analysis.viralScore = Math.min(100, viralScore);
    analysis.followerPotential = Math.min(100, followerPotential);

    return analysis;
  }

  /**
   * Learn from successful viral content for future optimization
   */
  public async learnFromViralSuccess(tweetId: string, metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    followersGained: number;
    content: string;
  }): Promise<void> {
    console.log(`🧠 Learning from viral success: ${tweetId} (+${metrics.followersGained} followers)`);

    // Extract viral patterns
    const pattern = await this.extractViralPattern(metrics);
    
    // Store for future use
    await this.storeViralPattern(tweetId, pattern);
    
    // Update algorithm understanding
    await this.updateAlgorithmInsights(metrics);
    
    console.log(`✅ Viral pattern learned and stored for future content optimization`);
  }

  /**
   * Get content hooks that maximize follower conversion
   */
  public getFollowerMagnetHooks(): string[] {
    return [
      "Just discovered something that changed how I think about",
      "Unpopular opinion that will probably get me unfollowed:",
      "Here's what nobody tells you about",
      "I spent 10 years learning this the hard way. Here's the shortcut:",
      "Thread: Why everyone gets this wrong 🧵",
      "Controversial take: Most people are doing this backwards",
      "Free advice that's worth more than most courses:",
      "The uncomfortable truth about",
      "Plot twist: Everything you know about [X] is wrong",
      "Quick story about why I was completely wrong about"
    ];
  }

  /**
   * Generate viral thread structure for maximum follower growth
   */
  public generateViralThreadStructure(topic: string): string[] {
    const hooks = this.getFollowerMagnetHooks();
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    
    return [
      `${randomHook} ${topic}`,
      "Here's what I learned:",
      "1/ Most people think [common belief]",
      "2/ But here's what actually works:",
      "3/ The key insight that changes everything:",
      "4/ Here's how to apply this:",
      "5/ The results speak for themselves:",
      "Follow for more insights like this 👆"
    ];
  }

  // Private helper methods
  private async loadViralPatterns(): Promise<void> {
    try {
      const patterns = await this.db.executeQuery(
        'load_viral_patterns',
        async (client) => {
          const { data, error } = await client
            .from('viral_patterns')
            .select('*')
            .order('follower_conversion_rate', { ascending: false })
            .limit(50);
          if (error) throw error;
          return data || [];
        }
      );

      patterns.forEach((pattern: any) => {
        this.viralPatterns.set(pattern.id, {
          id: pattern.id,
          contentType: pattern.content_type,
          followerConversionRate: pattern.follower_conversion_rate,
          engagementMultiplier: pattern.engagement_multiplier,
          viralScore: pattern.viral_score,
          reachAmplification: pattern.reach_amplification,
          optimalTiming: pattern.optimal_timing,
          contentPattern: pattern.content_pattern,
          successMetrics: pattern.success_metrics
        });
      });

      console.log(`📊 Loaded ${patterns.length} viral patterns for follower optimization`);
    } catch (error) {
      console.warn('Could not load viral patterns, using defaults');
    }
  }

  private async analyzeCurrentGrowthRate(): Promise<void> {
    // Analyze follower growth velocity and adjust strategies
    const recentGrowth = await this.db.executeQuery(
      'analyze_growth_rate',
      async (client) => {
        const { data, error } = await client
          .from('tweet_performance')
          .select('follower_growth, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      }
    );

    const totalGrowth = recentGrowth.reduce((sum: number, record: any) => sum + (record.follower_growth || 0), 0);
    const avgDailyGrowth = totalGrowth / 7;

    console.log(`📈 Current growth rate: ${avgDailyGrowth.toFixed(1)} followers/day`);
    
    if (avgDailyGrowth < 5) {
      console.log('🚀 Low growth detected - switching to aggressive viral strategies');
    }
  }

  private async setDynamicFollowerGoals(): Promise<void> {
    const currentCount = await this.performanceTracker.getCurrentFollowerCount();
    
    if (currentCount < 1000) {
      this.currentFollowerGoal = 1000;
    } else if (currentCount < 10000) {
      this.currentFollowerGoal = 10000;
    } else if (currentCount < 100000) {
      this.currentFollowerGoal = 100000;
    } else {
      this.currentFollowerGoal = 1000000;
    }

    console.log(`🎯 Current follower goal: ${this.currentFollowerGoal.toLocaleString()}`);
  }

  private async getTopFollowerGrowthPatterns(limit: number): Promise<ViralPattern[]> {
    return Array.from(this.viralPatterns.values())
      .sort((a, b) => b.followerConversionRate - a.followerConversionRate)
      .slice(0, limit);
  }

  private selectOptimalStrategy(currentFollowers: number, patterns: ViralPattern[]): GrowthStrategy {
    if (currentFollowers < 1000) {
      return {
        strategy: 'viral_thread',
        description: 'Create viral threads with strong hooks for rapid initial growth',
        expectedFollowerGrowth: 50,
        riskLevel: 'medium',
        contentRequirements: ['Strong hook', 'Value-packed insights', 'Thread format'],
        timingRequirements: ['Peak hours', 'Weekday posting']
      };
    } else if (currentFollowers < 10000) {
      return {
        strategy: 'controversial_take',
        description: 'Share controversial but valuable opinions to spark engagement',
        expectedFollowerGrowth: 100,
        riskLevel: 'high',
        contentRequirements: ['Unpopular opinion', 'Well-reasoned argument', 'Engagement bait'],
        timingRequirements: ['High-engagement windows', 'When topic is trending']
      };
    } else {
      return {
        strategy: 'value_drop',
        description: 'Share high-value insights and expertise to build authority',
        expectedFollowerGrowth: 200,
        riskLevel: 'low',
        contentRequirements: ['Expert insights', 'Actionable advice', 'Authority building'],
        timingRequirements: ['Consistent daily posting', 'Prime engagement hours']
      };
    }
  }

  private getDefaultGrowthStrategy(): GrowthStrategy {
    return {
      strategy: 'viral_thread',
      description: 'Default viral thread strategy for follower growth',
      expectedFollowerGrowth: 25,
      riskLevel: 'medium',
      contentRequirements: ['Engaging hook', 'Valuable content', 'Clear structure'],
      timingRequirements: ['Optimal posting windows']
    };
  }

  private async extractViralPattern(metrics: any): Promise<ViralPattern> {
    const conversionRate = (metrics.followersGained / Math.max(metrics.impressions, 1)) * 1000;
    const engagementRate = (metrics.likes + metrics.retweets + metrics.replies) / Math.max(metrics.impressions, 1);
    
    return {
      id: `pattern_${Date.now()}`,
      contentType: this.analyzeContentType(metrics.content),
      followerConversionRate: conversionRate,
      engagementMultiplier: engagementRate * 100,
      viralScore: Math.min(100, (metrics.retweets / Math.max(metrics.likes, 1)) * 100),
      reachAmplification: metrics.impressions / Math.max(metrics.likes, 1),
      optimalTiming: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        confidence: 0.7
      },
      contentPattern: metrics.content.substring(0, 100),
      successMetrics: {
        avgLikes: metrics.likes,
        avgRetweets: metrics.retweets,
        avgReplies: metrics.replies,
        avgFollowersGained: metrics.followersGained,
        impressionToFollowerRatio: metrics.impressions / Math.max(metrics.followersGained, 1)
      }
    };
  }

  private analyzeContentType(content: string): ViralPattern['contentType'] {
    if (content.includes('?')) return 'question';
    if (/\d+\//.test(content)) return 'thread';
    if (/(unpopular|controversial|hot take)/i.test(content)) return 'controversy';
    if (/(tip|hack|secret)/i.test(content)) return 'value_bomb';
    if (/(story|happened|experience)/i.test(content)) return 'story';
    if (/(\d+\.|•|-)/g.test(content)) return 'list';
    return 'hook';
  }

  private async storeViralPattern(tweetId: string, pattern: ViralPattern): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_viral_pattern',
        async (client) => {
          const { error } = await client
            .from('viral_patterns')
            .insert({
              tweet_id: tweetId,
              content_type: pattern.contentType,
              follower_conversion_rate: pattern.followerConversionRate,
              engagement_multiplier: pattern.engagementMultiplier,
              viral_score: pattern.viralScore,
              reach_amplification: pattern.reachAmplification,
              optimal_timing: pattern.optimalTiming,
              content_pattern: pattern.contentPattern,
              success_metrics: pattern.successMetrics
            });
          if (error) throw error;
          return { success: true };
        }
      );
    } catch (error) {
      console.warn('Failed to store viral pattern:', error);
    }
  }

  private async updateAlgorithmInsights(metrics: any): Promise<void> {
    // Update our understanding of what Twitter's algorithm rewards
    console.log(`🤖 Algorithm insight: ${metrics.followersGained} followers from ${metrics.impressions} impressions`);
  }
}