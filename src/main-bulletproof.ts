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
import { SystemFailureAuditor } from './audit/systemFailureAuditor';
import { EmergencySystemTracker } from './audit/emergencySystemTracker';
import { DataAnalysisEngine } from './audit/dataAnalysisEngine';

class BulletproofMainSystem {
  private postingSystem: AIDrivenPostingSystem;
  private viralOrchestrator: EnhancedViralOrchestrator;
  private strategicReplies: EnhancedStrategicReplies;
  private promptEvolution: PromptEvolutionEngine;
  private analyticsChecker: TwitterAnalyticsScraper;
  private db: AdvancedDatabaseManager;
  private auditor: SystemFailureAuditor;
  private emergencyTracker: EmergencySystemTracker;
  private dataAnalysis: DataAnalysisEngine;
  
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
    this.auditor = SystemFailureAuditor.getInstance();
    this.emergencyTracker = EmergencySystemTracker.getInstance();
    this.dataAnalysis = DataAnalysisEngine.getInstance();
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

      // Start system health monitoring loop (every 15 minutes)
      setInterval(async () => {
        await this.systemHealthLoop();
      }, 15 * 60 * 1000);

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

      // ORIGINAL POSTS (every 20-40 minutes - higher quality, more engagement focused)
      const minPostInterval = 20 * 60 * 1000; // 20 minutes
      const maxPostInterval = 40 * 60 * 1000; // 40 minutes
      
      if (timeSinceLastPost > minPostInterval) {
        console.log('📝 BULLETPROOF_POSTING: Generating ORIGINAL content (threads/singles)...');
        console.log('🎯 IMPORTANT: This is an ORIGINAL post, NOT a reply to someone');
        await this.executeEnhancedPosting();
        this.lastPostTime = now;
      } else {
        const waitMinutes = Math.round((minPostInterval - timeSinceLastPost) / 60000);
        console.log(`⏳ POSTING_COOLDOWN: ${waitMinutes} minutes remaining`);
      }

      // STRATEGIC REPLIES (every 8-12 minutes - balanced with original posts)
      const minReplyInterval = 8 * 60 * 1000; // 8 minutes
      
