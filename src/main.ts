import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { executePost } from './posting/orchestrator';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';
import { closeCadenceGuard } from './posting/cadenceGuard';
import { AutonomousPostingEngine } from './core/autonomousPostingEngine';
import { RealEngagementTracker } from './metrics/realEngagementTracker';
import { ensureSchemaAtBoot } from './services/SchemaGuard';

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

    // Bootstrap database schema check with standalone SchemaGuard
    console.log('🗄️ Checking database schema...');
    try {
      await ensureSchemaAtBoot();
    } catch (error: any) {
      console.error('🚨 SCHEMA_GUARD: Failed to ensure schema at boot:', error.message);
      console.error('🚨 Continuing in degraded mode - metrics storage may fail');
    }

    // Start health server
    console.log('🏥 Starting health monitoring server...');
    await startHealthServer();
    
    // Test basic functionality
    if (process.argv.includes('--test-post')) {
      console.log('🧪 Running test post...');
      const result = await executePost({ 
        topic: 'system health check test',
        format: 'single'
      });
      
      if (result.success) {
        console.log('✅ Test post successful:', result.rootTweetId);
      } else {
        console.log('❌ Test post failed:', result.error);
      }
      
      return;
    }

    // Start autonomous posting engine
    console.log('🤖 Starting autonomous posting engine...');
    const postingEngine = AutonomousPostingEngine.getInstance();
    
    // Start real engagement tracking
    console.log('📊 Starting real engagement tracker...');
    const engagementTracker = RealEngagementTracker.getInstance();
    await engagementTracker.initialize();
    
    // Initialize autonomous posting
    console.log('🎯 Initializing autonomous posting system...');
    await postingEngine.initialize();
    
    console.log('✅ Autonomous posting engine ready and running');
    console.log('🎯 Goal: Generate actual likes, retweets, and followers');
    console.log('📊 Tracking real Twitter metrics, not internal estimates');
    console.log('🔄 Bot will post automatically based on optimal timing');

    // Set up graceful shutdown
    setupGracefulShutdown();

    console.log('✅ xBOT system initialization complete');
    console.log('🌐 Health server running - check /status endpoint for system status');
    console.log('🤖 Autonomous posting active - will post when opportunities are detected');
    console.log('📈 Focus: Building audience, generating followers, learning from engagement');
    
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