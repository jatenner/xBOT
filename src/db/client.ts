/**
 * CANONICAL PostgreSQL client - delegates to pgClient.ts
 * All database connections use the same SSL configuration
 */

import { Pool, Client, ClientConfig } from 'pg';
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
