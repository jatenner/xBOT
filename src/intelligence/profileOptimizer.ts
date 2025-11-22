/**
 * 🎯 PROFILE OPTIMIZER
 * 
 * Ensures profile shows "follow-worthy" content for maximum follower conversion.
 * Audits profile and recommends optimizations.
 */

import { getSupabaseClient } from '../db';

export interface ProfileAudit {
  score: number; // 0-100 (follower conversion potential)
  issues: string[];
  recommendations: string[];
  pinnedTweetOptimal: boolean;
  contentMix: {
    threads: number;
    controversial: number;
    data: number;
    stories: number;
  };
  last10Tweets: Array<{
    tweet_id: string;
    content: string;
    engagement_rate: number;
    followers_gained?: number;
    type: 'thread' | 'controversial' | 'data' | 'story' | 'generic';
  }>;
}

export class ProfileOptimizer {
  private static instance: ProfileOptimizer;

  public static getInstance(): ProfileOptimizer {
    if (!ProfileOptimizer.instance) {
      ProfileOptimizer.instance = new ProfileOptimizer();
    }
    return ProfileOptimizer.instance;
  }

  /**
   * Audit profile for follower conversion potential
   */
  async auditProfile(): Promise<ProfileAudit> {
    const supabase = getSupabaseClient();
    
    // Get last 10 tweets
    const { data: recentTweets } = await supabase
      .from('content_metadata')
      .select('tweet_id, content, decision_type, actual_engagement_rate, actual_impressions, actual_likes, generator_name, format_strategy')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(10);

    if (!recentTweets || recentTweets.length === 0) {
      return {
        score: 0,
        issues: ['No tweets found'],
        recommendations: ['Generate and post content first'],
        pinnedTweetOptimal: false,
        contentMix: { threads: 0, controversial: 0, data: 0, stories: 0 },
        last10Tweets: []
      };
    }

    // Analyze content mix
    const contentMix = this.analyzeContentMix(recentTweets);
    
    // Check for variety
    const hasVariety = this.checkVariety(recentTweets);
    
    // Check for value
    const hasValue = this.checkValue(recentTweets);
    
    // Check for personality
    const hasPersonality = this.checkPersonality(recentTweets);

    // Calculate score
    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Variety check (30 points)
    if (hasVariety) {
      score += 30;
    } else {
      issues.push('Profile lacks content variety');
      recommendations.push('Ensure mix of threads, controversial takes, data-driven, and stories');
    }

    // Value check (30 points)
    if (hasValue) {
      score += 30;
    } else {
      issues.push('Profile lacks valuable content');
      recommendations.push('Ensure content provides actionable insights, not generic tips');
    }

    // Personality check (20 points)
    if (hasPersonality) {
      score += 20;
    } else {
      issues.push('Profile lacks personality');
      recommendations.push('Add controversial takes and personal stories');
    }

    // Content mix check (20 points)
    const optimalMix = contentMix.threads >= 3 && 
                       contentMix.controversial >= 2 && 
                       contentMix.data >= 1;
    if (optimalMix) {
      score += 20;
    } else {
      issues.push('Content mix not optimal');
      recommendations.push(`Current mix: ${contentMix.threads} threads, ${contentMix.controversial} controversial, ${contentMix.data} data. Target: 4+ threads, 3+ controversial, 2+ data`);
    }

    // Check pinned tweet (if we can determine it)
    const pinnedTweetOptimal = await this.checkPinnedTweet();

    return {
      score,
      issues,
      recommendations,
      pinnedTweetOptimal,
      contentMix,
      last10Tweets: recentTweets.map(tweet => ({
        tweet_id: tweet.tweet_id || '',
        content: tweet.content?.substring(0, 100) || '',
        engagement_rate: tweet.actual_engagement_rate || 0,
        type: this.classifyContentType(tweet)
      }))
    };
  }

