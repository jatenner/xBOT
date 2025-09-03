/**
 * ADAPTIVE POSTING MANAGER - Data-driven posting decisions
 * Posts based on engagement opportunities, not rigid schedules
 */

interface PostingOpportunity {
  type: 'simple_fact' | 'advice' | 'thread';
  urgency: number; // 1-10
  reason: string;
  optimal_timing: number; // minutes from now
}

interface EngagementWindow {
  isOptimal: boolean;
  multiplier: number; // 0.5-3.0x expected engagement
  trending_topics: string[];
  competitor_activity: 'low' | 'medium' | 'high';
}

export class AdaptivePostingManager {
  private static instance: AdaptivePostingManager;
  private lastSimplePost = 0;
  private lastThreadPost = 0;
  private threadsToday = 0;
  private simplePostsToday = 0;
  private lastResetDate = '';

  public static getInstance(): AdaptivePostingManager {
    if (!AdaptivePostingManager.instance) {
      AdaptivePostingManager.instance = new AdaptivePostingManager();
    }
    return AdaptivePostingManager.instance;
  }

  /**
   * Determine what to post based on LEARNING ENGINE data
   */
  async getNextPostingOpportunity(): Promise<PostingOpportunity | null> {
    console.log('🧠 LEARNING_DRIVEN_POSTING: Using aggressive learning engine...');
    
    try {
      // Get learning-based strategy
      const { AggressiveLearningEngine } = await import('../learning/aggressiveLearningEngine');
      const learningEngine = AggressiveLearningEngine.getInstance();
      
      // Check if optimization phase is healthy, reset if failing
      learningEngine.checkOptimizationHealth();
      
      const strategy = await learningEngine.getCurrentPostingStrategy();
      const status = learningEngine.getLearningStatus();
      
      console.log(`🎓 LEARNING_STATUS: Phase: ${status.phase}, Progress: ${status.progress.toFixed(0)}%`);
      console.log(`📊 LEARNING_TARGET: ${status.dailyTarget} posts/day (${status.totalPosts} total posts)`);
      console.log(`🤖 STRATEGY: ${strategy.should_post_now ? 'POST' : 'WAIT'} - ${strategy.reasoning}`);
      
      if (!strategy.should_post_now) {
        return null;
      }
      
      // Map learning engine recommendations to our format
      let postType: 'simple_fact' | 'advice' | 'thread';
      if (strategy.recommended_type === 'thread') {
        postType = 'thread';
      } else if (strategy.recommended_type === 'reply') {
        postType = 'advice'; // Treat replies as advice posts for now
      } else {
        postType = Math.random() > 0.5 ? 'simple_fact' : 'advice';
      }
      
      return {
        type: postType,
        urgency: Math.round(strategy.confidence * 10),
        reason: `LEARNING: ${strategy.reasoning} (confidence: ${(strategy.confidence * 100).toFixed(0)}%)`,
        optimal_timing: 0
      };
      
    } catch (error: any) {
      console.error('❌ LEARNING_ENGINE_ERROR:', error.message);
      console.log('🔄 FALLBACK: Using default posting logic');
      return this.getDefaultPostingOpportunity();
    }
  }

  /**
   * Fallback posting logic if learning engine fails
   */
  private getDefaultPostingOpportunity(): PostingOpportunity | null {
    // Reset daily counters
    this.resetDailyCounters();
    
    // Get time since last posts
    const minutesSinceSimple = (Date.now() - this.lastSimplePost) / (1000 * 60);
    const minutesSinceThread = (Date.now() - this.lastThreadPost) / (1000 * 60);
    
    console.log(`📊 DEFAULT_LOGIC: Simple: ${minutesSinceSimple.toFixed(0)}min ago, Thread: ${minutesSinceThread.toFixed(0)}min ago`);
    
    // ULTRA AGGRESSIVE posting during learning phase - post every 15-20 minutes!
    if (minutesSinceSimple >= 15 && this.simplePostsToday < 60) {
      return {
        type: Math.random() > 0.5 ? 'simple_fact' : 'advice',
        urgency: 9,
        reason: 'ULTRA AGGRESSIVE learning phase - rapid data collection',
        optimal_timing: 0
      };
    }
    
    if (minutesSinceThread >= 120 && this.threadsToday < 8) {
      return {
        type: 'thread',
        urgency: 9,
        reason: 'Thread for rapid learning data collection',
        optimal_timing: 0
      };
    }
    
    return null;
  }

