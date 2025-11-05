-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VISUAL INTELLIGENCE SYSTEM - Database Schema
-- Date: November 5, 2025
-- Purpose: Store and analyze Twitter content to learn visual formatting patterns
-- Risk: ZERO - Completely separate tables, doesn't touch existing system
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 1: scrape_targets
-- Purpose: Accounts to monitor for visual intelligence
-- Tracks: 100 seed accounts + auto-discovered accounts
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vi_scrape_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  
  -- Tier classification (auto-assigned based on follower count)
  tier TEXT CHECK (tier IN ('viral_unknown', 'micro', 'growth', 'established')),
  tier_weight FLOAT, -- 3.0 (viral unknown), 2.0 (micro), 1.0 (growth), 0.5 (established)
  
  -- Account metadata (captured when added)
  followers_count INT,
  avg_engagement_rate FLOAT,
  bio_text TEXT,
  
  -- Discovery metadata
  discovery_method TEXT, -- 'manual_seed', 'reply_network', 'following_network', 'keyword_search'
  inclusion_reason TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_health_verified BOOLEAN DEFAULT false, -- Manually verified as health niche
  
  -- Scraping status
  last_scraped_at TIMESTAMPTZ,
  scrape_success_count INT DEFAULT 0,
  scrape_failure_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vi_scrape_targets_tier ON vi_scrape_targets(tier, tier_weight DESC);
CREATE INDEX idx_vi_scrape_targets_active ON vi_scrape_targets(is_active) WHERE is_active = true;
CREATE INDEX idx_vi_scrape_targets_last_scraped ON vi_scrape_targets(last_scraped_at);

COMMENT ON TABLE vi_scrape_targets IS 
  'Accounts monitored for visual intelligence. Includes 100 seed accounts plus auto-discovered micro-influencers.';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 2: twitter_intelligence
-- Purpose: Raw tweets collected from monitored accounts
-- Storage: All tweets from scrape_targets, flagged if viral
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vi_collected_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  author_username TEXT NOT NULL,
  
  -- Tier (inherited from scrape_targets)
  tier TEXT NOT NULL,
  tier_weight FLOAT NOT NULL,
  
  -- Account context
  author_followers INT,
  
  -- Content
  content TEXT NOT NULL,
  is_thread BOOLEAN DEFAULT false,
  thread_length INT DEFAULT 1,
  
  -- Engagement metrics
  views BIGINT DEFAULT 0,
  likes INT DEFAULT 0,
  retweets INT DEFAULT 0,
  replies INT DEFAULT 0,
  bookmarks INT DEFAULT 0,
  quotes INT DEFAULT 0,
  
  -- Calculated
  engagement_rate FLOAT,
  is_viral BOOLEAN DEFAULT false, -- True if views > threshold for tier
  viral_multiplier FLOAT, -- views / (followers × 0.05) - overperformance score
  
  -- Timestamps
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Processing status
  classified BOOLEAN DEFAULT false,
  analyzed BOOLEAN DEFAULT false,
  
  FOREIGN KEY (author_username) REFERENCES vi_scrape_targets(username) ON DELETE CASCADE
);

CREATE INDEX idx_vi_collected_tweets_author ON vi_collected_tweets(author_username);
CREATE INDEX idx_vi_collected_tweets_tier ON vi_collected_tweets(tier, tier_weight);
CREATE INDEX idx_vi_collected_tweets_viral ON vi_collected_tweets(is_viral, engagement_rate DESC);
CREATE INDEX idx_vi_collected_tweets_posted ON vi_collected_tweets(posted_at DESC);
CREATE INDEX idx_vi_collected_tweets_classified ON vi_collected_tweets(classified) WHERE classified = false;
CREATE INDEX idx_vi_collected_tweets_analyzed ON vi_collected_tweets(analyzed) WHERE analyzed = false;

COMMENT ON TABLE vi_collected_tweets IS 
  'Raw tweets from monitored accounts. Tier-weighted for intelligence building.';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 3: viral_unknown_tweets
