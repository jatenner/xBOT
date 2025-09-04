import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';
import { AnalyticsScheduler } from './scheduler/analyticsScheduler';
import { AIDrivenPostingSystem } from './core/aiDrivenPostingSystem';

/**
 * SIMPLE THREAD POSTING LOOP - No bloat, just threads
 */
async function startSimpleThreadLoop() {
  console.log('🧵 SIMPLE_THREAD_LOOP: Starting basic thread posting...');
  
  // This function is now unused - replaced by intelligent posting
  console.log('⚠️ OLD_SYSTEM: This loop is deprecated, using intelligent posting instead');
}

/**
 * AGGRESSIVE ENGAGEMENT LOOP - Build followers through strategic engagement
 */
async function startEngagementLoop() {
  console.log('🚀 ENGAGEMENT_LOOP: Starting aggressive follower acquisition...');
  
  // This function is now unused - replaced by intelligent engagement
  console.log('⚠️ OLD_SYSTEM: This loop is deprecated, using intelligent engagement instead');
}

/**
 * INTELLIGENT POSTING - Data-driven content decisions
 */
// Quick posting functions for learning system
async function postScientificThread(): Promise<{ rootTweetId: string | null } | null> {
  try {
    console.log('🧵 POSTING: Creating scientific thread...');
    // Use new AI-driven system
    const { AIDrivenPostingSystem } = await import('./core/aiDrivenPostingSystem');
    const engine = AIDrivenPostingSystem.getInstance();
    const result = await engine.createViralPost();
    if (result.success && result.tweetId) {
      console.log(`✅ THREAD_POSTED: Success! Root ID: ${result.tweetId}`);
      return { rootTweetId: result.tweetId };
    } else {
      console.error(`❌ THREAD_FAILED: ${result.error || 'Unknown error'}`);
      console.error(`📊 THREAD_DEBUG: Success=${result.success}, TweetID=${result.tweetId}, Content=${result.content?.substring(0, 100)}`);
      return null;
    }
  } catch (error: any) {
    console.error(`💥 THREAD_CRASHED: ${error.message}`);
    console.error(`📊 THREAD_STACK: ${error.stack?.substring(0, 200)}`);
    return null;
  }
}



async function startIntelligentPosting() {
  console.log('🧠 INTELLIGENT_POSTING: Starting adaptive posting system...');
  
  const { AdaptivePostingManager } = await import('./intelligence/adaptivePostingManager');
  const postingManager = AdaptivePostingManager.getInstance();
  
  async function checkPostingOpportunity() {
    try {
      const opportunity = await postingManager.getNextPostingOpportunity();
      
      if (!opportunity) {
        console.log('⏰ WAITING: No posting opportunity, checking again in 15 minutes');
        return;
      }
      
      console.log(`🎯 OPPORTUNITY: ${opportunity.type} (urgency: ${opportunity.urgency}/10) - ${opportunity.reason}`);
      
      let tweetId: string | null = null;
      let content: string = '';
      
      if (opportunity.type === 'thread') {
        const threadResult = await postScientificThread();
        tweetId = threadResult?.rootTweetId || null;
        content = 'scientific_thread';
      } else {
        tweetId = await postSimpleContent(opportunity.type);
        content = opportunity.type;
      }
      
      // Record post for learning - only if successful
      if (tweetId) {
        await postingManager.recordPost(opportunity.type, tweetId, content);
        console.log(`📊 LEARNING_RECORDED: ${opportunity.type} post ${tweetId} recorded for learning`);
      } else {
        console.warn(`⚠️ POST_FAILED: ${opportunity.type} post failed, not recording for learning`);
      }
      
    } catch (error: any) {
      console.error('❌ INTELLIGENT_POSTING_ERROR:', error.message);
    }
  }
  
  // Check for posting opportunities every 5 minutes - ULTRA AGGRESSIVE LEARNING
  setInterval(checkPostingOpportunity, 5 * 60 * 1000);
  
  // Check immediately
  setTimeout(checkPostingOpportunity, 5000);
}

/**
 * INTELLIGENT ENGAGEMENT - Data-driven engagement decisions  
 */
