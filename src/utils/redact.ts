// src/utils/redact.ts - Secret redaction and safe logging utilities

/**
 * Redact sensitive information from strings
 */
export function redact(input: string): string {
  if (!input || typeof input !== 'string') {
    return String(input);
  }
  
  let redacted = input;
  
  // Redact credentials in URLs (everything before @)
  redacted = redacted.replace(/(postgres|postgresql|redis|http|https):\/\/[^@\/]*@/gi, '$1://***:***@');
  
  // Redact OpenAI API keys
  redacted = redacted.replace(/sk-[a-zA-Z0-9-_]{20,}/g, 'sk-***REDACTED***');
  
  // Redact Supabase JWTs (service role and anon keys)
  redacted = redacted.replace(/eyJ[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+/g, 'eyJ***REDACTED***');
  
  // Redact bearer tokens
  redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9-_=]+/gi, 'Bearer ***REDACTED***');
  
  // Redact Redis passwords (redis://:password@host)
  redacted = redacted.replace(/redis:\/\/:[^@]*@/gi, 'redis://:***@');
  
  // Redact generic passwords in connection strings
  redacted = redacted.replace(/password=[^&\s]+/gi, 'password=***');
  
  // Redact authentication tokens in query params
  redacted = redacted.replace(/[?&](apikey|token|key|secret|password|auth)=[^&\s]+/gi, '$1=***');
  
  return redacted;
}

/**
 * Extract hostname from URL without credentials
 */
export function getHostOnly(url: string): string {
  try {
    const normalized = url.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://');
    const parsed = new URL(normalized);
    return parsed.hostname + (parsed.port ? `:${parsed.port}` : '');
  } catch {
    return 'invalid-url';
  }
}

/**
 * Safe logging that automatically redacts sensitive information
 */
class SafeLogger {
  private log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const redactedMessage = redact(message);
    const redactedArgs = args.map(arg => 
      typeof arg === 'string' ? redact(arg) : 
      typeof arg === 'object' ? this.redactObject(arg) : 
      arg
    );
    
    const logMethod = level === 'info' ? console.log : 
                     level === 'warn' ? console.warn : 
                     console.error;
    
    if (redactedArgs.length > 0) {
      logMethod(`[${timestamp}] ${redactedMessage}`, ...redactedArgs);
    } else {
      logMethod(`[${timestamp}] ${redactedMessage}`);
    }
  }
  
  private redactObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return redact(obj);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.redactObject(item));
    
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact known sensitive keys
      if (/password|secret|key|token|jwt|credential|auth/i.test(key)) {
        redacted[key] = '***REDACTED***';
      } else {
        redacted[key] = this.redactObject(value);
      }
    }
    return redacted;
  }
  
  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }
  
  error(message: string, ...args: any[]) {
    this.log('error', message, ...args);
  }
}

export const safeLog = new SafeLogger();

/**
 * Create a redacted error for logging
 */
export function createRedactedError(error: Error, context?: string): string {
  const contextStr = context ? `[${context}] ` : '';
  return redact(`${contextStr}${error.name}: ${error.message}`);
}

/**
 * Safe environment checker
 */
export function checkEnvPresence(keys: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of keys) {
    result[key] = !!(process.env[key] && process.env[key]!.trim() !== '');
  }
  return result;
}
