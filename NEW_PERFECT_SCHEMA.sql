-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NEW PERFECT SCHEMA V2 - Complete Database Consolidation
-- Created: November 2, 2025
-- Updated: November 2, 2025 (after deep reply/scraper analysis)
-- Purpose: Consolidate 11 overlapping tables → 3 clean core tables
-- Status: PROPOSAL (Not applied to production yet)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 
-- HANDLES: Singles, Threads, Replies, and ALL scraper outputs
-- PRESERVES: 5 specialized reply tables (reply_opportunities, reply_conversions, etc)
-- CONSOLIDATES: Only the overlapping/duplicate tables
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ═══════════════════════════════════════════════════════════════════════════
-- CONSOLIDATION SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BEFORE (Content Queue):
--   content_metadata (126 queries) + content_generation_metadata_comprehensive (19 queries)
--   = 2 tables, 145 queries (singles + threads + replies)
--
-- AFTER (Content Queue):
--   content_queue (ALL 145 queries)
--   = 1 table, handles singles/threads/replies with target_tweet_id & target_username
--
-- ─────────────────────────────────────────────────────────────────────────────
--
-- BEFORE (Posted Content):
--   posted_decisions (34 queries) + tweets (38 queries) + posts (27 queries)
--   = 3 tables, 99 queries (singles + threads + replies)
--
-- AFTER (Posted Content):
--   posted_content (ALL 99 queries)
--   = 1 table, handles singles/threads/replies with target_tweet_id & target_username
--
-- ─────────────────────────────────────────────────────────────────────────────
--
-- BEFORE (Engagement & Scrapers):
--   outcomes (49) + real_tweet_metrics (10) + tweet_analytics (10) + tweet_metrics (10)
--   + reply_performance (1) + titan_reply_performance (1)
--   = 6 tables, 81 queries (all scrapers write here)
--
-- AFTER (Engagement & Scrapers):
--   engagement_metrics (ALL 81 queries)
--   = 1 table, time-series support for all content types
--   Used by: metricsScraperJob, realMetricsScraper, followerScraper, etc.
--
-- ─────────────────────────────────────────────────────────────────────────────
--
-- SPECIALIZED REPLY TABLES (KEPT AS-IS):
--   reply_opportunities (20 queries) - Discovery
--   reply_conversions (5 queries) - Conversion tracking
--   reply_learning_insights (3 queries) - Learning
--   reply_diagnostics (2 queries) - Debugging
--   reply_strategy_metrics (1 query) - Strategy performance
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 1: content_queue
-- Purpose: Queue of content waiting to be posted
-- Replaces: content_metadata + content_generation_metadata_comprehensive
-- Queries: 145 (126 + 19)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS content_queue (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  
  -- ═══ CONTENT ═══
  content TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
  thread_parts JSONB,  -- Array of tweets for threads: ["tweet1", "tweet2", ...]
  
  -- ═══ GENERATION METADATA ═══
  -- Topic/angle/tone chosen by AI
  raw_topic TEXT,                    -- "Gut microbiome neurotransmitter production"
  angle TEXT,                        -- "biochemical_mechanism"
  tone TEXT,                         -- "evidence_based"
  generator_name TEXT,               -- "dataNerd", "provocateur", etc.
  format_strategy TEXT,              -- "scientific_breakdown", "narrative", etc.
  visual_format TEXT,                -- AI formatting approach applied
  
  -- ═══ QUEUE MANAGEMENT ═══
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'ready', 'posting', 'posted', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,          -- When to post
  posted_at TIMESTAMPTZ,             -- When actually posted
  tweet_id TEXT,                     -- Twitter ID after posting
  tweet_url TEXT,                    -- Twitter URL after posting
  
  -- ═══ QUALITY METRICS ═══
  quality_score DECIMAL(5,4),        -- AI quality prediction (0-1)
  predicted_er DECIMAL(5,4),         -- Predicted engagement rate
  predicted_likes INTEGER,
  predicted_followers INTEGER,
  
  -- ═══ REPLY SPECIFIC ═══
  target_tweet_id TEXT,              -- If reply, what tweet to reply to
  target_username TEXT,              -- If reply, who to reply to
  
  -- ═══ LEARNING METADATA ═══
  bandit_arm TEXT,                   -- Which strategy was chosen
  timing_arm TEXT,                   -- Timing strategy
  hook_type TEXT,                    -- Type of hook used
  
  -- ═══ ADDITIONAL CONTEXT ═══
  metadata JSONB DEFAULT '{}'::jsonb,  -- Any extra data as JSON
  features JSONB DEFAULT '{}'::jsonb,  -- ML features
  
  -- ═══ TIMESTAMPS ═══
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ═══ CONSTRAINTS ═══
  CONSTRAINT valid_decision_type CHECK (decision_type IN ('single', 'thread', 'reply')),
  CONSTRAINT valid_status CHECK (status IN ('queued', 'ready', 'posting', 'posted', 'failed', 'cancelled')),
  CONSTRAINT scheduled_when_queued CHECK (status != 'queued' OR scheduled_at IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX idx_content_queue_status_scheduled 
  ON content_queue(status, scheduled_at) 
  WHERE status IN ('queued', 'ready');

CREATE INDEX idx_content_queue_posted_at 
  ON content_queue(posted_at DESC) 
  WHERE posted_at IS NOT NULL;

CREATE INDEX idx_content_queue_created_at 
  ON content_queue(created_at DESC);

CREATE INDEX idx_content_queue_generator 
  ON content_queue(generator_name) 
  WHERE generator_name IS NOT NULL;

-- Comments
COMMENT ON TABLE content_queue IS 
  'Content queue - all content waiting to be posted or recently posted.
   Consolidates: content_metadata + content_generation_metadata_comprehensive.
   Used by: planJob.ts, postingQueue.ts, replyJob.ts';

COMMENT ON COLUMN content_queue.status IS 
  'queued: Generated, waiting for scheduled time
   ready: Time to post
   posting: Currently being posted
   posted: Successfully posted
   failed: Posting failed
   cancelled: Cancelled/expired';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 2: posted_content
-- Purpose: Record of all successfully posted tweets
-- Replaces: posted_decisions + tweets + posts
-- Queries: 99 (34 + 38 + 27)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS posted_content (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  
  -- ═══ LINKS ═══
  decision_id UUID UNIQUE NOT NULL,  -- Links to content_queue
  
  -- ═══ TWITTER IDs ═══
  tweet_id TEXT UNIQUE NOT NULL,     -- Twitter's ID
  tweet_url TEXT,                    -- Full Twitter URL
  
  -- ═══ CONTENT SNAPSHOT ═══
  -- Denormalized for speed (no need to join to content_queue)
  content TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  thread_parts JSONB,                -- If thread, array of tweet texts
  
  -- ═══ GENERATION METADATA (Denormalized) ═══
  generator_name TEXT,
  raw_topic TEXT,
  angle TEXT,
  tone TEXT,
  format_strategy TEXT,
  visual_format TEXT,
  
  -- ═══ REPLY SPECIFIC ═══
  target_tweet_id TEXT,              -- If reply, parent tweet
  target_username TEXT,
  
  -- ═══ LEARNING DATA ═══
  bandit_arm TEXT,
  timing_arm TEXT,
  hook_type TEXT,
  quality_score DECIMAL(5,4),
  predicted_er DECIMAL(5,4),
  
  -- ═══ TIMESTAMPS ═══
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ═══ FOREIGN KEY ═══
  CONSTRAINT fk_posted_content_decision 
    FOREIGN KEY (decision_id) 
    REFERENCES content_queue(decision_id) 
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_posted_content_tweet_id ON posted_content(tweet_id);
CREATE INDEX idx_posted_content_posted_at ON posted_content(posted_at DESC);
CREATE INDEX idx_posted_content_decision_id ON posted_content(decision_id);
CREATE INDEX idx_posted_content_generator ON posted_content(generator_name);
CREATE INDEX idx_posted_content_topic ON posted_content(raw_topic);

-- Comments
COMMENT ON TABLE posted_content IS 
  'Posted tweets - record of all successfully posted content.
   Consolidates: posted_decisions + tweets + posts.
   Used by: postingQueue.ts, analyticsCollector.ts, learningSystem.ts';

COMMENT ON COLUMN posted_content.decision_id IS 
  'Links to content_queue.decision_id via foreign key.
   Use this for joins to get generation metadata.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 3: engagement_metrics
-- Purpose: Time-series engagement data (metrics over time)
-- Replaces: outcomes + real_tweet_metrics + tweet_analytics + tweet_metrics
-- Queries: 79 (49 + 10 + 10 + 10)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS engagement_metrics (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  
  -- ═══ LINKS ═══
  decision_id UUID NOT NULL,         -- Links to posted_content
  tweet_id TEXT NOT NULL,
  
  -- ═══ ENGAGEMENT DATA ═══
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  quote_tweets INTEGER DEFAULT 0,    -- Alias for quotes
  
  -- ═══ REACH DATA ═══
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  
  -- ═══ CALCULATED METRICS ═══
  engagement_rate DECIMAL(5,4),
  viral_score INTEGER DEFAULT 0,
  
  -- ═══ GROWTH TRACKING ═══
  followers_before INTEGER,
  followers_after INTEGER,
  followers_gained INTEGER,
  
  -- ═══ COLLECTION METADATA ═══
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_pass INTEGER DEFAULT 0,  -- 0=placeholder, 1=T+1h, 2=T+24h, 3=T+7d
  data_source TEXT,                  -- 'twitter_scrape', 'api', 'manual'
  
  -- ═══ TIMESTAMPS ═══
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ═══ FOREIGN KEY ═══
  CONSTRAINT fk_engagement_metrics_posted 
    FOREIGN KEY (decision_id) 
    REFERENCES posted_content(decision_id) 
    ON DELETE CASCADE,
  
  -- ═══ CONSTRAINTS ═══
  CONSTRAINT positive_engagement CHECK (
    likes >= 0 AND retweets >= 0 AND replies >= 0 AND 
    bookmarks >= 0 AND quotes >= 0 AND impressions >= 0 AND views >= 0
  )
);

-- Indexes
CREATE INDEX idx_engagement_metrics_decision_id ON engagement_metrics(decision_id);
CREATE INDEX idx_engagement_metrics_tweet_id ON engagement_metrics(tweet_id);
CREATE INDEX idx_engagement_metrics_collected_at ON engagement_metrics(collected_at DESC);
CREATE INDEX idx_engagement_metrics_pass ON engagement_metrics(decision_id, collected_pass);

-- Comments
COMMENT ON TABLE engagement_metrics IS 
  'Engagement metrics - time-series data of tweet performance.
   Multiple rows per tweet (tracked over time).
   Consolidates: outcomes + real_tweet_metrics + tweet_analytics + tweet_metrics.
   Used by: metricsScraperJob.ts, analyticsCollector.ts, learningSystem.ts';

COMMENT ON COLUMN engagement_metrics.collected_pass IS 
  '0 = Placeholder (immediately after posting)
   1 = T+1 hour (early metrics)
   2 = T+24 hours (final metrics)
   3 = T+7 days (long-term metrics)';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CONVENIENCE VIEWS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- View 1: content_with_metrics (most common join)
CREATE OR REPLACE VIEW content_with_metrics AS
SELECT 
  -- From posted_content
  pc.id,
  pc.decision_id,
  pc.tweet_id,
  pc.tweet_url,
  pc.content,
  pc.decision_type,
  pc.generator_name,
  pc.raw_topic,
  pc.angle,
  pc.tone,
  pc.visual_format,
  pc.posted_at,
  pc.created_at as decision_created_at,
  
  -- From latest engagement_metrics
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
  em.data_source
FROM posted_content pc
LEFT JOIN LATERAL (
  SELECT * FROM engagement_metrics
  WHERE decision_id = pc.decision_id
  ORDER BY collected_at DESC
  LIMIT 1
) em ON true;

COMMENT ON VIEW content_with_metrics IS 
  'Convenience view: Posted content joined with latest engagement metrics.
   Replaces the old content_with_outcomes view.
   Use this for learning/analytics queries.';

-- View 2: Backwards compatibility - content_metadata
CREATE OR REPLACE VIEW content_metadata AS
SELECT 
  id,
  decision_id,
  content,
  decision_type,
  thread_parts,
  status,
  scheduled_at,
  posted_at,
  tweet_id,
  raw_topic as topic_cluster,  -- Alias for backwards compatibility
  generator_name,
  angle,
  tone,
  format_strategy,
  visual_format,
  quality_score,
  predicted_er,
  target_tweet_id,
  target_username,
  bandit_arm,
  timing_arm,
  created_at,
  updated_at
FROM content_queue;

COMMENT ON VIEW content_metadata IS 
  'LEGACY VIEW for backwards compatibility.
   Points to: content_queue
   NEW CODE: Use content_queue directly.';

-- View 3: Backwards compatibility - posted_decisions
CREATE OR REPLACE VIEW posted_decisions AS
SELECT 
  id,
  decision_id,
  tweet_id,
  content,
  decision_type,
  generator_name,
  target_tweet_id,
  target_username,
  posted_at,
  created_at
FROM posted_content;

COMMENT ON VIEW posted_decisions IS 
  'LEGACY VIEW for backwards compatibility.
   Points to: posted_content
   NEW CODE: Use posted_content directly.';

-- View 4: Backwards compatibility - outcomes
CREATE OR REPLACE VIEW outcomes AS
SELECT 
  id,
  decision_id,
  tweet_id,
  likes,
  retweets,
  replies,
  bookmarks,
  quotes,
  impressions,
  views,
  engagement_rate,
  followers_before,
  followers_after,
  followers_gained,
  collected_at,
  collected_pass,
  data_source,
  created_at
FROM engagement_metrics;

COMMENT ON VIEW outcomes IS 
  'LEGACY VIEW for backwards compatibility.
   Points to: engagement_metrics
   NEW CODE: Use engagement_metrics directly.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GRANTS (Ensure Supabase can access)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GRANT ALL ON content_queue TO anon, authenticated, service_role;
GRANT ALL ON posted_content TO anon, authenticated, service_role;
GRANT ALL ON engagement_metrics TO anon, authenticated, service_role;

GRANT SELECT ON content_with_metrics TO anon, authenticated, service_role;
GRANT SELECT ON content_metadata TO anon, authenticated, service_role;
GRANT SELECT ON posted_decisions TO anon, authenticated, service_role;
GRANT SELECT ON outcomes TO anon, authenticated, service_role;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FUNCTIONS FOR AUTO-UPDATING
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_queue_updated_at
  BEFORE UPDATE ON content_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRATION SUMMARY
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- CONSOLIDATION ACHIEVED:
--   9 overlapping tables → 3 clean core tables
--   323 scattered queries → 323 organized queries
--
-- NEW TABLES:
--   1. content_queue (replaces 2 tables, handles 145 queries)
--   2. posted_content (replaces 3 tables, handles 99 queries)
--   3. engagement_metrics (replaces 4 tables, handles 79 queries)
--
-- COMPATIBILITY:
--   4 views created for backwards compatibility
--   Old code keeps working during migration
--   New code uses clean table names
--
-- DATA INTEGRITY:
--   Foreign keys ensure referential integrity
--   Check constraints prevent invalid data
--   Indexes optimize common queries
--
-- BENEFITS:
--   ✅ Clear purpose for each table
--   ✅ No confusion about which table to use
--   ✅ Better performance (proper indexes)
--   ✅ Easier debugging (one place per concept)
--   ✅ Future-proof (clean foundation)
--
-- NEXT STEPS:
--   Week 3: Create these tables in new_schema (parallel to old)
--   Week 4: Implement dual-write (write to both old and new)
--   Week 5: Verify data integrity
--   Week 6: Switch reads to new schema
--   Week 7: Monitor for full week
--   Week 8: Archive old schema, promote new to production
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

