#!/usr/bin/env node
/**
 * CANONICAL MIGRATION RUNNER
 * One source of truth for all DB migrations
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Centralized SSL configuration
function getPgSSL(dbUrl) {
  if (!dbUrl) return undefined;
  if (dbUrl.includes('sslmode=require')) {
    return { require: true, rejectUnauthorized: false };
  }
  return undefined;
}

function logSafeConnectionInfo(connectionString) {
  if (!connectionString) {
    console.log('DB connect -> no connection string provided');
    return;
  }
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = url.port || '5432';
    const ssl = connectionString.includes('sslmode=require') ? 'no-verify' : 'off';
    console.log(`DB connect -> host=${host} port=${port} ssl=${ssl}`);
  } catch (error) {
    console.log('DB connect -> invalid connection string format');
  }
}

async function runMigrations() {
  // Runtime migration guard
  if (process.env.MIGRATIONS_RUNTIME_ENABLED !== 'true') {
    console.log('runtime migrations disabled');
    process.exit(0);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('ℹ️  No migrations directory found');
    process.exit(0);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  if (files.length === 0) {
    console.log('ℹ️  No migration files found');
    process.exit(0);
  }

  console.log(`Found ${files.length} migration files`);
  logSafeConnectionInfo(DATABASE_URL);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: getPgSSL(DATABASE_URL)
  });

  try {
    await client.connect();
  } catch (error) {
    console.error('💥 Migration connection failed:', error.message);
    process.exit(1);
  }

  for (const filename of files) {
    const filePath = path.join(migrationsDir, filename);
    try {
      process.stdout.write(`→ Applying ${filename} ... `);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log('OK');
    } catch (error) {
      console.log('FAILED:', error.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('✅ All migrations applied');
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runMigrations };