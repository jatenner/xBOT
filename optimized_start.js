#!/usr/bin/env node

/**
 * 🚀 OPTIMIZED STARTUP SCRIPT
 * Fast deployment with runtime optimizations
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 OPTIMIZED STARTUP SEQUENCE STARTING...');
console.log('📅 Start Time:', new Date().toISOString());

// Skip migrations if they've already run successfully
const migrationLockFile = path.join(__dirname, '.migration-complete');
const skipMigrations = fs.existsSync(migrationLockFile);

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Running: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${command} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${command} failed with code ${code}`);
        reject(new Error(`${command} failed`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ ${command} error:`, error);
      reject(error);
    });
  });
}

async function optimizedStartup() {
  try {
    console.log('🎭 Installing Playwright browsers (runtime)...');
    
    // Install Playwright with timeout
    const playwrightTimeout = setTimeout(() => {
      console.log('⚠️ Playwright installation timeout, continuing anyway...');
    }, 60000); // 1 minute timeout

    try {
      await runCommand('npx', ['playwright', 'install', 'chromium', '--force'], {
        timeout: 60000
      });
      clearTimeout(playwrightTimeout);
      console.log('✅ Playwright browsers installed');
    } catch (error) {
      clearTimeout(playwrightTimeout);
      console.log('⚠️ Playwright installation failed, continuing with limited functionality...');
    }

    // Skip time-consuming migrations if already done
    if (skipMigrations) {
      console.log('✅ Migrations already completed, skipping...');
    } else {
      console.log('🗄️ Running essential database setup...');
      try {
        // Only run critical migrations, skip non-essential ones
        await runCommand('node', ['scripts/essential_migrations.js']);
        
        // Mark migrations as complete
        fs.writeFileSync(migrationLockFile, new Date().toISOString());
        console.log('✅ Essential migrations completed');
      } catch (error) {
        console.log('⚠️ Migration failed, continuing with basic functionality...');
      }
    }

    console.log('🤖 Starting autonomous bot...');
    await runCommand('node', ['dist/main.js']);

  } catch (error) {
    console.error('❌ Startup failed:', error);
    
    // Emergency fallback
    console.log('🚨 Starting in emergency mode...');
    process.env.EMERGENCY_MODE = 'true';
    process.env.SKIP_MIGRATIONS = 'true';
    
    try {
      await runCommand('node', ['dist/main.js']);
    } catch (emergencyError) {
      console.error('❌ Emergency startup also failed:', emergencyError);
      process.exit(1);
    }
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('📡 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the optimized sequence
optimizedStartup();