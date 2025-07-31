#!/usr/bin/env node

/**
 * 🚀 FORCE POST VIA RAILWAY CLI
 * Triggers an immediate post on the live Railway deployment
 */

const { spawn } = require('child_process');

console.log('🚀 === TRIGGERING FORCE POST ON RAILWAY ===');
console.log('📅 Time:', new Date().toISOString());
console.log('🎯 Goal: Force immediate post bypassing timing restrictions');
console.log('');

// Railway command to execute the immediate post script
const railwayCommand = [
  'railway', 'run', 
  'SKIP_PLAYWRIGHT=true', 
  'FORCE_POST_NOW=true',
  'node', 'immediate_post_now.js'
];

console.log('🔧 Executing Railway command:');
console.log(`   ${railwayCommand.join(' ')}`);
console.log('');

// Spawn the Railway process
const process = spawn(railwayCommand[0], railwayCommand.slice(1), {
  stdio: 'inherit',
  shell: true
});

process.on('close', (code) => {
  console.log('');
  if (code === 0) {
    console.log('✅ Force post command completed successfully!');
    console.log('🎯 Check your Twitter account for the new post');
  } else {
    console.log(`❌ Force post command failed with exit code: ${code}`);
    console.log('💡 Try: npm run logs to check Railway status');
  }
  console.log('');
});

process.on('error', (error) => {
  console.error('❌ Error executing Railway command:', error.message);
  console.log('💡 Make sure Railway CLI is installed: npm install -g @railway/cli');
});