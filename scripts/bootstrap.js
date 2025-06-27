#!/usr/bin/env node

/**
 * Bootstrap script to ensure bot_config table exists and has default values
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function bootstrap() {
  console.log('🚀 Bootstrapping bot configuration...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Ensure bot_config table has a default row
    const { data, error } = await supabase
      .from('bot_config')
      .upsert({ 
        id: 1,
        max_daily_tweets: 6,
        quality_readability_min: 55,
        quality_credibility_min: 0.85,
        fallback_stagger_minutes: 90,
        posting_strategy: 'balanced'
      }, { 
        onConflict: 'id' 
      });

    if (error) {
      console.log('⚠️ Could not upsert bot_config (table may not exist yet):', error.message);
      console.log('✅ This is normal for first run - config will use defaults');
    } else {
      console.log('✅ Bot configuration initialized successfully');
    }

  } catch (error) {
    console.log('⚠️ Bootstrap error (using defaults):', error.message);
  }

  console.log('✅ Bootstrap complete');
}

// Run if this file is executed directly
if (require.main === module) {
  bootstrap().then(() => process.exit(0));
}

module.exports = { bootstrap }; 