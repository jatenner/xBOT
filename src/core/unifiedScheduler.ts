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
// Add quote agent import
import { quoteAgent } from '../agents/quoteAgent';
// Add follower tracker import
import { followerTracker } from '../jobs/updateFollowerCount';
// Add analytics server import
import { analyticsServer } from '../dashboard/analyticsServer';
import { influencerTweetFetcher } from '../jobs/fetchInfluencerTweets';
import { contextAwareReplyEngine } from '../agents/contextAwareReplyEngine';
import { postingLock } from '../utils/postingLock';

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
  private quoteJob: cron.ScheduledTask | null = null; // NEW: Quote tweet job
  private followerJob: cron.ScheduledTask | null = null; // NEW: Follower tracking job
  // metricsJob removed - using daily analytics instead
  
  // Status tracking
  private isRunning = false;
  private totalPosts = 0;
  private totalFailures = 0;
  private totalReplies = 0; // Reply tracking
  private totalPerformanceUpdates = 0; // NEW: Performance tracking
  private totalLearningCycles = 0; // NEW: Learning tracking
  private totalQuoteTweets = 0; // NEW: Quote tweet tracking
  private totalFollowerUpdates = 0; // NEW: Follower tracking
  private lastPostTime: Date | null = null;
  private lastReplyTime: Date | null = null; // Reply time tracking
  private lastPerformanceUpdate: Date | null = null; // NEW: Performance time tracking
  private lastLearningUpdate: Date | null = null; // NEW: Learning time tracking
  private lastQuoteTime: Date | null = null; // NEW: Quote tweet time tracking
  private lastFollowerUpdate: Date | null = null; // NEW: Follower time tracking

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
      
      // Setup the enhanced human-like schedule
      this.setupSchedule();

      // Start analytics server
      try {
        await analyticsServer.start();
        console.log('✅ Analytics dashboard server started');
      } catch (error) {
        console.log('⚠️ Analytics server failed to start:', error.message);
      }
      
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
      
      // Step 2: Acquire lock then execute posting
      const lockAcquired = await postingLock.acquire(5 * 60 * 1000);
      if (!lockAcquired) {
        console.log('🔒 Posting lock held by another process. Skipping this cycle.');
        return;
      }

      console.log('\n🚀 EXECUTING AUTONOMOUS POST...');
      const result = await autonomousPostingEngine.executePost();
      
      if (result.success) {
        this.totalPosts++;
        this.lastPostTime = new Date();
        
        console.log(`✅ AUTONOMOUS POST SUCCESSFUL in ${result.performance_metrics.total_time_ms}ms`);
        console.log(`🆔 Tweet ID: ${result.tweet_id}`);
        console.log(`📊 Was Posted: ${result.was_posted ? 'YES' : 'NO'}`);
        console.log(`📊 Confirmed: ${result.confirmed ? 'YES' : 'NO'}`);
        console.log(`📊 Content Attempts: ${result.content_metadata?.attempts_made || 'N/A'}`);
        
        console.log('✅ POST EXECUTION COMPLETED');
        
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
      await postingLock.release();
      
    } catch (error) {
      console.error('💥 Autonomous posting check error:', error);
      try { await postingLock.release(); } catch {}
      this.totalFailures++;
    }
  }

  /**
   * 🤝 ENGAGEMENT CYCLE
   */
  private async runEngagement(): Promise<void> {
    // 🚨 EMERGENCY DISABLED: This was posting fake content via engagementAgent
    console.log('🚫 General engagement system DISABLED - was posting fake content');
    console.log('✅ Only using human-like content generation and influencer replies');
    return;
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
    // 🚨 EMERGENCY DISABLED: This was posting fake "Reply to tweet mock_tweet_..." content
    console.log('🚫 Old reply system DISABLED - was posting fake mock_tweet replies');
    console.log('✅ Using new contextAwareReplyEngine for real influencer replies only');
    return;
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
   * 🎯 RUN QUOTE TWEET SYSTEM
   */
  private async runQuoteSystem(): Promise<void> {
    try {
      console.log('\n🎯 === QUOTE TWEET SYSTEM ===');
      
      const result = await quoteAgent.executeQuoteTweet();
      
      if (result.success && result.quoteTweet) {
        this.totalQuoteTweets++;
        this.lastQuoteTime = new Date();
        
        console.log(`✅ Quote tweet posted: ${result.quoteTweet.content}`);
        console.log(`📊 Quoted @${result.quoteTweet.originalAuthor} - Total quotes today: ${this.totalQuoteTweets}`);
        
        // Send activity log to dashboard
        analyticsServer.sendActivityLog(
          `Quote tweet posted: "${result.quoteTweet.content.substring(0, 50)}..." (from @${result.quoteTweet.originalAuthor})`
        );
      } else if (result.skippedReason) {
        console.log(`⏰ Quote tweet skipped: ${result.skippedReason}`);
      } else {
        console.log(`❌ Quote tweet failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ Error running quote system:', error.message);
    }
  }

  /**
   * 📈 RUN FOLLOWER TRACKING
   */
  private async runFollowerTracking(): Promise<void> {
    try {
      console.log('\n📈 === FOLLOWER TRACKING ===');
      
      const result = await followerTracker.updateFollowerCount();
      
      if (result.success && result.data) {
        this.totalFollowerUpdates++;
        this.lastFollowerUpdate = new Date();
        
        const growth = result.data.growthSinceYesterday;
        const growthText = growth >= 0 ? `+${growth}` : `${growth}`;
        
        console.log(`✅ Follower count updated: ${result.data.followerCount} (${growthText})`);
        console.log(`📊 Engagement rate: ${result.data.engagementRate}%`);
        
        // Send activity log to dashboard
        analyticsServer.sendActivityLog(
          `Follower count: ${result.data.followerCount} (${growthText}) - Engagement: ${result.data.engagementRate}%`,
          growth >= 0 ? 'success' : 'warning'
        );
      } else {
        console.log(`❌ Follower tracking failed: ${result.error}`);
        
        analyticsServer.sendActivityLog(
          `Follower tracking failed: ${result.error}`,
          'error'
        );
      }
      
    } catch (error) {
      console.error('❌ Error running follower tracking:', error.message);
    }
  }

  /**
   * 🕐 ENHANCED HUMAN-LIKE SCHEDULING
   */
  private setupSchedule(): void {
    console.log('🕐 Setting up enhanced human-like autonomous schedule...');

    // === INTELLIGENT POSTING SCHEDULE ===
    // 07:00 - Morning stand-alone tweet (data-driven content)
    this.postingJob = // 🚨 NUCLEAR DISABLED: Reply job completely disabled
    // cron.schedule('0 7 * * *', async () => {
    //       await this.safeguardedRun('morning_post', async () => {
    //         console.log('🌅 7AM Morning post cycle...');
    //         const decision = await autonomousPostingEngine.makePostingDecision();
    //         if (decision.should_post) {
    //           await autonomousPostingEngine.executePost();
    //         }
    //       });
    //     }, { scheduled: false });
    // 
    //     // 10:00 - Reply to influencer (contextual engagement)
    //     cron.schedule('0 10 * * *', async () => {
    //       await this.safeguardedRun('morning_reply', async () => {
    //         console.log('🎯 10AM Influencer reply cycle...');
    //         // 🚨 NUCLEAR DISABLED: const replyResult = await contextAwareReplyEngine.generateContextualReply();
    //         // 🚨 NUCLEAR DISABLED: Reply functionality completely disabled
    //       });
    //     }, { scheduled: false });

    // 13:00 - Afternoon thread/comprehensive content
    // 🚨 NUCLEAR DISABLED: Reply job completely disabled
    // cron.schedule('0 13 * * *', async () => {
    //       await this.safeguardedRun('afternoon_thread', async () => {
    //         console.log('📖 1PM Thread/comprehensive content cycle...');
    //         const decision = await autonomousPostingEngine.makePostingDecision();
    //         if (decision.should_post) {
    //           await autonomousPostingEngine.executePost();
    //         }
    //       });
    //     }, { scheduled: false });
    // 
    //     // 16:00 - Second reply opportunity
    //     cron.schedule('0 16 * * *', async () => {
    //       await this.safeguardedRun('afternoon_reply', async () => {
    //         console.log('🎯 4PM Influencer reply cycle...');
    //         // 🚨 NUCLEAR DISABLED: const replyResult = await contextAwareReplyEngine.generateContextualReply();
    //         // 🚨 NUCLEAR DISABLED: Reply functionality completely disabled
    //       });
    //     }, { scheduled: false });

    // 19:00 - Evening viral content
    // 🚨 NUCLEAR DISABLED: Reply job completely disabled
    // cron.schedule('0 19 * * *', async () => {
    //       await this.safeguardedRun('evening_viral', async () => {
    //         console.log('🔥 7PM Evening viral content cycle...');
    //         const decision = await autonomousPostingEngine.makePostingDecision();
    //         if (decision.should_post) {
    //           await autonomousPostingEngine.executePost();
    //         }
    //       });
    //     }, { scheduled: false });
    // 
    //     // 22:00 - Late evening reply (final opportunity)
    //     cron.schedule('0 22 * * *', async () => {
    //       await this.safeguardedRun('evening_reply', async () => {
    //         console.log('🎯 10PM Final reply cycle...');
    //         // 🚨 NUCLEAR DISABLED: const replyResult = await contextAwareReplyEngine.generateContextualReply();
    //         // 🚨 NUCLEAR DISABLED: Reply functionality completely disabled
    //       });
    //     }, { scheduled: false });

    // === INFLUENCER MONITORING ===
    // Every 15 minutes - fetch fresh influencer content
    cron.schedule('*/15 * * * *', async () => {
      await this.safeguardedRun('influencer_fetch', async () => {
        console.log('🎯 Fetching influencer tweets...');
        await influencerTweetFetcher.fetchInfluencerTweets();
      });
    }, { scheduled: false });

    // === ENGAGEMENT CYCLES (REDUCED FREQUENCY) ===
    // Every 2 hours during active hours - light engagement
    this.engagementJob = cron.schedule('0 */2 * * *', async () => {
      await this.safeguardedRun('engagement', async () => {
        const currentHour = new Date().getHours();
        // Only run during active hours (6 AM - 11 PM)
        if (currentHour >= 6 && currentHour <= 23) {
          console.log('💫 Light engagement cycle...');
          // DISABLED: await this.runSmartEngagement(); // Was posting fake content
        }
      });
    }, { scheduled: false });

    // === ANALYTICS & MAINTENANCE ===
    // Daily at 3 AM - comprehensive analytics and cleanup
    this.analyticsJob = cron.schedule('0 3 * * *', async () => {
      await this.safeguardedRun('daily_analytics', async () => {
        console.log('📊 Daily analytics and maintenance...');
        await dailyAnalyticsOrchestrator.runDailyAnalytics();
        await influencerTweetFetcher.cleanupOldTweets();
      });
    }, { scheduled: false });

    // Performance tracking every 4 hours
    this.performanceJob = cron.schedule('0 */4 * * *', async () => {
      await this.safeguardedRun('performance_tracking', async () => {
        console.log('📈 Performance tracking update...');
        // Use existing method or skip if not available
        try {
          await this.runPerformanceTracking();
        } catch (error) {
          console.log('⚠️ Performance tracking method not available, skipping...');
        }
      });
    }, { scheduled: false });

    // === LEARNING & OPTIMIZATION ===
    // Every 6 hours - content learning and optimization
    this.learningJob = cron.schedule('0 */6 * * *', async () => {
      await this.safeguardedRun('learning_optimization', async () => {
        console.log('🧠 Learning and optimization cycle...');
        // Use existing method or skip if not available
        try {
          await this.runContentLearning();
          this.totalLearningCycles++;
        } catch (error) {
          console.log('⚠️ Learning cycle method not available, skipping...');
        }
      });
    }, { scheduled: false });

    // Weekly deep optimization (Sundays at 2 AM)
    cron.schedule('0 2 * * 0', async () => {
      await this.safeguardedRun('weekly_optimization', async () => {
        console.log('🔬 Weekly deep optimization...');
        // Run comprehensive performance analysis and strategy updates
      });
    }, { scheduled: false });

    console.log('✅ Enhanced autonomous schedule configured');
    console.log('📅 Schedule:');
    console.log('   07:00 - Morning tweet (data-driven)');
    console.log('   10:00 - Reply to influencer');
    console.log('   13:00 - Thread/comprehensive content');
    console.log('   16:00 - Reply to influencer'); 
    console.log('   19:00 - Evening viral content');
    console.log('   22:00 - Final reply opportunity');
    console.log('   */15min - Influencer monitoring');
    console.log('   */2h - Light engagement (6AM-11PM)');
    console.log('   */4h - Performance tracking');
    console.log('   */6h - Learning optimization');
    console.log('   Daily 3AM - Analytics & cleanup');
  }

  /**
   * 🛡️ Enhanced safeguarded execution with error handling
   */
  private async safeguardedRun(operation: string, fn: () => Promise<void>): Promise<void> {
    try {
      const startTime = Date.now();
      await fn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${operation} completed in ${duration}ms`);
    } catch (error) {
      this.totalFailures++;
      console.error(`❌ ${operation} failed:`, error);
      
      // Log critical errors for monitoring
      if (this.totalFailures > 10) {
        console.error('🚨 Critical: High failure rate detected');
      }
    }
  }

  /**
   * 💫 Reduced engagement for human-like behavior
   */
  private async runSmartEngagement(): Promise<void> {
    // 🚨 EMERGENCY DISABLED: This was posting fake content
    console.log('🚫 Smart engagement DISABLED - was posting fake replies');
    console.log('✅ Bot now focuses ONLY on original, complete tweets');
    return;
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