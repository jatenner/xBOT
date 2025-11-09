-- =====================================================================================
-- COMPREHENSIVE DATA STORAGE MIGRATION FOR ENTIRE xBOT SYSTEM
-- Purpose: Enable complete data tracking for ALL systems to support real learning
-- Date: 2025-10-15
-- =====================================================================================
-- 
-- This migration enables:
-- 1. Content metadata tracking (hooks, formulas, types) for diversity learning
-- 2. Time-series performance tracking (likes at 1hr, 4hr, 24hr, etc.)
-- 3. Follower attribution (which posts actually gained followers)
-- 4. Content type performance (Educational Thread vs News Reaction, etc.)
-- 5. Formula performance (High-Value Thread Bomb vs Social Proof, etc.)
-- 6. Learning system updates tracking
-- 7. Reply performance tracking
-- 8. Comprehensive metrics (hundreds of data points per post)
--
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. ADD GENERATION_METADATA TO CONTENT_METADATA
-- =====================================================================================
-- This stores HOW content was generated (hook, formula, content type)
-- CRITICAL for learning what actually works

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_metadata' 
    AND column_name = 'generation_metadata'
  ) THEN
    ALTER TABLE content_metadata 
    ADD COLUMN generation_metadata JSONB;
    
    COMMENT ON COLUMN content_metadata.generation_metadata IS 
      'Stores content_type_id, content_type_name, viral_formula, hook_used for learning';
  END IF;
END $$;

-- Index for querying generation metadata
CREATE INDEX IF NOT EXISTS idx_content_metadata_generation_metadata_gin 
  ON content_metadata USING GIN (generation_metadata);

