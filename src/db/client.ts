/**
 * Production-grade PostgreSQL client with verified SSL
 * Connects to Supabase Transaction Pooler with system CA certificates
 */

import { Pool, Client, ClientConfig } from 'pg';
import { getPgSSL, logSafeConnectionInfo } from './pgSSL';

// Environment detection
const isProd = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

/**
 * Build PostgreSQL configuration with centralized SSL handling
 */
function buildPgConfig(connectionString: string): ClientConfig {
  // Use centralized SSL configuration
  const sslConfig = getPgSSL();
  
  // Log safe connection info
  logSafeConnectionInfo(connectionString);

  return {
    connectionString,
    ssl: sslConfig,
    // Query timeout
    query_timeout: 30000,
    // Statement timeout
    statement_timeout: 30000
  };
}

/**
 * Singleton connection pool for application use
 */
export const pool = new Pool({
  ...buildPgConfig(DATABASE_URL),
  // Pool-specific settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

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
 * Create a fresh client for one-time operations (like migrations)
 * Always creates a new client to avoid "already connected" errors
 */
export function createFreshClient(): Client {
  return new Client(buildPgConfig(DATABASE_URL));
}

/**
 * Execute a function with a fresh client (auto-cleanup)
 */
export async function withFreshClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = createFreshClient();
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch (error) {
      console.warn('DB_CLIENT: Error closing client:', error);
    }
  }
}

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await withFreshClient(async (client) => {
      await client.query('SELECT 1');
    });
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
  try {
    await pool.end();
    console.log('DB_POOL: Connection pool closed');
  } catch (error) {
    console.error('DB_POOL: Error closing pool:', error);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);
