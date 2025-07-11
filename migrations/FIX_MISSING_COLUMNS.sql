-- ===================================================================
-- 🔧 FIX MISSING COLUMNS
-- ===================================================================
-- Adds missing columns to existing tables
-- ===================================================================

-- Fix system_logs table
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'system';

-- Fix content_templates table  
ALTER TABLE content_templates ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
ALTER TABLE content_templates ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2) DEFAULT 50;
ALTER TABLE content_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Fix twitter_rate_limits table
ALTER TABLE twitter_rate_limits ADD COLUMN IF NOT EXISTS tweets_3_hour_used INTEGER DEFAULT 0;
ALTER TABLE twitter_rate_limits ADD COLUMN IF NOT EXISTS tweets_24_hour_used INTEGER DEFAULT 0;
ALTER TABLE twitter_rate_limits ADD COLUMN IF NOT EXISTS tweets_monthly_used INTEGER DEFAULT 0;

-- Fix tweet_performance table
ALTER TABLE tweet_performance ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'general';
ALTER TABLE tweet_performance ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT 'unknown';

-- Seed content templates
INSERT INTO content_templates (id, template, type, performance_score) VALUES 
('research_1', 'Research shows: {finding}', 'research', 75),
('news_1', 'Breaking: {headline}', 'news', 80),
('analysis_1', 'Analysis reveals: {insight}', 'analysis', 70),
('expert_1', 'Expert view: {opinion}', 'expert', 65),
('trend_1', 'Trending: {topic}', 'trend', 60)
ON CONFLICT (id) DO UPDATE SET 
  template = EXCLUDED.template,
  type = EXCLUDED.type,
  performance_score = EXCLUDED.performance_score;

-- Log the fix
INSERT INTO system_logs (action, source) VALUES ('columns_fixed', 'migration_fix');

-- Success message
SELECT 'Missing columns added successfully!' as status; 