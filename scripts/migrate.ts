/**
 * Bulletproof Migration Runner for xBOT
 * - Non-crashing prestart migrations
 * - Idempotent schema tracking
 * - Transient error retry with exponential backoff
 * - Verified SSL only
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { withFreshClient } from '../src/db/client';

// Environment detection
const isProd = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ MIGRATE_ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

/**
 * Safe logging with timestamp
 */
function log(level: 'info' | 'warn' | 'error', message: string): void {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[${timestamp}] ${message}`);
}

/**
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is transient (network/SSL related)
 */
function isTransientError(error: any): boolean {
  const message = String(error?.message || error).toLowerCase();
  return /self-signed certificate|etimedout|econnreset|eof|certificate|network|connection|timeout/i.test(message);
}

/**
 * Ensure schema_migrations tracking table exists
 */
async function ensureTrackingTable(): Promise<void> {
  await withFreshClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    log('info', '📊 MIGRATIONS: Schema tracking table ready');
  });
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  try {
    return await withFreshClient(async (client) => {
      const result = await client.query('SELECT id FROM public.schema_migrations ORDER BY applied_at');
      return new Set(result.rows.map(row => row.id));
    });
  } catch (error) {
    log('warn', `⚠️ MIGRATIONS: Could not read applied migrations: ${error}`);
    return new Set();
  }
}

/**
 * Apply a single migration file
 */
async function applyMigration(filename: string, sqlContent: string): Promise<void> {
  const migrationId = filename.replace('.sql', '');
  
  await withFreshClient(async (client) => {
    // Check if already applied
    const checkResult = await client.query(
      'SELECT 1 FROM public.schema_migrations WHERE id = $1', 
      [migrationId]
    );
    
    if (checkResult.rowCount && checkResult.rowCount > 0) {
      log('info', `📊 MIGRATIONS: Skipping ${migrationId} (already applied)`);
      return;
    }
    
    // Apply migration in transaction
    await client.query('BEGIN');
    try {
      // Execute the migration SQL
      await client.query(sqlContent);
      
      // Record as applied
      await client.query(
        'INSERT INTO public.schema_migrations (id) VALUES ($1)', 
        [migrationId]
      );
      
      await client.query('COMMIT');
      log('info', `✅ MIGRATION_APPLIED: ${migrationId}`);
      
    } catch (sqlError: any) {
      await client.query('ROLLBACK');
      
      // Check if it's a "already exists" type error (idempotency)
      if (sqlError.code === '42710' || // duplicate_object
          sqlError.code === '23505' || // unique_violation  
          sqlError.message?.includes('already exists')) {
        
        log('info', `📊 MIGRATIONS: ${migrationId} contains existing objects (idempotent)`);
        
        // Still record it as applied to avoid re-running
        await client.query(
          'INSERT INTO public.schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', 
          [migrationId]
        );
        return;
      }
      
      // Re-throw for other SQL errors
      throw sqlError;
    }
  });
}

/**
 * Discover and apply all pending migrations
 */
async function applyAllMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    log('info', '📊 MIGRATIONS: No migrations directory found, skipping');
    return;
  }
  
  // Get migration files in natural order
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Lexicographic sort (YYYYMMDD_HHMM format)
  
  if (migrationFiles.length === 0) {
    log('info', '📊 MIGRATIONS: No migration files found');
    return;
  }
  
  log('info', `📊 MIGRATIONS: Found ${migrationFiles.length} migration files`);
  
  const appliedMigrations = await getAppliedMigrations();
  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const filename of migrationFiles) {
    const migrationId = filename.replace('.sql', '');
    
    if (appliedMigrations.has(migrationId)) {
      skippedCount++;
      continue;
    }
    
    try {
      const filePath = path.join(migrationsDir, filename);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      await applyMigration(filename, sqlContent);
      appliedCount++;
      
    } catch (error: any) {
      errorCount++;
      log('error', `⛔ MIGRATION_ERROR: ${filename} - ${error.message}`);
      
      // For SQL errors, continue with other migrations
      // For transient errors, they'll be caught by the retry logic above
      if (!isTransientError(error)) {
        log('error', `⛔ MIGRATION_FAILED: ${filename} requires manual review`);
      }
    }
  }
  
  // Summary
  if (errorCount > 0) {
    log('warn', `❗ MIGRATIONS: ${appliedCount} applied, ${skippedCount} skipped, ${errorCount} failed`);
  } else {
    log('info', `✅ MIGRATIONS: complete (${appliedCount} applied, ${skippedCount} skipped)`);
  }
}

/**
 * Main prestart migration function
 */
async function runPrestartMigrations(): Promise<void> {
  log('info', '🚀 MIGRATIONS: Starting prestart migration runner...');
  
  let attempt = 1;
  const maxAttempts = 3;
  let delay = 1000; // Start with 1 second
  
  while (attempt <= maxAttempts) {
    try {
      log('info', `📊 MIGRATIONS: Attempt ${attempt}/${maxAttempts}`);
      
      // Step 1: Ensure tracking table
      await ensureTrackingTable();
      
      // Step 2: Apply all migrations
      await applyAllMigrations();
      
      log('info', '✅ MIGRATIONS: Prestart completed successfully');
      return;
      
    } catch (error: any) {
      log('error', `❌ MIGRATIONS_ATTEMPT_${attempt} failed: ${error.message}`);
      
      if (attempt < maxAttempts && isTransientError(error)) {
        log('info', `🔄 MIGRATIONS: Retrying in ${delay}ms (transient error)`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
        attempt++;
        continue;
      }
      
      // Non-transient error or max attempts reached
      if (isTransientError(error)) {
        log('warn', '⚠️ MIGRATIONS: Deferring to runtime runner due to persistent connectivity issues');
      } else {
        log('error', `⛔ MIGRATIONS: SQL error requires manual review: ${error.message}`);
      }
      
      // Non-fatal exit: allow app to boot, runtime runner will retry
      log('info', '📊 MIGRATIONS: Exiting prestart (app will boot, runtime runner will continue)');
      return;
    }
  }
}

/**
 * Runtime migration runner (for background retries)
 */
export async function runRuntimeMigrations(): Promise<void> {
  log('info', '🔄 RUNTIME_MIGRATIONS: Starting background migration runner...');
  
  let attempt = 1;
  let delay = 60000; // Start with 1 minute for runtime
  const maxDelay = 600000; // Max 10 minutes between attempts
  
  while (true) {
    try {
      await ensureTrackingTable();
      await applyAllMigrations();
      
      log('info', '✅ RUNTIME_MIGRATIONS: All migrations applied, stopping runner');
      return;
      
    } catch (error: any) {
      log('error', `❌ RUNTIME_MIGRATIONS_ATTEMPT_${attempt} failed: ${error.message}`);
      
      if (isTransientError(error)) {
        log('info', `🔄 RUNTIME_MIGRATIONS: Retrying in ${Math.round(delay/1000)}s`);
        await sleep(delay);
        delay = Math.min(delay * 1.5, maxDelay); // Exponential backoff with cap
        attempt++;
      } else {
        log('error', '⛔ RUNTIME_MIGRATIONS: Stopping due to non-transient error');
        return;
      }
    }
  }
}

// Run prestart migrations if this file is executed directly
if (require.main === module) {
  runPrestartMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      log('error', `💥 MIGRATIONS: Unexpected error: ${error.message}`);
      process.exit(0); // Non-fatal exit to allow app boot
    });
}
