#!/usr/bin/env node

/**
 * 🔧 FIX SESSION COOKIES
 * Fixes the cookie expiration format issue
 */

const fs = require('fs');
const path = require('path');

const sessionPath = path.join(__dirname, 'data', 'twitter_session.json');

console.log('🔧 Fixing session cookie format...');

try {
  // Read current session
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  
  console.log(`📋 Found ${sessionData.cookies?.length || 0} cookies`);
  
  // Fix cookie expiration format
  const fixedCookies = sessionData.cookies.map(cookie => {
    const fixed = { ...cookie };
    
    // Convert expires to proper Unix timestamp in seconds
    if (fixed.expires && typeof fixed.expires === 'number') {
      // If it's already in milliseconds, convert to seconds
      if (fixed.expires > 9999999999) {
        fixed.expires = Math.floor(fixed.expires / 1000);
      }
    } else {
      // Set expiration to 1 year from now in seconds
      fixed.expires = Math.floor((Date.now() + (365 * 24 * 60 * 60 * 1000)) / 1000);
    }
    
    return fixed;
  });
  
  // Update session data
  sessionData.cookies = fixedCookies;
  
  // Save fixed session
  fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
  
  console.log('✅ Session cookies fixed successfully!');
  console.log(`📊 Fixed ${fixedCookies.length} cookies`);
  console.log('');
  console.log('🧪 Now test your session:');
  console.log('   node test-x-automation.js');
  
} catch (error) {
  console.error('❌ Error fixing session cookies:', error.message);
  process.exit(1);
}
