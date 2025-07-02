#!/usr/bin/env node

/**
 * 🔍 GET TWITTER USER ID SCRIPT
 * 
 * Fetches the numeric user ID for @SignalAndSynapse using Twitter API v2
 * This replaces the /users/me calls that were hitting the 25/day limit
 */

const { TwitterApi } = require('twitter-api-v2');

async function getUserId() {
  console.log('🔍 Fetching user ID for @SignalAndSynapse...');
  
  try {
    // Check environment variables
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    
    if (!bearerToken && (!accessToken || !accessSecret || !apiKey || !apiSecret)) {
      console.log('❌ Missing Twitter API credentials');
      console.log('');
      console.log('🔧 MANUAL SOLUTION:');
      console.log('');
      console.log('1. Go to: https://developer.twitter.com/en/docs/twitter-api/tools-and-libraries/console');
      console.log('2. Select "Users" -> "User lookup" -> "Users by username"');
      console.log('3. Enter username: SignalAndSynapse');
      console.log('4. Copy the numeric ID from the response');
      console.log('5. Add to your .env file: TWITTER_USER_ID=<numeric_id>');
      console.log('');
      console.log('OR use curl:');
      console.log('curl -X GET "https://api.twitter.com/2/users/by/username/SignalAndSynapse" \\');
      console.log('  -H "Authorization: Bearer YOUR_BEARER_TOKEN"');
      
      return;
    }
    
    // Try with Bearer token first (read-only, doesn't count against /users/me limit)
    let client;
    if (bearerToken) {
      client = new TwitterApi(bearerToken);
    } else {
      // Fallback to full auth
      client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });
    }
    
    // Fetch user by username (this is different from /users/me)
    const user = await client.v2.userByUsername('SignalAndSynapse');
    
    if (user.data) {
      console.log('✅ Success!');
      console.log('');
      console.log(`📋 User ID: ${user.data.id}`);
      console.log(`👤 Username: ${user.data.username}`);
      console.log(`📛 Display Name: ${user.data.name}`);
      console.log('');
      console.log('🔧 Add this to your .env file:');
      console.log(`TWITTER_USER_ID=${user.data.id}`);
      console.log('');
      console.log('✅ This eliminates the need for /users/me calls that hit the 25/day limit!');
      
    } else {
      console.log('❌ User not found');
    }
    
  } catch (error) {
    console.log('❌ Error fetching user ID:', error.code || error.message);
    
    if (error.code === 401) {
      console.log('');
      console.log('🔧 Authentication failed. Try this manual approach:');
      console.log('');
      console.log('1. Visit: https://x.com/SignalAndSynapse');
      console.log('2. View page source (Ctrl+U)');
      console.log('3. Search for "rest_id" - the number after it is the user ID');
      console.log('4. Add to .env: TWITTER_USER_ID=<that_number>');
    } else if (error.code === 400) {
      console.log('');
      console.log('🔧 Invalid request format. Manual solution:');
      console.log('');
      console.log('Use the Twitter Developer Console:');
      console.log('https://developer.twitter.com/en/docs/twitter-api/tools-and-libraries/console');
      console.log('Navigate to: Users -> User lookup -> Users by username');
      console.log('Enter: SignalAndSynapse');
    }
    
    console.log('');
    console.log('💡 Alternative: Check existing tweets in your database');
    console.log('   The author_id field contains your user ID');
  }
}

// Run the script
getUserId().catch(console.error); 