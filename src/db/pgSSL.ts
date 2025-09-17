/**
 * Centralized PostgreSQL SSL configuration for Supabase
 * Handles TLS settings based on DATABASE_URL sslmode parameter
 */

export function getPgSSL(dbUrl: string): { rejectUnauthorized: false; require: true } | undefined {
  if (!dbUrl) {
    return undefined;
  }

  // Check if sslmode=require is present in the connection string
  if (dbUrl.includes('sslmode=require')) {
    return { rejectUnauthorized: false, require: true };
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
    const ssl = connectionString.includes('sslmode=require') ? 'no-verify' : 'off';
    
    console.log(`DB connect -> host=${host} port=${port} ssl=${ssl}`);
  } catch (error) {
    console.log('DB connect -> invalid connection string format');
  }
}
