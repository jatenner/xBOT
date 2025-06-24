-- Daily Posting Management Schema
-- Ensures exactly 17 tweets are posted every day

-- Daily Posting State Table
CREATE TABLE IF NOT EXISTS daily_posting_state (
  date DATE PRIMARY KEY,
  posts_completed INTEGER DEFAULT 0,
  posts_target INTEGER DEFAULT 17,
  next_post_time TIMESTAMPTZ,
  posting_schedule JSONB DEFAULT '[]',
  emergency_mode BOOLEAN DEFAULT false,
  last_post_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Posting Log Table
CREATE TABLE IF NOT EXISTS daily_posting_log (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  target INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  emergency_posts INTEGER DEFAULT 0,
  avg_interval_minutes DECIMAL(5,2),
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  completion_rate DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual Post Tracking
CREATE TABLE IF NOT EXISTS daily_posts_tracking (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  post_number INTEGER NOT NULL, -- 1-17
  scheduled_time TIMESTAMPTZ NOT NULL,
  actual_post_time TIMESTAMPTZ,
  trigger_type VARCHAR(20) NOT NULL, -- 'scheduled', 'emergency', 'catchup'
  content_type VARCHAR(50), -- 'cached', 'generated', 'fallback'
  success BOOLEAN DEFAULT false,
  tweet_id VARCHAR(50),
  engagement_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posting Window Performance
CREATE TABLE IF NOT EXISTS posting_window_performance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  window_start INTEGER NOT NULL, -- Hour of day (0-23)
  window_end INTEGER NOT NULL,
  target_posts INTEGER NOT NULL,
  completed_posts INTEGER NOT NULL,
  avg_engagement DECIMAL(5,2),
  success_rate DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_posting_state_date ON daily_posting_state(date);
CREATE INDEX IF NOT EXISTS idx_daily_posting_log_date ON daily_posting_log(date);
CREATE INDEX IF NOT EXISTS idx_daily_posts_tracking_date ON daily_posts_tracking(date);
CREATE INDEX IF NOT EXISTS idx_daily_posts_tracking_post_number ON daily_posts_tracking(post_number);
CREATE INDEX IF NOT EXISTS idx_posting_window_performance_date ON posting_window_performance(date);

-- Update trigger for daily_posting_state
CREATE OR REPLACE FUNCTION update_daily_posting_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_posting_state_updated_at
  BEFORE UPDATE ON daily_posting_state
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_posting_state_timestamp();

-- Function to get daily posting progress
CREATE OR REPLACE FUNCTION get_daily_posting_progress(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON AS $$
DECLARE
  progress_data JSON;
BEGIN
  SELECT json_build_object(
    'date', target_date,
    'completed', COALESCE(posts_completed, 0),
    'target', COALESCE(posts_target, 17),
    'percentage', ROUND((COALESCE(posts_completed, 0)::DECIMAL / COALESCE(posts_target, 17)) * 100, 1),
    'remaining', COALESCE(posts_target, 17) - COALESCE(posts_completed, 0),
    'emergency_mode', COALESCE(emergency_mode, false),
    'last_post_time', last_post_time,
    'on_track', (
      CASE 
        WHEN EXTRACT(HOUR FROM NOW()) < 12 
        THEN COALESCE(posts_completed, 0) >= (EXTRACT(HOUR FROM NOW()) / 24.0 * COALESCE(posts_target, 17))
        ELSE COALESCE(posts_completed, 0) >= ((EXTRACT(HOUR FROM NOW()) - 2) / 24.0 * COALESCE(posts_target, 17))
      END
    )
  ) INTO progress_data
  FROM daily_posting_state 
  WHERE date = target_date;
  
  -- If no record exists, return default values
  IF progress_data IS NULL THEN
    progress_data := json_build_object(
      'date', target_date,
      'completed', 0,
      'target', 17,
      'percentage', 0,
      'remaining', 17,
      'emergency_mode', false,
      'last_post_time', null,
      'on_track', true
    );
  END IF;
  
  RETURN progress_data;
END;
$$ LANGUAGE plpgsql;

-- Function to get posting window analysis
CREATE OR REPLACE FUNCTION get_posting_window_analysis(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  window_name TEXT,
  start_hour INTEGER,
  end_hour INTEGER,
  target_posts INTEGER,
  completed_posts INTEGER,
  success_rate DECIMAL,
  avg_engagement DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN pwp.window_start = 6 THEN 'Morning (6-9 AM)'
      WHEN pwp.window_start = 9 THEN 'Late Morning (9-12 PM)'
      WHEN pwp.window_start = 12 THEN 'Afternoon (12-3 PM)'
      WHEN pwp.window_start = 15 THEN 'Late Afternoon (3-6 PM)'
      WHEN pwp.window_start = 18 THEN 'Evening (6-9 PM)'
      WHEN pwp.window_start = 21 THEN 'Night (9-11 PM)'
      ELSE 'Other'
    END as window_name,
    pwp.window_start,
    pwp.window_end,
    pwp.target_posts,
    pwp.completed_posts,
    pwp.success_rate,
    pwp.avg_engagement
  FROM posting_window_performance pwp
  WHERE pwp.date = target_date
  ORDER BY pwp.window_start;
END;
$$ LANGUAGE plpgsql;

-- View for daily posting dashboard
CREATE OR REPLACE VIEW daily_posting_dashboard AS
SELECT 
  dps.date,
  dps.posts_completed,
  dps.posts_target,
  ROUND((dps.posts_completed::DECIMAL / dps.posts_target) * 100, 1) as completion_percentage,
  dps.posts_target - dps.posts_completed as remaining_posts,
  dps.emergency_mode,
  dps.last_post_time,
  COUNT(dpt.id) as total_attempts,
  COUNT(CASE WHEN dpt.success THEN 1 END) as successful_posts,
  ROUND(COUNT(CASE WHEN dpt.success THEN 1 END)::DECIMAL / NULLIF(COUNT(dpt.id), 0) * 100, 1) as success_rate,
  AVG(dpt.engagement_score) as avg_engagement
FROM daily_posting_state dps
LEFT JOIN daily_posts_tracking dpt ON dps.date = dpt.date
GROUP BY dps.date, dps.posts_completed, dps.posts_target, dps.emergency_mode, dps.last_post_time
ORDER BY dps.date DESC;

-- View for posting performance trends
CREATE OR REPLACE VIEW posting_performance_trends AS
SELECT 
  date,
  completed,
  target,
  success,
  emergency_posts,
  completion_rate,
  avg_interval_minutes,
  EXTRACT(DOW FROM date) as day_of_week,
  CASE EXTRACT(DOW FROM date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name
FROM daily_posting_log
ORDER BY date DESC;

-- Initialize today's posting state if not exists
INSERT INTO daily_posting_state (date, posts_completed, posts_target)
VALUES (CURRENT_DATE, 0, 17)
ON CONFLICT (date) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE daily_posting_state IS 'Tracks current daily posting state and progress';
COMMENT ON TABLE daily_posting_log IS 'Historical log of daily posting performance';
COMMENT ON TABLE daily_posts_tracking IS 'Individual post tracking within each day';
COMMENT ON TABLE posting_window_performance IS 'Performance analysis by posting time windows';
COMMENT ON FUNCTION get_daily_posting_progress IS 'Returns current daily posting progress as JSON';
COMMENT ON VIEW daily_posting_dashboard IS 'Dashboard view for daily posting performance'; 