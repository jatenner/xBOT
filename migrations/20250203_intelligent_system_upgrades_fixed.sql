-- =====================================================
-- INTELLIGENT SYSTEM UPGRADES (FIXED)
-- Adds follower tracking, contextual bandit, and alerting infrastructure
-- Handles existing tables properly
-- =====================================================

-- First, check and drop existing trending_topics if it has wrong schema
DO $$
BEGIN
  -- Check if trending_topics exists and doesn't have expires_at column
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trending_topics') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trending_topics' AND column_name = 'expires_at') THEN
      -- Drop the old table since it doesn't have the right schema
      DROP TABLE trending_topics CASCADE;
      RAISE NOTICE 'Dropped existing trending_topics table with incorrect schema';
    END IF;
  END IF;
END $$;

-- 📊 Follower Snapshots - Track follower count over time
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id bigserial PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  follower_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  tweets_count integer NOT NULL DEFAULT 0,
  account_handle text NOT NULL,
  
  created_at timestamptz DEFAULT now()
);

-- 📈 Follower Deltas - Track follower changes per tweet
CREATE TABLE IF NOT EXISTS follower_deltas (
  id bigserial PRIMARY KEY,
  tweet_id text,
  before_count integer NOT NULL,
  after_count integer NOT NULL,
  follower_gain integer NOT NULL,
  time_window_minutes integer NOT NULL,
  confidence decimal(5,2) NOT NULL DEFAULT 1.0,
  timestamp timestamptz NOT NULL DEFAULT now(),
  
  created_at timestamptz DEFAULT now()
);

