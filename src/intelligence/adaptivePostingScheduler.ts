/**
 * 🧠 ADAPTIVE POSTING SCHEDULER
 * 
 * Intelligent posting system that dynamically determines optimal posting times based on:
 * - Real-time trending topics and viral content
 * - Audience activity patterns and engagement data
 * - Breaking news cycles and health-related events
 * - Platform-wide activity and algorithm behavior
 * - Historical performance analytics
 */

import { DatabaseManager } from '../lib/db';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

interface PostingOpportunity {
  score: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  suggestedDelay: number; // minutes
  contentHints: string[];
}

interface TrendAnalysis {
  topic: string;
  momentum: number;
  relevanceToHealth: number;
  competition: number;
  opportunity: number;
}

interface EngagementWindow {
  startHour: number;
  endHour: number;
  averageEngagement: number;
  followerActivity: number;
  optimalFrequency: number; // posts per hour
}

export class AdaptivePostingScheduler {
  private static instance: AdaptivePostingScheduler;
  private db: AdvancedDatabaseManager;
  private nextScheduledCheck: Date;
  private currentStrategy: 'trending' | 'engagement' | 'breaking_news' | 'routine' = 'routine';
  
  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
    this.nextScheduledCheck = new Date(Date.now() + 5 * 60 * 1000); // Check every 5 minutes
  }

  public static getInstance(): AdaptivePostingScheduler {
    if (!AdaptivePostingScheduler.instance) {
      AdaptivePostingScheduler.instance = new AdaptivePostingScheduler();
    }
    return AdaptivePostingScheduler.instance;
  }

  /**
   * Main intelligence function: Should we post now?
   */
  public async shouldPostNow(): Promise<PostingOpportunity> {
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    
    // Use intelligent logging to prevent spam
    const { logInfo } = await import('../utils/intelligentLogging');
    logInfo('🧠 Analyzing optimal posting opportunity...');

    // Parallel analysis of multiple factors
    const [
      trendingAnalysis,
      engagementWindow,
      recentPerformance,
      audienceActivity,
      competitorActivity
    ] = await Promise.all([
      this.analyzeTrendingTopics(),
      this.getCurrentEngagementWindow(),
      this.getRecentPerformanceMetrics(),
      this.analyzeAudienceActivity(),
      this.analyzeCompetitorActivity()
    ]);

    // Calculate posting opportunity score
    let opportunity: PostingOpportunity = {
      score: 0,
      reason: '',
      urgency: 'low',
      suggestedDelay: 180, // Default: 3 hours
      contentHints: []
    };

    // 1. TRENDING TOPICS BOOST (0-40 points)
    if (trendingAnalysis.length > 0) {
      const bestTrend = trendingAnalysis[0];
      const trendScore = bestTrend.opportunity * 40;
      opportunity.score += trendScore;
      
      if (trendScore > 30) {
        opportunity.urgency = 'high';
        opportunity.suggestedDelay = 5; // Post in 5 minutes
        opportunity.reason += `🔥 Trending: ${bestTrend.topic} (${Math.round(trendScore)}pts). `;
        opportunity.contentHints.push(`Create content about ${bestTrend.topic}`);
      }
    }

    // 2. ENGAGEMENT WINDOW (0-30 points)
    if (engagementWindow) {
      const windowScore = this.calculateEngagementScore(currentHour, engagementWindow);
      opportunity.score += windowScore;
      
      if (windowScore > 20) {
        opportunity.reason += `⏰ Peak engagement window (${Math.round(windowScore)}pts). `;
        
        // High activity window - post more frequently
        if (engagementWindow.optimalFrequency > 1) {
          opportunity.suggestedDelay = Math.max(15, 60 / engagementWindow.optimalFrequency);
          opportunity.urgency = 'medium';
        }
      }
    }

    // 3. BREAKING NEWS OPPORTUNITY (0-50 points)
    const breakingNewsScore = await this.analyzeBreakingNews();
    if (breakingNewsScore > 0) {
      opportunity.score += breakingNewsScore;
      
      if (breakingNewsScore > 35) {
        opportunity.urgency = 'critical';
        opportunity.suggestedDelay = 2; // Post immediately
        opportunity.reason += `🚨 Breaking health news opportunity (${Math.round(breakingNewsScore)}pts). `;
        opportunity.contentHints.push('React to breaking health news with expert insight');
      }
    }

    // 4. AUDIENCE ACTIVITY (0-25 points) - Increased from 20
    const audienceScore = audienceActivity.onlineFollowers * 25;
    opportunity.score += audienceScore;
    if (audienceScore > 15) {
      opportunity.reason += `👥 High audience activity (${Math.round(audienceScore)}pts). `;
    }

    // 5. LOW COMPETITION WINDOW (0-15 points)
    const competitionScore = Math.max(0, (1 - competitorActivity.recentPosts) * 15);
    opportunity.score += competitionScore;
    if (competitionScore > 10) {
      opportunity.reason += `🎯 Low competition window (${Math.round(competitionScore)}pts). `;
    }

    // 6. RECENCY PENALTY (-50 to 0 points)
    const timeSinceLastPost = await this.getTimeSinceLastPost();
    if (timeSinceLastPost < 30) { // Less than 30 minutes
      const penalty = -(50 - timeSinceLastPost * 1.5);
      opportunity.score += penalty;
      opportunity.reason += `⏳ Recent post penalty (${Math.round(penalty)}pts). `;
    }

    // Finalize decision
    if (opportunity.score > 70) {
      opportunity.urgency = 'critical';
      opportunity.suggestedDelay = Math.min(opportunity.suggestedDelay, 5);
    } else if (opportunity.score > 50) {
      opportunity.urgency = 'high';
      opportunity.suggestedDelay = Math.min(opportunity.suggestedDelay, 30);
    } else if (opportunity.score > 30) {
      opportunity.urgency = 'medium';
      opportunity.suggestedDelay = Math.min(opportunity.suggestedDelay, 90);
    }

    console.log(`🎯 Posting opportunity: ${Math.round(opportunity.score)}/100 - ${opportunity.urgency} - ${opportunity.reason}`);
    
    return opportunity;
  }

  /**
   * Analyze trending topics for health-related opportunities
   */
  private async analyzeTrendingTopics(): Promise<TrendAnalysis[]> {
    try {
      // This would integrate with Twitter Trends API, Google Trends, etc.
      // For now, simulate analysis based on stored data
      
      const trends = await this.db.executeQuery(
        'get_trending_analysis',
        async (client) => {
          const { data, error } = await client
            .from('trending_topics')
            .select('*')
            .order('momentum_score', { ascending: false })
            .limit(5);
          
          if (error) throw error;
          return data || [];
        }
      );

      return trends.map(trend => ({
        topic: trend.topic_name,
        momentum: trend.momentum_score || 0.5,
        relevanceToHealth: trend.health_relevance || 0.1,
        competition: trend.competition_level || 0.7,
        opportunity: trend.final_score || 0.2
      }));
    } catch (error) {
      console.warn('Failed to analyze trending topics:', error);
      return [];
    }
  }

  /**
   * Get current engagement window data with graceful fallback
   */
  private async getCurrentEngagementWindow(): Promise<EngagementWindow | null> {
    try {
      const currentHour = new Date().getHours();
      
      const windowData = await this.db.executeQuery(
        'get_engagement_window',
        async (client) => {
          const { data, error } = await client
            .from('optimal_posting_windows')
            .select('*')
            .eq('window_start', currentHour)
            .eq('day_of_week', new Date().getDay() || 7) // 1=Mon, 7=Sun
            .limit(1)
            .maybeSingle();
          
          if (error) throw error;
          return data;
        }
      );

      if (!windowData) return this.getDefaultEngagementWindow(currentHour);

      return {
        startHour: currentHour,
        endHour: (currentHour + 1) % 24,
        averageEngagement: windowData.avg_engagement || 0.1,
        followerActivity: windowData.effectiveness_score || 0.1,
        optimalFrequency: windowData.confidence || 0.33
      };
    } catch (error: any) {
      // Check for the specific "no rows returned" error
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        if (!this.hasLoggedEngagementWarning) {
          console.warn('⚠️ Engagement windows not seeded; using defaults');
          this.hasLoggedEngagementWarning = true;
        }
        return this.getDefaultEngagementWindow(new Date().getHours());
      }
      
      console.warn('Failed to get engagement window:', error);
      return this.getDefaultEngagementWindow(new Date().getHours());
    }
  }

  private hasLoggedEngagementWarning = false;

  /**
   * Get default engagement windows for local timezone
   */
  private getDefaultEngagementWindow(currentHour: number): EngagementWindow {
    // Default high-engagement windows: 9am, 12pm, 6pm
    const defaultWindows = [
      { hour: 9, engagement: 0.35, activity: 0.4, frequency: 0.5 },   // Morning peak
      { hour: 12, engagement: 0.4, activity: 0.45, frequency: 0.6 },  // Lunch peak
      { hour: 18, engagement: 0.45, activity: 0.5, frequency: 0.7 },  // Evening peak
      { hour: 20, engagement: 0.3, activity: 0.35, frequency: 0.4 },  // Night activity
    ];

    // Find closest window or use moderate defaults
    const closestWindow = defaultWindows.reduce((closest, window) => {
      const currentDist = Math.abs(currentHour - window.hour);
      const closestDist = Math.abs(currentHour - closest.hour);
      return currentDist < closestDist ? window : closest;
    });

    return {
      startHour: currentHour,
      endHour: (currentHour + 1) % 24,
      averageEngagement: closestWindow.engagement,
      followerActivity: closestWindow.activity,
      optimalFrequency: closestWindow.frequency
    };
  }

  /**
   * Analyze breaking news for health opportunities
   */
  private async analyzeBreakingNews(): Promise<number> {
    try {
      // This would integrate with news APIs to detect breaking health stories
      // For now, return base score
      return 0;
    } catch (error) {
      console.warn('Failed to analyze breaking news:', error);
      return 0;
    }
  }

  /**
   * Analyze current audience activity
   */
  private async analyzeAudienceActivity(): Promise<{ onlineFollowers: number; engagement: number }> {
    // This would analyze follower activity patterns
    // For now, return estimated activity based on time of day
    const hour = new Date().getHours();
    
    // Peak hours: 7-9 AM, 12-1 PM, 6-8 PM
    let activity = 0.3; // Base activity
    if ((hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20)) {
      activity = 0.8;
    } else if ((hour >= 10 && hour <= 11) || (hour >= 14 && hour <= 17) || (hour >= 19 && hour <= 21)) {
      activity = 0.6;
    }

    return {
      onlineFollowers: activity,
      engagement: activity * 0.9
    };
  }

  /**
   * Analyze competitor posting activity
   */
  private async analyzeCompetitorActivity(): Promise<{ recentPosts: number; engagement: number }> {
    // This would track competitor posting patterns
    // For now, simulate based on time patterns
    const hour = new Date().getHours();
    
    // Most creators post during business hours
    let competitorActivity = 0.3;
    if (hour >= 9 && hour <= 17) {
      competitorActivity = 0.8;
    } else if (hour >= 18 && hour <= 22) {
      competitorActivity = 0.6;
    }

    return {
      recentPosts: competitorActivity,
      engagement: competitorActivity * 0.7
    };
  }

  /**
   * Calculate how long since last post
   */
  private async getTimeSinceLastPost(): Promise<number> {
    try {
      const lastPost = await this.db.executeQuery(
        'get_last_post_time',
        async (client) => {
          const { data, error } = await client
            .from('tweets')
            .select('posted_at')
            .order('posted_at', { ascending: false })
            .limit(1)
            .single();
          
          if (error) throw error;
          return data;
        }
      );

      if (!lastPost) return 999; // No previous posts

      const timeDiff = Date.now() - new Date(lastPost.posted_at).getTime();
      return Math.floor(timeDiff / (1000 * 60)); // Minutes
    } catch (error) {
      console.warn('Failed to get last post time:', error);
      return 999;
    }
  }

  /**
   * Helper methods
   */
  private calculateHealthRelevance(topic: string): number {
    const healthKeywords = [
      'health', 'wellness', 'nutrition', 'fitness', 'mental health', 'sleep',
      'exercise', 'diet', 'medical', 'doctor', 'hospital', 'vaccine', 'medicine',
      'therapy', 'stress', 'anxiety', 'depression', 'mindfulness', 'meditation'
    ];
    
    const topicLower = topic.toLowerCase();
    const matches = healthKeywords.filter(keyword => topicLower.includes(keyword));
    return Math.min(1, matches.length * 0.3);
  }

  private calculateOpportunityScore(trend: any): number {
    const relevance = this.calculateHealthRelevance(trend.topic);
    const momentum = trend.momentum || 0.5;
    const competition = 1 - (trend.competition || 0.7);
    
    return (relevance * 0.4 + momentum * 0.4 + competition * 0.2);
  }

  private calculateEngagementScore(currentHour: number, window: EngagementWindow): number {
    // Increased scoring to make posting more likely
    return Math.min(30, window.averageEngagement * 40 + window.followerActivity * 30);
  }

  private calculateOptimalFrequency(windowData: any): number {
    const engagement = windowData.engagement_rate || 0.1;
    const activity = windowData.viral_score || 0.1;
    
    // High engagement windows allow more frequent posting
    if (engagement > 0.7 && activity > 0.7) return 4; // Every 15 minutes
    if (engagement > 0.5 && activity > 0.5) return 2; // Every 30 minutes
    if (engagement > 0.3) return 1; // Every hour
    return 0.33; // Every 3 hours
  }

  private async getRecentPerformanceMetrics(): Promise<any> {
    // Analyze recent post performance for timing optimization
    return { averageEngagement: 0.1, bestTimes: [9, 13, 19] };
  }

  /**
   * Get next recommended posting time
   */
  public async getNextPostingTime(): Promise<Date> {
    const opportunity = await this.shouldPostNow();
    return new Date(Date.now() + opportunity.suggestedDelay * 60 * 1000);
  }

  /**
   * Update strategy based on current conditions
   */
  public updateStrategy(strategy: 'trending' | 'engagement' | 'breaking_news' | 'routine'): void {
    this.currentStrategy = strategy;
    console.log(`📊 Posting strategy updated to: ${strategy}`);
  }
}