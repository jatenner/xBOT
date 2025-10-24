/**
 * 📊 ENGAGEMENT METRICS & REWARDS
 * 
 * PURPOSE: Calculate engagement rates and bandit rewards
 * STRATEGY: Dynamic thresholds based on historical performance
 */

export interface TweetMetrics {
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  views?: number;
  quotes?: number;
}

export interface EngagementAnalysis {
  engagementRate: number;
  totalEngagement: number;
  impressions: number;
  engagementVelocity: number; // Engagement per hour since posting
  performanceTier: 'low' | 'medium' | 'high' | 'viral';
  reward: number; // 0 or 1 for bandit
  confidence: number; // 0-1 confidence in metrics
}

export interface HistoricalBaseline {
  medianEngagementRate: number;
  p75EngagementRate: number;
  p90EngagementRate: number;
  totalTweets: number;
  lastUpdated: Date;
}

/**
 * Metrics calculator and reward generator
 */
export class EngagementMetricsCalculator {
  // REALISTIC THRESHOLDS (for account with ~2,800 followers)
  // USER REQUIREMENT: Nothing is viral until 1,000 views + 100 likes
  private readonly VIRAL_THRESHOLD = 0.10; // 10% ER (100 likes / 1000 views)
  private readonly VIRAL_MIN_VIEWS = 1000;
  private readonly VIRAL_MIN_LIKES = 100;
  
  private readonly HIGH_THRESHOLD = 0.10;  // 10% ER (50 likes / 500 views)
  private readonly HIGH_MIN_VIEWS = 500;
  private readonly HIGH_MIN_LIKES = 50;
  
  private readonly MEDIUM_THRESHOLD = 0.10; // 10% ER (20 likes / 200 views)
  private readonly MEDIUM_MIN_VIEWS = 200;
  private readonly MEDIUM_MIN_LIKES = 20;
  
  // Minimum threshold to learn from (filters noise)
  private readonly LEARNING_MIN_VIEWS = 100;
  private readonly LEARNING_MIN_LIKES = 5;

  /**
   * Calculate basic engagement rate
   */
  calculateEngagementRate(metrics: TweetMetrics): number {
    if (metrics.impressions <= 0) {
      return 0;
    }

    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies + 
                           (metrics.bookmarks || 0) + (metrics.quotes || 0);
    
    return totalEngagement / metrics.impressions;
  }

  /**
   * Calculate engagement velocity (engagement per hour)
   */
  calculateEngagementVelocity(metrics: TweetMetrics, hoursAgo: number): number {
    if (hoursAgo <= 0) {
      return 0;
    }

    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies + 
                           (metrics.bookmarks || 0) + (metrics.quotes || 0);
    
    return totalEngagement / hoursAgo;
  }

