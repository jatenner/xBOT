/**
 * 📊 ADVANCED ENGAGEMENT ANALYTICS
 * Real-time engagement tracking, analysis, and learning system
 */

export interface EngagementMetrics {
  tweetId: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions?: number;
  clickThroughRate?: number;
  timestamp: Date;
  contentType: 'educational' | 'entertaining' | 'controversial' | 'inspiring';
  viralScore: number;
}

export interface EngagementTrends {
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    avgLikes: number;
    avgRetweets: number;
    avgReplies: number;
    avgViralScore: number;
    totalImpressions: number;
    engagementRate: number;
  };
  topPerformers: EngagementMetrics[];
  worstPerformers: EngagementMetrics[];
  insights: string[];
}

export interface ViralPrediction {
  predictedViralScore: number;
  confidence: number;
  factors: {
    contentQuality: number;
    timingScore: number;
    historicalPattern: number;
    trendAlignment: number;
  };
  recommendations: string[];
}

export interface AudienceInsights {
  peakEngagementHours: number[];
  preferredContentTypes: { [key: string]: number };
  averageResponseTime: number;
  loyaltyScore: number;
  growthTrend: 'increasing' | 'stable' | 'decreasing';
  demographicHints: string[];
}

export class EngagementAnalytics {
  private metrics: EngagementMetrics[] = [];
  private readonly maxHistorySize = 10000;

