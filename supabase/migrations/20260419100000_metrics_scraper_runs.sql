-- Phase 0.1: Metrics scraper run-log
-- Replaces silent RUNNER_MODE-gated skips with an observable per-invocation record.
-- One row per metricsScraperJob() invocation so we can tell from the DB whether
-- the Mac runner is actually running, and what each run did.

CREATE TABLE IF NOT EXISTS metrics_scraper_runs (
  id                BIGSERIAL PRIMARY KEY,
  run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  runner_mode       BOOLEAN NOT NULL,
  status            TEXT NOT NULL,
  -- status values:
  --   'completed'            ran fully and attempted to scrape
  --   'skipped_not_runner'   RUNNER_MODE != 'true' (Railway control plane)
  --   'skipped_memory'       low-memory guard tripped
  --   'skipped_no_posts'     no posts matched the fetch queries
  --   'skipped_all_filtered' posts existed but all filtered out (backoff, dedup, recent)
  --   'error_fetch'          DB fetch for candidate posts failed
  --   'crashed'              uncaught exception in the job body
  eligible_count    INT NOT NULL DEFAULT 0, -- posts after initial validation
  scraped_count     INT NOT NULL DEFAULT 0, -- posts actually passed to browser
  updated_count     INT NOT NULL DEFAULT 0,
  skipped_count     INT NOT NULL DEFAULT 0,
  failed_count      INT NOT NULL DEFAULT 0,
  duration_ms       INT NOT NULL,
  skip_reason       TEXT,
  error_message     TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics_scraper_runs_run_at
  ON metrics_scraper_runs(run_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_scraper_runs_status
  ON metrics_scraper_runs(status, run_at DESC);
