/**
 * 🎯 REPLY TARGET SELECTOR
 * 
 * Intelligently selects the best influencer tweets to reply to based on:
 * - Engagement velocity and timing
 * - Content relevance and quality
 * - Historical reply success rates
 * - Influencer relationship status
 */

import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { REPLY_TIMING_CONFIG, getInfluencerByUsername } from '../config/influencers';
import { AwarenessLogger } from '../utils/awarenessLogger';

export interface ReplyTarget {
  tweetId: string;
  author: string;
  authorDisplayName: string;
  content: string;
  contentExcerpt: string; // First 80 chars for context
  url: string;
  likeCount: number;
  replyCount: number;
  engagementVelocity: number;
  topicCategory: string;
  createdAt: string;
  replyStyle: string; // supportive, questioning, contrarian, educational
  influencerPriority: string;
  relevanceScore: number;
  metadata: any;
}

export interface ReplyOpportunity {
  targets: ReplyTarget[];
  selectedTarget?: ReplyTarget;
  selectionReason: string;
  confidence: number;
  estimatedReach: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export class ReplyTargetSelector {
  private static instance: ReplyTargetSelector;

  private constructor() {}

  static getInstance(): ReplyTargetSelector {
    if (!ReplyTargetSelector.instance) {
      ReplyTargetSelector.instance = new ReplyTargetSelector();
    }
    return ReplyTargetSelector.instance;
  }

  /**
   * 🎯 Get best reply opportunities right now
   */
  async getBestReplyOpportunities(): Promise<ReplyOpportunity> {
    try {
      console.log('🎯 === REPLY TARGET SELECTION ===');

      // Check if we can reply now (timing constraints)
      const canReplyNow = this.isOptimalReplyTime();
      if (!canReplyNow.allowed) {
        return {
          targets: [],
          selectionReason: canReplyNow.reason,
          confidence: 0,
          estimatedReach: 0,
          riskLevel: 'low'
        };
      }

      // Get potential targets from database
      const targets = await this.fetchPotentialTargets();
      console.log(`🔍 Found ${targets.length} potential reply targets`);

      if (targets.length === 0) {
        return {
          targets: [],
          selectionReason: 'No suitable targets found',
          confidence: 0,
          estimatedReach: 0,
          riskLevel: 'low'
        };
      }

      // Score and rank targets
      const scoredTargets = await this.scoreTargets(targets);
      
      // Select the best target
      const selectedTarget = this.selectBestTarget(scoredTargets);
      
      if (!selectedTarget) {
        return {
          targets: scoredTargets,
          selectionReason: 'No targets meet quality threshold',
          confidence: 0,
          estimatedReach: 0,
          riskLevel: 'low'
        };
      }

      const opportunity: ReplyOpportunity = {
        targets: scoredTargets,
        selectedTarget,
        selectionReason: `Selected @${selectedTarget.author} tweet with ${selectedTarget.relevanceScore.toFixed(2)} relevance score`,
        confidence: Math.min(selectedTarget.relevanceScore * 0.8, 0.95),
        estimatedReach: this.estimateReach(selectedTarget),
        riskLevel: this.assessRisk(selectedTarget)
      };

      console.log(`✅ Selected target: @${selectedTarget.author} (${selectedTarget.relevanceScore.toFixed(2)} score)`);
      
      // Log selection for analytics
      AwarenessLogger.logSystemState({
        currentTime: new Date(),
        timingState: { lastPostTime: 0, postCount24h: 1, maxDailyPosts: 6, minutesSinceLastPost: 0 },
        engagementContext: { multiplier: 1.0, description: 'reply targeting', windowType: 'strategic' },
        decision: { action: 'reply_target_selected', priority: 9, reasoning: 'optimal influencer target', expectedEngagement: selectedTarget.engagementVelocity }
      });
      console.log('🎯 Reply target selected:', {
        targetId: selectedTarget.tweetId,
        author: selectedTarget.author,
        relevanceScore: selectedTarget.relevanceScore,
        confidence: opportunity.confidence,
        estimatedReach: opportunity.estimatedReach
      });

      return opportunity;

    } catch (error) {
      console.error('❌ Reply target selection failed:', error);
      return {
        targets: [],
        selectionReason: `Selection error: ${error.message}`,
        confidence: 0,
        estimatedReach: 0,
        riskLevel: 'high'
      };
    }
  }

  /**
   * ⏰ Check if current time is optimal for replies
   */
  private isOptimalReplyTime(): { allowed: boolean; reason: string } {
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Check if within optimal hours
    if (!REPLY_TIMING_CONFIG.optimalHours.includes(currentHour)) {
      return {
        allowed: false,
        reason: `Outside optimal reply hours (${REPLY_TIMING_CONFIG.optimalHours.join(', ')} UTC)`
      };
    }

    return { allowed: true, reason: 'Optimal reply time' };
  }

  /**
   * 📊 Fetch potential targets from database
   */
  private async fetchPotentialTargets(): Promise<ReplyTarget[]> {
    try {
      // Use the database function for intelligent selection
      const { data, error } = await secureSupabaseClient.supabase
        .rpc('get_best_reply_targets', {
          limit_count: 8,
          min_engagement: REPLY_TIMING_CONFIG.minLikeCount
        });

      if (error) {
        console.error('❌ Database query error:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convert to ReplyTarget format
      const targets: ReplyTarget[] = data.map((row: any) => {
        const influencer = getInfluencerByUsername(row.author);
        
        return {
          tweetId: row.tweet_id,
          author: row.author,
          authorDisplayName: row.author || row.author,
          content: row.full_content || row.content_excerpt + '...',
          contentExcerpt: row.content_excerpt,
          url: row.url || `https://twitter.com/${row.author}/status/${row.tweet_id}`,
          likeCount: row.like_count || 0,
          replyCount: row.reply_count || 0,
          engagementVelocity: row.engagement_score,
          topicCategory: row.topic_category || 'general',
          createdAt: row.created_at,
          replyStyle: influencer?.replyStyle || 'supportive',
          influencerPriority: influencer?.priority || 'medium',
          relevanceScore: 0, // Will be calculated in scoring
          metadata: {
            influencerNiche: influencer?.niche,
            avgEngagement: influencer?.avgEngagement
          }
        };
      });

      return targets;

    } catch (error) {
      console.error('❌ Failed to fetch targets:', error);
      return [];
    }
  }

  /**
   * 📈 Score and rank targets
   */
  private async scoreTargets(targets: ReplyTarget[]): Promise<ReplyTarget[]> {
    const scoredTargets = await Promise.all(
      targets.map(async (target) => {
        const score = await this.calculateRelevanceScore(target);
        return { ...target, relevanceScore: score };
      })
    );

    // Sort by relevance score (highest first)
    return scoredTargets.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 🎯 Calculate relevance score for a target
   */
  private async calculateRelevanceScore(target: ReplyTarget): Promise<number> {
    let score = 0;

    // Base engagement score (0-40 points)
    const engagementScore = Math.min(target.engagementVelocity / 100, 40);
    score += engagementScore;

    // Influencer priority bonus (0-20 points)
    const priorityBonus = target.influencerPriority === 'high' ? 20 : 
                         target.influencerPriority === 'medium' ? 10 : 5;
    score += priorityBonus;

    // Topic relevance (0-15 points)
    const topicScore = await this.getTopicRelevanceScore(target.topicCategory);
    score += topicScore;

    // Freshness bonus (0-10 points)
    const ageHours = this.calculateTweetAge(target.createdAt);
    const freshnessBonus = Math.max(10 - (ageHours * 2), 0);
    score += freshnessBonus;

    // Reply saturation penalty (0 to -15 points)
    const replySaturation = Math.min(target.replyCount / 20, 1);
    score -= replySaturation * 15;

    // Historical success bonus (0-10 points)
    const historicalBonus = await this.getHistoricalSuccessScore(target.author);
    score += historicalBonus;

    // Content quality bonus (0-5 points)
    const contentQuality = this.assessContentQuality(target.content);
    score += contentQuality;

    return Math.max(score, 0);
  }

  /**
   * 📂 Get topic relevance score
   */
  private async getTopicRelevanceScore(topic: string): Promise<number> {
    try {
      // Check topic performance in our database
      const { data } = await secureSupabaseClient.supabase
        .from('topic_format_performance')
        .select('avg_engagement')
        .eq('topic', topic)
        .order('avg_engagement', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return Math.min(data[0].avg_engagement * 150, 15); // Scale to 0-15
      }

      return 5; // Default relevance
    } catch (error) {
      return 5; // Default on error
    }
  }

  /**
   * 📊 Get historical success score with this influencer
   */
  private async getHistoricalSuccessScore(author: string): Promise<number> {
    try {
      const { data } = await secureSupabaseClient.supabase
        .from('reply_history')
        .select('was_successful')
        .eq('target_author', author)
        .limit(10);

      if (!data || data.length === 0) return 5; // Neutral for new relationships

      const successRate = data.filter(r => r.was_successful).length / data.length;
      return successRate * 10; // 0-10 points based on success rate
    } catch (error) {
      return 5; // Default on error
    }
  }

  /**
   * 📝 Assess content quality
   */
  private assessContentQuality(content: string): number {
    let score = 0;

    // Length bonus (well-formed content)
    if (content.length > 100 && content.length < 250) score += 2;

    // Question mark bonus (encourages engagement)
    if (content.includes('?')) score += 1;

    // Research/science keywords
    const scienceKeywords = ['study', 'research', 'data', 'evidence', 'finding'];
    if (scienceKeywords.some(kw => content.toLowerCase().includes(kw))) score += 2;

    return score;
  }

  /**
   * 🎯 Select the best target from scored targets
   */
  private selectBestTarget(targets: ReplyTarget[]): ReplyTarget | null {
    if (targets.length === 0) return null;

    // Require minimum relevance score
    const topTarget = targets[0];
    if (topTarget.relevanceScore < 30) {
      console.log(`⚠️ Top target score too low: ${topTarget.relevanceScore}`);
      return null;
    }

    return topTarget;
  }

  /**
   * 📊 Estimate potential reach of replying to this target
   */
  private estimateReach(target: ReplyTarget): number {
    // Base reach from likes (assume 5% of likers see replies)
    const baseReach = target.likeCount * 0.05;
    
    // Multiplier based on influencer following (estimated)
    const influencerMultiplier = target.influencerPriority === 'high' ? 3 : 
                                target.influencerPriority === 'medium' ? 2 : 1;
    
    return Math.round(baseReach * influencerMultiplier);
  }

  /**
   * ⚠️ Assess risk level of replying to this target
   */
  private assessRisk(target: ReplyTarget): 'low' | 'medium' | 'high' {
    // High risk factors
    if (target.replyCount > 30) return 'high'; // Crowded thread
    if (target.influencerPriority === 'low') return 'medium'; // Less established relationship
    
    // Content-based risk
    if (target.content.toLowerCase().includes('controversial')) return 'medium';
    
    return 'low';
  }

  /**
   * ⏰ Calculate tweet age in hours
   */
  private calculateTweetAge(timestamp: string): number {
    const tweetTime = new Date(timestamp);
    const now = new Date();
    return (now.getTime() - tweetTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * ✅ Mark target as replied to
   */
  async markAsRepliedTo(tweetId: string, replyTweetId: string): Promise<void> {
    try {
      const { error } = await secureSupabaseClient.supabase
        .from('influencer_tweets')
        .update({ 
          replied_to: true, 
          reply_tweet_id: replyTweetId 
        })
        .eq('id', tweetId);

      if (error) {
        console.error('❌ Failed to mark as replied:', error);
      } else {
        console.log(`✅ Marked ${tweetId} as replied to`);
      }
    } catch (error) {
      console.error('❌ Database update error:', error);
    }
  }

  /**
   * 📈 Get selection statistics
   */
  async getSelectionStats(): Promise<{
    totalTargets: number;
    highPriorityTargets: number;
    avgRelevanceScore: number;
    recentReplies: number;
  }> {
    try {
      const { data: targets } = await secureSupabaseClient.supabase
        .from('influencer_tweets')
        .select('*')
        .eq('is_reply_target', true)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: replies } = await secureSupabaseClient.supabase
        .from('reply_history')
        .select('*')
        .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const highPriority = targets?.filter(t => 
        t.metadata?.influencer_priority === 'high'
      ).length || 0;

      return {
        totalTargets: targets?.length || 0,
        highPriorityTargets: highPriority,
        avgRelevanceScore: 0, // Would need to calculate
        recentReplies: replies?.length || 0
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return {
        totalTargets: 0,
        highPriorityTargets: 0,
        avgRelevanceScore: 0,
        recentReplies: 0
      };
    }
  }
}

export const replyTargetSelector = ReplyTargetSelector.getInstance();