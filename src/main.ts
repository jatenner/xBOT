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
      
      const threadResult = await generateThread({
        topic: 'health optimization breakthrough',
        pillar: 'biohacking', 
        angle: 'contrarian',
        spice_level: 8,
        evidence_mode: 'mechanism'
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
    
    console.log('✅ SIMPLE THREAD SYSTEM ready and running');
    console.log('🎯 Goal: Post scientific threads that gain followers');
    console.log('🧬 Focus: Complex scientific content, real threads, growth');

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
      await closeCadenceGuard();
      
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