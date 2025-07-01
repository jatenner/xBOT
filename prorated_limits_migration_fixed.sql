-- 🚀 PRORATED RATE LIMITS - PERFORMANCE MIGRATION
-- =================================================
-- This migration enhances the existing schema for better prorated limits performance
-- All changes are OPTIONAL - the system works without this migration

-- 1. Add performance indexes for faster queries (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_tweets_created_at_date 
ON tweets(DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_bot_usage_date_action 
ON bot_usage_tracking(date, action);

CREATE INDEX IF NOT EXISTS idx_bot_usage_timestamp_hour 
ON bot_usage_tracking(timestamp, hour) WHERE action = 'tweet';

-- 2. Create a helper view for prorated daily caps (for monitoring/debugging)
CREATE OR REPLACE VIEW v_prorated_daily_caps AS
WITH monthly_usage AS (
  SELECT 
    COALESCE(SUM(count), 0) as tweets_used_this_month
  FROM api_usage_tracking 
  WHERE api_type = 'twitter' 
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
),
time_calc AS (
  SELECT 
    EXTRACT(day FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - CURRENT_DATE))::integer as days_left,
    EXTRACT(hour FROM NOW())::integer as current_hour
)
SELECT 
  tweets_used_this_month,
  1500 as monthly_cap,
  (1500 - tweets_used_this_month) as monthly_remaining,
  days_left,
  current_hour,
  (24 - current_hour) as hours_left_today,
  CASE 
    WHEN (1500 - tweets_used_this_month) <= 0 THEN 0
    ELSE LEAST(200, CEIL((1500 - tweets_used_this_month)::decimal / days_left))
  END as effective_daily_cap,
  CASE 
    WHEN (1500 - tweets_used_this_month) <= 0 THEN 'Monthly budget exhausted'
    ELSE 'Prorated: ' || (1500 - tweets_used_this_month) || ' tweets ÷ ' || days_left || ' days = ' || 
         LEAST(200, CEIL((1500 - tweets_used_this_month)::decimal / days_left)) || '/day'
  END as explanation
FROM monthly_usage, time_calc;

-- 3. Add helper function for hourly tweet counting (used by prorated system)
CREATE OR REPLACE FUNCTION get_hourly_tweet_count(hour_start TIMESTAMPTZ)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM tweets 
    WHERE created_at >= hour_start 
    AND created_at < hour_start + INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Update bot_config to include prorated limits settings
INSERT INTO bot_config (key, value, description) VALUES
  ('twitter_monthly_cap', '1500', 'Monthly Twitter API limit for prorated calculations'),
  ('twitter_daily_hard_cap', '200', 'Daily hard cap ceiling for prorated calculations'),
  ('twitter_enable_hourly_proration', 'false', 'Enable hourly proration to smooth posting'),
  ('prorated_limits_enabled', 'true', 'Enable prorated daily cap system')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 5. Log the migration
INSERT INTO system_logs (action, data, source) VALUES
  ('prorated_limits_migration_applied', jsonb_build_object(
    'migration_date', NOW()::text,
    'indexes_added', 3,
    'view_created', 'v_prorated_daily_caps',
    'function_added', 'get_hourly_tweet_count',
    'config_updated', true
  ), 'migration_script');

-- 6. Show current status
SELECT 
  'PRORATED LIMITS MIGRATION COMPLETE' as status,
  NOW() as completed_at;

-- 7. Test the view works
SELECT * FROM v_prorated_daily_caps; 