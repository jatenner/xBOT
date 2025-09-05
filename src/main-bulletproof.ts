/**
 * 🚀 BULLETPROOF MAIN SYSTEM
 * Enhanced version with bulletproof prompts and learning optimization
 */

import { config } from 'dotenv';
config();

import { AIDrivenPostingSystem } from './core/aiDrivenPostingSystem';
import { EnhancedViralOrchestrator } from './ai/enhancedViralOrchestrator';
import { EnhancedStrategicReplies } from './engagement/enhancedStrategicReplies';
import { PromptEvolutionEngine } from './ai/promptEvolutionEngine';
import { TwitterAnalyticsScraper } from './analytics/twitterAnalyticsScraper';
import { AdvancedDatabaseManager } from './lib/advancedDatabaseManager';

class BulletproofMainSystem {
  private postingSystem: AIDrivenPostingSystem;
  private viralOrchestrator: EnhancedViralOrchestrator;
  private strategicReplies: EnhancedStrategicReplies;
  private promptEvolution: PromptEvolutionEngine;
  private analyticsChecker: TwitterAnalyticsScraper;
  private db: AdvancedDatabaseManager;
  
  private isRunning = false;
  private mainInterval: NodeJS.Timeout | null = null;
  private analyticsInterval: NodeJS.Timeout | null = null;
  private lastPostTime = 0;
  private lastReplyTime = 0;

  constructor() {
    console.log('🚀 BULLETPROOF_SYSTEM: Initializing...');
    
    this.postingSystem = AIDrivenPostingSystem.getInstance();
    this.viralOrchestrator = EnhancedViralOrchestrator.getInstance();
    this.strategicReplies = EnhancedStrategicReplies.getInstance();
    this.promptEvolution = PromptEvolutionEngine.getInstance();
    this.analyticsChecker = new TwitterAnalyticsScraper();
    this.db = AdvancedDatabaseManager.getInstance();
  }

  /**
   * 🎯 START BULLETPROOF SYSTEM
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ SYSTEM_ALREADY_RUNNING');
      return;
    }

    console.log('🚀 BULLETPROOF_SYSTEM: Starting aggressive learning and posting...');
    this.isRunning = true;

    try {
      // Start main posting and engagement loop (every 10 minutes)
      this.mainInterval = setInterval(async () => {
        await this.mainLoop();
      }, 10 * 60 * 1000);

      // Start analytics collection loop (every 30 minutes)
      this.analyticsInterval = setInterval(async () => {
        await this.analyticsLoop();
      }, 30 * 60 * 1000);

      // Run initial loops immediately
      await this.mainLoop();
      setTimeout(() => this.analyticsLoop(), 5000); // Delay analytics by 5 seconds

      console.log('✅ BULLETPROOF_SYSTEM: Started successfully');
      console.log('📊 MAIN_LOOP: Every 10 minutes');
      console.log('📈 ANALYTICS_LOOP: Every 30 minutes');

    } catch (error: any) {
      console.error('❌ BULLETPROOF_SYSTEM_START_FAILED:', error.message);
      this.isRunning = false;
    }
  }

  /**
   * 🔄 MAIN OPERATIONAL LOOP
   */
  private async mainLoop(): Promise<void> {
    console.log('🔄 BULLETPROOF_MAIN_LOOP: Starting cycle...');

    try {
      const now = Date.now();
      const timeSinceLastPost = now - this.lastPostTime;
      const timeSinceLastReply = now - this.lastReplyTime;

      // POSTING (every 15-45 minutes during aggressive learning)
      const minPostInterval = 15 * 60 * 1000; // 15 minutes
      const maxPostInterval = 45 * 60 * 1000; // 45 minutes
      
      if (timeSinceLastPost > minPostInterval) {
        console.log('📝 BULLETPROOF_POSTING: Generating content...');
        await this.executeEnhancedPosting();
        this.lastPostTime = now;
      } else {
        const waitMinutes = Math.round((minPostInterval - timeSinceLastPost) / 60000);
        console.log(`⏳ POSTING_COOLDOWN: ${waitMinutes} minutes remaining`);
      }

      // STRATEGIC REPLIES (every 5-10 minutes)
      const minReplyInterval = 5 * 60 * 1000; // 5 minutes
      
      if (timeSinceLastReply > minReplyInterval) {
        console.log('💬 BULLETPROOF_REPLIES: Executing strategic engagement...');
        await this.executeEnhancedReplies();
        this.lastReplyTime = now;
      } else {
        const waitMinutes = Math.round((minReplyInterval - timeSinceLastReply) / 60000);
        console.log(`⏳ REPLY_COOLDOWN: ${waitMinutes} minutes remaining`);
      }

      // SYSTEM STATUS
      console.log('📊 BULLETPROOF_STATUS: Cycle completed successfully');

    } catch (error: any) {
      console.error('❌ BULLETPROOF_MAIN_LOOP_ERROR:', error.message);
    }
  }

