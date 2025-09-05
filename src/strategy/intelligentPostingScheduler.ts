/**
 * ⏰ INTELLIGENT POSTING SCHEDULER
 * Advanced timing optimization and frequency management
 */

export interface PostingWindow {
  startHour: number;
  endHour: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  engagementMultiplier: number;
  audience: string;
}

export interface PostingStrategy {
  optimalTimes: PostingWindow[];
  frequencyLimits: {
    maxPerHour: number;
    maxPerDay: number;
    minIntervalMinutes: number;
  };
  contentDistribution: {
    educational: number;
    entertaining: number;
    controversial: number;
    inspiring: number;
  };
}

export interface SchedulingDecision {
  shouldPost: boolean;
  recommendedTime?: Date;
  reason: string;
  confidence: number;
  alternativeWindows?: Date[];
}

export class IntelligentPostingScheduler {
  private performanceData: any[] = [];
  private lastPostTime?: Date;
  private dailyPostCount: number = 0;
  private hourlyPostCount: number = 0;

  /**
   * Determine if now is an optimal time to post
   */
  shouldPostNow(): SchedulingDecision {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    console.log(`⏰ SCHEDULER: Analyzing posting opportunity at ${hour}:${now.getMinutes().toString().padStart(2, '0')}`);

    // Check frequency limits
    const frequencyCheck = this.checkFrequencyLimits();
    if (!frequencyCheck.allowed) {
      return {
        shouldPost: false,
        reason: frequencyCheck.reason,
        confidence: 95,
        alternativeWindows: this.getNextOptimalWindows(3)
      };
    }

    // Analyze current time slot
    const timeSlotAnalysis = this.analyzeTimeSlot(hour, dayOfWeek);
    
    if (timeSlotAnalysis.score >= 80) {
      return {
        shouldPost: true,
        reason: `Optimal posting window (score: ${timeSlotAnalysis.score}/100)`,
        confidence: timeSlotAnalysis.score,
        recommendedTime: now
      };
    } else if (timeSlotAnalysis.score >= 60) {
      return {
        shouldPost: true,
        reason: `Good posting window (score: ${timeSlotAnalysis.score}/100)`,
        confidence: timeSlotAnalysis.score,
        recommendedTime: now
      };
    } else {
      const nextOptimal = this.getNextOptimalTime();
      return {
        shouldPost: false,
        reason: `Suboptimal timing (score: ${timeSlotAnalysis.score}/100)`,
        confidence: 100 - timeSlotAnalysis.score,
        recommendedTime: nextOptimal,
        alternativeWindows: this.getNextOptimalWindows(3)
      };
    }
  }

  /**
   * Get the optimal posting strategy for current conditions
   */
  getOptimalStrategy(): PostingStrategy {
    const baseStrategy: PostingStrategy = {
      optimalTimes: [
        // Morning engagement (7-9 AM)
        { startHour: 7, endHour: 9, dayOfWeek: 1, engagementMultiplier: 1.3, audience: 'professionals' },
        { startHour: 7, endHour: 9, dayOfWeek: 2, engagementMultiplier: 1.3, audience: 'professionals' },
        { startHour: 7, endHour: 9, dayOfWeek: 3, engagementMultiplier: 1.3, audience: 'professionals' },
        { startHour: 7, endHour: 9, dayOfWeek: 4, engagementMultiplier: 1.3, audience: 'professionals' },
        { startHour: 7, endHour: 9, dayOfWeek: 5, engagementMultiplier: 1.2, audience: 'professionals' },
        
        // Lunch break (11 AM - 1 PM)
        { startHour: 11, endHour: 13, dayOfWeek: 1, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 11, endHour: 13, dayOfWeek: 2, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 11, endHour: 13, dayOfWeek: 3, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 11, endHour: 13, dayOfWeek: 4, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 11, endHour: 13, dayOfWeek: 5, engagementMultiplier: 1.1, audience: 'general' },
        
        // Evening engagement (7-9 PM)
        { startHour: 19, endHour: 21, dayOfWeek: 0, engagementMultiplier: 1.4, audience: 'casual' },
        { startHour: 19, endHour: 21, dayOfWeek: 1, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 19, endHour: 21, dayOfWeek: 2, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 19, endHour: 21, dayOfWeek: 3, engagementMultiplier: 1.2, audience: 'general' },
        { startHour: 19, endHour: 21, dayOfWeek: 4, engagementMultiplier: 1.3, audience: 'general' },
        { startHour: 19, endHour: 21, dayOfWeek: 5, engagementMultiplier: 1.4, audience: 'casual' },
        { startHour: 19, endHour: 21, dayOfWeek: 6, engagementMultiplier: 1.4, audience: 'casual' },
      ],
      frequencyLimits: {
        maxPerHour: 1,
        maxPerDay: 6,
        minIntervalMinutes: 45
      },
      contentDistribution: {
        educational: 0.4,   // 40% educational content
        entertaining: 0.25, // 25% entertaining
        controversial: 0.15, // 15% controversial (engagement driver)
        inspiring: 0.2      // 20% inspiring
      }
    };

    // Adjust strategy based on performance data
    return this.optimizeStrategyFromData(baseStrategy);
  }

