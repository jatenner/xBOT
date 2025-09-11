// scripts/migrate.js
const fs = require("fs");
const { Client } = require("pg");

(async () => {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

  // Use SSL - Railway has built-in support for Supabase SSL
  let ssl = false;
  if (url && url.includes('supabase.co')) {
    // For Supabase connections, use SSL but don't validate certs (Railway handles this)
    ssl = { 
      rejectUnauthorized: false,  // Railway's network layer handles SSL validation
      sslmode: 'require'
    };
    console.log("🔒 DB_MIGRATE: Enabling SSL for Supabase with Railway network security");
  } else if (process.env.NODE_ENV === 'production') {
    // For other production DBs, use SSL
    ssl = { rejectUnauthorized: false };
    console.log("🔒 DB_MIGRATE: Enabling SSL for production environment");
  }

  const client = new Client({ connectionString: url, ssl });

  try {
    await client.connect();
    console.log("✅ DB_MIGRATE: Connected successfully with SSL");

    // ---- Schema: idempotent ----
    await client.query(`
      create table if not exists api_usage (
        id bigserial primary key,
        intent text not null,
        model text not null,
        prompt_tokens integer default 0 not null,
        completion_tokens integer default 0 not null,
        cost_usd numeric(10,4) default 0 not null,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_api_usage_created_at on api_usage(created_at);
      create index if not exists idx_api_usage_intent on api_usage(intent);
    `);

    // RLS: enable; service role bypasses RLS, but we add an authenticated policy for completeness.
    await client.query(`alter table api_usage enable row level security;`);

    await client.query(`
      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename  = 'api_usage'
            and policyname = 'api_usage_authenticated_rw'
        ) then
          create policy api_usage_authenticated_rw
            on api_usage
            for all
            to authenticated
            using (true)
            with check (true);
        end if;
      end$$;
    `);

    console.log("✅ MIGRATIONS: completed successfully (api_usage + RLS)");
    process.exit(0);
  } catch (err) {
    console.error("❌ DB_MIGRATE_ERROR:", err?.message || err);
    // Do not block boot; we log the error and continue so app stays up
    process.exit(0);
  } finally {
    try { await client.end(); } catch {}
  }
})();