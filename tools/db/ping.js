#!/usr/bin/env node
/**
 * Simple DB connection test
 */

const { Client } = require('pg');

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
    console.log(`DB: OK (${ssl})`);
  } catch (error) {
    console.log('DB: ERROR - invalid connection string');
  }
}

async function ping() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: getPgSSL(DATABASE_URL)
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    logSafeConnectionInfo(DATABASE_URL);
  } catch (error) {
    console.error('DB: ERROR -', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  ping();
}
