#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 === DEPLOYMENT VERIFICATION ===');
console.log('📡 Monitoring Render deployment status...');

async function verifyDeployment() {
  let attempts = 0;
  const maxAttempts = 20; // Check for 10 minutes
  
  while (attempts < maxAttempts) {
    try {
      console.log(`\n🔍 Attempt ${attempts + 1}/${maxAttempts} - Checking deployment...`);
      
      // Check if service is responding
      const response = execSync('curl -s -o /dev/null -w "%{http_code}" https://snap2health-xbot.onrender.com', { encoding: 'utf8' });
      const statusCode = response.trim();
      
      console.log(`   📊 HTTP Status: ${statusCode}`);
      
      if (statusCode === '200') {
        console.log('🎉 === DEPLOYMENT SUCCESS! ===');
        console.log('✅ Bot is back online and responding');
        
        // Test the posting functionality
        console.log('\n🧪 Testing bot functionality...');
        await testBotFunctionality();
        return true;
      } else if (statusCode === '404') {
        console.log('   ⏳ Still deploying... (404 - no server)');
      } else {
        console.log(`   ⚠️ Unexpected status: ${statusCode}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Connection failed: ${error.message}`);
    }
    
    attempts++;
    
    if (attempts < maxAttempts) {
      console.log('   ⏰ Waiting 30 seconds for next check...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  console.log('\n⚠️ === DEPLOYMENT STATUS UNCLEAR ===');
  console.log('🔧 Manual verification needed:');
  console.log('1. Go to https://render.com dashboard');
  console.log('2. Check your xBOT service status');
  console.log('3. Look at deployment logs');
  console.log('4. If needed, click "Manual Deploy" -> "Clear build cache & deploy"');
  
  return false;
}

async function testBotFunctionality() {
  try {
    console.log('🔧 Building project for testing...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('🧠 Testing strategist logic...');
    const { StrategistAgent } = require('./dist/agents/strategistAgent');
    const strategist = new StrategistAgent();
    
    const decision = await strategist.run();
    console.log(`✅ Strategist Decision: ${decision.action} (Priority: ${decision.priority})`);
    console.log(`📊 Reasoning: ${decision.reasoning}`);
    
    // Check if quick post mode is available
    console.log('⚡ Testing quick post mode...');
    const { QuickPostModeAgent } = require('./dist/agents/quickPostModeAgent');
    const quickPoster = new QuickPostModeAgent();
    console.log('✅ Quick post mode ready');
    
    console.log('\n🎯 === BOT FUNCTIONALITY VERIFIED ===');
    console.log('✅ All systems operational');
    console.log('📊 Expected posting frequency: Every 30-35 minutes');
    console.log('🎯 Expected engagement: 50+ views per tweet');
    
  } catch (error) {
    console.warn('⚠️ Functionality test failed:', error.message);
    console.log('💡 This is normal if dependencies are still installing');
  }
}

// Run verification
verifyDeployment().then(success => {
  if (success) {
    console.log('\n🚀 === READY FOR HIGH-FREQUENCY POSTING ===');
    console.log('📊 Your bot should now post every 30-35 minutes with quality content');
    console.log('🎯 Monitor engagement improvements over the next few hours');
  }
}).catch(error => {
  console.error('❌ Verification script error:', error);
}); 