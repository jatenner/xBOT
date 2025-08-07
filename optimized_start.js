#!/usr/bin/env node

/**
 * 🚀 SIMPLIFIED STARTUP SCRIPT
 * Reliable deployment with minimal dependencies
 */

console.log('🚀 SIMPLIFIED STARTUP SEQUENCE STARTING...');
console.log('📅 Start Time:', new Date().toISOString());

// Set environment optimizations
process.env.NODE_ENV = 'production';
process.env.EMERGENCY_MODE = 'false';

async function simpleStartup() {
  try {
    console.log('🎭 Installing Playwright browsers (background)...');
    
    // Install Playwright in background with timeout
    const { exec } = require('child_process');
    
    const playwrightInstall = exec('npx playwright install chromium --force', {
      timeout: 90000 // 90 seconds max
    });
    
    playwrightInstall.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Playwright browsers installed successfully');
      } else {
        console.log('⚠️ Playwright installation completed with warnings');
      }
    });

    playwrightInstall.on('error', (error) => {
      console.log('⚠️ Playwright installation error (continuing anyway):', error.message);
    });

    // Don't wait for Playwright - start the bot immediately
    console.log('🤖 Starting autonomous bot (Playwright installing in background)...');
    
    // Start the main application
    require('./dist/main.js');

  } catch (error) {
    console.error('❌ Startup failed:', error);
    
    // Emergency fallback - try without any setup
    console.log('🚨 Emergency mode: Starting bot with minimal setup...');
    process.env.EMERGENCY_MODE = 'true';
    process.env.SKIP_PLAYWRIGHT = 'true';
    
    try {
      require('./dist/main.js');
    } catch (emergencyError) {
      console.error('❌ Emergency startup failed:', emergencyError);
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

// Start immediately
simpleStartup();