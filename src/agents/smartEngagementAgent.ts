/**
 * 🤝 SMART ENGAGEMENT AGENT (2024)
 * 
 * Intelligent Twitter engagement system for automated growth.
 * Performs strategic actions to build authentic health community connections.
 * 
 * Key Features:
 * - Smart health content targeting
 * - Intelligent follow/unfollow strategy
 * - Contextual reply generation
 * - Rate limit compliance
 * - Performance tracking
 * - Authentic engagement patterns
 */

import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { OpenAI } from 'openai';

interface EngagementTarget {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  followerCount: number;
  tweetId?: string;
  tweetContent?: string;
  engagementType: 'like' | 'follow' | 'reply' | 'retweet';
  relevanceScore: number;
  reasoning: string;
}

interface EngagementResult {
  success: boolean;
  action: string;
  targetId: string;
  details: string;
  error?: string;
}

interface DailyEngagementLimits {
  likes: number;
  follows: number;
  replies: number;
  retweets: number;
  maxLikes: number;
  maxFollows: number;
  maxReplies: number;
  maxRetweets: number;
  canEngage: boolean;
}

export class SmartEngagementAgent {
  private static readonly HEALTH_KEYWORDS = [
    'health', 'wellness', 'fitness', 'nutrition', 'diet', 'exercise', 'workout',
    'mental health', 'meditation', 'mindfulness', 'sleep', 'recovery', 'longevity',
    'supplements', 'vitamins', 'biohacking', 'metabolism', 'gut health', 'immunity',
    'intermittent fasting', 'keto', 'yoga', 'strength training', 'cardio'
  ];

  private static readonly HEALTH_INFLUENCERS = [
    'hubermanlab', 'drmarkhyman', 'peterattiamd', 'foundmyfitness', 'drdavinagel',
    'drkellyann', 'thedrleafblog', 'drjoshaxe', 'drfunctionalmed', 'bengreenfield'
  ];

  private static readonly DAILY_LIMITS = {
    likes: 200,      // Conservative limit
    follows: 50,     // Quality over quantity
    replies: 20,     // Thoughtful engagement
    retweets: 15     // Selective sharing
  };

  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🚀 RUN SMART ENGAGEMENT CYCLE
   * Execute daily engagement strategy
   */
  static async runEngagementCycle(): Promise<{
    success: boolean;
    actionsPerformed: EngagementResult[];
    limitsStatus: DailyEngagementLimits;
    summary: string;
  }> {
    try {
      console.log('🤝 === SMART ENGAGEMENT CYCLE STARTED ===');

      // Check current engagement limits
      const limitsStatus = await this.checkDailyLimits();
      console.log('📊 Daily Engagement Status:');
      console.log(`   ❤️  Likes: ${limitsStatus.likes}/${limitsStatus.maxLikes}`);
      console.log(`   👥 Follows: ${limitsStatus.follows}/${limitsStatus.maxFollows}`);
      console.log(`   💬 Replies: ${limitsStatus.replies}/${limitsStatus.maxReplies}`);
      console.log(`   🔄 Retweets: ${limitsStatus.retweets}/${limitsStatus.maxRetweets}`);

      if (!limitsStatus.canEngage) {
        console.log('⏸️ Daily engagement limits reached - skipping cycle');
        return {
          success: true,
          actionsPerformed: [],
          limitsStatus,
          summary: 'Daily engagement limits reached'
        };
      }

      const actionsPerformed: EngagementResult[] = [];

      // Step 1: Find engagement targets
      const targets = await this.findEngagementTargets();
      console.log(`🎯 Found ${targets.length} potential engagement targets`);

      // Step 2: Perform strategic likes
      if (limitsStatus.likes < limitsStatus.maxLikes) {
        const likeTargets = targets
          .filter(t => t.engagementType === 'like')
          .slice(0, Math.min(10, limitsStatus.maxLikes - limitsStatus.likes));

        for (const target of likeTargets) {
          const result = await this.performLike(target);
          actionsPerformed.push(result);
          if (result.success) {
            await this.recordEngagementAction(target, 'like', result.success);
          }
          await this.respectRateLimit(1000); // 1 second between likes
        }
      }

      // Step 3: Perform strategic follows
      if (limitsStatus.follows < limitsStatus.maxFollows) {
        const followTargets = targets
          .filter(t => t.engagementType === 'follow')
          .slice(0, Math.min(5, limitsStatus.maxFollows - limitsStatus.follows));

        for (const target of followTargets) {
          const result = await this.performFollow(target);
          actionsPerformed.push(result);
          if (result.success) {
            await this.recordEngagementAction(target, 'follow', result.success);
          }
          await this.respectRateLimit(3000); // 3 seconds between follows
        }
      }

      // Step 4: Generate thoughtful replies
      if (limitsStatus.replies < limitsStatus.maxReplies) {
        const replyTargets = targets
          .filter(t => t.engagementType === 'reply' && t.tweetContent)
          .slice(0, Math.min(3, limitsStatus.maxReplies - limitsStatus.replies));

        for (const target of replyTargets) {
          const result = await this.performReply(target);
          actionsPerformed.push(result);
          if (result.success) {
            await this.recordEngagementAction(target, 'reply', result.success);
          }
          await this.respectRateLimit(5000); // 5 seconds between replies
        }
      }

      // Step 5: Unfollow non-followbacks (weekly cleanup)
      await this.performUnfollowCleanup();

      const successfulActions = actionsPerformed.filter(a => a.success);
      const summary = `Performed ${successfulActions.length}/${actionsPerformed.length} successful engagement actions`;

      console.log('🎉 === SMART ENGAGEMENT CYCLE COMPLETED ===');
      console.log(`📊 Results: ${summary}`);

      return {
        success: true,
        actionsPerformed,
        limitsStatus,
        summary
      };

    } catch (error: any) {
      console.error('❌ Smart engagement cycle failed:', error);
      return {
        success: false,
        actionsPerformed: [],
        limitsStatus: await this.checkDailyLimits(),
        summary: `Engagement cycle failed: ${error.message}`
      };
    }
  }

