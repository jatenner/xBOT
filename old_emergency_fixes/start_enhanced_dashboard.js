#!/usr/bin/env node

console.log('🎯 === ENHANCED TWITTER BOT DASHBOARD ===');
console.log('Starting real-time monitoring dashboard...\n');

// Import and start the dashboard
const { execSync } = require('child_process');

try {
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n🚀 Starting enhanced dashboard...');
  console.log('📊 Real-time monitoring: ENABLED');
  console.log('🧪 Tweet preview: ENABLED');
  console.log('⚡ Quality checks: ENABLED');
  console.log('📈 Live metrics: ENABLED');
  console.log('\n🌐 Dashboard URL: http://localhost:3001');
  console.log('🔄 Real-time updates every 10 seconds');
  console.log('\n--- DASHBOARD FEATURES ---');
  console.log('✅ Live tweet quality preview');
  console.log('✅ Real-time posting queue status');
  console.log('✅ Bot mind analysis');
  console.log('✅ Content generation testing');
  console.log('✅ Mission alignment monitoring');
  console.log('✅ API quota tracking');
  console.log('✅ Emergency controls');
  console.log('\n--- QUALITY MONITORING ---');
  console.log('🎯 Quality threshold: 60/100');
  console.log('🔍 URL preservation check');
  console.log('🖼️  Unique image rotation');
  console.log('📝 Content diversity tracking');
  console.log('⚖️  Mission alignment validation');
  
  console.log('\n🔥 Starting dashboard server...\n');
  
  // Start the dashboard
  execSync('node dist/dashboard/dashboardLauncher.js', { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ Error starting dashboard:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Check if all dependencies are installed: npm install');
  console.log('2. Verify environment variables are set');
  console.log('3. Check if port 3001 is available');
  console.log('4. Ensure database connection is working');
  process.exit(1);
} 