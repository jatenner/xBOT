/**
 * Singleton PostgreSQL connection pool
 * Uses DATABASE_URL with sslmode=require (no custom SSL config)
 */

import { Pool } from 'pg';

// Validate DATABASE_URL is present
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL missing');
}

// Log connection details without credentials
try {
  const url = new URL(process.env.DATABASE_URL.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
  console.log(`DB_POOLER: Using sslmode=require (host: ${url.hostname}:${url.port || 5432})`);
} catch (error) {
  console.warn('DB_POOLER: Could not parse DATABASE_URL for logging');
}

// Create singleton pool with pooler-compatible SSL
const connectionString = process.env.DATABASE_URL;
const isPooler = connectionString?.includes('pooler.supabase.com') || connectionString?.includes(':6543');

if (isPooler) {
  console.log('DB_POOLER: Using pooler-compatible SSL (rejectUnauthorized: false)');
}

export const pgPool = new Pool({ 
  connectionString,
  ssl: isPooler ? { rejectUnauthorized: false } : true, // Pooler uses managed SSL
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Log pool events
pgPool.on('connect', () => {
  console.log('DB_POOLER: Client connected');
});

pgPool.on('error', (err) => {
  console.error('DB_POOLER: Pool error:', err.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('DB_POOLER: Shutting down pool...');
  await pgPool.end();
});

process.on('SIGINT', async () => {
  console.log('DB_POOLER: Shutting down pool...');
  await pgPool.end();
});