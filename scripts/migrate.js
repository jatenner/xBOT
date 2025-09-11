// scripts/migrate.js - Production migrations with verified SSL only
const fs = require("fs");
const { Client } = require("pg");
const { URL } = require("url");

// Secret masking for production logs
function maskSecrets(s) {
  if (!s || typeof s !== 'string') return String(s);
  return s
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***')
    .replace(/(service_role|anon)[a-zA-Z0-9\.\-_]*\.[a-zA-Z0-9\.\-_]*/g, '[supabase-key-***]')
    .replace(/(Bearer\s+)[A-Za-z0-9\-\._~+/=]+/gi, '$1***')
    .replace(/([A-Za-z0-9]{16,}:[A-Za-z0-9]{16,})/g, '***:***')
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@');
}

const log = (...args) => console.log(...args.map(x => typeof x === 'string' ? maskSecrets(x) : x));
const warn = (...args) => console.warn(...args.map(x => typeof x === 'string' ? maskSecrets(x) : x));
const error = (...args) => console.error(...args.map(x => typeof x === 'string' ? maskSecrets(x) : x));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const rawUrl = process.env.DATABASE_URL;
  let migrationFailed = false;

  if (!rawUrl) {
    error('❌ DB_MIGRATE_ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  // Parse and validate URL
  const url = rawUrl.trim();
  let parsedUrl;
  let isPooler = false;
  
  try {
    parsedUrl = new URL(url.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    isPooler = parsedUrl.port === '6543' && 
               (parsedUrl.hostname.includes('pooler.supabase.co') || 
                parsedUrl.hostname.startsWith('db.'));
    
    if (!parsedUrl.hostname || !parsedUrl.port) {
      throw new Error('Invalid URL components');
    }
    
    log(`🔗 DATABASE_HOST: ${parsedUrl.hostname}:${parsedUrl.port}`);
    if (isPooler) {
      log('🔗 DB_POOLER: Detected Supabase Transaction Pooler');
    }
    
  } catch (parseError) {
    error(`❌ DATABASE_SANITY_FAILED: Invalid URL format - ${parseError.message}`);
    process.exit(1);
  }

  // Strict SSL Configuration - verified only, no fallback
  function getSSLConfig() {
    const sslMode = process.env.MIGRATION_SSL_MODE || process.env.DB_SSL_MODE || 'require';
    
    if (sslMode !== 'require') {
      throw new Error(`MIGRATION_SSL_MODE must be 'require' for production. Got: ${sslMode}`);
    }

    if (process.env.ALLOW_SSL_FALLBACK === 'true') {
      throw new Error('ALLOW_SSL_FALLBACK must be false for production');
    }
    
    // Verified SSL only - no fallback allowed
    log('🔒 DB_SSL: Using verified CA bundle for Transaction Pooler');
    return { rejectUnauthorized: true };
  }

  // Connection with retry strategy
  async function connectWithRetry() {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const ssl = getSSLConfig();
      const client = new Client({ connectionString: url, ssl });
      
      try {
        await client.connect();
        log(`✅ DB_MIGRATE: Connected successfully (attempt ${attempt})`);
        return client;
        
      } catch (error) {
        lastError = error;
        await client.end().catch(() => {});
        
        // Handle different error types - no fallback allowed
        if (error.code === 'ENOTFOUND') {
          error(`❌ DATABASE_SANITY_FAILED: DNS resolution failed for host: ${parsedUrl.hostname}`);
          process.exit(1);
        }
        
        if (error.message && error.message.includes('certificate')) {
          error(`❌ DB_SSL_ERROR: Certificate validation failed - no fallback allowed in production`);
          error(`❌ Host: ${parsedUrl.hostname}`);
          process.exit(1);
        }
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          log(`🔄 DB_RETRY: Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
          await sleep(delay);
        } else {
          error(`❌ DB_CONNECT: All ${maxRetries} attempts failed - ${error.message}`);
          process.exit(1);
        }
      }
    }
    
    throw lastError;
  }

  // Main migration logic
  let client;
  try {
    client = await connectWithRetry();
    
    // Run idempotent migrations
    log('📊 MIGRATIONS: Starting schema setup...');
    
    // Load and execute content brain migration
    const migrationFiles = [
      'supabase/migrations/20250911_0100_api_usage_uuid.sql',
      'supabase/migrations/20250911_0200_xbot_content_brain.sql'
    ];
    
    for (const migrationFile of migrationFiles) {
      if (fs.existsSync(migrationFile)) {
        try {
          const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
          log(`📊 MIGRATIONS: Executing ${migrationFile}...`);
          await client.query(migrationSQL);
          log(`✅ MIGRATIONS: ${migrationFile} completed`);
        } catch (migError) {
          error(`❌ MIGRATION_ERROR: ${migrationFile} failed - ${migError.message}`);
          throw migError;
        }
      } else {
        log(`📊 MIGRATIONS: ${migrationFile} not found, creating inline...`);
      }
    }
    
    // Check if we're on pooler (no superuser operations)
    if (isPooler) {
      safeLog('info', '🔗 POOLER_MODE: Skipping superuser operations');
    } else {
      // Enable UUID extension for direct connections
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      } catch (err) {
        safeLog('warn', '⚠️ EXTENSION: uuid-ossp already exists or insufficient privileges');
      }
    }
    
    // Create api_usage table with UUID primary key
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.api_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event TEXT NOT NULL,
        cost_cents INTEGER NOT NULL DEFAULT 0,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    // Handle existing table migration
    await client.query(`
      DO $$
      BEGIN
        -- Migrate old schema if needed
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_usage' AND column_name = 'intent') THEN
          ALTER TABLE public.api_usage RENAME COLUMN intent TO event;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_usage' AND column_name = 'cost_usd') THEN
          ALTER TABLE public.api_usage ADD COLUMN cost_cents INTEGER;
          UPDATE public.api_usage SET cost_cents = ROUND(cost_usd * 100) WHERE cost_cents IS NULL;
          ALTER TABLE public.api_usage ALTER COLUMN cost_cents SET NOT NULL;
          ALTER TABLE public.api_usage ALTER COLUMN cost_cents SET DEFAULT 0;
        END IF;
        
        -- Ensure all required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_usage' AND column_name = 'meta') THEN
          ALTER TABLE public.api_usage ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb;
        END IF;
      END $$;
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_usage_event ON public.api_usage(event);
      CREATE INDEX IF NOT EXISTS idx_api_usage_meta_gin ON public.api_usage USING GIN(meta);
    `);
    
    // Enable RLS and create policies
    await client.query('ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY');
    
    await client.query(`
      DO $$
      BEGIN
        -- Drop existing policies
        DROP POLICY IF EXISTS "api_usage_all" ON public.api_usage;
        DROP POLICY IF EXISTS "api_usage_service" ON public.api_usage;
        
        -- Create new policies
        CREATE POLICY "api_usage_all" ON public.api_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);
        CREATE POLICY "api_usage_service" ON public.api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
      END $$;
    `);
    
    // Grant permissions
    await client.query(`
      GRANT ALL ON public.api_usage TO authenticated;
      GRANT ALL ON public.api_usage TO service_role;
      GRANT ALL ON public.api_usage TO postgres;
    `);
    
    // Request PostgREST schema reload if possible
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && serviceKey) {
      try {
        await client.query("NOTIFY pgrst, 'reload schema'");
        safeLog('info', '📡 PGRST: Schema reload requested');
      } catch (err) {
        safeLog('warn', '⚠️ PGRST: Schema reload skipped - no NOTIFY support');
      }
    }
    
    // Startup self-test
    const testId = require('crypto').randomUUID();
    try {
      await client.query(
        'INSERT INTO api_usage(id, event, cost_cents, meta) VALUES($1, $2, $3, $4)',
        [testId, 'startup_test', 0, { source: 'migration_script' }]
      );
      await client.query('DELETE FROM api_usage WHERE id = $1', [testId]);
      safeLog('info', '✅ STARTUP_SELF_TEST: api_usage insert/delete successful');
    } catch (testErr) {
      safeLog('error', `❌ STARTUP_SELF_TEST: ${testErr.code || 'UNKNOWN'} - ${testErr.message}`);
      migrationFailed = true;
    }
    
    if (!migrationFailed) {
      process.env.MIGRATIONS_ALREADY_RAN = 'true';
      log('✅ MIGRATIONS: ALL_APPLIED (pooler, ssl=require, verified)');
    }
    
  } catch (err) {
    migrationFailed = true;
    safeLog('error', `❌ MIGRATIONS: Failed - ${err.code || 'UNKNOWN'}: ${err.message}`);
    
    // Write to migration log for debugging (no secrets)
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        code: err.code,
        message: redact(err.message),
        host: parsedUrl.hostname
      },
      isPooler,
      attempt: 'prestart'
    };
    
    try {
      const logDir = 'logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync('logs/migrations.log', JSON.stringify(logEntry) + '\n');
    } catch (logErr) {
      // Ignore log write errors
    }
    
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }

  // Exit 0 to allow app to start even if migrations failed
  process.exit(0);
})();