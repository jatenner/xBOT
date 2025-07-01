-- Simple Prorated Limits Migration for Supabase
-- Copy and paste this entire block into your Supabase SQL Editor

-- 1. Add performance indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_tweets_created_date ON tweets(DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_api_usage_date_type ON api_usage_tracking(date, api_type);

-- 2. Create monitoring view for prorated daily caps
CREATE OR REPLACE VIEW v_prorated_daily_caps AS
WITH monthly_usage AS (
  SELECT 
    COALESCE(SUM(count), 0) as tweets_used_this_month
  FROM api_usage_tracking 
  WHERE api_type = 'twitter' 
    AND date >= DATE_TRUNC('month', CURRENT_DATE)::date
),
time_calc AS (
  SELECT 
    EXTRACT(day FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - CURRENT_DATE))::integer as days_left
)
SELECT 
  tweets_used_this_month,
  1500 as monthly_cap,
  (1500 - tweets_used_this_month) as monthly_remaining,
  days_left,
  CASE 
    WHEN (1500 - tweets_used_this_month) <= 0 THEN 0
    ELSE LEAST(200, CEIL((1500 - tweets_used_this_month)::decimal / days_left))
  END as effective_daily_cap
FROM monthly_usage, time_calc;

-- 3. Test the view works
SELECT 'Migration completed successfully' as status, * FROM v_prorated_daily_caps; 