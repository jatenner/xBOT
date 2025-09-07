/**
 * 🚄 SIMPLE RAILWAY SESSION CREATOR
 * 
 * Creates Railway-compatible session from existing Twitter login
 */

const fs = require('fs');
const path = require('path');

async function createRailwaySession() {
  console.log('🚄 SIMPLE_RAILWAY: Creating session for Railway deployment...');
  
  // Check if we have an existing session
  const sessionPath = path.join(process.cwd(), 'data', 'twitter_session.json');
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ SIMPLE_RAILWAY: No existing session found at data/twitter_session.json');
    console.log('💡 SIMPLE_RAILWAY: Please first create a session using one of these methods:');
    console.log('   1. Run: npm run seed:session');
    console.log('   2. Or manually create session following manual_session_setup.md');
    return;
  }
  
  try {
    // Load existing session
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    
    // Add timestamp if missing
    if (!sessionData.timestamp) {
      sessionData.timestamp = Date.now();
    }
    
    // Mark as valid
    sessionData.isValid = true;
    
    // Save updated session
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
    
    // Create base64 version for Railway
    const sessionB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    console.log('✅ SIMPLE_RAILWAY: Session processed successfully!');
    console.log('\\n🔑 RAILWAY ENVIRONMENT VARIABLE:');
    console.log('Copy this value and set it as TWITTER_SESSION_B64 in Railway:');
    console.log('\\n----------------------------------------');
    console.log(sessionB64);
    console.log('----------------------------------------\\n');
    
    // Save to env file
    const envContent = `TWITTER_SESSION_B64=${sessionB64}\\n`;
    fs.writeFileSync('railway_session.env', envContent);
    console.log('💾 SIMPLE_RAILWAY: Also saved to railway_session.env file');
    
    console.log('\\n📋 NEXT STEPS:');
    console.log('1. Copy the TWITTER_SESSION_B64 value above');
    console.log('2. Go to Railway dashboard → Your project → Variables');
    console.log('3. Add new variable: TWITTER_SESSION_B64 = [paste value]');
    console.log('4. Deploy: git push origin main');
    console.log('\\n✅ SIMPLE_RAILWAY: Your bot will then work 24/7 on Railway!');
    
  } catch (error) {
    console.error('❌ SIMPLE_RAILWAY: Error processing session:', error.message);
  }
}

createRailwaySession();

