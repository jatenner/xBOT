import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';
import { boot } from './main-bulletproof';
import { validateDatabaseSchema } from './db/schemaValidator';

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

  // Validate database schema BEFORE starting
  console.log('🔍 Validating database schema...');
  const schemaResult = await validateDatabaseSchema();
  
  if (!schemaResult.valid) {
    console.error('\n❌ DATABASE SCHEMA VALIDATION FAILED!');
    console.error(`   Errors: ${schemaResult.errors.length}`);
    console.error(`   Missing tables: ${schemaResult.missingTables.length}`);
    console.error(`   Missing columns: ${schemaResult.missingColumns.length}`);
    
    schemaResult.errors.forEach(err => console.error(`   • ${err}`));
    
    if (schemaResult.missingColumns.length > 0) {
      console.error('\n📊 Missing columns:');
      schemaResult.missingColumns.forEach(({ table, columns }) => {
        console.error(`   • ${table}: ${columns.join(', ')}`);
      });
    }
    
    console.error('\n💡 Fix: Run database migrations or check EXPECTED_SCHEMA in src/db/schemaValidator.ts');
    process.exit(1);
  }
  
  console.log('✅ Database schema validated successfully\n');

  // Start health server
  await startHealthServer();
  console.log('🏥 Health server started');

  // Initialize and start the bulletproof system
  console.log('🚀 BULLETPROOF_STARTUP: Initializing lightweight Railway-optimized system...');
  
  console.log('🎯 BULLETPROOF_FEATURES: Lightweight posting, Resource protection, Memory optimization');
  console.log('✅ BULLETPROOF_READY: Railway-optimized system starting...');
  
  // Start the bulletproof system
  await boot();
  
  // Set up graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
      console.log('🛡️ Stopping bulletproof system...');
      // The boot function handles its own cleanup
      
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
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    
    // Check for browser-related errors that should trigger relaunch instead of shutdown
    const isBrowserError = errorMessage.includes('Target closed') ||
                          errorMessage.includes('TargetClosedError') ||
                          errorMessage.includes('_didDisconnect') ||
                          errorMessage.includes('Browser closed') ||
                          errorMessage.includes('Context closed') ||
                          errorMessage.includes('Page closed') ||
                          errorMessage.includes('Protocol error') ||
                          errorMessage.includes('Connection closed');
    
    if (isBrowserError) {
      console.warn('🔄 Browser error detected, scheduling relaunch instead of shutdown:', errorMessage);
      
      // Import and schedule browser relaunch
      import('./core/RailwayBrowserManager').then(({ railwayBrowserManager }) => {
        railwayBrowserManager.scheduleBrowserRelaunch({ backoffMs: 5000 });
      }).catch((err) => {
        console.error('❌ Failed to schedule browser relaunch:', err.message);
      });
      
      return; // Don't shutdown for browser errors
    }
    
    // For non-browser errors, continue with normal shutdown
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