/**
 * 🚀 FOLLOWER GROWTH SERVICE
 * Integrates follower growth optimization into the main posting pipeline
 * 
 * This service wraps around existing systems to maximize follower acquisition
 */

import { getFollowerGrowthAccelerator } from '../intelligence/followerGrowthAccelerator';
import { generateViralHealthContent } from '../content/viralHealthFormulas';

interface FollowerOptimizedContent {
  content: string | string[];
  isThread: boolean;
  expectedFollowers: number;
  viralPotential: number;
  strategy: string;
  metadata: any;
}

export class FollowerGrowthService {
  private static instance: FollowerGrowthService;
  private growthAccelerator = getFollowerGrowthAccelerator();

  private constructor() {}

  public static getInstance(): FollowerGrowthService {
    if (!FollowerGrowthService.instance) {
      FollowerGrowthService.instance = new FollowerGrowthService();
    }
    return FollowerGrowthService.instance;
  }

  /**
   * 🎯 OPTIMIZE CONTENT FOR MAXIMUM FOLLOWER GROWTH
   */
  public async optimizeForFollowerGrowth(topic?: string): Promise<FollowerOptimizedContent> {
    console.log('🚀 FOLLOWER_SERVICE: Optimizing content for maximum follower acquisition');

    try {
      // Generate follower magnet content using viral formulas
      const followerMagnet = await this.growthAccelerator.generateFollowerMagnetContent(
        topic || 'health optimization'
      );

      // Determine format
      const isThread = Array.isArray(followerMagnet.content) && followerMagnet.content.length > 1;
      
      console.log(`✅ FOLLOWER_SERVICE: Created ${isThread ? 'thread' : 'single'} with ${followerMagnet.expectedFollowers} expected followers`);
      console.log(`🔥 VIRAL_POTENTIAL: ${followerMagnet.viralPotential}/10`);
      console.log(`📈 STRATEGY: ${followerMagnet.strategy}`);

      return {
        content: followerMagnet.content,
        isThread,
        expectedFollowers: followerMagnet.expectedFollowers,
        viralPotential: followerMagnet.viralPotential,
        strategy: followerMagnet.strategy,
        metadata: {
          followerOptimized: true,
          expectedFollowers: followerMagnet.expectedFollowers,
          viralPotential: followerMagnet.viralPotential,
          strategy: followerMagnet.strategy,
          optimalPostingTime: followerMagnet.postingTime,
          growthAccelerated: true,
          qualityScore: followerMagnet.viralPotential * 10
        }
      };

    } catch (error: any) {
      console.error('❌ FOLLOWER_SERVICE: Optimization failed:', error.message);
      
      // Fallback to basic viral content
      return this.getFallbackContent(topic);
    }
  }

  /**
   * 📊 ANALYZE CURRENT GROWTH PERFORMANCE
   */
  public async analyzeCurrentGrowth(): Promise<{
    currentFollowers: number;
    growthRate: number;
    recommendations: string[];
    urgentActions: string[];
  }> {
    console.log('📊 FOLLOWER_SERVICE: Analyzing current growth performance');

    // Mock current metrics (in production, this would fetch from Twitter API)
    const currentFollowers = 23; // Current follower count from your account
    const weeklyGrowthRate = 0.5; // Estimated based on current performance

    const recommendations = [];
    const urgentActions = [];

    // Growth rate analysis
    if (weeklyGrowthRate < 5) {
      urgentActions.push('Activate emergency growth protocol');
      urgentActions.push('Increase thread posting to 5+ per day');
      urgentActions.push('Focus on myth-busting content for viral potential');
    }

    if (currentFollowers < 50) {
      recommendations.push('Use controversial health takes for maximum engagement');
      recommendations.push('Share personal transformation data');
      recommendations.push('Create "save this thread" educational content');
      recommendations.push('Engage with health influencers consistently');
    }

    if (currentFollowers < 100) {
      recommendations.push('Post at optimal times: 6 AM, 12 PM, 6 PM, 9 PM');
      recommendations.push('Use data-driven content: "I analyzed X studies..."');
      recommendations.push('Create viral protocols: "Exact method I used..."');
    }

    return {
      currentFollowers,
      growthRate: weeklyGrowthRate,
      recommendations,
      urgentActions
    };
  }

  /**
   * 🔥 GET EMERGENCY GROWTH CONTENT
   */
  public async getEmergencyGrowthContent(): Promise<FollowerOptimizedContent> {
    console.log('🚨 FOLLOWER_SERVICE: Generating emergency growth content');

    const emergencyProtocol = await this.growthAccelerator.activateEmergencyGrowth();
    
    // Create high-impact viral content
    const viralContent = generateViralHealthContent('health myths', 100);
    
    return {
      content: viralContent.content,
      isThread: true,
      expectedFollowers: viralContent.expectedFollowers,
      viralPotential: viralContent.viralPotential,
      strategy: 'Emergency Growth Protocol',
      metadata: {
        emergencyGrowth: true,
        expectedResults: emergencyProtocol.expectedResults,
        immediateActions: emergencyProtocol.immediateActions,
        urgentPosting: true,
        maxViralPotential: true
      }
    };
  }

