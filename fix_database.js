#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDatabase() {
  console.log('🔧 Fixing database configuration...');

  try {
    // Initialize control_flags table
    console.log('📊 Initializing control_flags...');
    const { error: controlError } = await supabase
      .from('control_flags')
      .upsert([
        { key: 'DISABLE_BOT', value: 'false', description: 'Master kill switch for the bot' },
        { key: 'MAX_DAILY_TWEETS', value: '25', description: 'Maximum tweets per day for viral growth' },
        { key: 'VIRAL_MODE', value: 'true', description: 'Enable viral growth mode' },
        { key: 'ENGAGEMENT_THRESHOLD', value: '10000', description: 'Target engagement per viral tweet' }
      ], { onConflict: 'key' });

    if (controlError) {
      console.error('❌ Error initializing control_flags:', controlError);
    } else {
      console.log('✅ Control flags initialized');
    }

    // Initialize prompt_features table
    console.log('📝 Initializing prompt_features...');
    const { error: promptError } = await supabase
      .from('prompt_features')
      .upsert([
        { 
          variant_of_the_day: 'viral_breakthrough',
          last_updated: new Date().toISOString(),
          description: 'Current viral content variant'
        }
      ]);

    if (promptError) {
      console.error('❌ Error initializing prompt_features:', promptError);
    } else {
      console.log('✅ Prompt features initialized');
    }

    // Initialize api_usage table
    console.log('📈 Initializing api_usage...');
    const { error: apiError } = await supabase
      .from('api_usage')
      .upsert([
        {
          date: new Date().toISOString().split('T')[0],
          tweets_posted: 0,
          replies_posted: 0,
          openai_requests: 0,
          twitter_api_calls: 0,
          daily_budget_used: 0,
          viral_tweets_count: 0
        }
      ], { onConflict: 'date' });

    if (apiError) {
      console.error('❌ Error initializing api_usage:', apiError);
    } else {
      console.log('✅ API usage tracking initialized');
    }

    console.log('🎉 Database configuration fixed successfully!');
    console.log('🚀 Bot is now ready for viral growth mode');

  } catch (error) {
    console.error('💥 Failed to fix database:', error);
    process.exit(1);
  }
}

fixDatabase(); 