  /**
   * 🎯 FIND ENGAGEMENT TARGETS
   * Identify high-value accounts and content for engagement
   */
  private static async findEngagementTargets(): Promise<EngagementTarget[]> {
    try {
      const targets: EngagementTarget[] = [];

      // Strategy 1: Search health influencer followers
      const influencerTargets = await this.findInfluencerFollowers();
      targets.push(...influencerTargets);

      // Strategy 2: Search health hashtag content
      const hashtagTargets = await this.findHashtagContent();
      targets.push(...hashtagTargets);

      // Strategy 3: Find users who engaged with our content
      const engagerTargets = await this.findContentEngagers();
      targets.push(...engagerTargets);

      // Score and sort by relevance
      const scoredTargets = targets
        .map(target => ({
          ...target,
          relevanceScore: this.calculateRelevanceScore(target)
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(`🎯 Generated ${scoredTargets.length} engagement targets`);
      return scoredTargets.slice(0, 50); // Limit to top 50 targets

    } catch (error: any) {
      console.error('❌ Failed to find engagement targets:', error);
      return [];
    }
  }

  /**
   * 👥 FIND INFLUENCER FOLLOWERS
   * Target followers of health influencers
   */
  private static async findInfluencerFollowers(): Promise<EngagementTarget[]> {
    try {
      // This would integrate with Twitter API to get followers
      // For now, return mock targets representing this strategy
      const mockTargets: EngagementTarget[] = [
        {
          userId: 'health_enthusiast_1',
          username: 'healthylife2024',
          displayName: 'Sarah | Health Coach',
          bio: 'Helping busy moms prioritize wellness 🌱 Nutrition tips daily',
          followerCount: 1200,
          engagementType: 'follow',
          relevanceScore: 0.85,
          reasoning: 'Health coach with engaged audience'
        },
        {
          userId: 'fitness_fanatic_2',
          username: 'strongfitness',
          displayName: 'Mike Fitness',
          bio: 'Personal trainer 💪 Science-based workouts',
          followerCount: 3400,
          engagementType: 'follow',
          relevanceScore: 0.82,
          reasoning: 'Fitness professional with aligned content'
        }
      ];

      console.log(`👥 Found ${mockTargets.length} influencer follower targets`);
      return mockTargets;

    } catch (error: any) {
      console.error('❌ Failed to find influencer followers:', error);
      return [];
    }
  }

  /**
   * #️⃣ FIND HASHTAG CONTENT
   * Target recent health hashtag posts
   */
  private static async findHashtagContent(): Promise<EngagementTarget[]> {
    try {
      // Mock targets representing health hashtag content
      const mockTargets: EngagementTarget[] = [
        {
          userId: 'wellness_tip_user',
          username: 'dailywellness',
          displayName: 'Daily Wellness Tips',
          tweetId: 'tweet_12345',
          tweetContent: 'Starting my day with lemon water and gratitude 🍋✨ #HealthTips #MorningRoutine',
          followerCount: 890,
          engagementType: 'like',
          relevanceScore: 0.75,
          reasoning: 'Health tip content aligned with our niche'
        },
        {
          userId: 'nutrition_expert',
          username: 'nutritionfacts',
          displayName: 'Nutrition Science',
          tweetId: 'tweet_67890',
          tweetContent: 'New study shows intermittent fasting may improve metabolic health in 8 weeks 📊 #IntermittentFasting #Health',
          followerCount: 5600,
          engagementType: 'reply',
          relevanceScore: 0.88,
          reasoning: 'Scientific nutrition content perfect for thoughtful reply'
        }
      ];

      console.log(`#️⃣ Found ${mockTargets.length} hashtag content targets`);
      return mockTargets;

    } catch (error: any) {
      console.error('❌ Failed to find hashtag content:', error);
      return [];
    }
  }

  /**
   * 🔄 FIND CONTENT ENGAGERS
   * Target users who engaged with our content
   */
  private static async findContentEngagers(): Promise<EngagementTarget[]> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return [];
      }

      // Get recent tweets with engagement
      const { data: recentTweets } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('id, content, likes, retweets, replies')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .gt('likes', 0)
        .order('likes', { ascending: false })
        .limit(10);

      // Mock targets representing users who engaged with our content
      const mockTargets: EngagementTarget[] = [
        {
          userId: 'engaged_user_1',
          username: 'healthseeker',
          displayName: 'Alex | Wellness Journey',
          bio: 'Learning about health and sharing my journey 🌱',
          followerCount: 450,
          engagementType: 'follow',
          relevanceScore: 0.80,
          reasoning: 'Engaged with our content, potential community member'
        }
      ];

      console.log(`🔄 Found ${mockTargets.length} content engager targets`);
      return mockTargets;

    } catch (error: any) {
      console.error('❌ Failed to find content engagers:', error);
      return [];
    }
  }

