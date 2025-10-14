#!/usr/bin/env node

/**
 * RAILWAY VARIABLE VERIFICATION
 * Check if the aggressive configuration has been deployed
 */

const https = require('https');

console.log('🔍 RAILWAY VARIABLE VERIFICATION');
console.log('=================================');
console.log('');

// Expected aggressive values
const EXPECTED_VALUES = {
  JOBS_PLAN_INTERVAL_MIN: '15',
  JOBS_REPLY_INTERVAL_MIN: '20', 
  JOBS_POSTING_INTERVAL_MIN: '5',
  MAX_POSTS_PER_HOUR: '2',
  JOBS_AUTOSTART: 'true',
  MODE: 'live'
};

console.log('🧪 TESTING DEPLOYED CONFIGURATION...');
console.log('');

// Make a request to our health endpoint to check current config
const healthUrl = 'https://snap2health-xbot-production.up.railway.app/config';

console.log(`📡 Checking: ${healthUrl}`);
console.log('');

const req = https.get(healthUrl, { timeout: 10000 }, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const config = JSON.parse(data);
      
      console.log('✅ CONFIGURATION RETRIEVED:');
      console.log('===========================');
      console.log('');
      
      let allCorrect = true;
      
      Object.entries(EXPECTED_VALUES).forEach(([key, expectedValue]) => {
        const actualValue = String(config[key] || 'NOT_SET');
        const isCorrect = actualValue === expectedValue;
        
        if (!isCorrect) allCorrect = false;
        
        const status = isCorrect ? '✅' : '❌';
        console.log(`${status} ${key}: ${actualValue} ${isCorrect ? '' : `(expected: ${expectedValue})`}`);
      });
      
      console.log('');
      
      if (allCorrect) {
        console.log('🎉 SUCCESS: All variables correctly deployed!');
        console.log('============================================');
        console.log('');
        console.log('Your system should now be operating with:');
        console.log('   📝 Content planning every 15 minutes');
        console.log('   💬 Reply generation every 20 minutes');
        console.log('   📮 Posting queue checks every 5 minutes');
        console.log('   🎯 2 posts + 3 replies per hour');
        console.log('');
        console.log('🔍 Monitor with: npm run logs');
        console.log('📊 Expect: Jobs: Plans>0 Posts>0 Replies>0 within 15 minutes');
        
      } else {
        console.log('⚠️ DEPLOYMENT INCOMPLETE');
        console.log('========================');
        console.log('');
        console.log('Some variables are missing or incorrect.');
        console.log('Please deploy the missing variables via Railway dashboard:');
        console.log('');
        console.log('1. Go to: https://railway.app');
        console.log('2. Open your xBOT project');
        console.log('3. Variables tab → Add/Update the ❌ variables above');
        console.log('4. Redeploy the service');
        console.log('5. Re-run this verification: node verify-deployment.js');
      }
      
    } catch (error) {
      console.log('❌ Failed to parse configuration response');
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ NETWORK ERROR:', error.message);
  console.log('');
  console.log('💡 Possible causes:');
  console.log('   • Railway service not deployed yet');
  console.log('   • Network connectivity issues');
  console.log('   • Service still starting up');
  console.log('');
  console.log('🔄 Try again in 2-3 minutes after deployment');
});

req.on('timeout', () => {
  console.log('⏰ REQUEST TIMEOUT');
  console.log('');
  console.log('Service may be starting up or under heavy load.');
  console.log('Try again in a few minutes.');
  req.destroy();
});

console.log('⏳ Waiting for response...');
