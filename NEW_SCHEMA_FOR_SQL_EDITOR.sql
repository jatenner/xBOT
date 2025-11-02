-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NEW CLEAN SCHEMA - For Supabase SQL Editor
-- Date: November 2, 2025
-- Purpose: Create new clean tables PARALLEL to existing ones
-- Instructions: Copy and paste this into Supabase SQL Editor and run
-- Risk: ZERO - Old system unchanged, new tables just preparation
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 1: content_queue_v2
-- Purpose: Single source of truth for ALL queued content
-- Replaces: content_metadata + content_generation_metadata_comprehensive
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
  generator_name TEXT,               -- Which of 12 generators
  raw_topic TEXT,                    -- Consistent naming
  topic_cluster TEXT,                -- Backwards compatibility
  angle TEXT,                        -- Approach angle
  tone TEXT,                         -- ✅ NOW INCLUDED: "evidence_based", "conversational"
  format_strategy TEXT,              -- ✅ NOW INCLUDED: "bullet_list", "narrative"
  visual_format TEXT,                -- ✅ NOW INCLUDED: "emoji_bullets", "clean_text"
  
  -- ═══ STYLE & HOOKS ═══
  style TEXT,                        -- "educational", "storytelling"
  hook_type TEXT,                    -- "surprising_fact", "myth_buster"
  hook_pattern TEXT,                 -- Specific hook used
  cta_type TEXT,                     -- "follow_for_more", "engagement_question"
  fact_source TEXT,                  -- "llm_generated", "research_paper"
  
  -- ═══ QUALITY & PREDICTIONS ═══
  quality_score DECIMAL(5,4),        -- AI quality prediction (0-1)
  predicted_er DECIMAL(5,4),         -- Predicted engagement rate
  predicted_engagement TEXT,         -- "high", "medium", "low"
  predicted_likes INTEGER,
  predicted_followers INTEGER,
  
  -- ═══ BANDIT & EXPERIMENTS ═══
  bandit_arm TEXT,                   -- Which strategy was chosen
  timing_arm TEXT,                   -- Timing strategy
  experiment_id TEXT,                -- A/B test ID
  experiment_arm TEXT,               -- "control", "variant_a", "variant_b"
  
  -- ═══ QUEUE MANAGEMENT ═══
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'ready', 'posting', 'posted', 'failed', 'cancelled', 'skipped')),
  generation_source TEXT NOT NULL DEFAULT 'real'
    CHECK (generation_source IN ('real', 'synthetic')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,             -- Filled when posted
  tweet_id TEXT,                     -- Twitter ID after posting
  tweet_url TEXT,                    -- Twitter URL after posting
  
  -- ═══ REPLY SPECIFIC ═══
  target_tweet_id TEXT,              -- If reply, what tweet to reply to
  target_username TEXT,              -- If reply, who to reply to
  
  -- ═══ CONTENT ANALYSIS ═══
  thread_length INTEGER DEFAULT 1 CHECK (thread_length >= 1 AND thread_length <= 25),
  fact_count INTEGER DEFAULT 1,
  novelty REAL CHECK (novelty >= 0 AND novelty <= 1),
  readability_score REAL,
  sentiment REAL CHECK (sentiment >= -1 AND sentiment <= 1),
  
  -- ═══ ADVANCED FEATURES ═══
  content_hash TEXT,                 -- For duplicate detection
  features JSONB DEFAULT '{}'::jsonb, -- AI-extracted features
  metadata JSONB DEFAULT '{}'::jsonb, -- Any extra data
  
  -- ═══ ERROR TRACKING ═══
  skip_reason TEXT,                  -- Why skipped
  error_message TEXT,                -- Error details
  
  -- ═══ TIMESTAMPS ═══
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE 2: posted_content_v2
-- Purpose: Single source of truth for ALL posted content
-- Replaces: posted_decisions + tweets + posts
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS posted_content_v2 (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  
  -- ═══ LINKS ═══
  decision_id UUID UNIQUE NOT NULL,  -- Links to content_queue_v2
  
  -- ═══ TWITTER IDs ═══
  tweet_id TEXT UNIQUE NOT NULL,     -- Twitter's ID
  tweet_url TEXT,                    -- Full Twitter URL
  
  -- ═══ CONTENT SNAPSHOT (Denormalized for speed) ═══
  content TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  thread_parts JSONB,                -- If thread, array of tweet texts
  
  -- ═══ GENERATION METADATA (Denormalized for fast queries) ═══
  generator_name TEXT,
  raw_topic TEXT,
  topic_cluster TEXT,                -- Backwards compatibility
  angle TEXT,
  tone TEXT,                         -- ✅ NOW INCLUDED
  format_strategy TEXT,              -- ✅ NOW INCLUDED
  visual_format TEXT,                -- ✅ NOW INCLUDED
  style TEXT,
  hook_type TEXT,
  
  -- ═══ REPLY SPECIFIC ═══
  target_tweet_id TEXT,              -- If reply, parent tweet
  target_username TEXT,              -- If reply, target user
  
  -- ═══ PREDICTIONS (Denormalized) ═══
  quality_score DECIMAL(5,4),
  predicted_er DECIMAL(5,4),
  
  -- ═══ BANDIT DATA (Denormalized) ═══
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
-- Replaces: outcomes + real_tweet_metrics + tweet_analytics + tweet_metrics
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS engagement_metrics_v2 (
  -- ═══ PRIMARY KEY ═══
  id BIGSERIAL PRIMARY KEY,
  
  -- ═══ LINKS ═══
  decision_id UUID NOT NULL,         -- Links to posted_content_v2
  tweet_id TEXT NOT NULL,
  
  -- ═══ ENGAGEMENT DATA ═══
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  quote_tweets INTEGER DEFAULT 0,    -- Alias for quotes
  
  -- ═══ REACH DATA ═══
  impressions BIGINT DEFAULT 0,
  views BIGINT DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  
  -- ═══ CALCULATED METRICS ═══
  engagement_rate DECIMAL(5,4),      -- (likes + retweets + replies) / impressions
  er_calculated DECIMAL(5,4),        -- Backwards compatibility
  viral_score INTEGER DEFAULT 0,
  
  -- ═══ GROWTH TRACKING ═══
  followers_before INTEGER,          -- Follower count before this tweet
  followers_after INTEGER,           -- Follower count after this tweet
  followers_gained INTEGER,          -- Net gain from this tweet
  
  -- ═══ COLLECTION METADATA ═══
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_pass INTEGER DEFAULT 0,  -- 0=placeholder, 1=T+1h, 2=T+24h, 3=T+7d
  data_source TEXT DEFAULT 'twitter_scrape', -- 'twitter_scrape', 'api', 'manual'
  simulated BOOLEAN NOT NULL DEFAULT false,   -- Backwards compatibility
  
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
-- LEARNING SYSTEM VIEW (Perfect for learning queries)
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
  cq.tone,                    -- ✅ NOW AVAILABLE FOR LEARNING
  cq.format_strategy,         -- ✅ NOW AVAILABLE FOR LEARNING
  cq.visual_format,           -- ✅ NOW AVAILABLE FOR LEARNING
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
-- TRIGGERS FOR AUTO-UPDATING
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_content_queue_v2_updated_at'
  ) THEN
    CREATE TRIGGER update_content_queue_v2_updated_at
      BEFORE UPDATE ON content_queue_v2
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION QUERIES (Run these after to verify success)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Check new tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%_v2' ORDER BY table_name;

-- Check new view exists
-- SELECT table_name FROM information_schema.views WHERE table_name = 'content_with_metrics_v2';

-- Check columns in content_queue_v2 (should include tone, format_strategy, visual_format)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'content_queue_v2' AND column_name IN ('tone', 'format_strategy', 'visual_format');

-- Check indexes were created
-- SELECT indexname FROM pg_indexes WHERE tablename LIKE '%_v2' ORDER BY indexname;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SUCCESS MESSAGE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- If you see no errors above, SUCCESS! 🎉
-- 
-- WHAT WAS CREATED:
-- ✅ content_queue_v2 - Complete content queue with ALL missing columns
-- ✅ posted_content_v2 - Single source for posted tweets  
-- ✅ engagement_metrics_v2 - Unified metrics with time-series
-- ✅ content_with_metrics_v2 - Perfect view for learning system
-- ✅ All performance indexes
-- ✅ Auto-update triggers
--
-- SAFETY:
-- ✅ Your old tables completely unchanged
-- ✅ System keeps working normally  
-- ✅ New tables ready for dual-write in Week 2
--
-- NEXT STEPS:
-- Week 2: Implement dual-write to both old and new tables
-- Week 3: Verify data parity
-- Week 4: Start switching reads to new tables
-- Week 5: Full switch with instant rollback capability
--
-- Your learning system will finally have ALL the data it needs! 🚀
