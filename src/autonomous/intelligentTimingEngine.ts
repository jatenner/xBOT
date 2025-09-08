/**
 * ⏰ INTELLIGENT TIMING ENGINE
 * Uses AI and learned data to predict optimal posting times
 */

import { OpenAIService } from '../services/openAIService';
import { getRedisSafeClient } from '../lib/redisSafe';
import { getSafeDatabase } from '../lib/db';

export interface TimingContext {
  contentType: 'single' | 'thread';
  topic: string;
  urgency: 'low' | 'medium' | 'high';
  targetAudience?: string;
  qualityScore?: number;
}

export interface TimingPrediction {
  recommendedTime: Date;
  confidence: number;
  reasoning: string;
  alternativeTimes: Date[];
  factors: string[];
  optimizationScore: number;
}

export interface OptimalWindow {
  dayOfWeek: number;
  hour: number;
  averageEngagement: number;
  confidence: number;
  sampleSize: number;
  successRate: number;
}

export interface TimingIntelligence {
  hourlyPerformance: Record<number, { avgEngagement: number; posts: number; successRate: number }>;
  dailyPerformance: Record<number, { avgEngagement: number; posts: number; successRate: number }>;
  audiencePatterns: { peakHours: number[]; peakDays: number[] };
  topPerformers: Array<{ time: Date; engagement: number; topic: string }>;
  dataFreshness: Date;
  competitionLevels: Record<number, number>; // Hour -> competition intensity
}

export class IntelligentTimingEngine {
  private static instance: IntelligentTimingEngine;
  private redis = getRedisSafeClient();
  private db = getSafeDatabase();
  private openai = OpenAIService.getInstance();
  
  private readonly TIMEZONE = 'America/New_York';
  private readonly MIN_DATA_THRESHOLD = 3; // Minimum posts needed for reliable data

  public static getInstance(): IntelligentTimingEngine {
    if (!IntelligentTimingEngine.instance) {
      IntelligentTimingEngine.instance = new IntelligentTimingEngine();
    }
    return IntelligentTimingEngine.instance;
  }

  /**
   * 🎯 PREDICT OPTIMAL POSTING TIME
   * Main entry point for AI-driven timing decisions
   */
  async predictOptimalPostingTime(context: TimingContext): Promise<TimingPrediction> {
    console.log('⏰ TIMING_AI: Predicting optimal posting time...');
    console.log(`📊 Context: ${context.contentType} about ${context.topic} (urgency: ${context.urgency})`);
    
    try {
      // 1. Gather comprehensive timing intelligence
      const timingData = await this.gatherTimingIntelligence();
      
      // 2. Get recent performance patterns
      const patterns = await this.getRecentPerformancePatterns();
      
      // 3. Analyze current competition levels
      const competition = await this.analyzeCurrentCompetition();
      
      // 4. Use AI to generate timing prediction
      const prediction = await this.generateTimingPrediction(context, timingData, patterns, competition);
      
      console.log(`🎯 OPTIMAL_TIME: ${prediction.recommendedTime.toLocaleString()} (confidence: ${prediction.confidence}%)`);
      console.log(`💭 REASONING: ${prediction.reasoning}`);
      console.log(`🎯 OPTIMIZATION_SCORE: ${prediction.optimizationScore}/100`);
      
      // 5. Store prediction for learning
      await this.storePrediction(prediction, context);
      
      return prediction;

    } catch (error) {
      console.warn('⚠️ AI timing prediction failed, using data-driven fallback:', error);
      return this.getFallbackTimingPrediction(context);
    }
  }

  /**
   * 📊 GATHER COMPREHENSIVE TIMING INTELLIGENCE
   */
  private async gatherTimingIntelligence(): Promise<TimingIntelligence> {
    console.log('📊 GATHERING_TIMING_INTELLIGENCE: Analyzing all data sources...');
    
    // Gather data in parallel for efficiency
    const [
      hourlyPerformance,
      dailyPerformance,
      audiencePatterns,
      topPerformers,
      competitionLevels
    ] = await Promise.all([
      this.getHourlyPerformance(),
      this.getDailyPerformance(),
      this.getAudienceActivityPatterns(),
      this.getRecentTopPerformers(),
      this.getCompetitionLevels()
    ]);

    console.log(`📈 INTELLIGENCE_GATHERED: ${Object.keys(hourlyPerformance).length} hourly data points, ${topPerformers.length} top performers`);

    return {
      hourlyPerformance,
      dailyPerformance,
      audiencePatterns,
      topPerformers,
      competitionLevels,
      dataFreshness: new Date()
    };
  }

