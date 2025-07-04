#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: Disable All Read Operations
 * Posting works but reads still hit false monthly cap
 * Disable all read operations to eliminate 429 errors
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function disableAllReadOperations() {
  console.log('🚨 === EMERGENCY: DISABLE ALL READ OPERATIONS ===');
  console.log('');
  console.log('✅ POSTING: Working (Tweet ID: 1940863165992202258)');
  console.log('❌ READS: Still hitting false monthly cap (429 errors)');
  console.log('🛠️ SOLUTION: Disable all read operations');
  console.log('');

  try {
    const configs = [
      {
        key: 'emergency_disable_all_reads',
        value: {
          enabled: true,
          disable_search_operations: true,
          disable_engagement_tracking: true,
          disable_competitive_intelligence: true,
          disable_reply_finding: true,
          disable_follow_operations: true,
          disable_trends_analysis: true,
          disable_tweet_fetching: true,
          disable_user_search: true,
          posting_only_mode: true,
          reason: 'False monthly cap affecting reads - disable until resolved',
          timestamp: new Date().toISOString()
        }
      },
      {
        key: 'force_posting_only_mode',
        value: {
          enabled: true,
          allow_posting: true,
          block_all_reads: true,
          block_search: true,
          block_engagement_ops: true,
          reason: 'Keep posting working while reads are broken',
          timestamp: new Date().toISOString()
        }
      }
    ];

    for (const config of configs) {
      const { error } = await supabase
        .from('bot_config')
        .upsert(config);
      
      if (error) {
        console.error(`❌ Failed to apply ${config.key}:`, error);
      } else {
        console.log(`✅ Applied: ${config.key}`);
      }
    }

    console.log('');
    console.log('🎯 EXPECTED RESULTS:');
    console.log('   ✅ Human Expert posting continues');
    console.log('   ✅ No more 429 "monthly cap exceeded" errors');
    console.log('   ✅ Supreme AI strategies will work');
    console.log('   ❌ Engagement tracking temporarily disabled');
    console.log('   ❌ Search operations temporarily disabled');
    console.log('');
    console.log('💡 This is a temporary fix until the false monthly cap is resolved');

  } catch (error) {
    console.error('❌ Emergency disable failed:', error);
  }
}

if (require.main === module) {
  disableAllReadOperations();
}

module.exports = { disableAllReadOperations }; 