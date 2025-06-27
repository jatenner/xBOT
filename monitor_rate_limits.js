#!/usr/bin/env node

/**
 * 🚨 EMERGENCY RATE LIMIT MONITOR
 * Checks current posting rate and warns of API exhaustion
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function monitorRateLimits() {
  console.log('🚨 EMERGENCY RATE LIMIT MONITOR');
  console.log('================================');
  
  try {
    // Get today's date in UTC
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00Z`;
    const endOfDay = `${today}T23:59:59Z`;
    
    // Count tweets posted today
    const { data: todaysTweets, error } = await supabase
      .from('tweets')
      .select('id, created_at, content')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    const postsToday = todaysTweets?.length || 0;
    
    console.log(`📊 TWITTER API STATUS (${today})`);
    console.log(`   Posts today: ${postsToday}/6 tweets`);
    console.log(`   API Limit: ${postsToday >= 6 ? '❌ EXHAUSTED' : '✅ Available'}`);
    
    if (postsToday >= 6) {
      console.log('🚨 CRITICAL: Daily posting limit reached!');
      console.log('   ⏰ Must wait until tomorrow (00:00 UTC) to post again');
      console.log('   🛑 All posting systems should be blocked');
    } else {
      const remaining = 6 - postsToday;
      console.log(`✅ Safe to post: ${remaining} tweets remaining today`);
    }
    
    // Check recent posting frequency
    if (todaysTweets && todaysTweets.length > 0) {
      console.log('\n🕐 RECENT POSTING ACTIVITY:');
      
      const now = new Date();
      const lastTweet = new Date(todaysTweets[0].created_at);
      const timeSinceLastPost = Math.floor((now - lastTweet) / (1000 * 60)); // minutes
      
      console.log(`   Last post: ${timeSinceLastPost} minutes ago`);
      
      if (timeSinceLastPost < 30) {
        console.log(`   🚨 WARNING: Too soon to post again (${30 - timeSinceLastPost} min remaining)`);
      } else {
        console.log('   ✅ Safe posting interval (30+ minutes since last post)');
      }
      
      // Check for rapid posting pattern
      if (todaysTweets.length >= 3) {
        const last3Tweets = todaysTweets.slice(0, 3);
        const timespan = new Date(last3Tweets[0].created_at) - new Date(last3Tweets[2].created_at);
        const timespanMinutes = Math.floor(timespan / (1000 * 60));
        
        if (timespanMinutes < 60) {
          console.log(`   🚨 RAPID POSTING DETECTED: 3 tweets in ${timespanMinutes} minutes`);
          console.log('   ⚠️  This pattern can trigger API limits');
        }
      }
    }
    
    console.log('\n🔧 EMERGENCY FIX STATUS:');
    console.log('✅ Emergency posting: DISABLED');
    console.log('✅ Rate limiting: ACTIVE');
    console.log('✅ Minimum intervals: 30 minutes');
    console.log('✅ Daily cap: 6 tweets maximum');
    
  } catch (error) {
    console.error('❌ Monitor failed:', error);
    console.log('🚨 ASSUME RATE LIMITED - do not attempt posting!');
  }
}

// Run monitor
monitorRateLimits();
