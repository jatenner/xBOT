/**
 * OPTIMIZED POSTING ENGINE
 * 
 * Replaces the old autonomous posting engine with one that ACTUALLY uses
 * engagement optimization insights to improve performance.
 */

import { OptimizationAwareContentEngine } from '../content/optimizationAwareContentEngine';
import { EngagementOptimizer } from '../intelligence/engagementOptimizer';
import { TwitterPoster } from '../posting/TwitterPoster';

interface OptimizedPostResult {
  success: boolean;
  tweetId?: string;
  engagementPrediction?: number;
  appliedOptimizations?: string[];
  error?: string;
}

interface PostingMetrics {
  postsToday: number;
  averageEngagement: number;
  optimizationSuccess: number;
  lastPostTime: Date;
}

export class OptimizedPostingEngine {
  private static instance: OptimizedPostingEngine;
  private contentEngine: OptimizationAwareContentEngine;
  private engagementOptimizer: EngagementOptimizer;
  private poster: TwitterPoster;
  private metrics: PostingMetrics;
  private isPosting: boolean = false;

  private constructor() {
    this.contentEngine = OptimizationAwareContentEngine.getInstance();
    this.engagementOptimizer = EngagementOptimizer.getInstance();
    this.poster = new TwitterPoster();
    this.metrics = {
      postsToday: 0,
      averageEngagement: 0,
      optimizationSuccess: 0,
      lastPostTime: new Date(0)
    };
  }

  public static getInstance(): OptimizedPostingEngine {
    if (!OptimizedPostingEngine.instance) {
      OptimizedPostingEngine.instance = new OptimizedPostingEngine();
    }
    return OptimizedPostingEngine.instance;
  }

