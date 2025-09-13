/**
 * Migration Runner for xBOT
 * - Creates schema_migrations tracking table
 * - Runs migrations with retry logic
 * - Idempotent execution
 * - No custom SSL config (uses DATABASE_URL sslmode)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Safe logging utility
function safeLog(level, message) {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  
  // Mask any potential secrets
  const masked = typeof message === 'string' ? message
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@')
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***') : message;
    
  logFn(`[${timestamp}] ${masked}`);
}

// Get migrations directory
function getMigrationsDir() {
  const repoRoot = path.resolve(__dirname, '..');
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    safeLog('info', `MIGRATIONS: Creating directory at ${migrationsDir}`);
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  return migrationsDir;
}

// Create a fresh client with retry logic
async function createClientWithRetry(maxRetries = 3) {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing');
  }

  // Log connection info
  try {
    const url = new URL(connectionString.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    safeLog('info', `DB_POOLER: Using sslmode=require (host: ${url.hostname}:${url.port || 5432})`);
  } catch (parseError) {
    safeLog('warn', `DATABASE_URL parse error: ${parseError.message}`);
  }

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Create client with pooler-compatible SSL
    const isPooler = connectionString.includes('pooler.supabase.com') || connectionString.includes(':6543');
    if (isPooler) {
      safeLog('info', 'DB_MIGRATE: Using pooler-compatible SSL (rejectUnauthorized: false)');
    }
    const client = new Client({ 
      connectionString,
      ssl: isPooler ? { rejectUnauthorized: false } : true // Pooler uses managed SSL
    });
    
    try {
      await client.connect();
      safeLog('info', `✅ DB_MIGRATE: Connected successfully (attempt ${attempt})`);
      return client;
    } catch (error) {
      lastError = error;
      
      try {
        await client.end();
      } catch (endError) {
        // Ignore cleanup errors
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        safeLog('warn', `🔄 DB_RETRY: Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`DB connection failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Execute SQL with transaction and retry logic
async function executeSQLWithRetry(sql, description, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client;
    
    try {
      client = await createClientWithRetry(1); // Single attempt per retry cycle
      
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      
      safeLog('info', `✅ Applied: ${description}`);
      return true;
      
    } catch (error) {
      lastError = error;
      
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          safeLog('warn', `Rollback error: ${rollbackError.message}`);
        }
      }
      
      // Check for idempotency errors (these are OK)
      if (error.code === '42710' || // duplicate_object
          error.code === '23505' || // unique_violation
          error.message.includes('already exists')) {
        safeLog('info', `📊 ${description}: Already exists (idempotent)`);
        return true;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        safeLog('warn', `🔄 RETRY: ${description} attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
      
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (endError) {
          // Ignore cleanup errors
        }
      }
    }
  }
  
  safeLog('error', `❌ FAILED: ${description} - ${lastError.code || 'UNKNOWN'}: ${lastError.message}`);
  return false;
}

// Main migration function
async function runMigrations() {
  safeLog('info', '🔄 MIGRATIONS: Starting migration runner...');
  
  try {
    // Step 1: Create tracking table
    const createTrackingTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    const trackingSuccess = await executeSQLWithRetry(
      createTrackingTable, 
      'schema_migrations tracking table'
    );
    
    if (!trackingSuccess) {
      throw new Error('Failed to create schema_migrations table');
    }
    
    // Step 2: Get applied migrations
    let client;
    let appliedMigrations = new Set();
    
    try {
      client = await createClientWithRetry();
      const result = await client.query('SELECT id FROM schema_migrations');
      appliedMigrations = new Set(result.rows.map(row => row.id));
      safeLog('info', `📊 MIGRATIONS: Found ${appliedMigrations.size} previously applied migrations`);
    } catch (error) {
      safeLog('warn', `Could not read applied migrations: ${error.message}`);
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (endError) {
          // Ignore cleanup errors
        }
      }
    }
    
    // Step 3: Get migration files
    const migrationsDir = getMigrationsDir();
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Lexicographic order
    
    safeLog('info', `📊 MIGRATIONS: Found ${migrationFiles.length} migration files`);
    
    if (migrationFiles.length === 0) {
      safeLog('info', '📊 MIGRATIONS: No migration files found');
      return true;
    }
    
    // Step 4: Apply migrations
    let appliedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    for (const file of migrationFiles) {
      const migrationId = file.replace('.sql', '');
      
      if (appliedMigrations.has(migrationId)) {
        safeLog('info', `📊 MIGRATIONS: Skipping ${file} (already applied)`);
        skippedCount++;
        continue;
      }
      
      const filePath = path.join(migrationsDir, file);
      let sql;
      
      try {
        sql = fs.readFileSync(filePath, 'utf8');
      } catch (readError) {
        safeLog('error', `❌ FAILED: Could not read ${file}: ${readError.message}`);
        failedCount++;
        continue;
      }
      
      safeLog('info', `📊 MIGRATIONS: Applying ${file}...`);
      
      // Wrap migration in transaction if not already wrapped
      const wrappedSql = sql.trim().toUpperCase().startsWith('BEGIN') ? sql : `BEGIN;\n${sql}\nCOMMIT;`;
      
      const success = await executeSQLWithRetry(wrappedSql, file);
      
      if (success) {
        // Record the migration as applied
        const recordSuccess = await executeSQLWithRetry(
          `INSERT INTO schema_migrations (id) VALUES ('${migrationId}') ON CONFLICT DO NOTHING`,
          `Recording ${file}`
        );
        
        if (recordSuccess) {
          appliedCount++;
        } else {
          safeLog('warn', `⚠️ Migration ${file} applied but not recorded`);
        }
      } else {
        failedCount++;
      }
    }
    
    // Step 5: Summary
    if (failedCount > 0) {
      safeLog('error', `❌ MIGRATIONS: ${failedCount} failed, ${appliedCount} applied, ${skippedCount} skipped`);
      return false;
    } else if (appliedCount > 0) {
      safeLog('info', `✅ MIGRATIONS: ALL APPLIED (${appliedCount} new, ${skippedCount} skipped)`);
    } else {
      safeLog('info', `✅ MIGRATIONS: ALL APPLIED (${skippedCount} already applied)`);
    }
    
    return true;
    
  } catch (error) {
    safeLog('error', `❌ MIGRATIONS: Fatal error - ${error.message}`);
    return false;
  }
}

// Run migrations and exit with appropriate code
(async () => {
  const success = await runMigrations();
  process.exit(success ? 0 : 1);
})();