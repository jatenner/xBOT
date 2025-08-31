#!/usr/bin/env node

/**
 * 🔐 RESTORE TWITTER SESSION
 * 
 * Restores the Twitter session using the environment variable
 */

require('dotenv').config();

async function restoreTwitterSession() {
  console.log('🔐 === RESTORING TWITTER SESSION ===');
  console.log('🎯 Goal: Restore Twitter authentication for browser posting');
  console.log('⏰ Start Time:', new Date().toLocaleString());
  console.log('');

  try {
    const fs = require('fs').promises;
    const path = require('path');

    // Check if we have the session data in environment
    const sessionB64 = process.env.TWITTER_SESSION_B64;
    
    if (!sessionB64) {
      console.error('❌ TWITTER_SESSION_B64 environment variable not found');
      console.log('💡 This should contain the base64-encoded Twitter session data');
      return { success: false, error: 'Missing TWITTER_SESSION_B64' };
    }

    console.log('✅ Found TWITTER_SESSION_B64 environment variable');
    console.log(`📏 Session data length: ${sessionB64.length} characters`);

    // Decode the session data
    let sessionData;
    try {
      const decoded = Buffer.from(sessionB64, 'base64').toString('utf-8');
      sessionData = JSON.parse(decoded);
      console.log('✅ Successfully decoded session data');
    } catch (decodeError) {
      console.error('❌ Failed to decode session data:', decodeError.message);
      return { success: false, error: 'Invalid session data format' };
    }

    // Ensure data directory exists
    const dataDir = './data';
    try {
      await fs.mkdir(dataDir, { recursive: true });
      console.log('✅ Data directory ready');
    } catch (dirError) {
      console.warn('⚠️ Could not create data directory:', dirError.message);
    }

    // Write session file
    const sessionPath = path.join(dataDir, 'twitter_session.json');
    try {
      await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
      console.log(`✅ Twitter session restored to: ${sessionPath}`);
      
      // Verify the file
      const stats = await fs.stat(sessionPath);
      console.log(`📊 Session file size: ${stats.size} bytes`);
      
      return { success: true, sessionPath, fileSize: stats.size };
    } catch (writeError) {
      console.error('❌ Failed to write session file:', writeError.message);
      return { success: false, error: writeError.message };
    }

  } catch (error) {
    console.error('❌ Session restoration failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the session restoration
if (require.main === module) {
  restoreTwitterSession()
    .then(result => {
      if (result.success) {
        console.log('\n✅ TWITTER SESSION RESTORED SUCCESSFULLY!');
        console.log('🚀 System should now be able to post to Twitter');
        process.exit(0);
      } else {
        console.error('\n❌ TWITTER SESSION RESTORATION FAILED!');
        console.error('🔧 Browser posting will not work without valid session');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal session restoration error:', error);
      process.exit(1);
    });
}

module.exports = { restoreTwitterSession };
