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
   * Determine what to post based on real-time data
   */
  async getNextPostingOpportunity(): Promise<PostingOpportunity | null> {
    console.log('🧠 ADAPTIVE_POSTING: Analyzing posting opportunity...');
    
    // Reset daily counters
    this.resetDailyCounters();
    
    // Analyze current engagement window
    const engagementWindow = await this.analyzeEngagementWindow();
    
    // Get time since last posts
    const minutesSinceSimple = (Date.now() - this.lastSimplePost) / (1000 * 60);
    const minutesSinceThread = (Date.now() - this.lastThreadPost) / (1000 * 60);
    
    console.log(`📊 TIMING_DATA: Simple: ${minutesSinceSimple.toFixed(0)}min ago, Thread: ${minutesSinceThread.toFixed(0)}min ago`);
    console.log(`📊 DAILY_COUNT: Threads: ${this.threadsToday}/3, Simple: ${this.simplePostsToday}/15`);
    
    // PRIORITY 1: Thread if it's been 6+ hours and we haven't hit daily limit
    if (minutesSinceThread >= 360 && this.threadsToday < 3) {
      return {
        type: 'thread',
        urgency: 9,
        reason: 'Thread overdue (6+ hours)',
        optimal_timing: 0
      };
    }
    
    // PRIORITY 2: Simple post if engagement window is optimal
    if (engagementWindow.isOptimal && minutesSinceSimple >= 45 && this.simplePostsToday < 15) {
      return {
        type: Math.random() > 0.5 ? 'simple_fact' : 'advice',
        urgency: 8,
        reason: `Optimal engagement window (${engagementWindow.multiplier}x)`,
        optimal_timing: 0
      };
    }
    
    // PRIORITY 3: Simple post if it's been 90+ minutes
    if (minutesSinceSimple >= 90 && this.simplePostsToday < 15) {
      return {
        type: Math.random() > 0.5 ? 'simple_fact' : 'advice',
        urgency: 6,
        reason: 'Simple post overdue (90+ minutes)',
        optimal_timing: 0
      };
    }
    
    // PRIORITY 4: Thread if it's been 4+ hours (even if not optimal)
    if (minutesSinceThread >= 240 && this.threadsToday < 3) {
      return {
        type: 'thread',
        urgency: 7,
        reason: 'Thread needed (4+ hours)',
        optimal_timing: engagementWindow.isOptimal ? 0 : 30
      };
    }
    
    // PRIORITY 5: Wait for better opportunity
    console.log('⏰ ADAPTIVE_POSTING: No urgent posting opportunity, waiting...');
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
   * Record that we posted something
   */
  recordPost(type: 'simple_fact' | 'advice' | 'thread'): void {
    const now = Date.now();
    
    if (type === 'thread') {
      this.lastThreadPost = now;
      this.threadsToday++;
      console.log(`📊 RECORDED: Thread posted (${this.threadsToday}/3 today)`);
    } else {
      this.lastSimplePost = now;
      this.simplePostsToday++;
      console.log(`📊 RECORDED: ${type} posted (${this.simplePostsToday}/15 today)`);
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
