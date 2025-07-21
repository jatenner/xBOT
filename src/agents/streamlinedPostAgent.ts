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
import { supabaseClient } from '../utils/supabaseClient';
import { xClient } from '../utils/xClient';
import { viralFollowerGrowthAgent } from './viralFollowerGrowthAgent';
import { aggressiveEngagementAgent } from './aggressiveEngagementAgent';
import { followerGrowthLearner } from '../utils/followerGrowthLearner';

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
      // 0. UNIFIED POSTING COORDINATOR CHECK (Prevents burst posting)
      if (!forcePost) {
        const { unifiedPostingCoordinator } = await import('../utils/unifiedPostingCoordinator');
        const coordinatorDecision = await unifiedPostingCoordinator.canPostNow('StreamlinedPostAgent', 'high');
        
        if (!coordinatorDecision.canPost) {
          console.log(`🚨 COORDINATOR BLOCK: ${coordinatorDecision.reason}`);
          return {
            success: false,
            reason: coordinatorDecision.reason,
            cost: 0
          };
        }
        
        console.log(`✅ COORDINATOR APPROVED: ${coordinatorDecision.reason}`);
      }

      // 1. Pre-flight checks
      const canPost = await this.performPreflightChecks(forcePost);
      if (!canPost.allowed) {
        return { success: false, reason: canPost.reason };
      }

      // 2. CHECK VIRAL SYSTEM CONFIGURATION
      console.log('🔥 Checking viral system configuration...');
      const { data: viralConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'viral_follower_growth_agent_enabled')
        .single() || { data: null };

      // Handle both string and object formats for viral config
      let viralEnabled = false;
      if (viralConfig?.value) {
        const value = viralConfig.value;
        if (typeof value === 'string') {
          viralEnabled = value === 'true';
        } else if (typeof value === 'object' && value !== null) {
          viralEnabled = value.enabled || value.force_active;
        } else {
          viralEnabled = Boolean(value);
        }
      }
      console.log(`🔥 Viral follower growth agent: ${viralEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);

      // 3. CHECK FOR ACADEMIC CONTENT BLOCKING
      const { data: blockConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'block_academic_content')
        .single() || { data: null };

      // Handle both string and object formats for block config
      let blockAcademic = false;
      if (blockConfig?.value) {
        const value = blockConfig.value;
        if (typeof value === 'string') {
          blockAcademic = value === 'true';
        } else if (typeof value === 'object' && value !== null) {
          blockAcademic = value.enabled;
        } else {
          blockAcademic = Boolean(value);
        }
      }
      console.log(`🚫 Block academic content: ${blockAcademic ? '✅ ACTIVE' : '❌ INACTIVE'}`);

      // 4. Get learning insights to optimize content generation
      const learningInsights = await followerGrowthLearner.getLearningInsights();
      console.log(`🧠 Applied ${learningInsights.success_patterns.length} success patterns and avoiding ${learningInsights.avoid_patterns.length} failed patterns`);

      // 5. Generate viral follower growth content with learning optimization
      let viralContent;
      if (viralEnabled) {
        console.log('🔥 Using VIRAL FOLLOWER GROWTH AGENT for content generation');
        viralContent = await viralFollowerGrowthAgent.generateViralContent();
        console.log(`🎯 Generated ${viralContent.contentType} content with ${viralContent.viralPotential}% viral potential`);
        console.log(`🔥 Engagement hooks: ${viralContent.engagementHooks.join(', ')}`);
        console.log(`📈 Follow triggers: ${viralContent.followTriggers.join(', ')}`);
        
        // Apply learning optimizations to content
        viralContent = await this.applyLearningOptimizations(viralContent, learningInsights);
      } else {
        console.log('⚠️ Viral agent disabled, falling back to viral health theme agent');
        viralContent = await viralHealthThemeAgent.generateViralHealthContent();
        console.log(`🎯 Generated ${viralContent.contentType} content`);
      }

      // 5. Get engagement strategy
      const engagementStrategy = await audienceEngagementEngine.getViralEngagementStrategy();
      console.log(`📈 Using ${engagementStrategy.contentFormat} format with ${engagementStrategy.followerGrowthPotential} viral potential`);

      // 6. Optimize content for engagement and ensure it's VIRAL not academic
      const optimizedContent = await this.optimizeForEngagement(viralContent, engagementStrategy);
      
      // 7. Verify content is NOT academic
      if (blockAcademic && this.isAcademicContent(optimizedContent)) {
        console.log('🚫 BLOCKED: Content detected as academic, regenerating viral content...');
        // Force regenerate with viral content
        const forceViralContent = await viralFollowerGrowthAgent.generateViralContent();
        const reoptimizedContent = await this.optimizeForEngagement(forceViralContent, engagementStrategy);
        console.log('🔥 REGENERATED: Using viral follower growth content instead');
        return this.processViralContent(reoptimizedContent, forceViralContent, engagementStrategy);
      }

      return this.processViralContent(optimizedContent, viralContent, engagementStrategy);

    } catch (error) {
      console.error('❌ StreamlinedPostAgent error:', error);
      return { success: false, reason: error.message };
    }
  }

  private async processViralContent(optimizedContent: string, viralContent: any, engagementStrategy: any): Promise<StreamlinedPostResult> {
    try {
      // Quality assurance
      const qualityCheck = await qualityEngine.analyzeContent(optimizedContent);
      if (!qualityCheck.overall.passed) {
        console.log(`❌ Quality check failed: ${qualityCheck.overall.issues.join(', ')}`);
        return { success: false, reason: `Quality check failed: ${qualityCheck.overall.issues.join(', ')}` };
      }

      // Post to Twitter
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
        
        // Store in database using FIXED storage system
        const { fixedSupabaseClient } = await import('../utils/fixedSupabaseClient');
        await fixedSupabaseClient.saveTweetToDatabase({
          tweet_id: result.tweetId,
          content: content,
          tweet_type: 'original',
          content_type: 'viral_health_theme',
          source_attribution: 'StreamlinedPostAgent',
          engagement_score: 90, // High score for viral content
          has_snap2health_cta: false,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0
        });

        // Record with unified coordinator to prevent burst posting
        const { unifiedPostingCoordinator } = await import('../utils/unifiedPostingCoordinator');
        await unifiedPostingCoordinator.recordPost('StreamlinedPostAgent', result.tweetId, content);
        
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
   * 🚫 CHECK IF CONTENT IS ACADEMIC
   */
  private isAcademicContent(content: string): boolean {
    const academicKeywords = [
      'study', 'research', 'clinical', 'analysis', 'algorithm', 
      'machine learning', 'data', 'findings', 'according to',
      'breakthrough', 'milestone', 'drug discovery', 'pharmaceutical',
      'patients', 'medical', 'healthcare ai', 'trial', 'evidence'
    ];
    
    const contentLower = content.toLowerCase();
    const academicMatches = academicKeywords.filter(keyword => 
      contentLower.includes(keyword)
    ).length;
    
    // If more than 2 academic keywords, consider it academic
    const isAcademic = academicMatches >= 2;
    
    if (isAcademic) {
      console.log(`🚫 Academic content detected: ${academicMatches} keywords found`);
      console.log(`🔍 Keywords: ${academicKeywords.filter(k => contentLower.includes(k)).join(', ')}`);
    }
    
    return isAcademic;
  }

  /**
   * 💾 STORE TWEET IN DATABASE
   */
  private async storeTweetInDatabase(tweetId: string, content: string): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .insert({
          tweet_id: tweetId,
          content: content,
          tweet_type: 'original',
          content_type: 'viral_health_theme',
          content_category: 'viral_theme',
          source_attribution: 'StreamlinedPostAgent',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Database storage error:', error);
        console.error('Error details:', error);
      } else {
        console.log(`✅ Tweet stored in database: ${tweetId}`);
      }

    } catch (error) {
      console.error('❌ Could not store tweet in database:', error);
    }
  }

  /**
   * 📊 TRACK VIRAL PERFORMANCE & LEARNING
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

      // 🧠 LEARNING INTEGRATION: Record this post for learning analysis
      await this.recordForLearning(tweetId, viralContent, engagementStrategy);

      console.log(`🧠 Post recorded for learning analysis`);

    } catch (error) {
      console.warn('Could not track viral performance:', error);
    }
  }

  /**
   * 🧠 APPLY LEARNING OPTIMIZATIONS TO CONTENT
   */
  private async applyLearningOptimizations(viralContent: any, learningInsights: any): Promise<any> {
    try {
      let optimizedContent = { ...viralContent };

      // Apply successful patterns
      for (const pattern of learningInsights.success_patterns) {
        if (pattern.pattern?.engagement_hooks?.includes('breaking_news_emoji') && 
            !optimizedContent.content.includes('🚨')) {
          optimizedContent.content = '🚨 ' + optimizedContent.content;
          console.log('🔥 Applied "Ever wonder why" hook from learning');
        }

        if (pattern.pattern?.viral_elements?.includes('shock_value') && 
            !optimizedContent.content.includes('shocking')) {
          // Don't modify content too aggressively, just boost viral potential
          optimizedContent.viralPotential = Math.min(100, optimizedContent.viralPotential + 10);
          console.log('📈 Boosted viral potential based on learning');
        }
      }

      // Avoid failed patterns
      for (const pattern of learningInsights.avoid_patterns) {
        if (pattern.pattern?.failed_elements?.includes('academic_language') && 
            (optimizedContent.content.includes('"Ever wonder why"') || optimizedContent.content.includes('"Ever wonder why"'))) {
          console.log('🚫 Avoiding academic language based on learning');
          optimizedContent.content = optimizedContent.content
            .replace(/"Ever wonder why"/gi, 'new data reveals')
            .replace(/"Ever wonder why"/gi, 'evidence suggests');
        }
      }

      console.log(`🧠 Learning optimizations applied to ${optimizedContent.contentType} content`);
      return optimizedContent;

    } catch (error) {
      console.warn('Failed to apply learning optimizations:', error);
      return viralContent; // Return original if optimization fails
    }
  }

  /**
   * 🧠 RECORD POST FOR LEARNING SYSTEM
   */
  private async recordForLearning(tweetId: string, viralContent: any, engagementStrategy: any): Promise<void> {
    try {
      // Check if learning is enabled
      const { data: learningConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'learning_enabled')
        .single() || { data: null };

      if (!learningConfig?.value?.enabled) {
        console.log('⚠️ Learning system disabled, skipping learning record');
        return;
      }

      // Record post for learning analysis with follower-growth focus
      const learningData = {
        tweet_id: tweetId,
        content_type: viralContent.contentType || 'unknown',
        viral_potential: viralContent.viralPotential || 0,
        engagement_strategy: engagementStrategy.contentFormat || 'standard',
        follow_triggers: viralContent.followTriggers || [],
        expected_engagement: engagementStrategy.followerGrowthPotential || 'medium',
        learning_timestamp: new Date().toISOString(),
        learning_status: 'pending_analysis',
        success_metrics: {
          target_followers: viralContent.viralPotential > 70 ? 5 : 2,
          target_engagement_rate: viralContent.viralPotential > 50 ? 5.0 : 3.0,
          viral_threshold: viralContent.viralPotential
        },
        optimization_goal: 'follower_growth_primary'
      };

      // Store in learning tracking (using bot_config as fallback storage)
      await supabaseClient.supabase?.from('bot_config').upsert({
        key: `learning_post_${tweetId}`,
        value: learningData,
        updated_at: new Date().toISOString()
      });

      console.log(`🎓 Post ${tweetId} recorded for follower-growth learning (${viralContent.contentType || 'unknown'}, ${viralContent.viralPotential || 0}% viral potential)`);
      
    } catch (error) {
      console.warn('Failed to record post for learning:', error);
    }
  }

  /**
   * 📅 GET DAILY POST COUNT
   */
  private async getDailyPostCount(): Promise<number> {
    try {
      if (!supabaseClient.supabase) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabaseClient.supabase
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
      if (!supabaseClient.supabase) return null;

      const { data } = await supabaseClient.supabase
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
      if (!supabaseClient.supabase) return null;

      // Get recent viral content performance
      const { data: recentPosts } = await supabaseClient.supabase
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