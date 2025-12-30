import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';
import { boot } from './main-bulletproof';
import { validateDatabaseSchema } from './db/schemaValidator';
import { runMigrationsOnStartup } from './db/runMigrations.js';

/**
 * Main application entry point with proper error handling and graceful shutdown
 * 
 * ⚡ BOOT ORDER (Railway healthcheck optimized):
 *  1. Validate env (fast)
 *  2. Start server on 0.0.0.0:PORT (/status responds immediately)
 *  3. THEN run slow init (migrations, schema, browser, jobs) in background
 */
async function main() {
  console.log('[BOOT] start');
  console.log(`[BOOT] timestamp=${new Date().toISOString()}`);
  console.log(`[BOOT] env PORT=${process.env.PORT || 3000}`);
  
  // Step 1: Validate environment (fast, fail early)
  if (!validateEnvironment()) {
    console.error('[BOOT] ❌ Environment validation failed');
    process.exit(1);
  }
  console.log('[BOOT] env validated');

  // Step 2: Start health server IMMEDIATELY (before any slow init)
  console.log('[BOOT] status route ready');
  await startHealthServer();
  console.log('[BOOT] server listening');

  // Step 3: Move ALL slow initialization to background (non-blocking for healthcheck)
  console.log('[BOOT] starting background init');
  setImmediate(async () => {
    try {
      // Run database migrations
      console.log('[BOOT] migrations start');
      await runMigrationsOnStartup();
      console.log('[BOOT] migrations complete');
      
      // Validate database schema
      console.log('[BOOT] schema validation start');
      const schemaResult = await validateDatabaseSchema();
      
      if (!schemaResult.valid) {
        console.error('[BOOT] ❌ DATABASE SCHEMA VALIDATION FAILED!');
        console.error(`[BOOT]    Errors: ${schemaResult.errors.length}`);
        console.error(`[BOOT]    Missing tables: ${schemaResult.missingTables.length}`);
        console.error(`[BOOT]    Missing columns: ${schemaResult.missingColumns.length}`);
        
        schemaResult.errors.forEach(err => console.error(`[BOOT]    • ${err}`));
        
        if (schemaResult.missingColumns.length > 0) {
          console.error('[BOOT] 📊 Missing columns:');
          schemaResult.missingColumns.forEach(({ table, columns }) => {
            console.error(`[BOOT]    • ${table}: ${columns.join(', ')}`);
          });
        }
        
        console.error('[BOOT] 💡 Schema invalid but server stays alive (degraded mode)');
        // DON'T exit - keep server running for debugging
        return;
      }
      
      console.log('[BOOT] schema validated');

      // Initialize and start the bulletproof system
      console.log('[BOOT] bulletproof system start');
      await boot();
      console.log('[BOOT] bulletproof system ready');
      
      console.log('[BOOT] ✅ Full initialization complete');
    } catch (error: any) {
      console.error('[BOOT] ❌ Background init error:', error.message);
      console.error('[BOOT] Server stays alive (degraded mode)');
      // Keep server running even if init fails
    }
  });

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