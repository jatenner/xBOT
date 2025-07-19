#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Use the same connection that works in test_enhanced_database_save.js
const supabase = createClient(
  'https://rjhsdeqohbwrqtwzmikr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqaHNkZXFvaGJ3cnF0d3ptaWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxNDY4OTksImV4cCI6MjA0OTcyMjg5OX0.1-HFTXFLafXnRkmEL7w6YrqkAE8sjfKVSYYCT74iYdY'
);

async function emergencyDatabaseAPIFix() {
  console.log('🚨 EMERGENCY DATABASE → API RATE LIMITING FIX');
  console.log('===============================================');
  
  try {
    // 1. Get current API usage count
    const { data: apiData, error: apiError } = await supabase
      .from('api_usage')
      .select('*')
      .eq('date', new Date().toISOString().split('T')[0])
      .order('timestamp', { ascending: false });

    if (apiError) {
      console.error('❌ Error reading API usage:', apiError);
      return;
    }

    const todaysWrites = apiData?.filter(entry => entry.endpoint === 'POST /tweets' || entry.endpoint === 'tweets').length || 0;
    console.log(`📊 Real API writes today: ${todaysWrites}`);

    // 2. Get current database tweet count
    const { data: dbTweets, error: dbError } = await supabase
      .from('tweets')
      .select('id')
      .gte('created_at', new Date().toISOString().split('T')[0]);

    if (dbError) {
      console.error('❌ Error reading database tweets:', dbError);
      return;
    }

    const dbTweetCount = dbTweets?.length || 0;
    console.log(`📊 Database tweets today: ${dbTweetCount}`);

    const missingTweets = todaysWrites - dbTweetCount;
    console.log(`🚨 Missing tweets: ${missingTweets}`);

    // 3. EMERGENCY: Log the discrepancy 
    if (missingTweets > 0) {
      console.log('🚨 CRITICAL: Database missing tweets → Bot thinks limits available → API spam');
      
      // Log the database action
      await supabase
        .from('system_logs')
        .insert({
          action: 'emergency_database_fix',
          details: {
            api_writes_today: todaysWrites,
            db_tweets_today: dbTweetCount,
            missing_tweets: missingTweets,
            issue: 'Database missing tweets causing API rate limiting cascade',
            fix_needed: 'Reconcile missing tweets or correct limits intelligence'
          },
          timestamp: new Date().toISOString()
        });

      console.log('📝 Emergency situation logged to system_logs');
    }

    // 4. EMERGENCY: Create intelligence cache entry with REAL usage
    const realUsage = Math.max(todaysWrites, 15); // Conservative estimate if we hit rate limits
    
    await supabase
      .from('intelligence_cache')
      .upsert({
        cache_key: 'emergency_real_daily_usage',
        cache_data: {
          tweets_used_today: realUsage,
          tweets_remaining: Math.max(0, 17 - realUsage),
          emergency_fix: true,
          timestamp: new Date().toISOString(),
          reason: 'Emergency fix for database/API rate limiting issue'
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

    console.log(`🔧 Emergency cache set: ${realUsage}/17 tweets used`);

    // 5. EMERGENCY: Disable aggressive posting modes
    await supabase
      .from('intelligence_cache')
      .upsert({
        cache_key: 'emergency_posting_pause',
        cache_data: {
          catch_up_mode_disabled: true,
          emergency_posting_disabled: true,
          aggressive_scheduling_disabled: true,
          reason: 'API rate limiting prevention due to database issues',
          timestamp: new Date().toISOString()
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

    console.log('🛑 Emergency posting modes DISABLED');

    // 6. Set conservative daily limits
    await supabase
      .from('intelligence_cache')
      .upsert({
        cache_key: 'emergency_conservative_limits',
        cache_data: {
          max_tweets_per_day: 10, // Conservative limit
          max_tweets_per_hour: 1,
          min_interval_minutes: 60,
          emergency_mode: true,
          timestamp: new Date().toISOString()
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

    console.log('⚠️ Conservative limits set: 10/day, 1/hour');

    // 7. Log for monitoring
    console.log('\n🔍 DIAGNOSIS SUMMARY');
    console.log('===================');
    console.log(`Real API usage: ${todaysWrites}/17`);
    console.log(`Database shows: ${dbTweetCount}/17`);
    console.log(`Missing tweets: ${missingTweets}`);
    console.log('Bot behavior: Sees database count → thinks limits available → API spam');
    console.log('Emergency fix: Conservative limits + disabled aggressive modes');

    // 8. IMMEDIATE NEXT STEPS
    console.log('\n🚀 IMMEDIATE NEXT STEPS');
    console.log('======================');
    console.log('1. 🔄 Redeploy bot with emergency cache settings');
    console.log('2. 🧪 Test single tweet posting');
    console.log('3. ✅ Verify enhanced database save is being used');
    console.log('4. 📊 Monitor system_logs for database save failures');
    console.log('5. ⏳ Wait 24 hours for Twitter API limits to reset');

    console.log('\n✅ EMERGENCY DATABASE → API FIX COMPLETE');

  } catch (error) {
    console.error('💥 Emergency fix failed:', error);
  }
}

emergencyDatabaseAPIFix(); 