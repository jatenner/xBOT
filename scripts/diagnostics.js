/**
 * Database Diagnostics Script
 * Tests database connectivity, SSL settings, and basic operations
 */

const { Client } = require('pg');

// Safe logging utility
function safeLog(level, message) {
  const timestamp = new Date().toISOString();
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  
  // Mask any potential secrets
  const masked = typeof message === 'string' ? message
    .replace(/(postgres|postgresql):\/\/[^@]*@/gi, '$1://***:***@')
    .replace(/(sk-[a-zA-Z0-9_\-]+)/g, 'sk-***') : message;
    
  logFn(`[${timestamp}] ${masked}`);
}

async function runDiagnostics() {
  safeLog('info', '🔍 DB DIAGNOSTICS: Starting database connectivity tests...');
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    safeLog('error', '❌ DB DIAGNOSTICS: DATABASE_URL environment variable is missing');
    process.exit(1);
  }

  // Log connection info
  try {
    const url = new URL(connectionString.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    safeLog('info', `🔗 DB_HOST: ${url.hostname}:${url.port || 5432}`);
    
    if (url.searchParams.get('sslmode')) {
      safeLog('info', `🔒 SSL_MODE: ${url.searchParams.get('sslmode')}`);
    } else {
      safeLog('warn', '⚠️ SSL_MODE: No sslmode parameter found in DATABASE_URL');
    }
  } catch (parseError) {
    safeLog('warn', `⚠️ URL_PARSE: Could not parse DATABASE_URL: ${parseError.message}`);
  }

  let client;
  let success = false;
  
  try {
    // Test 1: Basic Connection
    safeLog('info', '🔄 TEST 1: Testing basic database connection...');
    client = new Client({ connectionString });
    await client.connect();
    safeLog('info', '✅ TEST 1: Database connection successful');
    
    // Test 2: Current Time Query
    safeLog('info', '🔄 TEST 2: Testing basic query (SELECT NOW())...');
    const timeResult = await client.query('SELECT NOW() as current_time');
    safeLog('info', `✅ TEST 2: Query successful - Current time: ${timeResult.rows[0].current_time}`);
    
    // Test 3: SSL Settings
    safeLog('info', '🔄 TEST 3: Checking SSL settings...');
    try {
      const sslResult = await client.query("SELECT current_setting('ssl') as ssl_enabled");
      safeLog('info', `✅ TEST 3: SSL enabled: ${sslResult.rows[0].ssl_enabled}`);
    } catch (sslError) {
      safeLog('warn', `⚠️ TEST 3: Could not check SSL setting: ${sslError.message}`);
    }
    
    // Test 4: Schema Check
    safeLog('info', '🔄 TEST 4: Checking schema_migrations table...');
    try {
      const migrationResult = await client.query(`
        SELECT COUNT(*) as migration_count 
        FROM schema_migrations
      `);
      safeLog('info', `✅ TEST 4: Found ${migrationResult.rows[0].migration_count} applied migrations`);
    } catch (migrationError) {
      if (migrationError.code === '42P01') { // relation does not exist
        safeLog('info', '📊 TEST 4: schema_migrations table not found (will be created by migration runner)');
      } else {
        safeLog('warn', `⚠️ TEST 4: Migration table error: ${migrationError.message}`);
      }
    }
    
    // Test 5: Test Insert (api_usage table)
    safeLog('info', '🔄 TEST 5: Testing safe insert operation...');
    try {
      const insertResult = await client.query(`
        INSERT INTO api_usage (provider, model, cost_usd, tokens_in, tokens_out, metadata)
        VALUES ('diagnostic-test', 'test-model', 0, 0, 0, '{"test": true, "timestamp": "${new Date().toISOString()}"}')
        RETURNING id, created_at
      `);
      
      const testId = insertResult.rows[0].id;
      const createdAt = insertResult.rows[0].created_at;
      
      safeLog('info', `✅ TEST 5: Insert successful - ID: ${testId}, Created: ${createdAt}`);
      
      // Clean up test record
      await client.query('DELETE FROM api_usage WHERE id = $1', [testId]);
      safeLog('info', '✅ TEST 5: Test record cleaned up successfully');
      
    } catch (insertError) {
      if (insertError.code === '42P01') { // relation does not exist
        safeLog('info', '📊 TEST 5: api_usage table not found (will be created by migration runner)');
      } else {
        safeLog('error', `❌ TEST 5: Insert test failed: ${insertError.code} - ${insertError.message}`);
      }
    }
    
    // Test 6: Database Version
    safeLog('info', '🔄 TEST 6: Checking database version...');
    try {
      const versionResult = await client.query('SELECT version() as db_version');
      const version = versionResult.rows[0].db_version;
      const shortVersion = version.split(' ').slice(0, 2).join(' ');
      safeLog('info', `✅ TEST 6: Database version: ${shortVersion}`);
    } catch (versionError) {
      safeLog('warn', `⚠️ TEST 6: Could not get version: ${versionError.message}`);
    }
    
    success = true;
    safeLog('info', '🎉 DB DIAGNOSTICS: All tests completed successfully!');
    
  } catch (error) {
    safeLog('error', `❌ DB DIAGNOSTICS: Connection failed - ${error.code || 'UNKNOWN'}: ${error.message}`);
    
    // Provide helpful guidance
    if (error.message.includes('self-signed certificate') || error.message.includes('certificate')) {
      safeLog('info', '💡 TIP: Ensure DATABASE_URL has sslmode=require and system CA certificates are available');
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      safeLog('info', '💡 TIP: Check network connectivity and DATABASE_URL host/port');
    } else if (error.message.includes('authentication')) {
      safeLog('info', '💡 TIP: Verify database credentials in DATABASE_URL');
    }
    
  } finally {
    if (client) {
      try {
        await client.end();
        safeLog('info', '🔌 DB DIAGNOSTICS: Connection closed');
      } catch (closeError) {
        safeLog('warn', `⚠️ DB DIAGNOSTICS: Error closing connection: ${closeError.message}`);
      }
    }
  }
  
  if (success) {
    safeLog('info', '✅ DB DIAGNOSTICS OK');
    process.exit(0);
  } else {
    safeLog('error', '❌ DB DIAGNOSTICS FAILED');
    process.exit(1);
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  safeLog('error', `❌ DB DIAGNOSTICS: Unexpected error - ${error.message}`);
  process.exit(1);
});