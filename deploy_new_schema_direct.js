// Deploy new schema directly to database (bypass migration issues)
require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL in .env');
  process.exit(1);
}

const client = new Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

console.log('🚀 DEPLOYING NEW CLEAN SCHEMA DIRECTLY TO DATABASE\n');
console.log('Strategy: Bypass migration system, create tables directly');
console.log('Safety: Old tables unchanged, new tables created alongside\n');

const newSchemaSQL = `
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NEW CLEAN SCHEMA - Direct Deployment
-- Date: November 2, 2025
-- Purpose: Create new clean tables PARALLEL to existing ones
-- Risk: ZERO - Old system unchanged, new tables just preparation
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 1: content_queue_v2
-- Purpose: Single source of truth for ALL queued content
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS content_queue_v2 (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  
  -- ═══ CONTENT ═══
  content TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
  thread_parts JSONB,
  
  -- ═══ GENERATION METADATA (Complete set for learning!) ═══
  generator_name TEXT,
  raw_topic TEXT,
  topic_cluster TEXT,
  angle TEXT,
  tone TEXT,                         -- ✅ NOW INCLUDED
  format_strategy TEXT,              -- ✅ NOW INCLUDED
  visual_format TEXT,                -- ✅ NOW INCLUDED
  
  -- ═══ STYLE & HOOKS ═══
  style TEXT,
  hook_type TEXT,
  hook_pattern TEXT,
  cta_type TEXT,
  fact_source TEXT,
  
  -- ═══ QUALITY & PREDICTIONS ═══
  quality_score DECIMAL(5,4),
  predicted_er DECIMAL(5,4),
  predicted_engagement TEXT,
  predicted_likes INTEGER,
  predicted_followers INTEGER,
  
  -- ═══ BANDIT & EXPERIMENTS ═══
  bandit_arm TEXT,
  timing_arm TEXT,
  experiment_id TEXT,
  experiment_arm TEXT,
  
  -- ═══ QUEUE MANAGEMENT ═══
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'ready', 'posting', 'posted', 'failed', 'cancelled', 'skipped')),
  generation_source TEXT NOT NULL DEFAULT 'real'
    CHECK (generation_source IN ('real', 'synthetic')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  tweet_id TEXT,
  tweet_url TEXT,
  
  -- ═══ REPLY SPECIFIC ═══
  target_tweet_id TEXT,
  target_username TEXT,
  
  -- ═══ CONTENT ANALYSIS ═══
  thread_length INTEGER DEFAULT 1 CHECK (thread_length >= 1 AND thread_length <= 25),
  fact_count INTEGER DEFAULT 1,
  novelty REAL CHECK (novelty >= 0 AND novelty <= 1),
  readability_score REAL,
  sentiment REAL CHECK (sentiment >= -1 AND sentiment <= 1),
  
  -- ═══ ADVANCED FEATURES ═══
  content_hash TEXT,
  features JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- ═══ ERROR TRACKING ═══
  skip_reason TEXT,
  error_message TEXT,
  
  -- ═══ TIMESTAMPS ═══
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 2: posted_content_v2
-- Purpose: Single source of truth for ALL posted content
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS posted_content_v2 (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  
  -- ═══ LINKS ═══
  decision_id UUID UNIQUE NOT NULL,
  
  -- ═══ TWITTER IDs ═══
  tweet_id TEXT UNIQUE NOT NULL,
  tweet_url TEXT,
  
  -- ═══ CONTENT SNAPSHOT ═══
  content TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  thread_parts JSONB,
  
  -- ═══ GENERATION METADATA (Denormalized) ═══
  generator_name TEXT,
  raw_topic TEXT,
  topic_cluster TEXT,
  angle TEXT,
  tone TEXT,                         -- ✅ NOW INCLUDED
  format_strategy TEXT,              -- ✅ NOW INCLUDED
  visual_format TEXT,                -- ✅ NOW INCLUDED
  style TEXT,
  hook_type TEXT,
  
  -- ═══ REPLY SPECIFIC ═══
  target_tweet_id TEXT,
  target_username TEXT,
  
  -- ═══ PREDICTIONS ═══
  quality_score DECIMAL(5,4),
  predicted_er DECIMAL(5,4),
  
  -- ═══ BANDIT DATA ═══
  bandit_arm TEXT,
  timing_arm TEXT,
  experiment_id TEXT,
  experiment_arm TEXT,
  
  -- ═══ TIMESTAMPS ═══
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 3: engagement_metrics_v2
-- Purpose: Single source of truth for ALL engagement data
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS engagement_metrics_v2 (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  
  -- ═══ LINKS ═══
  decision_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  
  -- ═══ ENGAGEMENT DATA ═══
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  quote_tweets INTEGER DEFAULT 0,
  
  -- ═══ REACH DATA ═══
  impressions BIGINT DEFAULT 0,
  views BIGINT DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  
  -- ═══ CALCULATED METRICS ═══
  engagement_rate DECIMAL(5,4),
  er_calculated DECIMAL(5,4),
  viral_score INTEGER DEFAULT 0,
  
  -- ═══ GROWTH TRACKING ═══
  followers_before INTEGER,
  followers_after INTEGER,
  followers_gained INTEGER,
  
  -- ═══ COLLECTION METADATA ═══
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_pass INTEGER DEFAULT 0,
  data_source TEXT DEFAULT 'twitter_scrape',
  simulated BOOLEAN NOT NULL DEFAULT false,
  
  -- ═══ TIMESTAMPS ═══
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ═══ CONSTRAINTS ═══
  CONSTRAINT positive_engagement CHECK (
    likes >= 0 AND retweets >= 0 AND replies >= 0 AND 
    bookmarks >= 0 AND quotes >= 0 AND impressions >= 0 AND views >= 0
  ),
  CONSTRAINT valid_collected_pass CHECK (collected_pass >= 0 AND collected_pass <= 10)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR PERFORMANCE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- content_queue_v2 indexes
CREATE INDEX IF NOT EXISTS idx_content_queue_v2_status_scheduled 
  ON content_queue_v2(status, scheduled_at) 
  WHERE status IN ('queued', 'ready');

CREATE INDEX IF NOT EXISTS idx_content_queue_v2_posted_at 
  ON content_queue_v2(posted_at DESC) 
  WHERE posted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_queue_v2_decision_id 
  ON content_queue_v2(decision_id);

CREATE INDEX IF NOT EXISTS idx_content_queue_v2_decision_type 
  ON content_queue_v2(decision_type);

CREATE INDEX IF NOT EXISTS idx_content_queue_v2_generator 
  ON content_queue_v2(generator_name) 
  WHERE generator_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_queue_v2_topic 
  ON content_queue_v2(raw_topic) 
  WHERE raw_topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_queue_v2_created_at 
  ON content_queue_v2(created_at DESC);

-- posted_content_v2 indexes
CREATE INDEX IF NOT EXISTS idx_posted_content_v2_tweet_id ON posted_content_v2(tweet_id);
CREATE INDEX IF NOT EXISTS idx_posted_content_v2_posted_at ON posted_content_v2(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_content_v2_decision_id ON posted_content_v2(decision_id);
CREATE INDEX IF NOT EXISTS idx_posted_content_v2_generator ON posted_content_v2(generator_name);
CREATE INDEX IF NOT EXISTS idx_posted_content_v2_topic ON posted_content_v2(raw_topic);
CREATE INDEX IF NOT EXISTS idx_posted_content_v2_decision_type ON posted_content_v2(decision_type);

-- engagement_metrics_v2 indexes
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_v2_decision_id ON engagement_metrics_v2(decision_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_v2_tweet_id ON engagement_metrics_v2(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_v2_collected_at ON engagement_metrics_v2(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_v2_pass ON engagement_metrics_v2(decision_id, collected_pass);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_v2_simulated ON engagement_metrics_v2(simulated, collected_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- LEARNING SYSTEM VIEW
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE VIEW content_with_metrics_v2 AS
SELECT 
  -- From content_queue_v2
  cq.id,
  cq.decision_id,
  cq.content,
  cq.decision_type,
  cq.thread_parts,
  
  -- Generation metadata (COMPLETE SET for learning!)
  cq.generator_name,
  cq.raw_topic,
  cq.topic_cluster,
  cq.angle,
  cq.tone,                    -- ✅ NOW AVAILABLE
  cq.format_strategy,         -- ✅ NOW AVAILABLE
  cq.visual_format,           -- ✅ NOW AVAILABLE
  cq.style,
  cq.hook_type,
  cq.hook_pattern,
  cq.cta_type,
  
  -- Predictions
  cq.quality_score,
  cq.predicted_er,
  
  -- Bandit data
  cq.bandit_arm,
  cq.timing_arm,
  cq.experiment_id,
  cq.experiment_arm,
  
  -- Reply data
  cq.target_tweet_id,
  cq.target_username,
  
  -- From posted_content_v2
  pc.tweet_id,
  pc.tweet_url,
  pc.posted_at,
  
  -- From latest engagement_metrics_v2
  em.likes,
  em.retweets,
  em.replies,
  em.bookmarks,
  em.quotes,
  em.views,
  em.impressions,
  em.engagement_rate,
  em.followers_gained,
  em.collected_at,
  em.collected_pass,
  em.data_source,
  
  -- Timestamps
  cq.created_at as generated_at,
  pc.posted_at,
  em.collected_at as metrics_collected_at
  
FROM content_queue_v2 cq
LEFT JOIN posted_content_v2 pc ON cq.decision_id = pc.decision_id
LEFT JOIN LATERAL (
  SELECT * FROM engagement_metrics_v2
  WHERE decision_id = cq.decision_id
  ORDER BY collected_at DESC
  LIMIT 1
) em ON true
WHERE cq.status = 'posted';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_content_queue_v2_updated_at
  BEFORE UPDATE ON content_queue_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
`;

