import * as fs from 'fs';
import { URL } from 'url';

export interface DatabaseConfig {
  connectionString: string;
  ssl: {
    rejectUnauthorized: boolean;
    ca?: string;
  };
  sslMode: string;
  usingRootCA: boolean;
  usingPoolerHost: boolean;
}

/**
 * Enhanced database URL resolver with comprehensive SSL/TLS support
 * Supports Session Pooler, root CA certificates, and configurable SSL modes
 */
export class DatabaseUrlResolver {
  
  /**
   * Build complete database configuration with SSL settings
   */
  static buildDatabaseConfig(): DatabaseConfig {
    let databaseUrl = process.env.DATABASE_URL;
    
    // Smart DATABASE_URL resolver with APP_ENV support (existing logic)
    if (!databaseUrl) {
      databaseUrl = this.buildDatabaseUrl();
    }
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL required. Ensure DATABASE_URL is set OR provide SUPABASE_DB_PASSWORD with either SUPABASE_URL or valid PROJECT_REF variables.');
    }

    // Parse and enhance URL with SSL mode
    const enhancedUrl = this.enhanceUrlWithSslMode(databaseUrl);
    
    // Build SSL configuration
    const sslConfig = this.buildSslConfig();
    
    // Detect pooler usage
    const usingPoolerHost = this.isPoolerUrl(enhancedUrl);
    
    return {
      connectionString: enhancedUrl,
      ssl: sslConfig.ssl,
      sslMode: sslConfig.mode,
      usingRootCA: sslConfig.usingRootCA,
      usingPoolerHost
    };
  }

  /**
   * Legacy method - builds DATABASE_URL from environment variables
   * Maintains compatibility with existing APP_ENV logic
   */
  private static buildDatabaseUrl(): string | null {
    const appEnv = process.env.APP_ENV || 'production';
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;
    
    if (!dbPassword) {
      return null;
    }

    // Try SUPABASE_URL first (most explicit)
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        const host = url.hostname;
        const projectRef = host.split('.')[0];
        
        // Convert to Session Pooler host for better compatibility
        const poolerHost = `aws-0-us-east-1.pooler.supabase.com`;
        return `postgresql://postgres:${dbPassword}@${poolerHost}:5432/postgres`;
      } catch (error) {
        console.warn('⚠️ SUPABASE_URL parsing failed, trying PROJECT_REF approach');
      }
    }

    // Try APP_ENV specific project ref
    const envProjectRef = process.env[`${appEnv.toUpperCase()}_PROJECT_REF`];
    if (envProjectRef) {
      return `postgresql://postgres:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
    }

    // Fallback to generic PROJECT_REF
    const genericProjectRef = process.env.PROJECT_REF;
    if (genericProjectRef) {
      return `postgresql://postgres:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
    }

    return null;
  }

  /**
   * Enhance DATABASE_URL with SSL mode if missing
   */
  private static enhanceUrlWithSslMode(databaseUrl: string): string {
    const sslMode = process.env.DB_SSL_MODE || 'require';
    
    // Check if URL already has sslmode parameter
    if (databaseUrl.includes('sslmode=')) {
      return databaseUrl;
    }
    
    // Add sslmode parameter
    const separator = databaseUrl.includes('?') ? '&' : '?';
    return `${databaseUrl}${separator}sslmode=${sslMode}`;
  }

  /**
   * Build SSL configuration based on environment variables
   */
  private static buildSslConfig(): { ssl: { rejectUnauthorized: boolean; ca?: string }, mode: string, usingRootCA: boolean } {
    const sslMode = process.env.DB_SSL_MODE || 'require';
    const rootCertPath = process.env.DB_SSL_ROOT_CERT_PATH;
    
    // Option A: Use root CA certificate (most secure)
    if (rootCertPath && fs.existsSync(rootCertPath)) {
      try {
        const ca = fs.readFileSync(rootCertPath, 'utf8');
        return {
          ssl: {
            ca,
            rejectUnauthorized: true
          },
          mode: sslMode,
          usingRootCA: true
        };
      } catch (error) {
        console.warn(`⚠️ DB_SSL: Failed to read root CA from ${rootCertPath}, falling back to mode-based SSL`);
      }
    }
    
    // Option B: Configure based on SSL mode
    if (sslMode === 'no-verify') {
      return {
        ssl: {
          rejectUnauthorized: false
        },
        mode: sslMode,
        usingRootCA: false
      };
    }
    
    // Option C: Default strict SSL (require mode)
    return {
      ssl: {
        rejectUnauthorized: true
      },
      mode: sslMode,
      usingRootCA: false
    };
  }

  /**
   * Detect if URL is using Supabase Session/Transaction Pooler
   */
  private static isPoolerUrl(url: string): boolean {
    return url.includes('pooler.supabase.com') || 
           url.includes('db.pooler.') ||
           url.includes('pgbouncer');
  }

  /**
   * Generate helpful error guidance for common connection issues
   */
  static getConnectionErrorGuidance(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('self-signed certificate') || message.includes('certificate')) {
      return `🔐 TLS Certificate Error: Consider using DB_SSL_ROOT_CERT_PATH with Supabase CA certificate, or set DB_SSL_MODE=no-verify for development`;
    }
    
    if (message.includes('enetunreach') || message.includes('ipv6') || message.includes('network')) {
      return `🌐 Network Error: Switch to Supabase Session Pooler URI (aws-0-us-east-1.pooler.supabase.com) for better IPv4 compatibility`;
    }
    
    if (message.includes('authentication') || message.includes('password')) {
      return `🔑 Auth Error: Verify SUPABASE_DB_PASSWORD and DATABASE_URL credentials`;
    }
    
    if (message.includes('timeout') || message.includes('connect')) {
      return `⏱️ Connection Timeout: Check network connectivity and consider using Session Pooler`;
    }
    
    return `💥 Database Connection Failed: ${error.message}`;
  }
}
