-- 🧠 COMPLETE BRAIN INFRASTRUCTURE
-- ================================
-- Add the final missing tables for full AI mind capability

-- Bot Usage Tracking Table (for self-awareness)
CREATE TABLE IF NOT EXISTS bot_usage_tracking (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL, -- 'tweet', 'news', 'image', 'openai'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Logs Table (for debugging and learning)
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  data JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'system'
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bot_usage_action_date ON bot_usage_tracking(action, date);
CREATE INDEX IF NOT EXISTS idx_bot_usage_timestamp ON bot_usage_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);

-- Automatic tracking trigger for tweets
CREATE OR REPLACE FUNCTION update_bot_usage_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bot_usage_tracking (action, date, hour, metadata)
  VALUES (
    'tweet',
    CURRENT_DATE,
    EXTRACT(HOUR FROM NOW()),
    jsonb_build_object(
      'tweet_id', NEW.tweet_id,
      'content_type', COALESCE(NEW.tweet_type, 'original'),
      'engagement_score', COALESCE(NEW.engagement_score, 0)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tweets table (if not exists)
DROP TRIGGER IF EXISTS trigger_bot_usage_tracking ON tweets;
CREATE TRIGGER trigger_bot_usage_tracking
  AFTER INSERT ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_usage_tracking();

-- Insert initial system log
INSERT INTO system_logs (action, data, source) VALUES 
('brain_infrastructure_complete', 
 jsonb_build_object('tables_created', 2, 'timestamp', NOW()), 
 'setup_script');

-- Verification query
SELECT 
  'BRAIN INFRASTRUCTURE COMPLETE' as status,
  COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'tweets', 'bot_config', 'api_usage_tracking', 'bot_usage_tracking', 
  'system_logs', 'ai_decisions', 'learning_insights', 'content_themes',
  'timing_insights', 'style_performance', 'engagement_patterns',
  'competitor_intelligence', 'viral_content_analysis'
); 