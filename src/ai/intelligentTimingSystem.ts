/**
 * 🧠 INTELLIGENT TIMING SYSTEM
 * AI-driven decisions on WHEN to post and WHAT content type to use
 * Analyzes audience behavior, engagement patterns, and optimal windows
 */

import { getSafeDatabase } from '../lib/db';
import { getRedisSafeClient } from '../lib/redisSafe';

export interface TimingDecision {
  shouldPost: boolean;
  confidence: number;
  reasoning: string;
  optimalTime: Date;
  contentType: 'viral_insight' | 'educational_thread' | 'quick_tip' | 'controversial_take';
  urgency: 'immediate' | 'soon' | 'wait' | 'delay';
  expectedEngagement: number;
  audienceReadiness: number;
}

export interface EngagementPattern {
  hour: number;
  dayOfWeek: number;
  avgEngagement: number;
  postCount: number;
  bestContentTypes: string[];
}

export interface AudienceState {
  currentEngagement: number;
  timeSinceLastPost: number;
  recentPerformance: number;
  audienceGrowth: number;
  competitorActivity: number;
}

export class IntelligentTimingSystem {
  private static instance: IntelligentTimingSystem;
  private db = getSafeDatabase();
  private redis = getRedisSafeClient();

  // Optimal posting windows (hours in UTC)
  private readonly PEAK_HOURS = [13, 14, 15, 16, 17, 18, 19, 20]; // 1-8 PM UTC
  private readonly GOOD_HOURS = [11, 12, 21, 22]; // Morning and late evening
  private readonly AVOID_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // Very early morning

  static getInstance(): IntelligentTimingSystem {
    if (!this.instance) {
      this.instance = new IntelligentTimingSystem();
    }
    return this.instance;
  }

  /**
   * 🎯 MAKE INTELLIGENT TIMING DECISION
   */
  async makeTimingDecision(): Promise<TimingDecision> {
    console.log('🧠 INTELLIGENT_TIMING: Analyzing optimal posting moment...');

    try {
      const [
        engagementPatterns,
        audienceState,
        lastPostTime,
        currentHour
      ] = await Promise.all([
        this.getEngagementPatterns(),
        this.analyzeAudienceState(),
        this.getLastPostTime(),
        Promise.resolve(new Date().getUTCHours())
      ]);

      // Calculate time since last post
      const timeSinceLastPost = lastPostTime 
        ? (Date.now() - lastPostTime.getTime()) / (1000 * 60) // minutes
        : 1000; // If no last post, assume it's been a long time

      // Analyze current timing factors
      const timingFactors = this.analyzeTimingFactors(
        currentHour,
        new Date().getUTCDay(),
        engagementPatterns,
        timeSinceLastPost
      );

      // Determine if we should post now
      const decision = this.calculatePostingDecision(
        timingFactors,
        audienceState,
        timeSinceLastPost
      );

      console.log(`🎯 TIMING_DECISION: ${decision.shouldPost ? 'POST NOW' : 'WAIT'} (${decision.confidence}% confidence)`);
      console.log(`📊 REASONING: ${decision.reasoning}`);

      return decision;

    } catch (error) {
      console.error('❌ TIMING_DECISION_ERROR:', error);
      return this.getEmergencyTimingDecision();
    }
  }

  /**
   * 📊 ANALYZE TIMING FACTORS
   */
  private analyzeTimingFactors(
    currentHour: number,
    dayOfWeek: number,
    patterns: EngagementPattern[],
    timeSinceLastPost: number
  ): {
    hourScore: number;
    dayScore: number;
    cadenceScore: number;
    patternScore: number;
  } {
    // Hour scoring (0-100)
    let hourScore = 50; // Base score
    if (this.PEAK_HOURS.includes(currentHour)) hourScore = 90;
    else if (this.GOOD_HOURS.includes(currentHour)) hourScore = 70;
    else if (this.AVOID_HOURS.includes(currentHour)) hourScore = 20;

    // Day scoring (weekdays generally better for health content)
    let dayScore = 70; // Base score
    if (dayOfWeek >= 1 && dayOfWeek <= 5) dayScore = 85; // Monday-Friday
    else if (dayOfWeek === 0 || dayOfWeek === 6) dayScore = 60; // Weekend

    // Cadence scoring (optimal frequency)
    let cadenceScore = 50;
    if (timeSinceLastPost < 30) cadenceScore = 10; // Too soon (< 30 min)
    else if (timeSinceLastPost < 60) cadenceScore = 40; // Soon (30-60 min)
    else if (timeSinceLastPost < 120) cadenceScore = 80; // Good (1-2 hours)
    else if (timeSinceLastPost < 240) cadenceScore = 95; // Optimal (2-4 hours)
    else if (timeSinceLastPost < 480) cadenceScore = 85; // Good (4-8 hours)
    else cadenceScore = 70; // Long gap (8+ hours)

    // Pattern scoring based on historical data
    const currentPattern = patterns.find(p => 
      p.hour === currentHour && p.dayOfWeek === dayOfWeek
    );
    const patternScore = currentPattern 
      ? Math.min(100, currentPattern.avgEngagement * 100)
      : 60; // Default if no data

    return {
      hourScore,
      dayScore,
      cadenceScore,
      patternScore
    };
  }

