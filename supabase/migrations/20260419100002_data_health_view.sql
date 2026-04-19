-- Phase 0.3: data_health view
-- One-query dashboard for the data pipeline. Run `SELECT * FROM data_health;`
-- to see at a glance whether:
--   - the Mac runner is actually scraping metrics (metrics_scraper_runs)
--   - baseline capture is succeeding (content_generation_metadata_comprehensive.baseline_status)
--   - outcomes have the follower attribution needed for learning
--
-- Window: 7 days. Numbers are point-in-time counts.

CREATE OR REPLACE VIEW data_health AS
WITH
  window_posts AS (
    SELECT *
    FROM content_generation_metadata_comprehensive
    WHERE posted_at >= NOW() - INTERVAL '7 days'
      AND status = 'posted'
  ),
  window_runs AS (
    SELECT *
    FROM metrics_scraper_runs
    WHERE run_at >= NOW() - INTERVAL '24 hours'
  )
SELECT
  -- Posting volume
  (SELECT COUNT(*) FROM window_posts)::BIGINT                                        AS posts_7d,

  -- Baseline capture health (posts_7d should roughly equal success + failed + timeout + disabled)
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'success')::BIGINT      AS baseline_success_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'failed')::BIGINT       AS baseline_failed_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'timeout')::BIGINT      AS baseline_timeout_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'disabled')::BIGINT     AS baseline_disabled_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status IS NULL)::BIGINT          AS baseline_unset_7d,
  -- Fraction of posts with trustworthy baseline
  CASE WHEN (SELECT COUNT(*) FROM window_posts) = 0 THEN NULL
       ELSE ROUND(
         (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'success')::NUMERIC
         / (SELECT COUNT(*) FROM window_posts)::NUMERIC, 3)
  END                                                                                AS baseline_success_rate_7d,

  -- Metrics collection health (did the Mac runner actually produce data?)
  (SELECT COUNT(*) FROM window_posts
    WHERE actual_impressions IS NOT NULL AND actual_impressions > 0)::BIGINT         AS posts_with_metrics_7d,
  (SELECT COUNT(*) FROM window_posts
    WHERE (actual_impressions IS NULL OR actual_impressions = 0)
      AND posted_at < NOW() - INTERVAL '24 hours')::BIGINT                           AS posts_stale_missing_metrics,

  -- Follower attribution signal reaching outcomes.
  -- Note: outcomes.followers_gained defaults to 0, so IS NOT NULL isn't meaningful;
  -- primary_objective_score DEFAULTs NULL and is only populated when baseline_status='success'
  -- (see Phase 0.2), which makes it the definitive "trustworthy attribution" signal.
  (SELECT COUNT(*) FROM outcomes o
    JOIN window_posts wp ON wp.decision_id = o.decision_id
    WHERE o.primary_objective_score IS NOT NULL)::BIGINT                             AS outcomes_with_objective_score_7d,

  -- Profile-click signal (the closest thing to "people saw this and wanted more").
  -- TwitterAnalyticsScraper writes this via metricsScraperJob.ts:781.
  -- Low coverage = analytics page scrape is failing or not enabled.
  (SELECT COUNT(*) FROM outcomes o
    JOIN window_posts wp ON wp.decision_id = o.decision_id
    WHERE o.profile_clicks IS NOT NULL AND o.profile_clicks > 0)::BIGINT             AS outcomes_with_profile_clicks_7d,
  (SELECT AVG(o.profile_clicks)::NUMERIC(10,2) FROM outcomes o
    JOIN window_posts wp ON wp.decision_id = o.decision_id
    WHERE o.profile_clicks IS NOT NULL)                                              AS avg_profile_clicks_per_post_7d,

  -- Metrics scraper heartbeat (last 24h)
  (SELECT COUNT(*) FROM window_runs)::BIGINT                                         AS scraper_runs_24h,
  (SELECT COUNT(*) FROM window_runs WHERE status = 'completed')::BIGINT              AS scraper_completed_24h,
  (SELECT COUNT(*) FROM window_runs WHERE status = 'skipped_not_runner')::BIGINT     AS scraper_skipped_not_runner_24h,
  (SELECT COUNT(*) FROM window_runs WHERE status = 'crashed')::BIGINT                AS scraper_crashed_24h,
  (SELECT MAX(run_at) FROM metrics_scraper_runs)                                     AS scraper_last_run_at,
  (SELECT MAX(run_at) FROM metrics_scraper_runs WHERE status = 'completed')          AS scraper_last_completed_at,
  (SELECT MAX(run_at) FROM metrics_scraper_runs
    WHERE status = 'completed' AND runner_mode = TRUE)                               AS scraper_last_runner_completed_at,
  (SELECT SUM(updated_count) FROM window_runs)::BIGINT                               AS scraper_updated_count_24h
;

COMMENT ON VIEW data_health IS
  'Phase 0 pipeline health dashboard. Expected steady state: baseline_success_rate_7d > 0.9, '
  'scraper_last_runner_completed_at within the last hour, posts_stale_missing_metrics trending to 0.';
