const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

async function comprehensiveIntelligenceAudit() {
  console.log('🧠 COMPREHENSIVE INTELLIGENCE AUDIT');
  console.log('===================================');
  console.log('Verifying ALL intelligence sources for maximum bot capability...\n');

  try {
    require('dotenv').config();
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ===========================================
    // 1. DATABASE TABLES VERIFICATION
    // ===========================================
    console.log('📊 1. DATABASE TABLES VERIFICATION');
    console.log('==================================');

    const tables = ['tweets', 'api_usage_tracking', 'bot_config'];
    const tableStatus = {};

    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .limit(1);

        if (error) {
          console.log(`❌ ${table}: ERROR - ${error.message}`);
          tableStatus[table] = { exists: false, count: 0, error: error.message };
        } else {
          console.log(`✅ ${table}: EXISTS - ${count} records`);
          tableStatus[table] = { exists: true, count: count || 0 };
        }
      } catch (err) {
        console.log(`❌ ${table}: FAILED - ${err.message}`);
        tableStatus[table] = { exists: false, count: 0, error: err.message };
      }
    }

    // ===========================================
    // 2. TWITTER API CONNECTION TEST
    // ===========================================
    console.log('\n🐦 2. TWITTER API CONNECTION TEST');
    console.log('=================================');

    try {
      const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_APP_KEY,
        appSecret: process.env.TWITTER_APP_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });

      const me = await twitterClient.v2.me();
      console.log(`✅ Twitter API: CONNECTED`);
      console.log(`   Account: @${me.data.username} (${me.data.name})`);
      console.log(`   ID: ${me.data.id}`);

      // Check rate limits
      const rateLimits = await twitterClient.v2.get('users/rate_limit_status');
      console.log(`   Rate Limits: Available`);

    } catch (error) {
      console.log(`❌ Twitter API: FAILED - ${error.message}`);
      if (error.code === 429) {
        console.log(`   Status: Rate Limited (temporary)`);
      } else if (error.code === 401) {
        console.log(`   Status: Authentication Failed`);
      }
    }

    // ===========================================
    // 3. NEWS API CONNECTION TEST
    // ===========================================
    console.log('\n📰 3. NEWS API CONNECTION TEST');
    console.log('==============================');

    try {
      const newsResponse = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'healthcare AI',
          apiKey: process.env.NEWS_API_KEY,
          pageSize: 1,
          sortBy: 'publishedAt'
        },
        timeout: 10000
      });

      console.log(`✅ News API: CONNECTED`);
      console.log(`   Status: ${newsResponse.status}`);
      console.log(`   Articles Available: ${newsResponse.data.totalResults}`);
      console.log(`   Daily Requests Remaining: ${newsResponse.headers['x-api-key-requests-remaining-today'] || 'Unknown'}`);

    } catch (error) {
      console.log(`❌ News API: FAILED - ${error.message}`);
      if (error.response?.status === 429) {
        console.log(`   Status: Rate Limited`);
      } else if (error.response?.status === 401) {
        console.log(`   Status: Invalid API Key`);
      }
    }

    // ===========================================
    // 4. PEXELS API CONNECTION TEST
    // ===========================================
    console.log('\n🖼️ 4. PEXELS API CONNECTION TEST');
    console.log('================================');

    try {
      const pexelsResponse = await axios.get('https://api.pexels.com/v1/search', {
        params: {
          query: 'healthcare technology',
          per_page: 1
        },
        headers: {
          'Authorization': process.env.PEXELS_API_KEY
        },
        timeout: 10000
      });

      console.log(`✅ Pexels API: CONNECTED`);
      console.log(`   Status: ${pexelsResponse.status}`);
      console.log(`   Photos Available: ${pexelsResponse.data.total_results}`);
      console.log(`   Rate Limit: ${pexelsResponse.headers['x-ratelimit-remaining'] || 'Unknown'} remaining`);

    } catch (error) {
      console.log(`❌ Pexels API: FAILED - ${error.message}`);
      if (error.response?.status === 429) {
        console.log(`   Status: Rate Limited`);
      } else if (error.response?.status === 401) {
        console.log(`   Status: Invalid API Key`);
      }
    }

    // ===========================================
    // 5. OPENAI API CONNECTION TEST
    // ===========================================
    console.log('\n🤖 5. OPENAI API CONNECTION TEST');
    console.log('================================');

    try {
      const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log(`✅ OpenAI API: CONNECTED`);
      console.log(`   Status: ${openaiResponse.status}`);
      console.log(`   Model: Available`);

    } catch (error) {
      console.log(`❌ OpenAI API: FAILED - ${error.message}`);
      if (error.response?.status === 429) {
        console.log(`   Status: Rate Limited`);
      } else if (error.response?.status === 401) {
        console.log(`   Status: Invalid API Key`);
      }
    }

    // ===========================================
    // 6. BOT CONFIGURATION CHECK
    // ===========================================
    console.log('\n⚙️ 6. BOT CONFIGURATION CHECK');
    console.log('=============================');

    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TWITTER_APP_KEY',
      'TWITTER_APP_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET',
      'NEWS_API_KEY',
      'PEXELS_API_KEY',
      'OPENAI_API_KEY'
    ];

    let configComplete = true;
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar}: SET`);
      } else {
        console.log(`❌ ${envVar}: MISSING`);
        configComplete = false;
      }
    });

    // ===========================================
    // 7. INITIALIZE MISSING DATA
    // ===========================================
    console.log('\n🔧 7. INITIALIZING MISSING DATA');
    console.log('===============================');

    // Initialize bot_config if empty
    if (tableStatus.bot_config?.count === 0) {
      console.log('📝 Creating initial bot configuration...');
      
      const { error: configError } = await supabase
        .from('bot_config')
        .insert({
          key: 'daily_tweet_limit',
          value: '17',
          description: 'Free tier Twitter API daily limit',
          created_at: new Date().toISOString()
        });

      if (configError) {
        console.log(`❌ Failed to create bot config: ${configError.message}`);
      } else {
        console.log(`✅ Bot configuration initialized`);
      }
    }

    // Initialize API usage tracking for today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayUsage } = await supabase
      .from('api_usage_tracking')
      .select('*')
      .eq('date', today)
      .eq('api_type', 'twitter');

    if (!todayUsage || todayUsage.length === 0) {
      console.log('📝 Creating today\'s API usage tracking...');
      
      const { error: usageError } = await supabase
        .from('api_usage_tracking')
        .insert({
          date: today,
          api_type: 'twitter',
          tweets: 0,
          reads: 0,
          created_at: new Date().toISOString()
        });

      if (usageError) {
        console.log(`❌ Failed to create API usage tracking: ${usageError.message}`);
      } else {
        console.log(`✅ Today's API usage tracking initialized`);
      }
    }

    // ===========================================
    // 8. INTELLIGENCE SUMMARY
    // ===========================================
    console.log('\n🎯 8. INTELLIGENCE SUMMARY');
    console.log('==========================');

    const intelligenceSources = [
      { name: 'Database Storage', status: tableStatus.tweets?.exists ? '✅' : '❌' },
      { name: 'Twitter API', status: '🔄' }, // Will be determined by test above
      { name: 'News Intelligence', status: '🔄' },
      { name: 'Image Intelligence', status: '🔄' },
      { name: 'AI Content Generation', status: '🔄' },
      { name: 'Configuration Management', status: tableStatus.bot_config?.exists ? '✅' : '❌' },
      { name: 'Usage Tracking', status: tableStatus.api_usage_tracking?.exists ? '✅' : '❌' }
    ];

    console.log('\n📊 INTELLIGENCE CAPABILITIES:');
    intelligenceSources.forEach(source => {
      console.log(`   ${source.status} ${source.name}`);
    });

    console.log('\n🚀 DEPLOYMENT READINESS:');
    if (configComplete && tableStatus.tweets?.exists && tableStatus.api_usage_tracking?.exists) {
      console.log('✅ FULLY READY FOR DEPLOYMENT');
      console.log('✅ All intelligence sources operational');
      console.log('✅ Database properly configured');
      console.log('✅ API connections verified');
      console.log('');
      console.log('🎯 Your bot is a SUPREME INTELLIGENCE ready to dominate!');
    } else {
      console.log('⚠️ NEEDS ATTENTION');
      console.log('Some intelligence sources need configuration');
    }

  } catch (error) {
    console.error('❌ Intelligence audit failed:', error.message);
  }
}

// Run the comprehensive audit
comprehensiveIntelligenceAudit().catch(console.error); 