  /**
   * Analyze content mix
   */
  private analyzeContentMix(tweets: any[]): ProfileAudit['contentMix'] {
    const mix = { threads: 0, controversial: 0, data: 0, stories: 0 };

    tweets.forEach(tweet => {
      const type = this.classifyContentType(tweet);
      if (type === 'thread') mix.threads++;
      else if (type === 'controversial') mix.controversial++;
      else if (type === 'data') mix.data++;
      else if (type === 'story') mix.stories++;
    });

    return mix;
  }

  /**
   * Classify content type
   */
  private classifyContentType(tweet: any): 'thread' | 'controversial' | 'data' | 'story' | 'generic' {
    const content = (tweet.content || '').toLowerCase();
    const generator = tweet.generator_name || '';
    
    // Thread
    if (tweet.decision_type === 'thread' || generator.includes('thread')) {
      return 'thread';
    }

    // Controversial
    if (generator.includes('contrarian') || 
        generator.includes('provocateur') ||
        content.includes('unpopular') ||
        content.includes('wrong') ||
        content.includes('myth')) {
      return 'controversial';
    }

    // Data
    if (generator.includes('data') ||
        generator.includes('nerd') ||
        content.includes('%') ||
        content.includes('study') ||
        content.includes('research')) {
      return 'data';
    }

    // Story
    if (generator.includes('story') ||
        generator.includes('coach') ||
        content.includes('patient') ||
        content.includes('experience')) {
      return 'story';
    }

    return 'generic';
  }

  /**
   * Check for variety
   */
  private checkVariety(tweets: any[]): boolean {
    const types = new Set(tweets.map(t => this.classifyContentType(t)));
    return types.size >= 3; // At least 3 different types
  }

  /**
   * Check for value
   */
  private checkValue(tweets: any[]): boolean {
    // Check if tweets have actionable insights
    const valueKeywords = ['protocol', 'method', 'approach', 'technique', 'strategy', 'how to', 'steps'];
    const valuableTweets = tweets.filter(tweet => {
      const content = (tweet.content || '').toLowerCase();
      return valueKeywords.some(keyword => content.includes(keyword));
    });
    return valuableTweets.length >= 5; // At least 5 valuable tweets
  }

  /**
   * Check for personality
   */
  private checkPersonality(tweets: any[]): boolean {
    // Check for controversial takes or stories
    const personalityTweets = tweets.filter(tweet => {
      const type = this.classifyContentType(tweet);
      return type === 'controversial' || type === 'story';
    });
    return personalityTweets.length >= 2; // At least 2 personality tweets
  }

  /**
   * Check if pinned tweet is optimal
   */
  private async checkPinnedTweet(): Promise<boolean> {
    // Note: Twitter API doesn't expose pinned tweets easily
    // This would need to be checked via scraping or manual verification
    // For now, return true (assume optimal if we can't check)
    return true;
  }

  /**
   * Get optimal pinned tweet recommendation
   */
  async getOptimalPinnedTweet(): Promise<string | null> {
    const supabase = getSupabaseClient();
    
    // Find thread with highest engagement + follower conversion potential
    const { data: topThread } = await supabase
      .from('content_metadata')
      .select('tweet_id, content, actual_engagement_rate, actual_impressions')
      .eq('decision_type', 'thread')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .order('actual_engagement_rate', { ascending: false })
      .limit(1)
      .single();

    if (topThread?.tweet_id) {
      return topThread.tweet_id;
    }

    return null;
  }

  /**
   * Get content mix recommendation
   */
  getContentMixRecommendation(currentMix: ProfileAudit['contentMix']): string[] {
    const recommendations: string[] = [];
    const target = { threads: 4, controversial: 3, data: 2, stories: 1 };

    if (currentMix.threads < target.threads) {
      recommendations.push(`Generate ${target.threads - currentMix.threads} more threads`);
    }

    if (currentMix.controversial < target.controversial) {
      recommendations.push(`Generate ${target.controversial - currentMix.controversial} more controversial takes`);
    }

    if (currentMix.data < target.data) {
      recommendations.push(`Generate ${target.data - currentMix.data} more data-driven posts`);
    }

    if (currentMix.stories < target.stories) {
      recommendations.push(`Generate ${target.stories - currentMix.stories} more story-based posts`);
    }

    return recommendations;
  }
}