-- Purpose: High-performing tweets from small accounts (<10k followers)
-- These are GOLD - prove content quality beats brand recognition
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vi_viral_unknowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  author_username TEXT NOT NULL,
  
  -- Why this is valuable
  author_followers_at_viral INT, -- Followers when tweet went viral
  views BIGINT,
  likes INT DEFAULT 0,
  retweets INT DEFAULT 0,
  replies INT DEFAULT 0,
  engagement_rate FLOAT,
  
  -- Content
  content TEXT NOT NULL,
  
  -- Discovery
  discovered_via TEXT, -- 'keyword_search', 'trending', 'manual'
  discovery_keyword TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Processing
  classified BOOLEAN DEFAULT false,
  analyzed BOOLEAN DEFAULT false,
  
  -- Highest weight for intelligence building
  tier_weight FLOAT DEFAULT 3.0
);

CREATE INDEX idx_vi_viral_unknowns_followers ON vi_viral_unknowns(author_followers_at_viral);
CREATE INDEX idx_vi_viral_unknowns_views ON vi_viral_unknowns(views DESC);
CREATE INDEX idx_vi_viral_unknowns_classified ON vi_viral_unknowns(classified) WHERE classified = false;

COMMENT ON TABLE vi_viral_unknowns IS 
  'Viral tweets from small accounts (<10k followers). 3x weight in pattern analysis.';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 4: content_classification
-- Purpose: AI-extracted attributes (topic, angle, tone, structure)
-- Links to: twitter_intelligence OR viral_unknown_tweets
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vi_content_classification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  source_table TEXT NOT NULL CHECK (source_table IN ('vi_collected_tweets', 'vi_viral_unknowns')),
  
  -- Core attributes (matches YOUR generator system)
  topic TEXT, -- 'sleep', 'exercise', 'supplements', 'longevity', 'nutrition', etc.
  topic_confidence FLOAT,
  
  angle TEXT, -- 'provocative', 'research', 'personal', 'controversial', 'practical', etc.
  angle_confidence FLOAT,
  
  tone TEXT, -- 'authoritative', 'conversational', 'provocative', 'educational', etc.
  tone_confidence FLOAT,
  
  structure TEXT, -- 'question_hook', 'stat_hook', 'story', 'myth_truth', 'list', etc.
  structure_confidence FLOAT,
  
  classified_at TIMESTAMPTZ DEFAULT NOW(),
  classification_version INT DEFAULT 1
);

CREATE INDEX idx_vi_classification_tweet ON vi_content_classification(tweet_id);
CREATE INDEX idx_vi_classification_topic ON vi_content_classification(topic);
CREATE INDEX idx_vi_classification_combo ON vi_content_classification(topic, angle, tone, structure);
CREATE INDEX idx_vi_classification_confidence ON vi_content_classification(topic_confidence) WHERE topic_confidence >= 0.6;

COMMENT ON TABLE vi_content_classification IS 
  'AI-extracted content attributes. High confidence (>0.6) used for pattern matching.';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 5: visual_patterns
-- Purpose: Extracted visual formatting patterns (emojis, line breaks, hooks, etc.)
-- Links to: twitter_intelligence OR viral_unknown_tweets
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vi_visual_formatting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  source_table TEXT NOT NULL CHECK (source_table IN ('vi_collected_tweets', 'vi_viral_unknowns')),
  
  -- Basic structure
  char_count INT NOT NULL,
  word_count INT NOT NULL,
  sentence_count INT NOT NULL,
  line_count INT NOT NULL,
  line_breaks INT NOT NULL,
  
  -- Emojis
  emoji_count INT DEFAULT 0,
  emoji_list TEXT[],
  emoji_positions TEXT[], -- ['start', 'middle', 'end']
  
  -- Formatting elements
  has_bullets BOOLEAN DEFAULT false,
  has_numbers BOOLEAN DEFAULT false,
  has_caps BOOLEAN DEFAULT false,
  caps_words TEXT[],
  has_quotes BOOLEAN DEFAULT false,
  has_hashtags BOOLEAN DEFAULT false,
  hashtag_count INT DEFAULT 0,
  
  -- Hook analysis
  hook_type TEXT, -- 'question', 'stat', 'controversy', 'story', 'statement'
  starts_with TEXT, -- First 50 chars
  
  -- Credibility markers
  cites_source BOOLEAN DEFAULT false,
  source_type TEXT, -- 'study', 'research', 'expert', 'book', 'data'
  has_stats BOOLEAN DEFAULT false,
  
  -- Special characters
  uses_arrows BOOLEAN DEFAULT false, -- ↑ ↓ → ←
  uses_special_chars TEXT[], -- ['→', '•', '▪', '≠', etc.]
  
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vi_visual_formatting_tweet ON vi_visual_formatting(tweet_id);
CREATE INDEX idx_vi_visual_formatting_hook ON vi_visual_formatting(hook_type);
CREATE INDEX idx_vi_visual_formatting_emoji ON vi_visual_formatting(emoji_count);

