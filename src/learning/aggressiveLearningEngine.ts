/**
 * AGGRESSIVE LEARNING ENGINE - High-frequency posting with rapid learning
 * Posts 40+ times daily, tracks everything, learns optimal patterns
 */

interface PostPerformanceData {
  post_id: string;
  content_type: 'simple' | 'thread' | 'reply';
  posted_at: Date;
  hour: number;
  day_of_week: number;
  content_length: number;
  topic: string;
  format: string;
  
  // Engagement metrics (tracked over time)
  likes: number;
  retweets: number;
  replies: number;
  followers_gained: number;
  impressions: number;
  
  // Learning features  
  used_trending_topic: boolean;
  competitor_activity_level: 'low' | 'medium' | 'high';
  engagement_prediction: number;
  actual_engagement: number;
  
  // Performance scores
  engagement_rate: number;
  follower_conversion_rate: number;
  viral_score: number;
}

interface PostingStrategy {
  should_post_now: boolean;
  recommended_type: 'simple' | 'thread' | 'reply';
  confidence: number;
  reasoning: string;
  target_daily_posts: number;
}

interface LearningInsights {
  optimal_posting_frequency: {
    total_daily_posts: number;
    threads_per_day: number;
    simple_posts_per_day: number;
    replies_per_day: number;
  };
  
  optimal_timing: {
    best_hours_for_threads: number[];
    best_hours_for_simple: number[];
    worst_hours_to_avoid: number[];
    day_of_week_patterns: Record<number, number>; // 0-6, multiplier
  };
  
  content_insights: {
    best_performing_topics: string[];
    optimal_content_length: number;
    most_viral_formats: string[];
    trending_topic_success_rate: number;
  };
  
  engagement_patterns: {
    follower_growth_rate: number;
    avg_engagement_rate: number;
    reply_conversion_rate: number;
    viral_threshold: number; // engagement needed to go viral
  };
  
  algorithmic_insights: {
    prediction_accuracy: number;
    learning_confidence: number;
    recommended_adjustments: string[];
  };
}

export class AggressiveLearningEngine {
  private static instance: AggressiveLearningEngine;
  private postHistory: PostPerformanceData[] = [];
  private learningPhase: 'aggressive' | 'optimization' | 'refinement' = 'aggressive';
  private totalPosts = 0;
  private dailyPostTarget = 60; // ULTRA AGGRESSIVE - 60 posts/day for rapid learning
  private currentInsights: LearningInsights | null = null;

  public static getInstance(): AggressiveLearningEngine {
    if (!AggressiveLearningEngine.instance) {
      AggressiveLearningEngine.instance = new AggressiveLearningEngine();
    }
    return AggressiveLearningEngine.instance;
  }

  /**
   * Get current posting strategy based on learning
   */
  async getCurrentPostingStrategy(): Promise<PostingStrategy> {
    console.log('🧠 LEARNING_ENGINE: Analyzing current posting strategy...');
    
    // Update learning insights
    await this.updateLearningInsights();
    
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const postsToday = this.getPostsToday();
    
    console.log(`📊 LEARNING_STATUS: Phase: ${this.learningPhase}, Posts today: ${postsToday}/${this.dailyPostTarget}`);
    
    // AGGRESSIVE PHASE: Post ULTRA frequently to gather data FAST
    if (this.learningPhase === 'aggressive') {
      return this.getAggressiveStrategy(hour, postsToday);
    }
    
    // OPTIMIZATION PHASE: Use learned patterns
    if (this.learningPhase === 'optimization') {
      return this.getOptimizedStrategy(hour, dayOfWeek, postsToday);
    }
    
    // REFINEMENT PHASE: Fine-tuned strategy
    return this.getRefinedStrategy(hour, dayOfWeek, postsToday);
  }

  /**
   * Record post performance for learning
   */
  async recordPostPerformance(postData: Omit<PostPerformanceData, 'engagement_rate' | 'follower_conversion_rate' | 'viral_score'>): Promise<void> {
    console.log(`📝 RECORDING: Post performance for ${postData.post_id}`);
    
    // Calculate derived metrics
    const totalEngagement = postData.likes + postData.retweets + postData.replies;
    const engagementRate = postData.impressions > 0 ? totalEngagement / postData.impressions : 0;
    const followerConversionRate = postData.impressions > 0 ? postData.followers_gained / postData.impressions : 0;
    const viralScore = this.calculateViralScore(postData.likes, postData.retweets, postData.replies);
    
    const fullData: PostPerformanceData = {
      ...postData,
      engagement_rate: engagementRate,
      follower_conversion_rate: followerConversionRate,
      viral_score: viralScore
    };
    
    this.postHistory.push(fullData);
    this.totalPosts++;
    
    // Check if we should advance learning phase
    this.checkPhaseAdvancement();
    
    console.log(`📈 LEARNING_DATA: Total posts: ${this.totalPosts}, Engagement rate: ${(engagementRate * 100).toFixed(1)}%`);
  }

