// scripts/migrate.js - Production migrations with verified SSL for Supabase Transaction Pooler
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { URL } = require("url");

// Local logger helper for migration scripts
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

(async () => {
  const rawUrl = process.env.DATABASE_URL;
  let migrationFailed = false;

  if (!rawUrl) {
    safeLog('error', '❌ DB_MIGRATE_ERROR: DATABASE_URL not set');
    process.exitCode = 1; // Exit non-zero on migration failure
    return;
  }

  // Parse and validate URL
  const url = rawUrl.trim();
  let parsedUrl;
  let isPooler = false;
  
  try {
    parsedUrl = new URL(url.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    isPooler = parsedUrl.port === '6543' && 
               (parsedUrl.hostname.includes('pooler.supabase.co') || 
                parsedUrl.hostname.includes('.pooler.') ||
                parsedUrl.hostname.startsWith('aws-'));
    
    if (!parsedUrl.hostname || !parsedUrl.port) {
      throw new Error('Invalid URL components');
    }
    
    safeLog('info', `🔗 DATABASE_HOST: ${parsedUrl.hostname}:${parsedUrl.port}`);
    if (isPooler) {
      safeLog('info', '🔗 DB_POOLER: Detected Supabase Transaction Pooler');
    }
    
  } catch (parseError) {
    safeLog('error', `❌ DATABASE_SANITY_FAILED: Invalid URL format - ${parseError.message}`);
    process.exitCode = 1; // Exit non-zero on migration failure
    return;
  }

  // SSL Configuration - Connection string only with verified TLS
  function getSSLConfig() {
    if (isPooler) {
      safeLog('info', '🔒 DB_SSL: Using verified SSL for Supabase Transaction Pooler (pooler-optimized)');
    } else {
      safeLog('info', '🔒 DB_SSL: Using verified SSL for direct connection');
    }
    
    // Use system CA bundle - let Node.js handle certificate validation
    return { rejectUnauthorized: true };
  }

  // Connection with SSL and retry strategy
  async function connectWithSSL() {
    const maxRetries = 3;
    let lastError;
    const ssl = getSSLConfig();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const client = new Client({ connectionString: url, ssl });
      
      try {
        await client.connect();
        const sslMode = isPooler ? 'pooler-optimized' : 'verified';
        safeLog('info', `✅ DB_MIGRATE: Connected successfully (${sslMode}, attempt ${attempt})`);
        return { client, sslMode };
        
      } catch (error) {
        lastError = error;
        await client.end().catch(() => {});
        
        // Handle certificate errors
        if (error.message && error.message.includes('certificate')) {
          safeLog('warn', `⚠️ DB_SSL_CERTIFICATE_ERROR: ${error.message} (host: ${parsedUrl.hostname})`);
        }
        
        // DNS failures are immediate
        if (error.code === 'ENOTFOUND') {
          safeLog('error', `❌ DATABASE_SANITY_FAILED: DNS resolution failed for host: ${parsedUrl.hostname}`);
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = 1000 * attempt;
          safeLog('info', `🔄 DB_RETRY: Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
          await sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  // Resolve migration directory from repository root
  function getMigrationsDir() {
    // Always resolve from repository root, regardless of where script is run from
    const repoRoot = path.resolve(__dirname, '..');
    const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      safeLog('warn', `📊 MIGRATIONS: Directory not found at ${migrationsDir}, creating...`);
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    return migrationsDir;
  }

  // Main migration logic
  let client;
  let sslMode = 'unknown';
  
  try {
    const result = await connectWithSSL();
    client = result.client;
    sslMode = result.sslMode;
    
    // Start migration process
    safeLog('info', '📊 MIGRATIONS: Starting schema setup...');
    
    // Get migrations directory and files
    const migrationsDir = getMigrationsDir();
    const migrationFiles = [
      path.join(migrationsDir, '20250911_0100_api_usage_uuid.sql'),
      path.join(migrationsDir, '20250911_0200_xbot_content_brain.sql')
    ];
    
    let executedCount = 0;
    
    for (const migrationFile of migrationFiles) {
      if (fs.existsSync(migrationFile)) {
        try {
          const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
          const fileName = path.basename(migrationFile);
          safeLog('info', `📊 MIGRATIONS: Executing ${fileName}...`);
          await client.query(migrationSQL);
          safeLog('info', `✅ MIGRATIONS: ${fileName} completed`);
          executedCount++;
        } catch (migError) {
          const fileName = path.basename(migrationFile);
          safeLog('error', `❌ MIGRATION_ERROR: ${fileName} failed - ${migError.message}`);
          if (migError.detail) {
            safeLog('error', `📄 SQL_DETAIL: ${migError.detail}`);
          }
          throw migError;
        }
      } else {
        const fileName = path.basename(migrationFile);
        safeLog('info', `📊 MIGRATIONS: ${fileName} not found, skipping...`);
      }
    }
    
    // PostgREST schema reload if possible
    try {
      await client.query("NOTIFY pgrst, 'reload schema'");
      safeLog('info', '📡 PGRST: Schema reload requested');
    } catch (notifyErr) {
      safeLog('info', '📡 PGRST: Schema reload skipped (not available)');
    }
    
    // Service role connectivity test with new schema
    try {
      const testResult = await client.query(`
        INSERT INTO api_usage(model, tokens, cost)
        VALUES('migration_test', 0, 0)
        RETURNING id
      `);
      
      if (testResult.rows && testResult.rows.length > 0) {
        const testId = testResult.rows[0].id;
        await client.query('DELETE FROM api_usage WHERE id = $1', [testId]);
        safeLog('info', '✅ STARTUP_SELF_TEST: api_usage insert/delete successful');
      }
    } catch (testErr) {
      safeLog('error', `❌ STARTUP_SELF_TEST: ${testErr.code || 'UNKNOWN'} - ${testErr.message}`);
      migrationFailed = true;
    }
    
    if (!migrationFailed) {
      process.env.MIGRATIONS_ALREADY_RAN = 'true';
      safeLog('info', `✅ MIGRATIONS: ALL APPLIED (pooler, ssl=${sslMode})`);
      safeLog('info', `📊 MIGRATIONS: Executed ${executedCount} migration files successfully`);
    }
    
  } catch (err) {
    migrationFailed = true;
    safeLog('error', `❌ MIGRATIONS: Failed - ${err.code || 'UNKNOWN'}: ${err.message}`);
    
    // Write failure details for debugging (no secrets)
    const errorDetails = {
      timestamp: new Date().toISOString(),
      error: {
        code: err.code,
        message: err.message,
        host: parsedUrl?.hostname
      },
      isPooler,
      sslMode,
      phase: 'prestart'
    };
    
    try {
      const logDir = path.resolve(__dirname, '..', 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'migration-errors.log'), JSON.stringify(errorDetails) + '\n');
    } catch (logErr) {
      // Ignore log write errors
    }
    
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (err) {
        safeLog('warn', `⚠️ DB_CLOSE_ERROR: ${err.message}`);
      }
    }
  }

  // Exit with appropriate code
  process.exitCode = migrationFailed ? 1 : 0;
  
  if (migrationFailed) {
    safeLog('error', '❌ PRESTART_MIGRATION: Failed - check logs for details');
  }
})();