  /**
   * 📝 EXECUTE ENHANCED POSTING with bulletproof prompts
   */
  private async executeEnhancedPosting(): Promise<void> {
    try {
      // Get optimal prompt configuration from bandit
      const optimalConfig = await this.promptEvolution.selectOptimalConfig('thread');
      console.log(`🎯 OPTIMAL_CONFIG: ${optimalConfig.persona} + ${optimalConfig.emotion} + ${optimalConfig.framework}`);

      // Decide format (80% threads, 20% single tweets during aggressive learning)
      const format = Math.random() < 0.8 ? 'thread' : 'single';
      
      // Generate bulletproof content
      const result = await this.viralOrchestrator.generateBulletproofContent(format);
      
      if (!result.content) {
        console.error('❌ ENHANCED_POSTING: No content generated');
        return;
      }

      console.log(`📝 GENERATED_CONTENT: ${format} with ${result.metadata.viralScore}/100 viral score`);
      console.log(`🎭 CONTENT_METADATA: ${result.metadata.persona} | ${result.metadata.emotion} | ${result.metadata.framework}`);

      // Post using existing posting system
      let postResult;
      if (format === 'thread' && result.threadParts) {
        // Force thread posting
        postResult = await this.postingSystem.forceEmergencyThread();
      } else {
        // Single tweet posting
        postResult = await this.postingSystem.createViralPost();
      }

      if (postResult.success) {
        console.log(`✅ ENHANCED_POST_SUCCESS: ${postResult.type} posted with ID ${postResult.tweetId}`);
        
        // Store for performance tracking
        await this.storePostForTracking(postResult.tweetId!, result.metadata, optimalConfig);
      } else {
        console.error(`❌ ENHANCED_POST_FAILED: ${postResult.error}`);
      }

    } catch (error: any) {
      console.error('❌ ENHANCED_POSTING_CRASHED:', error.message);
    }
  }

  /**
   * 💬 EXECUTE ENHANCED STRATEGIC REPLIES
   */
  private async executeEnhancedReplies(): Promise<void> {
    try {
      // Find health-related tweets to reply to
      const replyTargets = await this.findHealthReplyTargets();
      
      if (replyTargets.length === 0) {
        console.log('📭 NO_REPLY_TARGETS: No suitable health tweets found');
        return;
      }

      console.log(`🎯 REPLY_TARGETS: Found ${replyTargets.length} potential targets`);

      // Generate replies for top 3 targets
      const topTargets = replyTargets.slice(0, 3);
      const replies = await this.strategicReplies.generateBatchReplies(topTargets);

      console.log(`💬 REPLIES_GENERATED: ${replies.length} strategic replies created`);

      // Post replies (implement actual posting logic here)
      for (const reply of replies) {
        console.log(`📤 STRATEGIC_REPLY: ${reply.strategy} - "${reply.reply.substring(0, 50)}..."`);
        // TODO: Integrate with actual Twitter reply posting
      }

    } catch (error: any) {
      console.error('❌ ENHANCED_REPLIES_CRASHED:', error.message);
    }
  }

