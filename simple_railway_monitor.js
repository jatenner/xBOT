#!/usr/bin/env node

/**
 * 🔍 SIMPLE RAILWAY MONITOR
 * No fancy features, just reliable log viewing
 */

const { spawn } = require('child_process');

console.log('🚂 Simple Railway Monitor Starting...');
console.log('=====================================');
console.log('📱 Press Ctrl+C to stop monitoring');
console.log('');

function startLogs() {
  console.log('🔍 Fetching Railway logs...');
  
  const logProcess = spawn('railway', ['logs'], {
    stdio: ['inherit', 'inherit', 'inherit']
  });

  logProcess.on('close', (code) => {
    console.log(`\n🛑 Railway logs stopped (code: ${code})`);
    console.log('⏰ Waiting 5 seconds before reconnecting...');
    
    setTimeout(() => {
      console.log('🔄 Reconnecting to Railway logs...\n');
      startLogs();
    }, 5000);
  });

  logProcess.on('error', (error) => {
    console.error('❌ Railway log error:', error.message);
    console.log('⏰ Waiting 10 seconds before retry...');
    
    setTimeout(() => {
      console.log('🔄 Retrying Railway logs...\n');
      startLogs();
    }, 10000);
  });

  return logProcess;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping Railway monitor...');
  process.exit(0);
});

// Start monitoring
startLogs();
