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

      // Generate high-engagement content
      const contentGenerator = await getContentGenerator();
      const generationParams = {
        topic: topic || 'health breakthrough',
        format: 'single' as const,
        urgency: 'high' as const
      };
      
      const generationResult = await contentGenerator.generateContent(generationParams);
      
      if (!generationResult.success || !generationResult.content) {
        throw new Error('Failed to generate content');
      }

      // Get the first tweet from the generated content
      const tweetContent = generationResult.content.tweets[0];
      if (!tweetContent) {
        throw new Error('No tweet content generated');
      }

      // Validate for engagement potential
      const validation = await validateContent(generationResult.content);
      if (!validation.passed) {
        throw new Error(`Content validation failed: ${validation.errors?.join(', ') || 'Unknown validation error'}`);
      }

      // Optimize for engagement
      const optimizedContent = this.optimizeForEngagement(tweetContent);
      
      // Post to Twitter using the postSingleTweet method
      const poster = new TwitterPoster();
      const postResult = await poster.postSingleTweet(optimizedContent);
      
      if (!postResult.success || !postResult.tweetId) {
        throw new Error(postResult.error || 'Failed to post to Twitter');
      }

      // Track metrics immediately
      await scheduleMetricsTracking(postResult.tweetId);
      
      // Store for learning
      await storeLearningPost({
        content: optimizedContent,
        tweet_id: postResult.tweetId,
        quality_score: validation.score || 0
      });

      // Update counters
      this.lastPostTime = now;
      this.dailyPostCount++;

      logInfo('SIMPLE_POST', `✅ Posted successfully: ${postResult.tweetId}`);
      logInfo('SIMPLE_POST', `📊 Daily posts: ${this.dailyPostCount}/${this.MAX_DAILY_POSTS}`);

      return {
        success: true,
        tweetId: postResult.tweetId,
        content: optimizedContent,
        engagementPrediction: this.predictEngagement(optimizedContent)
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
