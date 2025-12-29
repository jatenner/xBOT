/**
 * Apply database migrations using Supabase client
 * More reliable than raw pg client in Railway environment
 */

import 'dotenv/config';

async function applyMigrations() {
  console.log('[MIGRATION] 🚀 Starting database migration...\n');
  
  try {
    // Use Supabase client (handles SSL automatically)
    const { getSupabaseClient } = await import('../src/db/index.js');
    const supabase = getSupabaseClient();
    
    console.log('[MIGRATION] ✅ Connected to Supabase\n');
    
    // Test connection
    const { error: testError } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Connection test failed: ${testError.message}`);
    }
    
    console.log('[MIGRATION] ✅ Connection verified\n');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 1: ENGAGEMENT TIERS (reply_opportunities)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[MIGRATION] 📊 Phase 1: Engagement Tiers...\n');
    
    // Use raw SQL via rpc (Supabase function)
    const migrations = [
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT',
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT',
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT',
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0',
      'CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier ON reply_opportunities(engagement_tier)',
      'CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 ON reply_opportunities(opportunity_score_v2 DESC)',
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 2: PERFORMANCE ANALYTICS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `CREATE TABLE IF NOT EXISTS reply_performance_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dimension_type TEXT NOT NULL,
        dimension_value TEXT NOT NULL,
        reply_count INTEGER DEFAULT 0,
        avg_followers_gained NUMERIC(10,2) DEFAULT 0,
        avg_reply_likes NUMERIC(10,2) DEFAULT 0,
        avg_impressions NUMERIC(10,2) DEFAULT 0,
        avg_profile_clicks NUMERIC(10,2) DEFAULT 0,
        confidence_score NUMERIC(5,4) DEFAULT 0,
        sample_size INTEGER DEFAULT 0,
        roi_score NUMERIC(10,2) DEFAULT 0,
        performance_tier TEXT,
        measurement_start TIMESTAMPTZ NOT NULL,
        measurement_end TIMESTAMPTZ NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      'CREATE INDEX IF NOT EXISTS idx_perf_analytics_dimension ON reply_performance_analytics(dimension_type, dimension_value)',
      'CREATE INDEX IF NOT EXISTS idx_perf_analytics_updated ON reply_performance_analytics(updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_perf_analytics_roi ON reply_performance_analytics(roi_score DESC)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_analytics_unique ON reply_performance_analytics(dimension_type, dimension_value, measurement_start)',
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 3: DISCOVERED ACCOUNTS ENHANCEMENT
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS avg_followers_per_reply NUMERIC(10,2) DEFAULT 0',
      'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS performance_tier TEXT',
      'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS last_high_value_reply_at TIMESTAMPTZ',
      'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS total_replies_count INTEGER DEFAULT 0',
      'CREATE INDEX IF NOT EXISTS idx_discovered_accounts_performance ON discovered_accounts(performance_tier, avg_followers_per_reply DESC)',
      'CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_success ON discovered_accounts(last_high_value_reply_at DESC)'
    ];
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      const shortDesc = sql.substring(0, 60) + '...';
      
      try {
        // Execute raw SQL using DATABASE_URL connection
        const { Client } = await import('pg');
        const pgClient = new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.DATABASE_URL?.includes('sslmode=require') 
            ? { rejectUnauthorized: false } 
            : false
        });
        
        await pgClient.connect();
        await pgClient.query(sql);
        await pgClient.end();
        
        console.log(`[MIGRATION] ✅ ${i + 1}/${migrations.length}: ${shortDesc}`);
        successCount++;
      } catch (error: any) {
        if (error.code === '42701' || error.code === '42P07') {
          // Column or table already exists
          console.log(`[MIGRATION] ℹ️  ${i + 1}/${migrations.length}: ${shortDesc} (already exists)`);
          skipCount++;
        } else if (error.message?.includes('already exists')) {
          console.log(`[MIGRATION] ℹ️  ${i + 1}/${migrations.length}: ${shortDesc} (already exists)`);
          skipCount++;
        } else {
          console.error(`[MIGRATION] ❌ ${i + 1}/${migrations.length}: ${shortDesc}`);
          console.error(`[MIGRATION]    Error: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ℹ️  Skipped (already exists): ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📊 Total: ${migrations.length}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (errorCount === 0) {
      console.log('✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
      console.log('\n🎉 Adaptive learning system is now fully activated!\n');
      process.exit(0);
    } else {
      console.log('⚠️  SOME MIGRATIONS FAILED - Please review errors above');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('[MIGRATION] ❌ Fatal error:', error.message);
    console.error('[MIGRATION] Stack:', error.stack);
    process.exit(1);
  }
}

applyMigrations();