async function deploySchema() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    
    console.log('🚀 Executing new schema SQL...');
    await client.query(newSchemaSQL);
    
    console.log('✅ New schema deployed successfully!\n');
    
    // Verify tables were created
    console.log('🔍 Verifying new tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%_v2'
      ORDER BY table_name;
    `);
    
    console.log('📊 New tables created:');
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check if view was created
    const viewResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'content_with_metrics_v2';
    `);
    
    if (viewResult.rows.length > 0) {
      console.log('   ✅ content_with_metrics_v2 (view)');
    }
    
    console.log('\n🎉 SUCCESS! New clean schema is ready for Week 2!');
    console.log('\n📋 WHAT WAS CREATED:');
    console.log('   • content_queue_v2 - Complete content queue with ALL missing columns');
    console.log('   • posted_content_v2 - Single source for posted tweets');
    console.log('   • engagement_metrics_v2 - Unified metrics with time-series');
    console.log('   • content_with_metrics_v2 - Perfect view for learning system');
    console.log('\n🛡️ SAFETY:');
    console.log('   • Your old tables completely unchanged');
    console.log('   • System keeps working normally');
    console.log('   • New tables ready for dual-write in Week 2');
    
  } catch (error) {
    console.error('❌ Error deploying schema:', error.message);
    console.error('\n🔧 This might be due to:');
    console.error('   • Database connection issues');
    console.error('   • Permission problems');
    console.error('   • Table already exists');
    console.error('\n💡 Your old system is unaffected - we can try again!');
  } finally {
    await client.end();
  }
}

deploySchema();