async function startIntelligentEngagement() {
  console.log('🤝 INTELLIGENT_ENGAGEMENT: Starting adaptive engagement system...');
  
  async function checkEngagementOpportunity() {
    try {
      const hour = new Date().getHours();
      const isActiveHour = hour >= 7 && hour <= 22; // 7 AM to 10 PM
      
      if (!isActiveHour) {
        console.log('😴 QUIET_HOURS: Reduced engagement during off-hours');
        return;
      }
      
      // Randomize engagement activities to seem natural
      const activities = [];
      
      if (Math.random() > 0.2) activities.push('likes'); // 80% chance
      if (Math.random() > 0.1) activities.push('replies'); // 90% chance - PRIORITIZE REPLIES
      if (Math.random() > 0.7) activities.push('follows'); // 30% chance
      
      for (const activity of activities) {
        try {
          switch (activity) {
            case 'likes':
              const { executeStrategicLikes } = await import('./engagement/strategicLikes');
              await executeStrategicLikes();
              break;
            case 'replies':
              const { executeStrategicReplies } = await import('./engagement/strategicReplies');
              await executeStrategicReplies();
              break;
            case 'follows':
              const { executeStrategicFollows } = await import('./engagement/strategicFollows');
              await executeStrategicFollows();
              break;
          }
        } catch (activityError: any) {
          console.error(`❌ ${activity.toUpperCase()}_ERROR:`, activityError.message);
        }
      }
      
    } catch (error: any) {
      console.error('❌ INTELLIGENT_ENGAGEMENT_ERROR:', error.message);
    }
  }
  
  // Variable engagement timing (10-30 minutes)
  function scheduleNextEngagement() {
    const minutes = 2 + Math.random() * 6; // 2-8 minutes - AGGRESSIVE ENGAGEMENT
    setTimeout(() => {
      checkEngagementOpportunity();
      scheduleNextEngagement();
    }, minutes * 60 * 1000);
  }
  
  // Start engagement cycle
  setTimeout(checkEngagementOpportunity, 5000);
  scheduleNextEngagement();
}

/**
 * Post simple facts/advice content
 */
async function postSimpleContent(type: 'simple_fact' | 'advice') {
  console.log(`📝 SIMPLE_CONTENT: Posting ${type}...`);
  
  // Simple content topics  
  const simpleTopics = [
    'morning hydration protocol',
    'sleep temperature optimization', 
    'magnesium timing for better sleep',
    'cold exposure for metabolism',
    'intermittent fasting timing',
    'blue light blocking strategy',
    'breathing technique for stress',
    'supplement timing optimization'
  ];
  
  const topic = simpleTopics[Math.floor(Math.random() * simpleTopics.length)];
  
  try {
    // 🎯 GENERATE DIVERSE SIMPLE TWEET WITH HOOK DIVERSIFICATION
    const OpenAI = (await import('openai')).default;
    const { HookDiversificationEngine } = await import('./ai/hookDiversificationEngine');
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const hookEngine = HookDiversificationEngine.getInstance();
    
    // Get diverse hook instead of hardcoded "Most people don't know"
    const diverseHook = hookEngine.getDiverseHook(topic, 'simple');
    
    const prompt = type === 'simple_fact' 
      ? `Create a viral health fact about ${topic}. Use this EXACT hook format: "${diverseHook}" Make it shocking and specific. Include the mechanism/reason why. Keep under 240 chars.`
      : `Create actionable health advice about ${topic}. Use this EXACT hook format: "${diverseHook}" Make it specific and actionable. Include expected results. Keep under 240 chars.`;
    
    console.log(`🎯 HOOK_DIVERSIFICATION: Using "${diverseHook.substring(0, 50)}..." for ${type}`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100
    });
    
    const content = response.choices?.[0]?.message?.content?.trim() || '';
    
    if (content) {
      console.log(`📝 GENERATED: "${content}" (${content.length} chars)`);
      
      // 🚀 REAL POSTING: Use actual TwitterPoster
      const { TwitterPoster } = await import('./posting/postThread');
      const poster = new TwitterPoster();
      const result = await poster.postSingleTweet(content, topic);
      
      if (result.success) {
        console.log(`✅ SIMPLE_POST: Posted successfully! Tweet ID: ${result.tweetId}`);
        return result.tweetId;
      } else {
        console.error(`❌ SIMPLE_POST_FAILED: ${result.error}`);
        return null;
      }
    }
    
    return null;
    
  } catch (error: any) {
    console.error('❌ SIMPLE_CONTENT_ERROR:', error.message);
  }
}

/**
 * TWITTER ANALYTICS ENGINE - Continuous Twitter landscape analysis
 */
