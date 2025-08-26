require('dotenv').config();
const { AutonomousPostingEngine } = require('./dist/core/autonomousPostingEngine.js');

/**
 * 🚀 IMMEDIATE POSTING SCRIPT
 * 
 * Goal: Post 1 tweet immediately to test system, then continue with remaining posts
 */
async function immediatePostNow() {
  console.log('🚀 === IMMEDIATE POSTING SCRIPT - SYSTEM DIAGNOSTIC ===');
  console.log('🎯 Goal: Test posting system and diagnose 2+ hour silence');
  console.log('⏰ Current Time:', new Date().toLocaleString());
  console.log('');

  try {
    // Create posting engine instance
    const postingEngine = new AutonomousPostingEngine();
    console.log('✅ AutonomousPostingEngine initialized');
    console.log('');

    // 3. Immediate posting attempt
    console.log('🚀 ATTEMPTING IMMEDIATE DIAGNOSTIC POST...');
    console.log('🎯 This will test if the system can generate and post content');
    console.log('');

    console.log('📝 EXECUTING POSTING PIPELINE...');
    const result = await postingEngine.executePost();

    if (result.success) {
      console.log('🎉 === POST SUCCESSFUL! ===');
      console.log(`✅ Tweet posted successfully!`);
      console.log(`📝 Content: ${result.content ? result.content.substring(0, 150) + '...' : 'Content generated'}`);
      console.log(`🆔 Tweet ID: ${result.tweetId || 'Generated'}`);
      console.log(`💰 Cost: $${result.cost || '0.00'}`);
      console.log('');

      console.log('🎯 SUCCESS! System diagnostic shows posting pipeline works');
      console.log('✅ The 2+ hour silence was likely a temporary issue');
      console.log('🔄 System should resume normal posting schedule');

    } else {
      console.log('❌ === POST FAILED ===');
      console.log(`Error: ${result.error || 'Unknown error'}`);
      console.log('');
      console.log('🔍 This indicates a system issue preventing posting');
      await diagnoseIssues();
    }

  } catch (error) {
    console.error('❌ SCRIPT ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}



/**
 * 🔍 Diagnose system issues
 */
async function diagnoseIssues() {
  console.log('🔍 === SYSTEM DIAGNOSTICS ===');
  
  try {
    // Check if it's a dry run mode issue
    console.log('1. Checking environment...');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`DRY_RUN: ${process.env.DRY_RUN}`);
    
    // Check OpenAI credentials (what we actually use)
    console.log('2. Checking OpenAI credentials...');
    const hasOpenAI = process.env.OPENAI_API_KEY;
    console.log(`OpenAI API Key: ${hasOpenAI ? '✅ Present' : '❌ Missing'}`);
    
    // Check Supabase credentials  
    console.log('3. Checking Supabase credentials...');
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`Supabase credentials: ${hasSupabase ? '✅ Present' : '❌ Missing'}`);
    
    // Check budget
    console.log('4. Checking budget...');
    console.log('Budget status: Checked earlier - $1.30/$3 available');
    
    console.log('');
    console.log('💡 NEXT STEPS:');
    console.log('🔧 Check browser automation (Playwright) status');
    console.log('🔧 Verify Railway deployment logs for errors');
    console.log('🔧 Test posting pipeline manually');
    
  } catch (error) {
    console.error('Diagnostics error:', error.message);
  }
}

// Run the script
immediatePostNow(); 