  /**
   * Analyze current engagement conditions using REAL Twitter data
   */
  private async analyzeEngagementWindow(): Promise<EngagementWindow> {
    try {
      console.log('📊 ENGAGEMENT_ANALYSIS: Using real Twitter analytics...');
      
      const { TwitterAnalyticsEngine } = await import('../analytics/twitterAnalyticsEngine');
      const analytics = TwitterAnalyticsEngine.getInstance();
      
      // Get real-time engagement forecast
      const forecast = await analytics.generateEngagementForecast();
      const currentHour = new Date().getHours();
      
      // Find prediction for current hour
      const currentPrediction = forecast.next_6_hours.find(p => p.hour === currentHour);
      
      if (!currentPrediction) {
        console.log('⚠️ NO_PREDICTION: Using default engagement analysis');
        return this.getDefaultEngagementWindow();
      }
      
      // Determine if this is an optimal window
      const isOptimal = currentPrediction.predicted_engagement > 70 && currentPrediction.confidence > 0.7;
      
      // Calculate engagement multiplier based on prediction
      const baseMultiplier = currentPrediction.predicted_engagement / 100;
      const confidenceBonus = currentPrediction.confidence * 0.5;
      const finalMultiplier = Math.max(0.3, Math.min(3.0, baseMultiplier + confidenceBonus));
      
      // Get trending topics
      const trendingTopics = forecast.trending_opportunities.map(t => t.topic);
      
      // Assess competitor activity
      const competitorGaps = forecast.competitor_gaps.filter(g => g.time_slot === currentHour);
      const competitorActivity = competitorGaps.length > 0 ? 'low' : 'medium';
      
      console.log(`📊 REAL_ANALYTICS: ${isOptimal ? 'OPTIMAL' : 'NORMAL'} window`);
      console.log(`📈 PREDICTED_ENGAGEMENT: ${currentPrediction.predicted_engagement.toFixed(0)}% (${finalMultiplier.toFixed(1)}x)`);
      console.log(`🔥 TRENDING: ${trendingTopics.slice(0, 2).join(', ')}`);
      console.log(`🏆 COMPETITOR_ACTIVITY: ${competitorActivity}`);
      
      return {
        isOptimal,
        multiplier: finalMultiplier,
        trending_topics: trendingTopics,
        competitor_activity: competitorActivity as 'low' | 'medium' | 'high'
      };
      
    } catch (error) {
      console.error('❌ ANALYTICS_ERROR:', error);
      return this.getDefaultEngagementWindow();
    }
  }

  /**
   * Fallback engagement window if analytics fail
   */
  private getDefaultEngagementWindow(): EngagementWindow {
    const hour = new Date().getHours();
    const peakHours = [7, 8, 12, 13, 18, 19];
    const isOptimal = peakHours.includes(hour);
    
    return {
      isOptimal,
      multiplier: isOptimal ? 1.5 : 1.0,
      trending_topics: ['biohacking', 'longevity'],
      competitor_activity: 'medium'
    };
  }

  /**
   * Record that we posted something AND feed data to learning engine
   */
  async recordPost(type: 'simple_fact' | 'advice' | 'thread', postId?: string, content?: string): Promise<void> {
    const now = Date.now();
    
    if (type === 'thread') {
      this.lastThreadPost = now;
      this.threadsToday++;
      console.log(`📊 RECORDED: Thread posted (${this.threadsToday} today)`);
    } else {
      this.lastSimplePost = now;
      this.simplePostsToday++;
      console.log(`📊 RECORDED: ${type} posted (${this.simplePostsToday} today)`);
    }
    
    // Feed data to learning engine AND start real engagement tracking
    if (postId) {
      try {
        const { AggressiveLearningEngine } = await import('../learning/aggressiveLearningEngine');
        const { RealEngagementIntegration } = await import('../learning/realEngagementIntegration');
        
        const learningEngine = AggressiveLearningEngine.getInstance();
        const engagementTracker = RealEngagementIntegration.getInstance();
        
        // Record initial post data (will be updated with real engagement)
        await learningEngine.recordPostPerformance({
          post_id: postId,
          content_type: type === 'thread' ? 'thread' : 'simple',
          posted_at: new Date(),
          hour: new Date().getHours(),
          day_of_week: new Date().getDay(),
          content_length: content?.length || 0,
          topic: 'general', // TODO: Extract topic from content
          format: type,
          
          // Initial metrics (will be updated later)
          likes: 0,
          retweets: 0,
          replies: 0,
          followers_gained: 0,
          impressions: 0,
          
          used_trending_topic: false, // TODO: Track this
          competitor_activity_level: 'medium', // TODO: Get from analytics
          engagement_prediction: 0, // TODO: Get from prediction
          actual_engagement: 0 // Will be updated later
        });
        
        console.log(`🎓 LEARNING: Post data recorded for learning engine`);
        
        // 🚀 START REAL ENGAGEMENT TRACKING
        await engagementTracker.startTracking(postId);
        console.log(`📊 ENGAGEMENT_TRACKING: Started real engagement tracking for ${postId}`);
        
      } catch (error: any) {
        console.error('❌ LEARNING_RECORD_ERROR:', error.message);
      }
    }
  }

  /**
   * Reset daily counters at midnight
   */
  private resetDailyCounters(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.threadsToday = 0;
      this.simplePostsToday = 0;
      this.lastResetDate = today;
      console.log('🔄 DAILY_RESET: Counters reset for new day');
    }
  }
}
