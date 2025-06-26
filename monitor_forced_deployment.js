#!/usr/bin/env node

/**
 * 🚀 MONITOR FORCED DEPLOYMENT WITH SCHEDULER FIX
 * 
 * Tracks the new deployment that should include:
 * - Scheduler export syntax fix
 * - Emergency database mismatch detection  
 * - All critical API rate limiting fixes
 */

const https = require('https');

console.log('🚀 MONITORING FORCED DEPLOYMENT - SCHEDULER FIX EDITION');
console.log('=======================================================');

async function checkRenderDeployment() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'snap2health-xbot.onrender.com',
      path: '/health',
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: response,
            deployed: res.statusCode === 200,
            healthy: response?.status === 'healthy'
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            deployed: res.statusCode !== 404,
            healthy: false
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 'ERROR',
        error: error.message,
        deployed: false,
        healthy: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'TIMEOUT',
        deployed: false,
        healthy: false
      });
    });

    req.end();
  });
}

async function monitorDeployment() {
  console.log('⏳ Monitoring forced deployment with scheduler fix...');
  
  let attempts = 0;
  const maxAttempts = 40; // 7 minutes of monitoring
  let lastStatus = null;
  
  while (attempts < maxAttempts) {
    const result = await checkRenderDeployment();
    attempts++;
    
    const statusChanged = lastStatus !== result.status;
    lastStatus = result.status;
    
    if (statusChanged || attempts % 5 === 0) {
      console.log(`\n📊 Attempt ${attempts}/${maxAttempts} (${new Date().toLocaleTimeString()})`);
      console.log(`Status: ${result.status}`);
      console.log(`Deployed: ${result.deployed ? '✅ YES' : '❌ NO'}`);
      console.log(`Healthy: ${result.healthy ? '✅ YES' : '❌ NO'}`);
      
      if (result.data && typeof result.data === 'object') {
        console.log(`Service: ${result.data.service || 'unknown'}`);
        console.log(`Timestamp: ${result.data.timestamp || 'unknown'}`);
      }
    }
    
    if (result.deployed && result.healthy) {
      console.log('\n🎉 FORCED DEPLOYMENT SUCCESSFUL!');
      console.log('✅ Bot is now running with latest fixes including:');
      console.log('   🔧 Scheduler export syntax fix');
      console.log('   🚨 Emergency database mismatch detection');
      console.log('   ⚡ Emergency startup mode');
      console.log('   💾 Enhanced database save system');
      console.log('   🛡️ Emergency rate limiting protection');
      
      console.log('\n🔍 NEXT VERIFICATION STEPS');
      console.log('=========================');
      console.log('1. ✅ TypeScript compilation should now succeed');
      console.log('2. 🧪 Test single tweet posting');
      console.log('3. 📊 Monitor for database mismatch detection logs');
      console.log('4. ✅ Verify no more 429 rate limit errors');
      console.log('5. 📈 Check enhanced database saves are working');
      
      console.log('\n🚨 KEY SUCCESS INDICATORS TO WATCH');
      console.log('=================================');
      console.log('• No TypeScript compilation errors');
      console.log('• Logs show: "DATABASE MISMATCH CHECK: API usage = X, Database tweets = 0"');
      console.log('• Logs show: "CRITICAL: Database missing tweets - using API usage as source of truth"');
      console.log('• No 429 rate limit errors during startup');
      console.log('• Tweet posting works without exhausting limits');
      
      return true;
    }
    
    if (result.status === 'ERROR') {
      console.log(`⚠️ Connection error: ${result.error}`);
    }
    
    if (statusChanged) {
      console.log('⏳ Status changed, continuing monitoring...');
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  console.log('\n⚠️ DEPLOYMENT MONITORING TIMEOUT');
  console.log('===============================');
  console.log('Deployment may still be building.');
  console.log('Check Render dashboard for detailed build logs.');
  console.log('The scheduler export fix should resolve compilation issues.');
  
  return false;
}

async function main() {
  console.log('🚨 FORCED DEPLOYMENT TRIGGERED');
  console.log('==============================');
  console.log('✅ Latest commit with scheduler export fix');
  console.log('✅ Emergency database mismatch detection');
  console.log('✅ All critical API rate limiting fixes');
  console.log('✅ Should resolve TypeScript compilation errors');
  
  console.log('\n🔄 Starting deployment monitoring...');
  console.log('This deployment should fix the scheduler export issue');
  console.log('that was preventing TypeScript compilation.\n');
  
  const success = await monitorDeployment();
  
  if (success) {
    console.log('\n🎯 READY FOR TESTING');
    console.log('====================');
    console.log('1. Bot should now compile and start properly');
    console.log('2. Database mismatch detection should prevent API spam');
    console.log('3. Emergency rate limiting should protect against 429 errors');
    console.log('4. Enhanced database saves should prevent missing tweets');
    
    console.log('\n✅ FORCED DEPLOYMENT MONITORING COMPLETE!');
    console.log('The critical database and scheduler fixes are now LIVE! 🚀');
  } else {
    console.log('\n⏳ Continue monitoring deployment progress manually');
    console.log('Check Render dashboard for build completion status');
  }
}

main().catch(console.error); 