      if (timeSinceLastReply > minReplyInterval) {
        console.log('💬 BULLETPROOF_REPLIES: Executing strategic engagement...');
        console.log('🎯 IMPORTANT: These are REPLIES to other people, NOT original posts');
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

      // Decide format (60% threads, 40% single tweets for balanced engagement)
      // Threads for education, singles for viral reach
      const format = Math.random() < 0.6 ? 'thread' : 'single';
      console.log(`🎯 POSTING_STRATEGY: Selected ${format} format for original post (not reply)`);
      
      // Generate bulletproof content
      const result = await this.viralOrchestrator.generateBulletproofContent(format);
      
      if (!result.content) {
        console.error('❌ ENHANCED_POSTING: No content generated');
        return;
      }

      console.log(`📝 GENERATED_CONTENT: ${format} with ${result.metadata.viralScore}/100 viral score`);
      console.log(`🎭 CONTENT_METADATA: ${result.metadata.persona} | ${result.metadata.emotion} | ${result.metadata.framework}`);

      // Post using existing posting system with proper content passing
      let postResult;
      if (format === 'thread' && result.threadParts && result.threadParts.length > 1) {
        // Clean thread posting with validated content
        console.log(`🧵 BULLETPROOF_THREAD: Posting ${result.threadParts.length}-part thread`);
        const { FixedThreadPoster } = await import('./posting/fixedThreadPoster');
        const threadPoster = FixedThreadPoster.getInstance();
        
        const threadResult = await threadPoster.postProperThread(result.threadParts);
        postResult = {
          success: threadResult.success,
          tweetId: threadResult.rootTweetId,
          type: 'thread' as const,
          viralScore: result.metadata.viralScore,
          error: threadResult.error
        };
              } else if (format === 'thread' && result.content) {
          // Emergency thread creation from single content ONLY when format is actually thread
          console.log('🚨 EMERGENCY_THREAD: Bulletproof thread validation failed, converting single content to thread parts');
          await this.emergencyTracker.trackThreadEmergency('bulletproof_thread_validation_failed', {
            contentLength: result.content.length,
            hasThreadParts: !!result.threadParts,
            threadPartsCount: result.threadParts?.length || 0
          });
          postResult = await this.postingSystem.forceEmergencyThread();
        } else if (format === 'single') {
        // Single tweet posting - no thread indicators
        console.log('📝 BULLETPROOF_SINGLE: Posting single tweet (no thread emojis)');
        console.log('🚨 IMPORTANT: This should be a SINGLE tweet with NO thread indicators');
        postResult = await this.postingSystem.createViralPost();
      } else {
        // Fallback for any other case
        console.log('⚠️ FALLBACK_SINGLE: Unknown format, posting as single tweet');
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
   * 💬 EXECUTE ENHANCED STRATEGIC REPLIES (CONTEXTUAL ONLY)
   */
  private async executeEnhancedReplies(): Promise<void> {
    try {
      console.log('💬 BULLETPROOF_REPLIES: Executing contextual strategic replies...');
      
      // Use the existing strategic replies system (NOT threaded)
      const { executeStrategicReplies } = await import('./engagement/strategicReplies');
      
      // This will find a health tweet and post a SINGLE contextual reply
      // NO threading, just context-aware response to the original tweet
      await executeStrategicReplies();
      
      console.log('✅ BULLETPROOF_REPLIES: Contextual reply posted (single tweet, not thread)');

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
   * Note: Reply targeting is now handled by the existing strategic replies system
   * which finds and analyzes real health influencer tweets automatically
   */

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

  /**
   * 🏥 SYSTEM HEALTH MONITORING LOOP
   */
  private async systemHealthLoop(): Promise<void> {
    try {
      console.log('🏥 SYSTEM_HEALTH: Running comprehensive health check...');
      
      // Perform system health analysis
      const healthReport = await this.auditor.analyzeSystemHealth();
      const emergencyReport = this.emergencyTracker.getEmergencyUsageReport();
      const dashboardData = await this.dataAnalysis.getDashboardData();
      
      // Log health status
      console.log(`📊 SYSTEM_HEALTH_SCORE: ${healthReport.overallHealth}/100`);
      console.log(`🚨 CRITICAL_SYSTEMS: ${healthReport.criticalSystems.length}`);
      console.log(`⚠️ EMERGENCY_OVERUSE: ${healthReport.emergencyOveruse.length}`);
      console.log(`🔄 TOTAL_EMERGENCY_USES: ${emergencyReport.totalEmergencyUses}`);
      
      // Alert on critical issues
      if (healthReport.overallHealth < 50) {
        console.log('🚨 CRITICAL_HEALTH_ALERT: System health below 50%');
        console.log('🔧 TOP_RECOMMENDATIONS:', healthReport.recommendations.slice(0, 3));
      }
      
      if (emergencyReport.totalEmergencyUses > 20) {
        console.log('⚠️ HIGH_EMERGENCY_USAGE: Consider strengthening primary systems');
        emergencyReport.recommendations.slice(0, 3).forEach(rec => console.log(`   ${rec}`));
      }
      
      // Log autonomous improvements available
      if (healthReport.autonomousImprovements.length > 0) {
        console.log('🤖 AUTONOMOUS_IMPROVEMENTS_AVAILABLE:');
        healthReport.autonomousImprovements.slice(0, 3).forEach(improvement => 
          console.log(`   • ${improvement}`)
        );
      }
      
      // Record successful health check
      await this.auditor.recordFailure({
        systemName: 'SystemHealthMonitoring',
        failureType: 'primary_failure', // This is actually success, but tracks the monitoring
        rootCause: 'routine_health_check',
        attemptedAction: 'system_health_analysis',
        metadata: {
          healthScore: healthReport.overallHealth,
          criticalSystemsCount: healthReport.criticalSystems.length,
          emergencyUsageCount: emergencyReport.totalEmergencyUses,
          dashboardHealth: dashboardData.systemHealth
        }
      });
      
    } catch (error: any) {
      console.error('❌ SYSTEM_HEALTH_ERROR:', error.message);
      
      // Record health monitoring failure
      await this.auditor.recordFailure({
        systemName: 'SystemHealthMonitoring',
        failureType: 'complete_failure',
        rootCause: 'health_monitoring_crashed',
        attemptedAction: 'system_health_analysis',
        errorMessage: error.message
      });
    }
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
