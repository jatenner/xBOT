/**
 * 🧠 AGGRESSIVE LEARNING ENGINE
 * 
 * Maximizes OpenAI API usage for rapid content quality improvement
 * - Analyzes every post's engagement performance in real-time
 * - Uses AI to identify winning patterns and failed approaches
 * - Iterates content quality rapidly with multiple AI generations
 * - Learns from likes, comments, shares, and follower conversion
 */

import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

interface EngagementLearning {
  successful_patterns: string[];
  failed_patterns: string[];
  optimal_timing: number[];
  viral_elements: string[];
  follower_conversion_triggers: string[];
  quality_improvements: string[];
}

interface ContentOptimization {
  original_content: string;
  optimized_content: string;
  improvements_applied: string[];
  predicted_engagement_boost: number;
  confidence_score: number;
}

export class AggressiveLearningEngine {
  private static instance: AggressiveLearningEngine;
  private db: AdvancedDatabaseManager;
  private openaiClient: any;
  private learningMemory: Map<string, any> = new Map();
  private maxDailyAIBudget = 5.0; // $5/day for aggressive learning
  private currentDailySpend = 0;

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
    this.initializeOpenAI();
  }

  public static getInstance(): AggressiveLearningEngine {
    if (!AggressiveLearningEngine.instance) {
      AggressiveLearningEngine.instance = new AggressiveLearningEngine();
    }
    return AggressiveLearningEngine.instance;
  }

  /**
   * 🎯 MAIN LEARNING FUNCTION: Analyze recent post performance and extract insights
   */
  public async learnFromRecentEngagement(): Promise<EngagementLearning> {
    console.log('🧠 AGGRESSIVE_LEARNING: Analyzing recent engagement patterns for rapid improvement');

    const [
      recentPosts,
      engagementData,
      followerConversions
    ] = await Promise.all([
      this.getRecentPostsWithMetrics(),
      this.getDetailedEngagementData(),
      this.getFollowerConversionData()
    ]);

    console.log(`📊 LEARNING_DATA: ${recentPosts.length} posts, ${engagementData.length} engagement points`);

    // Use AI to identify patterns
    const learningInsights = await this.analyzeEngagementPatternsWithAI(
      recentPosts,
      engagementData,
      followerConversions
    );

    // Store learning in memory for rapid access
    this.learningMemory.set('latest_insights', learningInsights);
    this.learningMemory.set('last_updated', Date.now());

    console.log(`🎯 LEARNING_RESULTS: ${learningInsights.successful_patterns.length} success patterns, ${learningInsights.failed_patterns.length} failures identified`);

    return learningInsights;
  }

  /**
   * 🚀 AGGRESSIVE CONTENT OPTIMIZATION: Use AI to improve content before posting
   */
  public async optimizeContentForMaxEngagement(originalContent: string): Promise<ContentOptimization> {
    console.log('🚀 CONTENT_OPTIMIZATION: Using AI to maximize engagement potential');

    // Get latest learning insights
    const insights = this.learningMemory.get('latest_insights') || await this.learnFromRecentEngagement();

    // Use OpenAI to optimize content based on learning
    const optimization = await this.generateOptimizedContent(originalContent, insights);

    console.log(`💎 OPTIMIZATION_COMPLETE: ${optimization.improvements_applied.length} improvements, +${(optimization.predicted_engagement_boost * 100).toFixed(0)}% predicted boost`);

    return optimization;
  }

  /**
   * 🧮 Use OpenAI to analyze engagement patterns
   */
  private async analyzeEngagementPatternsWithAI(
    posts: any[],
    engagementData: any[],
    followerData: any[]
  ): Promise<EngagementLearning> {
    
    if (this.currentDailySpend >= this.maxDailyAIBudget) {
      console.log('⚠️ Daily AI budget reached, using cached insights');
      return this.getCachedInsights();
    }

    try {
      const analysisPrompt = `Analyze Twitter engagement data for health/wellness content to maximize likes, comments, and followers.

RECENT POSTS DATA:
${posts.slice(0, 10).map(p => `
Post: "${p.content}"
Engagement: ${p.likes_count || 0} likes, ${p.retweets_count || 0} retweets, ${p.replies_count || 0} replies
Time: ${p.posted_at}
Followers gained: ${p.followers_gained || 0}
`).join('')}

TASK: Extract patterns for MAXIMUM ENGAGEMENT growth.

Return JSON format:
{
  "successful_patterns": ["specific patterns that got high engagement"],
  "failed_patterns": ["patterns that got zero/low engagement"],
  "optimal_timing": [hour array for best times],
  "viral_elements": ["elements that made content viral"],
  "follower_conversion_triggers": ["what made people follow"],
  "quality_improvements": ["specific improvements for next posts"]
}

Focus on VIRAL GROWTH, not academic content.`;

      const response = await this.callOpenAI(analysisPrompt);
      this.currentDailySpend += 0.02; // Track spending

      const insights = JSON.parse(response);
      
      // Store insights in database for persistence
      await this.storeInsights(insights);

      return insights;
    } catch (error) {
      console.warn('⚠️ AI analysis failed, using fallback patterns:', error);
      return this.getFallbackInsights();
    }
  }

  /**
   * 🎨 Generate optimized content using AI
   */
  private async generateOptimizedContent(
    originalContent: string,
    insights: EngagementLearning
  ): Promise<ContentOptimization> {
    
    if (this.currentDailySpend >= this.maxDailyAIBudget) {
      console.log('⚠️ Daily AI budget reached, returning original content');
      return {
        original_content: originalContent,
        optimized_content: originalContent,
        improvements_applied: ['budget_limit_reached'],
        predicted_engagement_boost: 0,
        confidence_score: 0.5
      };
    }

    try {
      const optimizationPrompt = `OPTIMIZE this health/wellness tweet for MAXIMUM ENGAGEMENT and FOLLOWER GROWTH.

ORIGINAL TWEET:
"${originalContent}"

LEARNED SUCCESS PATTERNS:
${insights.successful_patterns.slice(0, 5).map(p => `• ${p}`).join('\n')}

FAILED PATTERNS TO AVOID:
${insights.failed_patterns.slice(0, 3).map(p => `• ${p}`).join('\n')}

VIRAL ELEMENTS TO INCLUDE:
${insights.viral_elements.slice(0, 4).map(p => `• ${p}`).join('\n')}

INSTRUCTIONS:
1. Keep under 260 characters
2. Add engagement hooks (questions, controversy, urgency)
3. Include viral elements from successful posts
4. Avoid failed patterns
5. Optimize for likes, retweets, and NEW FOLLOWERS
6. Make it feel human and authentic
7. Add health value that's actionable

Return JSON:
{
  "optimized_content": "the improved tweet text",
  "improvements_applied": ["list of specific changes made"],
  "predicted_engagement_boost": 0.3,
  "confidence_score": 0.8,
  "reasoning": "why these changes will increase engagement"
}`;

      const response = await this.callOpenAI(optimizationPrompt);
      this.currentDailySpend += 0.03; // Track spending

      const optimization = JSON.parse(response);
      
      console.log(`🎨 AI_OPTIMIZATION: ${optimization.improvements_applied.join(', ')}`);
      console.log(`💡 AI_REASONING: ${optimization.reasoning}`);

      return {
        original_content: originalContent,
        optimized_content: optimization.optimized_content,
        improvements_applied: optimization.improvements_applied,
        predicted_engagement_boost: optimization.predicted_engagement_boost || 0.2,
        confidence_score: optimization.confidence_score || 0.7
      };
    } catch (error) {
      console.warn('⚠️ Content optimization failed:', error);
      return {
        original_content: originalContent,
        optimized_content: originalContent,
        improvements_applied: ['optimization_failed'],
        predicted_engagement_boost: 0,
        confidence_score: 0.5
      };
    }
  }

  /**
   * 📊 Learn from specific post performance in real-time
   */
  public async learnFromPostPerformance(tweetId: string, metrics: any): Promise<void> {
    console.log(`📊 REAL_TIME_LEARNING: Analyzing performance of ${tweetId}`);

    try {
      // Get the post content and metrics
      const postData = await this.db.executeQuery(
        'get_post_for_learning',
        async (client) => {
          const { data } = await client
            .from('learning_posts')
            .select('*')
            .eq('tweet_id', tweetId)
            .single();
          
          return data;
        }
      );

      if (!postData) {
        console.warn(`⚠️ No post data found for ${tweetId}`);
        return;
      }

      // Calculate engagement rate
      const totalEngagement = (metrics.likes || 0) + (metrics.retweets || 0) + (metrics.replies || 0);
      const impressions = metrics.impressions || Math.max(100, totalEngagement * 20);
      const engagementRate = totalEngagement / impressions;

      console.log(`📈 PERFORMANCE: ${totalEngagement} total engagement, ${(engagementRate * 100).toFixed(2)}% rate`);

      // If performance is very good or very bad, learn from it
      if (engagementRate > 0.05 || engagementRate < 0.005) {
        await this.extractLearningFromPost(postData, metrics, engagementRate);
      }

      // Update viral potential score based on actual performance
      const newViralScore = Math.min(100, Math.max(0, engagementRate * 2000));
      
      await this.db.executeQuery(
        'update_viral_score',
        async (client) => {
          const { error } = await client
            .from('learning_posts')
            .update({
              viral_potential_score: newViralScore,
              actual_engagement_rate: engagementRate,
              learning_updated_at: new Date().toISOString()
            })
            .eq('tweet_id', tweetId);

          if (error) console.warn('Could not update viral score:', error);
        }
      );

    } catch (error) {
      console.warn(`⚠️ Failed to learn from post ${tweetId}:`, error);
    }
  }

  /**
   * 🔍 Extract specific learning insights from a post
   */
  private async extractLearningFromPost(postData: any, metrics: any, engagementRate: number): Promise<void> {
    const isSuccessful = engagementRate > 0.03; // Above 3% is very good
    
    console.log(`🔍 EXTRACTING_LEARNING: ${isSuccessful ? 'SUCCESS' : 'FAILURE'} pattern from post`);

    if (this.currentDailySpend < this.maxDailyAIBudget) {
      try {
        const learningPrompt = `Analyze this ${isSuccessful ? 'SUCCESSFUL' : 'FAILED'} health/wellness tweet for learning.

TWEET: "${postData.content}"
PERFORMANCE: ${metrics.likes || 0} likes, ${metrics.retweets || 0} retweets, ${metrics.replies || 0} replies
ENGAGEMENT RATE: ${(engagementRate * 100).toFixed(2)}%
RESULT: ${isSuccessful ? 'HIGH ENGAGEMENT' : 'LOW ENGAGEMENT'}

Extract specific learnings:
1. What elements made this ${isSuccessful ? 'successful' : 'fail'}?
2. What patterns should we ${isSuccessful ? 'replicate' : 'avoid'}?
3. How can we apply this learning to future posts?

Return JSON:
{
  "key_elements": ["specific elements that caused this result"],
  "pattern_type": "${isSuccessful ? 'success' : 'failure'}_pattern",
  "actionable_insights": ["specific changes for future posts"],
  "confidence": 0.8
}`;

        const response = await this.callOpenAI(learningPrompt);
        this.currentDailySpend += 0.015;

        const learning = JSON.parse(response);
        
        // Store the learning
        await this.storeSpecificLearning(postData.tweet_id, learning, isSuccessful);

        console.log(`💡 LEARNING_EXTRACTED: ${learning.actionable_insights.join('; ')}`);
      } catch (error) {
        console.warn('⚠️ Failed to extract AI learning:', error);
      }
    }
  }

  /**
   * 🗃️ Get recent posts with engagement metrics
   */
  private async getRecentPostsWithMetrics(): Promise<any[]> {
    return await this.db.executeQuery(
      'get_recent_posts_metrics',
      async (client) => {
        const { data } = await client
          .from('learning_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        return data || [];
      }
    );
  }

  /**
   * 📈 Get detailed engagement data
   */
  private async getDetailedEngagementData(): Promise<any[]> {
    return await this.db.executeQuery(
      'get_engagement_data',
      async (client) => {
        const { data } = await client
          .from('tweet_metrics')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        return data || [];
      }
    );
  }

  /**
   * 👥 Get follower conversion data
   */
  private async getFollowerConversionData(): Promise<any[]> {
    // This would track which posts led to follower gains
    // For now return empty array, can be enhanced with follower tracking
    return [];
  }

  /**
   * 🤖 Call OpenAI API with error handling
   */
  private async callOpenAI(prompt: string): Promise<string> {
    try {
      if (!this.openaiClient) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini', // Cost-effective for learning
        messages: [
          {
            role: 'system',
            content: 'You are a Twitter growth expert specializing in viral health/wellness content. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || '{}';
    } catch (error: any) {
      console.error('❌ OpenAI call failed:', error.message);
      throw error;
    }
  }

  /**
   * 🔧 Initialize OpenAI client
   */
  private async initializeOpenAI(): Promise<void> {
    try {
      const { OpenAI } = await import('openai');
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('🤖 OpenAI client initialized for aggressive learning');
    } catch (error) {
      console.warn('⚠️ Could not initialize OpenAI client:', error);
    }
  }

  /**
   * 💾 Store learning insights in database
   */
  private async storeInsights(insights: EngagementLearning): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_learning_insights',
        async (client) => {
          const { error } = await client
            .from('learning_insights')
            .insert({
              insights_data: insights,
              created_at: new Date().toISOString(),
              confidence_score: 0.8,
              source: 'aggressive_learning_engine'
            });

          if (error) console.warn('Could not store insights:', error);
        }
      );
    } catch (error) {
      console.warn('⚠️ Failed to store insights:', error);
    }
  }

  /**
   * 📝 Store specific post learning
   */
  private async storeSpecificLearning(tweetId: string, learning: any, isSuccess: boolean): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_specific_learning',
        async (client) => {
          const { error } = await client
            .from('post_learnings')
            .insert({
              tweet_id: tweetId,
              learning_data: learning,
              is_success_pattern: isSuccess,
              created_at: new Date().toISOString()
            });

          if (error) console.warn('Could not store specific learning:', error);
        }
      );
    } catch (error) {
      console.warn('⚠️ Failed to store specific learning:', error);
    }
  }

  /**
   * 📚 Get cached insights when budget is reached
   */
  private getCachedInsights(): EngagementLearning {
    return {
      successful_patterns: [
        'Question hooks that create engagement',
        'Health facts with numbers/statistics',
        'Controversial but evidence-based statements',
        'Quick actionable tips',
        'Personal transformation stories'
      ],
      failed_patterns: [
        'Too academic/dry language',
        'No engagement hook or question',
        'Too long (over 250 characters)',
        'Generic advice without specifics'
      ],
      optimal_timing: [8, 12, 18, 20],
      viral_elements: [
        'Shocking health statistics',
        'Debunk common health myths',
        'Simple but effective tips',
        'Call-to-action questions'
      ],
      follower_conversion_triggers: [
        'Exclusive health insights',
        'Evidence-based controversial takes',
        'Practical, actionable advice'
      ],
      quality_improvements: [
        'Add engagement question',
        'Include specific numbers/data',
        'Create urgency or curiosity',
        'Make it more controversial'
      ]
    };
  }

  /**
   * 🛟 Get fallback insights if AI fails
   */
  private getFallbackInsights(): EngagementLearning {
    return this.getCachedInsights();
  }

  /**
   * 💰 Reset daily AI budget (called by scheduler)
   */
  public resetDailyBudget(): void {
    this.currentDailySpend = 0;
    console.log('💰 Daily AI budget reset for aggressive learning');
  }

  /**
   * 📊 Get learning status
   */
  public getLearningStatus(): any {
    return {
      daily_spend: this.currentDailySpend,
      budget_remaining: this.maxDailyAIBudget - this.currentDailySpend,
      cached_insights: this.learningMemory.size,
      last_updated: this.learningMemory.get('last_updated') || 0
    };
  }
}
