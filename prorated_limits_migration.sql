-- Prorated Rate Limits Migration
-- This migration adds indexes to improve performance of hourly/daily/monthly queries

-- Add index for hourly tweet counting (if not exists)
CREATE INDEX IF NOT EXISTS idx_tweets_created_at_hour 
ON tweets(created_at);

-- Add index for daily API usage tracking 
CREATE INDEX IF NOT EXISTS idx_api_usage_date_type 
ON api_usage_tracking(date, api_type);

-- Add composite index for efficient monthly aggregation
CREATE INDEX IF NOT EXISTS idx_api_usage_month_type 
ON api_usage_tracking(EXTRACT(YEAR FROM date::date), EXTRACT(MONTH FROM date::date), api_type);

-- Optional: Create a view for prorated daily caps (for monitoring/debugging)
CREATE OR REPLACE VIEW prorated_daily_caps AS
WITH monthly_usage AS (
  SELECT 
    COALESCE(SUM(count), 0) as tweets_used_this_month
  FROM api_usage_tracking 
  WHERE api_type = 'twitter' 
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
),
time_calc AS (
  SELECT 
    EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - CURRENT_DATE)) as days_left
)
SELECT 
  tweets_used_this_month,
  1500 as monthly_cap,
  (1500 - tweets_used_this_month) as monthly_remaining,
  days_left,
  CASE 
    WHEN (1500 - tweets_used_this_month) <= 0 THEN 0
    ELSE LEAST(200, CEILING((1500 - tweets_used_this_month)::decimal / days_left))
  END as effective_daily_cap,
  CASE 
    WHEN (1500 - tweets_used_this_month) <= 0 THEN 'Monthly budget exhausted'
    ELSE 'Prorated: ' || (1500 - tweets_used_this_month) || ' tweets ÷ ' || days_left || ' days'
  END as explanation
FROM monthly_usage, time_calc;

-- Grant access to the view
GRANT SELECT ON prorated_daily_caps TO authenticated; 