  /**
   * Determine performance tier
   */
  determinePerformanceTier(engagementRate: number): 'low' | 'medium' | 'high' | 'viral' {
    if (engagementRate >= this.VIRAL_THRESHOLD) {
      return 'viral';
    } else if (engagementRate >= this.HIGH_THRESHOLD) {
      return 'high';
    } else if (engagementRate >= this.MEDIUM_THRESHOLD) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate confidence in metrics based on impressions and time
   */
  calculateConfidence(metrics: TweetMetrics, hoursAgo: number): number {
    let confidence = 0;

    // Confidence increases with impressions
    if (metrics.impressions >= 1000) {
      confidence += 0.4;
    } else if (metrics.impressions >= 500) {
      confidence += 0.3;
    } else if (metrics.impressions >= 100) {
      confidence += 0.2;
    } else if (metrics.impressions >= 50) {
      confidence += 0.1;
    }

    // Confidence increases with time (more opportunity for engagement)
    if (hoursAgo >= 24) {
      confidence += 0.4;
    } else if (hoursAgo >= 6) {
      confidence += 0.3;
    } else if (hoursAgo >= 2) {
      confidence += 0.2;
    } else if (hoursAgo >= 1) {
      confidence += 0.1;
    }

    // Confidence increases with any engagement
    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies + 
                           (metrics.bookmarks || 0);
    if (totalEngagement > 0) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Analyze tweet performance
   */
  analyzePerformance(
    metrics: TweetMetrics, 
    hoursAgo: number,
    baseline?: HistoricalBaseline
  ): EngagementAnalysis {
    const engagementRate = this.calculateEngagementRate(metrics);
    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies + 
                           (metrics.bookmarks || 0) + (metrics.quotes || 0);
    const engagementVelocity = this.calculateEngagementVelocity(metrics, hoursAgo);
    const performanceTier = this.determinePerformanceTier(engagementRate);
    const confidence = this.calculateConfidence(metrics, hoursAgo);

    // Calculate reward based on baseline or fixed thresholds
    let reward = 0;
    
    if (baseline) {
      // Use dynamic threshold based on historical median
      reward = engagementRate >= baseline.medianEngagementRate ? 1 : 0;
    } else {
      // Use fixed threshold (medium performance or better)
      reward = engagementRate >= this.MEDIUM_THRESHOLD ? 1 : 0;
    }

    return {
      engagementRate,
      totalEngagement,
      impressions: metrics.impressions,
      engagementVelocity,
      performanceTier,
      reward,
      confidence
    };
  }

  /**
   * Generate reward with context for bandit learning
   */
  generateRewardWithContext(
    metrics: TweetMetrics,
    hoursAgo: number,
    tweetData: {
      topic: string;
      tags: string[];
      hour: number;
      length: number;
      hasMedia: boolean;
    },
    baseline?: HistoricalBaseline
  ): {
    reward: number;
    confidence: number;
    context: Record<string, any>;
    analysis: EngagementAnalysis;
  } {
    const analysis = this.analyzePerformance(metrics, hoursAgo, baseline);
    
    const context = {
      engagementRate: analysis.engagementRate,
      performanceTier: analysis.performanceTier,
      impressions: metrics.impressions,
      hoursAgo,
      topic: tweetData.topic,
      hour: tweetData.hour,
      hasMedia: tweetData.hasMedia,
      length: tweetData.length,
      tagCount: tweetData.tags.length,
      velocity: analysis.engagementVelocity
    };

    return {
      reward: analysis.reward,
      confidence: analysis.confidence,
      context,
      analysis
    };
  }

  /**
   * Calculate historical baseline from tweet data
   */
  calculateBaseline(historicalMetrics: Array<{
    engagementRate: number;
    impressions: number;
    timestamp: Date;
  }>): HistoricalBaseline {
    if (historicalMetrics.length === 0) {
      return {
        medianEngagementRate: this.MEDIUM_THRESHOLD,
        p75EngagementRate: this.HIGH_THRESHOLD,
        p90EngagementRate: this.VIRAL_THRESHOLD,
        totalTweets: 0,
        lastUpdated: new Date()
      };
    }

    // Sort by engagement rate
    const sortedRates = historicalMetrics
      .map(m => m.engagementRate)
      .sort((a, b) => a - b);

    const medianIndex = Math.floor(sortedRates.length / 2);
    const p75Index = Math.floor(sortedRates.length * 0.75);
    const p90Index = Math.floor(sortedRates.length * 0.90);

    return {
      medianEngagementRate: sortedRates[medianIndex] || this.MEDIUM_THRESHOLD,
      p75EngagementRate: sortedRates[p75Index] || this.HIGH_THRESHOLD,
      p90EngagementRate: sortedRates[p90Index] || this.VIRAL_THRESHOLD,
      totalTweets: historicalMetrics.length,
      lastUpdated: new Date()
    };
  }

  /**
   * Check if metrics are sufficient for analysis
   */
  hasSufficientData(metrics: TweetMetrics, hoursAgo: number): boolean {
    // Need at least some impressions and reasonable time
    return metrics.impressions >= 10 && hoursAgo >= 0.5; // 30 minutes minimum
  }

  /**
   * Get engagement insights
   */
  getEngagementInsights(analysis: EngagementAnalysis): string[] {
    const insights: string[] = [];

    if (analysis.performanceTier === 'viral') {
      insights.push('🔥 Viral performance - engagement rate > 15%');
    } else if (analysis.performanceTier === 'high') {
      insights.push('🚀 High engagement - rate > 8%');
    } else if (analysis.performanceTier === 'medium') {
      insights.push('📈 Decent engagement - rate > 3%');
    } else {
      insights.push('📉 Low engagement - needs improvement');
    }

    if (analysis.engagementVelocity > 10) {
      insights.push('⚡ High velocity - strong early engagement');
    }

    if (analysis.confidence < 0.3) {
      insights.push('⚠️  Low confidence - limited data');
    }

    if (analysis.impressions < 100) {
      insights.push('👁️  Low reach - consider timing/hashtags');
    }

    return insights;
  }

  /**
   * Compare performance against baseline
   */
  compareToBaseline(
    analysis: EngagementAnalysis, 
    baseline: HistoricalBaseline
  ): {
    vsMedian: number; // Multiple of median
    vsP75: number;    // Multiple of P75
    vsP90: number;    // Multiple of P90
    ranking: 'bottom' | 'below_median' | 'above_median' | 'top_25' | 'top_10';
  } {
    const vsMedian = analysis.engagementRate / baseline.medianEngagementRate;
    const vsP75 = analysis.engagementRate / baseline.p75EngagementRate;
    const vsP90 = analysis.engagementRate / baseline.p90EngagementRate;

    let ranking: 'bottom' | 'below_median' | 'above_median' | 'top_25' | 'top_10';
    
    if (analysis.engagementRate >= baseline.p90EngagementRate) {
      ranking = 'top_10';
    } else if (analysis.engagementRate >= baseline.p75EngagementRate) {
      ranking = 'top_25';
    } else if (analysis.engagementRate >= baseline.medianEngagementRate) {
      ranking = 'above_median';
    } else if (analysis.engagementRate >= baseline.medianEngagementRate * 0.5) {
      ranking = 'below_median';
    } else {
      ranking = 'bottom';
    }

    return { vsMedian, vsP75, vsP90, ranking };
  }
}