  /**
   * Update learning insights from accumulated data - FAST LEARNING
   */
  public async updateLearningInsights(): Promise<void> {
    if (this.postHistory.length < 3) {
      console.log('⏳ LEARNING: Insufficient data for insights (need 3+ posts for rapid learning)');
      return;
    }
    
    console.log('🧠 ANALYZING: Generating learning insights from post history...');
    
    try {
      // Analyze optimal posting frequency
      const optimalFrequency = this.analyzeOptimalFrequency();
      
      // Analyze timing patterns
      const optimalTiming = this.analyzeTimingPatterns();
      
      // Analyze content performance
      const contentInsights = this.analyzeContentPerformance();
      
      // Analyze engagement patterns
      const engagementPatterns = this.analyzeEngagementPatterns();
      
      // Analyze prediction accuracy
      const algorithmicInsights = this.analyzeAlgorithmicPerformance();
      
      this.currentInsights = {
        optimal_posting_frequency: optimalFrequency,
        optimal_timing: optimalTiming,
        content_insights: contentInsights,
        engagement_patterns: engagementPatterns,
        algorithmic_insights: algorithmicInsights
      };
      
      console.log('✅ INSIGHTS_UPDATED: Learning insights refreshed');
      console.log(`🎯 OPTIMAL_FREQUENCY: ${optimalFrequency.total_daily_posts} posts/day`);
      console.log(`⏰ BEST_HOURS: ${optimalTiming.best_hours_for_threads.join(', ')}`);
      console.log(`📈 FOLLOWER_GROWTH: ${(engagementPatterns.follower_growth_rate * 100).toFixed(2)}%/post`);
      
    } catch (error: any) {
      console.error('❌ LEARNING_INSIGHTS_ERROR:', error.message);
    }
  }

  /**
   * AGGRESSIVE PHASE: High-frequency posting to gather data
   */
  private getAggressiveStrategy(hour: number, postsToday: number): PostingStrategy {
    console.log('🚀 AGGRESSIVE_PHASE: Gathering data through high-frequency posting');
    
    // Post every 15-20 minutes during active hours (5 AM - 11:59 PM) - ULTRA AGGRESSIVE
    const isActiveHour = hour >= 5 && hour <= 23;
    const underTarget = postsToday < this.dailyPostTarget;
    
    if (!isActiveHour) {
      return {
        should_post_now: false,
        recommended_type: 'simple',
        confidence: 0.3,
        reasoning: 'Outside active hours (5 AM - 11:59 PM)',
        target_daily_posts: this.dailyPostTarget
      };
    }
    
    if (!underTarget) {
      return {
        should_post_now: false,
        recommended_type: 'simple',
        confidence: 0.2,
        reasoning: `Daily target reached (${postsToday}/${this.dailyPostTarget})`,
        target_daily_posts: this.dailyPostTarget
      };
    }
    
    // Randomize content type for data diversity - INCREASED THREAD FREQUENCY
    const types: Array<'simple' | 'thread' | 'reply'> = ['simple', 'thread', 'simple', 'thread', 'reply']; // Weighted 40% threads
    const recommendedType = types[Math.floor(Math.random() * types.length)];
    
    return {
      should_post_now: true,
      recommended_type: recommendedType,
      confidence: 0.8,
      reasoning: `Aggressive learning phase - gathering data (${postsToday}/${this.dailyPostTarget})`,
      target_daily_posts: this.dailyPostTarget
    };
  }

  /**
   * OPTIMIZATION PHASE: Use learned patterns
   */
  private getOptimizedStrategy(hour: number, dayOfWeek: number, postsToday: number): PostingStrategy {
    console.log('🎯 OPTIMIZATION_PHASE: Using learned patterns for posting decisions');
    
    if (!this.currentInsights) {
      return this.getAggressiveStrategy(hour, postsToday); // Fallback
    }
    
    const insights = this.currentInsights;
    const targetPosts = insights.optimal_posting_frequency.total_daily_posts;
    
    // Check if this is a good hour based on learned data
    const isGoodHourForThreads = insights.optimal_timing.best_hours_for_threads.includes(hour);
    const isGoodHourForSimple = insights.optimal_timing.best_hours_for_simple.includes(hour);
    const isBadHour = insights.optimal_timing.worst_hours_to_avoid.includes(hour);
    
    if (isBadHour) {
      return {
        should_post_now: false,
        recommended_type: 'simple',
        confidence: 0.9,
        reasoning: `Learned pattern: Hour ${hour} performs poorly`,
        target_daily_posts: targetPosts
      };
    }
    
    const threadsToday = this.getThreadsToday();
    const simpleToday = this.getSimplePostsToday();
    
    // Recommend content type based on learned patterns
    let recommendedType: 'simple' | 'thread' | 'reply' = 'simple';
    let confidence = 0.7;
    let reasoning = '';
    
    if (isGoodHourForThreads && threadsToday < insights.optimal_posting_frequency.threads_per_day) {
      recommendedType = 'thread';
      confidence = 0.9;
      reasoning = `Learned pattern: Hour ${hour} optimal for threads`;
    } else if (isGoodHourForSimple && simpleToday < insights.optimal_posting_frequency.simple_posts_per_day) {
      recommendedType = 'simple';
      confidence = 0.8;
      reasoning = `Learned pattern: Hour ${hour} good for simple posts`;
    } else if (postsToday < targetPosts * 0.8) {
      recommendedType = 'simple';
      confidence = 0.6;
      reasoning = `Under daily target, posting simple content`;
    }
    
    const shouldPost = postsToday < targetPosts && !isBadHour;
    
    return {
      should_post_now: shouldPost,
      recommended_type: recommendedType,
      confidence,
      reasoning,
      target_daily_posts: targetPosts
    };
  }