  /**
   * 📊 CALCULATE RELEVANCE SCORE
   * Score potential targets based on multiple factors
   */
  private static calculateRelevanceScore(target: EngagementTarget): number {
    let score = 0.5; // Base score

    // Bio analysis for health keywords
    if (target.bio) {
      const healthKeywordCount = this.HEALTH_KEYWORDS.filter(keyword =>
        target.bio!.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += Math.min(0.3, healthKeywordCount * 0.05);
    }

    // Follower count consideration (sweet spot 500-10000)
    if (target.followerCount >= 500 && target.followerCount <= 10000) {
      score += 0.2;
    } else if (target.followerCount > 10000) {
      score += 0.1; // Still valuable but harder to get attention
    }

    // Content quality for reply targets
    if (target.engagementType === 'reply' && target.tweetContent) {
      if (target.tweetContent.includes('?')) score += 0.1; // Questions are good for replies
      if (target.tweetContent.includes('#')) score += 0.05; // Hashtags show engagement
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * ❤️ PERFORM LIKE ACTION
   * Like a targeted tweet
   */
  private static async performLike(target: EngagementTarget): Promise<EngagementResult> {
    try {
      if (!target.tweetId) {
        return {
          success: false,
          action: 'like',
          targetId: target.userId,
          details: 'No tweet ID provided',
          error: 'Missing tweet ID'
        };
      }

      // Mock like action - would integrate with Twitter API
      console.log(`❤️ LIKE: Tweet ${target.tweetId} by @${target.username}`);
      console.log(`   Content: "${target.tweetContent?.substring(0, 50)}..."`);
      console.log(`   Reasoning: ${target.reasoning}`);

      // Simulate API call delay
      await this.respectRateLimit(500);

      return {
        success: true,
        action: 'like',
        targetId: target.tweetId,
        details: `Liked tweet by @${target.username}: "${target.tweetContent?.substring(0, 30)}..."`
      };

    } catch (error: any) {
      console.error(`❌ Failed to like tweet ${target.tweetId}:`, error);
      return {
        success: false,
        action: 'like',
        targetId: target.tweetId || target.userId,
        details: `Like failed for @${target.username}`,
        error: error.message
      };
    }
  }

  /**
   * 👥 PERFORM FOLLOW ACTION
   * Follow a targeted user
   */
  private static async performFollow(target: EngagementTarget): Promise<EngagementResult> {
    try {
      // Check if already following
      const alreadyFollowing = await this.checkIfFollowing(target.userId);
      if (alreadyFollowing) {
        return {
          success: false,
          action: 'follow',
          targetId: target.userId,
          details: `Already following @${target.username}`
        };
      }

      // Mock follow action - would integrate with Twitter API
      console.log(`👥 FOLLOW: @${target.username} (${target.displayName})`);
      console.log(`   Followers: ${target.followerCount}`);
      console.log(`   Bio: "${target.bio?.substring(0, 50)}..."`);
      console.log(`   Reasoning: ${target.reasoning}`);

      // Simulate API call delay
      await this.respectRateLimit(1000);

      return {
        success: true,
        action: 'follow',
        targetId: target.userId,
        details: `Followed @${target.username} (${target.followerCount} followers)`
      };

    } catch (error: any) {
      console.error(`❌ Failed to follow @${target.username}:`, error);
      return {
        success: false,
        action: 'follow',
        targetId: target.userId,
        details: `Follow failed for @${target.username}`,
        error: error.message
      };
    }
  }

  /**
   * 💬 PERFORM REPLY ACTION
   * Generate and post a thoughtful reply
   */
  private static async performReply(target: EngagementTarget): Promise<EngagementResult> {
    try {
      if (!target.tweetContent || !target.tweetId) {
        return {
          success: false,
          action: 'reply',
          targetId: target.userId,
          details: 'No tweet content to reply to',
          error: 'Missing tweet content'
        };
      }

      // Generate thoughtful reply
      const replyContent = await this.generateThoughtfulReply(target.tweetContent);
      if (!replyContent) {
        return {
          success: false,
          action: 'reply',
          targetId: target.tweetId,
          details: 'Failed to generate reply content',
          error: 'Reply generation failed'
        };
      }

      // Mock reply action - would integrate with Twitter API
      console.log(`💬 REPLY: To tweet ${target.tweetId} by @${target.username}`);
      console.log(`   Original: "${target.tweetContent}"`);
      console.log(`   Reply: "${replyContent}"`);
      console.log(`   Reasoning: ${target.reasoning}`);

      // Simulate API call delay
      await this.respectRateLimit(2000);

      return {
        success: true,
        action: 'reply',
        targetId: target.tweetId,
        details: `Replied to @${target.username}: "${replyContent.substring(0, 50)}..."`
      };

    } catch (error: any) {
      console.error(`❌ Failed to reply to @${target.username}:`, error);
      return {
        success: false,
        action: 'reply',
        targetId: target.tweetId || target.userId,
        details: `Reply failed for @${target.username}`,
        error: error.message
      };
    }
  }

  /**
   * 🧠 GENERATE THOUGHTFUL REPLY
   * Create contextual, valuable replies using AI
   */
  private static async generateThoughtfulReply(originalTweet: string): Promise<string | null> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('smart-engagement-reply');

      const prompt = `Generate a thoughtful, engaging reply to this health/wellness tweet. Be helpful, authentic, and conversational.

ORIGINAL TWEET: "${originalTweet}"

Guidelines:
- Add genuine value or insight
- Keep it friendly and supportive
- Ask a follow-up question if appropriate
- Avoid being salesy or promotional
- Use relevant emojis sparingly
- Keep under 200 characters
- Sound like a real person, not a bot

Return only the reply text, nothing else.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.7
      });

      const replyText = response.choices[0]?.message?.content?.trim();
      
      if (!replyText || replyText.length < 10) {
        throw new Error('Generated reply too short or empty');
      }

      return replyText;

    } catch (error: any) {
      console.error('❌ Failed to generate thoughtful reply:', error);
      return null;
    }
  }

  /**
   * 🧹 PERFORM UNFOLLOW CLEANUP
   * Unfollow users who haven't followed back after 5 days
   */
  private static async performUnfollowCleanup(): Promise<void> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return;
      }

      // Get follows from 5+ days ago that haven't followed back
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      const { data: oldFollows } = await minimalSupabaseClient.supabase
        .from('engagement_actions')
        .select('target_user_id, target_username')
        .eq('action_type', 'follow')
        .eq('success', true)
        .lt('created_at', fiveDaysAgo.toISOString())
        .is('followed_back', false) // Assuming we track follow-backs
        .limit(10);

      if (!oldFollows || oldFollows.length === 0) {
        console.log('🧹 No cleanup needed - no stale follows found');
        return;
      }

      console.log(`🧹 Unfollowing ${oldFollows.length} users who didn't follow back`);

      for (const follow of oldFollows) {
        try {
          // Mock unfollow action - would integrate with Twitter API
          console.log(`👋 UNFOLLOW: @${follow.target_username} (no follow-back after 5 days)`);
          
          // Mark as unfollowed in database
          await minimalSupabaseClient.supabase
            .from('engagement_actions')
            .update({ unfollowed_at: new Date().toISOString() })
            .eq('target_user_id', follow.target_user_id)
            .eq('action_type', 'follow');

          await this.respectRateLimit(2000); // 2 seconds between unfollows

        } catch (unfollowError) {
          console.error(`❌ Failed to unfollow @${follow.target_username}:`, unfollowError);
        }
      }

    } catch (error: any) {
      console.error('❌ Unfollow cleanup failed:', error);
    }
  }

  /**
   * 📊 CHECK DAILY LIMITS
   * Get current daily engagement counts
   */
  private static async checkDailyLimits(): Promise<DailyEngagementLimits> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return {
          likes: 0, follows: 0, replies: 0, retweets: 0,
          maxLikes: this.DAILY_LIMITS.likes,
          maxFollows: this.DAILY_LIMITS.follows,
          maxReplies: this.DAILY_LIMITS.replies,
          maxRetweets: this.DAILY_LIMITS.retweets,
          canEngage: true
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayActions } = await minimalSupabaseClient.supabase
        .from('engagement_actions')
        .select('action_type')
        .eq('success', true)
        .gte('created_at', today.toISOString());

      const counts = {
        likes: todayActions?.filter(a => a.action_type === 'like').length || 0,
        follows: todayActions?.filter(a => a.action_type === 'follow').length || 0,
        replies: todayActions?.filter(a => a.action_type === 'reply').length || 0,
        retweets: todayActions?.filter(a => a.action_type === 'retweet').length || 0
      };

      return {
        ...counts,
        maxLikes: this.DAILY_LIMITS.likes,
        maxFollows: this.DAILY_LIMITS.follows,
        maxReplies: this.DAILY_LIMITS.replies,
        maxRetweets: this.DAILY_LIMITS.retweets,
        canEngage: counts.likes < this.DAILY_LIMITS.likes || 
                   counts.follows < this.DAILY_LIMITS.follows || 
                   counts.replies < this.DAILY_LIMITS.replies || 
                   counts.retweets < this.DAILY_LIMITS.retweets
      };

    } catch (error: any) {
      console.error('❌ Failed to check daily limits:', error);
      return {
        likes: 0, follows: 0, replies: 0, retweets: 0,
        maxLikes: this.DAILY_LIMITS.likes,
        maxFollows: this.DAILY_LIMITS.follows,
        maxReplies: this.DAILY_LIMITS.replies,
        maxRetweets: this.DAILY_LIMITS.retweets,
        canEngage: true
      };
    }
  }

  /**
   * 📝 RECORD ENGAGEMENT ACTION
   * Store engagement action for tracking and analytics
   */
  private static async recordEngagementAction(
    target: EngagementTarget,
    actionType: string,
    success: boolean
  ): Promise<void> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return;
      }

      await minimalSupabaseClient.supabase
        .from('engagement_actions')
        .insert({
          action_type: actionType,
          target_user_id: target.userId,
          target_username: target.username,
          target_tweet_id: target.tweetId,
          success,
          relevance_score: target.relevanceScore,
          reasoning: target.reasoning,
          created_at: new Date().toISOString()
        });

      console.log(`📝 Recorded ${actionType} action for @${target.username}`);

    } catch (error: any) {
      console.error('❌ Failed to record engagement action:', error);
    }
  }

  /**
   * 👀 CHECK IF FOLLOWING
   * Check if we're already following a user
   */
  private static async checkIfFollowing(userId: string): Promise<boolean> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return false;
      }

      const { data } = await minimalSupabaseClient.supabase
        .from('engagement_actions')
        .select('id')
        .eq('action_type', 'follow')
        .eq('target_user_id', userId)
        .eq('success', true)
        .is('unfollowed_at', null)
        .limit(1);

      return data && data.length > 0;

    } catch (error: any) {
      console.error('❌ Failed to check following status:', error);
      return false;
    }
  }

  /**
   * ⏱️ RESPECT RATE LIMITS
   * Add delays between API calls
   */
  private static async respectRateLimit(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * 📊 GET ENGAGEMENT ANALYTICS
   * Get daily/weekly engagement statistics
   */
  static async getEngagementAnalytics(): Promise<{
    today: { likes: number; follows: number; replies: number; retweets: number };
    week: { likes: number; follows: number; replies: number; retweets: number };
    successRate: number;
    topPerformingActions: Array<{ action: string; count: number; avgScore: number }>;
  }> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return {
          today: { likes: 0, follows: 0, replies: 0, retweets: 0 },
          week: { likes: 0, follows: 0, replies: 0, retweets: 0 },
          successRate: 0,
          topPerformingActions: []
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get today's actions
      const { data: todayData } = await minimalSupabaseClient.supabase
        .from('engagement_actions')
        .select('action_type, success, relevance_score')
        .gte('created_at', today.toISOString());

      // Get week's actions
      const { data: weekData } = await minimalSupabaseClient.supabase
        .from('engagement_actions')
        .select('action_type, success, relevance_score')
        .gte('created_at', weekAgo.toISOString());

      const countActions = (data: any[], filter?: (item: any) => boolean) => {
        const filtered = filter ? data.filter(filter) : data;
        return {
          likes: filtered.filter(a => a.action_type === 'like').length,
          follows: filtered.filter(a => a.action_type === 'follow').length,
          replies: filtered.filter(a => a.action_type === 'reply').length,
          retweets: filtered.filter(a => a.action_type === 'retweet').length
        };
      };

      const todayStats = countActions(todayData || [], a => a.success);
      const weekStats = countActions(weekData || [], a => a.success);

      const totalActions = (weekData || []).length;
      const successfulActions = (weekData || []).filter(a => a.success).length;
      const successRate = totalActions > 0 ? successfulActions / totalActions : 0;

      return {
        today: todayStats,
        week: weekStats,
        successRate,
        topPerformingActions: []
      };

    } catch (error: any) {
      console.error('❌ Failed to get engagement analytics:', error);
      return {
        today: { likes: 0, follows: 0, replies: 0, retweets: 0 },
        week: { likes: 0, follows: 0, replies: 0, retweets: 0 },
        successRate: 0,
        topPerformingActions: []
      };
    }
  }
} 