-- =====================================================================================
-- 2. TIME-SERIES PERFORMANCE TRACKING
-- =====================================================================================
-- Track performance over time: 1hr, 4hr, 24hr, 7d snapshots
-- Enables analysis like "12 likes at 1pm → 45 likes at 4pm"

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  
  -- Snapshot timing
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hours_since_post NUMERIC(10,2) NOT NULL, -- e.g., 0.5 = 30 min, 4.0 = 4 hours
  
  -- Engagement metrics (at this point in time)
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  
  -- Reach metrics
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  
  -- Calculated metrics
  engagement_rate NUMERIC(10,4) DEFAULT 0, -- (likes+retweets+replies)/impressions
  viral_coefficient NUMERIC(10,4) DEFAULT 0, -- retweets/impressions
  reply_rate NUMERIC(10,4) DEFAULT 0, -- replies/impressions
  bookmark_rate NUMERIC(10,4) DEFAULT 0, -- bookmarks/impressions
  
  -- Follower impact
  followers_at_snapshot INTEGER,
  followers_gained_since_post INTEGER DEFAULT 0,
  
  -- Additional context
  snapshot_metadata JSONB, -- Store any extra data (sentiment, top countries, etc.)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate snapshots
  UNIQUE(decision_id, hours_since_post)
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_decision 
  ON performance_snapshots (decision_id, hours_since_post);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_time 
  ON performance_snapshots (snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_hours 
  ON performance_snapshots (hours_since_post);

COMMENT ON TABLE performance_snapshots IS 
  'Time-series performance data: track metrics at 1hr, 4hr, 24hr, 7d intervals';

-- =====================================================================================
-- 3. FOLLOWER ATTRIBUTION
-- =====================================================================================
-- Track which posts actually gained followers (the MOST important metric)

CREATE TABLE IF NOT EXISTS follower_attributions (
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  
  -- Follower snapshot
  followers_before INTEGER NOT NULL,
  followers_after INTEGER NOT NULL,
  followers_gained INTEGER NOT NULL,
  
  -- Attribution confidence
  confidence_score NUMERIC(5,4) NOT NULL, -- 0.0-1.0: how confident this post caused the follows
  attribution_method TEXT NOT NULL, -- 'time_window', 'referrer_data', 'correlation_analysis'
  
  -- Timing context
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_window_hours NUMERIC(10,2) NOT NULL, -- e.g., 24.0 = measured 24 hours after post
  
  -- Follower quality metrics
  avg_follower_engagement NUMERIC(10,4), -- Estimated engagement rate of new followers
  follower_retention_rate NUMERIC(5,4), -- % still following after 7 days
  
  -- Attribution details
  attribution_metadata JSONB, -- Store details about how attribution was calculated
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(decision_id, time_window_hours)
);

CREATE INDEX IF NOT EXISTS idx_follower_attr_decision 
  ON follower_attributions (decision_id);
CREATE INDEX IF NOT EXISTS idx_follower_attr_confidence 
  ON follower_attributions (confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_follower_attr_gained 
  ON follower_attributions (followers_gained DESC);

COMMENT ON TABLE follower_attributions IS 
  'Link follower growth to specific posts with confidence scores';

-- =====================================================================================
-- 4. CONTENT TYPE PERFORMANCE
-- =====================================================================================
-- Track performance of different content types (Educational Thread, News Reaction, etc.)

CREATE TABLE IF NOT EXISTS content_type_performance (
  id BIGSERIAL PRIMARY KEY,
  content_type_id TEXT NOT NULL,
  content_type_name TEXT NOT NULL,
  
  -- Performance aggregates
  posts_count INTEGER DEFAULT 0,
  avg_likes NUMERIC(10,2) DEFAULT 0,
  avg_retweets NUMERIC(10,2) DEFAULT 0,
  avg_replies NUMERIC(10,2) DEFAULT 0,
  avg_impressions NUMERIC(10,2) DEFAULT 0,
  avg_engagement_rate NUMERIC(10,4) DEFAULT 0,
  
  -- Follower impact (MOST IMPORTANT)
  total_followers_gained INTEGER DEFAULT 0,
  avg_followers_per_post NUMERIC(10,2) DEFAULT 0,
  follower_conversion_rate NUMERIC(10,4) DEFAULT 0, -- followers / impressions
  
  -- Thompson Sampling scores
  thompson_alpha NUMERIC(10,4) DEFAULT 1.0,
  thompson_beta NUMERIC(10,4) DEFAULT 1.0,
  selection_score NUMERIC(10,4) DEFAULT 0.5,
  
  -- Timestamps
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(content_type_id)
);

CREATE INDEX IF NOT EXISTS idx_content_type_perf_name 
  ON content_type_performance (content_type_name);
CREATE INDEX IF NOT EXISTS idx_content_type_perf_followers 
  ON content_type_performance (avg_followers_per_post DESC);
CREATE INDEX IF NOT EXISTS idx_content_type_perf_score 
  ON content_type_performance (selection_score DESC);

COMMENT ON TABLE content_type_performance IS 
  'Aggregate performance by content type for Thompson Sampling selection';

-- =====================================================================================
-- 5. FORMULA PERFORMANCE
-- =====================================================================================
-- Track performance of different viral formulas

CREATE TABLE IF NOT EXISTS formula_performance (
  id BIGSERIAL PRIMARY KEY,
  formula_name TEXT NOT NULL,
  
  -- Performance aggregates
  posts_count INTEGER DEFAULT 0,
  avg_likes NUMERIC(10,2) DEFAULT 0,
  avg_retweets NUMERIC(10,2) DEFAULT 0,
  avg_engagement_rate NUMERIC(10,4) DEFAULT 0,
  
  -- Follower impact
  total_followers_gained INTEGER DEFAULT 0,
  avg_followers_per_post NUMERIC(10,2) DEFAULT 0,
  
  -- Success tracking
  success_rate NUMERIC(5,4) DEFAULT 0.5, -- % of posts that met success criteria
  viral_coefficient NUMERIC(10,4) DEFAULT 0,
  
  -- Thompson Sampling
  thompson_alpha NUMERIC(10,4) DEFAULT 1.0,
  thompson_beta NUMERIC(10,4) DEFAULT 1.0,
  
  -- Timestamps
  last_used TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(formula_name)
);

CREATE INDEX IF NOT EXISTS idx_formula_perf_name 
  ON formula_performance (formula_name);
CREATE INDEX IF NOT EXISTS idx_formula_perf_success 
  ON formula_performance (success_rate DESC);

COMMENT ON TABLE formula_performance IS 
  'Aggregate performance by viral formula for Thompson Sampling selection';

-- =====================================================================================
-- 6. LEARNING SYSTEM UPDATES
-- =====================================================================================
-- Track when and how the learning system updates its strategies

CREATE TABLE IF NOT EXISTS learning_updates (
  id BIGSERIAL PRIMARY KEY,
  update_type TEXT NOT NULL, -- 'real_time_cycle', 'formula_update', 'content_type_update', 'manual'
  
  -- What was updated
  component TEXT NOT NULL, -- 'content_types', 'formulas', 'hooks', 'all'
  updates_applied JSONB NOT NULL, -- Details of what changed
  
  -- Performance context
  insights_summary JSONB, -- Top performing topics, patterns discovered, etc.
  performance_before JSONB, -- Baseline metrics before update
  performance_after JSONB, -- Expected/actual metrics after update
  
  -- Effectiveness tracking
  improvement_score NUMERIC(10,4), -- Measured improvement from this update
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_updates_type 
  ON learning_updates (update_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_updates_component 
  ON learning_updates (component, created_at DESC);

COMMENT ON TABLE learning_updates IS 
  'History of learning system updates and their effectiveness';

-- =====================================================================================
-- 7. COMPREHENSIVE TWEET ANALYTICS
-- =====================================================================================
-- Store HUNDREDS of metrics per tweet for deep analysis

CREATE TABLE IF NOT EXISTS tweet_analytics_comprehensive (
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  
  -- Basic engagement (updatable)
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  
  -- Advanced engagement
  media_views INTEGER DEFAULT 0,
  media_engagements INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  hashtag_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  
  -- Reach & impressions
  impressions INTEGER DEFAULT 0,
  impressions_organic INTEGER DEFAULT 0,
  impressions_promoted INTEGER DEFAULT 0,
  impressions_viral INTEGER DEFAULT 0,
  user_profile_clicks INTEGER DEFAULT 0,
  
  -- Follower metrics
  followers_before INTEGER,
  followers_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  follows_from_tweet INTEGER DEFAULT 0,
  
  -- Timing metrics
  posted_at TIMESTAMPTZ,
  peak_engagement_at TIMESTAMPTZ,
  time_to_peak_minutes INTEGER,
  half_life_minutes INTEGER, -- Time to reach 50% of total engagement
  
  -- Virality metrics
  viral_coefficient NUMERIC(10,4), -- retweets / impressions
  amplification_rate NUMERIC(10,4), -- (retweets + quotes) / followers
  conversation_rate NUMERIC(10,4), -- replies / impressions
  engagement_rate NUMERIC(10,4), -- total engagement / impressions
  
  -- Quality metrics
  reply_sentiment_positive INTEGER DEFAULT 0,
  reply_sentiment_negative INTEGER DEFAULT 0,
  reply_sentiment_neutral INTEGER DEFAULT 0,
  avg_reply_sentiment NUMERIC(5,2), -- -1.0 to 1.0
  
  -- Audience metrics
  audience_size_reached INTEGER,
  audience_retention_rate NUMERIC(5,4), -- % who saw AND engaged
  new_audience_percentage NUMERIC(5,4), -- % non-followers who saw it
  
  -- Performance decay
  engagement_decay_rate NUMERIC(10,4), -- How fast engagement drops off
  longevity_score NUMERIC(10,4), -- How long the tweet stays relevant
  
  -- Content attributes (from generation_metadata)
  content_type TEXT,
  viral_formula TEXT,
  hook_used TEXT,
  content_length INTEGER,
  has_media BOOLEAN DEFAULT false,
  has_url BOOLEAN DEFAULT false,
  has_hashtags BOOLEAN DEFAULT false,
  
  -- Prediction accuracy
  predicted_likes INTEGER,
  predicted_engagement_rate NUMERIC(10,4),
  prediction_error NUMERIC(10,4), -- Absolute error
  prediction_accuracy NUMERIC(10,4), -- 1 - (error / actual)
  
  -- Additional context
  analytics_metadata JSONB, -- Store anything else (geographic data, device data, etc.)
  
  -- Timestamps
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_tweet_analytics_decision 
  ON tweet_analytics_comprehensive (decision_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement 
  ON tweet_analytics_comprehensive (engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_followers 
  ON tweet_analytics_comprehensive (followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_content_type 
  ON tweet_analytics_comprehensive (content_type);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_formula 
  ON tweet_analytics_comprehensive (viral_formula);

COMMENT ON TABLE tweet_analytics_comprehensive IS 
  'Comprehensive tweet analytics with hundreds of metrics for deep learning';

-- =====================================================================================
-- 8. REPLY PERFORMANCE TRACKING
-- =====================================================================================
-- Track reply performance separately (different dynamics than posts)

CREATE TABLE IF NOT EXISTS reply_performance (
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL,
  reply_tweet_id TEXT NOT NULL,
  parent_tweet_id TEXT NOT NULL,
  parent_username TEXT NOT NULL,
  
  -- Reply engagement
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0, -- Replies to our reply
  impressions INTEGER DEFAULT 0,
  
  -- Follower impact
  followers_gained INTEGER DEFAULT 0,
  parent_author_followed BOOLEAN DEFAULT false, -- Did we follow the original author?
  
  -- Quality metrics
  reply_sentiment TEXT, -- 'positive', 'negative', 'neutral'
  reply_relevance_score NUMERIC(5,4), -- How relevant was our reply?
  conversation_continuation BOOLEAN DEFAULT false, -- Did it spark more conversation?
  
  -- Performance
  engagement_rate NUMERIC(10,4),
  visibility_score NUMERIC(10,4), -- How visible was it in the thread?
  
  -- Context
  reply_metadata JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(reply_tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_reply_perf_decision 
  ON reply_performance (decision_id);
CREATE INDEX IF NOT EXISTS idx_reply_perf_parent 
  ON reply_performance (parent_tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_perf_followers 
  ON reply_performance (followers_gained DESC);

COMMENT ON TABLE reply_performance IS 
  'Track reply-specific performance metrics and follower conversion';

-- =====================================================================================
-- 9. SYSTEM HEALTH METRICS
-- =====================================================================================
-- Track overall system health and performance trends

CREATE TABLE IF NOT EXISTS system_health_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_type TEXT NOT NULL, -- 'posting', 'learning', 'engagement', 'followers'
  
  -- Aggregated metrics
  posts_per_hour NUMERIC(10,2),
  avg_engagement_rate NUMERIC(10,4),
  followers_per_day NUMERIC(10,2),
  learning_cycles_completed INTEGER,
  
  -- Success rates
  posting_success_rate NUMERIC(5,4),
  quality_pass_rate NUMERIC(5,4),
  api_success_rate NUMERIC(5,4),
  
  -- System performance
  avg_generation_time_ms INTEGER,
  avg_posting_time_ms INTEGER,
  error_rate NUMERIC(5,4),
  
  -- Budget tracking
  daily_api_cost_usd NUMERIC(10,6),
  cost_per_follower_usd NUMERIC(10,6),
  roi NUMERIC(10,4), -- Return on investment
  
  -- Additional metrics
  metrics_snapshot JSONB,
  
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_type 
  ON system_health_metrics (metric_type, measured_at DESC);

COMMENT ON TABLE system_health_metrics IS 
  'Track overall system health and performance trends over time';

-- =====================================================================================
-- SUMMARY & DOCUMENTATION
-- =====================================================================================

COMMENT ON SCHEMA public IS 
  'xBOT comprehensive data storage: Tracks ALL metrics for continuous learning and optimization';

-- Create a view for easy access to latest performance data
CREATE OR REPLACE VIEW latest_post_performance AS
SELECT 
  cm.decision_id,
  cm.content,
  cm.generation_metadata,
  cm.status,
  cm.posted_at,
  tac.likes,
  tac.retweets,
  tac.engagement_rate,
  tac.followers_gained,
  tac.content_type,
  tac.viral_formula,
  fa.followers_gained as attributed_followers,
  fa.confidence_score as attribution_confidence
FROM content_metadata cm
LEFT JOIN tweet_analytics_comprehensive tac ON cm.decision_id = tac.decision_id
LEFT JOIN follower_attributions fa ON cm.decision_id = fa.decision_id 
  AND fa.time_window_hours = 24.0
WHERE cm.status = 'posted'
ORDER BY cm.posted_at DESC;

COMMENT ON VIEW latest_post_performance IS 
  'Quick view of recent posts with comprehensive performance data';

COMMIT;

-- =====================================================================================
-- MIGRATION COMPLETE ✅
-- =====================================================================================
-- 
-- What this enables:
-- ✅ Content diversity tracking (hooks, formulas, types stored in generation_metadata)
-- ✅ Time-series updates (performance tracked at 1hr, 4hr, 24hr intervals)
-- ✅ Follower attribution (know which posts gain followers)
-- ✅ Learning loop (content types & formulas optimized based on real data)
-- ✅ Comprehensive analytics (hundreds of metrics per post)
-- ✅ Reply tracking (separate performance analysis for replies)
-- ✅ System health (overall system performance trends)
-- ✅ Continuous improvement (system learns from every post)
--
-- Your system now has FULL data infrastructure for permanent learning!
-- =====================================================================================

