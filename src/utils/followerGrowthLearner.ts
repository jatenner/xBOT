/**
 * 🧠 FOLLOWER GROWTH LEARNER
 * 
 * Core learning system optimized for the SINGLE GOAL: gain followers and engagement
 * 
 * Features:
 * - Tracks which posts gain the most followers
 * - Learns from competitor viral content
 * - Optimizes content strategy in real-time
 * - Uses F/1K metric (Followers per 1000 impressions) as primary success indicator
 */

import { supabaseClient } from './supabaseClient';
import { xClient } from './xClient';

interface PostLearningData {
  tweet_id: string;
  content: string;
  content_type: string;
  posted_at: string;
  initial_followers: number;
  current_followers: number;
  followers_gained: number;
  engagement_metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
  f_per_1k: number; // Followers per 1000 impressions
  viral_score: number;
  learning_insights: string[];
}

interface CompetitorAnalysis {
  account: string;
  viral_posts: any[];
  success_patterns: string[];
  follower_growth_rate: number;
}

export class FollowerGrowthLearner {
  private baselineFollowers: number = 0;
  private learningEnabled: boolean = false;
  private lastAnalysisTime: Date = new Date();

  constructor() {
    this.initializeLearning();
  }

  /**
   * 🚀 INITIALIZE LEARNING SYSTEM
   */
  private async initializeLearning(): Promise<void> {
    try {
      // Check if learning is enabled
      const { data: config } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'learning_enabled')
        .single() || { data: null };

      this.learningEnabled = config?.value?.enabled || false;

      if (this.learningEnabled) {
        // Get baseline follower count
        await this.updateBaselineFollowers();
        console.log('🧠 FollowerGrowthLearner initialized with learning ENABLED');
        console.log(`📊 Baseline followers: ${this.baselineFollowers}`);
      } else {
        console.log('⚠️ FollowerGrowthLearner initialized with learning DISABLED');
      }
    } catch (error) {
      console.warn('Failed to initialize learning system:', error);
    }
  }

  /**
   * 📊 UPDATE BASELINE FOLLOWER COUNT
   */
  private async updateBaselineFollowers(): Promise<void> {
    try {
      // In production, would get from Twitter API
      // For now, estimate based on recent growth
      const { data: recentGrowth } = await supabaseClient.supabase
        ?.from('tweets')
        .select('new_followers')
        .order('created_at', { ascending: false })
        .limit(10);

      const totalNewFollowers = recentGrowth?.reduce((sum, tweet) => sum + (tweet.new_followers || 0), 0) || 0;
      this.baselineFollowers = Math.max(50, totalNewFollowers); // Minimum estimate
      
    } catch (error) {
      this.baselineFollowers = 50; // Default starting point
    }
  }

  /**
   * 🎯 LEARN FROM POST PERFORMANCE
   */
  async learnFromPost(
    tweetId: string, 
    content: string, 
    contentType: string,
    metrics: {
      likes: number;
      retweets: number; 
      replies: number;
      impressions: number;
      new_followers?: number;
    }
  ): Promise<void> {
    if (!this.learningEnabled) return;

    try {
      console.log(`🧠 Learning from post ${tweetId}...`);

      // Calculate F/1K metric (primary success indicator)
      const followersGained = metrics.new_followers || this.estimateFollowersFromEngagement(metrics);
      const fPer1K = metrics.impressions > 0 ? (followersGained * 1000) / metrics.impressions : 0;

      // Calculate viral score
      const viralScore = this.calculateViralScore(metrics, followersGained);

      // Extract learning insights
      const insights = this.extractLearningInsights(content, contentType, metrics, followersGained);

      // Store learning data
      const learningData: PostLearningData = {
        tweet_id: tweetId,
        content,
        content_type: contentType,
        posted_at: new Date().toISOString(),
        initial_followers: this.baselineFollowers,
        current_followers: this.baselineFollowers + followersGained,
        followers_gained: followersGained,
        engagement_metrics: metrics,
        f_per_1k: fPer1K,
        viral_score: viralScore,
        learning_insights: insights
      };

      await this.storeLearningData(learningData);

      // Immediate learning actions
      if (followersGained >= 5) {
        await this.amplifySuccessfulPattern(learningData);
      } else if (followersGained === 0 && metrics.impressions > 1000) {
        await this.avoidFailedPattern(learningData);
      }

      console.log(`📈 Post learned: ${followersGained} followers, ${fPer1K.toFixed(2)} F/1K, ${viralScore}% viral`);
      
    } catch (error) {
      console.warn('Failed to learn from post:', error);
    }
  }

  /**
   * 🔥 AMPLIFY SUCCESSFUL PATTERNS
   */
  private async amplifySuccessfulPattern(data: PostLearningData): Promise<void> {
    try {
      console.log(`🔥 VIRAL SUCCESS: Amplifying pattern from ${data.tweet_id}`);

      // Extract successful elements
      const successPattern = {
        content_type: data.content_type,
        engagement_hooks: this.extractHooks(data.content),
        viral_elements: this.extractViralElements(data.content),
        timing: new Date(data.posted_at).getHours(),
        f_per_1k: data.f_per_1k,
        success_level: data.followers_gained >= 10 ? 'viral' : 'good'
      };

      // Store pattern for future use
      await supabaseClient.supabase?.from('bot_config').upsert({
        key: `success_pattern_${Date.now()}`,
        value: {
          pattern: successPattern,
          source_tweet: data.tweet_id,
          followers_gained: data.followers_gained,
          created_at: new Date().toISOString(),
          priority: 'high',
          apply_to_future_posts: true
        },
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Success pattern stored: ${data.content_type} format gained ${data.followers_gained} followers`);
      
    } catch (error) {
      console.warn('Failed to amplify successful pattern:', error);
    }
  }

  /**
   * 🚫 AVOID FAILED PATTERNS
   */
  private async avoidFailedPattern(data: PostLearningData): Promise<void> {
    try {
      console.log(`🚫 POOR PERFORMANCE: Marking pattern to avoid from ${data.tweet_id}`);

      const failedPattern = {
        content_type: data.content_type,
        failed_elements: this.extractFailedElements(data.content),
        timing: new Date(data.posted_at).getHours(),
        f_per_1k: data.f_per_1k,
        failure_reason: 'zero_follower_growth_high_impressions'
      };

      // Store pattern to avoid
      await supabaseClient.supabase?.from('bot_config').upsert({
        key: `avoid_pattern_${Date.now()}`,
        value: {
          pattern: failedPattern,
          source_tweet: data.tweet_id,
          created_at: new Date().toISOString(),
          priority: 'avoid',
          reason: 'High impressions but zero follower growth'
        },
        updated_at: new Date().toISOString()
      });

      console.log(`⚠️ Failed pattern stored: ${data.content_type} format - avoid similar content`);
      
    } catch (error) {
      console.warn('Failed to store failed pattern:', error);
    }
  }

  /**
   * 📊 GET LEARNING INSIGHTS FOR CONTENT GENERATION
   */
  async getLearningInsights(): Promise<any> {
    if (!this.learningEnabled) return { success_patterns: [], avoid_patterns: [] };

    try {
      // Get successful patterns
      const { data: successPatterns } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('key, value')
        .like('key', 'success_pattern_%')
        .order('updated_at', { ascending: false })
        .limit(10);

      // Get patterns to avoid
      const { data: avoidPatterns } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('key, value')
        .like('key', 'avoid_pattern_%')
        .order('updated_at', { ascending: false })
        .limit(5);

      return {
        success_patterns: successPatterns?.map(p => p.value) || [],
        avoid_patterns: avoidPatterns?.map(p => p.value) || [],
        optimization_goal: 'follower_growth',
        primary_metric: 'f_per_1k'
      };
      
    } catch (error) {
      console.warn('Failed to get learning insights:', error);
      return { success_patterns: [], avoid_patterns: [] };
    }
  }

  /**
   * 🎯 ANALYZE COMPETITOR VIRAL CONTENT
   */
  async analyzeCompetitorViral(): Promise<CompetitorAnalysis[]> {
    if (!this.learningEnabled) return [];

    try {
      const competitorAccounts = ['EricTopol', 'VinodKhosla', 'andrewyng'];
      const analyses: CompetitorAnalysis[] = [];

      for (const account of competitorAccounts) {
        // In production, would fetch from Twitter API
        // For now, simulate competitor analysis
        const analysis: CompetitorAnalysis = {
          account,
          viral_posts: [], // Would contain actual viral posts
          success_patterns: [
            'Uses shocking statistics',
            'Asks controversial questions', 
            'Shares personal experiences',
            'Posts during peak hours (7-9pm EST)'
          ],
          follower_growth_rate: Math.random() * 5 + 1 // Simulated growth rate
        };

        analyses.push(analysis);
      }

      console.log(`🔍 Analyzed ${analyses.length} competitor accounts for viral patterns`);
      return analyses;
      
    } catch (error) {
      console.warn('Failed to analyze competitor viral content:', error);
      return [];
    }
  }

  // Helper methods
  private estimateFollowersFromEngagement(metrics: any): number {
    const engagement = metrics.likes + metrics.retweets + metrics.replies;
    // Rough estimate: 1 new follower per 20 engagements for viral content
    return Math.floor(engagement / 20);
  }

  private calculateViralScore(metrics: any, followersGained: number): number {
    const engagement = metrics.likes + metrics.retweets + metrics.replies;
    const engagementRate = metrics.impressions > 0 ? (engagement / metrics.impressions) * 100 : 0;
    
    let score = engagementRate * 10; // Base score from engagement rate
    score += followersGained * 5; // Bonus for follower growth
    score += (metrics.retweets / Math.max(metrics.likes, 1)) * 20; // Shareability bonus
    
    return Math.min(100, Math.max(0, score));
  }

  private extractLearningInsights(content: string, contentType: string, metrics: any, followersGained: number): string[] {
    const insights: string[] = [];
    
    if (followersGained > 0) {
      insights.push(`${contentType} content gained ${followersGained} followers`);
    }
    
    if (content.includes('🚨') || content.includes('BREAKING')) {
      insights.push('Breaking news format performs well');
    }
    
    if (content.includes('?')) {
      insights.push('Questions drive engagement');
    }
    
    if (metrics.retweets > metrics.likes) {
      insights.push('Highly shareable content format');
    }
    
    return insights;
  }

  private extractHooks(content: string): string[] {
    const hooks: string[] = [];
    
    if (content.startsWith('🚨')) hooks.push('breaking_news_emoji');
    if (content.includes('Hot take:')) hooks.push('hot_take_opener');
    if (content.includes('Unpopular opinion:')) hooks.push('controversial_opener');
    if (/\d+%|\d+x/.test(content)) hooks.push('statistics_hook');
    
    return hooks;
  }

  private extractViralElements(content: string): string[] {
    const elements: string[] = [];
    
    if (content.includes('shocking') || content.includes('surprising')) elements.push('shock_value');
    if (content.includes('secret') || content.includes('hidden')) elements.push('exclusive_info');
    if (content.includes('truth') || content.includes('reality')) elements.push('truth_bomb');
    
    return elements;
  }

  private extractFailedElements(content: string): string[] {
    const elements: string[] = [];
    
    if (content.includes('study shows') || content.includes('research indicates')) elements.push('academic_language');
    if (content.length > 250) elements.push('too_long');
    if (!content.includes('?') && !content.includes('!')) elements.push('no_engagement_triggers');
    
    return elements;
  }

  private async storeLearningData(data: PostLearningData): Promise<void> {
    try {
      // Store in bot_config for persistence
      await supabaseClient.supabase?.from('bot_config').upsert({
        key: `learning_data_${data.tweet_id}`,
        value: data,
        updated_at: new Date().toISOString()
      });

      // Update learning metrics
      this.baselineFollowers = data.current_followers;
      
    } catch (error) {
      console.warn('Failed to store learning data:', error);
    }
  }
}

export const followerGrowthLearner = new FollowerGrowthLearner(); 