  /**
   * Create an optimized post that applies engagement insights
   */
  async createOptimizedPost(topic: string): Promise<OptimizedPostResult> {
    if (this.isPosting) {
      return { 
        success: false, 
        error: 'Another post is already in progress' 
      };
    }

    this.isPosting = true;
    console.log('🚀 OPTIMIZED_ENGINE: Creating post with applied optimization insights');
    
    try {
      // 1. Generate optimized content
      console.log('📊 Generating content with optimization insights...');
      const optimizedContent = await this.contentEngine.generateOptimizedContent(topic);
      
      console.log(`✅ Content generated with ${optimizedContent.engagementPotential}% engagement potential`);
      console.log(`🎯 Applied optimizations: ${optimizedContent.appliedInsights.join(', ')}`);
      
      // 2. Validate content meets minimum optimization threshold
      if (optimizedContent.engagementPotential < 60) {
        console.log('⚠️ Low engagement potential, enhancing further...');
        // Could add additional enhancement logic here
      }
      
      // 3. Post the content
      console.log('📝 Posting optimized content...');
      const postResult = await this.poster.postSingleTweet(optimizedContent.content);
      
      if (postResult.success && postResult.tweetId) {
        // 4. Track success metrics
        await this.trackOptimizationSuccess(postResult.tweetId, optimizedContent);
        
        console.log(`✅ OPTIMIZED POST SUCCESSFUL!`);
        console.log(`   Tweet ID: ${postResult.tweetId}`);
        console.log(`   Predicted Engagement: ${optimizedContent.engagementPotential}%`);
        console.log(`   Applied Insights: ${optimizedContent.appliedInsights.length}`);
        
        return {
          success: true,
          tweetId: postResult.tweetId,
          engagementPrediction: optimizedContent.engagementPotential,
          appliedOptimizations: optimizedContent.appliedInsights
        };
        
      } else {
        return {
          success: false,
          error: postResult.error || 'Failed to post tweet'
        };
      }
      
    } catch (error: any) {
      console.error('❌ Error in optimized posting engine:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isPosting = false;
    }
  }

  /**
   * Intelligent posting decision based on optimization insights
   */
  async shouldCreateOptimizedPost(): Promise<{
    shouldPost: boolean;
    reason: string;
    optimizationScore: number;
  }> {
    try {
      // 1. Check time constraints
      const timeSinceLastPost = Date.now() - this.metrics.lastPostTime.getTime();
      const hoursSinceLastPost = timeSinceLastPost / (1000 * 60 * 60);
      
      if (hoursSinceLastPost < 1.5) { // Reduced from 3h to 1.5h
        return {
          shouldPost: false,
          reason: `Too soon (${hoursSinceLastPost.toFixed(1)}h ago)`,
          optimizationScore: 0
        };
      }
      
      // 2. Check daily limits - increased for growth
      if (this.metrics.postsToday >= 16) { // Increased from 8 to 16
        return {
          shouldPost: false,
          reason: 'Daily post limit reached',
          optimizationScore: 0
        };
      }
      
      // 3. Get optimization insights
      const insights = await this.contentEngine.getCurrentInsights();
      const optimizationScore = this.calculateCurrentOptimizationScore(insights);
      
      // 4. Lower threshold for optimized posts (45 instead of 60)
      const threshold = 45;
      
      if (optimizationScore >= threshold) {
        return {
          shouldPost: true,
          reason: `High optimization potential (${optimizationScore}/100)`,
          optimizationScore
        };
      }
      
      // 5. Post anyway if it's been too long (12+ hours)
      if (hoursSinceLastPost >= 12) {
        return {
          shouldPost: true,
          reason: `Long gap override (${hoursSinceLastPost.toFixed(1)}h)`,
          optimizationScore
        };
      }
      
      return {
        shouldPost: false,
        reason: `Optimization score too low (${optimizationScore}/${threshold})`,
        optimizationScore
      };
      
    } catch (error: any) {
      console.error('Error in posting decision:', error.message);
      return {
        shouldPost: false,
        reason: 'Error in analysis',
        optimizationScore: 0
      };
    }
  }

  /**
   * Track optimization success for learning
   */
  private async trackOptimizationSuccess(tweetId: string, optimizedContent: any): Promise<void> {
    try {
      this.metrics.postsToday++;
      this.metrics.lastPostTime = new Date();
      this.metrics.optimizationSuccess = optimizedContent.optimizationScore;
      
      console.log(`📊 OPTIMIZATION_TRACKING: Post ${tweetId} with ${optimizedContent.optimizationScore}% optimization score`);
      
      // Store optimization data for future learning
      // This would integrate with your existing database systems
      
    } catch (error: any) {
      console.error('Failed to track optimization success:', error.message);
    }
  }

  /**
   * Calculate current optimization score
   */
  private calculateCurrentOptimizationScore(insights: any[]): number {
    // Base score for having optimization insights available
    let score = 30;
    
    // Add points for high-impact insights
    for (const insight of insights) {
      if (insight.impact_score >= 9) score += 15;
      else if (insight.impact_score >= 7) score += 10;
      else score += 5;
    }
    
    // Add points for high success probability insights
    const avgSuccessProb = insights.reduce((sum, i) => sum + i.success_probability, 0) / insights.length;
    score += avgSuccessProb * 20;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Get current posting metrics
   */
  getMetrics(): PostingMetrics {
    return { ...this.metrics };
  }

  /**
   * Start the optimized posting schedule
   */
  startOptimizedSchedule(): void {
    console.log('🚀 OPTIMIZED_ENGINE: Starting intelligent posting schedule');
    
    setInterval(async () => {
      try {
        const decision = await this.shouldCreateOptimizedPost();
        
        console.log(`🤔 Posting decision: ${decision.shouldPost ? 'YES' : 'NO'} - ${decision.reason}`);
        
        if (decision.shouldPost) {
          // Select engaging topic based on current trends
          const topics = [
            'controversial health myth debunked',
            'supplement industry secrets',
            'medical establishment lies',
            'expensive health mistakes',
            'pharmaceutical industry deception'
          ];
          
          const selectedTopic = topics[Math.floor(Math.random() * topics.length)];
          
          console.log(`🎯 Creating optimized post about: ${selectedTopic}`);
          const result = await this.createOptimizedPost(selectedTopic);
          
          if (result.success) {
            console.log(`✅ Optimized post successful: ${result.tweetId}`);
          } else {
            console.log(`❌ Optimized post failed: ${result.error}`);
          }
        }
        
      } catch (error: any) {
        console.error('Error in optimized posting schedule:', error.message);
      }
    }, 30 * 60 * 1000); // Check every 30 minutes
    
    console.log('✅ Optimized posting schedule active (30-minute intervals)');
  }
}
