/**
 * Centralized logging utility with secret masking
 */

// Mask sensitive information in logs
function maskSecrets(message: string): string {
  return message
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@')
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***')
    .replace(/(eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+)/g, 'eyJ***')
    .replace(/(Bearer\s+)[A-Za-z0-9\-\._~+/=]+/gi, '$1***');
}

// Format log message with timestamp and component
function formatLogMessage(level: string, component: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
}

// Log levels
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// Main logger function
export function log(level: string, component: string, message: string, data?: any): void {
  const logFn = 
    level === LogLevel.ERROR ? console.error :
    level === LogLevel.WARN ? console.warn :
    level === LogLevel.DEBUG ? console.debug :
    console.log;

  // Mask secrets in message
  const maskedMessage = maskSecrets(message);
  
  // Format the log message
  const formattedMessage = formatLogMessage(level, component, maskedMessage);
  
  // Log the message
  if (data) {
    // Mask secrets in data if it's a string
    const maskedData = typeof data === 'string' 
      ? maskSecrets(data)
      : data;
      
    logFn(formattedMessage, maskedData);
  } else {
    logFn(formattedMessage);
  }
}

// Backward compatibility with existing code
export function log_compat(message: string): void {
  const formattedMessage = `[${new Date().toISOString()}] ${maskSecrets(message)}`;
  console.log(formattedMessage);
}

// Convenience methods
export const debug = (component: string, message: string, data?: any) => 
  log(LogLevel.DEBUG, component, message, data);

export const info = (component: string, message: string, data?: any) => 
  log(LogLevel.INFO, component, message, data);

export const warn = (component: string, message: string, data?: any) => 
  log(LogLevel.WARN, component, message, data);

export const error = (component: string, message: string, data?: any) => 
  log(LogLevel.ERROR, component, message, data);