  /**
   * 🧮 CALCULATE POSTING DECISION
   */
  private calculatePostingDecision(
    timingFactors: any,
    audienceState: AudienceState,
    timeSinceLastPost: number
  ): TimingDecision {
    const { hourScore, dayScore, cadenceScore, patternScore } = timingFactors;

    // Weighted average of all factors
    const confidence = Math.round(
      hourScore * 0.3 +          // 30% - Current hour quality
      dayScore * 0.15 +          // 15% - Day of week
      cadenceScore * 0.35 +      // 35% - Posting frequency
      patternScore * 0.2         // 20% - Historical patterns
    );

    // Audience readiness adjustments
    const audienceAdjustment = (
      audienceState.currentEngagement * 0.4 +
      audienceState.recentPerformance * 0.3 +
      audienceState.audienceGrowth * 0.3
    );

    const finalConfidence = Math.min(100, confidence + audienceAdjustment);

    // Decision thresholds
    const shouldPost = finalConfidence >= 65 && timeSinceLastPost >= 45; // Minimum 45 min gap
    
    // Determine urgency
    let urgency: 'immediate' | 'soon' | 'wait' | 'delay';
    if (finalConfidence >= 85) urgency = 'immediate';
    else if (finalConfidence >= 70) urgency = 'soon';
    else if (finalConfidence >= 50) urgency = 'wait';
    else urgency = 'delay';

    // Determine optimal content type based on timing
    const contentType = this.determineOptimalContentType(
      new Date().getUTCHours(),
      finalConfidence,
      audienceState
    );

    // Build reasoning
    const reasoning = this.buildTimingReasoning(
      timingFactors,
      finalConfidence,
      shouldPost,
      timeSinceLastPost
    );

    // Calculate next optimal time if not posting now
    const optimalTime = shouldPost 
      ? new Date() 
      : this.calculateNextOptimalTime();

    return {
      shouldPost,
      confidence: finalConfidence,
      reasoning,
      optimalTime,
      contentType,
      urgency,
      expectedEngagement: this.calculateExpectedEngagement(finalConfidence, contentType),
      audienceReadiness: audienceState.currentEngagement
    };
  }

  /**
   * 📝 DETERMINE OPTIMAL CONTENT TYPE
   */
  private determineOptimalContentType(
    hour: number,
    confidence: number,
    audienceState: AudienceState
  ): 'viral_insight' | 'educational_thread' | 'quick_tip' | 'controversial_take' {
    // Peak hours (1-8 PM) - viral content performs best
    if (this.PEAK_HOURS.includes(hour) && confidence >= 80) {
      return audienceState.currentEngagement > 70 ? 'controversial_take' : 'viral_insight';
    }

    // Good hours - educational content
    if (this.GOOD_HOURS.includes(hour)) {
      return confidence >= 75 ? 'educational_thread' : 'quick_tip';
    }

    // Off-peak hours - safe, valuable content
    return 'quick_tip';
  }

  /**
   * 📈 CALCULATE EXPECTED ENGAGEMENT
   */
  private calculateExpectedEngagement(confidence: number, contentType: string): number {
    const baseEngagement = {
      'viral_insight': 85,
      'controversial_take': 95,
      'educational_thread': 75,
      'quick_tip': 65
    };

    const base = baseEngagement[contentType as keyof typeof baseEngagement] || 70;
    return Math.round(base * (confidence / 100));
  }

  /**
   * ⏰ CALCULATE NEXT OPTIMAL TIME
   */
  private calculateNextOptimalTime(): Date {
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    // Find next peak hour
    const nextPeakHour = this.PEAK_HOURS.find(hour => hour > currentHour) || this.PEAK_HOURS[0];
    
    const nextOptimal = new Date(now);
    if (nextPeakHour > currentHour) {
      nextOptimal.setUTCHours(nextPeakHour, 0, 0, 0);
    } else {
      // Next day
      nextOptimal.setUTCDate(nextOptimal.getUTCDate() + 1);
      nextOptimal.setUTCHours(nextPeakHour, 0, 0, 0);
    }

    return nextOptimal;
  }

