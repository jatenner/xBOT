/**
 * 🚀 ONE-TIME TWITTER USER ID CACHING SCRIPT
 * 
 * Run this once to cache your Twitter user ID and eliminate 429 rate limit errors.
 * After running this, the bot will never need to call client.v2.me() again.
 */

import { TwitterApi } from 'twitter-api-v2';
import { cacheUserId, validateCacheStatus } from '../utils/userIdCache';
import * as dotenv from 'dotenv';

dotenv.config();

async function cacheTwitterUserId() {
  console.log('🔍 === TWITTER USER ID CACHING UTILITY ===\n');

  // Check current cache status
  const status = validateCacheStatus();
  console.log(`📋 Current cache status:`);
  console.log(`   User ID: ${status.hasUserId ? '✅ Cached' : '❌ Missing'}`);
  console.log(`   Username: ${status.hasUsername ? '✅ Cached' : '❌ Missing'}`);
  console.log(`   Source: ${status.source}`);
  
  if (status.cacheAge) {
    console.log(`   Age: ${Math.round(status.cacheAge / (1000 * 60 * 60))} hours`);
  }

  // If we already have cached data and environment variable, we're good
  if (process.env.TWITTER_USER_ID && status.hasUserId) {
    console.log('\n✅ Twitter user ID already cached and in environment!');
    console.log(`👤 User ID: ${process.env.TWITTER_USER_ID}`);
    console.log('🚫 No API calls needed - 429 errors prevented!');
    return;
  }

  // Make ONE-TIME API call to get user ID
  try {
    console.log('\n🔄 Making ONE-TIME API call to get user credentials...');
    console.log('🚨 This is the LAST TIME we will call the Twitter API for user info!');

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    });

    const user = await client.v2.me();
    const userId = user.data.id;
    const username = user.data.username;

    console.log(`✅ Retrieved user credentials:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Username: @${username}`);

    // Cache the credentials
    cacheUserId(userId, username);

    console.log('\n🎯 === NEXT STEPS ===');
    console.log('1. Add this to your Render environment variables:');
    console.log(`   TWITTER_USER_ID=${userId}`);
    console.log(`   TWITTER_USERNAME=${username}`);
    
    console.log('\n2. After setting env vars, redeploy your service');
    console.log('\n✅ Future API calls eliminated - no more 429 errors!');
    
  } catch (error: any) {
    console.error('\n❌ Failed to fetch user credentials:', error.message);
    
    if (error.code === 429) {
      console.log('\n🚨 You are already hitting rate limits!');
      console.log('💡 Set these environment variables manually to fix:');
      console.log('   TWITTER_USER_ID=1751423413  # Replace with your actual user ID');
      console.log('   TWITTER_USERNAME=SignalAndSynapse  # Replace with your username');
    }
  }
}

// Export for testing
export { cacheTwitterUserId };

// Run if called directly
if (require.main === module) {
  cacheTwitterUserId().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} 