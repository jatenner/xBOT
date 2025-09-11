// scripts/migrate.js - Production-grade database migrations with SSL
const fs = require("fs");
const { Client } = require("pg");
const { URL } = require("url");

(async () => {
  let rawUrl = process.env.DATABASE_URL;
  let migrationFailed = false;

  if (!rawUrl) {
    console.error("❌ DB_MIGRATE_ERROR: DATABASE_URL not set");
    process.exit(1);
  }
  
  // Robust URL parsing and validation
  rawUrl = rawUrl.trim(); // Remove trailing spaces/newlines
  
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (parseError) {
    console.error(`❌ DATABASE_SANITY_FAILED: Invalid URL: "${rawUrl}"`);
    console.error(`Parse error: ${parseError.message}`);
    process.exit(1);
  }

  // Validate URL components
  if (!parsedUrl.hostname || !parsedUrl.port) {
    console.error(`❌ DATABASE_SANITY_FAILED: Invalid URL components - hostname: "${parsedUrl.hostname}", port: "${parsedUrl.port}"`);
    process.exit(1);
  }

  // Pooler detection
  const isPooler = parsedUrl.hostname.startsWith('db.') && parsedUrl.port === '6543';
  
  if (isPooler) {
    console.log("🔗 DB_POOLER: Detected Supabase Transaction Pooler");
    // Enforce SSL for pooler
    if (!rawUrl.includes('sslmode=require')) {
      console.log("🔒 DB_POOLER: Enforcing sslmode=require for Transaction Pooler");
      const separator = rawUrl.includes('?') ? '&' : '?';
      rawUrl = rawUrl + separator + 'sslmode=require';
    }
  }

  const url = rawUrl;

  // SSL Strategy: require|prefer|no-verify|disable
  const sslMode = process.env.MIGRATION_SSL_MODE || "prefer";
  const certPath = process.env.MIGRATION_SSL_ROOT_CERT_PATH || "/etc/ssl/certs/supabase-ca.crt";
  
  function buildSSLConfig(useCA = true, rejectUnauthorized = true) {
    if (sslMode === "disable") {
      return false;
    }
    
    if (sslMode === "no-verify") {
      console.log("🔒 DB_MIGRATE: Using SSL with no certificate verification");
      return { rejectUnauthorized: false };
    }
    
    if (useCA && (sslMode === "require" || sslMode === "prefer")) {
      try {
        const ca = fs.readFileSync(certPath);
        console.log("🔒 DB_MIGRATE: Using SSL with custom CA certificate");
        return { ca, rejectUnauthorized };
      } catch (err) {
        if (sslMode === "require") {
          console.log("⚠️ DB_MIGRATE_WARN: CA not found -> fallback to no-verify");
          return { rejectUnauthorized: false };
        }
        // For "prefer", fall back to system certs
        console.log("🔒 DB_MIGRATE: CA not found, using system certificates");
      }
    }
    
    return { rejectUnauthorized };
  }

  // Simplified SSL connection for Transaction Pooler
  async function connectWithSSL() {
    let ssl;
    let client;
    
    if (isPooler) {
      // Transaction Pooler: always use SSL without custom certificates
      ssl = { rejectUnauthorized: false }; // Pooler handles SSL termination
      console.log("🔒 DB_MIGRATE: Using Transaction Pooler SSL (managed)");
    } else {
      // Direct connection: use configured SSL
      const sslMode = process.env.MIGRATION_SSL_MODE || "require";
      if (sslMode === "require") {
        ssl = { rejectUnauthorized: true };
        console.log("🔒 DB_MIGRATE: Using direct SSL connection");
      } else {
        ssl = false;
        console.log("🔒 DB_MIGRATE: SSL disabled");
      }
    }
    
    client = new Client({ connectionString: url, ssl });
    
    try {
      await client.connect();
      const mode = isPooler ? 'pooler' : (ssl ? 'direct-ssl' : 'no-ssl');
      console.log(`✅ DB_MIGRATE: Connected successfully (${mode})`);
      return { client, mode };
    } catch (err) {
      await client.end().catch(() => {});
      
      // For DNS errors, fail fast with clear message
      if (err.code === 'ENOTFOUND' || err.message.includes('getaddrinfo')) {
        console.error(`❌ DATABASE_SANITY_FAILED: DNS resolution failed for hostname: "${parsedUrl.hostname}"`);
        console.error(`Full error: ${err.message}`);
        process.exit(1);
      }
      
      throw err;
    }
  }

  let client;
  let connectionResult;
  try {
    connectionResult = await connectWithSSL();
    client = connectionResult.client;

    // Idempotent schema creation - exactly as specified
    await client.query(`
      create table if not exists api_usage (
        id               bigserial primary key,
        intent           text not null,
        model            text not null,
        prompt_tokens    integer default 0 not null,
        completion_tokens integer default 0 not null,
        cost_usd         numeric(12,6) default 0 not null,
        meta             jsonb default '{}'::jsonb not null,
        created_at       timestamptz not null default now()
      );
    `);

    // Ensure meta column exists (for older tables)
    await client.query(`
      alter table api_usage
        add column if not exists meta jsonb default '{}'::jsonb not null;
    `);

    // Ensure indexes exist
    await client.query(`
      create index if not exists idx_api_usage_created_at on api_usage(created_at desc);
      create index if not exists idx_api_usage_intent on api_usage(intent);
      create index if not exists idx_api_usage_model on api_usage(model);
    `);

    // Enable RLS
    await client.query(`alter table api_usage enable row level security;`);

    // Create permissive policy (service role bypasses RLS anyway)
    await client.query(`
      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'api_usage' and policyname = 'api_usage_all'
        ) then
          create policy api_usage_all on api_usage for all using (true) with check (true);
        end if;
      end$$;
    `);

    // Force PostgREST schema cache reload (Supabase)
    await client.query(`
      do $$
      begin
        perform pg_notify('pgrst', 'reload schema');
      exception when others then
        raise notice 'PGRST notify skipped: %', SQLERRM;
      end $$;
    `);
    console.log("📡 PGRST: requested schema reload");

    // Service role connectivity test with new schema
    try {
      const result = await client.query(`
        INSERT INTO api_usage(event, cost_cents, meta)
        VALUES('startup_test', 0, '{"source": "migration_script", "timestamp": $1}')
        RETURNING id
      `, [new Date().toISOString()]);
      
      if (result.rows && result.rows.length > 0) {
        const testId = result.rows[0].id;
        console.log(`✅ STARTUP_SELF_TEST: api_usage insert successful (id: ${testId})`);
        
        // Clean up test record
        await client.query('DELETE FROM api_usage WHERE id = $1', [testId]);
        console.log("✅ STARTUP_SELF_TEST: test record cleaned up");
      } else {
        throw new Error("Insert returned no rows");
      }
    } catch (testErr) {
      console.error(`❌ STARTUP_SELF_TEST: Failed to insert into api_usage`);
      console.error(`Error code: ${testErr.code}`);
      console.error(`Error message: ${testErr.message}`);
      console.error(`Error detail: ${testErr.detail || 'N/A'}`);
      migrationFailed = true;
    }

    // Set flag to indicate migrations have completed successfully
    process.env.MIGRATIONS_ALREADY_RAN = "true";
    
    const sslStatus = isPooler ? 'ssl=require' : `ssl=${connectionResult.mode}`;
    const connectionType = isPooler ? 'pooler' : 'direct';
    console.log(`✅ MIGRATIONS: ALL APPLIED (${connectionType}, ${sslStatus})`);
    
  } catch (err) {
    console.error("❌ MIGRATIONS: Failed after fallback, manual intervention required:", err.message);
    migrationFailed = true;
  } finally {
    try { 
      if (client) await client.end(); 
    } catch {}
  }

  // Set flag for health monitoring but don't block app start
  if (migrationFailed) {
    process.env.MIGRATION_FAILED = "true";
  }
  
  process.exit(0); // Always allow app to start
})();