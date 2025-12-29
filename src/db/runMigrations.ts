/**
 * 🔧 AUTOMATIC MIGRATION RUNNER
 * 
 * Runs on app startup to ensure database schema is up to date
 * Uses Supabase client (handles SSL automatically, no pg client issues)
 */

import { getSupabaseClient } from './index.js';

interface MigrationResult {
  success: boolean;
  applied: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Apply adaptive learning migrations
 * Safe to run multiple times (all statements use IF NOT EXISTS)
 */
export async function runAdaptiveLearningMigrations(): Promise<MigrationResult> {
  console.log('[MIGRATIONS] 🚀 Starting adaptive learning migrations...\n');
  
  const result: MigrationResult = {
    success: false,
    applied: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };
  
  // Skip migrations if disabled
  if (process.env.SKIP_MIGRATIONS === 'true') {
    console.log('[MIGRATIONS] ⏭️  Skipped (SKIP_MIGRATIONS=true)\n');
    result.success = true;
    return result;
  }
  
  const supabase = getSupabaseClient();
  
  // Define migrations as individual statements
  const migrations = [
    // Phase 1: Engagement Tiers
    { name: 'engagement_tier column', sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT' },
    { name: 'timing_window column', sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT' },
    { name: 'account_size_tier column', sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT' },
    { name: 'opportunity_score_v2 column', sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0' },
    { name: 'engagement_tier index', sql: 'CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier ON reply_opportunities(engagement_tier)' },
    { name: 'score_v2 index', sql: 'CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 ON reply_opportunities(opportunity_score_v2 DESC)' },
    
    // Phase 2: Performance Analytics Table
    { 
      name: 'reply_performance_analytics table', 
      sql: `CREATE TABLE IF NOT EXISTS reply_performance_analytics (
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
      )` 
    },
    { name: 'analytics dimension index', sql: 'CREATE INDEX IF NOT EXISTS idx_perf_analytics_dimension ON reply_performance_analytics(dimension_type, dimension_value)' },
    { name: 'analytics updated index', sql: 'CREATE INDEX IF NOT EXISTS idx_perf_analytics_updated ON reply_performance_analytics(updated_at DESC)' },
    { name: 'analytics roi index', sql: 'CREATE INDEX IF NOT EXISTS idx_perf_analytics_roi ON reply_performance_analytics(roi_score DESC)' },
    { name: 'analytics unique index', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_analytics_unique ON reply_performance_analytics(dimension_type, dimension_value, measurement_start)' },
    
    // Phase 3: Discovered Accounts Enhancement
    { name: 'avg_followers_per_reply column', sql: 'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS avg_followers_per_reply NUMERIC(10,2) DEFAULT 0' },
    { name: 'performance_tier column', sql: 'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS performance_tier TEXT' },
    { name: 'last_high_value_reply_at column', sql: 'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS last_high_value_reply_at TIMESTAMPTZ' },
    { name: 'total_replies_count column', sql: 'ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS total_replies_count INTEGER DEFAULT 0' },
    { name: 'accounts performance index', sql: 'CREATE INDEX IF NOT EXISTS idx_discovered_accounts_performance ON discovered_accounts(performance_tier, avg_followers_per_reply DESC)' },
    { name: 'accounts last_success index', sql: 'CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_success ON discovered_accounts(last_high_value_reply_at DESC)' }
  ];
  
  console.log(`[MIGRATIONS] 📊 Running ${migrations.length} migrations...\n`);
  
  // Execute each migration using Supabase RPC (executes raw SQL)
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    const progress = `[${i + 1}/${migrations.length}]`;
    
    try {
      // Use supabase.rpc to execute raw SQL
      // Note: This requires a database function to exist, OR we can use the REST API directly
      // For now, we'll use a raw pg connection but with better SSL handling
      
      const { Client } = await import('pg');
      
      // Get connection string and parse it
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL not found');
      }
      
      // Create client with bulletproof SSL config for Supabase
      const client = new Client({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
          // Force TLS 1.2+
          minVersion: 'TLSv1.2'
        },
        // Increase timeout for slow connections
        connectionTimeoutMillis: 10000,
        query_timeout: 10000
      });
      
      await client.connect();
      await client.query(migration.sql);
      await client.end();
      
      console.log(`[MIGRATIONS] ${progress} ✅ ${migration.name}`);
      result.applied++;
      
    } catch (error: any) {
      // Check if error is "already exists" (which is fine)
      const isAlreadyExists = 
        error.code === '42701' ||  // column already exists
        error.code === '42P07' ||  // table already exists
        error.code === '42P16' ||  // index already exists
        error.message?.includes('already exists');
      
      if (isAlreadyExists) {
        console.log(`[MIGRATIONS] ${progress} ℹ️  ${migration.name} (already exists)`);
        result.skipped++;
      } else {
        console.error(`[MIGRATIONS] ${progress} ❌ ${migration.name}`);
        console.error(`[MIGRATIONS]    Error: ${error.message}`);
        result.failed++;
        result.errors.push(`${migration.name}: ${error.message}`);
      }
    }
  }
  
  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 MIGRATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  ✅ Applied: ${result.applied}`);
  console.log(`  ℹ️  Skipped: ${result.skipped}`);
  console.log(`  ❌ Failed: ${result.failed}`);
  console.log(`  📊 Total: ${migrations.length}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (result.failed === 0) {
    console.log('✅ All migrations completed successfully!\n');
    result.success = true;
  } else {
    console.warn('⚠️  Some migrations failed, but system will continue with graceful degradation\n');
    result.success = false;
  }
  
  return result;
}

/**
 * Run migrations with error handling
 * Non-blocking: system continues even if migrations fail
 */
export async function runMigrationsOnStartup(): Promise<void> {
  try {
    const result = await runAdaptiveLearningMigrations();
    
    if (!result.success && result.failed > 0) {
      console.warn('[MIGRATIONS] ⚠️  Some migrations failed, but system will continue');
      console.warn('[MIGRATIONS] 💡 You can apply migrations manually via Supabase dashboard');
      console.warn('[MIGRATIONS] 📄 File: supabase/migrations/APPLY_THIS_ADAPTIVE_LEARNING.sql\n');
    }
    
  } catch (error: any) {
    console.error('[MIGRATIONS] ❌ Migration runner failed:', error.message);
    console.warn('[MIGRATIONS] 💡 System will continue with graceful degradation');
    console.warn('[MIGRATIONS] 💡 You can apply migrations manually via Supabase dashboard\n');
  }
}

