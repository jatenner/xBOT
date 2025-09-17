/**
 * Centralized PostgreSQL client with TLS hardening
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

  // Log safe connection info
  logSafeConnectionInfo(connectionString);

  pool = new Pool({
    connectionString,
    ssl: getPgSSL(connectionString)
  });

  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
