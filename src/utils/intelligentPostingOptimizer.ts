/**
 * 🎯 INTELLIGENT POSTING OPTIMIZER
 * Optimizes posting frequency and timing based on engagement data
 * Maximum 100 tweets/day → Find optimal 10-15 posts for maximum impact
 */

export interface PostingStrategy {
  recommendedDailyPosts: number;
  optimalIntervals: number[]; // Hours of the day
  confidenceScore: number;
  reasoning: string[];
  engagementPrediction: number;
}

export interface EngagementWindow {
  hour: number;
  dayOfWeek: number;
  avgEngagement: number;
  followerGrowth: number;
  postCount: number;
  efficiency: number; // engagement per post
}

/**
 * 🧠 INTELLIGENT POSTING FREQUENCY OPTIMIZER
 */
export class IntelligentPostingOptimizer {
  
  /**
   * 🎯 CALCULATE OPTIMAL POSTING FREQUENCY
   */
  static async calculateOptimalFrequency(
    recentEngagementData: any[],
    followerGrowthData: any[]
  ): Promise<PostingStrategy> {
    
    // Analyze current performance patterns
    const performanceAnalysis = this.analyzeCurrentPerformance(recentEngagementData);
    
    // Find diminishing returns threshold
    const optimalFrequency = this.findOptimalFrequency(performanceAnalysis);
    
    // Identify best time windows
    const optimalWindows = this.identifyOptimalWindows(recentEngagementData);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(recentEngagementData.length, performanceAnalysis);
    
    return {
      recommendedDailyPosts: optimalFrequency,
      optimalIntervals: optimalWindows,
      confidenceScore: confidence,
      reasoning: this.generateReasoning(performanceAnalysis, optimalFrequency),
      engagementPrediction: this.predictEngagement(optimalFrequency, optimalWindows)
    };
  }
  
  /**
   * 📊 ANALYZE CURRENT PERFORMANCE
   */
  private static analyzeCurrentPerformance(engagementData: any[]): any {
    if (engagementData.length === 0) {
      return {
        avgEngagementPerPost: 0,
        totalPosts: 0,
        postsPerDay: 0,
        engagementDecline: false,
        oversaturation: false
      };
    }
    
    // Group by day to analyze daily patterns
    const dailyStats = new Map<string, { posts: number; totalEngagement: number }>();
    
    engagementData.forEach(post => {
      const day = new Date(post.created_at).toDateString();
      if (!dailyStats.has(day)) {
        dailyStats.set(day, { posts: 0, totalEngagement: 0 });
      }
      const dayStats = dailyStats.get(day)!;
      dayStats.posts++;
      dayStats.totalEngagement += (post.likes || 0) + (post.retweets || 0) + (post.replies || 0);
    });
    
    // Calculate metrics
    const dailyData = Array.from(dailyStats.values());
    const avgPostsPerDay = dailyData.reduce((sum, day) => sum + day.posts, 0) / dailyData.length;
    const avgEngagementPerPost = dailyData.reduce((sum, day) => sum + day.totalEngagement, 0) / 
                                 dailyData.reduce((sum, day) => sum + day.posts, 0);
    
    // Detect oversaturation (engagement dropping with more posts)
    const oversaturation = this.detectOversaturation(dailyData);
    
    return {
      avgEngagementPerPost,
      totalPosts: engagementData.length,
      postsPerDay: avgPostsPerDay,
      engagementDecline: avgEngagementPerPost < 10, // Threshold for concern
      oversaturation,
      dailyEfficiency: dailyData.map(day => day.totalEngagement / day.posts)
    };
  }
  