  /**
   * 🏗️ BUILD TIMING REASONING
   */
  private buildTimingReasoning(
    factors: any,
    confidence: number,
    shouldPost: boolean,
    timeSinceLastPost: number
  ): string {
    const reasons: string[] = [];

    // Hour analysis
    if (factors.hourScore >= 90) reasons.push('peak engagement hour');
    else if (factors.hourScore >= 70) reasons.push('good posting window');
    else if (factors.hourScore <= 30) reasons.push('low-engagement hour');

    // Cadence analysis
    if (timeSinceLastPost < 30) reasons.push('too soon since last post');
    else if (timeSinceLastPost >= 120) reasons.push('optimal posting gap');
    else if (timeSinceLastPost >= 60) reasons.push('good posting interval');

    // Performance analysis
    if (factors.patternScore >= 80) reasons.push('strong historical performance');
    else if (factors.patternScore <= 40) reasons.push('historically low engagement');

    // Decision context
    if (shouldPost) {
      reasons.unshift('conditions favorable for posting');
    } else {
      reasons.unshift('waiting for better timing');
    }

    return reasons.join(', ');
  }

  /**
   * 📊 GET ENGAGEMENT PATTERNS (Mock data - replace with real analytics)
   */
  private async getEngagementPatterns(): Promise<EngagementPattern[]> {
    // TODO: Replace with real database query
    const patterns: EngagementPattern[] = [];
    
    // Generate mock patterns for now
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        patterns.push({
          hour,
          dayOfWeek: day,
          avgEngagement: this.PEAK_HOURS.includes(hour) ? 0.85 : 
                        this.GOOD_HOURS.includes(hour) ? 0.65 : 0.45,
          postCount: 10,
          bestContentTypes: ['viral_insight', 'educational_thread']
        });
      }
    }

    return patterns;
  }

  /**
   * 👥 ANALYZE AUDIENCE STATE
   */
  private async analyzeAudienceState(): Promise<AudienceState> {
    // TODO: Replace with real audience analytics
    return {
      currentEngagement: 75, // Current audience activity level
      timeSinceLastPost: 90, // Minutes since last post
      recentPerformance: 80, // Recent post performance
      audienceGrowth: 70,    // Follower growth rate
      competitorActivity: 60  // Competitor posting activity
    };
  }

  /**
   * ⏰ GET LAST POST TIME
   */
  private async getLastPostTime(): Promise<Date | null> {
    try {
      const redis = await this.redis;
      if (!redis) return null;

      const lastPostTime = await redis.get('last_post_timestamp');
      return lastPostTime ? new Date(parseInt(lastPostTime)) : null;
    } catch (error) {
      console.warn('⚠️ LAST_POST_TIME_WARNING:', error);
      return null;
    }
  }

  /**
   * 🆘 EMERGENCY TIMING DECISION
   */
  private getEmergencyTimingDecision(): TimingDecision {
    const currentHour = new Date().getUTCHours();
    const isGoodTime = this.PEAK_HOURS.includes(currentHour) || this.GOOD_HOURS.includes(currentHour);

    return {
      shouldPost: isGoodTime,
      confidence: isGoodTime ? 70 : 40,
      reasoning: 'Emergency decision based on hour analysis only',
      optimalTime: isGoodTime ? new Date() : this.calculateNextOptimalTime(),
      contentType: 'quick_tip',
      urgency: isGoodTime ? 'soon' : 'wait',
      expectedEngagement: isGoodTime ? 65 : 45,
      audienceReadiness: 60
    };
  }

  /**
   * 📝 UPDATE POSTING TIMESTAMP
   */
  async updateLastPostTime(timestamp?: Date): Promise<void> {
    try {
      const redis = await this.redis;
      if (!redis) return;

      const time = timestamp || new Date();
      await redis.set('last_post_timestamp', time.getTime().toString());
    } catch (error) {
      console.warn('⚠️ UPDATE_POST_TIME_WARNING:', error);
    }
  }

  /**
   * 📈 RECORD ENGAGEMENT DATA
   */
  async recordEngagementData(
    hour: number,
    dayOfWeek: number,
    engagement: number,
    contentType: string
  ): Promise<void> {
    try {
      const redis = await this.redis;
      if (!redis) return;

      const key = `engagement:${dayOfWeek}:${hour}`;
      const data = { engagement, contentType, timestamp: Date.now() };
      
      await redis.setJSON(key, data, 7 * 24 * 60 * 60); // 7 days TTL
    } catch (error) {
      console.warn('⚠️ RECORD_ENGAGEMENT_WARNING:', error);
    }
  }
}

// Export singleton instance
export const intelligentTimingSystem = IntelligentTimingSystem.getInstance();
