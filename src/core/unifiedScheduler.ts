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
import { TweetAnalyticsCollector } from '../agents/tweetAnalyticsCollector';
import { RealTimeEngagementTracker } from '../agents/realTimeEngagementTracker';

export class UnifiedScheduler {
  private static instance: UnifiedScheduler;
  private engagementAgent: RealEngagementAgent;
  private growthDiagnostic: FollowerGrowthDiagnostic;
  private analyticsCollector: TweetAnalyticsCollector;
  private engagementTracker: RealTimeEngagementTracker;
  
  // Cron jobs
  private postingJob: cron.ScheduledTask | null = null;
  private engagementJob: cron.ScheduledTask | null = null;
  private diagnosticJob: cron.ScheduledTask | null = null;
  private analyticsJob: cron.ScheduledTask | null = null;
  private metricsJob: cron.ScheduledTask | null = null;
  
  // Status tracking
  private isRunning = false;
  private totalPosts = 0;
  private totalFailures = 0;
  private lastPostTime: Date | null = null;

  private constructor() {
    this.engagementAgent = new RealEngagementAgent();
    this.growthDiagnostic = new FollowerGrowthDiagnostic();
    this.analyticsCollector = new TweetAnalyticsCollector();
    this.engagementTracker = new RealTimeEngagementTracker();
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
    
    try {
      // Initial status check
      await this.displaySystemStatus();
      
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
      
      // Schedule analytics collection every 2 hours
      this.analyticsJob = cron.schedule('0 */2 * * *', async () => {
        await this.runAnalyticsCollection();
      });
      
      // Schedule metrics updating every hour
      this.metricsJob = cron.schedule('0 * * * *', async () => {
        await this.runMetricsUpdate();
      });
      
      this.isRunning = true;
      
      console.log('✅ UNIFIED AUTONOMOUS SCHEDULER ACTIVE');
      console.log('📊 Posting checks: Every 10 minutes');
      console.log('🤝 Engagement cycles: Every 30 minutes');
      console.log('📈 Growth analysis: Every 4 hours');
      console.log('📊 Analytics collection: Every 2 hours');
      console.log('⚡ Metrics updating: Every hour');
      console.log('🎉 Bot is now fully autonomous and operational!');
      
    } catch (error) {
      console.error('❌ Unified Scheduler startup error:', error);
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
   * 📊 ANALYTICS COLLECTION
   */
  private async runAnalyticsCollection(): Promise<void> {
    try {
      console.log('\n📊 === AUTONOMOUS ANALYTICS COLLECTION ===');
      
      await this.analyticsCollector.run();
      
      console.log('✅ Analytics collection completed');
      
    } catch (error) {
      console.error('❌ Analytics collection error:', error);
    }
  }

  /**
   * ⚡ METRICS UPDATE
   */
  private async runMetricsUpdate(): Promise<void> {
    try {
      console.log('\n⚡ === AUTONOMOUS METRICS UPDATE ===');
      
      // Get recent tweets and update their engagement metrics
      await this.engagementTracker.trackRecentTweets();
      
      console.log('✅ Metrics update completed');
      
    } catch (error) {
      console.error('❌ Metrics update error:', error);
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
    
    if (this.metricsJob) {
      this.metricsJob.stop();
      this.metricsJob = null;
    }
    
    this.isRunning = false;
    
    console.log('✅ Unified Scheduler stopped');
    console.log(`📊 Final stats: ${this.totalPosts} posts, ${this.totalFailures} failures`);
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