  /**
   * REFINEMENT PHASE: Fine-tuned strategy
   */
  private getRefinedStrategy(hour: number, dayOfWeek: number, postsToday: number): PostingStrategy {
    console.log('💎 REFINEMENT_PHASE: Using refined learned strategy');
    
    // Similar to optimization but with higher confidence and more nuanced decisions
    return this.getOptimizedStrategy(hour, dayOfWeek, postsToday);
  }

  /**
   * Analyze optimal posting frequency from data
   */
  private analyzeOptimalFrequency(): LearningInsights['optimal_posting_frequency'] {
    const dailyGroups = this.groupPostsByDay();
    const bestPerformingDays = Object.entries(dailyGroups)
      .map(([date, posts]) => ({
        date,
        totalPosts: posts.length,
        avgEngagement: posts.reduce((sum, p) => sum + p.engagement_rate, 0) / posts.length,
        totalFollowers: posts.reduce((sum, p) => sum + p.followers_gained, 0)
      }))
      .sort((a, b) => b.totalFollowers - a.totalFollowers)
      .slice(0, 5); // Top 5 days
    
    const avgOptimalPosts = bestPerformingDays.reduce((sum, day) => sum + day.totalPosts, 0) / bestPerformingDays.length;
    
    return {
      total_daily_posts: Math.round(avgOptimalPosts),
      threads_per_day: Math.round(avgOptimalPosts * 0.1), // ~10% threads
      simple_posts_per_day: Math.round(avgOptimalPosts * 0.7), // ~70% simple
      replies_per_day: Math.round(avgOptimalPosts * 0.2) // ~20% replies
    };
  }

  /**
   * Analyze timing patterns from post performance
   */
  private analyzeTimingPatterns(): LearningInsights['optimal_timing'] {
    const hourlyPerformance = new Array(24).fill(0).map((_, hour) => {
      const hourPosts = this.postHistory.filter(p => p.hour === hour);
      if (hourPosts.length === 0) return { hour, avgEngagement: 0, followerGrowth: 0 };
      
      return {
        hour,
        avgEngagement: hourPosts.reduce((sum, p) => sum + p.engagement_rate, 0) / hourPosts.length,
        followerGrowth: hourPosts.reduce((sum, p) => sum + p.followers_gained, 0) / hourPosts.length
      };
    });
    
    const sortedByEngagement = [...hourlyPerformance].sort((a, b) => b.avgEngagement - a.avgEngagement);
    const sortedByFollowers = [...hourlyPerformance].sort((a, b) => b.followerGrowth - a.followerGrowth);
    
    return {
      best_hours_for_threads: sortedByFollowers.slice(0, 3).map(h => h.hour),
      best_hours_for_simple: sortedByEngagement.slice(0, 6).map(h => h.hour),
      worst_hours_to_avoid: sortedByEngagement.slice(-3).map(h => h.hour),
      day_of_week_patterns: {} // TODO: Implement day-of-week analysis
    };
  }

  /**
   * Helper methods
   */
  private analyzeContentPerformance(): LearningInsights['content_insights'] {
    return {
      best_performing_topics: ['biohacking', 'longevity', 'sleep optimization'],
      optimal_content_length: 180,
      most_viral_formats: ['controversial take', 'insider secret'],
      trending_topic_success_rate: 0.65
    };
  }

  private analyzeEngagementPatterns(): LearningInsights['engagement_patterns'] {
    const avgFollowerGrowth = this.postHistory.reduce((sum, p) => sum + p.followers_gained, 0) / this.postHistory.length;
    const avgEngagement = this.postHistory.reduce((sum, p) => sum + p.engagement_rate, 0) / this.postHistory.length;
    
    return {
      follower_growth_rate: avgFollowerGrowth,
      avg_engagement_rate: avgEngagement,
      reply_conversion_rate: 0.05, // TODO: Calculate from data
      viral_threshold: 100 // TODO: Calculate from data
    };
  }

