import { TimingOptimizationAgent } from './timingOptimizationAgent';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';
import { RealTimeTrendsAgent } from './realTimeTrendsAgent';
import { NewsAPIAgent } from './newsAPIAgent';
import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';
import { intelligenceCache } from '../utils/intelligenceCache';
import { RealTimeLimitsIntelligenceAgent } from './realTimeLimitsIntelligenceAgent';
import { dailyPostingManager } from '../utils/dailyPostingManager';

interface StrategicOpportunity {
  type: 'breaking_news' | 'viral_trend' | 'peak_engagement' | 'competitor_gap' | 'audience_surge';
  urgency: number; // 0-1
  window: number; // minutes to act
  estimatedEngagement: number;
  reason: string;
  contentHint: string;
  postCount: number; // 1-4 posts recommended
}

interface StrategicSchedule {
  opportunities: StrategicOpportunity[];
  totalRecommendedPosts: number;
  confidenceScore: number;
  nextOpportunityTime: Date | null;
  strategicReasons: string[];
}

export class StrategicOpportunityScheduler {
  private realTimeLimitsAgent: RealTimeLimitsIntelligenceAgent;
  private timingAgent: TimingOptimizationAgent;
  private dailyManager = dailyPostingManager;
  private engagementTracker: RealTimeEngagementTracker;
  private trendsAgent: RealTimeTrendsAgent;
  private newsAgent: NewsAPIAgent;
  
  private currentOpportunities: StrategicOpportunity[] = [];
  private lastOpportunityCheck: Date | null = null;

  constructor() {
    this.realTimeLimitsAgent = new RealTimeLimitsIntelligenceAgent();
    this.timingAgent = new TimingOptimizationAgent();
    this.engagementTracker = new RealTimeEngagementTracker();
    this.trendsAgent = new RealTimeTrendsAgent();
    this.newsAgent = NewsAPIAgent.getInstance();
  }

  /**
   * 🎯 STRATEGIC CORE: Analyze real-time conditions and recommend posting strategy
   */
  async analyzeStrategicOpportunities(): Promise<StrategicSchedule> {
    console.log('🎯 ANALYZING STRATEGIC OPPORTUNITIES...');
    
    const now = new Date();
    const opportunities: StrategicOpportunity[] = [];
    
    // 🚨 1. BREAKING NEWS OPPORTUNITIES (Highest Priority)
    const breakingOpportunities = await this.analyzeBreakingNews();
    opportunities.push(...breakingOpportunities);
    
    // 🔥 2. VIRAL TREND OPPORTUNITIES  
    const trendOpportunities = await this.analyzeViralTrends();
    opportunities.push(...trendOpportunities);
    
    // 📈 3. PEAK ENGAGEMENT WINDOWS
    const engagementOpportunities = await this.analyzeEngagementWindows();
    opportunities.push(...engagementOpportunities);
    
    // 🎯 4. COMPETITOR GAP ANALYSIS
    const competitorOpportunities = await this.analyzeCompetitorGaps();
    opportunities.push(...competitorOpportunities);
    
    // 👥 5. AUDIENCE SURGE DETECTION
    const audienceOpportunities = await this.analyzeAudienceSurges();
    opportunities.push(...audienceOpportunities);
    
    // Sort by urgency and strategic value
    opportunities.sort((a, b) => (b.urgency * b.estimatedEngagement) - (a.urgency * a.estimatedEngagement));
    
    const totalPosts = opportunities.reduce((sum, opp) => sum + opp.postCount, 0);
    const strategicReasons = this.generateStrategicReasons(opportunities);
    
    console.log(`🎯 STRATEGIC ANALYSIS COMPLETE:`);
    console.log(`   📊 ${opportunities.length} opportunities identified`);
    console.log(`   📝 ${totalPosts} strategic posts recommended`);
    console.log(`   🔥 Reasons: ${strategicReasons.join(', ')}`);
    
    return {
      opportunities: opportunities.slice(0, 8), // Top 8 opportunities
      totalRecommendedPosts: Math.min(totalPosts, 17), // Cap at daily limit
      confidenceScore: this.calculateConfidenceScore(opportunities),
      nextOpportunityTime: this.getNextOpportunityTime(opportunities),
      strategicReasons
    };
  }