  /**
   * Check if posting frequency limits are respected
   */
  private checkFrequencyLimits(): { allowed: boolean; reason: string } {
    const now = new Date();
    
    // Check minimum interval
    if (this.lastPostTime) {
      const minutesSinceLastPost = (now.getTime() - this.lastPostTime.getTime()) / (1000 * 60);
      if (minutesSinceLastPost < 45) {
        return {
          allowed: false,
          reason: `Too soon since last post (${Math.round(minutesSinceLastPost)} min ago, minimum: 45 min)`
        };
      }
    }

    // Check hourly limit
    if (this.hourlyPostCount >= 1) {
      return {
        allowed: false,
        reason: `Hourly limit reached (${this.hourlyPostCount}/1)`
      };
    }

    // Check daily limit
    if (this.dailyPostCount >= 6) {
      return {
        allowed: false,
        reason: `Daily limit reached (${this.dailyPostCount}/6)`
      };
    }

    return { allowed: true, reason: 'Frequency limits OK' };
  }

  /**
   * Analyze the engagement potential of a specific time slot
   */
  private analyzeTimeSlot(hour: number, dayOfWeek: number): { score: number; factors: string[] } {
    let score = 50; // Base score
    const factors: string[] = [];

    // Prime time analysis
    if ((hour >= 7 && hour <= 9) || (hour >= 11 && hour <= 13) || (hour >= 19 && hour <= 21)) {
      score += 25;
      factors.push('Prime engagement window');
    }

    // Weekday vs weekend
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 7 && hour <= 9) {
        score += 15;
        factors.push('Weekday morning commute time');
      }
      if (hour >= 11 && hour <= 13) {
        score += 10;
        factors.push('Weekday lunch break');
      }
    } else {
      if (hour >= 10 && hour <= 12) {
        score += 20;
        factors.push('Weekend leisure time');
      }
      if (hour >= 19 && hour <= 22) {
        score += 25;
        factors.push('Weekend evening social time');
      }
    }

    // Avoid low-engagement times
    if (hour >= 1 && hour <= 6) {
      score -= 30;
      factors.push('Late night/early morning penalty');
    }
    if (hour >= 14 && hour <= 16 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      score -= 15;
      factors.push('Weekday afternoon work hours penalty');
    }

    // Performance data adjustment
    const historicalScore = this.getHistoricalPerformance(hour, dayOfWeek);
    if (historicalScore) {
      score = Math.round(score * historicalScore.multiplier);
      factors.push(`Historical data adjustment: ${historicalScore.multiplier.toFixed(2)}x`);
    }

    return { score: Math.max(0, Math.min(100, score)), factors };
  }

  /**
   * Get historical performance for a specific time slot
   */
  private getHistoricalPerformance(hour: number, dayOfWeek: number): { multiplier: number } | null {
    if (this.performanceData.length < 10) return null;

    const relevantData = this.performanceData.filter(d => {
      const postTime = new Date(d.timestamp);
      return postTime.getHours() === hour && postTime.getDay() === dayOfWeek;
    });

    if (relevantData.length < 3) return null;

    const avgEngagement = relevantData.reduce((sum, d) => sum + d.viralScore, 0) / relevantData.length;
    const overallAvg = this.performanceData.reduce((sum, d) => sum + d.viralScore, 0) / this.performanceData.length;
    
    return { multiplier: avgEngagement / overallAvg };
  }

  /**
   * Get the next optimal posting time
   */
  private getNextOptimalTime(): Date {
    const now = new Date();
    const strategy = this.getOptimalStrategy();
    
    // Find the next optimal window
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      
      const dayOfWeek = targetDate.getDay();
      const relevantWindows = strategy.optimalTimes.filter(w => w.dayOfWeek === dayOfWeek);
      
      for (const window of relevantWindows) {
        const windowStart = new Date(targetDate);
        windowStart.setHours(window.startHour, 0, 0, 0);
        
        // If it's today, make sure it's in the future
        if (dayOffset === 0 && windowStart <= now) continue;
        
        return windowStart;
      }
    }
    
    // Fallback: next hour
    const fallback = new Date(now);
    fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
    return fallback;
  }

  /**
   * Get multiple upcoming optimal windows
   */
  private getNextOptimalWindows(count: number): Date[] {
    const windows: Date[] = [];
    const now = new Date();
    const strategy = this.getOptimalStrategy();
    
    for (let dayOffset = 0; dayOffset < 7 && windows.length < count; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      
      const dayOfWeek = targetDate.getDay();
      const relevantWindows = strategy.optimalTimes
        .filter(w => w.dayOfWeek === dayOfWeek)
        .sort((a, b) => b.engagementMultiplier - a.engagementMultiplier);
      
      for (const window of relevantWindows) {
        if (windows.length >= count) break;
        
        const windowStart = new Date(targetDate);
        windowStart.setHours(window.startHour, 0, 0, 0);
        
        // If it's today, make sure it's in the future
        if (dayOffset === 0 && windowStart <= now) continue;
        
        windows.push(windowStart);
      }
    }
    
    return windows;
  }

  /**
   * Optimize strategy based on performance data
   */
  private optimizeStrategyFromData(baseStrategy: PostingStrategy): PostingStrategy {
    if (this.performanceData.length < 20) {
      return baseStrategy; // Not enough data for optimization
    }

    // Analyze content type performance
    const contentPerformance = this.analyzeContentTypePerformance();
    if (contentPerformance) {
      baseStrategy.contentDistribution = contentPerformance;
    }

    // Analyze timing performance and adjust multipliers
    baseStrategy.optimalTimes = baseStrategy.optimalTimes.map(window => {
      const historical = this.getHistoricalPerformance(window.startHour, window.dayOfWeek);
      if (historical) {
        return {
          ...window,
          engagementMultiplier: window.engagementMultiplier * historical.multiplier
        };
      }
      return window;
    });

    return baseStrategy;
  }

  /**
   * Analyze which content types perform best
   */
  private analyzeContentTypePerformance(): any | null {
    // This would analyze the performance data by content type
    // and return optimized distribution percentages
    // Implementation would depend on how content types are tracked
    return null;
  }

  /**
   * Record a post for frequency tracking
   */
  recordPost(): void {
    const now = new Date();
    this.lastPostTime = now;
    this.dailyPostCount++;
    this.hourlyPostCount++;
    
    // Reset counters at appropriate intervals
    // (This would typically be handled by a cron job or similar)
    console.log(`📊 SCHEDULER: Post recorded. Daily: ${this.dailyPostCount}/6, Hourly: ${this.hourlyPostCount}/1`);
  }

  /**
   * Add performance data for optimization
   */
  addPerformanceData(data: any): void {
    this.performanceData.push(data);
    
    // Keep only recent data (last 1000 posts)
    if (this.performanceData.length > 1000) {
      this.performanceData = this.performanceData.slice(-1000);
    }
    
    console.log(`📊 SCHEDULER: Performance data added. Total entries: ${this.performanceData.length}`);
  }

  /**
   * Reset daily counters (should be called at midnight)
   */
  resetDailyCounters(): void {
    this.dailyPostCount = 0;
    console.log('🌅 SCHEDULER: Daily counters reset');
  }

  /**
   * Reset hourly counters (should be called every hour)
   */
  resetHourlyCounters(): void {
    this.hourlyPostCount = 0;
    console.log('⏰ SCHEDULER: Hourly counters reset');
  }

  /**
   * Get scheduling insights and recommendations
   */
  getSchedulingInsights(): any {
    const strategy = this.getOptimalStrategy();
    const nextOptimal = this.getNextOptimalTime();
    const currentDecision = this.shouldPostNow();
    
    return {
      currentStatus: {
        shouldPost: currentDecision.shouldPost,
        reason: currentDecision.reason,
        confidence: currentDecision.confidence
      },
      nextOptimalTime: nextOptimal,
      upcomingWindows: this.getNextOptimalWindows(5),
      frequencyStatus: {
        daily: `${this.dailyPostCount}/6`,
        hourly: `${this.hourlyPostCount}/1`,
        lastPost: this.lastPostTime
      },
      strategy: {
        optimalWindows: strategy.optimalTimes.length,
        contentDistribution: strategy.contentDistribution
      },
      performanceDataPoints: this.performanceData.length
    };
  }
}
