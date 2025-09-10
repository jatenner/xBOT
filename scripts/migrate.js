// scripts/migrate.js
// Automatic Database Migration Runner with SSL support
const fs = require('fs');
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DB_MIGRATE_WARN: No DATABASE_URL set; skipping migrations');
    process.exit(0);
  }

  const ssl =
    process.env.MIGRATION_SSL_MODE === 'require'
      ? {
          ca: fs.readFileSync(process.env.MIGRATION_SSL_ROOT_CERT_PATH),
          rejectUnauthorized: true,
        }
      : false;

  const client = new Client({ connectionString: url, ssl });

  try {
    await client.connect();
    console.log('✅ DB_MIGRATE: Connected successfully with SSL');

    // --- Minimal idempotent migration for api_usage table ---
    await client.query(`
      create table if not exists api_usage (
        id bigserial primary key,
        intent text not null,
        model text not null,
        prompt_tokens integer default 0 not null,
        completion_tokens integer default 0 not null,
        total_tokens integer generated always as (prompt_tokens + completion_tokens) stored,
        cost_usd decimal(10,6) not null,
        meta jsonb default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    `);

    // Create indexes if they don't exist
    await client.query(`
      create index if not exists idx_api_usage_created_at on api_usage(created_at desc);
      create index if not exists idx_api_usage_intent on api_usage(intent);
      create index if not exists idx_api_usage_cost on api_usage(cost_usd);
    `);

    // Enable Row Level Security if not already enabled
    await client.query(`
      alter table api_usage enable row level security;
    `);

    // Create policy for authenticated users (service role bypasses RLS)
    await client.query(`
      drop policy if exists "insert_api_usage" on api_usage;
      create policy "insert_api_usage" on api_usage
        for insert to authenticated with check (true);
    `);

    await client.query(`
      drop policy if exists "select_api_usage" on api_usage;  
      create policy "select_api_usage" on api_usage
        for select to authenticated using (true);
    `);

    // Grant necessary permissions
    await client.query(`
      grant insert, select on api_usage to authenticated;
      grant usage on sequence api_usage_id_seq to authenticated;
    `);

    console.log('✅ MIGRATIONS: completed successfully (api_usage table ready)');
    process.exit(0);
  } catch (err) {
    console.warn('DB_MIGRATE_WARN:', err?.message || err);
    console.warn('DB_MIGRATE_HINT: Check DATABASE_URL, SSL mode, and CA path.');
    process.exit(0); // don't block boot, just warn
  } finally {
    try { await client.end(); } catch {}
  }
})();