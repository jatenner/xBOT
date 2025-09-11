// src/config/safeConfig.ts - Safe configuration loader with secret redaction
import { redact, safeLog } from '../utils/redact';

export interface SafeConfig {
  // Database
  DATABASE_URL: string;
  DB_SSL_MODE: 'require' | 'prefer' | 'no-verify' | 'disable';
  MIGRATION_SSL_MODE: 'require' | 'prefer' | 'no-verify' | 'disable';
  DB_SSL_ROOT_CERT_PATH?: string;
  ALLOW_SSL_FALLBACK: boolean;
  
  // Feature flags
  MIGRATIONS_RUNTIME_ENABLED: boolean;
  POSTING_DISABLED: boolean;
  REAL_METRICS_ENABLED: boolean;
  ENABLE_METRICS: boolean;
  
  // API services
  OPENAI_API_KEY?: string;
  REDIS_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  
  // Runtime
  NODE_ENV: string;
  DAILY_OPENAI_LIMIT_USD: number;
}

function validateRequired(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function getOptional(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value ? value.trim() : defaultValue;
}

function getBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    safeLog.warn(`Invalid number for ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

// Parse and validate DATABASE_URL
function validateDatabaseUrl(url: string): { host: string; port: string; isPooler: boolean } {
  try {
    // Handle postgres:// and postgresql:// schemes
    const normalized = url.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://');
    const parsed = new URL(normalized);
    
    if (!parsed.hostname || !parsed.port) {
      throw new Error('DATABASE_URL missing hostname or port');
    }
    
    const isPooler = parsed.port === '6543' && 
                    (parsed.hostname.includes('pooler.supabase.co') || 
                     parsed.hostname.startsWith('db.'));
    
    return {
      host: parsed.hostname,
      port: parsed.port,
      isPooler
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'parse error'}`);
  }
}

// Load and validate configuration
export function loadSafeConfig(): SafeConfig {
  safeLog.info('Loading configuration...');
  
  try {
    // Required: Database
    const DATABASE_URL = validateRequired('DATABASE_URL', process.env.DATABASE_URL);
    const dbInfo = validateDatabaseUrl(DATABASE_URL);
    
    // SSL Configuration
    const DB_SSL_MODE = (getOptional('DB_SSL_MODE', 'require') as SafeConfig['DB_SSL_MODE']);
    const MIGRATION_SSL_MODE = (getOptional('MIGRATION_SSL_MODE', 'require') as SafeConfig['MIGRATION_SSL_MODE']);
    const DB_SSL_ROOT_CERT_PATH = getOptional('DB_SSL_ROOT_CERT_PATH');
    const ALLOW_SSL_FALLBACK = getBoolean('ALLOW_SSL_FALLBACK', false);
    
    // Feature flags
    const MIGRATIONS_RUNTIME_ENABLED = getBoolean('MIGRATIONS_RUNTIME_ENABLED', true);
    const POSTING_DISABLED = getBoolean('POSTING_DISABLED', true);
    const REAL_METRICS_ENABLED = getBoolean('REAL_METRICS_ENABLED', false);
    const ENABLE_METRICS = getBoolean('ENABLE_METRICS', false);
    
    // Optional API services
    const OPENAI_API_KEY = getOptional('OPENAI_API_KEY');
    const REDIS_URL = getOptional('REDIS_URL');
    const SUPABASE_SERVICE_ROLE_KEY = getOptional('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_URL = getOptional('SUPABASE_URL');
    
    // Runtime
    const NODE_ENV = getOptional('NODE_ENV', 'development') || 'development';
    const DAILY_OPENAI_LIMIT_USD = getNumber('DAILY_OPENAI_LIMIT_USD', 5.0);
    
    // Safe logging of configuration
    safeLog.info('Configuration loaded successfully:');
    safeLog.info(`DATABASE_HOST: ${dbInfo.host}`);
    safeLog.info(`DATABASE_PORT: ${dbInfo.port} ${dbInfo.isPooler ? '(Transaction Pooler)' : '(Direct)'}`);
    safeLog.info(`DB_SSL_MODE: ${DB_SSL_MODE}`);
    safeLog.info(`OPENAI_API_KEY: present=${!!OPENAI_API_KEY}`);
    safeLog.info(`REDIS_URL: present=${!!REDIS_URL}`);
    safeLog.info(`SUPABASE_SERVICE_ROLE_KEY: present=${!!SUPABASE_SERVICE_ROLE_KEY}`);
    safeLog.info(`MIGRATIONS_RUNTIME_ENABLED: ${MIGRATIONS_RUNTIME_ENABLED}`);
    safeLog.info(`POSTING_DISABLED: ${POSTING_DISABLED}`);
    safeLog.info(`REAL_METRICS_ENABLED: ${REAL_METRICS_ENABLED}`);
    
    return {
      DATABASE_URL,
      DB_SSL_MODE,
      MIGRATION_SSL_MODE,
      DB_SSL_ROOT_CERT_PATH,
      ALLOW_SSL_FALLBACK,
      MIGRATIONS_RUNTIME_ENABLED,
      POSTING_DISABLED,
      REAL_METRICS_ENABLED,
      ENABLE_METRICS,
      OPENAI_API_KEY,
      REDIS_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_URL,
      NODE_ENV,
      DAILY_OPENAI_LIMIT_USD
    };
    
  } catch (error) {
    safeLog.error(`Configuration validation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    throw error;
  }
}

// Singleton instance
let configInstance: SafeConfig | null = null;

export function getConfig(): SafeConfig {
  if (!configInstance) {
    configInstance = loadSafeConfig();
  }
  return configInstance;
}

// Helper to check if we're using Transaction Pooler
export function isTransactionPooler(config: SafeConfig): boolean {
  try {
    const normalized = config.DATABASE_URL.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://');
    const parsed = new URL(normalized);
    return parsed.port === '6543' && 
           (parsed.hostname.includes('pooler.supabase.co') || 
            parsed.hostname.startsWith('db.'));
  } catch {
    return false;
  }
}
