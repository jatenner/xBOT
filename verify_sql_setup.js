#!/usr/bin/env node

/**
 * 🔍 VERIFY SQL SETUP SCRIPT
 * 
 * Tests the new rate limiting database setup after running fix_supabase_sql_error.sql
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verifySetup() {
  console.log('🔍 Verifying Rate Limiting SQL Setup...\n');

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing Supabase credentials');
    console.log('   SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '❌');
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('1️⃣ Testing Database Connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('bot_config')
      .select('count', { count: 'exact' });

    if (connectionError) {
      console.log('❌ Database connection failed:', connectionError.message);
      return false;
    }
    console.log('✅ Database connection successful\n');

    console.log('2️⃣ Checking Real Twitter Limits Configuration...');
    const { data: limitsConfig, error: limitsError } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'real_twitter_limits');

    if (limitsError) {
      console.log('❌ Error checking limits config:', limitsError.message);
      return false;
    }

    if (limitsConfig && limitsConfig.length > 0) {
      console.log('✅ Real Twitter limits configuration found:');
      const config = limitsConfig[0].value;
      console.log('   3-hour limit:', config.tweets_3_hour?.limit || 'Not set');
      console.log('   24-hour limit:', config.tweets_24_hour?.limit || 'Not set');
      console.log('   Enabled:', config.enabled ? '✓' : '❌');
      console.log('   Artificial limits removed:', config.artificial_limits_removed ? '✓' : '❌');
    } else {
      console.log('❌ Real Twitter limits configuration not found');
      return false;
    }
    console.log('');

    console.log('3️⃣ Checking Rate Limit Tracking Table...');
    const { data: rateLimitTable, error: tableError } = await supabase
      .from('real_twitter_rate_limits')
      .select('*');

    if (tableError) {
      console.log('❌ Error checking rate limit table:', tableError.message);
      return false;
    }

    if (rateLimitTable && rateLimitTable.length > 0) {
      console.log('✅ Rate limit tracking table found:');
      for (const window of rateLimitTable) {
        console.log(`   ${window.window_type}: ${window.tweets_used}/${window.window_type === '3_hour' ? '300' : '2400'} used`);
        console.log(`   Window ends: ${new Date(window.window_end).toLocaleString()}`);
      }
    } else {
      console.log('⚠️ Rate limit tracking table empty - will be initialized on startup');
    }
    console.log('');

    console.log('4️⃣ Testing Database Functions...');
    
    // Test increment function
    const { error: incrementError } = await supabase.rpc('increment_tweet_count');
    if (incrementError) {
      console.log('❌ increment_tweet_count function failed:', incrementError.message);
      return false;
    }
    console.log('✅ increment_tweet_count function working');

    // Test reset function
    const { error: resetError } = await supabase.rpc('reset_rate_limit_window', {
      window_type_param: '3_hour'
    });
    if (resetError) {
      console.log('❌ reset_rate_limit_window function failed:', resetError.message);
      return false;
    }
    console.log('✅ reset_rate_limit_window function working');
    console.log('');

    console.log('5️⃣ Checking Runtime Configuration...');
    const { data: runtimeConfig, error: runtimeError } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'runtime_config');

    if (runtimeError) {
      console.log('❌ Error checking runtime config:', runtimeError.message);
      return false;
    }

    if (runtimeConfig && runtimeConfig.length > 0) {
      console.log('✅ Runtime configuration found:');
      const config = runtimeConfig[0].value;
      console.log('   Posting strategy:', config.postingStrategy || 'Not set');
      console.log('   Artificial limits removed:', config.artificial_limits_removed ? '✓' : '❌');
      console.log('   Max daily tweets (deprecated):', config.maxDailyTweets || 'Removed ✓');
      console.log('   Monthly budget (deprecated):', config.monthlyTweetBudget || 'Removed ✓');
    } else {
      console.log('⚠️ Runtime configuration not found');
    }
    console.log('');

    console.log('6️⃣ Checking Artificial Limits Removal...');
    const { data: artificialLimits, error: artificialError } = await supabase
      .from('bot_config')
      .select('key')
      .in('key', [
        'emergency_monthly_cap_mode',
        'monthly_cap_emergency_mode',
        'daily_tweet_limit',
        'monthly_tweet_limit'
      ]);

    if (artificialError) {
      console.log('❌ Error checking artificial limits:', artificialError.message);
    } else {
      const remainingLimits = artificialLimits?.length || 0;
      if (remainingLimits === 0) {
        console.log('✅ All artificial limits removed from database');
      } else {
        console.log(`⚠️ ${remainingLimits} artificial limit configurations still present`);
        artificialLimits?.forEach(limit => console.log(`   - ${limit.key}`));
      }
    }
    console.log('');

    console.log('7️⃣ Environment Variables Check...');
    console.log('   TWITTER_USER_ID:', process.env.TWITTER_USER_ID ? '✓ Set' : '❌ Missing');
    console.log('   TWITTER_BEARER_TOKEN:', process.env.TWITTER_BEARER_TOKEN ? '✓ Set' : '❌ Missing');
    console.log('   TWITTER_API_KEY:', process.env.TWITTER_API_KEY ? '✓ Set' : '❌ Missing');
    console.log('');

    console.log('🎉 SQL Setup Verification Complete!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. If TWITTER_USER_ID is missing, run: node get_twitter_user_id.js');
    console.log('2. Deploy your bot with: npm start');
    console.log('3. Monitor logs for "REAL TWITTER LIMITS" messages');
    console.log('4. Verify no more "/users/me" API calls in logs');
    console.log('');
    console.log('✅ Your bot can now post up to 300 tweets per 3-hour window!');

    return true;

  } catch (error) {
    console.log('❌ Verification failed:', error.message);
    return false;
  }
}

// Run verification
verifySetup().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Verification script failed:', error);
  process.exit(1);
}); 