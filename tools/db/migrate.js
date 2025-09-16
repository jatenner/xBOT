const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Import SSL helper (CommonJS compatible)
function getPgSSL() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;
  return databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined;
}

function logSafeConnectionInfo(connectionString) {
  if (!connectionString) {
    console.log('DB connect → no connection string provided');
    return;
  }
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = url.port || '5432';
    const ssl = connectionString.includes('sslmode=require') ? 'no-verify' : 'verify';
    console.log(`DB connect → host=${host} port=${port} ssl=${ssl}`);
  } catch (error) {
    console.log('DB connect → invalid connection string format');
  }
}

(async () => {
  const dir = path.join(process.cwd(), 'supabase/migrations');

  if (!fs.existsSync(dir)) {
    console.error('❌ Migration directory not found:', dir);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const cs = process.env.DATABASE_URL;

  if (!cs) {
    console.error('❌ DATABASE_URL missing');
    process.exit(1);
  }

  console.log(`🗃️  Found ${files.length} migration files`);
  logSafeConnectionInfo(cs);

  const client = new Client({
    connectionString: cs,
    ssl: getPgSSL()
  });

  await client.connect();

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    process.stdout.write(`→ Applying ${f} ... `);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (error) {
      console.log('FAILED:', error.message);
      throw error;
    }
  }

  await client.end();
  console.log('✅ All migrations applied');
})().catch(e => {
  console.error('💥 Migration failed:', e?.message || e);
  process.exit(1);
});