async function startTwitterAnalytics() {
  console.log('📊 TWITTER_ANALYTICS: Starting continuous analysis...');
  
  const { TwitterAnalyticsEngine } = await import('./analytics/twitterAnalyticsEngine');
  const analytics = TwitterAnalyticsEngine.getInstance();
  
  async function runAnalyticsCycle() {
    try {
      console.log('🔍 ANALYTICS_CYCLE: Analyzing Twitter landscape...');
      
      // Deep Twitter analysis
      const metrics = await analytics.analyzeTwitterLandscape();
      
      // Generate engagement forecast
      const forecast = await analytics.generateEngagementForecast();
      
      console.log('📊 ANALYTICS_SUMMARY:');
      console.log(`🔥 TRENDING: ${metrics.trending_topics.slice(0, 3).join(', ')}`);
      console.log(`⏰ PEAK_HOURS: ${metrics.peak_engagement_hours.join(', ')}`);
      console.log(`🏆 COMPETITORS: ${metrics.competitor_activity.length} analyzed`);
      console.log(`🚀 OPPORTUNITIES: ${forecast.trending_opportunities.length} trending topics`);
      console.log(`⚡ GAPS: ${forecast.competitor_gaps.length} competitor gaps`);
      
    } catch (error: any) {
      console.error('❌ ANALYTICS_CYCLE_ERROR:', error.message);
    }
  }
  
  // Run analytics every 30 minutes
  setInterval(runAnalyticsCycle, 30 * 60 * 1000);
  
  // Run initial analysis after 1 minute
  setTimeout(runAnalyticsCycle, 60 * 1000);
}

/**
 * Main application entry point with proper error handling and graceful shutdown
 */