-- 🎯 Bandit States - Store LinUCB bandit learning states
CREATE TABLE IF NOT EXISTS bandit_states (
  action_id text PRIMARY KEY,
  matrix_a text NOT NULL, -- JSON serialized covariance matrix
  vector_b text NOT NULL, -- JSON serialized reward vector
  alpha decimal(10,6) NOT NULL DEFAULT 1.0,
  dimension integer NOT NULL DEFAULT 8,
  last_update timestamptz NOT NULL DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 📝 Bandit Selections - Log all bandit action selections
CREATE TABLE IF NOT EXISTS bandit_selections (
  id bigserial PRIMARY KEY,
  action_id text NOT NULL,
  action_name text NOT NULL,
  action_type text NOT NULL,
  context text NOT NULL, -- JSON serialized context
  ucb_score decimal(10,6) NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  
  -- Performance tracking
  actual_reward decimal(10,6),
  reward_updated_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- 🎨 CTA Templates - Call-to-action optimization
CREATE TABLE IF NOT EXISTS cta_templates (
  id text PRIMARY KEY,
  text_template text NOT NULL,
  emoji_style text,
  tone text NOT NULL, -- 'engaging', 'direct', 'question', 'save'
  category text NOT NULL, -- 'reply_request', 'save_action', 'share_request'
  
  -- Performance metrics
  usage_count integer DEFAULT 0,
  avg_reply_rate decimal(5,2) DEFAULT 0,
  avg_retweet_rate decimal(5,2) DEFAULT 0,
  success_score decimal(5,2) DEFAULT 0,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 📰 Trending Topics Cache (RECREATED WITH PROPER SCHEMA)
CREATE TABLE IF NOT EXISTS trending_topics (
  id bigserial PRIMARY KEY,
  keyword text NOT NULL,
  source text NOT NULL, -- 'twitter', 'guardian', 'manual'
  category text NOT NULL, -- 'health', 'nutrition', 'fitness', 'science'
  trend_score decimal(5,2) NOT NULL DEFAULT 0,
  volume integer DEFAULT 0,
  sentiment decimal(3,2) DEFAULT 0, -- -1 to 1
  
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  
  created_at timestamptz DEFAULT now()
);

-- 🚨 System Alerts - Intelligent monitoring
CREATE TABLE IF NOT EXISTS system_alerts (
  id bigserial PRIMARY KEY,
  alert_type text NOT NULL, -- 'session_missing', 'budget_high', 'follower_drop', 'posting_failure'
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  is_resolved boolean DEFAULT false,
  
  -- Auto-resolution
  auto_resolve_after interval DEFAULT '24 hours',
  
  created_at timestamptz DEFAULT now()
);

-- 📊 Enhanced Tweet Features - Extended feature tracking
CREATE TABLE IF NOT EXISTS tweet_features_extended (
  id bigserial PRIMARY KEY,
  tweet_id text NOT NULL,
  
  -- Content features
  word_count integer,
  sentence_count integer,
  emoji_count integer,
  hashtag_count integer,
  mention_count integer,
  url_count integer,
  
  -- Style features
  has_hook boolean DEFAULT false,
  hook_type text, -- 'question', 'stat', 'story', 'controversy'
  sentiment_score decimal(3,2), -- -1 to 1
  readability_score decimal(5,2),
  
  -- Context features
  posting_hour integer,
  posting_day_of_week integer,
  trending_keywords text[], -- Array of trending keywords used
  topic_cluster text,
  
  -- Performance prediction
  predicted_engagement decimal(5,2),
  predicted_follower_gain integer,
  actual_follower_gain integer,
  prediction_accuracy decimal(5,2),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 📈 Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_timestamp ON follower_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_follower_deltas_tweet_id ON follower_deltas(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_deltas_timestamp ON follower_deltas(timestamp);
CREATE INDEX IF NOT EXISTS idx_bandit_selections_action_id ON bandit_selections(action_id);
CREATE INDEX IF NOT EXISTS idx_bandit_selections_selected_at ON bandit_selections(selected_at);
CREATE INDEX IF NOT EXISTS idx_trending_topics_category ON trending_topics(category);
CREATE INDEX IF NOT EXISTS idx_trending_topics_expires_at ON trending_topics(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_alert_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_triggered_at ON system_alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_tweet_features_extended_tweet_id ON tweet_features_extended(tweet_id);

-- 🔄 Auto-update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bandit_states_updated_at') THEN
    CREATE TRIGGER update_bandit_states_updated_at
      BEFORE UPDATE ON bandit_states
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cta_templates_updated_at') THEN
    CREATE TRIGGER update_cta_templates_updated_at
      BEFORE UPDATE ON cta_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tweet_features_extended_updated_at') THEN
    CREATE TRIGGER update_tweet_features_extended_updated_at
      BEFORE UPDATE ON tweet_features_extended
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 🎯 Insert default CTA templates
INSERT INTO cta_templates (id, text_template, emoji_style, tone, category) VALUES
('engage_question', 'What''s your experience with this?', '🤔', 'engaging', 'reply_request'),
('save_bookmark', 'Save this for later', '📌', 'direct', 'save_action'),
('share_thread', 'Share this thread if it helped you', '🔄', 'direct', 'share_request'),
('thoughts_question', 'Thoughts on this?', '💭', 'engaging', 'reply_request'),
('favorite_tip', 'What''s your favorite tip from this list?', '⭐', 'engaging', 'reply_request'),
('save_reference', 'Bookmark this for reference', '🔖', 'direct', 'save_action'),
('tag_friend', 'Tag someone who needs to see this', '👥', 'engaging', 'share_request'),
('which_resonates', 'Which point resonates most with you?', '🎯', 'engaging', 'reply_request')
ON CONFLICT (id) DO UPDATE SET
  text_template = EXCLUDED.text_template,
  updated_at = now();

-- 🎨 Function to get optimal CTA for context
CREATE OR REPLACE FUNCTION get_optimal_cta(
  p_category text DEFAULT NULL,
  p_tone text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  text_template text,
  emoji_style text,
  success_score decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cta.id,
    cta.text_template,
    cta.emoji_style,
    cta.success_score
  FROM cta_templates cta
  WHERE 
    cta.is_active = true
    AND (p_category IS NULL OR cta.category = p_category)
    AND (p_tone IS NULL OR cta.tone = p_tone)
  ORDER BY cta.success_score DESC, cta.usage_count ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 📊 Function to get recent follower performance
CREATE OR REPLACE FUNCTION get_recent_follower_performance(days_back integer DEFAULT 7)
RETURNS TABLE (
  total_follower_gain integer,
  avg_daily_gain decimal,
  tweets_with_positive_gain bigint,
  total_tweets bigint,
  success_rate decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(fd.follower_gain), 0)::integer as total_follower_gain,
    ROUND(COALESCE(SUM(fd.follower_gain), 0)::decimal / days_back, 2) as avg_daily_gain,
    COUNT(*) FILTER (WHERE fd.follower_gain > 0) as tweets_with_positive_gain,
    COUNT(*) as total_tweets,
    ROUND(
      (COUNT(*) FILTER (WHERE fd.follower_gain > 0)::decimal / GREATEST(COUNT(*), 1)) * 100, 
      2
    ) as success_rate
  FROM follower_deltas fd
  WHERE fd.timestamp > now() - (days_back || ' days')::interval
    AND fd.confidence > 0.5;
END;
$$ LANGUAGE plpgsql;

-- 🚨 Function to create system alert
CREATE OR REPLACE FUNCTION create_system_alert(
  p_alert_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
  alert_id bigint;
BEGIN
  INSERT INTO system_alerts (alert_type, severity, title, message, metadata)
  VALUES (p_alert_type, p_severity, p_title, p_message, p_metadata)
  RETURNING id INTO alert_id;
  
  -- Auto-resolve info alerts after 6 hours
  IF p_severity = 'info' THEN
    UPDATE system_alerts 
    SET auto_resolve_after = '6 hours'
    WHERE id = alert_id;
  END IF;
  
  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- 🔄 Auto-resolve old alerts
CREATE OR REPLACE FUNCTION auto_resolve_old_alerts()
RETURNS void AS $$
BEGIN
  UPDATE system_alerts 
  SET 
    is_resolved = true,
    resolved_at = now()
  WHERE 
    is_resolved = false 
    AND triggered_at + auto_resolve_after < now();
END;
$$ LANGUAGE plpgsql;

-- Add to migration history
INSERT INTO migration_history (filename, applied_at) 
VALUES ('20250203_intelligent_system_upgrades_fixed.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✅ FIXED Intelligent System Upgrades migration completed successfully';
  RAISE NOTICE '📊 Created/Fixed tables: follower_snapshots, follower_deltas, bandit_states, bandit_selections';
  RAISE NOTICE '🎨 Created CTA optimization system with 8 default templates';
  RAISE NOTICE '📰 Fixed trending topics cache with proper expires_at column';
  RAISE NOTICE '🚨 Built intelligent monitoring and auto-resolution system';
  RAISE NOTICE '📈 Enhanced tweet feature tracking for ML predictions';
END $$;