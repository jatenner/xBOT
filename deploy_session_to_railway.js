#!/usr/bin/env node

// Deploy Twitter Session to Railway
// Reads the local session and sets it as TWITTER_SESSION_B64 environment variable

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 DEPLOYING TWITTER SESSION TO RAILWAY...');

try {
  // Check if session file exists
  if (!fs.existsSync('data/twitter_session.json')) {
    console.error('❌ No Twitter session found. Run: npm run seed:session');
    process.exit(1);
  }

  // Read and encode session
  const sessionData = fs.readFileSync('data/twitter_session.json', 'utf8');
  const sessionB64 = Buffer.from(sessionData).toString('base64');
  
  console.log('✅ Session file found and encoded');
  console.log(`📊 Session size: ${sessionData.length} chars → ${sessionB64.length} base64 chars`);

  // Set Railway environment variable
  console.log('🔧 Setting TWITTER_SESSION_B64 in Railway...');
  
  try {
    execSync(`railway variables set TWITTER_SESSION_B64="${sessionB64}"`, { 
      stdio: 'inherit',
      timeout: 30000 
    });
    console.log('✅ TWITTER_SESSION_B64 set successfully in Railway');
  } catch (railwayError) {
    console.error('❌ Railway CLI not available or not logged in');
    console.log('📋 MANUAL SETUP REQUIRED:');
    console.log('1. Go to Railway Dashboard → Your Project → Variables');
    console.log('2. Add new variable: TWITTER_SESSION_B64');
    console.log('3. Paste this value (copied to clipboard):');
    console.log('');
    
    // Copy to clipboard as fallback
    try {
      execSync(`echo "${sessionB64}" | pbcopy`);
      console.log('✅ Session base64 copied to clipboard - paste it in Railway Dashboard');
    } catch (e) {
      console.log('💾 Session base64 (copy manually):');
      console.log(sessionB64.substring(0, 100) + '...[truncated]');
    }
  }

  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('1. ✅ Session is ready');
  console.log('2. 🚀 Redeploy Railway service (or it will auto-restart)');
  console.log('3. 📊 Bot will start posting with valid session');
  console.log('');
  console.log('🔍 Monitor deployment: npm run logs');

} catch (error) {
  console.error('❌ Failed to deploy session:', error.message);
  process.exit(1);
}