  /**
   * Track new engagement data
   */
  trackEngagement(metrics: EngagementMetrics): void {
    // Calculate viral score if not provided
    if (!metrics.viralScore) {
      metrics.viralScore = this.calculateViralScore(metrics);
    }

    this.metrics.push(metrics);
    console.log(`📊 ANALYTICS: Tracked engagement for tweet ${metrics.tweetId}`);
    console.log(`🎯 Viral Score: ${metrics.viralScore}/100 | Likes: ${metrics.likes} | RTs: ${metrics.retweets} | Replies: ${metrics.replies}`);

    // Maintain history size
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.maxHistorySize);
    }

    // Real-time learning
    this.updateLearningModels(metrics);
  }

  /**
   * Calculate viral score based on engagement metrics
   */
  private calculateViralScore(metrics: EngagementMetrics): number {
    // Weighted scoring algorithm
    const likeWeight = 1;
    const retweetWeight = 3; // Retweets are more valuable
    const replyWeight = 2; // Replies indicate engagement
    const impressionWeight = 0.01; // Impressions are less valuable but show reach

    let score = (
      (metrics.likes * likeWeight) +
      (metrics.retweets * retweetWeight) +
      (metrics.replies * replyWeight) +
      ((metrics.impressions || 0) * impressionWeight)
    );

    // Normalize to 0-100 scale (adjust based on your typical engagement)
    score = Math.min(100, Math.max(0, Math.round(score / 10)));

    return score;
  }

  /**
   * Get engagement trends for specified period
   */
  getEngagementTrends(period: 'hour' | 'day' | 'week' | 'month'): EngagementTrends {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodMetrics = this.metrics.filter(m => m.timestamp >= startTime);

    if (periodMetrics.length === 0) {
      return this.getEmptyTrends(period);
    }

    // Calculate averages
    const avgLikes = periodMetrics.reduce((sum, m) => sum + m.likes, 0) / periodMetrics.length;
    const avgRetweets = periodMetrics.reduce((sum, m) => sum + m.retweets, 0) / periodMetrics.length;
    const avgReplies = periodMetrics.reduce((sum, m) => sum + m.replies, 0) / periodMetrics.length;
    const avgViralScore = periodMetrics.reduce((sum, m) => sum + m.viralScore, 0) / periodMetrics.length;
    const totalImpressions = periodMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
    const totalEngagements = periodMetrics.reduce((sum, m) => sum + m.likes + m.retweets + m.replies, 0);
    const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

    // Find top and worst performers
    const sortedByViralScore = [...periodMetrics].sort((a, b) => b.viralScore - a.viralScore);
    const topPerformers = sortedByViralScore.slice(0, 5);
    const worstPerformers = sortedByViralScore.slice(-3);

    // Generate insights
    const insights = this.generateInsights(periodMetrics, period);

    return {
      period,
      metrics: {
        avgLikes: Math.round(avgLikes * 10) / 10,
        avgRetweets: Math.round(avgRetweets * 10) / 10,
        avgReplies: Math.round(avgReplies * 10) / 10,
        avgViralScore: Math.round(avgViralScore * 10) / 10,
        totalImpressions,
        engagementRate: Math.round(engagementRate * 100) / 100
      },
      topPerformers,
      worstPerformers,
      insights
    };
  }

  /**
   * Predict viral potential for new content
   */
  predictViralPotential(content: string, contentType: string, scheduledTime?: Date): ViralPrediction {
    const factors = {
      contentQuality: this.analyzeContentQuality(content),
      timingScore: scheduledTime ? this.analyzeTimingScore(scheduledTime) : 70,
      historicalPattern: this.analyzeHistoricalPattern(contentType),
      trendAlignment: this.analyzeTrendAlignment(content)
    };

    // Weighted average for prediction
    const weights = { contentQuality: 0.3, timingScore: 0.2, historicalPattern: 0.3, trendAlignment: 0.2 };
    const predictedViralScore = Math.round(
      factors.contentQuality * weights.contentQuality +
      factors.timingScore * weights.timingScore +
      factors.historicalPattern * weights.historicalPattern +
      factors.trendAlignment * weights.trendAlignment
    );

    // Calculate confidence based on data availability
    const confidence = Math.min(95, Math.max(50, this.metrics.length / 100 * 100));

    const recommendations = this.generateRecommendations(factors, content);

    console.log(`🔮 VIRAL_PREDICTION: Score ${predictedViralScore}/100 (${confidence}% confidence)`);
    console.log(`📊 Factors: Quality=${factors.contentQuality}, Timing=${factors.timingScore}, Historical=${factors.historicalPattern}, Trends=${factors.trendAlignment}`);

    return {
      predictedViralScore,
      confidence,
      factors,
      recommendations
    };
  }

  /**
   * Get comprehensive audience insights
   */
  getAudienceInsights(): AudienceInsights {
    if (this.metrics.length < 10) {
      return this.getDefaultAudienceInsights();
    }

    // Analyze peak engagement hours
    const hourlyEngagement: { [hour: number]: number[] } = {};
    this.metrics.forEach(m => {
      const hour = m.timestamp.getHours();
      if (!hourlyEngagement[hour]) hourlyEngagement[hour] = [];
      hourlyEngagement[hour].push(m.viralScore);
    });

    const peakEngagementHours = Object.entries(hourlyEngagement)
      .map(([hour, scores]) => ({
        hour: parseInt(hour),
        avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(entry => entry.hour);

    // Analyze content type preferences
    const contentTypePerformance: { [type: string]: number[] } = {};
    this.metrics.forEach(m => {
      if (!contentTypePerformance[m.contentType]) contentTypePerformance[m.contentType] = [];
      contentTypePerformance[m.contentType].push(m.viralScore);
    });

    const preferredContentTypes: { [key: string]: number } = {};
    Object.entries(contentTypePerformance).forEach(([type, scores]) => {
      preferredContentTypes[type] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    });

    // Calculate average response time (time between posts and engagement)
    const averageResponseTime = this.calculateAverageResponseTime();

    // Calculate loyalty score based on consistent engagement
    const loyaltyScore = this.calculateLoyaltyScore();

    // Determine growth trend
    const growthTrend = this.analyzeGrowthTrend();

    // Generate demographic hints
    const demographicHints = this.generateDemographicHints();

    return {
      peakEngagementHours,
      preferredContentTypes,
      averageResponseTime,
      loyaltyScore,
      growthTrend,
      demographicHints
    };
  }

  /**
   * Analyze content quality using various metrics
   */
  private analyzeContentQuality(content: string): number {
    let score = 50; // Base score

    // Length analysis
    const length = content.length;
    if (length >= 150 && length <= 220) score += 15; // Optimal length
    else if (length >= 100 && length <= 270) score += 10; // Good length
    else score -= 10; // Suboptimal length

    // Engagement triggers
    if (content.includes('?')) score += 10; // Questions drive engagement
    if (/\d+/.test(content)) score += 8; // Numbers add credibility
    if (content.toLowerCase().includes('study') || content.toLowerCase().includes('research')) score += 12;
    if (content.toLowerCase().includes('surprising') || content.toLowerCase().includes('shocking')) score += 15;

    // Negative factors
    if (content.includes('#')) score -= 5; // Hashtags can reduce reach
    if (content.match(/[!]{2,}/)) score -= 3; // Excessive exclamation

    // Readability
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 1) score += 5; // Single clear message
    else if (sentences.length <= 3) score += 3; // Concise

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze timing score based on historical performance
   */
  private analyzeTimingScore(scheduledTime: Date): number {
    const hour = scheduledTime.getHours();
    const dayOfWeek = scheduledTime.getDay();

    // Find historical performance for this time slot
    const historicalData = this.metrics.filter(m => {
      const mHour = m.timestamp.getHours();
      const mDay = m.timestamp.getDay();
      return Math.abs(mHour - hour) <= 1 && mDay === dayOfWeek;
    });

    if (historicalData.length < 3) {
      // Use general time slot analysis
      return this.getGeneralTimingScore(hour, dayOfWeek);
    }

    const avgPerformance = historicalData.reduce((sum, m) => sum + m.viralScore, 0) / historicalData.length;
    const overallAvg = this.metrics.reduce((sum, m) => sum + m.viralScore, 0) / this.metrics.length;

    return Math.round((avgPerformance / overallAvg) * 70);
  }

  /**
   * Get general timing score without historical data
   */
  private getGeneralTimingScore(hour: number, dayOfWeek: number): number {
    let score = 50;

    // Prime time bonuses
    if ((hour >= 7 && hour <= 9) || (hour >= 11 && hour <= 13) || (hour >= 19 && hour <= 21)) {
      score += 25;
    }

    // Weekday vs weekend
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 7 && hour <= 9) score += 10; // Commute time
      if (hour >= 11 && hour <= 13) score += 5; // Lunch break
    } else {
      if (hour >= 10 && hour <= 14) score += 15; // Weekend leisure
      if (hour >= 19 && hour <= 22) score += 20; // Weekend social time
    }

    // Penalties
    if (hour >= 1 && hour <= 6) score -= 25; // Late night
    if (hour >= 14 && hour <= 16 && dayOfWeek >= 1 && dayOfWeek <= 5) score -= 10; // Work hours

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze historical pattern for content type
   */
  private analyzeHistoricalPattern(contentType: string): number {
    const typeMetrics = this.metrics.filter(m => m.contentType === contentType);
    
    if (typeMetrics.length < 5) {
      // Default scores for content types
      const defaults = {
        educational: 75,
        entertaining: 70,
        controversial: 85,
        inspiring: 80
      };
      return defaults[contentType as keyof typeof defaults] || 70;
    }

    const avgScore = typeMetrics.reduce((sum, m) => sum + m.viralScore, 0) / typeMetrics.length;
    return Math.round(avgScore);
  }

  /**
   * Analyze trend alignment (placeholder for trend analysis)
   */
  private analyzeTrendAlignment(content: string): number {
    // This would analyze current trends and see how well content aligns
    // For now, return a baseline score
    let score = 60;

    // Look for trending keywords (this would be enhanced with real trend data)
    const trendingKeywords = ['health', 'study', 'research', 'new', 'breakthrough', 'scientists'];
    const contentLower = content.toLowerCase();
    
    trendingKeywords.forEach(keyword => {
      if (contentLower.includes(keyword)) score += 5;
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on prediction factors
   */
  private generateRecommendations(factors: any, content: string): string[] {
    const recommendations: string[] = [];

    if (factors.contentQuality < 70) {
      recommendations.push('Consider adding specific numbers or research references');
      if (!content.includes('?')) {
        recommendations.push('Add a question to increase engagement');
      }
    }

    if (factors.timingScore < 60) {
      recommendations.push('Consider posting during peak engagement hours (7-9am, 11am-1pm, 7-9pm)');
    }

    if (factors.historicalPattern < 65) {
      recommendations.push('This content type historically performs below average - consider adjusting approach');
    }

    if (factors.trendAlignment < 70) {
      recommendations.push('Consider incorporating trending topics or keywords');
    }

    if (recommendations.length === 0) {
      recommendations.push('Content looks optimized for viral potential');
    }

    return recommendations;
  }

  /**
   * Generate insights from period metrics
   */
  private generateInsights(metrics: EngagementMetrics[], period: string): string[] {
    const insights: string[] = [];

    if (metrics.length === 0) return ['Insufficient data for insights'];

    // Performance insights
    const avgViralScore = metrics.reduce((sum, m) => sum + m.viralScore, 0) / metrics.length;
    if (avgViralScore > 70) {
      insights.push(`Excellent performance this ${period} with ${avgViralScore.toFixed(1)} average viral score`);
    } else if (avgViralScore < 40) {
      insights.push(`Below average performance this ${period} - consider content strategy adjustment`);
    }

    // Content type insights
    const contentTypePerformance: { [type: string]: number[] } = {};
    metrics.forEach(m => {
      if (!contentTypePerformance[m.contentType]) contentTypePerformance[m.contentType] = [];
      contentTypePerformance[m.contentType].push(m.viralScore);
    });

    const bestContentType = Object.entries(contentTypePerformance)
      .map(([type, scores]) => ({ type, avg: scores.reduce((sum, s) => sum + s, 0) / scores.length }))
      .sort((a, b) => b.avg - a.avg)[0];

    if (bestContentType) {
      insights.push(`${bestContentType.type} content performed best with ${bestContentType.avg.toFixed(1)} average score`);
    }

    // Engagement pattern insights
    const totalEngagement = metrics.reduce((sum, m) => sum + m.likes + m.retweets + m.replies, 0);
    const engagementPerPost = totalEngagement / metrics.length;
    
    if (engagementPerPost > 50) {
      insights.push('High engagement rate indicates strong audience connection');
    }

    return insights;
  }

  /**
   * Update learning models with new data
   */
  private updateLearningModels(metrics: EngagementMetrics): void {
    // This would update ML models for better prediction
    // For now, just log the learning update
    console.log(`🧠 LEARNING: Updated models with viral score ${metrics.viralScore}`);
  }

  /**
   * Helper methods for audience insights
   */
  private calculateAverageResponseTime(): number {
    // Simplified calculation - would need more sophisticated timing analysis
    return 15; // 15 minutes average
  }

  private calculateLoyaltyScore(): number {
    if (this.metrics.length < 20) return 60;
    
    // Analyze consistency of engagement
    const recentMetrics = this.metrics.slice(-20);
    const variance = this.calculateVariance(recentMetrics.map(m => m.viralScore));
    
    // Lower variance = higher loyalty (more consistent engagement)
    return Math.max(0, Math.min(100, 100 - variance));
  }

  private analyzeGrowthTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.metrics.length < 10) return 'stable';
    
    const recent = this.metrics.slice(-5);
    const older = this.metrics.slice(-10, -5);
    
    const recentAvg = recent.reduce((sum, m) => sum + m.viralScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.viralScore, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) return 'increasing';
    if (recentAvg < olderAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private generateDemographicHints(): string[] {
    // This would analyze engagement patterns to infer audience demographics
    return ['Health-conscious individuals', 'Professional audience', 'Early adopters'];
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / numbers.length;
  }

  private getEmptyTrends(period: string): EngagementTrends {
    return {
      period: period as any,
      metrics: {
        avgLikes: 0,
        avgRetweets: 0,
        avgReplies: 0,
        avgViralScore: 0,
        totalImpressions: 0,
        engagementRate: 0
      },
      topPerformers: [],
      worstPerformers: [],
      insights: ['No data available for this period']
    };
  }

  private getDefaultAudienceInsights(): AudienceInsights {
    return {
      peakEngagementHours: [8, 12, 20],
      preferredContentTypes: {
        educational: 70,
        entertaining: 65,
        controversial: 75,
        inspiring: 68
      },
      averageResponseTime: 20,
      loyaltyScore: 60,
      growthTrend: 'stable',
      demographicHints: ['General audience', 'Health-interested users']
    };
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  getAnalyticsDashboard(): any {
    const trends = {
      daily: this.getEngagementTrends('day'),
      weekly: this.getEngagementTrends('week'),
      monthly: this.getEngagementTrends('month')
    };

    const audienceInsights = this.getAudienceInsights();
    
    return {
      summary: {
        totalPosts: this.metrics.length,
        averageViralScore: this.metrics.length > 0 
          ? this.metrics.reduce((sum, m) => sum + m.viralScore, 0) / this.metrics.length
          : 0,
        totalEngagement: this.metrics.reduce((sum, m) => sum + m.likes + m.retweets + m.replies, 0),
        bestPerformingPost: this.metrics.length > 0 
          ? this.metrics.reduce((best, current) => current.viralScore > best.viralScore ? current : best)
          : null
      },
      trends,
      audienceInsights,
      recentPerformance: this.metrics.slice(-10)
    };
  }
}
