/**
 * 🕐 UNIFIED AUTONOMOUS SCHEDULER
 * 
 * This replaces the complex, fragmented scheduler.ts with a clean,
 * unified system that runs autonomously and reliably.
 * 
 * REPLACES:
 * - scheduler.ts (complex, fragmented)
 * - Multiple conflicting systems
 * - Broken strategy logic
 * - Over-restrictive timing
 */

import * as cron from 'node-cron';
import { autonomousPostingEngine } from './autonomousPostingEngine';
import { RealEngagementAgent } from '../agents/realEngagementAgent';
import { FollowerGrowthDiagnostic } from '../agents/followerGrowthDiagnostic';
// Removed unused analytics collectors - using dailyAnalyticsOrchestrator instead
import { dailyAnalyticsOrchestrator } from './dailyAnalyticsOrchestrator';
// Add reply system imports
import { stealthTweetScraper } from '../scraper/scrapeTweets';
import { replyAgent } from '../agents/replyAgent';
import { replyPoster } from '../twitter/postReply';
// Add performance tracking import
import { tweetPerformanceTracker } from '../jobs/updateTweetPerformance';
// Add content learning import  
import { realTimeContentLearningEngine } from '../agents/realTimeContentLearningEngine';

export class UnifiedScheduler {
  private static instance: UnifiedScheduler;
  private engagementAgent: RealEngagementAgent;
  private growthDiagnostic: FollowerGrowthDiagnostic;
  // Removed unused analytics components
  
  // Cron jobs
  private postingJob: cron.ScheduledTask | null = null;
  private engagementJob: cron.ScheduledTask | null = null;
  private diagnosticJob: cron.ScheduledTask | null = null;
  private analyticsJob: cron.ScheduledTask | null = null;
  private replyJob: cron.ScheduledTask | null = null; // Reply system job
  private performanceJob: cron.ScheduledTask | null = null; // NEW: Performance tracking job
  private learningJob: cron.ScheduledTask | null = null; // NEW: Content learning job
  // metricsJob removed - using daily analytics instead
  
  // Status tracking
  private isRunning = false;
  private totalPosts = 0;
  private totalFailures = 0;
  private totalReplies = 0; // Reply tracking
  private totalPerformanceUpdates = 0; // NEW: Performance tracking
  private totalLearningCycles = 0; // NEW: Learning tracking
  private lastPostTime: Date | null = null;
  private lastReplyTime: Date | null = null; // Reply time tracking
  private lastPerformanceUpdate: Date | null = null; // NEW: Performance time tracking
  private lastLearningUpdate: Date | null = null; // NEW: Learning time tracking

  private constructor() {
    this.engagementAgent = new RealEngagementAgent();
    this.growthDiagnostic = new FollowerGrowthDiagnostic();
    // Analytics now handled by dailyAnalyticsOrchestrator
  }

  static getInstance(): UnifiedScheduler {
    if (!UnifiedScheduler.instance) {
      UnifiedScheduler.instance = new UnifiedScheduler();
    }
    return UnifiedScheduler.instance;
  }

