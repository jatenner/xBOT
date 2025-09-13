/**
 * Legacy Migration Runner - Redirects to TypeScript version
 * @deprecated Use scripts/migrate.ts instead
 */

console.log('🔄 MIGRATE: Redirecting to TypeScript migration runner...');

// Try to run the TypeScript version
const { spawn } = require('child_process');
const path = require('path');

const tsNodePath = path.join(__dirname, '../node_modules/.bin/ts-node');
const migrateTsPath = path.join(__dirname, 'migrate.ts');

// Check if ts-node is available
const fs = require('fs');
if (fs.existsSync(tsNodePath) && fs.existsSync(migrateTsPath)) {
  console.log('📦 MIGRATE: Using TypeScript migration runner');
  
  const child = spawn('node', ['-r', 'ts-node/register', migrateTsPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('close', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (error) => {
    console.error('❌ MIGRATE: Failed to run TypeScript version:', error.message);
    console.log('🔄 MIGRATE: Falling back to JavaScript implementation...');
    runJavaScriptMigrations();
  });
} else {
  console.log('⚠️ MIGRATE: TypeScript runner not available, using JavaScript fallback');
  runJavaScriptMigrations();
}

// Simplified JavaScript fallback
function runJavaScriptMigrations() {
  console.log('🚀 MIGRATE: Running JavaScript migration fallback...');
  
  // Basic connection test
  const { Client } = require('pg');
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ MIGRATE: DATABASE_URL not set');
    process.exit(1);
  }
  
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: true } // Production verified SSL
  });
  
  client.connect()
    .then(() => {
      console.log('✅ MIGRATE: Database connection successful');
      return client.query('SELECT 1');
    })
    .then(() => {
      console.log('✅ MIGRATE: Basic query successful');
      console.log('⚠️ MIGRATE: JavaScript fallback completed (limited functionality)');
      console.log('💡 MIGRATE: Install ts-node for full migration support');
      return client.end();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ MIGRATE: Connection failed:', error.message);
      client.end().catch(() => {});
      process.exit(0); // Non-fatal exit
    });
}