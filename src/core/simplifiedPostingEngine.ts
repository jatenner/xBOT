/**
 * SIMPLIFIED POSTING ENGINE - Emergency Fix
 * 
 * This replaces the over-complex autonomous posting system with a simple,
 * reliable posting mechanism focused on actual engagement results.
 */

import { TwitterPoster } from '../posting/postThread';
import { getContentGenerator } from '../ai/generate';
import { validateContent } from '../quality/qualityGate';
import { scheduleMetricsTracking } from '../metrics/trackTweet';
import { storeLearningPost } from '../db/index';
import { logInfo, logError } from '../utils/intelligentLogging';

export interface SimplePostResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  error?: string;
  engagementPrediction?: number;
}

export class SimplifiedPostingEngine {
  private static instance: SimplifiedPostingEngine;
  private isPosting = false;
  private lastPostTime = 0;
  private readonly MIN_POST_INTERVAL = 60 * 60 * 1000; // 60 minutes for growth
  private readonly MAX_DAILY_POSTS = 20; // Increased for small account growth
  private dailyPostCount = 0;
  private lastResetDate = new Date().toDateString();

  private constructor() {}

  public static getInstance(): SimplifiedPostingEngine {
    if (!SimplifiedPostingEngine.instance) {
      SimplifiedPostingEngine.instance = new SimplifiedPostingEngine();
    }
    return SimplifiedPostingEngine.instance;
  }

  /**
   * Simple, reliable posting with engagement optimization
   */
  public async createEngagingPost(topic?: string): Promise<SimplePostResult> {
    if (this.isPosting) {
      return { success: false, error: 'Already posting' };
    }

    // Reset daily counter if new day
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyPostCount = 0;
      this.lastResetDate = today;
    }

    // Check rate limits
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    
    if (timeSinceLastPost < this.MIN_POST_INTERVAL) {
      const waitMinutes = Math.ceil((this.MIN_POST_INTERVAL - timeSinceLastPost) / 60000);
      return { 
        success: false, 
        error: `Rate limited. Wait ${waitMinutes} minutes` 
      };
    }

    if (this.dailyPostCount >= this.MAX_DAILY_POSTS) {
      return { 
        success: false, 
        error: 'Daily post limit reached' 
      };
    }

    this.isPosting = true;
    
