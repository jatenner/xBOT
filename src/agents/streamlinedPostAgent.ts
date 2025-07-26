/**
 * 🚀 STREAMLINED POST AGENT - VIRAL HEALTH THEME PAGE
 * 
 * Optimized for viral content and massive audience growth.
 * Focus: Health theme page that builds followers through engaging content.
 * 
 * Features:
 * - Viral health content generation
 * - Audience engagement optimization  
 * - Follower growth tactics
 * - Content variety and consistency
 * - Maximum shareability
 */

import { unifiedBudget } from '../utils/unifiedBudgetManager';
import { twitterRateLimits } from '../utils/twitterRateLimits';
import { qualityEngine } from '../utils/contentQualityEngine';
import { smartContentEngine } from '../utils/smartContentEngine';
import { viralHealthThemeAgent } from './viralHealthThemeAgent';
import { audienceEngagementEngine } from '../utils/audienceEngagementEngine';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { xClient } from '../utils/xClient';
import { viralFollowerGrowthAgent } from './viralFollowerGrowthAgent';
import { aggressiveEngagementAgent } from './aggressiveEngagementAgent';

export interface StreamlinedPostResult {
  success: boolean;
  content?: string;
  postId?: string;
  contentType?: string;
  engagementStrategy?: string;
  expectedEngagement?: string;
  reason?: string;
  cost?: number;
}

export class StreamlinedPostAgent {
  /**
   * 🎯 MAIN POSTING EXECUTION
   */
  async run(forcePost: boolean = false): Promise<StreamlinedPostResult> {
    console.log('🚀 === VIRAL HEALTH THEME PAGE - STREAMLINED POST AGENT ===');
    
    try {
      // 1. Pre-flight checks
      const canPost = await this.performPreflightChecks(forcePost);
      if (!canPost.allowed) {
        return { success: false, reason: canPost.reason };
      }

      // 2. Generate viral follower growth content
      const viralContent = await viralFollowerGrowthAgent.generateViralContent();
      console.log(`🎯 Generated ${viralContent.contentType} content with ${viralContent.viralPotential}% viral potential`);

      // 3. Get engagement strategy
      const engagementStrategy = await audienceEngagementEngine.getViralEngagementStrategy();
      console.log(`📈 Using ${engagementStrategy.contentFormat} format with ${engagementStrategy.followerGrowthPotential} viral potential`);

      // 4. Optimize content for engagement
      const optimizedContent = await this.optimizeForEngagement(viralContent, engagementStrategy);

      // 5. Quality assurance
      const qualityCheck = await qualityEngine.analyzeContent(optimizedContent);
      if (!qualityCheck.overall.passed) {
        console.log(`❌ Quality check failed: ${qualityCheck.overall.issues.join(', ')}`);
        return { success: false, reason: `Quality check failed: ${qualityCheck.overall.issues.join(', ')}` };
      }

      // 6. Post to Twitter
      const postResult = await this.postToTwitter(optimizedContent);
      if (!postResult.success) {
        return { success: false, reason: postResult.reason };
      }

      // 7. Track performance
      await this.trackViralPerformance(postResult.postId!, viralContent, engagementStrategy);

      console.log(`✅ VIRAL FOLLOWER GROWTH POST SUCCESSFUL!`);
      console.log(`📊 Content Type: ${viralContent.contentType}`);
      console.log(`🎯 Viral Potential: ${viralContent.viralPotential}%`);
      console.log(`📈 Growth Potential: ${engagementStrategy.followerGrowthPotential}`);

      return {
        success: true,
        content: optimizedContent,
        postId: postResult.postId,
        contentType: viralContent.contentType,
        engagementStrategy: engagementStrategy.contentFormat,
        expectedEngagement: `${viralContent.viralPotential}%`,
        cost: postResult.cost || 0
      };

    } catch (error) {
      console.error('❌ Streamlined posting failed:', error);
      return { 
        success: false, 
        reason: `Posting failed: ${error.message}`,
        cost: 0 
      };
    }
  }

  /**
   * ✅ PREFLIGHT CHECKS
   */
  private async performPreflightChecks(forcePost: boolean): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Budget check
      const budgetStatus = await unifiedBudget.canAfford({
        type: 'content_generation',
        estimatedCost: 0.50,
        priority: 'critical',
        fallbackAvailable: true
      });
      if (!budgetStatus.approved) {
        return { allowed: false, reason: `Budget limit: ${budgetStatus.reason}` };
      }