async function main() {
  console.log('🚀 Starting xBOT with REAL-TIME ANALYTICS & DATA-DRIVEN AI');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Start automated analytics collection immediately
  console.log('📊 ANALYTICS_STARTUP: Initializing real-time data collection...');
  const analyticsScheduler = AnalyticsScheduler.getInstance();
  analyticsScheduler.start();
  console.log('✅ ANALYTICS_ACTIVE: 30-minute data collection cycles running');
  
  // Start 100% AI-driven posting system (temporarily manual until old system fixed)
  console.log('🤖 AI_POSTING_STARTUP: 100% OpenAI-driven content system ready');
  console.log('✅ AI_POSTING_READY: Use AIDrivenPostingSystem.getInstance().forceViralPost() to test');
  
  // Startup delay to prevent immediate API rate limiting
  console.log('⏳ Adding startup delay to respect API rate limits...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
  
  try {
    // Validate environment
    console.log('🔍 Validating environment configuration...');
    const envValidation = validateEnvironment();
    
    if (!envValidation.valid) {
      console.error('❌ Environment validation failed:');
      envValidation.errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }
    
    console.log('✅ Environment validation passed');

    // Start aggressive monitoring system
    console.log('📊 AGGRESSIVE_MONITORING: Starting comprehensive system monitoring...');
    startAggressiveMonitoring();

    // Start health server
    console.log('🏥 Starting health monitoring server...');
    await startHealthServer();
    
    // Start AGGRESSIVE LEARNING ENGINE posting system
    console.log('🧠 Starting AGGRESSIVE LEARNING ENGINE...');
    await startIntelligentPosting();
    
    // Start intelligent engagement system for follower growth
    console.log('🤝 Starting INTELLIGENT ENGAGEMENT SYSTEM...');
    await startIntelligentEngagement();
    
    // Start Twitter analytics engine
    console.log('📊 Starting TWITTER ANALYTICS ENGINE...');
    await startTwitterAnalytics();
    
    console.log('✅ COMPLETE AI-DRIVEN GROWTH SYSTEM ready and running');
    console.log('🎯 Goal: Data-driven viral content + strategic engagement');
    console.log('🧬 Strategy: Twitter Analytics → Optimal Timing → Viral Content → Followers');

    // Set up graceful shutdown
    setupGracefulShutdown();

    console.log('✅ xBOT system initialization complete');
    console.log('🌐 Health server running - check /status endpoint for system status');
    console.log('🚀 ULTIMATE CONTENT SYSTEM active - generating premium content');
    console.log('📈 Focus: Quality-driven growth, authentic engagement, follower acquisition');
    
    // 🛡️ GLOBAL_CRASH_PREVENTION: Handle all uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('🛡️ Uncaught Exception (continuing):', error.message);
      // Don't exit - keep running
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🛡️ Unhandled Rejection (continuing):', reason);
      // Don't exit - keep running  
    });
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start xBOT system:', error);
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
    
    try {
      // Close connections in order
      console.log('🌐 Closing browser...');
      await closeBrowser();
      
      console.log('🗄️ Closing database connections...');
      await closeDatabaseConnections();
      
      console.log('🔐 Closing cadence guard...');
      // Cadence guard removed for simplified system
      
      console.log('🔓 Releasing PostLock and closing Redis...');
      try {
        const { closePostLockRedis } = await import('./infra/postLockInstance');
        await closePostLockRedis();
      } catch (error) {
        console.warn('⚠️ Error closing PostLock Redis:', error);
      }
      
      console.log('📊 Stopping metrics retry queue...');
      try {
        const { MetricsRetryQueue } = await import('./infra/MetricsRetryQueue');
        const retryQueue = MetricsRetryQueue.getInstance();
        retryQueue.stop();
      } catch (error) {
        console.warn('⚠️ Error stopping metrics queue:', error);
      }
      
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  
  // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
    shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

/**
 * AGGRESSIVE MONITORING SYSTEM
 * Tracks posting, replies, engagement, and system performance
 */
function startAggressiveMonitoring() {
  console.log('🔍 AGGRESSIVE_MONITORING: Initializing comprehensive tracking...');
  
  let stats = {
    posts: 0,
    replies: 0,
    threads: 0,
    errors: 0,
    lastActivity: new Date(),
    systemStartTime: new Date()
  };
  
  // Monitor posting activity
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    const message = args.join(' ');
    
    // Track different activities
    if (message.includes('POST_SUCCESS') || message.includes('AI_POST_SUCCESS')) {
      stats.posts++;
      stats.lastActivity = new Date();
    }
    if (message.includes('REPLY_SUCCESS') || message.includes('STRATEGIC_REPLY_SUCCESS')) {
      stats.replies++;
      stats.lastActivity = new Date();
    }
    if (message.includes('THREAD_POSTED') || message.includes('COMPLETE_THREAD_POSTED')) {
      stats.threads++;
      stats.lastActivity = new Date();
    }
    if (message.includes('ERROR') || message.includes('FAILED')) {
      stats.errors++;
    }
    
    originalConsoleLog(...args);
  };
  
  // Report stats every 10 minutes
  setInterval(() => {
    const uptime = Math.floor((new Date().getTime() - stats.systemStartTime.getTime()) / 1000 / 60);
    const lastActivityMinutes = Math.floor((new Date().getTime() - stats.lastActivity.getTime()) / 1000 / 60);
    
    console.log('📊 === AGGRESSIVE MONITORING REPORT ===');
    console.log(`🕰️  UPTIME: ${uptime} minutes`);
    console.log(`📝  POSTS: ${stats.posts} | REPLIES: ${stats.replies} | THREADS: ${stats.threads}`);
    console.log(`❌  ERRORS: ${stats.errors}`);
    console.log(`⏰  LAST_ACTIVITY: ${lastActivityMinutes} minutes ago`);
    console.log(`🎯  POSTS_PER_HOUR: ${Math.round((stats.posts / uptime) * 60)}`);
    console.log(`💬  REPLIES_PER_HOUR: ${Math.round((stats.replies / uptime) * 60)}`);
    
    // Alert if system is inactive
    if (lastActivityMinutes > 30) {
      console.log('🚨 ALERT: No activity for 30+ minutes! System may need attention.');
    }
    
    // Alert if error rate is high
    const errorRate = stats.errors / (stats.posts + stats.replies + 1);
    if (errorRate > 0.3) {
      console.log(`🚨 ALERT: High error rate (${Math.round(errorRate * 100)}%)! System needs debugging.`);
    }
    
    console.log('====================================\n');
  }, 10 * 60 * 1000); // Every 10 minutes
  
  // Quick status every 5 minutes
  setInterval(() => {
    const uptime = Math.floor((new Date().getTime() - stats.systemStartTime.getTime()) / 1000 / 60);
    console.log(`📊 QUICK_STATUS: ${uptime}m uptime | ${stats.posts} posts | ${stats.replies} replies | ${stats.threads} threads | ${stats.errors} errors`);
  }, 5 * 60 * 1000); // Every 5 minutes
  
  console.log('✅ AGGRESSIVE_MONITORING: Active - reporting every 5-10 minutes');
}

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error in main:', error);
    process.exit(1);
  });
}

export { main };