// scripts/diagnostics.js - Safe environment validation and connectivity check
const { Client } = require('pg');
const { URL } = require('url');

// Simple redaction for diagnostics
function redact(str) {
  if (!str || typeof str !== 'string') return String(str);
  return str
    .replace(/(postgres|postgresql):\/\/[^@\/]*@/gi, '$1://***:***@')
    .replace(/sk-[a-zA-Z0-9-_]{20,}/g, 'sk-***')
    .replace(/eyJ[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+/g, 'eyJ***');
}

function safeLog(level, message) {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[${timestamp}] ${redact(message)}`);
}

async function main() {
  safeLog('info', '🔍 xBOT Environment Diagnostics');
  safeLog('info', '=====================================');
  
  // Check critical environment variables (presence only)
  const criticalEnvs = [
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'REDIS_URL'
  ];
  
  const optionalEnvs = [
    'DB_SSL_MODE',
    'MIGRATION_SSL_MODE',
    'DB_SSL_ROOT_CERT_PATH',
    'ALLOW_SSL_FALLBACK',
    'MIGRATIONS_RUNTIME_ENABLED',
    'POSTING_DISABLED',
    'REAL_METRICS_ENABLED',
    'ENABLE_METRICS'
  ];
  
  safeLog('info', '📋 Environment Variables:');
  
  // Check critical envs
  let criticalMissing = 0;
  for (const envVar of criticalEnvs) {
    const present = !!(process.env[envVar] && process.env[envVar].trim() !== '');
    safeLog('info', `   ${envVar}: present=${present}`);
    if (!present) criticalMissing++;
  }
  
  // Check optional envs
  for (const envVar of optionalEnvs) {
    const value = process.env[envVar];
    if (value !== undefined) {
      // For boolean-like values, show the actual value
      if (['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        safeLog('info', `   ${envVar}: ${value}`);
      } else {
        safeLog('info', `   ${envVar}: present=true`);
      }
    } else {
      safeLog('info', `   ${envVar}: not_set`);
    }
  }
  
  if (criticalMissing > 0) {
    safeLog('error', `❌ ${criticalMissing} critical environment variables missing`);
    process.exit(1);
  }
  
  // Database connectivity check
  safeLog('info', '');
  safeLog('info', '🔗 Database Connectivity:');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    safeLog('error', '❌ DATABASE_URL not set');
    process.exit(1);
  }
  
  let parsedUrl;
  let isPooler = false;
  
  try {
    // Parse URL for host information
    parsedUrl = new URL(databaseUrl.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    isPooler = parsedUrl.port === '6543' && 
               (parsedUrl.hostname.includes('pooler.supabase.co') || 
                parsedUrl.hostname.startsWith('db.'));
    
    safeLog('info', `   Host: ${parsedUrl.hostname}`);
    safeLog('info', `   Port: ${parsedUrl.port}`);
    safeLog('info', `   Connection Type: ${isPooler ? 'Transaction Pooler' : 'Direct'}`);
    
  } catch (parseError) {
    safeLog('error', `❌ Invalid DATABASE_URL format: ${parseError.message}`);
    process.exit(1);
  }
  
  // SSL configuration check
  const sslMode = process.env.DB_SSL_MODE || process.env.MIGRATION_SSL_MODE || 'require';
  const certPath = process.env.DB_SSL_ROOT_CERT_PATH;
  const allowFallback = process.env.ALLOW_SSL_FALLBACK === 'true';
  
  safeLog('info', `   SSL Mode: ${sslMode}`);
  safeLog('info', `   Custom CA: ${certPath ? 'configured' : 'not_set'}`);
  safeLog('info', `   SSL Fallback: ${allowFallback}`);
  
  // Attempt connection test
  safeLog('info', '');
  safeLog('info', '🧪 Connection Test:');
  
  let ssl;
  if (isPooler) {
    ssl = { rejectUnauthorized: sslMode === 'require' };
  } else if (sslMode === 'disable') {
    ssl = false;
  } else {
    ssl = { rejectUnauthorized: sslMode === 'require' };
    
    if (certPath) {
      const fs = require('fs');
      if (fs.existsSync(certPath)) {
        try {
          ssl.ca = fs.readFileSync(certPath);
          safeLog('info', '   Custom CA loaded successfully');
        } catch (err) {
          safeLog('warn', `   Custom CA load failed: ${err.message}`);
        }
      } else {
        safeLog('warn', `   Custom CA file not found: ${certPath}`);
      }
    }
  }
  
  const client = new Client({ 
    connectionString: databaseUrl, 
    ssl,
    connectionTimeoutMillis: 10000
  });
  
  try {
    await client.connect();
    safeLog('info', '✅ DB host reachable: true');
    
    // Quick query test
    const result = await client.query('SELECT version()');
    if (result.rows && result.rows.length > 0) {
      const version = result.rows[0].version;
      const pgVersion = version.match(/PostgreSQL (\d+\.\d+)/);
      safeLog('info', `✅ DB query test: success (PostgreSQL ${pgVersion ? pgVersion[1] : 'unknown'})`);
    }
    
    // Check if api_usage table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'api_usage' AND table_schema = 'public'
      ) as exists
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    safeLog('info', `✅ api_usage table: ${tableExists ? 'exists' : 'missing'}`);
    
  } catch (error) {
    safeLog('error', `❌ DB host reachable: false`);
    safeLog('error', `   Error: ${error.code || 'UNKNOWN'} - ${error.message}`);
    
    if (error.message.includes('certificate')) {
      safeLog('info', '💡 SSL certificate issue detected');
      safeLog('info', '   - Try setting ALLOW_SSL_FALLBACK=true');
      safeLog('info', '   - Or verify DB_SSL_ROOT_CERT_PATH is correct');
    }
    
    if (error.code === 'ENOTFOUND') {
      safeLog('info', '💡 DNS resolution failed');
      safeLog('info', '   - Check network connectivity');
      safeLog('info', '   - Verify DATABASE_URL hostname is correct');
    }
    
  } finally {
    try {
      await client.end();
    } catch (err) {
      // Ignore cleanup errors
    }
  }
  
  // Playwright check
  safeLog('info', '');
  safeLog('info', '🎭 Playwright Status:');
  
  try {
    const { chromium } = require('playwright');
    safeLog('info', '✅ Playwright package: installed');
    
    // Check if browser is installed
    try {
      const browser = await chromium.launch({ 
        headless: true,
        timeout: 5000,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });
      await browser.close();
      safeLog('info', '✅ Chromium browser: available');
    } catch (browserError) {
      if (browserError.message.includes("Executable doesn't exist")) {
        safeLog('error', '❌ Chromium browser: not installed');
        safeLog('info', '💡 Run: npx playwright install --with-deps chromium');
      } else {
        safeLog('warn', `⚠️ Chromium browser: error (${browserError.message})`);
      }
    }
    
  } catch (playwrightError) {
    safeLog('error', '❌ Playwright package: not installed');
    safeLog('info', '💡 Run: npm install playwright');
  }
  
  safeLog('info', '');
  safeLog('info', '✅ Diagnostics complete');
}

// Run diagnostics
main().catch(error => {
  console.error(`[${new Date().toISOString()}] ❌ Diagnostics failed: ${error.message}`);
  process.exit(1);
});
