#!/usr/bin/env node

console.log('🤖 === REMOTE BOT MONITOR ===');
console.log('Connecting to your deployed bot on Render...\n');

// Import and start the monitor
const { execSync } = require('child_process');

try {
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n🔍 Starting Remote Bot Monitor...');
  console.log('📡 Real-time connection to Render deployment: ENABLED');
  console.log('🧠 Bot consciousness tracking: ACTIVE');
  console.log('📊 Live performance monitoring: ENABLED');
  console.log('⚡ Activity feed: STREAMING');
  console.log('\n🌐 Monitor URL: http://localhost:3002');
  console.log('🔄 Live updates every 5 seconds');
  console.log('\n--- WHAT YOU\'LL SEE ---');
  console.log('🧠 Real-time bot thinking patterns');
  console.log('📡 Live activity feed from deployed bot');
  console.log('⚖️  Current decision factors');
  console.log('📊 Performance metrics and trends');
  console.log('🎯 Mission progress tracking');
  console.log('⚡ Cognitive load and confidence levels');
  console.log('\n--- CONNECTION INFO ---');
  console.log('🏗️  Deployed on: Render');
  console.log('🗄️  Database: Supabase (shared connection)');
  console.log('🔐 Environment: Production data');
  console.log('👀 View-only monitoring (safe to use)');
  
  console.log('\n🔥 Launching monitor interface...\n');
  
  // Start the remote monitor
  execSync('node dist/dashboard/remoteBotMonitorLauncher.js', { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ Error starting remote monitor:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Check if all dependencies are installed: npm install');
  console.log('2. Verify environment variables (.env file)');
  console.log('3. Check if port 3002 is available');
  console.log('4. Ensure Supabase connection is working');
  console.log('5. Verify your bot is deployed and running on Render');
  process.exit(1);
} 