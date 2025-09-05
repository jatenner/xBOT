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

      // 🚀 INTELLIGENT FREQUENCY OPTIMIZATION: AI-driven timing for maximum engagement
      const { intelligentFrequencyOptimizer } = await import('./intelligence/intelligentFrequencyOptimizer');
      const timingStrategy = await intelligentFrequencyOptimizer.getOptimalTimingStrategy();
      
      const minPostInterval = 20 * 60 * 1000; // 20 minutes minimum
      const timeUntilOptimal = timingStrategy.next_post_time.getTime() - now;
      
      // Post if we're in optimal window OR it's been too long since last post
      const inOptimalWindow = timeUntilOptimal <= 10 * 60 * 1000; // Within 10 minutes of optimal
      const shouldPostNow = (timeSinceLastPost > minPostInterval) && 
                            (inOptimalWindow || timeSinceLastPost > 120 * 60 * 1000); // Force post after 2 hours
      
      if (shouldPostNow) {
        console.log('📝 BULLETPROOF_POSTING: Generating ORIGINAL content (threads/singles)...');
        console.log('🎯 IMPORTANT: This is an ORIGINAL post, NOT a reply to someone');
        console.log(`⏰ OPTIMAL_TIMING: ${timingStrategy.confidence_score}% confidence - ${timingStrategy.reasoning.substring(0, 80)}...`);
        console.log(`📊 PREDICTION: ${timingStrategy.performance_prediction.expected_likes} likes, ${(timingStrategy.performance_prediction.expected_engagement_rate * 100).toFixed(1)}% engagement`);
        console.log(`🎯 FREQUENCY_ACTION: ${timingStrategy.frequency_adjustment.toUpperCase()} posting frequency`);
        
        await this.executeEnhancedPosting();
        this.lastPostTime = now;
      } else {
        const waitMinutes = Math.round(Math.max(minPostInterval - timeSinceLastPost, timeUntilOptimal) / 60000);
        console.log(`⏰ INTELLIGENT_TIMING: Waiting ${waitMinutes} minutes for optimal posting window`);
        console.log(`🎯 NEXT_OPTIMAL: ${timingStrategy.next_post_time.toLocaleTimeString()} (confidence: ${timingStrategy.confidence_score}%)`);
      }

      // STRATEGIC REPLIES (every 8-12 minutes - balanced with original posts)
      const minReplyInterval = 8 * 60 * 1000; // 8 minutes
      
      if (timeSinceLastReply > minReplyInterval) {
        console.log('💬 STRATEGIC_ENGAGEMENT: Executing AI-driven follower growth engagement...');
        console.log('🎯 IMPORTANT: These are strategic replies to health influencers for follower growth');
        
        // 🚀 NEW: Strategic engagement for follower growth
        const { strategicEngagementEngine } = await import('./engagement/strategicEngagementEngine');
        const engagementResults = await strategicEngagementEngine.executeStrategicEngagement();
        
        console.log(`📊 ENGAGEMENT_RESULTS: ${engagementResults.filter(r => r.success).length}/${engagementResults.length} successful strategic engagements`);
        
        if (engagementResults.length > 0) {
          const avgImpact = engagementResults.reduce((sum, r) => sum + r.action.expected_follower_impact, 0) / engagementResults.length;
          console.log(`📈 FOLLOWER_IMPACT: ${(avgImpact * 100).toFixed(1)}% average follower conversion probability`);
        }
        
        // Fallback to traditional replies if no strategic engagements
        if (engagementResults.length === 0) {
          await this.executeEnhancedReplies();
        }
        
        this.lastReplyTime = now;
      } else {
        const waitMinutes = Math.round((minReplyInterval - timeSinceLastReply) / 60000);
        console.log(`⏳ ENGAGEMENT_COOLDOWN: ${waitMinutes} minutes remaining before next strategic engagement`);
      }

      // 🔍 COMPETITOR INTELLIGENCE: Get strategic insights every few cycles
      if (Math.random() < 0.3) { // 30% chance per cycle to avoid overloading
        try {
          const { competitorIntelligenceMonitor } = await import('./intelligence/competitorIntelligenceMonitor');
          const recommendations = await competitorIntelligenceMonitor.getActionableRecommendations();
          
          if (recommendations.urgent_opportunities.length > 0) {
            console.log('🚨 URGENT_OPPORTUNITIES:');
            recommendations.urgent_opportunities.forEach(opp => console.log(opp));
          }
          
          if (recommendations.content_suggestions.length > 0) {
            console.log('💡 CONTENT_GAPS:');
            recommendations.content_suggestions.forEach(gap => console.log(gap));
          }
          
        } catch (compError: any) {
          console.warn('⚠️ COMPETITOR_INTELLIGENCE_FAILED:', compError.message);
        }
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

      // 🚀 FAST POSTING: Use ultra-fast poster to avoid Railway timeouts
      let postResult;
      if (format === 'thread' && result.threadParts && result.threadParts.length > 1) {
        // Ultra-fast thread posting with timeout protection
        console.log(`⚡ FAST_THREAD: Posting ${result.threadParts.length}-part thread with ultra-fast system`);
        const { fastTwitterPoster } = await import('./posting/fastTwitterPoster');
        
        const threadResult = await fastTwitterPoster.postThread(result.threadParts);
        postResult = {
          success: threadResult.success,
          tweetId: threadResult.tweetId,
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
        // Single tweet - ultra-fast posting
        console.log('⚡ FAST_SINGLE: Posting single tweet with ultra-fast system');
        const { fastTwitterPoster } = await import('./posting/fastTwitterPoster');
        
        const singleResult = await fastTwitterPoster.postSingleTweet(
          typeof result.content === 'string' ? result.content : 
          Array.isArray(result.threadParts) ? result.threadParts[0] : 
          'Health content generated'
        );
        
        postResult = {
          success: singleResult.success,
          tweetId: singleResult.tweetId,
          type: 'single' as const,
          viralScore: result.metadata.viralScore,
          error: singleResult.error
        };
      } else {
        // Fallback - ultra-fast single tweet
        console.log('⚡ FAST_FALLBACK: Unknown format, using ultra-fast single tweet');
        const { fastTwitterPoster } = await import('./posting/fastTwitterPoster');
        
        const fallbackResult = await fastTwitterPoster.postSingleTweet(
          typeof result.content === 'string' ? result.content : 
          Array.isArray(result.threadParts) ? result.threadParts[0] : 
          'Health content generated'
        );
        
        postResult = {
          success: fallbackResult.success,
          tweetId: fallbackResult.tweetId,
          type: 'single' as const,
          viralScore: result.metadata.viralScore,
          error: fallbackResult.error
        };
      }

      if (postResult.success) {
        console.log(`✅ ENHANCED_POST_SUCCESS: ${postResult.type} posted with ID ${postResult.tweetId}`);
        
        // Store for performance tracking
        await this.storePostForTracking(postResult.tweetId!, result.metadata, optimalConfig);
        
        // 🚨 START REAL METRICS COLLECTION FOR NEW POSTS
        const { realMetricsCollector } = await import('./metrics/realTwitterMetricsCollector');
        
        realMetricsCollector.trackTweet({
          tweetId: postResult.tweetId,
          postedAt: new Date(),
          content: typeof result.content === 'string' ? result.content : 
                   Array.isArray(result.threadParts) ? result.threadParts.join(' ') : result.content,
          contentLength: typeof result.content === 'string' ? result.content.length : 
                        Array.isArray(result.threadParts) ? result.threadParts.join(' ').length : 0,
          persona: result.metadata.persona,
          emotion: result.metadata.emotion,
          framework: result.metadata.framework
        });
        
        console.log(`📊 REAL_METRICS_STARTED: ${postResult.tweetId} queued for real engagement tracking`);
        
        // 🚨 SYNCHRONIZED CONTENT STORAGE: Store across all diversity tracking systems
        try {
          const { emergencyDiversityFix } = await import('./content/emergencyContentDiversityFix');
          const contentToStore = typeof result.content === 'string' ? result.content : 
                                Array.isArray(result.threadParts) ? result.threadParts.join('\n\n') : result.content;
          
          await emergencyDiversityFix.storeSynchronizedContent(contentToStore, postResult.tweetId!);
          console.log('✅ SYNCHRONIZED_STORAGE: Content stored across all diversity systems');
        } catch (syncError: any) {
          console.warn('⚠️ SYNC_STORAGE_FAILED:', syncError.message);
        }
        
        // 📈 FOLLOWER ATTRIBUTION: Track this content for follower growth correlation
        try {
          const { followerAttributionTracker } = await import('./analytics/followerAttributionTracker');
          const contentType = format === 'thread' ? 'thread' : 'tweet';
          const contentForTracking = typeof result.content === 'string' ? result.content : 
                                   Array.isArray(result.threadParts) ? result.threadParts.join(' ') : result.content;
          
          await followerAttributionTracker.trackPostToFollowerAttribution(
            postResult.tweetId!,
            contentType,
            contentForTracking,
            {
              likes: 0, // Will be updated by real metrics collection
              retweets: 0,
              replies: 0,
              impressions: 0
            }
          );
          
          console.log('📈 ATTRIBUTION_TRACKING: Post queued for follower growth analysis');
        } catch (attributionError: any) {
          console.warn('⚠️ ATTRIBUTION_TRACKING_FAILED:', attributionError.message);
        }
        
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
        // 🚨 REPLACED FAKE DATA WITH REAL METRICS COLLECTION
        // Start real metrics tracking for this tweet (no more fake data!)
        const { realMetricsCollector } = await import('./metrics/realTwitterMetricsCollector');
        
        realMetricsCollector.trackTweet({
          tweetId: post.tweetId,
          postedAt: new Date(post.createdAt),
          content: post.content,
          contentLength: post.content.length,
          persona: post.persona,
          emotion: post.emotion,
          framework: post.framework
        });
        
        console.log(`📊 REAL_TRACKING: Started real metrics collection for ${post.tweetId}`);
        
        // ❌ NO MORE FAKE ANALYTICS - Real data will be collected via browser automation
        const analytics = null; // Disable fake data generation completely
        
        // ✅ REAL DATA PROCESSING ONLY
        // Real metrics will be processed automatically by realMetricsCollector
        // and fed to AI learning systems when collected from Twitter
        console.log(`✅ REAL_METRICS_QUEUED: ${post.tweetId} scheduled for authentic data collection`);
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
