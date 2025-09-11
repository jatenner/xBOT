// src/db/strictClient.ts - Verified SSL database client (no fallback)
import { Client } from 'pg';
import { log } from '../utils/logger';

export function createStrictSSLClient(connectionString: string): Client {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sslMode = (process.env.DB_SSL_MODE || 'require').toLowerCase();
  
  if (sslMode !== 'require') {
    throw new Error(`DB_SSL_MODE must be 'require' for production. Got: ${sslMode}`);
  }

  const ssl = { rejectUnauthorized: true }; // verify cert - no fallback

  const client = new Client({
    connectionString,
    ssl,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  });

  log('🔒 DB_SSL: Using verified CA bundle for Transaction Pooler');
  
  return client;
}

export async function connectWithVerification(client: Client): Promise<void> {
  try {
    await client.connect();
    log('✅ DATABASE_CONNECTION: verified SSL');
    
    // Test connection
    const result = await client.query('SELECT version()');
    const version = result.rows[0]?.version;
    if (version?.includes('PostgreSQL')) {
      log('📊 DATABASE: PostgreSQL connection verified');
    }
  } catch (error) {
    // No fallback - fail hard on SSL issues
    throw new Error(`Database connection failed with verified SSL: ${error.message}`);
  }
}
