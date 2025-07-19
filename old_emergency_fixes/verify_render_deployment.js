console.log('🔍 === RENDER DEPLOYMENT VERIFICATION ===');
console.log('📊 Checking if the bot is properly deployed on Render');

const https = require('https');
const axios = require('axios');

async function verifyDeployment() {
  const renderUrl = 'https://snap2health-xbot.onrender.com';
  
  console.log(`🌐 Testing Render URL: ${renderUrl}`);
  
  // Test different endpoints
  const endpoints = [
    '/health',
    '/',
    '/status',
    '/api/health'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔗 Testing: ${renderUrl}${endpoint}`);
      
      const response = await axios.get(`${renderUrl}${endpoint}`, {
        timeout: 10000,
        validateStatus: () => true // Accept any status
      });
      
      console.log(`📊 Status: ${response.status}`);
      console.log(`📝 Response: ${response.data ? JSON.stringify(response.data).substring(0, 200) : 'No data'}`);
      
      if (response.status === 200) {
        console.log('✅ SUCCESS! Bot is responding');
        return true;
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n📋 DIAGNOSIS:');
  console.log('🔍 The bot might be:');
  console.log('  1. Still deploying (wait 2-3 more minutes)');
  console.log('  2. Failed to start (check Render logs)');
  console.log('  3. Running on wrong port');
  console.log('  4. Environment variables missing');
  
  console.log('\n🚨 NEXT STEPS:');
  console.log('1. Check Render dashboard: https://dashboard.render.com');
  console.log('2. Look at deployment logs');
  console.log('3. Verify environment variables are set');
  console.log('4. Check if service is running');
  
  return false;
}

// Also test local build
async function testLocalBuild() {
  console.log('\n🧪 === TESTING LOCAL BUILD ===');
  
  const fs = require('fs');
  const path = require('path');
  
  const mainFile = path.join(__dirname, 'dist', 'main.js');
  console.log(`📁 Checking: ${mainFile}`);
  
  if (fs.existsSync(mainFile)) {
    console.log('✅ dist/main.js exists');
    const stats = fs.statSync(mainFile);
    console.log(`📊 Size: ${stats.size} bytes`);
    console.log(`📅 Modified: ${stats.mtime}`);
  } else {
    console.log('❌ dist/main.js not found!');
  }
  
  // Check package.json
  const packageJson = require('./package.json');
  console.log(`📦 Package main: ${packageJson.main}`);
  console.log(`🚀 Start script: ${packageJson.scripts.start}`);
  console.log(`🔧 Render start: ${packageJson.scripts['render-start']}`);
}

async function main() {
  await testLocalBuild();
  await verifyDeployment();
}

main().catch(console.error); 