  /**
   * 🕐 GET HOURLY PERFORMANCE DATA
   */
  private async getHourlyPerformance(): Promise<Record<number, { avgEngagement: number; posts: number; successRate: number }>> {
    const hourlyData: Record<number, { avgEngagement: number; posts: number; successRate: number }> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      try {
        // Get data from Redis (all phases combined)
        const engagementData = await this.redis.get(`timing:hour:${hour}:24hour:engagement`) || '0';
        const postsData = await this.redis.get(`timing:hour:${hour}:24hour:posts`) || '0';
        
        const totalEngagement = parseFloat(engagementData);
        const totalPosts = parseInt(postsData);
        
        // Calculate success rate (posts with >5% engagement)
        const successfulPosts = await this.getSuccessfulPostsAtHour(hour);
        
        hourlyData[hour] = {
          avgEngagement: totalPosts > 0 ? totalEngagement / totalPosts : 0,
          posts: totalPosts,
          successRate: totalPosts > 0 ? successfulPosts / totalPosts : 0
        };
        
      } catch (error) {
        hourlyData[hour] = { avgEngagement: 0, posts: 0, successRate: 0 };
      }
    }
    
    return hourlyData;
  }

  /**
   * 📅 GET DAILY PERFORMANCE DATA
   */
  private async getDailyPerformance(): Promise<Record<number, { avgEngagement: number; posts: number; successRate: number }>> {
    const dailyData: Record<number, { avgEngagement: number; posts: number; successRate: number }> = {};
    
    for (let day = 0; day < 7; day++) {
      try {
        const engagementData = await this.redis.get(`timing:day:${day}:24hour:engagement`) || '0';
        const postsData = await this.redis.get(`timing:day:${day}:24hour:posts`) || '0';
        
        const totalEngagement = parseFloat(engagementData);
        const totalPosts = parseInt(postsData);
        
        const successfulPosts = await this.getSuccessfulPostsOnDay(day);
        
        dailyData[day] = {
          avgEngagement: totalPosts > 0 ? totalEngagement / totalPosts : 0,
          posts: totalPosts,
          successRate: totalPosts > 0 ? successfulPosts / totalPosts : 0
        };
        
      } catch (error) {
        dailyData[day] = { avgEngagement: 0, posts: 0, successRate: 0 };
      }
    }
    
    return dailyData;
  }

  /**
   * 👥 GET AUDIENCE ACTIVITY PATTERNS
   */
  private async getAudienceActivityPatterns(): Promise<{ peakHours: number[]; peakDays: number[] }> {
    // Get hours and days with highest engagement rates
    const hourlyPerf = await this.getHourlyPerformance();
    const dailyPerf = await this.getDailyPerformance();
    
    // Find peak hours (top 6 hours with >3 posts)
    const peakHours = Object.entries(hourlyPerf)
      .filter(([_, data]) => data.posts >= this.MIN_DATA_THRESHOLD)
      .sort(([_, a], [__, b]) => b.avgEngagement - a.avgEngagement)
      .slice(0, 6)
      .map(([hour, _]) => parseInt(hour));
    
    // Find peak days (top 4 days with >5 posts)
    const peakDays = Object.entries(dailyPerf)
      .filter(([_, data]) => data.posts >= this.MIN_DATA_THRESHOLD * 2)
      .sort(([_, a], [__, b]) => b.avgEngagement - a.avgEngagement)
      .slice(0, 4)
      .map(([day, _]) => parseInt(day));
    
    return { peakHours, peakDays };
  }

  /**
   * 🏆 GET RECENT TOP PERFORMERS
   */
  private async getRecentTopPerformers(): Promise<Array<{ time: Date; engagement: number; topic: string }>> {
    try {
      const { data } = await this.db.safeSelect(
        'metrics_by_phase',
        'tweet_id, engagement_rate, collected_at',
        { phase: '24hour' },
        { limit: 20, orderBy: 'engagement_rate', ascending: false }
      );
      
      if (!data) return [];
      
      // Get post details for top performers
      const topPerformers = [];
      for (const metric of data.slice(0, 10)) {
        const postContext = await this.getPostTimeAndTopic(metric.tweet_id);
        if (postContext) {
          topPerformers.push({
            time: postContext.postedAt,
            engagement: metric.engagement_rate,
            topic: postContext.topic
          });
        }
      }
      
      return topPerformers;
      
    } catch (error) {
      console.warn('⚠️ Could not fetch top performers:', error);
      return [];
    }
  }

  /**
   * 🥊 GET COMPETITION LEVELS
   */
  private async getCompetitionLevels(): Promise<Record<number, number>> {
    // Simulate competition analysis (in production, this could analyze Twitter trends)
    const competition: Record<number, number> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      // Higher competition during peak social media hours
      if (hour >= 9 && hour <= 11) competition[hour] = 0.8; // Morning peak
      else if (hour >= 15 && hour <= 17) competition[hour] = 0.9; // Afternoon peak  
      else if (hour >= 19 && hour <= 21) competition[hour] = 1.0; // Evening peak
      else if (hour >= 7 && hour <= 22) competition[hour] = 0.6; // Daytime
      else competition[hour] = 0.3; // Night/early morning
    }
    
    return competition;
  }

  /**
   * 🧠 GENERATE AI TIMING PREDICTION
   */
  private async generateTimingPrediction(
    context: TimingContext,
    timingData: TimingIntelligence,
    patterns: any[],
    competition: Record<number, number>
  ): Promise<TimingPrediction> {
    
    const currentTime = new Date();
    const prompt = this.buildTimingPredictionPrompt(context, timingData, currentTime, competition);
    
    try {
      const response = await this.openai.chatCompletion([
        { role: 'system', content: 'You are an expert social media timing strategist focused on engagement optimization using data science.' },
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 800,
        requestType: 'timing_prediction',
        priority: 'high'
      });
      
      const result = this.parseTimingResponse(response.choices[0].message.content);
      
      // Validate and adjust the prediction
      const validatedPrediction = this.validateTimingPrediction(result, context);
      
      return validatedPrediction;
      
    } catch (error) {
      console.warn('⚠️ AI timing prediction failed:', error);
      return this.getFallbackTimingPrediction(context);
    }
  }

  /**
   * 📝 BUILD TIMING PREDICTION PROMPT
   */
  private buildTimingPredictionPrompt(
    context: TimingContext,
    timingData: TimingIntelligence,
    currentTime: Date,
    competition: Record<number, number>
  ): string {
    
    const bestHours = this.formatBestHours(timingData.hourlyPerformance);
    const bestDays = this.formatBestDays(timingData.dailyPerformance);
    const topPerformingTimes = this.formatTopPerformers(timingData.topPerformers);
    
    return `
    Analyze optimal posting time for health content on Twitter using performance data.

    CURRENT CONTEXT:
    - Content Type: ${context.contentType}
    - Topic: ${context.topic}
    - Urgency: ${context.urgency}
    - Current Time: ${currentTime.toLocaleString()} (${this.TIMEZONE})
    - Quality Score: ${context.qualityScore || 'unknown'}

    PERFORMANCE DATA:
    Best Hours (avg engagement): ${bestHours}
    Best Days (avg engagement): ${bestDays}
    Recent Top Performers: ${topPerformingTimes}
    Audience Peak Hours: ${timingData.audiencePatterns.peakHours.join(', ')}
    Audience Peak Days: ${timingData.audiencePatterns.peakDays.join(', ')}

    COMPETITION ANALYSIS:
    High Competition Hours: ${this.getHighCompetitionHours(competition)}
    Low Competition Hours: ${this.getLowCompetitionHours(competition)}

    OPTIMIZATION FACTORS:
    1. Historical engagement patterns (35% weight)
    2. Audience activity cycles (25% weight)  
    3. Competition levels (20% weight)
    4. Content type optimization (15% weight)
    5. Urgency considerations (5% weight)

    CONSTRAINTS:
    - Must be within next 24 hours
    - Minimum 2 hours from current time (avoid immediate posting)
    - Consider ${context.urgency} urgency level
    - Health content performs better during wellness-focused times

    TASK: Predict optimal posting time with:
    - Specific timestamp within 24 hours
    - Confidence score (0-100)
    - Clear reasoning based on data
    - 2-3 alternative times
    - Optimization score (0-100)

    Respond in JSON format:
    {
      "recommendedTime": "2024-01-15T14:30:00.000Z",
      "confidence": 85,
      "reasoning": "Data shows 2:30 PM has 12.3% avg engagement with low competition...",
      "alternativeTimes": ["2024-01-15T16:00:00.000Z", "2024-01-15T19:30:00.000Z"],
      "factors": ["peak_audience_activity", "low_competition", "topic_optimization"],
      "optimizationScore": 87
    }
    `;
  }

  /**
   * 🔍 PARSE AI TIMING RESPONSE
   */
  private parseTimingResponse(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.warn('⚠️ Failed to parse AI timing response:', error);
      // Extract key information with regex as fallback
      const timeMatch = content.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      const confidenceMatch = content.match(/confidence[\"']?\s*:\s*(\d+)/i);
      
      return {
        recommendedTime: timeMatch ? timeMatch[1] + '.000Z' : new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 60,
        reasoning: 'Fallback timing prediction due to parsing error',
        alternativeTimes: [],
        factors: ['fallback_prediction'],
        optimizationScore: 50
      };
    }
  }

  /**
   * ✅ VALIDATE TIMING PREDICTION
   */
  private validateTimingPrediction(result: any, context: TimingContext): TimingPrediction {
    const now = new Date();
    const recommendedTime = new Date(result.recommendedTime);
    
    // Ensure timing is reasonable
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Minimum 2 hours
    const maxTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Maximum 24 hours
    
    let finalTime = recommendedTime;
    if (recommendedTime < minTime) {
      finalTime = minTime;
    } else if (recommendedTime > maxTime) {
      finalTime = maxTime;
    }
    
    // Adjust confidence based on urgency
    let confidence = Math.min(100, Math.max(10, result.confidence || 60));
    if (context.urgency === 'high' && finalTime.getTime() - now.getTime() > 4 * 60 * 60 * 1000) {
      confidence -= 20; // Reduce confidence for delayed high-urgency posts
    }
    
    // Generate alternative times
    const alternatives = result.alternativeTimes?.map((t: string) => new Date(t)) || [];
    if (alternatives.length < 2) {
      alternatives.push(new Date(finalTime.getTime() + 2 * 60 * 60 * 1000));
      alternatives.push(new Date(finalTime.getTime() + 4 * 60 * 60 * 1000));
    }
    
    return {
      recommendedTime: finalTime,
      confidence,
      reasoning: result.reasoning || 'Optimized based on historical performance data',
      alternativeTimes: alternatives.slice(0, 3),
      factors: result.factors || ['historical_data'],
      optimizationScore: Math.min(100, Math.max(0, result.optimizationScore || 60))
    };
  }

  /**
   * 📈 GET OPTIMAL POSTING WINDOWS
   */
  async getOptimalPostingWindows(): Promise<OptimalWindow[]> {
    const windows: OptimalWindow[] = [];
    
    const hourlyPerf = await this.getHourlyPerformance();
    const dailyPerf = await this.getDailyPerformance();
    
    // Generate windows for each hour of the week
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const hourData = hourlyPerf[hour] || { avgEngagement: 0, posts: 0, successRate: 0 };
        const dayData = dailyPerf[day] || { avgEngagement: 0, posts: 0, successRate: 0 };
        
        if (hourData.posts >= this.MIN_DATA_THRESHOLD) {
          // Combine hour and day performance
          const combinedEngagement = (hourData.avgEngagement + dayData.avgEngagement) / 2;
          const combinedSuccess = (hourData.successRate + dayData.successRate) / 2;
          
          windows.push({
            dayOfWeek: day,
            hour,
            averageEngagement: combinedEngagement,
            confidence: Math.min(100, (hourData.posts + dayData.posts) * 5),
            sampleSize: hourData.posts + dayData.posts,
            successRate: combinedSuccess
          });
        }
      }
    }
    
    // Sort by engagement and success rate
    return windows
      .sort((a, b) => {
        const scoreA = a.averageEngagement * 0.7 + a.successRate * 0.3;
        const scoreB = b.averageEngagement * 0.7 + b.successRate * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, 20); // Top 20 windows
  }

  /**
   * 🎯 GET NEXT OPTIMAL POSTING TIME
   */
  async getNextOptimalPostingTime(context?: Partial<TimingContext>): Promise<Date> {
    const defaultContext: TimingContext = {
      contentType: 'single',
      topic: 'health_general',
      urgency: 'low',
      ...context
    };
    
    const prediction = await this.predictOptimalPostingTime(defaultContext);
    return prediction.recommendedTime;
  }

  // Helper methods
  private async getSuccessfulPostsAtHour(hour: number): Promise<number> {
    try {
      // Count posts at this hour with >5% engagement
      const key = `timing:hour:${hour}:successful_posts`;
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch {
      return 0;
    }
  }

  private async getSuccessfulPostsOnDay(day: number): Promise<number> {
    try {
      const key = `timing:day:${day}:successful_posts`;
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch {
      return 0;
    }
  }

  private async getPostTimeAndTopic(tweetId: string): Promise<{ postedAt: Date; topic: string } | null> {
    try {
      const { data } = await this.db.safeSelect(
        'monitored_posts',
        'posted_at, topic',
        { tweet_id: tweetId },
        { limit: 1 }
      );
      
      if (data && data.length > 0) {
        return {
          postedAt: new Date(data[0].posted_at),
          topic: data[0].topic
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private formatBestHours(hourlyPerf: Record<number, any>): string {
    return Object.entries(hourlyPerf)
      .filter(([_, data]) => data.posts >= this.MIN_DATA_THRESHOLD)
      .sort(([_, a], [__, b]) => b.avgEngagement - a.avgEngagement)
      .slice(0, 5)
      .map(([hour, data]) => `${hour}:00 (${data.avgEngagement.toFixed(1)}%)`)
      .join(', ');
  }

  private formatBestDays(dailyPerf: Record<number, any>): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Object.entries(dailyPerf)
      .filter(([_, data]) => data.posts >= this.MIN_DATA_THRESHOLD)
      .sort(([_, a], [__, b]) => b.avgEngagement - a.avgEngagement)
      .slice(0, 4)
      .map(([day, data]) => `${dayNames[parseInt(day)]} (${data.avgEngagement.toFixed(1)}%)`)
      .join(', ');
  }

  private formatTopPerformers(topPerformers: Array<{ time: Date; engagement: number; topic: string }>): string {
    return topPerformers
      .slice(0, 3)
      .map(p => `${p.time.getHours()}:00 ${p.topic} (${p.engagement.toFixed(1)}%)`)
      .join(', ');
  }

  private getHighCompetitionHours(competition: Record<number, number>): string {
    return Object.entries(competition)
      .filter(([_, level]) => level > 0.8)
      .map(([hour, _]) => `${hour}:00`)
      .join(', ');
  }

  private getLowCompetitionHours(competition: Record<number, number>): string {
    return Object.entries(competition)
      .filter(([_, level]) => level < 0.5)
      .map(([hour, _]) => `${hour}:00`)
      .join(', ');
  }

  private async getRecentPerformancePatterns(): Promise<any[]> {
    try {
      const { data } = await this.db.safeSelect(
        'performance_patterns',
        '*',
        {},
        { limit: 50, orderBy: 'timestamp', ascending: false }
      );
      
      return data || [];
    } catch {
      return [];
    }
  }

  private async analyzeCurrentCompetition(): Promise<Record<number, number>> {
    // In production, this could analyze current Twitter activity levels
    return this.getCompetitionLevels();
  }

  private async storePrediction(prediction: TimingPrediction, context: TimingContext): Promise<void> {
    try {
      const predictionData = {
        prediction_time: new Date().toISOString(),
        recommended_time: prediction.recommendedTime.toISOString(),
        confidence: prediction.confidence,
        reasoning: prediction.reasoning,
        optimization_score: prediction.optimizationScore,
        context: JSON.stringify(context),
        factors: JSON.stringify(prediction.factors)
      };
      
      await this.db.safeInsert('timing_predictions', predictionData);
    } catch (error) {
      console.warn('⚠️ Failed to store timing prediction:', error);
    }
  }

  private getFallbackTimingPrediction(context: TimingContext): TimingPrediction {
    const now = new Date();
    
    // Default to posting in 3-4 hours, during typical engagement windows
    const fallbackHours = context.urgency === 'high' ? 2 : 
                         context.urgency === 'medium' ? 3 : 4;
    
    const recommendedTime = new Date(now.getTime() + fallbackHours * 60 * 60 * 1000);
    
    // Adjust to reasonable hours (9 AM - 9 PM)
    if (recommendedTime.getHours() < 9) {
      recommendedTime.setHours(9, 0, 0, 0);
    } else if (recommendedTime.getHours() > 21) {
      recommendedTime.setDate(recommendedTime.getDate() + 1);
      recommendedTime.setHours(9, 0, 0, 0);
    }
    
    return {
      recommendedTime,
      confidence: 50,
      reasoning: 'Fallback timing based on general best practices',
      alternativeTimes: [
        new Date(recommendedTime.getTime() + 2 * 60 * 60 * 1000),
        new Date(recommendedTime.getTime() + 4 * 60 * 60 * 1000)
      ],
      factors: ['fallback_timing'],
      optimizationScore: 50
    };
  }
}

export default IntelligentTimingEngine;
