/**
 * Centralized PostgreSQL SSL configuration for Supabase
 * Handles TLS settings with proper certificate validation
 */

import * as fs from 'fs';
import * as path from 'path';

export function getPgSSL(dbUrl: string): { require: true; rejectUnauthorized: boolean; ca?: string } | undefined {
  if (!dbUrl) {
    return undefined;
  }

  // Check if sslmode=require is present in the connection string
  if (dbUrl.includes('sslmode=require')) {
    // OPTION A: Try to use Supabase CA certificate if available
    const certPath = process.env.DB_SSL_ROOT_CERT_PATH || path.join(__dirname, '../../ops/supabase-ca.crt');
    
    if (fs.existsSync(certPath)) {
      console.log(`[DB_SSL] ✅ Using Supabase CA certificate: ${certPath}`);
      const ca = fs.readFileSync(certPath, 'utf8');
      return { require: true, rejectUnauthorized: true, ca };
    }
    
    // FALLBACK: Use system CA bundle (Railway/Linux has proper CA certs)
    console.log('[DB_SSL] ℹ️ Using system CA bundle (certificate not found)');
    return { require: true, rejectUnauthorized: true };
  }

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