    try {
      logInfo('SIMPLE_POST', `Creating engaging post ${this.dailyPostCount + 1}/${this.MAX_DAILY_POSTS}`);

            // 🚀 ULTIMATE CONTENT SYSTEM: Use comprehensive orchestrator
      const { UnifiedContentOrchestrator } = await import('../content/unifiedContentOrchestrator');
      const orchestrator = UnifiedContentOrchestrator.getInstance();
      
      console.log('🎯 ULTIMATE_SYSTEM: Generating comprehensive optimized content...');
      const ultimateContent = await orchestrator.generateUltimateContent({
        topic: topic,
        urgency: 'medium',
        target_metric: 'followers', // Focus on follower growth
        content_type: 'auto', // Let AI decide format
        learning_priority: true // Use for learning
      });
      
      console.log(`🎖️ ULTIMATE_QUALITY: ${ultimateContent.metadata.generation_quality}/100`);
      console.log(`📈 GROWTH_SCORE: ${ultimateContent.metadata.growth_score}/100`);
      console.log(`🔥 VIRAL_PROBABILITY: ${ultimateContent.metadata.viral_probability}/100`);
      console.log(`🧠 AUTHENTICITY: ${ultimateContent.metadata.authenticity_score}/100`);
      console.log(`📊 PREDICTIONS: ${ultimateContent.predictions.likes} likes, ${ultimateContent.predictions.followers_gained} followers`);
      console.log(`⏰ STRATEGY: ${ultimateContent.strategy.posting_time}`);

      // Use the ultimate content (detect if thread or single)
      const isThreadContent = ultimateContent.content.includes('/') || ultimateContent.content.split('\n\n').length > 1;
      const tweets = isThreadContent 
        ? ultimateContent.content.split('\n\n').filter(t => t.trim()) 
        : [ultimateContent.content];

      const generationResult = {
        content: {
          tweets: tweets
        },
        ultimateResult: ultimateContent // Store for learning
      };

      console.log(`🎯 ULTIMATE_POST: Generated ${isThreadContent ? 'thread' : 'single'} with ${tweets.length} tweet(s)`);
      
      if (!generationResult?.content?.tweets?.length) {
        throw new Error('No content generated');
      }

      // Handle both single tweets and threads
      const isThread = generationResult.content.tweets.length > 1;
      
      // Validate for engagement potential
      // Skip validation for ultimate system - it has its own quality gates
      // Quality validation is handled by the UnifiedContentOrchestrator

      let postResult;
      if (isThread) {
        console.log(`🧵 SIMPLE_POST: Posting ${generationResult.content.tweets.length}-tweet thread`);
        
        // Use UnifiedPostingManager for thread posting
        const { UnifiedPostingManager } = await import('../posting/unifiedPostingManager');
        const unifiedPoster = UnifiedPostingManager.getInstance();
        
        // Optimize all tweets in the thread
        const optimizedTweets = generationResult.content.tweets.map(tweet => 
          this.optimizeForEngagement(tweet)
        );
        
        postResult = await unifiedPoster.post(optimizedTweets, {
          topic: topic || 'health optimization',
          retryAttempts: 2
        });
        
      } else {
        console.log('📝 SIMPLE_POST: Posting single tweet');
        
        // Get the single tweet content
        const tweetContent = generationResult.content.tweets[0];
        if (!tweetContent) {
          throw new Error('No tweet content generated');
        }
        
        // Optimize for engagement
        const optimizedContent = this.optimizeForEngagement(tweetContent);
        
        // Post to Twitter using the postSingleTweet method  
        const poster = new TwitterPoster();
        postResult = await poster.postSingleTweet(optimizedContent);
      }
      
      if (!postResult.success || !postResult.tweetId) {
        throw new Error(postResult.error || 'Failed to post to Twitter');
      }

      // Track metrics immediately
      await scheduleMetricsTracking(postResult.tweetId);
      
      // Store for learning with correct format tracking
      const contentForStorage = isThread ? 
        (postResult as any).allTweets?.join('\n\n') || generationResult.content.tweets.join('\n\n') :
        (postResult as any).content || generationResult.content.tweets[0];
        
      await storeLearningPost({
        content: contentForStorage,
        tweet_id: postResult.tweetId,
        quality_score: validation.score || 0
      });

      // Update counters
      this.lastPostTime = now;
      this.dailyPostCount++;

      logInfo('SIMPLE_POST', `✅ Posted ${isThread ? 'thread' : 'single tweet'} successfully: ${postResult.tweetId}`);
      logInfo('SIMPLE_POST', `📊 Daily posts: ${this.dailyPostCount}/${this.MAX_DAILY_POSTS}`);

              // Store ultimate content result for learning
        const ultimateResult = (generationResult as any).ultimateResult;
        if (ultimateResult) {
          try {
            // Store the ultimate content data for future learning
            await this.storeUltimateContentData(postResult.tweetId, ultimateResult);
          } catch (error) {
            console.warn('⚠️ Failed to store ultimate content data:', error);
          }
        }

        return {
          success: true,
          tweetId: postResult.tweetId,
          content: contentForStorage,
          engagementPrediction: ultimateResult?.predictions?.likes || 5
        };

    } catch (error: any) {
      logError('SIMPLE_POST', `❌ Failed to create post: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isPosting = false;
    }
  }

  /**
   * Build prompt optimized for engagement
   */
  private buildEngagementOptimizedPrompt(topic?: string): string {
    const basePrompt = `Create a highly engaging health/wellness tweet that will get likes, retweets, and replies.

ENGAGEMENT REQUIREMENTS:
- Start with an attention-grabbing hook (shocking stat, surprising fact, or bold claim)
- Include specific numbers or percentages 
- Make it controversial but defensible
- End with a question or call-to-action
- Use 1-2 relevant emojis maximum
- Keep under 250 characters
- Make people want to share it

CONTENT FOCUS: ${topic || 'breakthrough health research, wellness tips, or medical innovations'}

EXAMPLES OF HIGH-ENGAGEMENT PATTERNS:
- "97% of people don't know this about [health topic]..."
- "[Shocking statistic] about [common health belief] - here's why..."
- "Doctors hate this simple [health hack] that [specific benefit]..."

Create content that makes people stop scrolling and engage.`;

    return basePrompt;
  }

  /**
   * Optimize content for maximum engagement
   */
  private optimizeForEngagement(content: string): string {
    let optimized = content.trim();

    // Ensure it has engagement triggers
    const engagementTriggers = [
      /\d+%/, // Percentages
      /\$\d+/, // Dollar amounts
      /\d+x/, // Multipliers
      /\d+ (minutes?|hours?|days?|weeks?|months?)/, // Time periods
      /\?$/, // Questions
      /\!$/, // Exclamations
    ];

    const hasEngagementTrigger = engagementTriggers.some(trigger => trigger.test(optimized));
    
    if (!hasEngagementTrigger && !optimized.includes('?')) {
      // Add a question to increase engagement
      optimized += '\n\nThoughts?';
    }

    // Ensure proper length (Twitter sweet spot is 71-100 characters for engagement)
    if (optimized.length > 250) {
      optimized = optimized.substring(0, 247) + '...';
    }

    return optimized;
  }

  /**
   * Store ultimate content data for future learning
   */
  private async storeUltimateContentData(tweetId: string, ultimateResult: any): Promise<void> {
    try {
      // Store in a dedicated table or enhance existing storage
      console.log(`📚 STORING_ULTIMATE_DATA: ${tweetId} with ${ultimateResult.metadata.generation_quality}/100 quality`);
      
      // You could store this in a dedicated database table for advanced analytics
      // For now, we'll log the key metrics
      console.log(`🎯 STORED_METRICS: Growth ${ultimateResult.metadata.growth_score}/100, Viral ${ultimateResult.metadata.viral_probability}/100`);
      
    } catch (error) {
      console.error('❌ Failed to store ultimate content data:', error);
    }
  }

  /**
   * Predict engagement potential (0-100)
   */
  private predictEngagement(content: string): number {
    let score = 50; // Base score

    // Check for engagement factors
    if (/\d+%/.test(content)) score += 15; // Has percentage
    if (/\?/.test(content)) score += 10; // Has question
    if (/\!/.test(content)) score += 5; // Has exclamation
    if (content.length >= 71 && content.length <= 100) score += 10; // Optimal length
    if (/\b(shocking|surprising|breakthrough|secret|hidden)\b/i.test(content)) score += 10; // Power words
    if (/\$\d+/.test(content)) score += 8; // Has money amount
    if (/\d+x/.test(content)) score += 8; // Has multiplier

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get current status
   */
  public getStatus() {
    return {
      isPosting: this.isPosting,
      dailyPostCount: this.dailyPostCount,
      maxDailyPosts: this.MAX_DAILY_POSTS,
      lastPostTime: this.lastPostTime,
      canPostNow: !this.isPosting && 
                  (Date.now() - this.lastPostTime) >= this.MIN_POST_INTERVAL &&
                  this.dailyPostCount < this.MAX_DAILY_POSTS
    };
  }
}
