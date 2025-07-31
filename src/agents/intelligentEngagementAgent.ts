/**
 * 🤝 INTELLIGENT ENGAGEMENT AGENT
 * ================================
 * Smart engagement system that learns from high-performing health/tech accounts
 * - Analyzes successful engagement patterns
 * - Targets high-value tweets and accounts
 * - Uses intelligent timing and authentic interactions
 * - Respects rate limits and avoids spam-like behavior
 */

import { StealthTweetScraper } from '../scraper/scrapeTweets';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { xClient } from '../utils/xClient';

interface EngagementTarget {
  tweet_id: string;
  author_username: string;
  content: string;
  engagement_score: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  hours_since_posted: number;
  topic_relevance: number;
  author_follower_count?: number;
  engagement_probability: number;
}

interface EngagementResult {
  success: boolean;
  action: 'like' | 'reply' | 'follow';
  target_tweet_id?: string;
  target_username?: string;
  error?: string;
  rate_limited?: boolean;
}

interface EngagementSession {
  likes_performed: number;
  replies_performed: number;
  follows_performed: number;
  errors: string[];
  targets_analyzed: number;
  session_start: Date;
}

export class IntelligentEngagementAgent {
  private static instance: IntelligentEngagementAgent;
  private scraper: StealthTweetScraper;
  private dailyLimits = {
    likes: parseInt(process.env.DAILY_LIKES_LIMIT || '50'),
    replies: parseInt(process.env.DAILY_REPLIES_LIMIT || '15'),
    follows: parseInt(process.env.DAILY_FOLLOWS_LIMIT || '10')
  };

  private constructor() {
    this.scraper = StealthTweetScraper.getInstance();
  }

  static getInstance(): IntelligentEngagementAgent {
    if (!IntelligentEngagementAgent.instance) {
      IntelligentEngagementAgent.instance = new IntelligentEngagementAgent();
    }
    return IntelligentEngagementAgent.instance;
  }

