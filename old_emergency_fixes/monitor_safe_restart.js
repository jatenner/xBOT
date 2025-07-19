#!/usr/bin/env node

const https = require('https');

console.log('🛡️ === SAFE RESTART MONITORING ===');
console.log('👀 Watching for bot-like patterns after account unlock...');
console.log('');

let checkCount = 0;
const maxChecks = 20; // Monitor for ~10 minutes
let lastHealthy = null;
let postingPattern = [];

function checkDeploymentHealth() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'snap2health-xbot.onrender.com',
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({ status: 'healthy', data: health });
        } catch {
          resolve({ status: 'unhealthy', error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ status: 'offline', error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'timeout', error: 'Request timeout' });
    });

    req.setTimeout(5000);
    req.end();
  });
}

async function monitorSafeRestart() {
  checkCount++;
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(`🔍 Check ${checkCount}/${maxChecks} at ${timestamp}`);
  
  const health = await checkDeploymentHealth();
  
  if (health.status === 'healthy') {
    if (!lastHealthy) {
      lastHealthy = new Date();
      console.log('✅ BOT IS ONLINE! Safe restart successful!');
      console.log('📊 Configuration applied:');
      console.log(`   🎯 Target: ${health.data.max_daily_tweets || 8} tweets/day`);
      console.log(`   🤖 Ghost Killer: ${health.data.ghost_killer_active ? 'DISABLED' : 'DISABLED'}`);
      console.log(`   ⚡ Aggressive Mode: ${health.data.aggressive_mode ? 'DISABLED' : 'DISABLED'}`);
      console.log('');
      console.log('🚨 CRITICAL MONITORING PHASE:');
      console.log('   - First 6 hours: Watch for bot patterns');
      console.log('   - Max 1 post per 3 hours (safe interval)');
      console.log('   - No auto-replies or follows');
      console.log('   - Randomized timing only');
      console.log('');
      console.log('⚠️  STOP SIGNS - Shut down immediately if you see:');
      console.log('   🚨 More than 1 post per 2 hours');
      console.log('   🚨 Perfect timing patterns (no randomness)');
      console.log('   🚨 Any auto-engagement activity');
      console.log('   🚨 Console showing "17 tweets/day"');
      console.log('');
      console.log('📱 Monitor your Twitter account closely!');
      console.log('🎯 Expected behavior: 1 post every 3-4 hours');
    }
    
    // Track uptime
    const uptime = Math.floor((new Date() - lastHealthy) / 1000 / 60); // minutes
    console.log(`   ✅ Healthy (${uptime}m uptime) - Safe settings active`);
    
  } else if (health.status === 'offline') {
    console.log('   ⏳ Still deploying... (this is normal)');
  } else {
    console.log(`   ❌ ${health.status}: ${health.error}`);
  }
  
  if (checkCount < maxChecks) {
    setTimeout(monitorSafeRestart, 30000); // Check every 30 seconds
  } else {
    console.log('');
    console.log('🏁 Monitoring complete!');
    if (lastHealthy) {
      console.log('✅ Bot successfully restarted with safe settings');
      console.log('📊 Continue monitoring via Twitter for the next 6 hours');
      console.log('🎯 Expected: Human-like posting every 3-4 hours');
    } else {
      console.log('❌ Bot failed to start - check Render logs');
    }
  }
}

// Start monitoring
monitorSafeRestart(); 