#!/usr/bin/env node

/**
 * 🚀 RAILWAY STATUS CHECKER
 * Quick status check of the bot running on Railway
 */

const { spawn } = require('child_process');

console.log('📊 === RAILWAY BOT STATUS CHECK ===');
console.log('📅 Time:', new Date().toISOString());
console.log('');

// Check Railway status via logs
console.log('🔍 Checking recent activity (last 20 lines)...');
console.log('');

const logsProcess = spawn('railway', ['logs', '--tail', '20'], {
  stdio: 'inherit',
  shell: true
});

logsProcess.on('close', (code) => {
  console.log('');
  if (code === 0) {
    console.log('✅ Status check completed');
    console.log('💡 For live monitoring: npm run logs');
    console.log('🚀 To force post now: npm run force-post');
  } else {
    console.log('❌ Failed to get status');
    console.log('💡 Make sure Railway CLI is installed and authenticated');
  }
});

logsProcess.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('💡 Install Railway CLI: npm install -g @railway/cli');
});