  /**
   * 📈 GET WEEKLY GROWTH PLAN
   */
  public async getWeeklyGrowthPlan(targetFollowers: number = 50): Promise<{
    dailyStrategy: Array<{
      day: string;
      posts: number;
      contentType: string;
      optimalTimes: number[];
      expectedGrowth: number;
    }>;
    weeklyTarget: number;
    keyTactics: string[];
  }> {
    console.log(`📈 FOLLOWER_SERVICE: Creating weekly growth plan for ${targetFollowers} followers`);

    const weeklyPlan = await this.growthAccelerator.getWeeklyGrowthPlan(targetFollowers);
    
    const dailyStrategy = [
      {
        day: 'Monday',
        posts: weeklyPlan.dailyPosts,
        contentType: 'Myth-busting threads',
        optimalTimes: weeklyPlan.optimalTimes,
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 7)
      },
      {
        day: 'Tuesday',
        posts: weeklyPlan.dailyPosts,
        contentType: 'Data-driven research',
        optimalTimes: weeklyPlan.optimalTimes,
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 7)
      },
      {
        day: 'Wednesday',
        posts: weeklyPlan.dailyPosts,
        contentType: 'Transformation protocols',
        optimalTimes: weeklyPlan.optimalTimes,
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 7)
      },
      {
        day: 'Thursday',
        posts: weeklyPlan.dailyPosts,
        contentType: 'Controversial takes',
        optimalTimes: weeklyPlan.optimalTimes,
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 7)
      },
      {
        day: 'Friday',
        posts: weeklyPlan.dailyPosts,
        contentType: 'Weekend health hacks',
        optimalTimes: weeklyPlan.optimalTimes,
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 7)
      },
      {
        day: 'Saturday',
        posts: Math.ceil(weeklyPlan.dailyPosts * 0.7),
        contentType: 'Lifestyle wellness',
        optimalTimes: [9, 14, 19], // Weekend timing
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 10)
      },
      {
        day: 'Sunday',
        posts: Math.ceil(weeklyPlan.dailyPosts * 0.7),
        contentType: 'Weekly recap & motivation',
        optimalTimes: [10, 15, 20], // Weekend timing
        expectedGrowth: Math.round(weeklyPlan.expectedGrowth / 10)
      }
    ];

    return {
      dailyStrategy,
      weeklyTarget: weeklyPlan.expectedGrowth,
      keyTactics: [
        'Focus 80% on thread content for educational depth',
        'Use viral formulas: myth-busting, data-driven, controversial',
        'Post at peak engagement times: 6 AM, 12 PM, 6 PM, 9 PM',
        'Include call-to-actions for replies and saves',
        'Engage with comments within 30 minutes',
        'Share transformation data and personal results',
        'Create "save this thread" content for bookmarking'
      ]
    };
  }

  /**
   * 🎯 INTEGRATION WRAPPER
   */
  public async integrateWithExistingContent(existingContent: any, topic?: string): Promise<any> {
    console.log('🎯 FOLLOWER_SERVICE: Integrating growth optimization with existing content');

    try {
      // Get growth-optimized content
      const growthContent = await this.optimizeForFollowerGrowth(topic);

      // Merge with existing metadata
      const enhancedMetadata = {
        ...existingContent.metadata,
        ...growthContent.metadata,
        followerGrowthIntegrated: true,
        originalSystem: 'unified_ai',
        growthOptimized: true
      };

      // Use growth content if it has higher potential
      if (growthContent.viralPotential > 7) {
        console.log('🚀 FOLLOWER_SERVICE: Using growth-optimized content (higher viral potential)');
        return {
          ...existingContent,
          content: growthContent.content,
          isThread: growthContent.isThread,
          metadata: enhancedMetadata
        };
      } else {
        console.log('🔄 FOLLOWER_SERVICE: Enhancing existing content with growth metadata');
        return {
          ...existingContent,
          metadata: enhancedMetadata
        };
      }

    } catch (error: any) {
      console.warn('⚠️ FOLLOWER_SERVICE: Integration failed, using original content:', error.message);
      return existingContent;
    }
  }

  /**
   * Fallback content generation
   */
  private getFallbackContent(topic?: string): FollowerOptimizedContent {
    const fallbackThreads = [
      [
        'The health industry is keeping you sick.',
        'Here\'s what they don\'t want you to know:',
        'Most "healthy" advice actually makes things worse.',
        'After analyzing 500+ studies, here are the real fundamentals:',
        '1. Sleep consistency beats perfection every time',
        '2. Walking > intense cardio for fat loss',
        '3. Protein timing matters more than total amount',
        '4. Stress kills more than bad food choices',
        'Stop overcomplicating health. Master these basics first.'
      ],
      [
        'Everyone gets weight loss wrong.',
        'They focus on calories. Big mistake.',
        'Real weight loss is about hormones:',
        'Insulin sensitivity determines fat storage',
        'Cortisol blocks fat burning completely',
        'Thyroid controls metabolic rate',
        'Leptin signals when to stop eating',
        'Fix your hormones first. Weight follows automatically.',
        'Save this thread for your transformation journey.'
      ]
    ];

    const selectedThread = fallbackThreads[Math.floor(Math.random() * fallbackThreads.length)];

    return {
      content: selectedThread,
      isThread: true,
      expectedFollowers: 15,
      viralPotential: 7,
      strategy: 'Fallback Viral Content',
      metadata: {
        fallbackContent: true,
        viralPotential: 7,
        expectedFollowers: 15
      }
    };
  }
}

export const getFollowerGrowthService = () => FollowerGrowthService.getInstance();
