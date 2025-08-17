import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { executePost } from './posting/orchestrator';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';
import { closeCadenceGuard } from './posting/cadenceGuard';
import { AutonomousPostingEngine } from './core/autonomousPostingEngine';

/**
 * Main application entry point with proper error handling and graceful shutdown
 */
async function main() {
  console.log('🚀 Starting xBOT with enhanced quality and stability system');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
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

    // Bootstrap database schema check with SchemaGuard
    console.log('🗄️ Checking database schema...');
    try {
      const { DatabaseManager } = await import('./lib/db');
      const { ensureSchema } = await import('./infra/db/SchemaGuard');
      
      // Wait for database to be ready
      const dbManager = DatabaseManager.getInstance();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Allow DB init
      
      // @ts-ignore - accessing pool for schema operations
      await ensureSchema(dbManager.pool);
    } catch (schemaError: any) {
      console.warn(`⚠️ Schema check failed: ${schemaError.message}`);
      // Don't fail startup, but warn
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

    // Start autonomous posting engine for follower growth
    console.log('🤖 Starting autonomous posting engine...');
    const autonomousEngine = AutonomousPostingEngine.getInstance();
    await autonomousEngine.initialize();
    console.log('✅ Autonomous posting engine started - analyzing opportunities every 5 minutes');
    console.log('🎯 Goal: Generate followers and engagement through high-quality content');
    console.log('📊 Learning from engagement data to optimize future posts');

    // Set up graceful shutdown
    setupGracefulShutdown();

    console.log('✅ xBOT system initialization complete');
    console.log('🌐 Health server running - check /status endpoint for system status');
    console.log('🤖 Autonomous posting active - will post when opportunities are detected');
    console.log('📈 Focus: Building audience, generating followers, learning from engagement');
    
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