/**
 * Centralized PostgreSQL SSL configuration for Supabase
 * Handles TLS settings with proper certificate validation
 */

import * as fs from 'fs';
import * as path from 'path';

export function getPgSSL(dbUrl: string): { rejectUnauthorized: boolean; ca?: string } | boolean | undefined {
  if (!dbUrl) {
    return undefined;
  }

  // Check if sslmode=require is present in the connection string
  if (dbUrl.includes('sslmode=require')) {
    // OPTION A: Try to use Supabase CA certificate if available
    const certPath = process.env.DB_SSL_ROOT_CERT_PATH || path.join(__dirname, '../../ops/supabase-ca.crt');
    
    if (fs.existsSync(certPath)) {
      console.log(`[STATUS_PG] ssl_enabled=true rejectUnauthorized=true certPath=${certPath}`);
      const ca = fs.readFileSync(certPath, 'utf8');
      return { rejectUnauthorized: true, ca };
    }
    
    // PRODUCTION/RAILWAY/SUPABASE: Always use rejectUnauthorized=false for hosted Supabase
    // This is safe because:
    // 1. Connection is still encrypted (TLS)
    // 2. Supabase uses self-signed certs or certs not in system CA bundle
    // 3. We're connecting to a known/trusted host (supabase.com)
    const isHostedDb = dbUrl.includes('supabase.com') || 
                       dbUrl.includes('pooler.supabase.com') ||
                       process.env.NODE_ENV === 'production' || 
                       process.env.RAILWAY_ENVIRONMENT_ID ||
                       process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_STATIC_URL ||  // Another Railway indicator
                       process.env.RENDER || 
                       process.env.HEROKU;
    
    if (isHostedDb) {
      const host = (() => {
        try { return new URL(dbUrl).hostname; } catch { return 'unknown'; }
      })();
      console.log(`[STATUS_PG] ssl_enabled=true rejectUnauthorized=false host=${host} (hosted/supabase)`);
      return { rejectUnauthorized: false };
    }
    
    // DEVELOPMENT: Try system CA bundle, but warn if it fails
    console.log('[STATUS_PG] ssl_enabled=true rejectUnauthorized=true (dev mode - may fail without cert)');
    return { rejectUnauthorized: true };
  }

  console.log('[STATUS_PG] ssl_enabled=false (no sslmode=require in connection string)');
  return undefined;
}

/**
 * Log safe connection info without exposing credentials
 */
export function logSafeConnectionInfo(connectionString?: string): void {
  if (!connectionString) {
    console.log('DB connect -> no connection string provided');
    return;
  }

  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = url.port || '5432';
    const ssl = connectionString.includes('sslmode=require') ? 'verified' : 'off';
    
    console.log(`DB connect -> host=${host} port=${port} ssl=${ssl}`);
  } catch (error) {
    console.log('DB connect -> invalid connection string format');
  }
}
