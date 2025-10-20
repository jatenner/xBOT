/**
 * 🗑️ RESET DATABASE - Wipe all data, keep structure
 * 
 * This script will DELETE ALL DATA from all tables in Supabase
 * Table structures, indexes, and constraints remain intact
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// All tables to truncate
const TABLES_TO_CLEAR = [
  // Core posting and content
  'content_metadata',
  'posted_decisions',
  'outcomes',
  'real_tweet_metrics',
  
  // Learning system
  'learning_posts',
  'learning_insights',
  'tweet_metrics',
  'monitored_posts',
  'metrics_by_phase',
  'performance_patterns',
  
  // Reply and engagement
  'reply_opportunities',
  'engagement_tracking',
  'strategic_replies',
  'viral_reply_history',
  
  // AI and intelligence
  'ai_posting_decisions',
  'ai_learning_insights',
  'generator_performance',
  'content_quality_metrics',
  'topic_performance',
  
  // Timing and optimization
  'timing_predictions',
  'optimal_posting_windows',
  'engagement_windows',
  
  // News and intelligence
  'news_articles',
  'trending_topics',
  'influencer_tracking',
  'peer_content',
  
  // System and tracking
  'openai_usage_log',
  'api_usage',
  'budget_tracking',
  'cost_tracking',
  
  // Follower and growth
  'follower_tracking',
  'growth_metrics',
  'follower_snapshots',
  
  // Content quality
  'content_violations',
  'quality_scores',
  
  // Unified tables
  'unified_posts',
  'posts',
  'tweets',
  'learn_metrics',
  
  // Thread and conversation
  'thread_metadata',
  'conversation_threads',
  
  // Experimentation
  'bandit_arms',
  'experiment_results',
  
  // Session
  'browser_cookies',
  'twitter_sessions',
  
  // Backups
  'data_backup_tweets',
  'data_backup_learning_posts',
  'data_backup_tweet_metrics',
];

async function resetDatabase() {
  console.log('🗑️  DATABASE RESET STARTING...\n');
  console.log('⚠️  WARNING: This will DELETE ALL DATA from all tables!\n');
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const tableName of TABLES_TO_CLEAR) {
    try {
      // First check if table exists
      const { error: checkError } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .limit(1);
      
      if (checkError && checkError.code === '42P01') {
        // Table doesn't exist
        console.log(`⏭️  ${tableName} - doesn't exist, skipping`);
        skipCount++;
        continue;
      }
      
      // Delete all rows
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq('id', 0); // Delete where id != 0 (matches all rows)
      
      if (deleteError) {
        // Try alternative: select all IDs and delete them
        const { data: rows, error: selectError } = await supabase
          .from(tableName)
          .select('id')
          .limit(10000);
        
        if (selectError) {
          console.error(`❌ ${tableName} - ${deleteError.message}`);
          errorCount++;
          continue;
        }
        
        if (rows && rows.length > 0) {
          const ids = rows.map(r => r.id);
          const { error: batchDeleteError } = await supabase
            .from(tableName)
            .delete()
            .in('id', ids);
          
          if (batchDeleteError) {
            console.error(`❌ ${tableName} - ${batchDeleteError.message}`);
            errorCount++;
          } else {
            console.log(`✅ ${tableName} - cleared ${rows.length} rows`);
            successCount++;
          }
        } else {
          console.log(`✅ ${tableName} - already empty`);
          successCount++;
        }
      } else {
        console.log(`✅ ${tableName} - cleared`);
        successCount++;
      }
      
    } catch (error: any) {
      console.error(`❌ ${tableName} - ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n========================================');
  console.log('📊 RESET SUMMARY');
  console.log('========================================');
  console.log(`✅ Successfully cleared: ${successCount} tables`);
  console.log(`⏭️  Skipped (not found): ${skipCount} tables`);
  console.log(`❌ Errors: ${errorCount} tables`);
  console.log('========================================');
  
  if (errorCount === 0) {
    console.log('\n🎉 DATABASE RESET COMPLETE!');
    console.log('✅ All data cleared, tables preserved');
    console.log('✅ Ready for fresh start\n');
  } else {
    console.log('\n⚠️  Some tables had errors, check logs above\n');
  }
}

resetDatabase().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

