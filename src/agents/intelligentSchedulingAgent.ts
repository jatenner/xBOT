import { TimingOptimizationAgent } from './timingOptimizationAgent';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';
import { RealTimeTrendsAgent } from './realTimeTrendsAgent';
import { NewsAPIAgent } from './newsAPIAgent';
import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';

interface IntelligentSchedule {
  scheduledPosts: ScheduledPost[];
  totalDailyPosts: number;
  adaptiveReasons: string[];
  confidenceScore: number;
  nextReviewTime: Date;
}

interface ScheduledPost {
  scheduledTime: Date;
  priority: 'breaking' | 'trending' | 'optimal' | 'fill';
  contentType: 'news_reaction' | 'trend_insight' | 'original' | 'engagement_driven';
  triggerReason: string;
  estimatedEngagement: number;
  adaptiveFactors: AdaptiveFactor[];
}

interface AdaptiveFactor {
  factor: 'engagement_pattern' | 'news_cycle' | 'trending_topic' | 'day_pattern' | 'competition_analysis';
  impact: number; // -1 to 1
  reason: string;
}

interface SchedulingContext {
  currentEngagementPatterns: any[];
  breakingNews: any[];
  trendingTopics: any[];
  dayOfWeek: number;
  hour: number;
  historicalPerformance: any;
  competitorActivity: any[];
}

export class IntelligentSchedulingAgent {
  private timingAgent: TimingOptimizationAgent;
  private engagementTracker: RealTimeEngagementTracker;
  private trendsAgent: RealTimeTrendsAgent;
  private newsAgent: NewsAPIAgent;
  
  private currentSchedule: IntelligentSchedule | null = null;
  private lastScheduleUpdate: Date | null = null;
  private adaptiveHistory: Map<string, number> = new Map();

  constructor() {
    this.timingAgent = new TimingOptimizationAgent();
    this.engagementTracker = new RealTimeEngagementTracker();
    this.trendsAgent = new RealTimeTrendsAgent();
    this.newsAgent = new NewsAPIAgent();
  }

  /**
   * 🧠 Generate intelligent schedule based on real-time insights
   */
  async generateIntelligentSchedule(): Promise<IntelligentSchedule> {
    console.log('🧠 === INTELLIGENT SCHEDULING AGENT ACTIVATED ===');
    console.log('📊 Analyzing real-time patterns for optimal posting schedule...');

    try {
      // 1. Gather comprehensive context
      const context = await this.gatherSchedulingContext();
      
      // 2. Analyze current conditions
      const insights = await this.analyzeCurrentConditions(context);
      
      // 3. Generate adaptive schedule
      const schedule = await this.generateAdaptiveSchedule(context, insights);
      
      // 4. Validate and optimize
      const optimizedSchedule = await this.optimizeSchedule(schedule);
      
      // 5. Store for learning
      await this.storeSchedulingDecision(optimizedSchedule, context);
      
      this.currentSchedule = optimizedSchedule;
      this.lastScheduleUpdate = new Date();
      
      console.log('✅ INTELLIGENT SCHEDULE GENERATED:');
      console.log(`   📅 Posts scheduled: ${optimizedSchedule.scheduledPosts.length}`);
      console.log(`   🎯 Confidence: ${optimizedSchedule.confidenceScore}%`);
      console.log(`   🔄 Next review: ${optimizedSchedule.nextReviewTime.toLocaleString()}`);
      
      return optimizedSchedule;
      
    } catch (error) {
      console.error('❌ Intelligent scheduling failed:', error);
      return this.getFallbackSchedule();
    }
  }