COMMENT ON TABLE vi_visual_formatting IS 
  'Visual formatting patterns extracted from tweets. Used to build formatting intelligence.';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 6: pattern_intelligence
-- Purpose: Aggregated visual recommendations for topic/angle/tone combinations
-- Query: "What visual format works for sleep + provocative + question?"
-- Returns: Proven patterns from tier-weighted tweet analysis
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vi_format_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Query parameters (what System B asks for)
  topic TEXT NOT NULL,
  angle TEXT,
  tone TEXT,
  structure TEXT,
  
  -- Composite key for fast lookups
  query_key TEXT UNIQUE NOT NULL, -- topic|angle|tone|structure
  
  -- Visual recommendations (JSONB for flexibility)
  recommended_format JSONB NOT NULL,
  /* Example structure:
  {
    "char_count": {"median": 165, "range": [140, 220]},
    "line_breaks": {"median": 3, "mode": 2},
    "emoji_count": {"median": 0, "range": [0, 2]},
    "emoji_positions": ["end", "middle"],
    "hook_pattern": "question",
    "cite_source_pct": 0.73,
    "caps_usage": "single_word"
  }
  */
  
  -- Tier breakdown (shows data sources)
  tier_breakdown JSONB NOT NULL,
  /* Example:
  {
    "viral_unknowns": {"count": 23, "avg_engagement": 0.067},
    "micro": {"count": 47, "avg_engagement": 0.042},
    "growth": {"count": 31, "avg_engagement": 0.038},
    "established": {"count": 12, "avg_engagement": 0.051}
  }
  */
  
  -- Top examples (for AI to learn from)
  example_tweet_ids JSONB,
  /* Example:
  {
    "viral_unknowns": ["id1", "id2"],
    "micro": ["id3", "id4", "id5"]
  }
  */
  
  -- Metadata
  primary_tier TEXT, -- Which tier contributed most data
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low', 'fallback')),
  confidence_note TEXT,
  based_on_count INT NOT NULL,
  weighted_avg_engagement FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vi_format_intelligence_query ON vi_format_intelligence(query_key);
CREATE INDEX idx_vi_format_intelligence_topic ON vi_format_intelligence(topic);
CREATE INDEX idx_vi_format_intelligence_confidence ON vi_format_intelligence(confidence_level);
CREATE INDEX idx_vi_format_intelligence_primary_tier ON vi_format_intelligence(primary_tier);

COMMENT ON TABLE vi_format_intelligence IS 
  'Tier-weighted visual formatting recommendations. Query by topic/angle/tone to get proven patterns.';

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS (Ensure proper permissions)
-- ════════════════════════════════════════════════════════════════════════════

GRANT ALL ON vi_scrape_targets TO anon, authenticated, service_role;
GRANT ALL ON vi_collected_tweets TO anon, authenticated, service_role;
GRANT ALL ON vi_viral_unknowns TO anon, authenticated, service_role;
GRANT ALL ON vi_content_classification TO anon, authenticated, service_role;
GRANT ALL ON vi_visual_formatting TO anon, authenticated, service_role;
GRANT ALL ON vi_format_intelligence TO anon, authenticated, service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- SAFETY VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Verify tables created:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN 
--   ('scrape_targets', 'twitter_intelligence', 'viral_unknown_tweets', 
--    'content_classification', 'visual_patterns', 'pattern_intelligence');

-- Verify no conflicts with existing tables:
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%content%' OR table_name LIKE '%twitter%';

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK PLAN (If Needed)
-- ════════════════════════════════════════════════════════════════════════════

-- DROP TABLE IF EXISTS vi_format_intelligence CASCADE;
-- DROP TABLE IF EXISTS vi_visual_formatting CASCADE;
-- DROP TABLE IF EXISTS vi_content_classification CASCADE;
-- DROP TABLE IF EXISTS vi_viral_unknowns CASCADE;
-- DROP TABLE IF EXISTS vi_collected_tweets CASCADE;
-- DROP TABLE IF EXISTS vi_scrape_targets CASCADE;

