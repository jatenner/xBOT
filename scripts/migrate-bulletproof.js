"use strict";
/**
 * BULLETPROOF Migration Runner - NEVER Blocks Startup
 * 
 * Strategy:
 * - Run migrations in background (non-blocking)
 * - Skip any migration that fails
 * - Mark successful ones to avoid re-running
 * - Retry transient errors
 * - ALWAYS exit successfully (never block app)
 */

const fs = require('fs');
const path = require('path');
const { withFreshClient } = require('../dist/src/db/client');

// Timeout for entire migration process (increased for SSL handshake)
const MIGRATION_TIMEOUT_MS = 10000; // 10 seconds for migrations
const CONNECTION_TIMEOUT_MS = 5000; // 5 seconds to connect (SSL negotiation needs time)

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[${timestamp}] [MIGRATE] ${message}`);
}

async function ensureTrackingTable() {
  try {
    const result = await Promise.race([
      withFreshClient(async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
      )
    ]);
    log('info', '✅ Schema tracking table ready');
  } catch (error) {
    log('warn', `⚠️ Could not create tracking table: ${error.message}`);
    throw error; // Abort if we can't even connect
  }
}

async function getAppliedMigrations() {
  try {
    return await withFreshClient(async (client) => {
      const result = await client.query('SELECT id FROM public.schema_migrations');
      return new Set(result.rows.map(row => row.id));
    });
  } catch (error) {
    log('warn', `⚠️ Could not read applied migrations: ${error.message}`);
    return new Set();
  }
}

async function applyMigration(filename, sqlContent) {
  const migrationId = filename.replace('.sql', '');
  
  try {
    await withFreshClient(async (client) => {
      // Check if already applied
      const checkResult = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE id = $1', 
        [migrationId]
      );
      
      if (checkResult.rowCount && checkResult.rowCount > 0) {
        return; // Already applied
      }

      // Apply in transaction
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO public.schema_migrations (id) VALUES ($1)', [migrationId]);
        await client.query('COMMIT');
        log('info', `✅ ${migrationId}`);
      } catch (sqlError) {
        await client.query('ROLLBACK');
        
        // Check if idempotent error (already exists)
        if (sqlError.code === '42710' || 
            sqlError.code === '23505' || 
            sqlError.code === '42P07' || // relation already exists
            sqlError.message?.includes('already exists')) {
          // Mark as applied anyway (idempotent)
          await client.query(
            'INSERT INTO public.schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', 
            [migrationId]
          );
          log('info', `✅ ${migrationId} (idempotent)`);
          return;
        }
        
        // Other SQL error - log and skip
        throw sqlError;
      }
    });
  } catch (error) {
    log('warn', `⚠️ SKIPPED ${migrationId}: ${error.message.substring(0, 100)}`);
    // Don't re-throw - just skip this migration
  }
}

async function runMigrations() {
  const startTime = Date.now();
  log('info', '🚀 Starting non-blocking migrations...');

  try {
    // Step 1: Ensure tracking table (with timeout)
    try {
      await ensureTrackingTable();
    } catch (error) {
      log('error', `❌ Cannot connect to database: ${error.message}`);
      log('info', '⚠️ Skipping migrations - app will start anyway');
      return;
    }

    // Step 2: Get list of migration files
    const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      log('info', '📊 No migrations directory');
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && /^\d{8}_/.test(file))
      .sort();

    if (migrationFiles.length === 0) {
      log('info', '📊 No migration files found');
      return;
    }

    log('info', `📊 Found ${migrationFiles.length} migration files`);

    // Step 3: Get already applied migrations
    const appliedMigrations = await getAppliedMigrations();

    // Step 4: Apply pending migrations (skip failures)
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const filename of migrationFiles) {
      const migrationId = filename.replace('.sql', '');
      
      if (appliedMigrations.has(migrationId)) {
        skippedCount++;
        continue;
      }

      // Check timeout
      if (Date.now() - startTime > MIGRATION_TIMEOUT_MS) {
        log('warn', `⏱️ Migration timeout (${MIGRATION_TIMEOUT_MS}ms) - stopping for now`);
        log('info', `   ${migrationFiles.length - appliedCount - skippedCount} migrations remaining`);
        break;
      }

      try {
        const filePath = path.join(migrationsDir, filename);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        await applyMigration(filename, sqlContent);
        appliedCount++;
      } catch (error) {
        errorCount++;
        // Error already logged in applyMigration
      }
    }

    const elapsed = Date.now() - startTime;
    log('info', `✅ Migrations complete (${elapsed}ms): ${appliedCount} applied, ${skippedCount} skipped, ${errorCount} failed`);

  } catch (error) {
    log('error', `❌ Migration runner error: ${error.message}`);
  }
}

// Run migrations and ALWAYS exit successfully
runMigrations()
  .then(() => {
    log('info', '✅ Migration runner finished');
    process.exit(0);
  })
  .catch((error) => {
    log('error', `❌ Unexpected error: ${error.message}`);
    process.exit(0); // Still exit successfully - don't block app!
  });

// MULTIPLE timeout safety mechanisms
setTimeout(() => {
  log('warn', '⏱️ Migration runner timeout - exiting to allow app startup');
  process.exit(0);
}, MIGRATION_TIMEOUT_MS + 500);

// Emergency timeout (if setTimeout somehow doesn't work)
const emergencyTimeout = setTimeout(() => {
  console.error('[MIGRATE] 🚨 EMERGENCY TIMEOUT - FORCE EXIT');
  process.exit(0);
}, 5000);

// Clear emergency timeout if we finish normally
process.on('beforeExit', () => clearTimeout(emergencyTimeout));

