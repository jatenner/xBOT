-- =====================================================
-- THREAD STYLE LEARNING SYSTEM
-- Tracks performance of different thread styles for A/B testing
-- =====================================================

-- 📊 Thread Style Performance Tracking
CREATE TABLE IF NOT EXISTS thread_style_performance (
  id bigserial PRIMARY KEY,
  style_id text NOT NULL,
  post_type text NOT NULL CHECK (post_type IN ('single', 'thread')),
  
  -- Engagement metrics
  likes integer DEFAULT 0,
  retweets integer DEFAULT 0,
  replies integer DEFAULT 0,
  impressions integer DEFAULT 0,
  
  -- Growth metrics
  follower_change integer DEFAULT 0,
  follower_count_before integer DEFAULT 0,
  follower_count_after integer DEFAULT 0,
  
  -- Post details
  tweet_id text,
  post_content text,
  posted_at timestamptz DEFAULT now(),
  
  -- Performance scoring
  engagement_rate decimal(5,2) DEFAULT 0,
  viral_score decimal(5,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 🎯 Thread Style Definitions
CREATE TABLE IF NOT EXISTS thread_style_definitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  numbering_format text,
  hook_style text,
  
  -- Performance tracking
  total_uses integer DEFAULT 0,
  avg_engagement_rate decimal(5,2) DEFAULT 0,
  avg_follower_growth decimal(5,2) DEFAULT 0,
  success_rate decimal(5,2) DEFAULT 0,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 📈 A/B Test Experiments Log
CREATE TABLE IF NOT EXISTS style_ab_experiments (
  id bigserial PRIMARY KEY,
  experiment_name text,
  style_a text REFERENCES thread_style_definitions(id),
  style_b text REFERENCES thread_style_definitions(id),
  
  -- Results
  style_a_performance jsonb,
  style_b_performance jsonb,
  winner text,
  confidence_level decimal(5,2),
  
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'paused'))
);

-- 🚀 Insert default thread styles
INSERT INTO thread_style_definitions (id, name, description, numbering_format, hook_style) VALUES
('emoji_numbers', 'Emoji Numbers', 'Use emoji numbers (1️⃣, 2️⃣, 3️⃣) for visual appeal', 'emoji', 'subtle'),
('slash_numbers', 'Slash Numbers', 'Traditional Twitter threading (1/, 2/, 3/)', 'slash', 'subtle'),
('dot_numbers', 'Dot Numbers', 'Clean numbered list style (1., 2., 3.)', 'dot', 'subtle'),
('arrow_style', 'Arrow Style', 'Modern arrow threading (→ Point 1, → Point 2)', 'arrow', 'modern'),
('minimal_clean', 'Minimal Clean', 'No numbering, just clean content flow', 'none', 'minimal')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- 📊 Indexes for performance
CREATE INDEX IF NOT EXISTS idx_thread_performance_style_type ON thread_style_performance(style_id, post_type);
CREATE INDEX IF NOT EXISTS idx_thread_performance_posted_at ON thread_style_performance(posted_at);
CREATE INDEX IF NOT EXISTS idx_thread_performance_engagement ON thread_style_performance(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_thread_performance_followers ON thread_style_performance(follower_change DESC);

-- 🔄 Update triggers for automatic calculations
CREATE OR REPLACE FUNCTION update_style_performance_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate engagement rate
  IF NEW.impressions > 0 THEN
    NEW.engagement_rate = ((NEW.likes + NEW.retweets + NEW.replies)::decimal / NEW.impressions) * 100;
  END IF;
  
  -- Calculate viral score (weighted engagement + follower growth)
  NEW.viral_score = (NEW.engagement_rate * 0.7) + (GREATEST(NEW.follower_change, 0) * 0.3);
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_performance_metrics_trigger
  BEFORE INSERT OR UPDATE ON thread_style_performance
  FOR EACH ROW EXECUTE FUNCTION update_style_performance_metrics();

-- 📊 Function to get best performing style
CREATE OR REPLACE FUNCTION get_best_performing_style(post_type_filter text DEFAULT NULL)
RETURNS TABLE (
  style_id text,
  avg_engagement decimal,
  avg_follower_growth decimal,
  total_posts bigint,
  success_score decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tsp.style_id,
    ROUND(AVG(tsp.engagement_rate), 2) as avg_engagement,
    ROUND(AVG(tsp.follower_change), 2) as avg_follower_growth,
    COUNT(*) as total_posts,
    ROUND(
      (AVG(tsp.engagement_rate) * 0.6) + 
      (AVG(GREATEST(tsp.follower_change, 0)) * 0.4), 2
    ) as success_score
  FROM thread_style_performance tsp
  WHERE 
    (post_type_filter IS NULL OR tsp.post_type = post_type_filter)
    AND tsp.posted_at > now() - interval '30 days'  -- Last 30 days only
  GROUP BY tsp.style_id
  HAVING COUNT(*) >= 3  -- At least 3 posts to be considered
  ORDER BY success_score DESC;
END;
$$ LANGUAGE plpgsql;

-- 🎯 Function to log style performance
CREATE OR REPLACE FUNCTION log_style_performance(
  p_style_id text,
  p_post_type text,
  p_tweet_id text,
  p_likes integer DEFAULT 0,
  p_retweets integer DEFAULT 0,
  p_replies integer DEFAULT 0,
  p_impressions integer DEFAULT 0,
  p_follower_change integer DEFAULT 0,
  p_post_content text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO thread_style_performance (
    style_id, post_type, tweet_id, likes, retweets, replies, 
    impressions, follower_change, post_content
  ) VALUES (
    p_style_id, p_post_type, p_tweet_id, p_likes, p_retweets, 
    p_replies, p_impressions, p_follower_change, p_post_content
  );
  
  -- Update style definition stats
  UPDATE thread_style_definitions 
  SET 
    total_uses = total_uses + 1,
    updated_at = now()
  WHERE id = p_style_id;
END;
$$ LANGUAGE plpgsql;

-- 🔄 Function to update style aggregates (run periodically)
CREATE OR REPLACE FUNCTION update_style_aggregates()
RETURNS void AS $$
BEGIN
  UPDATE thread_style_definitions 
  SET 
    avg_engagement_rate = COALESCE(subq.avg_engagement, 0),
    avg_follower_growth = COALESCE(subq.avg_follower_growth, 0),
    success_rate = COALESCE(subq.success_rate, 0),
    updated_at = now()
  FROM (
    SELECT 
      style_id,
      ROUND(AVG(engagement_rate), 2) as avg_engagement,
      ROUND(AVG(follower_change), 2) as avg_follower_growth,
      ROUND(AVG(CASE WHEN viral_score > 5 THEN 100 ELSE 0 END), 2) as success_rate
    FROM thread_style_performance
    WHERE posted_at > now() - interval '30 days'
    GROUP BY style_id
  ) subq
  WHERE thread_style_definitions.id = subq.style_id;
END;
$$ LANGUAGE plpgsql;

-- Add to migration history
INSERT INTO migration_history (filename, applied_at) 
VALUES ('20250203_thread_style_learning_system.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✅ Thread Style Learning System migration completed successfully';
  RAISE NOTICE '📊 Created tables: thread_style_performance, thread_style_definitions, style_ab_experiments';
  RAISE NOTICE '🎯 Added 5 default thread styles for A/B testing';
  RAISE NOTICE '📈 Performance tracking functions ready for adaptive learning';
END $$;