/**
 * 🚂 RAILWAY ENTRYPOINT - Fail-open healthcheck + background init
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Server MUST start and listen within 2 seconds
 * 2. /status MUST respond 200 without ANY async imports or DB calls
 * 3. Background init MUST NEVER crash the process (log errors, stay alive)
 * 4. Server stays up even if Supabase/Twitter/Playwright/env are broken
 */

import express from 'express';

const app = express();

// Middleware
app.use(express.json());

/**
 * ⚡ INSTANT HEALTHCHECK - No DB, no async imports, no env validation
 */
app.get('/status', (req, res) => {
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    pid: process.pid
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    name: 'xBOT Railway Entrypoint',
    status: 'listening',
    healthcheck: '/status',
    timestamp: new Date().toISOString()
  });
});

/**
 * Start server IMMEDIATELY (before any heavy init)
 */
const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`[BOOT] listening host=${host} port=${port} pid=${process.pid}`);
  console.log(`[BOOT] healthcheck ready: http://${host}:${port}/status`);
  console.log(`[BOOT] timestamp=${new Date().toISOString()}`);
});

/**
 * Graceful shutdown handlers
 */
const shutdown = (signal: string) => {
  console.log(`[BOOT] shutdown signal=${signal}`);
  server.close(() => {
    console.log('[BOOT] server closed');
    process.exit(0);
  });
  
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[BOOT] forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Error handlers - NEVER crash the process
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  console.error('[BOOT] unhandledRejection:', errorMessage);
  console.error('[BOOT] promise:', promise);
  // DO NOT exit - keep server alive
});

process.on('uncaughtException', (error: Error) => {
  console.error('[BOOT] uncaughtException:', error.message);
  console.error('[BOOT] stack:', error.stack);
  // DO NOT exit - keep server alive
});

/**
 * Background initialization (non-blocking, fail-safe)
 * 
 * This runs AFTER the server is listening, so Railway healthcheck passes
 * even if initialization fails.
 */
setImmediate(async () => {
  console.log('[BOOT] background_init start');
  
  try {
    // Validate environment (soft check - warn only, don't exit)
    console.log('[BOOT] env_validation start');
    try {
      const { validateEnvironment } = await import('./config/env');
      const isValid = validateEnvironment();
      if (!isValid) {
        console.warn('[BOOT] ⚠️ env_validation failed - running in degraded mode');
        // Continue anyway - let individual systems handle missing env vars
      } else {
        console.log('[BOOT] env_validation ok');
      }
    } catch (envError: any) {
      console.error('[BOOT] ⚠️ env_validation error:', envError.message);
      console.error('[BOOT] continuing in degraded mode...');
    }
    
    // Run database migrations
    console.log('[BOOT] migrations start');
    try {
      const { runMigrationsOnStartup } = await import('./db/runMigrations');
      await runMigrationsOnStartup();
      console.log('[BOOT] migrations ok');
    } catch (migError: any) {
      console.error('[BOOT] ⚠️ migrations error:', migError.message);
      console.error('[BOOT] continuing without migrations...');
    }
    
    // Validate database schema
    console.log('[BOOT] schema_validation start');
    try {
      const { validateDatabaseSchema } = await import('./db/schemaValidator');
      const schemaResult = await validateDatabaseSchema();
      if (!schemaResult.valid) {
        console.error('[BOOT] ⚠️ schema_validation failed');
        console.error(`[BOOT]    errors=${schemaResult.errors.length}`);
        console.error(`[BOOT]    missing_tables=${schemaResult.missingTables.length}`);
        console.error(`[BOOT]    missing_columns=${schemaResult.missingColumns.length}`);
        schemaResult.errors.slice(0, 5).forEach(err => console.error(`[BOOT]    - ${err}`));
        console.error('[BOOT] continuing in degraded mode...');
      } else {
        console.log('[BOOT] schema_validation ok');
      }
    } catch (schemaError: any) {
      console.error('[BOOT] ⚠️ schema_validation error:', schemaError.message);
      console.error('[BOOT] continuing without schema validation...');
    }
    
    // Start the main application system
    console.log('[BOOT] main_system start');
    try {
      const { boot } = await import('./main-bulletproof');
      await boot();
      console.log('[BOOT] main_system ok');
    } catch (bootError: any) {
      console.error('[BOOT] ⚠️ main_system error:', bootError.message);
      console.error('[BOOT] continuing with server only (no jobs)...');
    }
    
    console.log('[BOOT] ✅ background_init complete');
    
  } catch (error: any) {
    console.error('[BOOT] ❌ background_init fatal error:', error.message);
    console.error('[BOOT] stack:', error.stack);
    console.error('[BOOT] server stays alive in minimal mode (healthcheck only)');
    // DO NOT exit - server continues to respond to healthcheck
  }
});

console.log('[BOOT] entrypoint loaded, server starting...');

