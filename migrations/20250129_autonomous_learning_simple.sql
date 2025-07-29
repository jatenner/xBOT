-- 🧠 AUTONOMOUS LEARNING ENHANCEMENT MIGRATION (SIMPLIFIED)
-- ==================================================
-- Essential learning system tables for autonomous Twitter bot optimization
-- Date: 2025-01-29

-- ===================================================================
-- 1. LEARNING POSTS TABLE
-- Stores learning data from real posted content
-- ===================================================================
CREATE TABLE IF NOT EXISTS learning_posts (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE,
  content TEXT NOT NULL,
  quality_score INTEGER NOT NULL DEFAULT 0,
  quality_issues TEXT[] DEFAULT '{}',
  audience_growth_potential INTEGER DEFAULT 0,
  was_posted BOOLEAN DEFAULT false,
  post_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  content_length INTEGER,
  has_hook BOOLEAN DEFAULT false,
  has_stats BOOLEAN DEFAULT false,
  has_question BOOLEAN DEFAULT false,
  learning_metadata JSONB DEFAULT '{}',
  
  -- Performance data (collected after posting)
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Learning insights
  converted_followers INTEGER DEFAULT 0,
  optimal_timing BOOLEAN DEFAULT false,
  viral_potential_score INTEGER DEFAULT 0,
  
  -- Format analysis
  format_type VARCHAR(50),
  hook_type VARCHAR(50),
  content_category VARCHAR(50),
  tone VARCHAR(50),
  
  -- Timing data
  posted_hour INTEGER,
  posted_day_of_week INTEGER,
  
  -- Updated timestamp
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 2. ENGAGEMENT METRICS TABLE
-- High-frequency engagement tracking (every 10 minutes for 48 hours)
-- ===================================================================
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  
  -- Engagement counts
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  
  -- Calculated metrics
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  engagement_velocity DECIMAL(8,4) DEFAULT 0, -- Engagements per hour
  
  -- Growth rates (compared to previous measurement)
  likes_growth_rate DECIMAL(8,4) DEFAULT 0,
  retweets_growth_rate DECIMAL(8,4) DEFAULT 0,
  replies_growth_rate DECIMAL(8,4) DEFAULT 0,
  
  -- Meta data
  hours_since_post DECIMAL(4,2) DEFAULT 0,
  is_final BOOLEAN DEFAULT false -- True after 48 hours
);

-- ===================================================================
-- 3. FORMAT PERFORMANCE STATS
-- Aggregated statistics by format type
-- ===================================================================
CREATE TABLE IF NOT EXISTS format_stats (
  id SERIAL PRIMARY KEY,
  format_type VARCHAR(50) NOT NULL,
  hook_type VARCHAR(50),
  content_category VARCHAR(50),
  
  -- Performance aggregates
  total_posts INTEGER DEFAULT 0,
  avg_likes DECIMAL(8,2) DEFAULT 0,
  avg_retweets DECIMAL(8,2) DEFAULT 0,
  avg_engagement_rate DECIMAL(8,4) DEFAULT 0,
  avg_viral_score DECIMAL(8,2) DEFAULT 0,
  
  -- Reward calculation
  total_reward DECIMAL(10,4) DEFAULT 0,
  avg_reward DECIMAL(8,4) DEFAULT 0,
  reward_variance DECIMAL(8,4) DEFAULT 0,
  
  -- Bandit algorithm parameters
  alpha DECIMAL(8,4) DEFAULT 1, -- Beta distribution alpha
  beta DECIMAL(8,4) DEFAULT 1,  -- Beta distribution beta
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  confidence_interval DECIMAL(8,4) DEFAULT 0,
  
  UNIQUE(format_type, hook_type, content_category)
);

-- ===================================================================
-- 4. TIMING PERFORMANCE STATS
-- Aggregated statistics by posting time
-- ===================================================================
CREATE TABLE IF NOT EXISTS timing_stats (
  id SERIAL PRIMARY KEY,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  
  -- Performance aggregates
  total_posts INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(8,4) DEFAULT 0,
  avg_likes DECIMAL(8,2) DEFAULT 0,
  avg_retweets DECIMAL(8,2) DEFAULT 0,
  
  -- Reward calculation
  total_reward DECIMAL(10,4) DEFAULT 0,
  avg_reward DECIMAL(8,4) DEFAULT 0,
  
  -- Statistical significance
  confidence_score DECIMAL(4,3) DEFAULT 0,
  sample_size_adequate BOOLEAN DEFAULT false,
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(hour_of_day, day_of_week)
);

