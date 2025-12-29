/**
 * Apply database migrations for Phase 2 & 3
 * Run with: railway run --service xBOT pnpm tsx scripts/apply-migrations-railway.ts
 */

import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function applyMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = new Client({ 
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('[MIGRATION] ✅ Connected to database');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 1: Engagement Tiers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[MIGRATION] 📊 Applying Phase 1: Engagement Tiers...');
    
    await client.query('ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT');
    console.log('[MIGRATION] ✅ Added engagement_tier column');

    await client.query('CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier ON reply_opportunities(engagement_tier)');
    console.log('[MIGRATION] ✅ Created engagement_tier index');

    await client.query('ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT');
    await client.query('ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT');
    await client.query('ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0');
    console.log('[MIGRATION] ✅ Added supporting columns');

    await client.query('CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 ON reply_opportunities(opportunity_score_v2 DESC)');
    console.log('[MIGRATION] ✅ Created score index');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 2: Performance Analytics
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[MIGRATION] 📊 Applying Phase 2: Performance Analytics...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS reply_performance_analytics (
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
      )
    `);
    console.log('[MIGRATION] ✅ Created reply_performance_analytics table');

    await client.query('CREATE INDEX IF NOT EXISTS idx_perf_analytics_dimension ON reply_performance_analytics(dimension_type, dimension_value)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_perf_analytics_updated ON reply_performance_analytics(updated_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_perf_analytics_roi ON reply_performance_analytics(roi_score DESC)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_analytics_unique ON reply_performance_analytics(dimension_type, dimension_value, measurement_start)');
    console.log('[MIGRATION] ✅ Created analytics indexes');

    // Enhance discovered_accounts
    await client.query('ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS avg_followers_per_reply NUMERIC(10,2) DEFAULT 0');
    await client.query('ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS performance_tier TEXT');
    await client.query('ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS last_high_value_reply_at TIMESTAMPTZ');
    await client.query('ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS total_replies_count INTEGER DEFAULT 0');
    console.log('[MIGRATION] ✅ Enhanced discovered_accounts table');

    await client.query('CREATE INDEX IF NOT EXISTS idx_discovered_accounts_performance ON discovered_accounts(performance_tier, avg_followers_per_reply DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_success ON discovered_accounts(last_high_value_reply_at DESC)');
    console.log('[MIGRATION] ✅ Created discovered_accounts indexes');

    console.log('[MIGRATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[MIGRATION] ✅ ALL MIGRATIONS APPLIED SUCCESSFULLY');
    console.log('[MIGRATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error: any) {
    console.error('[MIGRATION] ❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

applyMigrations();

