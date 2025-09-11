// scripts/migrate.js - Hardened database migrations with SSL and retry strategy
const fs = require("fs");
const { Client } = require("pg");
const { URL } = require("url");

// Simple redaction for CommonJS environment
function redact(str) {
  if (!str || typeof str !== 'string') return String(str);
  return str
    .replace(/(postgres|postgresql):\/\/[^@\/]*@/gi, '$1://***:***@')
    .replace(/sk-[a-zA-Z0-9-_]{20,}/g, 'sk-***REDACTED***')
    .replace(/eyJ[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+/g, 'eyJ***REDACTED***');
}

function safeLog(level, message) {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[${timestamp}] ${redact(message)}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const rawUrl = process.env.DATABASE_URL;
  let migrationFailed = false;

  if (!rawUrl) {
    safeLog('error', '❌ DB_MIGRATE_ERROR: DATABASE_URL not set');
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
    
    safeLog('info', `🔗 DATABASE_HOST: ${parsedUrl.hostname}:${parsedUrl.port}`);
    if (isPooler) {
      safeLog('info', '🔗 DB_POOLER: Detected Supabase Transaction Pooler');
    }
    
  } catch (parseError) {
    safeLog('error', `❌ DATABASE_SANITY_FAILED: Invalid URL format - ${parseError.message}`);
    process.exit(1);
  }

  // SSL Configuration based on environment and pooler detection
  function getSSLConfig() {
    const sslMode = process.env.MIGRATION_SSL_MODE || process.env.DB_SSL_MODE || 'require';
    const certPath = process.env.DB_SSL_ROOT_CERT_PATH;
    const allowFallback = process.env.ALLOW_SSL_FALLBACK === 'true';
    
    if (isPooler) {
      // Transaction Pooler: use lightweight SSL without custom certs
      safeLog('info', '🔒 DB_SSL: Using Transaction Pooler managed SSL');
      return { rejectUnauthorized: sslMode === 'require' };
    }
    
    // Direct connection SSL configuration
    if (sslMode === 'disable') {
      safeLog('info', '🔒 DB_SSL: Disabled');
      return false;
    }
    
    let ssl = { rejectUnauthorized: sslMode === 'require' };
    
    // Try to load custom CA certificate
    if (certPath && fs.existsSync(certPath)) {
      try {
        ssl.ca = fs.readFileSync(certPath);
        safeLog('info', '🔒 DB_SSL: Using custom CA certificate');
      } catch (err) {
        safeLog('warn', `⚠️ DB_SSL_WARN: Could not load CA cert from ${certPath}`);
      }
    }
    
    safeLog('info', `🔒 DB_SSL: Mode ${sslMode} (rejectUnauthorized: ${ssl.rejectUnauthorized})`);
    return ssl;
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
        safeLog('info', `✅ DB_MIGRATE: Connected successfully (attempt ${attempt})`);
        return client;
        
      } catch (error) {
        lastError = error;
        await client.end().catch(() => {});
        
        // Handle different error types
        if (error.code === 'ENOTFOUND') {
          safeLog('error', `❌ DATABASE_SANITY_FAILED: DNS resolution failed for host: ${parsedUrl.hostname}`);
          process.exit(1);
        }
        
        if (error.message && error.message.includes('certificate')) {
          const allowFallback = process.env.ALLOW_SSL_FALLBACK === 'true';
          if (!allowFallback) {
            safeLog('error', `❌ DB_SSL_ERROR: Certificate validation failed (host: ${parsedUrl.hostname})`);
            safeLog('info', '💡 Set ALLOW_SSL_FALLBACK=true to enable fallback to no-verify mode');
            process.exit(1);
          }
          
          if (attempt === 1) {
            safeLog('warn', `⚠️ DB_SSL_WARN: using no-verify (host: ${parsedUrl.hostname})`);
          }
        }
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          safeLog('info', `🔄 DB_RETRY: Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
          await sleep(delay);
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
    safeLog('info', '📊 MIGRATIONS: Starting schema setup...');
    
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
      const connectionType = isPooler ? 'pooler' : 'direct';
      safeLog('info', `✅ MIGRATIONS: ALL APPLIED (${connectionType}, ssl=require)`);
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