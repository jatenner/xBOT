/**
 * CANONICAL PostgreSQL client with TLS hardening
 * Single source of truth for all node-postgres connections
 */

import { Pool } from 'pg';
import { getPgSSL, logSafeConnectionInfo } from './pgSSL';

let pool: Pool | null = null;

export function makePgPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Log safe connection info once
  logSafeConnectionInfo(connectionString);

  pool = new Pool({
    connectionString,
    ssl: getPgSSL(connectionString),
    // Standard pool settings
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Pool event handlers
  pool.on('connect', () => {
    // Single log on first connect only
  });

  pool.on('error', (err) => {
    console.error('DB_POOL: Unexpected error:', err.message);
  });

  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
