-- BEGIN: Post-go-live hardening (idempotent)
-- Browser robustness + engagement windows + follower growth structure

-- 1. Create engagement_windows table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='engagement_windows'
  ) THEN
     CREATE TABLE public.engagement_windows (
       id serial PRIMARY KEY,
       hour_24 integer NOT NULL CHECK (hour_24 >= 0 AND hour_24 <= 23),
       weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
       avg_engagement numeric(4,3) DEFAULT 0.1,
       follower_activity numeric(4,3) DEFAULT 0.1,
       optimal_frequency numeric(4,3) DEFAULT 0.33,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE(hour_24, weekday)
     );
     
     CREATE INDEX IF NOT EXISTS idx_engagement_windows_time
       ON public.engagement_windows(hour_24, weekday);
       
     COMMENT ON TABLE public.engagement_windows IS 
       'Optimal posting windows by hour and weekday for adaptive posting';
  END IF;
END $$;

-- 2. Seed default engagement windows if table is empty
DO $$
BEGIN
  IF EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='engagement_windows'
  ) AND (SELECT COUNT(*) FROM public.engagement_windows) = 0 THEN
    
    -- Insert default high-engagement windows for each weekday
    -- Morning peak (9am), Lunch peak (12pm), Evening peak (6pm), Night activity (8pm)
    INSERT INTO public.engagement_windows (hour_24, weekday, avg_engagement, follower_activity, optimal_frequency) VALUES
    -- Monday
    (9, 1, 0.35, 0.4, 0.5),   (12, 1, 0.4, 0.45, 0.6),   (18, 1, 0.45, 0.5, 0.7),   (20, 1, 0.3, 0.35, 0.4),
    -- Tuesday  
    (9, 2, 0.33, 0.38, 0.48), (12, 2, 0.38, 0.43, 0.58), (18, 2, 0.43, 0.48, 0.68), (20, 2, 0.28, 0.33, 0.38),
    -- Wednesday
    (9, 3, 0.36, 0.41, 0.51), (12, 3, 0.41, 0.46, 0.61), (18, 3, 0.46, 0.51, 0.71), (20, 3, 0.31, 0.36, 0.41),
    -- Thursday
    (9, 4, 0.37, 0.42, 0.52), (12, 4, 0.42, 0.47, 0.62), (18, 4, 0.47, 0.52, 0.72), (20, 4, 0.32, 0.37, 0.42),
    -- Friday
    (9, 5, 0.34, 0.39, 0.49), (12, 5, 0.39, 0.44, 0.59), (18, 5, 0.44, 0.49, 0.69), (20, 5, 0.39, 0.44, 0.49),
    -- Saturday  
    (9, 6, 0.28, 0.33, 0.43), (12, 6, 0.33, 0.38, 0.53), (18, 6, 0.38, 0.43, 0.63), (20, 6, 0.35, 0.4, 0.5),
    -- Sunday
    (9, 0, 0.32, 0.37, 0.47), (12, 0, 0.37, 0.42, 0.57), (18, 0, 0.42, 0.47, 0.67), (20, 0, 0.34, 0.39, 0.44);
    
    -- Add moderate activity for other hours (reduced engagement)
    INSERT INTO public.engagement_windows (hour_24, weekday, avg_engagement, follower_activity, optimal_frequency)
    SELECT 
      h.hour, 
      d.day,
      0.15 + (RANDOM() * 0.1)::numeric(4,3), -- Base engagement 0.15-0.25
      0.2 + (RANDOM() * 0.1)::numeric(4,3),  -- Base activity 0.2-0.3  
      0.25 + (RANDOM() * 0.1)::numeric(4,3)  -- Base frequency 0.25-0.35
    FROM 
      generate_series(0, 23) AS h(hour),
      generate_series(0, 6) AS d(day)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.engagement_windows 
      WHERE hour_24 = h.hour AND weekday = d.day
    );
    
  END IF;
END $$;

-- 3. Update tweet_performance view with follower_growth structure
-- Note: audience_snapshots table doesn't exist yet, so follower_growth remains NULL
-- but the view is structured for future enhancement
DROP VIEW IF EXISTS public.tweet_performance;

CREATE VIEW public.tweet_performance AS
SELECT 
  -- Core bandit performance data
  day as created_at,
  engine_version,
  tweets_processed,
  avg_engagement,
  total_rewards,
  bandit_updates,
  top_topics,
  best_hours,
  logged_at,
  
  -- Follower growth computation (future enhancement when audience_snapshots exists)
  NULL::integer AS follower_growth
  
  /* Future enhancement when audience_snapshots table is created:
  -- Calculate follower_growth as delta between snapshots
  -- LEFT JOIN (
  --   SELECT 
  --     snap_before.fetched_at as tweet_time,
  --     (snap_after.follower_count - snap_before.follower_count) as growth_delta
  --   FROM public.audience_snapshots snap_before
  --   LEFT JOIN public.audience_snapshots snap_after 
  --     ON snap_after.fetched_at >= snap_before.fetched_at + INTERVAL '1 hour'
  --     AND snap_after.fetched_at <= snap_before.fetched_at + INTERVAL '24 hours'
  --   WHERE snap_before.fetched_at <= vw_bandit_performance.day + INTERVAL '24 hours'
  --     AND snap_before.fetched_at >= vw_bandit_performance.day - INTERVAL '24 hours'
  -- ) follower_calc ON DATE_TRUNC('day', follower_calc.tweet_time) = vw_bandit_performance.day
  */

FROM vw_bandit_performance
UNION ALL
-- Add compatibility rows from tweets table for recent data  
SELECT 
  posted_at as created_at,
  'tweet_compat' as engine_version,
  1 as tweets_processed,
  COALESCE((analytics->>'engagement_rate')::decimal, 0) as avg_engagement,
  COALESCE((analytics->>'likes')::integer + (analytics->>'retweets')::integer, 0) as total_rewards,
  1 as bandit_updates,
  CASE WHEN metadata->>'topic' IS NOT NULL 
       THEN jsonb_build_array(metadata->>'topic') 
       ELSE '[]'::jsonb END as top_topics,
  '[]'::jsonb as best_hours,
  posted_at as logged_at,
  -- Future: calculate from audience snapshots
  NULL::integer as follower_growth
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
  AND platform = 'twitter'
  AND analytics IS NOT NULL
ORDER BY created_at DESC;

-- 4. Add helpful comments for future enhancement
COMMENT ON VIEW public.tweet_performance IS 
'Performance view with follower_growth structure. When audience_snapshots table is added, follower_growth will be computed from snapshot deltas.';

-- Add trigger to update engagement windows based on actual performance data (future enhancement)
-- This would analyze tweet performance and adjust optimal windows automatically

-- END: Post-go-live hardening