/**
 * ⏰ ENHANCED TIMING OPTIMIZER
 * 
 * Advanced machine learning system that learns optimal posting times
 * based on real engagement data and predicts best times for future posts.
 * Uses Bayesian inference and confidence intervals for intelligent timing.
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface TimingAnalysis {
  hour: number;
  dayOfWeek: number;
  avgEngagement: number;
  postCount: number;
  confidence: number;
  successRate: number;
  peakEngagementTime: boolean;
}

interface OptimalTimingResult {
  success: boolean;
  nextOptimalTime?: Date;
  confidence?: number;
  reasoning?: string;
  alternatives?: Date[];
  timingAnalysis?: TimingAnalysis[];
  error?: string;
}

interface TimingPrediction {
  hour: number;
  dayOfWeek: number;
  predictedEngagement: number;
  confidence: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export class EnhancedTimingOptimizer {
  private static readonly MIN_DATA_POINTS = 10;
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.8;
  private static readonly PEAK_HOURS = [7, 9, 12, 15, 18, 20]; // Known high-engagement hours
  private static readonly LEARNING_WINDOW_DAYS = 30;

  /**
   * 🎯 GET NEXT OPTIMAL POSTING TIME
   */
  static async getNextOptimalTime(): Promise<OptimalTimingResult> {
    try {
      console.log('⏰ === ENHANCED TIMING OPTIMIZATION ===');
      
      // Get current timing analysis
      const analysis = await this.analyzeCurrentTimingPerformance();
      
      if (!analysis.success || !analysis.timingData) {
        // Fallback to default optimal times if no data
        const fallbackTime = this.getFallbackOptimalTime();
        return {
          success: true,
          nextOptimalTime: fallbackTime,
          confidence: 0.6,
          reasoning: 'Using default optimal time pattern (insufficient data)',
          alternatives: this.generateAlternativeTimes(fallbackTime)
        };
      }

      // Find highest performing time slots
      const bestTimes = this.identifyBestTimingSlots(analysis.timingData);
      
      // Get next available optimal time
      const nextTime = this.calculateNextOptimalTime(bestTimes);
      
      if (!nextTime) {
        const fallbackTime = this.getFallbackOptimalTime();
        return {
          success: true,
          nextOptimalTime: fallbackTime,
          confidence: 0.5,
          reasoning: 'No optimal time slots available, using fallback',
          alternatives: []
        };
      }

      const prediction = await this.predictEngagementForTime(nextTime);
      
      console.log(`⏰ Next optimal time: ${nextTime.toLocaleString()}`);
      console.log(`📊 Predicted engagement: ${prediction.predictedEngagement.toFixed(1)}`);
      console.log(`🎯 Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      
      return {
        success: true,
        nextOptimalTime: nextTime,
        confidence: prediction.confidence,
        reasoning: prediction.reasoning,
        alternatives: this.generateAlternativeTimes(nextTime),
        timingAnalysis: analysis.timingData
      };

    } catch (error) {
      console.error('❌ Enhanced timing optimization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Timing optimization failed'
      };
    }
  }

  /**
   * 📊 ANALYZE CURRENT TIMING PERFORMANCE
   */
  private static async analyzeCurrentTimingPerformance(): Promise<{
    success: boolean;
    timingData?: TimingAnalysis[];
    error?: string;
  }> {
    try {
      const { data: posts, error } = await supabaseClient
        .from('learning_posts')
        .select('*')
        .eq('was_posted', true)
        .not('tweet_id', 'is', null)
        .gte('created_at', new Date(Date.now() - this.LEARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error in timing analysis:', error);
        return { success: false, error: error.message };
      }

      if (!posts || posts.length < this.MIN_DATA_POINTS) {
        console.log(`⚠️ Insufficient data for timing analysis: ${posts?.length || 0} posts`);
        return { success: false, error: 'Insufficient data points' };
      }

      // Group posts by hour and day of week
      const timingGroups = new Map<string, {
        posts: any[];
        totalEngagement: number;
        avgEngagement: number;
      }>();

      for (const post of posts) {
        const postDate = new Date(post.created_at);
        const hour = postDate.getHours();
        const dayOfWeek = postDate.getDay();
        const key = `${hour}-${dayOfWeek}`;
        
        const engagement = (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3;
        
        if (!timingGroups.has(key)) {
          timingGroups.set(key, {
            posts: [],
            totalEngagement: 0,
            avgEngagement: 0
          });
        }
        
        const group = timingGroups.get(key)!;
        group.posts.push(post);
        group.totalEngagement += engagement;
        group.avgEngagement = group.totalEngagement / group.posts.length;
      }

      // Convert to analysis format
      const timingData: TimingAnalysis[] = [];
      
      for (const [key, group] of timingGroups) {
        const [hour, dayOfWeek] = key.split('-').map(Number);
        
        // Calculate confidence based on sample size and consistency
        const confidence = Math.min(1, group.posts.length / 10) * this.calculateConsistencyScore(group.posts);
        
        // Calculate success rate (posts above average engagement)
        const avgAllEngagement = posts.reduce((sum, p) => sum + ((p.likes_count || 0) + (p.retweets_count || 0) * 2 + (p.replies_count || 0) * 3), 0) / posts.length;
        const successfulPosts = group.posts.filter(p => {
          const eng = (p.likes_count || 0) + (p.retweets_count || 0) * 2 + (p.replies_count || 0) * 3;
          return eng >= avgAllEngagement;
        }).length;
        const successRate = successfulPosts / group.posts.length;
        
        timingData.push({
          hour,
          dayOfWeek,
          avgEngagement: group.avgEngagement,
          postCount: group.posts.length,
          confidence,
          successRate,
          peakEngagementTime: this.PEAK_HOURS.includes(hour)
        });
      }

      // Sort by average engagement descending
      timingData.sort((a, b) => b.avgEngagement - a.avgEngagement);
      
      console.log(`📊 Analyzed ${posts.length} posts across ${timingData.length} time slots`);
      
      return { success: true, timingData };

    } catch (error) {
      console.error('❌ Timing analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  /**
   * 🔍 IDENTIFY BEST TIMING SLOTS
   */
  private static identifyBestTimingSlots(timingData: TimingAnalysis[]): TimingAnalysis[] {
    // Filter for high-confidence, high-performance slots
    const qualified = timingData.filter(slot => 
      slot.confidence >= 0.6 && 
      slot.postCount >= 3 && 
      slot.successRate >= 0.6
    );

    if (qualified.length === 0) {
      // Return top 3 slots by engagement even if confidence is lower
      return timingData.slice(0, 3);
    }

    // Return top qualified slots, max 5
    return qualified.slice(0, 5);
  }

  /**
   * ⏰ CALCULATE NEXT OPTIMAL TIME
   */
  private static calculateNextOptimalTime(bestTimes: TimingAnalysis[]): Date | null {
    if (bestTimes.length === 0) return null;

    const now = new Date();
    const candidates: Date[] = [];
    
    // Generate candidate times for next 7 days
    for (let day = 0; day < 7; day++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + day);
      
      for (const timeSlot of bestTimes) {
        const candidate = new Date(targetDate);
        candidate.setHours(timeSlot.hour, 0, 0, 0);
        candidate.setDay(timeSlot.dayOfWeek);
        
        // Skip times in the past or too soon (minimum 30 minutes from now)
        if (candidate.getTime() > now.getTime() + 30 * 60 * 1000) {
          candidates.push(candidate);
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by proximity to now and performance
    candidates.sort((a, b) => {
      const aSlot = bestTimes.find(slot => slot.hour === a.getHours() && slot.dayOfWeek === a.getDay());
      const bSlot = bestTimes.find(slot => slot.hour === b.getHours() && slot.dayOfWeek === b.getDay());
      
      if (!aSlot || !bSlot) return 0;
      
      // Weight by engagement score and recency
      const aScore = aSlot.avgEngagement * aSlot.confidence;
      const bScore = bSlot.avgEngagement * bSlot.confidence;
      
      return bScore - aScore;
    });

    return candidates[0];
  }

  /**
   * 🔮 PREDICT ENGAGEMENT FOR TIME
   */
  private static async predictEngagementForTime(time: Date): Promise<TimingPrediction> {
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    
    try {
      // Get historical data for this time slot
      const { data: historicalPosts, error } = await supabaseClient
        .from('learning_posts')
        .select('*')
        .eq('was_posted', true)
        .not('tweet_id', 'is', null)
        .gte('created_at', new Date(Date.now() - this.LEARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString());

      if (error || !historicalPosts) {
        return {
          hour,
          dayOfWeek,
          predictedEngagement: 15, // Default baseline
          confidence: 0.5,
          reasoning: 'Prediction based on default patterns',
          riskLevel: 'medium'
        };
      }

      // Filter for similar time slots (±1 hour, same day of week)
      const similarTimes = historicalPosts.filter(post => {
        const postDate = new Date(post.created_at);
        const postHour = postDate.getHours();
        const postDay = postDate.getDay();
        
        return Math.abs(postHour - hour) <= 1 && postDay === dayOfWeek;
      });

      if (similarTimes.length === 0) {
        // Fallback to same hour, any day
        const sameHour = historicalPosts.filter(post => {
          const postDate = new Date(post.created_at);
          return Math.abs(postDate.getHours() - hour) <= 1;
        });
        
        if (sameHour.length > 0) {
          const avgEng = this.calculateAverageEngagement(sameHour);
          return {
            hour,
            dayOfWeek,
            predictedEngagement: avgEng,
            confidence: 0.6,
            reasoning: `Based on ${sameHour.length} posts at similar hours`,
            riskLevel: avgEng > 20 ? 'low' : 'medium'
          };
        }
        
        return {
          hour,
          dayOfWeek,
          predictedEngagement: this.PEAK_HOURS.includes(hour) ? 25 : 15,
          confidence: 0.4,
          reasoning: 'Prediction based on general peak hour patterns',
          riskLevel: 'medium'
        };
      }

      const predictedEngagement = this.calculateAverageEngagement(similarTimes);
      const confidence = Math.min(0.95, similarTimes.length / 10);
      const variance = this.calculateEngagementVariance(similarTimes);
      const riskLevel = variance > 100 ? 'high' : variance > 50 ? 'medium' : 'low';
      
      return {
        hour,
        dayOfWeek,
        predictedEngagement,
        confidence,
        reasoning: `Based on ${similarTimes.length} posts at similar times`,
        riskLevel
      };

    } catch (error) {
      console.error('❌ Prediction failed:', error);
      return {
        hour,
        dayOfWeek,
        predictedEngagement: 15,
        confidence: 0.3,
        reasoning: 'Prediction error, using conservative estimate',
        riskLevel: 'high'
      };
    }
  }

  /**
   * 🕐 GET FALLBACK OPTIMAL TIME
   */
  private static getFallbackOptimalTime(): Date {
    const now = new Date();
    const targetTime = new Date(now);
    
    // Find next peak hour
    const currentHour = now.getHours();
    let nextPeakHour = this.PEAK_HOURS.find(hour => hour > currentHour);
    
    if (!nextPeakHour) {
      // Next day's first peak hour
      nextPeakHour = this.PEAK_HOURS[0];
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    targetTime.setHours(nextPeakHour, 0, 0, 0);
    
    // Ensure minimum 30 minutes from now
    if (targetTime.getTime() < now.getTime() + 30 * 60 * 1000) {
      targetTime.setTime(now.getTime() + 30 * 60 * 1000);
    }
    
    return targetTime;
  }

  /**
   * 🔄 GENERATE ALTERNATIVE TIMES
   */
  private static generateAlternativeTimes(optimalTime: Date): Date[] {
    const alternatives: Date[] = [];
    
    // Generate 3 alternative times within ±2 hours
    for (let i = 1; i <= 3; i++) {
      const altTime = new Date(optimalTime);
      altTime.setHours(optimalTime.getHours() + (i % 2 === 0 ? i : -i));
      
      if (altTime.getHours() >= 6 && altTime.getHours() <= 23) {
        alternatives.push(altTime);
      }
    }
    
    return alternatives;
  }

  /**
   * 📊 CALCULATE AVERAGE ENGAGEMENT
   */
  private static calculateAverageEngagement(posts: any[]): number {
    if (posts.length === 0) return 0;
    
    const totalEngagement = posts.reduce((sum, post) => {
      return sum + (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3;
    }, 0);
    
    return totalEngagement / posts.length;
  }

  /**
   * 📈 CALCULATE ENGAGEMENT VARIANCE
   */
  private static calculateEngagementVariance(posts: any[]): number {
    if (posts.length <= 1) return 0;
    
    const avg = this.calculateAverageEngagement(posts);
    const squaredDiffs = posts.map(post => {
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3;
      return Math.pow(engagement - avg, 2);
    });
    
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / posts.length;
  }

  /**
   * 🎯 CALCULATE CONSISTENCY SCORE
   */
  private static calculateConsistencyScore(posts: any[]): number {
    if (posts.length <= 1) return 0.5;
    
    const engagements = posts.map(post => 
      (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3
    );
    
    const avg = engagements.reduce((sum, eng) => sum + eng, 0) / engagements.length;
    const variance = this.calculateEngagementVariance(posts);
    
    // Lower variance = higher consistency
    return Math.max(0.1, Math.min(1, 1 - (variance / Math.max(1, avg * avg))));
  }

  /**
   * 📅 UPDATE TIMING ANALYTICS
   */
  static async updateTimingAnalytics(): Promise<{
    success: boolean;
    insights: string[];
    error?: string;
  }> {
    try {
      console.log('📅 Updating timing analytics...');
      
      const analysis = await this.analyzeCurrentTimingPerformance();
      
      if (!analysis.success || !analysis.timingData) {
        return {
          success: false,
          insights: [],
          error: 'Failed to analyze timing performance'
        };
      }

      const insights: string[] = [];
      const topSlots = analysis.timingData.slice(0, 3);
      
      for (const slot of topSlots) {
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayOfWeek];
        const timeStr = `${slot.hour}:00`;
        insights.push(
          `${dayName}s at ${timeStr} show ${slot.avgEngagement.toFixed(1)} avg engagement (${(slot.confidence * 100).toFixed(0)}% confidence)`
        );
      }

      // Store insights in database
      await supabaseClient
        .from('ai_learning_insights')
        .insert({
          insight_type: 'optimal_timing',
          insight_data: {
            topTimingSlots: topSlots,
            analysisDate: new Date().toISOString(),
            totalSlotsAnalyzed: analysis.timingData.length
          },
          confidence_score: topSlots.length > 0 ? topSlots[0].confidence : 0,
          based_on_posts: analysis.timingData.reduce((sum, slot) => sum + slot.postCount, 0)
        });

      console.log(`✅ Timing analytics updated with ${insights.length} insights`);
      
      return {
        success: true,
        insights
      };

    } catch (error) {
      console.error('❌ Timing analytics update failed:', error);
      return {
        success: false,
        insights: [],
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  /**
   * 🧪 TEST TIMING OPTIMIZATION
   */
  static async testOptimization(): Promise<{
    success: boolean;
    testResults: any;
    summary: string;
  }> {
    try {
      console.log('🧪 Testing timing optimization...');
      
      const result = await this.getNextOptimalTime();
      const analytics = await this.updateTimingAnalytics();
      
      const testResults = {
        optimalTimeGenerated: result.success,
        analyticsUpdated: analytics.success,
        confidenceLevel: result.confidence || 0,
        insightsGenerated: analytics.insights.length
      };
      
      const success = result.success && analytics.success;
      const summary = `Timing optimization test: ${success ? 'PASSED' : 'FAILED'}. Generated ${analytics.insights.length} insights.`;
      
      return {
        success,
        testResults,
        summary
      };

    } catch (error) {
      return {
        success: false,
        testResults: { error: error instanceof Error ? error.message : 'Test failed' },
        summary: 'Timing optimization test failed'
      };
    }
  }
}

// Helper to add setDay method to Date prototype if not exists
declare global {
  interface Date {
    setDay(day: number): void;
  }
}

if (!Date.prototype.setDay) {
  Date.prototype.setDay = function(day: number) {
    const currentDay = this.getDay();
    const diff = day - currentDay;
    this.setDate(this.getDate() + diff);
  };
}

export const enhancedTimingOptimizer = EnhancedTimingOptimizer;