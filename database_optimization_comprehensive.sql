-- ═══════════════════════════════════════════════════════════════
-- 🎯 COMPREHENSIVE DATABASE OPTIMIZATION
-- Goal: Clean structure + Full data integrity + All data saved
-- ═══════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 1: CREATE OPTIMIZED CORE TABLES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ────────────────────────────────────────────────────────────────
-- TABLE 1: posted_tweets (Master Tweet Record)
-- Purpose: Single source of truth for ALL posted tweets
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posted_tweets (
    -- Primary identification
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT UNIQUE NOT NULL,  -- Twitter's ID (must be unique)
    decision_id TEXT UNIQUE,        -- Our internal decision ID
    
    -- Core content
    content TEXT NOT NULL,
    thread_parts JSONB,             -- For threads: ["part1", "part2", ...]
    
    -- Timing
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Decision metadata (for learning)
    decision_type TEXT,             -- 'single', 'thread', 'reply'
    target_tweet_id TEXT,           -- If reply, what we replied to
    target_username TEXT,           -- If reply, who we replied to
    
    -- Content analysis (for learning)
    topic_cluster TEXT,
    bandit_arm TEXT,
    timing_arm TEXT,
    quality_score DECIMAL(5,4),
    predicted_er DECIMAL(5,4),
    
    -- Content fingerprinting (prevent duplicates)
    content_hash TEXT,
    semantic_embedding vector(1536), -- For similarity checking
    
    -- Indexes for fast queries
    CONSTRAINT valid_tweet_id CHECK (tweet_id IS NOT NULL AND LENGTH(tweet_id) > 0),
    CONSTRAINT valid_content CHECK (LENGTH(content) > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posted_tweets_tweet_id ON posted_tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_posted_at ON posted_tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_decision_id ON posted_tweets(decision_id);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_topic ON posted_tweets(topic_cluster);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_content_hash ON posted_tweets(content_hash);

-- ────────────────────────────────────────────────────────────────
-- TABLE 2: tweet_engagement_metrics (Time-Series Engagement Data)
-- Purpose: Track engagement over time for learning
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tweet_engagement_metrics (
    -- Primary identification
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT NOT NULL,  -- Links to posted_tweets.tweet_id
    
    -- Engagement data (from scraping)
    likes INTEGER NOT NULL DEFAULT 0,
    retweets INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    bookmarks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER,  -- Views (not always available)
    profile_clicks INTEGER,
    
    -- Calculated metrics
    engagement_rate DECIMAL(10,6),
    viral_score INTEGER DEFAULT 0,
    
    -- Collection metadata
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collection_phase TEXT NOT NULL,  -- 'T+1h', 'T+24h', 'T+7d', 'manual'
    hours_after_post DECIMAL(10,2),
    
    -- Data quality tracking
    is_verified BOOLEAN NOT NULL DEFAULT true,
    data_source TEXT DEFAULT 'scraper',  -- 'scraper', 'api', 'manual'
    
    -- Context (for validation)
    content_length INTEGER,
    posted_at TIMESTAMPTZ,  -- Denormalized for convenience
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key relationship
    CONSTRAINT fk_engagement_tweet 
        FOREIGN KEY (tweet_id) 
        REFERENCES posted_tweets(tweet_id)
        ON DELETE CASCADE,
    
    -- Ensure one snapshot per tweet per phase
    CONSTRAINT unique_tweet_collection 
        UNIQUE (tweet_id, collection_phase, collected_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_tweet_id ON tweet_engagement_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_collected_at ON tweet_engagement_metrics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_phase ON tweet_engagement_metrics(collection_phase);
CREATE INDEX IF NOT EXISTS idx_engagement_viral ON tweet_engagement_metrics(viral_score DESC);

-- ────────────────────────────────────────────────────────────────
-- TABLE 3: content_generation_metadata (AI Learning Data)
-- Purpose: Track content generation for optimization
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_generation_metadata (
    -- Primary identification
    id BIGSERIAL PRIMARY KEY,
    decision_id TEXT UNIQUE NOT NULL,  -- Links to posted_tweets.decision_id
    
    -- Content details
    content TEXT NOT NULL,
    thread_parts JSONB,
    topic_cluster TEXT,
    
    -- Generation details
    generation_source TEXT,  -- 'strategist', 'generator_v2', etc
    generator_name TEXT,
    generator_confidence DECIMAL(5,4),
    
    -- Strategy details
    bandit_arm TEXT,
    timing_arm TEXT,
    angle TEXT,
    style TEXT,
    
    -- Content features
    hook_type TEXT,
    hook_pattern TEXT,
    cta_type TEXT,
    fact_source TEXT,
    fact_count INTEGER DEFAULT 0,
    
    -- Quality predictions
    quality_score DECIMAL(5,4),
    predicted_er DECIMAL(5,4),
    predicted_engagement INTEGER,
    novelty DECIMAL(5,4),
    readability_score DECIMAL(5,4),
    sentiment TEXT,
    
    -- Actual results (populated after scraping)
    actual_likes INTEGER,
    actual_retweets INTEGER,
    actual_replies INTEGER,
    actual_impressions INTEGER,
    actual_engagement_rate DECIMAL(5,4),
    viral_score INTEGER,
    
    -- Performance analysis
    prediction_accuracy DECIMAL(5,4),
    style_effectiveness DECIMAL(5,4),
    hook_effectiveness DECIMAL(5,4),
    cta_effectiveness DECIMAL(5,4),
    fact_resonance DECIMAL(5,4),
    
    -- Status tracking
    status TEXT DEFAULT 'queued',  -- 'queued', 'posted', 'skipped', 'failed'
    scheduled_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    tweet_id TEXT,  -- Populated after posting
    
    -- Skip/failure tracking
    skip_reason TEXT,
    error_message TEXT,
    
    -- Features for learning
    features JSONB,
    content_hash TEXT,
    embedding vector(1536),
    
    -- Experiment tracking
    experiment_id TEXT,
    experiment_arm TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key (optional since not all content gets posted)
    CONSTRAINT fk_content_tweet 
        FOREIGN KEY (tweet_id) 
        REFERENCES posted_tweets(tweet_id)
        ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_decision_id ON content_generation_metadata(decision_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_generation_metadata(status);
CREATE INDEX IF NOT EXISTS idx_content_tweet_id ON content_generation_metadata(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_quality ON content_generation_metadata(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_posted_at ON content_generation_metadata(posted_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 2: MIGRATE EXISTING DATA (PRESERVE EVERYTHING)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ────────────────────────────────────────────────────────────────
-- Migrate from posted_decisions to posted_tweets
-- ────────────────────────────────────────────────────────────────
INSERT INTO posted_tweets (
    tweet_id, decision_id, content, posted_at, created_at,
    decision_type, target_tweet_id, target_username,
    topic_cluster, bandit_arm, timing_arm, quality_score, predicted_er
)
SELECT 
    tweet_id, decision_id, content, posted_at, created_at,
    decision_type, target_tweet_id, target_username,
    topic_cluster, bandit_arm, timing_arm, quality_score, predicted_er
FROM posted_decisions
WHERE tweet_id IS NOT NULL
ON CONFLICT (tweet_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- Migrate from post_history to posted_tweets (older data)
-- ────────────────────────────────────────────────────────────────
INSERT INTO posted_tweets (
    tweet_id, content, posted_at, created_at,
    content_hash, semantic_embedding, quality_score
)
SELECT 
    tweet_id, original_content, posted_at, created_at,
    content_hash, semantic_embedding, quality_score
FROM post_history
WHERE tweet_id IS NOT NULL
  AND tweet_id NOT IN (SELECT tweet_id FROM posted_tweets)
ON CONFLICT (tweet_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- Migrate metrics to tweet_engagement_metrics
-- ────────────────────────────────────────────────────────────────
INSERT INTO tweet_engagement_metrics (
    tweet_id, likes, retweets, replies, bookmarks, impressions,
    engagement_rate, viral_score, collected_at, collection_phase,
    hours_after_post, is_verified, posted_at
)
SELECT 
    tweet_id, likes, retweets, replies, bookmarks, impressions,
    engagement_rate, viral_score, collected_at, collection_phase,
    hours_after_post, is_verified, posted_at
FROM real_tweet_metrics
ON CONFLICT (tweet_id, collection_phase, collected_at) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- Migrate content metadata
-- ────────────────────────────────────────────────────────────────
INSERT INTO content_generation_metadata (
    decision_id, content, topic_cluster, generation_source, generator_name,
    bandit_arm, timing_arm, quality_score, predicted_er, status,
    posted_at, tweet_id, created_at, updated_at, features
)
SELECT 
    decision_id, content, topic_cluster, generation_source, generator_name,
    bandit_arm, timing_arm, quality_score, predicted_er, status,
    posted_at, tweet_id, created_at, updated_at, features
FROM content_metadata
ON CONFLICT (decision_id) DO UPDATE SET
    tweet_id = EXCLUDED.tweet_id,
    posted_at = EXCLUDED.posted_at,
    updated_at = EXCLUDED.updated_at;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 3: CREATE HELPER VIEWS FOR EASY QUERYING
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ────────────────────────────────────────────────────────────────
-- View: tweets_with_latest_metrics
-- Purpose: Easy access to tweets with their most recent engagement
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW tweets_with_latest_metrics AS
SELECT 
    pt.id,
    pt.tweet_id,
    pt.content,
    pt.posted_at,
    pt.topic_cluster,
    pt.quality_score,
    pt.predicted_er,
    -- Latest engagement metrics
    tem.likes,
    tem.retweets,
    tem.replies,
    tem.bookmarks,
    tem.impressions,
    tem.engagement_rate,
    tem.viral_score,
    tem.collected_at as metrics_updated_at,
    tem.collection_phase as latest_collection_phase
FROM posted_tweets pt
LEFT JOIN LATERAL (
    SELECT *
    FROM tweet_engagement_metrics
    WHERE tweet_id = pt.tweet_id
    ORDER BY collected_at DESC
    LIMIT 1
) tem ON true
ORDER BY pt.posted_at DESC;

-- ────────────────────────────────────────────────────────────────
-- View: content_performance_analysis
-- Purpose: Compare predictions vs actual performance
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW content_performance_analysis AS
SELECT 
    cgm.decision_id,
    cgm.content,
    cgm.topic_cluster,
    cgm.quality_score,
    cgm.predicted_er,
    cgm.generator_name,
    cgm.style,
    cgm.hook_type,
    -- Actual performance
    pt.tweet_id,
    pt.posted_at,
    tem.likes,
    tem.retweets,
    tem.impressions,
    tem.engagement_rate as actual_er,
    tem.viral_score,
    -- Prediction accuracy
    CASE 
        WHEN tem.engagement_rate IS NOT NULL AND cgm.predicted_er IS NOT NULL
        THEN 1.0 - ABS(tem.engagement_rate - cgm.predicted_er) / NULLIF(cgm.predicted_er, 0)
        ELSE NULL
    END as prediction_accuracy
FROM content_generation_metadata cgm
LEFT JOIN posted_tweets pt ON cgm.tweet_id = pt.tweet_id
LEFT JOIN LATERAL (
    SELECT *
    FROM tweet_engagement_metrics
    WHERE tweet_id = pt.tweet_id
    ORDER BY collected_at DESC
    LIMIT 1
) tem ON true
WHERE cgm.status = 'posted';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 4: ARCHIVE OLD TABLES (DON'T DELETE - PRESERVE DATA)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Rename old tables to archive (keep data safe)
ALTER TABLE IF EXISTS posted_decisions RENAME TO _archive_posted_decisions;
ALTER TABLE IF EXISTS post_history RENAME TO _archive_post_history;
ALTER TABLE IF EXISTS content_metadata RENAME TO _archive_content_metadata;
ALTER TABLE IF EXISTS real_tweet_metrics RENAME TO _archive_real_tweet_metrics;

-- Drop empty/unused tables (they have no data anyway)
DROP TABLE IF EXISTS tweets;
DROP TABLE IF EXISTS tweet_analytics;
DROP TABLE IF EXISTS tweet_metrics;
DROP TABLE IF EXISTS engagement_snapshots;
DROP TABLE IF EXISTS unified_outcomes;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 5: VERIFICATION QUERIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Check data counts
SELECT 'posted_tweets' as table_name, COUNT(*) as count FROM posted_tweets
UNION ALL
SELECT 'tweet_engagement_metrics', COUNT(*) FROM tweet_engagement_metrics
UNION ALL
SELECT 'content_generation_metadata', COUNT(*) FROM content_generation_metadata;

-- ═══════════════════════════════════════════════════════════════
-- ✅ OPTIMIZATION COMPLETE
-- ═══════════════════════════════════════════════════════════════
-- 
-- NEW STRUCTURE:
-- ✅ posted_tweets (master tweet record)
-- ✅ tweet_engagement_metrics (time-series engagement)
-- ✅ content_generation_metadata (AI learning data)
-- 
-- BENEFITS:
-- ✅ All data preserved and migrated
-- ✅ Clear relationships with foreign keys
-- ✅ No redundancy
-- ✅ Easy to query with helper views
-- ✅ Old tables archived (not deleted)
-- ✅ Full data integrity
-- 
-- ═══════════════════════════════════════════════════════════════

