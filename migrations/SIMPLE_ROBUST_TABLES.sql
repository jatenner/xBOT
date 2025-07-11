-- ===================================================================
-- 🚀 SIMPLE ROBUST TABLES - BULLETPROOF VERSION
-- ===================================================================
-- Extremely simple table creation - no fancy features
-- Copy this into Supabase SQL Editor
-- ===================================================================

-- 1. Twitter Rate Limits (Minimal)
CREATE TABLE IF NOT EXISTS twitter_rate_limits (
  id INTEGER DEFAULT 1,
  tweets_used INTEGER DEFAULT 0,
  last_reset TIMESTAMP DEFAULT NOW()
);

-- 2. Tweet Performance (Minimal)
CREATE TABLE IF NOT EXISTS tweet_performance (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT,
  content TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Daily Growth (Minimal)
CREATE TABLE IF NOT EXISTS daily_growth (
  date DATE PRIMARY KEY,
  followers INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0
);

-- 4. Quality Improvements (Minimal)
CREATE TABLE IF NOT EXISTS quality_improvements (
  id SERIAL PRIMARY KEY,
  original_content TEXT,
  improved_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Cached Insights (Minimal)
CREATE TABLE IF NOT EXISTS cached_insights (
  id TEXT PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Content Templates (Minimal)
CREATE TABLE IF NOT EXISTS content_templates (
  id TEXT PRIMARY KEY,
  template TEXT,
  score INTEGER DEFAULT 50
);

-- 7. System Logs (Minimal)
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  action TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Insert initial data
INSERT INTO twitter_rate_limits (id, tweets_used) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- 9. Insert basic templates
INSERT INTO content_templates (id, template, score) VALUES 
('basic_1', 'Research shows: {finding}', 70),
('basic_2', 'Breaking: {news}', 80),
('basic_3', 'Analysis: {insight}', 60)
ON CONFLICT (id) DO NOTHING;

-- 10. Success check
SELECT 'Simple tables created successfully!' as status; 