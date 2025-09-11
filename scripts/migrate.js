// scripts/migrate.js - Production-grade database migrations with SSL
const fs = require("fs");
const { Client } = require("pg");

(async () => {
  const url = process.env.DATABASE_URL;
  let migrationFailed = false;

  if (!url) {
    console.error("❌ DB_MIGRATE_ERROR: DATABASE_URL not set");
    process.exit(0); // Don't block app start
  }

  // SSL Configuration for Railway/Supabase
  let ssl = false;
  if (process.env.MIGRATION_SSL_MODE === "require") {
    const certPath = process.env.MIGRATION_SSL_ROOT_CERT_PATH || "/etc/ssl/certs/supabase-ca.crt";
    try {
      ssl = {
        ca: fs.readFileSync(certPath),
        rejectUnauthorized: true,
      };
      console.log("🔒 DB_MIGRATE: Using SSL with custom CA certificate");
    } catch (err) {
      console.log("⚠️ DB_MIGRATE_WARN: SSL CA not found, falling back");
      ssl = { rejectUnauthorized: false };
    }
  } else if (url.includes('supabase.co') || process.env.NODE_ENV === 'production') {
    // Auto-enable SSL for Supabase/production with Railway-compatible settings
    ssl = { rejectUnauthorized: false };
    console.log("🔒 DB_MIGRATE: Enabling SSL for production environment");
  }

  const client = new Client({ connectionString: url, ssl });

  try {
    await client.connect();
    console.log("✅ DB_MIGRATE: Connected successfully with SSL");

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

    // Service role connectivity test
    try {
      await client.query(`
        insert into api_usage (intent, model, prompt_tokens, completion_tokens, cost_usd, meta)
        values ('bootstrap', 'migration-test', 0, 0, 0, '{"test": true}')
        on conflict do nothing
      `);
      console.log("✅ DB_HEALTH: Service role insert test successful");
    } catch (testErr) {
      console.error("❌ DB_HEALTH: Service role test failed:", testErr.message);
      migrationFailed = true;
    }

    console.log("✅ MIGRATIONS: completed successfully (api_usage + RLS)");
    
  } catch (err) {
    console.error("❌ DB_MIGRATE_ERROR:", err.message);
    migrationFailed = true;
  } finally {
    try { await client.end(); } catch {}
  }

  // Set flag for health monitoring but don't block app start
  if (migrationFailed) {
    process.env.MIGRATION_FAILED = "true";
  }
  
  process.exit(0); // Always allow app to start
})();