      // Rate limit check
      const rateLimitStatus = await twitterRateLimits.canPost();
      if (!rateLimitStatus.canPost && !forcePost) {
        return { allowed: false, reason: `Rate limit: ${rateLimitStatus.reason}` };
      }

      // Daily posting check (theme pages post 3-6 times per day)
      const dailyCount = await this.getDailyPostCount();
      if (dailyCount >= 6 && !forcePost) {
        return { allowed: false, reason: 'Daily limit of 6 viral posts reached (theme page optimization)' };
      }

      // Spacing check (minimum 2 hours between posts for theme pages)
      const lastPostTime = await this.getLastPostTime();
      if (lastPostTime) {
        const hoursSinceLastPost = (Date.now() - lastPostTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastPost < 2 && !forcePost) {
          return { allowed: false, reason: `Spacing: ${(2 - hoursSinceLastPost).toFixed(1)} hours until next post` };
        }
      }

      return { allowed: true };

    } catch (error) {
      console.error('❌ Preflight check error:', error);
      return { allowed: false, reason: 'System error during preflight checks' };
    }
  }

  /**
   * 🔥 OPTIMIZE FOR ENGAGEMENT
   */
  private async optimizeForEngagement(
    viralContent: any, 
    engagementStrategy: any
  ): Promise<string> {
    let content = viralContent.content;

    // Add viral hooks if content doesn't have them
    if (!this.hasViralHook(content)) {
      const hooks = audienceEngagementEngine.getViralContentHooks();
      const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
      content = `${randomHook}\n\n${content}`;
    }

    // Add engagement call-to-action
    const cta = audienceEngagementEngine.generateCallToAction(
      viralContent.contentType, 
      viralContent.expectedEngagement
    );
    
    // Add hashtags optimized for viral reach
    const viralHashtags = audienceEngagementEngine.getViralHashtags(viralContent.contentType);
    const hashtagString = viralHashtags.slice(0, 5).join(' ');

    // Ensure content is within Twitter limits
    const maxLength = 280 - hashtagString.length - cta.length - 10; // Buffer for spacing
    if (content.length > maxLength) {
      content = content.substring(0, maxLength - 3) + '...';
    }

    // Combine all elements
    const finalContent = `${content}\n\n${cta}\n\n${hashtagString}`;

    return finalContent;
  }

  /**
   * 🎯 CHECK FOR VIRAL HOOK
   */
  private hasViralHook(content: string): boolean {
    const viralIndicators = [
      'BREAKING:', 'JUST IN:', 'Did you know', '🔥', '💥', '⚡',
      'Plot twist:', 'Hot take:', 'Unpopular opinion:', 'Secret:',
      'Thread:', '🧵', 'Game-changer:', 'Mind-blowing'
    ];

    return viralIndicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * 🐦 POST TO TWITTER
   */
  private async postToTwitter(content: string): Promise<{ success: boolean; postId?: string; reason?: string; cost?: number }> {
    try {
      console.log('🐦 Posting viral health content to Twitter...');
      console.log(`📝 Content preview: ${content.substring(0, 100)}...`);

      // Record budget usage
      await unifiedBudget.recordSpending({
        type: 'content_generation',
        estimatedCost: 0.10,
        priority: 'critical',
        fallbackAvailable: false
      }, 0.10);

      // Post using X client
      const result = await xClient.postTweet(content);
      
      if (result.success && result.tweetId) {
        console.log(`✅ Posted successfully! Tweet ID: ${result.tweetId}`);
        
        // Store in database
        await this.storeTweetInDatabase(result.tweetId, content);
        
        return { 
          success: true, 
          postId: result.tweetId,
          cost: 0.10
        };
      } else {
        console.error('❌ Twitter posting failed:', result.error);
        return { 
          success: false, 
          reason: result.error || 'Unknown Twitter API error' 
        };
      }

    } catch (error) {
      console.error('❌ Twitter posting error:', error);
      return { 
        success: false, 
        reason: `Twitter API error: ${error.message}` 
      };
    }
  }

  /**
   * 💾 STORE TWEET IN DATABASE - ULTIMATE ARCHITECTURE
   */
  private async storeTweetInDatabase(tweetId: string, content: string): Promise<void> {
    try {
      console.log('🏗️ StreamlinedPostAgent using ULTIMATE STORAGE...');
      
      // Import Ultimate Storage Architecture
      const { MasterTweetStorageIntegrator } = await import('../utils/masterTweetStorageIntegrator');
      
      // Use Ultimate Storage with full validation
      const result = await MasterTweetStorageIntegrator.storeTweet({
        tweet_id: tweetId,
        content: content,
        content_type: 'viral_health_theme',
        viral_score: 7, // High viral score for streamlined content
        ai_optimized: true,
        generation_method: 'streamlined_viral'
      });

      if (result.success) {
        console.log(`✅ ULTIMATE STORAGE: Streamlined tweet stored! ID: ${result.database_id}`);
      } else {
        console.warn('⚠️ ULTIMATE STORAGE failed for streamlined tweet:', result.error);
        
        // Fallback to simple storage
        if (secureSupabaseClient.supabase) {
          await secureSupabaseClient.supabase
            .from('tweets')
            .insert({
              tweet_id: tweetId,
              content: content,
              content_type: 'viral_health_theme',
              created_at: new Date().toISOString(),
              viral_score: 7,
              ai_optimized: true,
              generation_method: 'streamlined_viral',
              success: true
            });
          console.log('✅ Fallback storage succeeded');
        }
      }

    } catch (error) {
      console.warn('❌ Storage error in StreamlinedPostAgent:', error);
    }
  }

  /**
   * 📊 TRACK VIRAL PERFORMANCE
   */
  private async trackViralPerformance(
    tweetId: string, 
    viralContent: any, 
    engagementStrategy: any
  ): Promise<void> {
    try {
      // Track with viral health theme agent
      await viralHealthThemeAgent.trackViralPerformance(viralContent, tweetId);

      // Track with audience engagement engine
      await audienceEngagementEngine.trackEngagementPerformance(
        tweetId,
        engagementStrategy,
        { likes: 0, retweets: 0, replies: 0 } // Initial values
      );

    } catch (error) {
      console.warn('Could not track viral performance:', error);
    }
  }

  /**
   * 📅 GET DAILY POST COUNT
   */
  private async getDailyPostCount(): Promise<number> {
    try {
      if (!secureSupabaseClient.supabase) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await secureSupabaseClient.supabase
        .from('tweets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      return count || 0;

    } catch (error) {
      console.warn('Could not get daily post count:', error);
      return 0;
    }
  }

  /**
   * ⏰ GET LAST POST TIME
   */
  private async getLastPostTime(): Promise<Date | null> {
    try {
      if (!secureSupabaseClient.supabase) return null;

      const { data } = await secureSupabaseClient.supabase
        .from('tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return new Date(data[0].created_at);
      }

      return null;

    } catch (error) {
      console.warn('Could not get last post time:', error);
      return null;
    }
  }

  /**
   * 📊 GET PERFORMANCE METRICS
   */
  async getPerformanceMetrics(): Promise<any> {
    try {
      if (!secureSupabaseClient.supabase) return null;

      // Get recent viral content performance
      const { data: recentPosts } = await secureSupabaseClient.supabase
        .from('tweets')
        .select('content, likes, retweets, replies, content_type')
        .eq('theme_page_content', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recentPosts) return null;

      const totalEngagement = recentPosts.reduce((sum, post) => 
        sum + (post.likes || 0) + (post.retweets || 0) + (post.replies || 0), 0
      );

      const averageEngagement = totalEngagement / recentPosts.length;
      const viralPosts = recentPosts.filter(post => 
        (post.likes || 0) + (post.retweets || 0) > 50
      );

      return {
        totalPosts: recentPosts.length,
        averageEngagement: averageEngagement.toFixed(1),
        viralPosts: viralPosts.length,
        engagementRate: ((totalEngagement / recentPosts.length) / 1000 * 100).toFixed(2) + '%',
        topContentTypes: this.getTopContentTypes(recentPosts)
      };

    } catch (error) {
      console.warn('Could not get performance metrics:', error);
      return null;
    }
  }

  /**
   * 📈 GET TOP CONTENT TYPES
   */
  private getTopContentTypes(posts: any[]): any[] {
    const contentTypeCount = {};
    posts.forEach(post => {
      const type = post.content_type || 'unknown';
      contentTypeCount[type] = (contentTypeCount[type] || 0) + 1;
    });

    return Object.entries(contentTypeCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * 🎯 FORCE VIRAL POST
   */
  async forceViralPost(contentType?: string): Promise<StreamlinedPostResult> {
    console.log('🔥 FORCING VIRAL HEALTH THEME POST...');
    return await this.run(true);
  }
}

export const streamlinedPostAgent = new StreamlinedPostAgent(); 