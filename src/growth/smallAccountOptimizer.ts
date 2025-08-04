/**
 * 🚀 SMALL ACCOUNT OPTIMIZER
 * ==========================
 * Specialized growth system for accounts with <50 followers
 * Focuses on quality over quantity and community engagement
 */

import { supabaseClient } from '../utils/supabaseClient';

export interface SmallAccountMetrics {
  current_followers: number;
  target_followers: number;
  days_to_target: number;
  followers_per_day_needed: number;
  current_avg_likes: number;
  target_avg_likes: number;
  current_success_rate: number;
  target_success_rate: number;
}

export interface QualityContentRules {
  max_daily_posts: number;
  min_viral_score_required: number;
  engagement_hook_required: boolean;
  controversy_level_min: number;
  thread_format_preferred: boolean;
  optimal_posting_hours: number[];
}

export interface CommunityEngagementStrategy {
  daily_engagement_actions: number;
  target_influencer_types: string[];
  follower_range_targets: { min: number; max: number };
  engagement_types: string[];
  daily_reply_target: number;
  daily_like_target: number;
}

export class SmallAccountOptimizer {
  private static instance: SmallAccountOptimizer;

  private constructor() {}

  static getInstance(): SmallAccountOptimizer {
    if (!SmallAccountOptimizer.instance) {
      SmallAccountOptimizer.instance = new SmallAccountOptimizer();
    }
    return SmallAccountOptimizer.instance;
  }

  /**
   * 🎯 ANALYZE SMALL ACCOUNT GROWTH POTENTIAL
   */
  async analyzeGrowthPotential(): Promise<SmallAccountMetrics> {
    try {
      // Get current follower count (from your real analytics)
      const currentFollowers = 17;
      const targetFollowers = 50;
      const daysToTarget = 30;
      
      // Get current performance metrics
      const { data: recentTweets, error } = await supabaseClient.supabase
        .from('tweets')
        .select('likes, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('❌ Failed to get tweet data:', error);
        throw error;
      }

      const tweets = recentTweets || [];
      const totalTweets = tweets.length;
      const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
      const tweetsWithLikes = tweets.filter(tweet => (tweet.likes || 0) > 0).length;
      
      const currentAvgLikes = totalTweets > 0 ? totalLikes / totalTweets : 0;
      const currentSuccessRate = totalTweets > 0 ? (tweetsWithLikes / totalTweets) * 100 : 0;

      const metrics: SmallAccountMetrics = {
        current_followers: currentFollowers,
        target_followers: targetFollowers,
        days_to_target: daysToTarget,
        followers_per_day_needed: (targetFollowers - currentFollowers) / daysToTarget,
        current_avg_likes: currentAvgLikes,
        target_avg_likes: 1.0,
        current_success_rate: currentSuccessRate,
        target_success_rate: 25.0
      };

      console.log('📊 Small Account Growth Analysis:');
      console.log(`   Current: ${metrics.current_followers} followers`);
      console.log(`   Target: ${metrics.target_followers} followers in ${metrics.days_to_target} days`);
      console.log(`   Need: ${metrics.followers_per_day_needed.toFixed(1)} followers/day`);
      console.log(`   Current avg likes: ${metrics.current_avg_likes.toFixed(3)}`);
      console.log(`   Success rate: ${metrics.current_success_rate.toFixed(1)}%`);

      return metrics;

    } catch (error) {
      console.error('❌ Failed to analyze growth potential:', error);
      throw error;
    }
  }

  /**
   * 🔧 GET QUALITY CONTENT RULES FOR SMALL ACCOUNTS
   */
  getQualityContentRules(): QualityContentRules {
    return {
      max_daily_posts: 4, // Max 4 tweets per day (down from 6+)
      min_viral_score_required: 7.0, // Only post high-potential content
      engagement_hook_required: true, // Every tweet needs a hook
      controversy_level_min: 3, // Mild controversy for engagement
      thread_format_preferred: true, // Threads perform better
      optimal_posting_hours: [8, 9, 19, 20] // 8-9 AM, 7-8 PM
    };
  }

