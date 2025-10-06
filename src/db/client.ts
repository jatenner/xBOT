/**
 * CANONICAL PostgreSQL client - delegates to pgClient.ts
 * All database connections use the same SSL configuration
 */

import { Pool, Client, ClientConfig, PoolClient } from 'pg';
import { makePgPool, closePgPool } from './pgClient';

/**
 * Singleton connection pool for application use
 */
export const pool = makePgPool();

// Pool event handlers
pool.on('connect', (client) => {
  console.log('DB_POOL: Client connected to PostgreSQL');
});

pool.on('error', (err, client) => {
  console.error('DB_POOL: Unexpected error on idle client:', err.message);
});

pool.on('remove', (client) => {
  console.log('DB_POOL: Client removed from pool');
});

/**
 * Execute a function with a fresh database client
 * Used by migration scripts
 */
export async function withFreshClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Graceful shutdown
 */
export async function closePool(): Promise<void> {
  await closePgPool();
}

// Graceful shutdown handlers
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);
