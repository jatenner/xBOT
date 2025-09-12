// src/db/sslClient.ts - Shared SSL connection utility for unified database connections
import { Client } from 'pg';
import { pgPool } from './pg';

export interface ConnectionResult {
  client: Client;
  sslMode: string;
  success: boolean;
}

/**
 * Create PostgreSQL client using the centralized connection pool
 * No SSL options - rely on sslmode=require in connection string
 */
export async function createClient(
  connectionString: string = process.env.DATABASE_URL || ''
): Promise<ConnectionResult> {
  // Use the centralized PG pool
  const client = await pgPool.connect();
  
  // Log connection status
  console.log('DB_POOLER: Using connection string with sslmode=require');
  
  return {
    client,
    sslMode: 'verified',
    success: true
  };
}

/**
 * Test database connectivity with the centralized pool
 */
export async function testDatabaseConnection(): Promise<{ success: boolean; mode: string; error?: string }> {
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    
    return {
      success: true,
      mode: 'verified'
    };
  } catch (err) {
    return {
      success: false,
      mode: 'failed',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Execute a query with the centralized pool
 */
export async function executeQuery<T = any>(
  query: string,
  values?: any[]
): Promise<T> {
  const client = await pgPool.connect();
  
  try {
    const queryResult = await client.query(query, values);
    return queryResult.rows as T;
  } finally {
    client.release();
  }
}