  /**
   * 🤝 GET COMMUNITY ENGAGEMENT STRATEGY
   */
  getCommunityEngagementStrategy(): CommunityEngagementStrategy {
    return {
      daily_engagement_actions: 15, // 15 engagements per day
      target_influencer_types: [
        'health_micro_influencers', // 1K-10K followers
        'fitness_coaches', // Fitness professionals
        'nutrition_experts', // Nutritionists
        'biohackers', // Biohacking community
        'wellness_practitioners' // Wellness professionals
      ],
      follower_range_targets: { min: 100, max: 5000 }, // Sweet spot for engagement
      engagement_types: ['meaningful_reply', 'supportive_comment', 'insightful_question'],
      daily_reply_target: 8, // 8 meaningful replies per day
      daily_like_target: 20 // 20 strategic likes per day
    };
  }

  /**
   * 🎯 SHOULD WE POST THIS CONTENT?
   */
  async shouldPostContent(content: string, metrics: any): Promise<{
    should_post: boolean;
    reasoning: string;
    improvements_needed: string[];
    viral_score: number;
  }> {
    try {
      // Check daily post count
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysPosts, error } = await supabaseClient.supabase
        .from('tweets')
        .select('tweet_id')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (error) {
        console.error('❌ Failed to check daily posts:', error);
      }

      const dailyPostCount = todaysPosts?.length || 0;
      const rules = this.getQualityContentRules();

      // Check if we've hit daily limit
      if (dailyPostCount >= rules.max_daily_posts) {
        return {
          should_post: false,
          reasoning: `Daily limit reached (${dailyPostCount}/${rules.max_daily_posts})`,
          improvements_needed: ['Wait until tomorrow', 'Focus on engagement instead'],
          viral_score: 0
        };
      }

      // Analyze content quality
      const viralScore = this.calculateViralPotential(content);
      const hasEngagementHook = this.hasEngagementHook(content);
      const controversyLevel = this.assessControversyLevel(content);
      const isOptimalTime = this.isOptimalPostingTime();

      const improvements: string[] = [];
      let shouldPost = true;

      // Quality checks
      if (viralScore < rules.min_viral_score_required) {
        shouldPost = false;
        improvements.push(`Increase viral potential (${viralScore.toFixed(1)}/10)`);
      }

      if (!hasEngagementHook) {
        shouldPost = false;
        improvements.push('Add engagement hook (question, controversy, or surprise)');
      }

      if (controversyLevel < rules.controversy_level_min) {
        improvements.push('Add mild controversy for engagement');
      }

      if (!isOptimalTime) {
        improvements.push('Consider posting during optimal hours (8-9 AM, 7-8 PM)');
      }

      const reasoning = shouldPost 
        ? `High-quality content approved (score: ${viralScore.toFixed(1)}, ${dailyPostCount + 1}/${rules.max_daily_posts} daily)`
        : `Quality standards not met - focus on improvements`;

      return {
        should_post: shouldPost,
        reasoning,
        improvements_needed: improvements,
        viral_score: viralScore
      };

    } catch (error) {
      console.error('❌ Failed to evaluate content:', error);
      return {
        should_post: false,
        reasoning: 'Error evaluating content',
        improvements_needed: ['System error - manual review needed'],
        viral_score: 0
      };
    }
  }

  /**
   * 📈 CALCULATE VIRAL POTENTIAL FOR SMALL ACCOUNTS
   */
  private calculateViralPotential(content: string): number {
    let score = 0;

    // Engagement hooks (high weight for small accounts)
    if (content.includes('?')) score += 2; // Questions drive engagement
    if (content.toLowerCase().includes('what') || content.toLowerCase().includes('how')) score += 1.5;
    if (content.toLowerCase().includes('why')) score += 2; // "Why" is controversial

    // Controversial health topics (essential for small accounts)
    const controversialTopics = [
      'doctor', 'doctors', 'medicine', 'pharmaceutical', 'FDA', 'studies show', 'research proves',
      'mainstream', 'big pharma', 'medical industry', 'conventional wisdom', 'myth', 'lie',
      'secret', 'hidden', 'truth', 'expose', 'revealed'
    ];
    
    for (const topic of controversialTopics) {
      if (content.toLowerCase().includes(topic)) {
        score += 1.5;
      }
    }

    // Actionable content (performs well)
    if (content.toLowerCase().includes('do this') || content.toLowerCase().includes('try this')) score += 1;
    if (content.toLowerCase().includes('in 30 seconds') || content.toLowerCase().includes('5 minutes')) score += 1;

    // Emotional triggers
    const emotionalWords = ['shocking', 'amazing', 'incredible', 'mistake', 'wrong', 'dangerous', 'powerful'];
    for (const word of emotionalWords) {
      if (content.toLowerCase().includes(word)) {
        score += 0.5;
      }
    }

    // Thread indicators (good for small accounts)
    if (content.includes('1/') || content.includes('🧵') || content.includes('Thread:')) score += 1;

    // Penalties for small accounts
    if (content.length > 200) score -= 0.5; // Shorter content often performs better
    if (content.includes('#')) score -= 1; // Hashtags can look spammy for small accounts

    return Math.min(10, Math.max(0, score));
  }

  /**
   * 🎯 CHECK FOR ENGAGEMENT HOOKS
   */
  private hasEngagementHook(content: string): boolean {
    const hooks = [
      content.includes('?'), // Question
      content.toLowerCase().includes('what do you think'),
      content.toLowerCase().includes('agree or disagree'),
      content.toLowerCase().includes('thoughts?'),
      content.toLowerCase().includes('am i wrong'),
      content.toLowerCase().includes('change my mind'),
      content.toLowerCase().includes('controversial take'),
      content.toLowerCase().includes('unpopular opinion')
    ];

    return hooks.some(hook => hook);
  }

  /**
   * ⚡ ASSESS CONTROVERSY LEVEL
   */
  private assessControversyLevel(content: string): number {
    let level = 0;

    // Mild controversy indicators
    if (content.toLowerCase().includes('doctor') || content.toLowerCase().includes('doctors')) level += 1;
    if (content.toLowerCase().includes('wrong') || content.toLowerCase().includes('mistake')) level += 1;
    if (content.toLowerCase().includes('myth') || content.toLowerCase().includes('lie')) level += 2;
    if (content.toLowerCase().includes('secret') || content.toLowerCase().includes('hidden')) level += 1;

    // Health controversy
    if (content.toLowerCase().includes('fda') || content.toLowerCase().includes('pharmaceutical')) level += 2;
    if (content.toLowerCase().includes('big pharma')) level += 3;

    return Math.min(5, level);
  }

  /**
   * ⏰ CHECK OPTIMAL POSTING TIME
   */
  private isOptimalPostingTime(): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    // Optimal hours: 8-9 AM, 7-8 PM
    return (hour >= 8 && hour <= 9) || (hour >= 19 && hour <= 20);
  }

  /**
   * 📊 GET POSTING SCHEDULE FOR SMALL ACCOUNTS
   */
  getOptimalPostingSchedule(): {
    recommended_times: string[];
    max_daily_posts: number;
    spacing_hours: number;
    priority_content_types: string[];
  } {
    return {
      recommended_times: ['08:00', '19:00', '20:00'], // Morning and evening
      max_daily_posts: 4,
      spacing_hours: 4, // At least 4 hours between posts
      priority_content_types: [
        'controversial_health_takes',
        'quick_actionable_tips',
        'myth_busting_threads',
        'personal_health_stories',
        'research_backed_surprises'
      ]
    };
  }

  /**
   * 🎯 TRACK GROWTH PROGRESS
   */
  async trackGrowthProgress(): Promise<{
    current_metrics: SmallAccountMetrics;
    progress_percentage: number;
    days_remaining: number;
    on_track: boolean;
    adjustments_needed: string[];
  }> {
    try {
      const metrics = await this.analyzeGrowthPotential();
      const startDate = new Date('2025-08-04'); // Today
      const targetDate = new Date(startDate.getTime() + metrics.days_to_target * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = metrics.days_to_target - daysElapsed;
      
      const expectedProgress = daysElapsed / metrics.days_to_target;
      const actualProgress = (metrics.current_followers - 17) / (metrics.target_followers - 17);
      const progressPercentage = actualProgress * 100;
      
      const onTrack = actualProgress >= expectedProgress * 0.8; // Within 80% of expected
      
      const adjustments: string[] = [];
      if (!onTrack) {
        adjustments.push('Increase community engagement');
        adjustments.push('Focus on more controversial content');
        adjustments.push('Engage with micro-influencers daily');
      }
      
      if (metrics.current_avg_likes < 0.5) {
        adjustments.push('Improve content quality and hooks');
      }
      
      if (metrics.current_success_rate < 20) {
        adjustments.push('Post fewer, higher-quality tweets');
      }

      return {
        current_metrics: metrics,
        progress_percentage: progressPercentage,
        days_remaining: daysRemaining,
        on_track: onTrack,
        adjustments_needed: adjustments
      };

    } catch (error) {
      console.error('❌ Failed to track growth progress:', error);
      throw error;
    }
  }
}

export const smallAccountOptimizer = SmallAccountOptimizer.getInstance();