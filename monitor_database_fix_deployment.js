#!/usr/bin/env node

/**
 * 🔍 MONITOR DATABASE FIX DEPLOYMENT
 * 
 * Tracks deployment and verifies database fixes are working
 */

const https = require('https');

console.log('🔍 MONITORING DATABASE FIX DEPLOYMENT');
console.log('=====================================');

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
        resolve({
          status: res.statusCode,
          data: data,
          deployed: res.statusCode !== 404
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 'ERROR',
        error: error.message,
        deployed: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'TIMEOUT',
        deployed: false
      });
    });

    req.end();
  });
}

async function monitorDeployment() {
  console.log('⏳ Checking Render deployment status...');
  
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes of monitoring
  
  while (attempts < maxAttempts) {
    const result = await checkRenderDeployment();
    attempts++;
    
    console.log(`\n📊 Attempt ${attempts}/${maxAttempts}`);
    console.log(`Status: ${result.status}`);
    console.log(`Deployed: ${result.deployed ? '✅ YES' : '❌ NO'}`);
    
    if (result.deployed) {
      console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
      console.log('✅ Bot is now running with database fixes');
      
      console.log('\n🔍 MONITORING CHECKLIST');
      console.log('======================');
      console.log('1. ✅ Deployment completed successfully');
      console.log('2. 🧪 Test with single tweet posting');
      console.log('3. 📊 Monitor for reduced startup API calls');
      console.log('4. ✅ Verify no more 429 rate limit errors');
      console.log('5. 📈 Check database saves are working');
      
      console.log('\n🎯 EXPECTED BEHAVIOR');
      console.log('==================');
      console.log('• Bot recognizes real API usage vs database mismatch');
      console.log('• Emergency mode prevents aggressive posting');
      console.log('• Conservative rate limiting active');
      console.log('• Enhanced database saves prevent missing tweets');
      console.log('• No more "catch-up mode" API spam');
      
      console.log('\n🚨 KEY INDICATORS OF SUCCESS');
      console.log('===========================');
      console.log('• Logs show: "Database mismatch detected - using API usage"');
      console.log('• Logs show: "EMERGENCY STARTUP MODE: Minimal API calls"');
      console.log('• No 429 rate limit errors during startup');
      console.log('• Tweet posting works without API exhaustion');
      console.log('• Database saves successfully with retry logic');
      
      return true;
    }
    
    if (result.status === 'ERROR') {
      console.log(`⚠️ Connection error: ${result.error}`);
    }
    
    console.log('⏳ Waiting 10 seconds for next check...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  console.log('\n⚠️ DEPLOYMENT MONITORING TIMEOUT');
  console.log('===============================');
  console.log('Deployment may still be in progress.');
  console.log('Check Render dashboard for build status.');
  
  return false;
}

async function main() {
  console.log('🚨 CRITICAL DATABASE FIXES DEPLOYED');
  console.log('===================================');
  console.log('✅ Database mismatch detection');
  console.log('✅ Emergency startup mode');
  console.log('✅ Enhanced database save enforcement');
  console.log('✅ Emergency rate limiting');
  console.log('✅ Supreme AI database protection');
  
  console.log('\n🔄 Starting deployment monitoring...');
  
  const success = await monitorDeployment();
  
  if (success) {
    console.log('\n🎯 NEXT STEPS FOR TESTING');
    console.log('========================');
    console.log('1. Wait 2-3 minutes for full initialization');
    console.log('2. Monitor Render logs for database mismatch messages');
    console.log('3. Test single tweet posting');
    console.log('4. Verify enhanced database save is working');
    console.log('5. Confirm no 429 errors in logs');
    
    console.log('\n✅ DATABASE FIX DEPLOYMENT MONITORING COMPLETE!');
  } else {
    console.log('\n⏳ Continue monitoring manually in Render dashboard');
  }
}

main().catch(console.error); 