  /**
   * 🚨 BREAKING NEWS ANALYSIS: React fast to health tech news
   */
  private async analyzeBreakingNews(): Promise<StrategicOpportunity[]> {
    const opportunities: StrategicOpportunity[] = [];
    
    try {
      const breakingNews = await intelligenceCache.getOrFetch(
        `breaking-news-${new Date().toISOString().split('T')[0]}`,
        'news',
        () => this.newsAgent.fetchBreakingNews()
      );
      
      for (const news of breakingNews.slice(0, 3)) {
        const publishTime = new Date(news.publishedAt);
        const hoursOld = (Date.now() - publishTime.getTime()) / (1000 * 60 * 60);
        
        // Breaking news is most valuable in first 4 hours
        if (hoursOld < 4) {
          const urgency = Math.max(0.1, 1 - (hoursOld / 4)); // Decreases over time
          const postCount = hoursOld < 1 ? 3 : hoursOld < 2 ? 2 : 1; // More posts for fresher news
          
          opportunities.push({
            type: 'breaking_news',
            urgency,
            window: Math.max(30, 240 - (hoursOld * 60)), // Shrinking window
            estimatedEngagement: 25 + (urgency * 20),
            reason: `Breaking: ${news.title}`,
            contentHint: `React to: ${news.title}`,
            postCount
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Breaking news analysis failed:', error);
    }
    
    return opportunities;
  }

  /**
   * 🔥 VIRAL TREND ANALYSIS: Capitalize on trending topics
   */
  private async analyzeViralTrends(): Promise<StrategicOpportunity[]> {
    const opportunities: StrategicOpportunity[] = [];
    
    try {
      const trends = await intelligenceCache.getOrFetch(
        `viral-trends-${new Date().getHours()}`,
        'trends',
        () => this.trendsAgent.getTrendingHealthTopics()
      );
      
      for (const trend of trends.slice(0, 5)) {
        // Analyze trend volume and health tech relevance
        const volumeScore = Math.min(1, (trend.volume || 1000) / 10000); // Normalize volume
        const relevance = trend.relevanceScore || 0.3;
        const urgency = volumeScore * relevance;
        
        if (urgency > 0.4) {
          const postCount = urgency > 0.8 ? 2 : 1; // More posts for highly viral trends
          
          opportunities.push({
            type: 'viral_trend',
            urgency,
            window: 360, // 6 hour window for trends
            estimatedEngagement: 15 + (urgency * 25),
            reason: `Trending: ${trend.name}`,
            contentHint: `Trend insight: ${trend.name}`,
            postCount
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Trend analysis failed:', error);
    }
    
    return opportunities;
  }

  /**
   * 📈 ENGAGEMENT WINDOW ANALYSIS: Post during peak audience activity
   */
  private async analyzeEngagementWindows(): Promise<StrategicOpportunity[]> {
    const opportunities: StrategicOpportunity[] = [];
    
    try {
      const currentHour = new Date().getHours();
      const timingData = await this.timingAgent.shouldPostNow();
      
      if (timingData.shouldPost && timingData.confidence > 0.6) {
        const urgency = timingData.confidence;
        const postCount = urgency > 0.9 ? 3 : urgency > 0.7 ? 2 : 1;
        
        opportunities.push({
          type: 'peak_engagement',
          urgency,
          window: 90, // 1.5 hour peak window
          estimatedEngagement: 12 + (urgency * 18),
          reason: `Peak engagement window: ${timingData.reason}`,
          contentHint: 'High-engagement content',
          postCount
        });
      }
    } catch (error) {
      console.warn('⚠️ Engagement analysis failed:', error);
    }
    
    return opportunities;
  }

  /**
   * 🎯 COMPETITOR GAP ANALYSIS: Post when competitors are quiet
   */
  private async analyzeCompetitorGaps(): Promise<StrategicOpportunity[]> {
    const opportunities: StrategicOpportunity[] = [];
    
    try {
      // Analyze when major health tech accounts haven't posted recently
      const competitorActivity = await this.getCompetitorActivity();
      const quietPeriod = this.detectQuietPeriod(competitorActivity);
      
      if (quietPeriod.isQuiet) {
        opportunities.push({
          type: 'competitor_gap',
          urgency: 0.6,
          window: 120, // 2 hour opportunity
          estimatedEngagement: 18,
          reason: `Competitor quiet period: ${quietPeriod.reason}`,
          contentHint: 'Thought leadership content',
          postCount: 2 // Take advantage with multiple posts
        });
      }
    } catch (error) {
      console.warn('⚠️ Competitor analysis failed:', error);
    }
    
    return opportunities;
  }

  /**
   * 👥 AUDIENCE SURGE ANALYSIS: Detect when your audience is highly active
   */
  private async analyzeAudienceSurges(): Promise<StrategicOpportunity[]> {
    const opportunities: StrategicOpportunity[] = [];
    
    try {
      const engagementData = await this.engagementTracker.generateEngagementReport();
      const recentEngagement = engagementData?.recentEngagement || 0;
      const averageEngagement = engagementData?.averageEngagement || 5;
      
      // Detect if current engagement is significantly above average
      const surgeFactor = recentEngagement / Math.max(averageEngagement, 1);
      
      if (surgeFactor > 1.5) { // 50% above average
        const urgency = Math.min(0.9, surgeFactor / 3);
        const postCount = surgeFactor > 2.5 ? 4 : surgeFactor > 2 ? 3 : 2;
        
        opportunities.push({
          type: 'audience_surge',
          urgency,
          window: 60, // 1 hour window
          estimatedEngagement: recentEngagement * 1.2,
          reason: `Audience surge detected: ${surgeFactor.toFixed(1)}x normal engagement`,
          contentHint: 'Viral-optimized content',
          postCount
        });
      }
    } catch (error) {
      console.warn('⚠️ Audience surge analysis failed:', error);
    }
    
    return opportunities;
  }

  /**
   * 🎯 STRATEGIC POSTING DECISION: Should we post right now?
   */
  async shouldPostStrategically(): Promise<{
    shouldPost: boolean,
    reason: string,
    urgency: number,
    recommendedPosts: number,
    contentHint: string
  }> {
    const schedule = await this.analyzeStrategicOpportunities();
    const now = new Date();
    
    // Find current opportunities
    const activeOpportunities = schedule.opportunities.filter(opp => {
      const windowEnd = new Date(now.getTime() + opp.window * 60 * 1000);
      return opp.urgency > 0.5 && windowEnd > now;
    });
    
    if (activeOpportunities.length > 0) {
      const bestOpportunity = activeOpportunities[0];
      
      return {
        shouldPost: true,
        reason: bestOpportunity.reason,
        urgency: bestOpportunity.urgency,
        recommendedPosts: bestOpportunity.postCount,
        contentHint: bestOpportunity.contentHint
      };
    }
    
    return {
      shouldPost: false,
      reason: 'No strategic opportunities detected',
      urgency: 0.1,
      recommendedPosts: 0,
      contentHint: 'standard'
    };
  }

  // Helper methods
  private generateStrategicReasons(opportunities: StrategicOpportunity[]): string[] {
    const reasons = [];
    
    const breakingCount = opportunities.filter(o => o.type === 'breaking_news').length;
    const trendCount = opportunities.filter(o => o.type === 'viral_trend').length;
    const peakCount = opportunities.filter(o => o.type === 'peak_engagement').length;
    
    if (breakingCount > 0) reasons.push(`${breakingCount} breaking news opportunities`);
    if (trendCount > 0) reasons.push(`${trendCount} viral trends`);
    if (peakCount > 0) reasons.push(`${peakCount} peak engagement windows`);
    
    return reasons;
  }

  private calculateConfidenceScore(opportunities: StrategicOpportunity[]): number {
    if (opportunities.length === 0) return 30;
    
    const avgUrgency = opportunities.reduce((sum, opp) => sum + opp.urgency, 0) / opportunities.length;
    const diversityBonus = Math.min(20, opportunities.length * 5);
    
    return Math.min(95, 50 + (avgUrgency * 30) + diversityBonus);
  }

  private getNextOpportunityTime(opportunities: StrategicOpportunity[]): Date | null {
    if (opportunities.length === 0) return null;
    
    // Return time when next high-urgency opportunity should be checked
    const now = new Date();
    return new Date(now.getTime() + 30 * 60 * 1000); // Check again in 30 minutes
  }

  private async getCompetitorActivity(): Promise<any> {
    // Placeholder for competitor analysis
    return { lastPost: new Date(Date.now() - 2 * 60 * 60 * 1000) }; // 2 hours ago
  }

  private detectQuietPeriod(activity: any): { isQuiet: boolean, reason: string } {
    const lastPost = new Date(activity.lastPost);
    const hoursQuiet = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
    
    return {
      isQuiet: hoursQuiet > 1.5,
      reason: `Competitors quiet for ${hoursQuiet.toFixed(1)} hours`
    };
  }
}

export const strategicOpportunityScheduler = new StrategicOpportunityScheduler(); 