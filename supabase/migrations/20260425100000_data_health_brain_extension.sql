-- =============================================================================
-- data_health view — brain-pipeline extension
-- =============================================================================
-- Adds brain-specific health metrics alongside the existing posting/scraper
-- columns. CREATE OR REPLACE VIEW preserves consumers; new columns are added
-- after the existing ones (PG requires existing columns to keep their order).
--
-- New metrics:
--   * brain_tweets_ingested_24h          — collection-loop heartbeat
--   * brain_classifications_24h          — Stage-2 AI pipeline heartbeat
--   * external_patterns_brain_source     — Phase 3 wiring proof
--   * external_patterns_last_updated_min — aggregator freshness
--   * velocity_{5,15,60}m_populated_ratio — Phase 2D coverage
--   * reply_author_check_lag_min         — Phase 2C lag
--   * pending_velocity_queue_depth       — backlog visibility
--   * pending_velocity_oldest_due_min    — worker latency

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
  ),
  brain_window AS (
    SELECT *
    FROM brain_tweets
    WHERE scraped_at >= NOW() - INTERVAL '24 hours'
  )
SELECT
  -- ───────────── EXISTING (preserve order, do not rename) ─────────────
  (SELECT COUNT(*) FROM window_posts)::BIGINT                                        AS posts_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'success')::BIGINT      AS baseline_success_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'failed')::BIGINT       AS baseline_failed_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'timeout')::BIGINT      AS baseline_timeout_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'disabled')::BIGINT     AS baseline_disabled_7d,
  (SELECT COUNT(*) FROM window_posts WHERE baseline_status IS NULL)::BIGINT          AS baseline_unset_7d,
  CASE WHEN (SELECT COUNT(*) FROM window_posts) = 0 THEN NULL
       ELSE ROUND(
         (SELECT COUNT(*) FROM window_posts WHERE baseline_status = 'success')::NUMERIC
         / (SELECT COUNT(*) FROM window_posts)::NUMERIC, 3)
  END                                                                                AS baseline_success_rate_7d,
  (SELECT COUNT(*) FROM window_posts
    WHERE actual_impressions IS NOT NULL AND actual_impressions > 0)::BIGINT         AS posts_with_metrics_7d,
  (SELECT COUNT(*) FROM window_posts
    WHERE (actual_impressions IS NULL OR actual_impressions = 0)
      AND posted_at < NOW() - INTERVAL '24 hours')::BIGINT                           AS posts_stale_missing_metrics,
  (SELECT COUNT(*) FROM outcomes o
    JOIN window_posts wp ON wp.decision_id = o.decision_id
    WHERE o.primary_objective_score IS NOT NULL)::BIGINT                             AS outcomes_with_objective_score_7d,
  (SELECT COUNT(*) FROM outcomes o
    JOIN window_posts wp ON wp.decision_id = o.decision_id
    WHERE o.profile_clicks IS NOT NULL AND o.profile_clicks > 0)::BIGINT             AS outcomes_with_profile_clicks_7d,
  (SELECT AVG(o.profile_clicks)::NUMERIC(10,2) FROM outcomes o
    JOIN window_posts wp ON wp.decision_id = o.decision_id
    WHERE o.profile_clicks IS NOT NULL)                                              AS avg_profile_clicks_per_post_7d,
  (SELECT COUNT(*) FROM window_runs)::BIGINT                                         AS scraper_runs_24h,
  (SELECT COUNT(*) FROM window_runs WHERE status = 'completed')::BIGINT              AS scraper_completed_24h,
  (SELECT COUNT(*) FROM window_runs WHERE status = 'skipped_not_runner')::BIGINT     AS scraper_skipped_not_runner_24h,
  (SELECT COUNT(*) FROM window_runs WHERE status = 'crashed')::BIGINT                AS scraper_crashed_24h,
  (SELECT MAX(run_at) FROM metrics_scraper_runs)                                     AS scraper_last_run_at,
  (SELECT MAX(run_at) FROM metrics_scraper_runs WHERE status = 'completed')          AS scraper_last_completed_at,
  (SELECT MAX(run_at) FROM metrics_scraper_runs
    WHERE status = 'completed' AND runner_mode = TRUE)                               AS scraper_last_runner_completed_at,
  (SELECT SUM(updated_count) FROM window_runs)::BIGINT                               AS scraper_updated_count_24h,

  -- ───────────── NEW: Brain pipeline health ─────────────
  (SELECT COUNT(*) FROM brain_window)::BIGINT
                                                                                     AS brain_tweets_ingested_24h,
  (SELECT COUNT(*) FROM brain_classifications
    WHERE classified_at >= NOW() - INTERVAL '24 hours')::BIGINT
                                                                                     AS brain_classifications_24h,

  -- Pattern aggregator freshness + brain-source wiring proof.
  (SELECT COUNT(*) FROM external_patterns WHERE source = 'brain')::BIGINT
                                                                                     AS external_patterns_brain_source_count,
  (SELECT COUNT(*) FROM external_patterns)::BIGINT
                                                                                     AS external_patterns_total_count,
  (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_updated_at))) / 60
     FROM external_patterns)::NUMERIC(10,1)
                                                                                     AS external_patterns_last_updated_min,

  -- Velocity-window coverage (Phase 2D).
  -- Denominator: tweets in the 24h window that should have had time to fire all
  -- three velocity buckets (i.e. posted >= 60 min ago). Numerator: tweets that
  -- actually have the bucket populated. Closer to 1.0 = healthier worker.
  CASE WHEN (SELECT COUNT(*) FROM brain_window
              WHERE posted_at IS NOT NULL
                AND posted_at < NOW() - INTERVAL '60 minutes') = 0 THEN NULL
       ELSE ROUND(
         (SELECT COUNT(*) FROM brain_window
            WHERE posted_at IS NOT NULL
              AND posted_at < NOW() - INTERVAL '60 minutes'
              AND velocity_5m IS NOT NULL)::NUMERIC
         / (SELECT COUNT(*) FROM brain_window
              WHERE posted_at IS NOT NULL
                AND posted_at < NOW() - INTERVAL '60 minutes')::NUMERIC, 3)
  END                                                                                AS velocity_5m_populated_ratio,
  CASE WHEN (SELECT COUNT(*) FROM brain_window
              WHERE posted_at IS NOT NULL
                AND posted_at < NOW() - INTERVAL '60 minutes') = 0 THEN NULL
       ELSE ROUND(
         (SELECT COUNT(*) FROM brain_window
            WHERE posted_at IS NOT NULL
              AND posted_at < NOW() - INTERVAL '60 minutes'
              AND velocity_15m IS NOT NULL)::NUMERIC
         / (SELECT COUNT(*) FROM brain_window
              WHERE posted_at IS NOT NULL
                AND posted_at < NOW() - INTERVAL '60 minutes')::NUMERIC, 3)
  END                                                                                AS velocity_15m_populated_ratio,
  CASE WHEN (SELECT COUNT(*) FROM brain_window
              WHERE posted_at IS NOT NULL
                AND posted_at < NOW() - INTERVAL '60 minutes') = 0 THEN NULL
       ELSE ROUND(
         (SELECT COUNT(*) FROM brain_window
            WHERE posted_at IS NOT NULL
              AND posted_at < NOW() - INTERVAL '60 minutes'
              AND velocity_60m IS NOT NULL)::NUMERIC
         / (SELECT COUNT(*) FROM brain_window
              WHERE posted_at IS NOT NULL
                AND posted_at < NOW() - INTERVAL '60 minutes')::NUMERIC, 3)
  END                                                                                AS velocity_60m_populated_ratio,

  -- Velocity queue health.
  (SELECT COUNT(*) FROM pending_velocity_snapshots
    WHERE claimed_at IS NULL)::BIGINT
                                                                                     AS pending_velocity_queue_depth,
  (SELECT EXTRACT(EPOCH FROM (NOW() - MIN(due_at))) / 60
     FROM pending_velocity_snapshots
     WHERE claimed_at IS NULL AND due_at <= NOW())::NUMERIC(10,1)
                                                                                     AS pending_velocity_oldest_due_min,

  -- Reply-author check lag (Phase 2C).
  -- For external_reply_patterns rows in last 24h, how many were flagged vs
  -- left null? Lag-min = age of the oldest still-unflagged row.
  CASE WHEN (SELECT COUNT(*) FROM external_reply_patterns
              WHERE parent_posted_at >= NOW() - INTERVAL '24 hours') = 0 THEN NULL
       ELSE ROUND(
         (SELECT COUNT(*) FROM external_reply_patterns
            WHERE parent_posted_at >= NOW() - INTERVAL '24 hours'
              AND parent_author_replied_to_this_reply IS NOT NULL)::NUMERIC
         / (SELECT COUNT(*) FROM external_reply_patterns
              WHERE parent_posted_at >= NOW() - INTERVAL '24 hours')::NUMERIC, 3)
  END                                                                                AS reply_author_check_coverage_24h,
  (SELECT EXTRACT(EPOCH FROM (NOW() - MIN(parent_posted_at))) / 60
     FROM external_reply_patterns
     WHERE parent_posted_at >= NOW() - INTERVAL '24 hours'
       AND parent_author_replied_to_this_reply IS NULL)::NUMERIC(10,1)
                                                                                     AS reply_author_check_lag_min
;

COMMENT ON VIEW data_health IS
  'Pipeline health dashboard — posting + scraper (original) and brain (extension). '
  'Brain steady state: brain_tweets_ingested_24h > 1000, '
  'velocity_*_populated_ratio > 0.5, '
  'external_patterns_brain_source_count > 0, '
  'reply_author_check_coverage_24h > 0.3.';
