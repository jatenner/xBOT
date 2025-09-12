/**
 * Migration Runner for xBOT
 * - Creates migration tracking table
 * - Runs migrations in lexicographic order
 * - Idempotent: handles duplicates gracefully
 * - Never crashes the process on migration errors
 */

const fs = require('fs');
const path = require('path');
const { Pool, Client } = require('pg');
const { URL } = require('url');

// Safe logging helper (masks secrets)
function safeLog(level, message) {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  
  // Mask secrets in logs
  const masked = typeof message === 'string' ? message
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@')
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***')
    .replace(/(eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+)/g, 'eyJ***')
    .replace(/(Bearer\s+)[A-Za-z0-9\-\._~+/=]+/gi, '$1***') : message;
    
  logFn(`[${timestamp}] ${masked}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get migrations directory
function getMigrationsDir() {
  // Always resolve from repository root, regardless of where script is run from
  const repoRoot = path.resolve(__dirname, '..');
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    safeLog('info', `📊 MIGRATIONS: Directory not found at ${migrationsDir}, creating...`);
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  return migrationsDir;
}

// Main migration function
async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    safeLog('error', '❌ DB_MIGRATE_ERROR: DATABASE_URL not set');
    return false;
  }

  // Log connection details (without credentials)
  try {
    const url = new URL(connectionString.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    const isPooler = url.port === '6543' && 
                    (url.hostname.includes('pooler.supabase.co') || 
                     url.hostname.includes('.pooler.') ||
                     url.hostname.startsWith('aws-'));
    
    safeLog('info', `🔗 DATABASE_HOST: ${url.hostname}:${url.port}`);
    if (isPooler) {
      safeLog('info', '🔗 DB_POOLER: Using connection string with sslmode=require');
    }
  } catch (parseError) {
    safeLog('warn', `⚠️ DATABASE_URL_PARSE_ERROR: ${parseError.message}`);
  }

  // Create client (no SSL options - rely on sslmode=require in connection string)
  const client = new Client({ connectionString });
  let connected = false;
  let migrationsFailed = false;
  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  try {
    // Connect with retry logic
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await client.connect();
        safeLog('info', `✅ DB_MIGRATE: Connected successfully (pooler-optimized)`);
        connected = true;
        break;
      } catch (error) {
        if (error.code === 'ENOTFOUND') {
          safeLog('error', `❌ DATABASE_SANITY_FAILED: DNS resolution failed for host`);
          return false;
        }
        
        if (attempt < maxRetries) {
          const delay = 1000 * attempt;
          safeLog('info', `🔄 DB_RETRY: Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
          await sleep(delay);
        } else {
          safeLog('error', `❌ DB_CONNECT_ERROR: ${error.code || 'UNKNOWN'} - ${error.message}`);
          return false;
        }
      }
    }
    
    if (!connected) {
      safeLog('error', '❌ DB_MIGRATE: Failed to connect after retries');
      return false;
    }
    
    // Create migration tracking table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      safeLog('info', '📊 MIGRATIONS: Created tracking table');
    } catch (tableError) {
      safeLog('warn', `⚠️ MIGRATIONS_TABLE_ERROR: ${tableError.message}`);
      // Continue even if table creation fails
    }
    
    // Get list of applied migrations
    const appliedMigrations = new Set();
    try {
      const { rows } = await client.query('SELECT name FROM _migrations');
      rows.forEach(row => appliedMigrations.add(row.name));
      safeLog('info', `📊 MIGRATIONS: Found ${appliedMigrations.size} previously applied migrations`);
    } catch (queryError) {
      safeLog('warn', `⚠️ MIGRATIONS_QUERY_ERROR: ${queryError.message}`);
      // Continue even if query fails
    }
    
    // Get migration files and sort lexicographically
    const migrationsDir = getMigrationsDir();
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    safeLog('info', `📊 MIGRATIONS: Found ${migrationFiles.length} migration files`);
    
    // Apply migrations
    for (const file of migrationFiles) {
      // Skip if already applied
      if (appliedMigrations.has(file)) {
        safeLog('info', `📊 MIGRATIONS: Skipping ${file} (already applied)`);
        skippedCount++;
        continue;
      }
      
      const filePath = path.join(migrationsDir, file);
      
      try {
        // Read migration SQL
        const sql = fs.readFileSync(filePath, 'utf8');
        safeLog('info', `📊 MIGRATIONS: Executing ${file}...`);
        
        // Wrap in transaction if not already wrapped
        const wrappedSql = sql.trim().toUpperCase().startsWith('BEGIN') ? sql : `BEGIN;\n${sql}\nCOMMIT;`;
        
        // Execute migration
        await client.query(wrappedSql);
        
        // Record successful migration
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        
        safeLog('info', `✅ MIGRATIONS: ${file} completed`);
        appliedCount++;
        
      } catch (migError) {
        // Handle idempotency errors gracefully
        if (
          migError.code === '42710' || // duplicate_object
          migError.code === '23505' || // unique_violation
          migError.message.includes('already exists')
        ) {
          safeLog('info', `📊 MIGRATIONS: ${file} contains already existing objects (idempotent)`);
          
          // Still record it as applied to avoid re-running
          try {
            await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
          } catch (recordError) {
            safeLog('warn', `⚠️ MIGRATIONS_RECORD_ERROR: ${recordError.message}`);
          }
          
          skippedCount++;
        } else {
          safeLog('error', `❌ MIGRATION_ERROR: ${file} failed - ${migError.code || 'UNKNOWN'}: ${migError.message}`);
          if (migError.detail) {
            safeLog('error', `📄 SQL_DETAIL: ${migError.detail}`);
          }
          errorCount++;
          migrationsFailed = true;
        }
      }
    }
    
    // Notify PostgREST to reload schema if available
    try {
      await client.query("NOTIFY pgrst, 'reload schema'");
      safeLog('info', '📡 PGRST: Schema reload requested');
    } catch (notifyErr) {
      safeLog('info', '📡 PGRST: Schema reload skipped (not available)');
    }
    
    // Run smoke test
    try {
      const testResult = await client.query(`
        INSERT INTO api_usage (provider, model, cost_usd, tokens_in, tokens_out)
        VALUES ('test', 'migration-test', 0, 0, 0)
        RETURNING id
      `);
      
      if (testResult.rows && testResult.rows.length > 0) {
        const testId = testResult.rows[0].id;
        await client.query('DELETE FROM api_usage WHERE id = $1', [testId]);
        safeLog('info', '✅ STARTUP_SELF_TEST: api_usage insert/delete successful');
      }
    } catch (testErr) {
      safeLog('warn', `⚠️ STARTUP_SELF_TEST: ${testErr.code || 'UNKNOWN'} - ${testErr.message}`);
      // Don't fail the migration process for smoke test errors
    }
    
    // Log final status
    if (errorCount > 0) {
      safeLog('warn', `⚠️ MIGRATIONS: APPLIED WITH SKIPS (${appliedCount} applied, ${skippedCount} skipped, ${errorCount} errors)`);
    } else {
      safeLog('info', '✅ MIGRATIONS: ALL APPLIED');
      safeLog('info', `📊 MIGRATIONS: ${appliedCount} applied, ${skippedCount} skipped`);
    }
    
    return !migrationsFailed;
    
  } catch (err) {
    safeLog('error', `❌ MIGRATIONS: Failed - ${err.code || 'UNKNOWN'}: ${err.message}`);
    return false;
  } finally {
    if (connected) {
      try {
        await client.end();
      } catch (err) {
        safeLog('warn', `⚠️ DB_CLOSE_ERROR: ${err.message}`);
      }
    }
  }
}

// Run migrations and set exit code
(async () => {
  const success = await runMigrations();
  
  // Mark migrations as run for runtime checks
  if (success) {
    process.env.MIGRATIONS_ALREADY_RAN = 'true';
  }
  
  // Never exit with error - let app start anyway
  process.exit(0);
})();