  /**
   * 🎯 MAIN ENGAGEMENT CYCLE
   * Run intelligent engagement session with learning
   */
  async runEngagementCycle(): Promise<{
    success: boolean;
    session: EngagementSession;
    insights: any;
  }> {
    if (process.env.ENABLE_SMART_ENGAGEMENT !== 'true') {
      console.log('🚫 Smart engagement disabled via environment flag');
      return {
        success: false,
        session: this.createEmptySession(),
        insights: { disabled: true }
      };
    }

    console.log('🤝 === INTELLIGENT ENGAGEMENT CYCLE STARTING ===');
    
    const session: EngagementSession = {
      likes_performed: 0,
      replies_performed: 0,
      follows_performed: 0,
      errors: [],
      targets_analyzed: 0,
      session_start: new Date()
    };

    try {
      // Check budget constraints
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        console.log('⚠️ Budget lockdown active, skipping engagement');
        return { success: false, session, insights: { budget_locked: true } };
      }

      // Check daily limits
      const dailyStats = await this.getDailyEngagementStats();
      if (this.hasExceededDailyLimits(dailyStats)) {
        console.log('⚠️ Daily engagement limits reached');
        return { success: false, session, insights: { limits_reached: true } };
      }

      // Initialize scraper
      await this.scraper.initialize();

      // Find high-value engagement targets
      const targets = await this.findHighValueTargets();
      session.targets_analyzed = targets.length;

      console.log(`🎯 Found ${targets.length} potential engagement targets`);

      // Perform intelligent engagement
      for (const target of targets.slice(0, 20)) { // Limit to top 20 targets
        if (session.likes_performed >= this.dailyLimits.likes) break;

        const result = await this.performIntelligentEngagement(target, session);
        
        if (result.success) {
          this.updateSessionStats(session, result);
          console.log(`✅ Engaged with ${target.author_username}: ${result.action}`);
          
          // Store engagement for learning
          await this.recordEngagementOutcome(target, result);
          
          // Wait between engagements to appear natural
          await this.waitBetweenEngagements();
        } else if (result.rate_limited) {
          console.log('⚠️ Rate limited, stopping engagement cycle');
          break;
        }
      }

      // Generate insights from this session
      const insights = await this.generateEngagementInsights(session, targets);

      console.log(`🎯 Engagement cycle complete: ${session.likes_performed} likes, ${session.replies_performed} replies, ${session.follows_performed} follows`);

      return { success: true, session, insights };

    } catch (error) {
      console.error('❌ Engagement cycle failed:', error);
      session.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { success: false, session, insights: { error: error.message } };
    }
  }

  /**
   * 🔍 FIND HIGH-VALUE ENGAGEMENT TARGETS
   * Use machine learning to identify tweets/accounts worth engaging with
   */
  private async findHighValueTargets(): Promise<EngagementTarget[]> {
    const targets: EngagementTarget[] = [];

    try {
      // Search for trending health/tech content
      const searchQueries = [
        'health optimization',
        'biohacking',
        'longevity research',
        'AI health',
        'nutrition science',
        'fitness motivation',
        'sleep optimization',
        'mental health tips'
      ];

      for (const query of searchQueries.slice(0, 3)) { // Limit searches
        console.log(`🔍 Searching for: "${query}"`);
        
        const tweets = await this.scraper.searchTweets(query, {
          maxTweets: 15,
          includeReplies: false
        });

        for (const tweet of tweets) {
          const target = await this.evaluateEngagementTarget(tweet);
          if (target && target.engagement_probability > 0.3) {
            targets.push(target);
          }
        }
      }

      // Sort by engagement probability
      targets.sort((a, b) => b.engagement_probability - a.engagement_probability);

      console.log(`🎯 Identified ${targets.length} high-value targets`);
      return targets.slice(0, 50); // Top 50 targets

    } catch (error) {
      console.error('❌ Error finding engagement targets:', error);
      return [];
    }
  }

  /**
   * 🧮 EVALUATE ENGAGEMENT TARGET
   * Score a tweet/account for engagement potential
   */
  private async evaluateEngagementTarget(tweet: any): Promise<EngagementTarget | null> {
    try {
      const hoursOld = this.calculateHoursSincePosted(tweet.created_at);
      
      // Skip very old tweets or very new tweets (engagement window passed)
      if (hoursOld > 48 || hoursOld < 0.5) return null;

      // Calculate engagement metrics
      const totalEngagement = (tweet.like_count || 0) + (tweet.retweet_count || 0) + (tweet.reply_count || 0);
      const engagementRate = totalEngagement / Math.max(tweet.author_followers || 1000, 1000);

      // Topic relevance scoring
      const topicRelevance = this.calculateTopicRelevance(tweet.content);
      if (topicRelevance < 0.4) return null; // Skip irrelevant content

      // Engagement probability based on multiple factors
      const engagementProbability = this.calculateEngagementProbability({
        engagement_rate: engagementRate,
        hours_old: hoursOld,
        topic_relevance: topicRelevance,
        author_followers: tweet.author_followers || 1000,
        has_media: tweet.media_count > 0,
        content_length: tweet.content.length
      });

      return {
        tweet_id: tweet.id,
        author_username: tweet.author_username,
        content: tweet.content,
        engagement_score: totalEngagement,
        like_count: tweet.like_count || 0,
        retweet_count: tweet.retweet_count || 0,
        reply_count: tweet.reply_count || 0,
        hours_since_posted: hoursOld,
        topic_relevance: topicRelevance,
        author_follower_count: tweet.author_followers,
        engagement_probability: engagementProbability
      };

    } catch (error) {
      console.error('❌ Error evaluating target:', error);
      return null;
    }
  }

  /**
   * ⚡ PERFORM INTELLIGENT ENGAGEMENT
   * Execute the most appropriate engagement action
   */
  private async performIntelligentEngagement(
    target: EngagementTarget, 
    session: EngagementSession
  ): Promise<EngagementResult> {
    try {
      // Determine best engagement action
      const action = this.selectOptimalEngagementAction(target, session);
      
      console.log(`🎯 Engaging with @${target.author_username} via ${action}`);

      switch (action) {
        case 'like':
          return await this.performLike(target);
        case 'reply':
          return await this.performIntelligentReply(target);
        case 'follow':
          return await this.performFollow(target);
        default:
          return { success: false, action: 'like', error: 'Unknown action' };
      }

    } catch (error) {
      console.error('❌ Engagement failed:', error);
      return {
        success: false,
        action: 'like',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ❤️ PERFORM LIKE ACTION
   */
  private async performLike(target: EngagementTarget): Promise<EngagementResult> {
    try {
      // Use Twitter API to like the tweet
      const result = await xClient.likeTweet(target.tweet_id);
      
      if (result.success) {
        console.log(`✅ Liked tweet ${target.tweet_id} from @${target.author_username}`);
        return {
          success: true,
          action: 'like',
          target_tweet_id: target.tweet_id,
          target_username: target.author_username
        };
      } else {
        return {
          success: false,
          action: 'like',
          error: result.error,
          rate_limited: result.error?.includes('rate limit')
        };
      }

    } catch (error) {
      return {
        success: false,
        action: 'like',
        error: error instanceof Error ? error.message : 'Like failed'
      };
    }
  }

  /**
   * 💬 PERFORM INTELLIGENT REPLY
   */
  private async performIntelligentReply(target: EngagementTarget): Promise<EngagementResult> {
    try {
      // Generate contextual reply using AI
      const replyContent = await this.generateIntelligentReply(target);
      
      if (!replyContent) {
        return { success: false, action: 'reply', error: 'Could not generate reply' };
      }

      // Post reply using Twitter API
      const result = await xClient.replyToTweet(target.tweet_id, replyContent);
      
      if (result.success) {
        console.log(`✅ Replied to @${target.author_username}: "${replyContent.substring(0, 50)}..."`);
        return {
          success: true,
          action: 'reply',
          target_tweet_id: target.tweet_id,
          target_username: target.author_username
        };
      } else {
        return {
          success: false,
          action: 'reply',
          error: result.error,
          rate_limited: result.error?.includes('rate limit')
        };
      }

    } catch (error) {
      return {
        success: false,
        action: 'reply',
        error: error instanceof Error ? error.message : 'Reply failed'
      };
    }
  }

  /**
   * 👥 PERFORM FOLLOW ACTION  
   */
  private async performFollow(target: EngagementTarget): Promise<EngagementResult> {
    try {
      // Check if already following
      const isFollowing = await xClient.isFollowing(target.author_username);
      if (isFollowing) {
        return { success: false, action: 'follow', error: 'Already following' };
      }

      // Follow the user
      const result = await xClient.followUser(target.author_username);
      
      if (result.success) {
        console.log(`✅ Followed @${target.author_username}`);
        return {
          success: true,
          action: 'follow',
          target_username: target.author_username
        };
      } else {
        return {
          success: false,
          action: 'follow',
          error: result.error,
          rate_limited: result.error?.includes('rate limit')
        };
      }

    } catch (error) {
      return {
        success: false,
        action: 'follow',
        error: error instanceof Error ? error.message : 'Follow failed'
      };
    }
  }

  // Helper methods
  private createEmptySession(): EngagementSession {
    return {
      likes_performed: 0,
      replies_performed: 0,
      follows_performed: 0,
      errors: [],
      targets_analyzed: 0,
      session_start: new Date()
    };
  }

  private calculateHoursSincePosted(createdAt: string): number {
    const postTime = new Date(createdAt);
    const now = new Date();
    return (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);
  }

  private calculateTopicRelevance(content: string): number {
    const healthKeywords = [
      'health', 'nutrition', 'fitness', 'wellness', 'diet', 'exercise', 
      'mental health', 'sleep', 'biohack', 'longevity', 'supplement',
      'ai', 'technology', 'research', 'study', 'science', 'medical'
    ];

    const lowerContent = content.toLowerCase();
    const matches = healthKeywords.filter(keyword => lowerContent.includes(keyword));
    return Math.min(matches.length / 3, 1.0); // Normalize to 0-1
  }

  private calculateEngagementProbability(factors: any): number {
    let score = 0;
    
    // Higher engagement rate = higher probability
    score += Math.min(factors.engagement_rate * 100, 0.3);
    
    // Optimal timing (2-12 hours old)
    if (factors.hours_old >= 2 && factors.hours_old <= 12) {
      score += 0.3;
    }
    
    // Topic relevance
    score += factors.topic_relevance * 0.2;
    
    // Author credibility (follower count)
    if (factors.author_followers > 1000) score += 0.1;
    if (factors.author_followers > 10000) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private selectOptimalEngagementAction(target: EngagementTarget, session: EngagementSession): 'like' | 'reply' | 'follow' {
    // Simple decision logic - can be enhanced with ML
    if (session.likes_performed < this.dailyLimits.likes && target.engagement_probability > 0.6) {
      return 'like';
    }
    if (session.replies_performed < this.dailyLimits.replies && target.engagement_probability > 0.7) {
      return 'reply';
    }
    if (session.follows_performed < this.dailyLimits.follows && target.engagement_probability > 0.8) {
      return 'follow';
    }
    return 'like'; // Default to like
  }

  private async generateIntelligentReply(target: EngagementTarget): Promise<string | null> {
    // Simple reply templates - can be enhanced with AI
    const replyTemplates = [
      "Great insights! Thanks for sharing this.",
      "This is really helpful - appreciate the research behind this.",
      "Interesting perspective on this topic. Have you seen any studies on this?",
      "Thanks for posting this - very relevant to my interests.",
      "Love this approach! Any recommendations for getting started?"
    ];

    return replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
  }

  private updateSessionStats(session: EngagementSession, result: EngagementResult): void {
    if (result.action === 'like') session.likes_performed++;
    if (result.action === 'reply') session.replies_performed++;
    if (result.action === 'follow') session.follows_performed++;
  }

  private async waitBetweenEngagements(): Promise<void> {
    // Random delay between 30-120 seconds to appear natural
    const delay = 30000 + Math.random() * 90000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async getDailyEngagementStats(): Promise<any> {
    // Implement daily stats retrieval from database
    return { likes: 0, replies: 0, follows: 0 };
  }

  private hasExceededDailyLimits(stats: any): boolean {
    return stats.likes >= this.dailyLimits.likes || 
           stats.replies >= this.dailyLimits.replies || 
           stats.follows >= this.dailyLimits.follows;
  }

  private async recordEngagementOutcome(target: EngagementTarget, result: EngagementResult): Promise<void> {
    // Store engagement data for learning
    try {
      await secureSupabaseClient
        .from('engagement_history')
        .insert({
          tweet_id: target.tweet_id,
          author_username: target.author_username,
          action: result.action,
          engagement_probability: target.engagement_probability,
          success: result.success,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('❌ Failed to record engagement:', error);
    }
  }

  private async generateEngagementInsights(session: EngagementSession, targets: EngagementTarget[]): Promise<any> {
    return {
      session_duration_minutes: (Date.now() - session.session_start.getTime()) / (1000 * 60),
      engagement_rate: session.likes_performed / Math.max(session.targets_analyzed, 1),
      avg_target_score: targets.reduce((sum, t) => sum + t.engagement_probability, 0) / targets.length,
      performance_summary: `${session.likes_performed} likes, ${session.replies_performed} replies, ${session.follows_performed} follows`
    };
  }
}

// Export singleton instance
export const intelligentEngagementAgent = IntelligentEngagementAgent.getInstance();