// src/utils/logger.ts - Production-safe logging with secret masking
export function safeLog(level: 'info' | 'warn' | 'error', message: string): void {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  
  // Mask secrets in logs
  const masked = typeof message === 'string' ? message
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@')
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***')
    .replace(/(eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+)/g, 'eyJ***')
    .replace(/(Bearer\s+)[A-Za-z0-9\-\._~+/=]+/gi, '$1***')
    .replace(/([A-Za-z0-9]{16,}:[A-Za-z0-9]{16,})/g, '***:***') : message;
    
  logFn(`[${timestamp}] ${masked}`);
}

// Convenience exports
export const log = (message: string) => safeLog('info', message);
export const warn = (message: string) => safeLog('warn', message);
export const error = (message: string) => safeLog('error', message);

export default { safeLog, log, warn, error };