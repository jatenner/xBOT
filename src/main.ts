import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';

/**
 * SIMPLE THREAD POSTING LOOP - No bloat, just threads
 */
async function startSimpleThreadLoop() {
  console.log('🧵 SIMPLE_THREAD_LOOP: Starting basic thread posting...');
  
  async function postScientificThread() {
    try {
      console.log('🔬 Creating scientific thread...');
      
      // Generate scientific thread
      const { generateThread } = await import('./ai/threadGenerator');
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      
      // Get random viral topic for follower growth
      const { getRandomViralTopic } = await import('./content/viralTopics');
      const viralTopic = getRandomViralTopic();
      
      console.log(`🔥 VIRAL_TOPIC: ${viralTopic.topic} (${viralTopic.hook_type})`);
      console.log(`🎯 APPEAL: ${viralTopic.follower_appeal}`);
      
      const threadResult = await generateThread({
        topic: viralTopic.topic,
        pillar: viralTopic.hook_type, 
        angle: viralTopic.angle,
        spice_level: 9, // Maximum controversy
        evidence_mode: 'viral_appeal'
      }, openai);
      
      console.log(`🧵 Generated ${threadResult.tweets.length} scientific tweets`);
      
      // Post the thread
      const { SimpleThreadPoster } = await import('./posting/simpleThreadPoster');
      const poster = SimpleThreadPoster.getInstance();
      
      const tweetTexts = threadResult.tweets.map(t => t.text);
      const result = await poster.postRealThread(tweetTexts);
      
      if (result.success) {
        console.log(`✅ THREAD_SUCCESS: Posted ${result.totalTweets} tweets (Root: ${result.rootTweetId})`);
      } else {
        console.log(`❌ THREAD_FAILED: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ THREAD_ERROR:', error.message);
    }
  }
  
  // Post immediately
  setTimeout(postScientificThread, 10000); // 10 seconds
  
  // Post every 2 hours
  setInterval(postScientificThread, 2 * 60 * 60 * 1000);
}

/**
 * AGGRESSIVE ENGAGEMENT LOOP - Build followers through strategic engagement
 */
async function startEngagementLoop() {
  console.log('🚀 ENGAGEMENT_LOOP: Starting aggressive follower acquisition...');
  
  async function runEngagementCycle() {
    try {
      console.log('🤝 ENGAGEMENT_CYCLE: Running strategic engagement...');
      
      // Strategic replies to health influencers (every 30 min)
      const { executeStrategicReplies } = await import('./engagement/strategicReplies');
      await executeStrategicReplies();
      
      // Strategic follows (every hour)  
      const { executeStrategicFollows } = await import('./engagement/strategicFollows');
      await executeStrategicFollows();
      
      // Strategic likes (every 15 min)
      const { executeStrategicLikes } = await import('./engagement/strategicLikes');
      await executeStrategicLikes();
      
      console.log('✅ ENGAGEMENT_CYCLE: Completed strategic engagement cycle');
      
    } catch (error: any) {
      console.error('❌ ENGAGEMENT_ERROR:', error.message);
    }
  }
  
  // Start engagement immediately
  setTimeout(runEngagementCycle, 30000); // 30 seconds
  
  // Run engagement every 15 minutes
  setInterval(runEngagementCycle, 15 * 60 * 1000);
}

/**
 * Main application entry point with proper error handling and graceful shutdown
 */
async function main() {
  console.log('🚀 Starting xBOT with enhanced quality and stability system');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
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

    // Start health server
    console.log('🏥 Starting health monitoring server...');
    await startHealthServer();
    
    // Start simple thread posting system
    console.log('🧵 Starting SIMPLE THREAD SYSTEM...');
    await startSimpleThreadLoop();
    
    // Start aggressive engagement system for follower growth
    console.log('🤝 Starting ENGAGEMENT SYSTEM for follower acquisition...');
    await startEngagementLoop();
    
    console.log('✅ COMPLETE GROWTH SYSTEM ready and running');
    console.log('🎯 Goal: Post viral threads + aggressive engagement');
    console.log('🧬 Strategy: Content + replies + follows + likes = FOLLOWERS');

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

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error in main:', error);
    process.exit(1);
  });
}

export { main };