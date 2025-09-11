// src/utils/logger.ts - Secret-safe logging for production
function maskSecrets(s: string): string {
  if (!s) return s;
  return s
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***')
    .replace(/(service_role|anon)[a-zA-Z0-9\.\-_]*\.[a-zA-Z0-9\.\-_]*/g, '[supabase-key-***]')
    .replace(/(Bearer\s+)[A-Za-z0-9\-\._~+/=]+/gi, '$1***')
    .replace(/([A-Za-z0-9]{16,}:[A-Za-z0-9]{16,})/g, '***:***') // redis, twitter pairs
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@'); // postgres credentials
}

const safeLog = (...args: any[]) => 
  console.log(...args.map(x => typeof x === 'string' ? maskSecrets(x) : x));

const safeWarn = (...args: any[]) => 
  console.warn(...args.map(x => typeof x === 'string' ? maskSecrets(x) : x));

const safeError = (...args: any[]) => 
  console.error(...args.map(x => typeof x === 'string' ? maskSecrets(x) : x));

export { safeLog as log, safeWarn as warn, safeError as error, maskSecrets };
