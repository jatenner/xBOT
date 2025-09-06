import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';
import { BulletproofMainSystem } from './main-bulletproof';

/**
 * Main application entry point with proper error handling and graceful shutdown
 */
async function main() {
  console.log('🛡️ BULLETPROOF_SYSTEM: Starting production-grade quality content generation');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Validate environment
  if (!validateEnvironment()) {
    console.error('❌ Environment validation failed');
    process.exit(1);
  }

  // Start health server
  await startHealthServer();
  console.log('🏥 Health server started');

  // Initialize and start the bulletproof system
  console.log('🚀 BULLETPROOF_STARTUP: Initializing bulletproof prompt system...');
  const bulletproofSystem = new BulletproofMainSystem();
  
  console.log('🎯 BULLETPROOF_FEATURES: Learning systems, AI-driven content, Real analytics');
  console.log('✅ BULLETPROOF_READY: Professional content generation with existing systems');
  
  // Start the bulletproof system
  await bulletproofSystem.start();
  
  // Set up graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
      console.log('🛡️ Stopping bulletproof system...');
      await bulletproofSystem.stop();
      
      console.log('🌐 Closing browser...');
      await closeBrowser();
      
      console.log('💾 Closing database connections...');
      await closeDatabaseConnections();
      
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