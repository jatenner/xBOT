#!/usr/bin/env node

/**
 * 🚨 EMERGENCY SIMPLE START
 * Bypasses all complex operations - just runs the bot
 */

console.log('🚨 EMERGENCY SIMPLE START');
console.log('📅 Start Time:', new Date().toISOString());

// Set emergency environment
process.env.NODE_ENV = 'production';
process.env.EMERGENCY_MODE = 'true';
process.env.SKIP_PLAYWRIGHT = 'true';
process.env.SKIP_MIGRATIONS = 'true';

console.log('🤖 Starting bot in EMERGENCY mode (no Playwright, no migrations)...');

try {
  // Just start the main app directly
  require('./dist/main.js');
} catch (error) {
  console.error('❌ Emergency start failed:', error);
  console.log('🆘 Trying absolute minimal startup...');
  
  // Last resort - try to start with absolute minimal setup
  try {
    const path = require('path');
    const mainPath = path.join(__dirname, 'dist', 'main.js');
    require(mainPath);
  } catch (finalError) {
    console.error('💀 All startup methods failed:', finalError);
    process.exit(1);
  }
}