  /**
   * 📊 Gather comprehensive scheduling context
   */
  private async gatherSchedulingContext(): Promise<SchedulingContext> {
    console.log('📊 Gathering scheduling intelligence...');
    
    const [
      engagementPatterns,
      breakingNews,
      trendingTopics,
      historicalPerformance
    ] = await Promise.all([
      this.engagementTracker.generateEngagementReport(),
      this.newsAgent.fetchBreakingNews(),
      this.trendsAgent.getTrendingHealthTopics(),
      this.timingAgent.run()
    ]);

    const now = new Date();
    
    return {
      currentEngagementPatterns: engagementPatterns?.topPerformers || [],
      breakingNews: breakingNews.slice(0, 5),
      trendingTopics: trendingTopics.slice(0, 8),
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      historicalPerformance,
      competitorActivity: [] // Could be enhanced with competitor analysis
    };
  }

  /**
   * 🔍 Analyze current conditions for scheduling decisions
   */
  private async analyzeCurrentConditions(context: SchedulingContext): Promise<any> {
    console.log('🔍 Analyzing current conditions with AI...');
    
    const analysisPrompt = `
    You are an expert social media strategist analyzing optimal posting times for a health tech Twitter account.
    
    Current Context:
    - Day: ${this.getDayName(context.dayOfWeek)}
    - Hour: ${context.hour}:00
    - Breaking News: ${context.breakingNews.length} health tech stories
    - Trending Topics: ${context.trendingTopics.map(t => t.name).join(', ')}
    - Recent Engagement: ${JSON.stringify(context.currentEngagementPatterns)}
    
    Analyze:
    1. Should we post more/less frequently today based on news cycles?
    2. What times are optimal given current trends and engagement patterns?
    3. How should we adapt to breaking news or viral trends?
    4. What content types should we prioritize?
    
    Return JSON with:
    {
      "recommendedFrequency": number (10-25 posts),
      "priorityTimes": ["HH:MM", ...],
      "adaptiveFactors": [{"factor": "...", "impact": 0.8, "reason": "..."}],
      "contentStrategy": "...",
      "confidenceScore": number (0-100)
    }
    `;

    try {
             const analysis = await openaiClient.generateResponse(analysisPrompt);
      
      return JSON.parse(analysis);
    } catch (error) {
      console.warn('AI analysis failed, using heuristics:', error);
      return this.getHeuristicAnalysis(context);
    }
  }

  /**
   * 📅 Generate adaptive schedule based on insights
   */
  private async generateAdaptiveSchedule(context: SchedulingContext, insights: any): Promise<IntelligentSchedule> {
    console.log('📅 Generating adaptive schedule...');
    
    const scheduledPosts: ScheduledPost[] = [];
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 30, 0, 0);
    
    // 1. Schedule breaking news reactions (highest priority)
    for (const news of context.breakingNews) {
      if (this.shouldReactToNews(news)) {
        const reactionTime = new Date(now.getTime() + Math.random() * 2 * 60 * 60 * 1000); // Within 2 hours
        
        scheduledPosts.push({
          scheduledTime: reactionTime,
          priority: 'breaking',
          contentType: 'news_reaction',
          triggerReason: `Breaking: ${news.title}`,
          estimatedEngagement: this.estimateNewsEngagement(news),
          adaptiveFactors: [{
            factor: 'news_cycle',
            impact: 0.9,
            reason: 'Breaking health tech news requires immediate response'
          }]
        });
      }
    }
    
    // 2. Schedule trend-based posts
    for (const trend of context.trendingTopics) {
      if (trend.relevanceScore > 0.7) {
        const trendTime = this.calculateOptimalTrendTime(trend, context);
        
        scheduledPosts.push({
          scheduledTime: trendTime,
          priority: 'trending',
          contentType: 'trend_insight',
          triggerReason: `Trending: ${trend.name}`,
          estimatedEngagement: trend.volume * 0.001,
          adaptiveFactors: [{
            factor: 'trending_topic',
            impact: trend.relevanceScore,
            reason: `Capitalize on trending topic: ${trend.name}`
          }]
        });
      }
    }
    
    // 3. Fill optimal time slots with regular content
    const optimalTimes = insights.priorityTimes || this.getDefaultOptimalTimes(context);
    const remainingSlots = Math.max(0, insights.recommendedFrequency - scheduledPosts.length);
    