-- ===================================================================
-- 5. DAILY OPTIMIZATION REPORTS
-- Track daily learning and optimization cycles
-- ===================================================================
CREATE TABLE IF NOT EXISTS daily_optimization_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  
  -- Analysis summary
  posts_analyzed INTEGER DEFAULT 0,
  avg_performance_improvement DECIMAL(8,4) DEFAULT 0,
  top_performing_format VARCHAR(100),
  optimal_posting_hour INTEGER,
  
  -- Recommendations
  format_recommendations JSONB DEFAULT '{}',
  timing_recommendations JSONB DEFAULT '{}',
  content_improvements JSONB DEFAULT '{}',
  
  -- Performance metrics
  follower_growth_24h INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(8,4) DEFAULT 0,
  viral_posts_count INTEGER DEFAULT 0,
  
  -- AI insights
  ai_insights TEXT[],
  confidence_score DECIMAL(4,3) DEFAULT 0,
  
  -- Execution status
  optimization_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  applied_at TIMESTAMP
);

-- ===================================================================
-- 6. CONTENT GENERATOR PERFORMANCE
-- Track performance of different content generators
-- ===================================================================
CREATE TABLE IF NOT EXISTS generator_performance (
  id SERIAL PRIMARY KEY,
  generator_name VARCHAR(100) NOT NULL,
  
  -- Usage statistics
  total_generations INTEGER DEFAULT 0,
  successful_posts INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_quality_score DECIMAL(6,2) DEFAULT 0,
  avg_engagement_rate DECIMAL(8,4) DEFAULT 0,
  avg_viral_score DECIMAL(8,2) DEFAULT 0,
  
  -- Success rates
  post_approval_rate DECIMAL(6,4) DEFAULT 0, -- % of generated content that gets posted
  engagement_success_rate DECIMAL(6,4) DEFAULT 0, -- % above average engagement
  
  -- Bandit parameters for generator selection
  alpha DECIMAL(8,4) DEFAULT 1,
  beta DECIMAL(8,4) DEFAULT 1,
  
  -- Metadata
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(generator_name)
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON learning_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_learning_posts_engagement_rate ON learning_posts(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_learning_posts_format ON learning_posts(format_type, hook_type);
CREATE INDEX IF NOT EXISTS idx_learning_posts_timing ON learning_posts(posted_hour, posted_day_of_week);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_tweet_id ON engagement_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_recorded_at ON engagement_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_final ON engagement_metrics(is_final);

CREATE INDEX IF NOT EXISTS idx_format_stats_performance ON format_stats(avg_reward DESC);
CREATE INDEX IF NOT EXISTS idx_timing_stats_performance ON timing_stats(avg_reward DESC);
CREATE INDEX IF NOT EXISTS idx_timing_stats_hour ON timing_stats(hour_of_day);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_optimization_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_generator_performance_name ON generator_performance(generator_name);

-- ===================================================================
-- FUNCTIONS FOR REWARD CALCULATION
-- ===================================================================

-- Function to calculate engagement reward
CREATE OR REPLACE FUNCTION calculate_engagement_reward(
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  bookmarks INTEGER DEFAULT 0
) RETURNS DECIMAL(8,4) AS $$
BEGIN
  -- Weighted reward: likes(0.4) + retweets(0.3) + replies(0.2) + bookmarks(0.1)
  RETURN (
    COALESCE(likes, 0) * 0.4 +
    COALESCE(retweets, 0) * 0.3 +
    COALESCE(replies, 0) * 0.2 +
    COALESCE(bookmarks, 0) * 0.1
  )::DECIMAL(8,4);
END;
$$ LANGUAGE plpgsql;

-- Function to get optimal format based on current performance
CREATE OR REPLACE FUNCTION get_optimal_format()
RETURNS TABLE(
  format_type VARCHAR(50),
  hook_type VARCHAR(50),
  content_category VARCHAR(50),
  avg_reward DECIMAL(8,4),
  confidence_score DECIMAL(6,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fs.format_type,
    fs.hook_type,
    fs.content_category,
    fs.avg_reward,
    CASE 
      WHEN fs.total_posts >= 10 THEN 0.95
      WHEN fs.total_posts >= 5 THEN 0.80
      ELSE 0.60
    END as confidence_score
  FROM format_stats fs
  WHERE fs.total_posts >= 3
  ORDER BY fs.avg_reward DESC, fs.total_posts DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to get optimal posting times
CREATE OR REPLACE FUNCTION get_optimal_timing()
RETURNS TABLE(
  hour_of_day INTEGER,
  day_of_week INTEGER,
  avg_reward DECIMAL(8,4),
  confidence_score DECIMAL(6,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.hour_of_day,
    ts.day_of_week,
    ts.avg_reward,
    CASE 
      WHEN ts.total_posts >= 5 THEN 0.90
      WHEN ts.total_posts >= 3 THEN 0.70
      ELSE 0.50
    END as confidence_score
  FROM timing_stats ts
  WHERE ts.sample_size_adequate = true
  ORDER BY ts.avg_reward DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- INITIAL DATA SEEDING
-- ===================================================================

-- Seed some default generator performance records
INSERT INTO generator_performance (generator_name, alpha, beta) VALUES
  ('EliteTwitterContentStrategist', 2, 1),
  ('EnhancedContentGenerator', 1, 1),
  ('DataStoryTeller', 1, 2),
  ('ContrarianTruthBot', 1, 2)
ON CONFLICT (generator_name) DO NOTHING; 