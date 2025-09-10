// Automatic Database Migration Runner
// Runs before app boot; no TS deps. Node 18+.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!conn) {
    console.error('DB_MIGRATE_ERR: No SUPABASE_DB_URL or DATABASE_URL');
    process.exit(1);
  }
  
  // Enhance connection string with SSL parameters for Railway
  const connectionString = conn.includes('sslmode=') 
    ? conn 
    : `${conn}${conn.includes('?') ? '&' : '?'}sslmode=no-verify`;
  
  const client = new Client({ 
    connectionString, 
    application_name: 'xBOT-migrator',
    ssl: conn.includes('supabase.co') ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
  } catch (connError) {
    console.warn('DB_MIGRATE_WARN: Connection failed, app will continue without migration:', connError.message);
    console.warn('DB_MIGRATE_HINT: Manual migration may be required via Supabase dashboard');
    process.exit(0); // Exit successfully to allow app to start
  }
  
  try {
    // Create migrations tracking table
    await client.query(`
      create table if not exists _migrations (
        id serial primary key,
        filename text not null unique,
        applied_at timestamptz not null default now()
      );
    `);

    const dir = path.join(process.cwd(), 'supabase/migrations');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    
    for (const f of files) {
      const { rows } = await client.query('select 1 from _migrations where filename=$1', [f]);
      if (rows.length) continue; // already applied
      
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      await client.query('begin');
      
      try {
        await client.query(sql);
        await client.query(`notify pgrst, 'reload schema';`);
        await client.query('insert into _migrations(filename) values($1)', [f]);
        await client.query('commit');
        console.log(`DB_MIGRATE_APPLIED file=${f}`);
        appliedCount++;
      } catch (e) {
        await client.query('rollback');
        console.error(`DB_MIGRATE_FAILED file=${f} err=${e.message}`);
        process.exit(1);
      }
    }
    
    if (appliedCount > 0) {
      // Give PostgREST a moment to reload schema
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (appliedCount > 0) {
      console.log(`✅ MIGRATIONS: completed successfully (${appliedCount} applied)`);
    } else {
      console.log(`✅ MIGRATIONS: no-op (already applied)`);
    }
  } finally {
    await client.end();
  }
  process.exit(0);
})().catch(e => {
  console.error('DB_MIGRATE_FATAL', e);
  process.exit(1);
});
