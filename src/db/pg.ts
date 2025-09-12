/**
 * Centralized PostgreSQL connection pool
 * Uses DATABASE_URL with sslmode=require and system CA certificates
 */

import { Pool } from 'pg';
import { info, error, debug } from '../utils/logger';

// Component name for logging
const COMPONENT = 'DB_POOLER';

// Validate DATABASE_URL is present
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing');
}

// Ensure connection string has sslmode=require
const connectionString = DATABASE_URL.includes('sslmode=') 
  ? DATABASE_URL 
  : `${DATABASE_URL}${DATABASE_URL.includes('?') ? '&' : '?'}sslmode=require`;

// Log connection details (without credentials)
try {
  const url = new URL(connectionString.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
  info(COMPONENT, `Using connection string with sslmode=require (host: ${url.hostname})`);
} catch (err) {
  error(COMPONENT, 'Invalid DATABASE_URL format');
}

// Create the connection pool
// No ssl object - let libpq handle sslmode=require from the connection string
export const pgPool = new Pool({ 
  connectionString,
  max: 10, 
  idleTimeoutMillis: 30000 
});

// Log connection events
pgPool.on('connect', () => {
  info(COMPONENT, 'New client connected to PostgreSQL');
});

pgPool.on('error', (err) => {
  error(COMPONENT, `Unexpected error on idle client: ${err.message}`);
});

// Export a function to get a client from the pool
export async function getClient() {
  return await pgPool.connect();
}

// Export a function for simple queries
export async function query(text: string, params: any[] = []) {
  const start = Date.now();
  try {
    const result = await pgPool.query(text, params);
    const duration = Date.now() - start;
    debug(COMPONENT, `Executed in ${duration}ms: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    return result;
  } catch (err: any) {
    error(COMPONENT, `Query error: ${err.code || 'UNKNOWN'} - ${err.message}`);
    throw err;
  }
}