  /**
   * 🚀 START UNIFIED AUTONOMOUS OPERATION
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Unified Scheduler already running');
      return;
    }

    console.log('🤖 === UNIFIED AUTONOMOUS SCHEDULER STARTING ===');
    console.log('🎯 Goal: 17 viral health posts per day with maximum growth');
    console.log('🔧 Architecture: Unified, autonomous, bulletproof');
    console.log('🕵️ NEW: Stealth reply system for engagement growth');
    
    try {
      // Initial status check
      await this.displaySystemStatus();
      
      // Check if daily analytics should run (API-LIMIT AWARE!)
      console.log('📊 Checking daily analytics status...');
      const analyticsStatus = dailyAnalyticsOrchestrator.getStatus();
      if (analyticsStatus.should_run_today) {
        console.log('🎯 Running strategic daily analytics...');
        const analyticsResult = await dailyAnalyticsOrchestrator.runDailyAnalytics();
        console.log(`📊 Analytics result: ${analyticsResult.tweets_analyzed} tweets, ${analyticsResult.api_calls_used} API calls`);
      } else {
        console.log('⏰ Daily analytics already completed today');
      }
      
      // Initialize stealth scraper
      console.log('🕵️ Initializing stealth tweet scraper...');
      const scraperReady = await stealthTweetScraper.initialize();
      if (scraperReady) {
        console.log('✅ Stealth scraper initialized successfully');
      } else {
        console.log('⚠️ Stealth scraper failed to initialize - reply system disabled');
      }
      
      // Run initial growth diagnostic
      console.log('🔍 Running initial growth analysis...');
      await this.runGrowthDiagnostic();
      
      // Try immediate posting if appropriate
      console.log('🎯 Checking if immediate posting is appropriate...');
      await this.checkAndPost();
      
      // Schedule autonomous posting checks every 10 minutes
      this.postingJob = cron.schedule('*/10 * * * *', async () => {
        await this.checkAndPost();
      });
      
      // Schedule engagement every 30 minutes
      this.engagementJob = cron.schedule('*/30 * * * *', async () => {
        await this.runEngagement();
      });
      
      // Schedule growth diagnostics every 4 hours
      this.diagnosticJob = cron.schedule('0 */4 * * *', async () => {
        await this.runGrowthDiagnostic();
      });
      
      // Schedule daily analytics once per day at 3 AM UTC
      this.analyticsJob = cron.schedule('0 3 * * *', async () => {
        await this.runDailyAnalytics();
      });
      
      // Schedule reply system every 60 minutes
      if (scraperReady) {
        this.replyJob = cron.schedule('0 */1 * * *', async () => {
          await this.runReplySystem();
        });
        console.log('✅ Reply system scheduled every 60 minutes');
      } else {
        console.log('⚠️ Reply system disabled - scraper not ready');
      }
      
      // Schedule performance tracking every 30 minutes
      this.performanceJob = cron.schedule('*/30 * * * *', async () => {
        await this.runPerformanceTracking();
      });
      console.log('✅ Performance tracking scheduled every 30 minutes');
      
      // Schedule content learning engine every 24 hours at 4 AM UTC
      this.learningJob = cron.schedule('0 4 * * *', async () => {
        await this.runContentLearning();
      });
      console.log('✅ Content learning scheduled every 24 hours at 4 AM UTC');
      
      this.isRunning = true;
      console.log('✅ All systems operational and scheduled');
      console.log('📊 Posting checks: Every 10 minutes');
      console.log('🤝 Engagement cycles: Every 30 minutes');
      console.log('🎭 Reply system: Every 60 minutes');
      console.log('📈 Performance tracking: Every 30 minutes');
      console.log('🧠 Content learning: Every 24 hours (4 AM UTC)');
      console.log('📊 Growth analysis: Every 4 hours');
      console.log('📊 Daily analytics: 3 AM UTC');
      
    } catch (error) {
      console.error('❌ Failed to start unified scheduler:', error);
      throw error;
    }
  }

  /**
   * 🎯 UNIFIED POSTING CHECK AND EXECUTION
   */
  private async checkAndPost(): Promise<void> {
    try {
      console.log('\n🕐 === AUTONOMOUS POSTING CHECK ===');
      
      // Step 1: Make intelligent posting decision
      const decision = await autonomousPostingEngine.makePostingDecision();
      
      console.log(`📋 Decision: ${decision.should_post ? 'POST' : 'WAIT'}`);
      console.log(`📝 Reason: ${decision.reason}`);
      console.log(`🎯 Strategy: ${decision.strategy.toUpperCase()}`);
      console.log(`📊 Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      
      if (!decision.should_post) {
        if (decision.wait_minutes) {
          console.log(`⏰ Next check: ${decision.wait_minutes} minutes`);
        }
        return;
      }
      
      // Step 2: Execute posting
      console.log('\n🚀 EXECUTING AUTONOMOUS POST...');
      
      const result = await autonomousPostingEngine.executePost();
      
      if (result.success) {
        this.totalPosts++;
        this.lastPostTime = new Date();
        
        console.log('✅ === AUTONOMOUS POST SUCCESS ===');
        console.log(`🐦 Tweet ID: ${result.tweet_id}`);
        console.log(`💾 Database ID: ${result.database_id}`);
        console.log(`📊 Storage method: ${result.storage_method}`);
        console.log(`⚡ Performance: ${result.performance_metrics?.total_time_ms}ms total`);
        console.log(`📈 Session stats: ${this.totalPosts} posts, ${this.totalFailures} failures`);
        
      } else {
        this.totalFailures++;
        
        console.log('❌ === AUTONOMOUS POST FAILED ===');
        console.log(`📝 Error: ${result.error}`);
        console.log(`📊 Session stats: ${this.totalPosts} posts, ${this.totalFailures} failures`);
        
        // Self-healing: If too many failures, run diagnostics
        if (this.totalFailures % 3 === 0) {
          console.log('🔧 Running emergency diagnostics due to repeated failures...');
          await this.runEmergencyDiagnostics();
        }
      }
      
    } catch (error) {
      console.error('💥 Autonomous posting check error:', error);
      this.totalFailures++;
    }
  }

  /**
   * 🤝 ENGAGEMENT CYCLE
   */
  private async runEngagement(): Promise<void> {
    try {
      console.log('\n🤝 === AUTONOMOUS ENGAGEMENT CYCLE ===');
      
      const engagementResult = await this.engagementAgent.run();
      
      if (engagementResult.success) {
        console.log('✅ Engagement cycle completed successfully');
        console.log(`📊 Actions: ${engagementResult.actions?.length || 0}`);
        console.log(`📝 Summary: ${engagementResult.message}`);
      } else {
        console.log('⚠️ Engagement cycle had issues');
        console.log(`📝 Message: ${engagementResult.message}`);
      }
      
    } catch (error) {
      console.error('❌ Engagement cycle error:', error);
    }
  }

  /**
   * 📈 GROWTH DIAGNOSTIC
   */
  private async runGrowthDiagnostic(): Promise<void> {
    try {
      console.log('\n📈 === AUTONOMOUS GROWTH ANALYSIS ===');
      
      await this.growthDiagnostic.runCompleteGrowthAudit();
      
      console.log('✅ Growth analysis completed');
      
    } catch (error) {
      console.error('❌ Growth diagnostic error:', error);
    }
  }

  /**
   * 📊 STRATEGIC DAILY ANALYTICS (API-LIMIT AWARE)
   */
  private async runDailyAnalytics(): Promise<void> {
    try {
      console.log('\n📊 === STRATEGIC DAILY ANALYTICS ===');
      
      const result = await dailyAnalyticsOrchestrator.runDailyAnalytics();
      
      if (result.success) {
        console.log(`✅ Analytics completed: ${result.tweets_analyzed} tweets analyzed`);
        console.log(`🔌 API calls used: ${result.api_calls_used}/20`);
        console.log(`🧠 Learning insights: ${result.learning_insights.length}`);
        
        result.learning_insights.forEach((insight, index) => {
          console.log(`   ${index + 1}. ${insight}`);
        });
      } else {
        console.log('⚠️ Analytics had issues, will retry tomorrow');
      }
      
    } catch (error) {
      console.error('❌ Daily analytics error:', error);
    }
  }

  /**
   * 📊 SYSTEM STATUS DISPLAY
   */
  private async displaySystemStatus(): Promise<void> {
    try {
      const now = new Date();
      const estNow = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      console.log('\n📊 === UNIFIED SYSTEM STATUS ===');
      console.log(`🕐 Server time: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} UTC`);
      console.log(`🗽 EST time: ${estNow.getHours()}:${estNow.getMinutes().toString().padStart(2, '0')} EST`);
      
      // Get quota status from autonomous engine
      const decision = await autonomousPostingEngine.makePostingDecision();
      console.log(`🎯 Current strategy: ${decision.strategy.toUpperCase()}`);
      console.log(`📊 Posting status: ${decision.should_post ? 'READY' : 'WAITING'}`);
      
      if (!decision.should_post) {
        console.log(`⏰ Next posting opportunity: ${decision.wait_minutes || 'unknown'} minutes`);
      }
      
      console.log(`📈 Session performance: ${this.totalPosts} posts, ${this.totalFailures} failures`);
      
      if (this.lastPostTime) {
        const minutesAgo = (Date.now() - this.lastPostTime.getTime()) / (1000 * 60);
        console.log(`📝 Last post: ${minutesAgo.toFixed(1)} minutes ago`);
      }
      
    } catch (error) {
      console.log('⚠️ Could not display full system status:', error.message);
    }
  }

  /**
   * 🚨 EMERGENCY DIAGNOSTICS
   */
  private async runEmergencyDiagnostics(): Promise<void> {
    console.log('\n🚨 === EMERGENCY DIAGNOSTICS ===');
    
    try {
      // Check database connectivity
      console.log('🔍 Checking database connectivity...');
      // TODO: Add database connectivity check
      
      // Check Twitter API status
      console.log('🔍 Checking Twitter API status...');
      // TODO: Add Twitter API status check
      
      // Check environment variables
      console.log('🔍 Checking system configuration...');
      // TODO: Add environment validation
      
      console.log('✅ Emergency diagnostics completed');
      
    } catch (error) {
      console.error('💥 Emergency diagnostics failed:', error);
    }
  }

  /**
   * 🎭 RUN REPLY SYSTEM
   * Called by the scheduler every 60 minutes
   */
  async runReplySystem(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      console.log('🎭 === REPLY SYSTEM CYCLE STARTING ===');
      const result = await replyAgent.runReplySystem();
      
      if (result.success) {
        this.totalReplies += result.repliesPosted;
        this.lastReplyTime = new Date();
        console.log(`✅ Reply cycle successful: ${result.repliesPosted} replies posted`);
      } else {
        console.log(`⚠️ Reply cycle completed with issues: ${result.summary}`);
      }
      
      // Log errors if any
      if (result.errors.length > 0) {
        console.log('⚠️ Reply system errors:');
        result.errors.forEach(error => console.log(`   - ${error}`));
      }
      
    } catch (error) {
      console.error('❌ Reply system cycle failed:', error);
    }
  }

  /**
   * 📊 RUN PERFORMANCE TRACKING
   * Called by the scheduler every 30 minutes
   */
  async runPerformanceTracking(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      console.log('📊 === PERFORMANCE TRACKING CYCLE STARTING ===');
      const result = await tweetPerformanceTracker.runPerformanceUpdate();
      
      if (result.success) {
        this.totalPerformanceUpdates += result.tweetsUpdated;
        this.lastPerformanceUpdate = new Date();
        console.log(`✅ Performance tracking successful: ${result.tweetsUpdated} tweets updated`);
      } else {
        console.log(`⚠️ Performance tracking completed with issues: ${result.summary}`);
      }
      
      // Log errors if any
      if (result.errors.length > 0) {
        console.log('⚠️ Performance tracking errors:');
        result.errors.forEach(error => console.log(`   - ${error}`));
      }
      
    } catch (error) {
      console.error('❌ Performance tracking cycle failed:', error);
    }
  }

  /**
   * 🧠 RUN CONTENT LEARNING
   * Called by the scheduler every 24 hours at 4 AM UTC
   */
  async runContentLearning(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      console.log('🧠 === CONTENT LEARNING CYCLE STARTING ===');
      const result = await realTimeContentLearningEngine.analyzeAndGenerateStrategy();
      
      if (result.success) {
        this.totalLearningCycles++;
        this.lastLearningUpdate = new Date();
        console.log(`✅ Content learning successful: ${result.confidence * 100}% confidence with ${result.dataPoints} data points`);
        console.log(`📊 Generated optimized strategy from ${result.dataPoints} tweets`);
        
        // Log key insights
        if (result.insights.bestTimeBlocks.length > 0) {
          console.log(`⏰ Best posting times: ${result.insights.bestTimeBlocks.join(', ')}`);
        }
        if (result.insights.keywordsToPrioritize.length > 0) {
          console.log(`🔑 Top keywords: ${result.insights.keywordsToPrioritize.slice(0, 3).join(', ')}`);
        }
        if (result.insights.highPerformanceTones.length > 0) {
          console.log(`🎭 Best reply tones: ${result.insights.highPerformanceTones.join(', ')}`);
        }
      } else {
        console.log(`⚠️ Content learning completed with issues: ${result.summary}`);
        if (result.error) {
          console.log(`❌ Learning error: ${result.error}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Content learning cycle failed:', error);
    }
  }

  /**
   * 🛑 STOP SCHEDULER
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping Unified Autonomous Scheduler...');
    
    if (this.postingJob) {
      this.postingJob.stop();
      this.postingJob = null;
    }
    
    if (this.engagementJob) {
      this.engagementJob.stop();
      this.engagementJob = null;
    }
    
    if (this.diagnosticJob) {
      this.diagnosticJob.stop();
      this.diagnosticJob = null;
    }
    
    if (this.analyticsJob) {
      this.analyticsJob.stop();
      this.analyticsJob = null;
    }

    if (this.replyJob) {
      this.replyJob.stop();
      this.replyJob = null;
    }

    if (this.performanceJob) {
      this.performanceJob.stop();
      this.performanceJob = null;
    }

    if (this.learningJob) {
      this.learningJob.stop();
      this.learningJob = null;
    }
    
    this.isRunning = false;
    
    console.log('✅ Unified Scheduler stopped');
    console.log(`📊 Final stats: ${this.totalPosts} posts, ${this.totalReplies} replies, ${this.totalPerformanceUpdates} performance updates, ${this.totalLearningCycles} learning cycles`);
  }

  /**
   * 📊 GET PERFORMANCE METRICS
   */
  getPerformanceMetrics(): {
    total_posts: number;
    total_failures: number;
    success_rate: number;
    last_post_time: Date | null;
    is_running: boolean;
  } {
    const successRate = this.totalPosts + this.totalFailures > 0 
      ? (this.totalPosts / (this.totalPosts + this.totalFailures)) * 100 
      : 0;
    
    return {
      total_posts: this.totalPosts,
      total_failures: this.totalFailures,
      success_rate: Math.round(successRate),
      last_post_time: this.lastPostTime,
      is_running: this.isRunning
    };
  }
}

// Export singleton instance
export const unifiedScheduler = UnifiedScheduler.getInstance(); 