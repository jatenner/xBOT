// src/db/sslClient.ts - Shared SSL connection utility for unified database connections
import { Client } from 'pg';
import fs from 'fs';

export interface SSLConfig {
  mode: 'require' | 'prefer' | 'no-verify' | 'disable';
  certPath?: string;
  rejectUnauthorized: boolean;
  ca?: Buffer;
}

export interface ConnectionResult {
  client: Client;
  sslMode: string;
  success: boolean;
  fallbackUsed: boolean;
}

/**
 * Unified SSL configuration builder
 */
export function buildSSLConfig(
  mode: string = 'prefer',
  certPath: string = '/etc/ssl/certs/supabase-ca.crt'
): SSLConfig | false {
  if (mode === 'disable') {
    return false;
  }

  const config: SSLConfig = {
    mode: mode as SSLConfig['mode'],
    certPath,
    rejectUnauthorized: mode !== 'no-verify'
  };

  if (mode === 'no-verify') {
    return config;
  }

  // Try to load CA certificate for require/prefer modes
  if (mode === 'require' || mode === 'prefer') {
    try {
      config.ca = fs.readFileSync(certPath);
      return config;
    } catch (err) {
      if (mode === 'require') {
        // For require mode, fall back to no-verify rather than fail
        return {
          mode: 'no-verify',
          rejectUnauthorized: false
        };
      }
      // For prefer mode, continue without CA (use system certs)
      return config;
    }
  }

  return config;
}

/**
 * Create PostgreSQL client with unified SSL handling and automatic fallback
 * Optimized for Supabase Transaction Pooler (port 6543)
 */
export async function createSSLClient(
  connectionString: string,
  options: {
    sslMode?: string;
    certPath?: string;
    maxRetries?: number;
  } = {}
): Promise<ConnectionResult> {
  const {
    sslMode = process.env.DB_SSL_MODE || process.env.MIGRATION_SSL_MODE || 'require',
    certPath = process.env.DB_SSL_ROOT_CERT_PATH || process.env.MIGRATION_SSL_ROOT_CERT_PATH || '/etc/ssl/certs/supabase-ca.crt',
    maxRetries = 1
  } = options;

  // Special handling for Supabase Transaction Pooler
  const isTransactionPooler = connectionString.includes(':6543');
  const isSupabaseHost = connectionString.includes('supabase.co');

  let lastError: Error;
  let fallbackUsed = false;

  // First attempt with configured SSL  
  let sslConfig = buildSSLConfig(sslMode, certPath);
  
  // For Transaction Pooler, start with more permissive SSL if strict mode fails
  if (isTransactionPooler && sslMode === 'require') {
    console.log('🔒 DB_SSL: Attempting Transaction Pooler connection with SSL');
    // Transaction pooler often needs less strict SSL validation
    sslConfig = { 
      mode: 'no-verify',
      rejectUnauthorized: false 
    } as SSLConfig;
  }
  
  let client = new Client({ 
    connectionString, 
    ssl: sslConfig === false ? false : {
      rejectUnauthorized: sslConfig.rejectUnauthorized,
      ca: sslConfig.ca
    }
  });

  try {
    await client.connect();
    const mode = isTransactionPooler ? 'pooler-ssl' : 
                 sslConfig ? (sslConfig.ca ? 'strict' : 'system-certs') : 'disabled';
    console.log(`🔒 DB_SSL: Connected successfully with SSL (${mode})`);
    
    return {
      client,
      sslMode: mode,
      success: true,
      fallbackUsed: false
    };
  } catch (err) {
    lastError = err as Error;
    await client.end().catch(() => {});

    // Check if it's a certificate-related error and we haven't already fallen back
    const isCertError = err && typeof err === 'object' && 'message' in err && 
      (err.message.includes('self-signed') || 
       err.message.includes('certificate') ||
       err.message.includes('CERT_') ||
       err.message.includes('SSL'));

    if (isCertError && sslMode !== 'no-verify' && maxRetries > 0) {
      console.log('⚠️ DB_SSL_WARN: Certificate error detected, falling back to no-verify mode');
      
      // Retry with no certificate verification
      client = new Client({ 
        connectionString, 
        ssl: { rejectUnauthorized: false }
      });

      try {
        await client.connect();
        fallbackUsed = true;
        console.log('🔒 DB_SSL: Connected successfully with SSL fallback (no-verify)');
        
        return {
          client,
          sslMode: 'no-verify',
          success: true,
          fallbackUsed: true
        };
      } catch (fallbackErr) {
        lastError = fallbackErr as Error;
        await client.end().catch(() => {});
      }
    }
  }

  // All attempts failed
  throw new Error(`SSL connection failed: ${lastError.message}`);
}

/**
 * Test database connectivity with the same SSL logic
 */
export async function testDatabaseConnection(
  connectionString: string,
  options?: { sslMode?: string; certPath?: string }
): Promise<{ success: boolean; mode: string; error?: string }> {
  try {
    const result = await createSSLClient(connectionString, options);
    await result.client.end();
    
    return {
      success: true,
      mode: result.sslMode
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
 * Execute a query with automatic SSL connection handling
 */
export async function executeWithSSL<T = any>(
  connectionString: string,
  query: string,
  values?: any[],
  options?: { sslMode?: string; certPath?: string }
): Promise<T> {
  const result = await createSSLClient(connectionString, options);
  
  try {
    const queryResult = await result.client.query(query, values);
    return queryResult.rows as T;
  } finally {
    await result.client.end().catch(() => {});
  }
}