  /**
   * 🎯 FIND OPTIMAL FREQUENCY - Sweet spot between reach and oversaturation
   */
  private static findOptimalFrequency(performanceAnalysis: any): number {
    const { postsPerDay, oversaturation, avgEngagementPerPost, dailyEfficiency } = performanceAnalysis;
    
    // If we have good data and detect oversaturation, reduce frequency
    if (oversaturation && postsPerDay > 15) {
      return Math.max(10, Math.floor(postsPerDay * 0.7)); // Reduce by 30%
    }
    
    // If engagement is very low, we might be posting too frequently
    if (avgEngagementPerPost < 5 && postsPerDay > 20) {
      return Math.max(8, Math.floor(postsPerDay * 0.5)); // Reduce by 50%
    }
    
    // If engagement is good and no oversaturation, we can maintain or increase slightly
    if (avgEngagementPerPost > 20 && !oversaturation && postsPerDay < 15) {
      return Math.min(18, postsPerDay + 3); // Increase moderately
    }
    
    // Default conservative approach: Focus on quality over quantity
    if (postsPerDay > 25) {
      return 12; // Conservative quality-focused approach
    }
    
    // If posting very little, gradually increase
    if (postsPerDay < 5) {
      return 8;
    }
    
    // Default range: 10-15 posts for optimal engagement
    return Math.max(10, Math.min(15, Math.round(postsPerDay)));
  }
  