    for (let i = 0; i < remainingSlots; i++) {
      const timeSlot = optimalTimes[i % optimalTimes.length];
      const postTime = this.parseTimeSlot(timeSlot, now);
      
      if (postTime > now && postTime < endOfDay) {
        scheduledPosts.push({
          scheduledTime: postTime,
          priority: 'optimal',
          contentType: 'original',
          triggerReason: `Optimal engagement time: ${timeSlot}`,
          estimatedEngagement: this.estimateTimeSlotEngagement(postTime, context),
          adaptiveFactors: [{
            factor: 'engagement_pattern',
            impact: 0.7,
            reason: `Historical high engagement at ${timeSlot}`
          }]
        });
      }
    }
    
    // Sort by scheduled time
    scheduledPosts.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    
    return {
      scheduledPosts,
      totalDailyPosts: scheduledPosts.length,
      adaptiveReasons: this.generateAdaptiveReasons(scheduledPosts, context),
      confidenceScore: insights.confidenceScore || 75,
      nextReviewTime: new Date(now.getTime() + 4 * 60 * 60 * 1000) // Review every 4 hours
    };
  }

  /**
   * ⚡ Should we post right now based on current conditions?
   */
  async shouldPostNow(): Promise<{shouldPost: boolean, reason: string, urgency: number}> {
    const context = await this.gatherSchedulingContext();
    const now = new Date();
    
    // Check for breaking news
    const recentBreaking = context.breakingNews.filter(news => 
      new Date(news.publishedAt) > new Date(now.getTime() - 30 * 60 * 1000) // Last 30 minutes
    );
    
    if (recentBreaking.length > 0) {
      return {
        shouldPost: true,
        reason: `Breaking news: ${recentBreaking[0].title}`,
        urgency: 0.9
      };
    }
    
    // Check if we're in an optimal time window
    const isOptimalTime = await this.timingAgent.shouldPostNow();
    
    if (isOptimalTime.shouldPost && isOptimalTime.confidence > 0.7) {
      return {
        shouldPost: true,
        reason: isOptimalTime.reason,
        urgency: isOptimalTime.confidence
      };
    }
    
    // Check if we're behind schedule
    const progress = await this.getDailyProgress();
    if (progress.isBehindSchedule) {
      return {
        shouldPost: true,
        reason: 'Catching up on daily posting schedule',
        urgency: 0.6
      };
    }
    
    return {
      shouldPost: false,
      reason: 'No urgent posting triggers detected',
      urgency: 0.2
    };
  }

  /**
   * 📈 Get current daily progress and recommendations
   */
  async getDailyProgress(): Promise<{
    postsCompleted: number,
    postsScheduled: number,
    targetPosts: number,
    isBehindSchedule: boolean,
    nextPostTime: Date | null,
    recommendations: string[]
  }> {
    // This would integrate with your daily posting manager
    const today = new Date().toISOString().split('T')[0];
    
    // Get actual posted count for today
    const postsToday = await this.getPostsToday();
    
    const schedule = this.currentSchedule || await this.generateIntelligentSchedule();
    const now = new Date();
    const upcomingPosts = schedule.scheduledPosts.filter(post => post.scheduledTime > now);
    
    const targetPosts = schedule.totalDailyPosts;
    const isBehindSchedule = postsToday < (targetPosts * this.getDayProgress());
    
    return {
      postsCompleted: postsToday,
      postsScheduled: upcomingPosts.length,
      targetPosts,
      isBehindSchedule,
      nextPostTime: upcomingPosts[0]?.scheduledTime || null,
      recommendations: this.generateProgressRecommendations(postsToday, targetPosts, isBehindSchedule)
    };
  }

  // Helper methods
  private shouldReactToNews(news: any): boolean {
    const publishTime = new Date(news.publishedAt);
    const hoursSincePublished = (Date.now() - publishTime.getTime()) / (1000 * 60 * 60);
    return hoursSincePublished < 4 && news.healthTechRelevance > 0.7;
  }

  private estimateNewsEngagement(news: any): number {
    return news.healthTechRelevance * 15; // Estimated likes/retweets
  }

  private calculateOptimalTrendTime(trend: any, context: SchedulingContext): Date {
    const now = new Date();
    const baseTime = now.getTime() + Math.random() * 6 * 60 * 60 * 1000; // Within 6 hours
    return new Date(baseTime);
  }

  private getDefaultOptimalTimes(context: SchedulingContext): string[] {
    const dayOptimalTimes = {
      0: ['10:00', '14:00', '19:00'], // Sunday
      1: ['09:00', '13:00', '17:00'], // Monday
      2: ['09:30', '13:30', '17:30'], // Tuesday
      3: ['10:00', '14:00', '18:00'], // Wednesday
      4: ['09:00', '13:00', '17:00'], // Thursday
      5: ['10:00', '15:00', '19:00'], // Friday
      6: ['11:00', '15:00', '20:00']  // Saturday
    };
    
    return dayOptimalTimes[context.dayOfWeek] || dayOptimalTimes[1];
  }

  private parseTimeSlot(timeSlot: string, baseDate: Date): Date {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private estimateTimeSlotEngagement(time: Date, context: SchedulingContext): number {
    const hour = time.getHours();
    const peakHours = [9, 10, 11, 13, 14, 15, 17, 19, 20];
    return peakHours.includes(hour) ? 12 : 8;
  }

  private generateAdaptiveReasons(posts: ScheduledPost[], context: SchedulingContext): string[] {
    const reasons = [];
    
    if (context.breakingNews.length > 0) {
      reasons.push(`Adapted for ${context.breakingNews.length} breaking news stories`);
    }
    
    if (context.trendingTopics.length > 0) {
      reasons.push(`Optimized for ${context.trendingTopics.length} trending topics`);
    }
    
    const dayName = this.getDayName(context.dayOfWeek);
    reasons.push(`${dayName} posting pattern applied`);
    
    return reasons;
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  private getDayProgress(): number {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(6, 0, 0, 0); // Assume posting day starts at 6 AM
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 0, 0, 0); // Ends at 11 PM
    
    const totalDayMinutes = (endOfDay.getTime() - startOfDay.getTime()) / (1000 * 60);
    const elapsedMinutes = (now.getTime() - startOfDay.getTime()) / (1000 * 60);
    
    return Math.max(0, Math.min(1, elapsedMinutes / totalDayMinutes));
  }

  private async getPostsToday(): Promise<number> {
    // This would query your database for today's posts
    // For now, return a simulated value
    return Math.floor(Math.random() * 8) + 2;
  }

  private generateProgressRecommendations(completed: number, target: number, behind: boolean): string[] {
    const recommendations = [];
    
    if (behind) {
      recommendations.push('Consider posting during next optimal time window');
      recommendations.push('Focus on high-engagement content types');
    } else {
      recommendations.push('On track with posting schedule');
      recommendations.push('Maintain current posting quality');
    }
    
    return recommendations;
  }

  private getHeuristicAnalysis(context: SchedulingContext): any {
    return {
      recommendedFrequency: 17,
      priorityTimes: this.getDefaultOptimalTimes(context),
      adaptiveFactors: [],
      contentStrategy: 'balanced',
      confidenceScore: 60
    };
  }

  private async optimizeSchedule(schedule: IntelligentSchedule): Promise<IntelligentSchedule> {
    // Add optimization logic here
    return schedule;
  }

  private async storeSchedulingDecision(schedule: IntelligentSchedule, context: SchedulingContext): Promise<void> {
    // Store decision for learning
  }

  private getFallbackSchedule(): IntelligentSchedule {
    const now = new Date();
    return {
      scheduledPosts: [],
      totalDailyPosts: 17,
      adaptiveReasons: ['Using fallback schedule'],
      confidenceScore: 50,
      nextReviewTime: new Date(now.getTime() + 4 * 60 * 60 * 1000)
    };
  }
} 