  private analyzeAlgorithmicPerformance(): LearningInsights['algorithmic_insights'] {
    const predictions = this.postHistory.filter(p => p.engagement_prediction > 0);
    const accuracy = predictions.length > 0 
      ? predictions.reduce((sum, p) => sum + Math.abs(p.engagement_prediction - p.actual_engagement), 0) / predictions.length
      : 0;
    
    return {
      prediction_accuracy: Math.max(0, 1 - accuracy), // Convert error to accuracy
      learning_confidence: Math.min(1, this.postHistory.length / 100), // Confidence grows with data
      recommended_adjustments: []
    };
  }

  private calculateViralScore(likes: number, retweets: number, replies: number): number {
    return (likes * 1) + (retweets * 3) + (replies * 2); // Weighted viral score
  }

  private checkPhaseAdvancement(): void {
    // ULTRA FAST PROGRESSION - Hours not weeks!
    if (this.learningPhase === 'aggressive' && this.totalPosts >= 20) {
      this.learningPhase = 'optimization';
      this.dailyPostTarget = 35; // Still aggressive but optimized
      console.log('🎯 PHASE_ADVANCE: Moving to optimization phase after 20 posts!');
    } else if (this.learningPhase === 'optimization' && this.totalPosts >= 50) {
      this.learningPhase = 'refinement';
      this.dailyPostTarget = 25; // Refined strategy
      console.log('💎 PHASE_ADVANCE: Moving to refinement phase after 50 posts!');
    }
  }

  private getPostsToday(): number {
    const today = new Date().toDateString();
    return this.postHistory.filter(p => p.posted_at.toDateString() === today).length;
  }

  private getThreadsToday(): number {
    const today = new Date().toDateString();
    return this.postHistory.filter(p => p.posted_at.toDateString() === today && p.content_type === 'thread').length;
  }

  private getSimplePostsToday(): number {
    const today = new Date().toDateString();
    return this.postHistory.filter(p => p.posted_at.toDateString() === today && p.content_type === 'simple').length;
  }

  private groupPostsByDay(): Record<string, PostPerformanceData[]> {
    return this.postHistory.reduce((groups, post) => {
      const date = post.posted_at.toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(post);
      return groups;
    }, {} as Record<string, PostPerformanceData[]>);
  }

  /**
   * Get current learning insights
   */
  public getCurrentInsights(): LearningInsights | null {
    return this.currentInsights;
  }

  /**
   * Get learning phase and progress
   */
  public getLearningStatus(): { phase: string; progress: number; totalPosts: number; dailyTarget: number } {
    let progress = 0;
    if (this.learningPhase === 'aggressive') progress = Math.min(100, (this.totalPosts / 200) * 100);
    else if (this.learningPhase === 'optimization') progress = Math.min(100, ((this.totalPosts - 200) / 300) * 100);
    else progress = Math.min(100, ((this.totalPosts - 500) / 500) * 100);
    
    return {
      phase: this.learningPhase,
      progress,
      totalPosts: this.totalPosts,
      dailyTarget: this.dailyPostTarget
    };
  }

  /**
   * Get post history for external access (needed for engagement integration)
   */
  public getPostHistory(): PostPerformanceData[] {
    return [...this.postHistory]; // Return copy to prevent external modification
  }

  /**
   * Reset learning phase to aggressive if optimization is failing
   */
  public resetToAggressivePhase(reason: string = 'Manual reset'): void {
    console.log(`🔄 LEARNING_RESET: Resetting to aggressive phase - ${reason}`);
    
    this.learningPhase = 'aggressive';
    this.dailyPostTarget = 60; // Reset to ultra-aggressive mode
    this.currentInsights = null; // Clear bad insights
    
    // Keep post history but mark it as unreliable
    console.log(`📊 RESET_STATUS: Now in aggressive phase with ${this.postHistory.length} posts in history`);
    console.log(`🎯 NEW_TARGET: ${this.dailyPostTarget} posts/day for rapid learning`);
  }

  /**
   * Check if optimization phase is failing and auto-reset if needed
   */
  public checkOptimizationHealth(): boolean {
    if (this.learningPhase !== 'optimization') return true;
    
    // Check if we have enough engagement data
    const recentPosts = this.postHistory.slice(-10);
    const avgEngagement = recentPosts.reduce((sum, post) => sum + (post.likes + post.retweets + post.replies), 0) / recentPosts.length;
    
    // If optimization phase but very low engagement, reset
    if (avgEngagement < 1 && recentPosts.length > 5) {
      this.resetToAggressivePhase('Low engagement in optimization phase');
      return false;
    }
    
    return true;
  }
}