  /**
   * ⏰ IDENTIFY OPTIMAL WINDOWS - Best times to post
   */
  private static identifyOptimalWindows(engagementData: any[]): number[] {
    if (engagementData.length === 0) {
      // Default optimal times for health content
      return [7, 12, 17, 20]; // Morning, lunch, evening, night
    }
    
    // Analyze engagement by hour
    const hourlyStats = new Map<number, { posts: number; totalEngagement: number }>();
    
    engagementData.forEach(post => {
      const hour = new Date(post.created_at).getHours();
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { posts: 0, totalEngagement: 0 });
      }
      const hourStats = hourlyStats.get(hour)!;
      hourStats.posts++;
      hourStats.totalEngagement += (post.likes || 0) + (post.retweets || 0) + (post.replies || 0);
    });
    
    // Calculate efficiency per hour
    const hourlyEfficiency = Array.from(hourlyStats.entries())
      .map(([hour, stats]) => ({
        hour,
        efficiency: stats.totalEngagement / stats.posts,
        posts: stats.posts
      }))
      .filter(h => h.posts >= 2) // Only consider hours with sufficient data
      .sort((a, b) => b.efficiency - a.efficiency);
    
    // Return top 4-6 hours
    const topHours = hourlyEfficiency.slice(0, 6).map(h => h.hour);
    
    // Ensure we have some defaults if data is insufficient
    if (topHours.length < 4) {
      return [7, 12, 17, 20];
    }
    
    return topHours.sort((a, b) => a - b);
  }
  
  /**
   * 🔍 DETECT OVERSATURATION - Are we posting too much?
   */
  private static detectOversaturation(dailyData: any[]): boolean {
    if (dailyData.length < 3) return false;
    
    // Check if engagement per post decreases as post count increases
    const correlationData = dailyData
      .filter(day => day.posts > 0)
      .map(day => ({
        posts: day.posts,
        engagementPerPost: day.totalEngagement / day.posts
      }));
    
    if (correlationData.length < 3) return false;
    
    // Simple correlation calculation
    const avgPosts = correlationData.reduce((sum, d) => sum + d.posts, 0) / correlationData.length;
    const avgEngagement = correlationData.reduce((sum, d) => sum + d.engagementPerPost, 0) / correlationData.length;
    
    let correlation = 0;
    let numerator = 0;
    let denomPosts = 0;
    let denomEngagement = 0;
    
    correlationData.forEach(d => {
      const postsDiff = d.posts - avgPosts;
      const engagementDiff = d.engagementPerPost - avgEngagement;
      numerator += postsDiff * engagementDiff;
      denomPosts += postsDiff * postsDiff;
      denomEngagement += engagementDiff * engagementDiff;
    });
    
    if (denomPosts > 0 && denomEngagement > 0) {
      correlation = numerator / Math.sqrt(denomPosts * denomEngagement);
    }
    
    // Negative correlation suggests oversaturation
    return correlation < -0.3;
  }
  
  /**
   * 🎯 CALCULATE CONFIDENCE - How confident are we in our recommendations?
   */
  private static calculateConfidence(dataPoints: number, performanceAnalysis: any): number {
    let confidence = 0;
    
    // Base confidence on data quantity
    if (dataPoints >= 50) confidence += 40;
    else if (dataPoints >= 20) confidence += 25;
    else if (dataPoints >= 10) confidence += 15;
    else confidence += 5;
    
    // Add confidence based on clear patterns
    if (performanceAnalysis.oversaturation) confidence += 20;
    if (performanceAnalysis.avgEngagementPerPost > 15) confidence += 15;
    if (performanceAnalysis.postsPerDay > 5) confidence += 10;
    
    // Add confidence based on consistency
    if (performanceAnalysis.dailyEfficiency) {
      const variance = this.calculateVariance(performanceAnalysis.dailyEfficiency);
      if (variance < 50) confidence += 15; // Low variance = consistent performance
    }
    
    return Math.min(100, confidence);
  }
  
  /**
   * 📝 GENERATE REASONING - Explain the recommendation
   */
  private static generateReasoning(performanceAnalysis: any, optimalFrequency: number): string[] {
    const reasoning: string[] = [];
    
    if (performanceAnalysis.oversaturation) {
      reasoning.push(`Detected oversaturation: reducing from ${Math.round(performanceAnalysis.postsPerDay)} to ${optimalFrequency} posts/day`);
    }
    
    if (performanceAnalysis.avgEngagementPerPost < 10) {
      reasoning.push(`Low engagement per post (${Math.round(performanceAnalysis.avgEngagementPerPost)}) suggests focusing on quality over quantity`);
    }
    
    if (optimalFrequency <= 15) {
      reasoning.push(`Quality-focused strategy: ${optimalFrequency} high-impact posts > many low-engagement posts`);
    }
    
    reasoning.push(`Target: ${optimalFrequency} posts/day for maximum follower growth and engagement`);
    
    return reasoning;
  }
  
  /**
   * 📈 PREDICT ENGAGEMENT - Estimate engagement with new strategy
   */
  private static predictEngagement(optimalFrequency: number, optimalWindows: number[]): number {
    // Base prediction on optimal frequency and timing
    let prediction = 15; // Base engagement rate
    
    // Quality bonus for lower frequency
    if (optimalFrequency <= 12) prediction += 10;
    else if (optimalFrequency <= 18) prediction += 5;
    
    // Timing bonus for optimal windows
    if (optimalWindows.length >= 4) prediction += 8;
    
    // Conservative cap
    return Math.min(45, prediction);
  }
  
  /**
   * 📊 CALCULATE VARIANCE - Helper for confidence calculation
   */
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
  
  /**
   * 🎯 SHOULD POST NOW - Real-time posting decision
   */
  static shouldPostNow(
    currentHour: number,
    currentDayOfWeek: number,
    postsToday: number,
    maxDailyPosts: number,
    optimalWindows: number[]
  ): { shouldPost: boolean; confidence: number; reason: string } {
    
    // Don't exceed daily limit
    if (postsToday >= maxDailyPosts) {
      return {
        shouldPost: false,
        confidence: 100,
        reason: `Daily limit reached (${postsToday}/${maxDailyPosts})`
      };
    }
    
    // Check if we're in an optimal window
    const isOptimalWindow = optimalWindows.includes(currentHour);
    
    if (!isOptimalWindow) {
      return {
        shouldPost: false,
        confidence: 70,
        reason: `Not in optimal posting window (next: ${this.getNextOptimalWindow(currentHour, optimalWindows)}:00)`
      };
    }
    
    // Calculate posting pace
    const hoursInDay = 24;
    const targetPace = maxDailyPosts / optimalWindows.length; // Posts per optimal window
    const currentPace = postsToday;
    
    if (currentPace < targetPace * (optimalWindows.filter(h => h <= currentHour).length)) {
      return {
        shouldPost: true,
        confidence: 85,
        reason: `Optimal window + behind target pace (${postsToday}/${maxDailyPosts} daily)`
      };
    }
    
    return {
      shouldPost: true,
      confidence: 65,
      reason: `Optimal window (${currentHour}:00)`
    };
  }
  
  /**
   * ⏰ GET NEXT OPTIMAL WINDOW - When should we post next?
   */
  private static getNextOptimalWindow(currentHour: number, optimalWindows: number[]): number {
    const futureWindows = optimalWindows.filter(h => h > currentHour);
    if (futureWindows.length > 0) {
      return futureWindows[0];
    }
    // If no more windows today, return first window tomorrow
    return optimalWindows[0];
  }
}