  /**
   * 📈 ANALYTICS AND LEARNING LOOP
   */
  private async analyticsLoop(): Promise<void> {
    console.log('📈 BULLETPROOF_ANALYTICS: Collecting performance data...');

    try {
      // Get recent posts for performance tracking
      const recentPosts = await this.getRecentPosts(20);
      
      for (const post of recentPosts) {
        // Fetch latest analytics for each post (mock for now)
        const analytics = {
          likes: Math.floor(Math.random() * 50),
          retweets: Math.floor(Math.random() * 20),
          replies: Math.floor(Math.random() * 15),
          impressions: Math.floor(Math.random() * 1000) + 100,
          follows: Math.floor(Math.random() * 5)
        };
        
        if (analytics) {
          // Calculate engagement rate
          const engagementRate = analytics.impressions > 0 ? 
            (analytics.likes + analytics.retweets + analytics.replies) / analytics.impressions : 0;

          // Record performance for prompt evolution
          await this.promptEvolution.recordPromptPerformance({
            postId: post.tweetId,
            promptVersion: post.promptVersion || 'unknown',
            persona: post.persona || 'unknown',
            emotion: post.emotion || 'unknown',
            framework: post.framework || 'unknown',
            likes: analytics.likes,
            retweets: analytics.retweets,
            replies: analytics.replies,
            impressions: analytics.impressions,
            follows: analytics.follows || 0,
            engagementRate,
            viralScore: post.viralScore || 0,
            hoursAfterPost: Math.round((Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60))
          });

          console.log(`📊 TRACKED_PERFORMANCE: ${post.tweetId} - ${(engagementRate * 100).toFixed(2)}% engagement`);
        }
      }

      // Log bandit performance
      const banditReport = this.promptEvolution.getBanditReport();
      console.log('🎰 BANDIT_REPORT:', JSON.stringify(banditReport, null, 2));

    } catch (error: any) {
      console.error('❌ ANALYTICS_LOOP_ERROR:', error.message);
    }
  }

  /**
   * 💾 STORE POST FOR PERFORMANCE TRACKING
   */
  private async storePostForTracking(tweetId: string, metadata: any, config: any): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_post_for_tracking',
        async (client) => {
          const { data, error } = await client.from('posts_for_tracking').insert({
            tweet_id: tweetId,
            prompt_version: metadata.promptVersion,
            persona: config.persona,
            emotion: config.emotion,
            framework: config.framework,
            viral_score: metadata.viralScore
          });
          
          if (error) throw error;
          return data;
        }
      );
      
      console.log(`💾 STORED_FOR_TRACKING: ${tweetId} with ${config.persona}/${config.emotion}/${config.framework}`);
    } catch (error) {
      console.warn('⚠️ Failed to store post for tracking:', error);
    }
  }

  /**
   * 🎯 FIND HEALTH REPLY TARGETS (mock implementation)
   */
  private async findHealthReplyTargets(): Promise<any[]> {
    // TODO: Implement actual Twitter search for health-related tweets
    // For now, return mock data
    return [
      {
        parentTweet: "Just started taking vitamin D supplements. Hope they help with my energy levels!",
        parentAuthor: "health_seeker",
        topic: "vitamin D",
        sentiment: "positive" as const,
        healthRelevance: 85
      },
      {
        parentTweet: "Does anyone know if cold showers actually boost metabolism?",
        parentAuthor: "fitness_curious", 
        topic: "cold exposure",
        sentiment: "neutral" as const,
        healthRelevance: 90
      }
    ];
  }

  /**
   * 📊 GET RECENT POSTS (mock implementation)
   */
  private async getRecentPosts(limit: number): Promise<any[]> {
    try {
      const result = await this.db.executeQuery(
        'get_recent_posts',
        async (client) => {
          const { data, error } = await client
            .from('posts_for_tracking')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
          
          if (error) throw error;
          return data || [];
        }
      );

      return result;
    } catch (error) {
      console.warn('⚠️ Failed to get recent posts:', error);
      return [];
    }
  }

  /**
   * 🛑 STOP BULLETPROOF SYSTEM
   */
  stop(): void {
    console.log('🛑 BULLETPROOF_SYSTEM: Stopping...');
    
    this.isRunning = false;
    
    if (this.mainInterval) {
      clearInterval(this.mainInterval);
      this.mainInterval = null;
    }
    
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }
    
    console.log('✅ BULLETPROOF_SYSTEM: Stopped successfully');
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      lastPostTime: new Date(this.lastPostTime).toISOString(),
      lastReplyTime: new Date(this.lastReplyTime).toISOString(),
      uptime: this.isRunning ? Date.now() - this.lastPostTime : 0,
      nextPostIn: Math.max(0, (this.lastPostTime + 15 * 60 * 1000) - Date.now()),
      nextReplyIn: Math.max(0, (this.lastReplyTime + 5 * 60 * 1000) - Date.now())
    };
  }
}

// Initialize and start the bulletproof system
const bulletproofSystem = new BulletproofMainSystem();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 RECEIVED_SIGINT: Shutting down gracefully...');
  bulletproofSystem.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 RECEIVED_SIGTERM: Shutting down gracefully...');
  bulletproofSystem.stop();
  process.exit(0);
});

// Start the system
bulletproofSystem.start().catch(error => {
  console.error('💥 BULLETPROOF_SYSTEM_CRASHED:', error);
  process.exit(1);
});

export { BulletproofMainSystem };
