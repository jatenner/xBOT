# Horizon 0 — Apply Checklist

Run this when you're ready to flip Phase 0 on in production. Everything code-side is already merged locally.

## Pre-flight (no DB changes)

- [ ] **Confirm Supabase project** you're targeting (prod vs staging). Phase 0 is meant for prod.
- [ ] **Back up `content_generation_metadata_comprehensive`** or at least snapshot a row count. The migrations ALTER the base table; backing up is cheap insurance.
- [ ] **Pick backfill policy:** strict (A) or optimistic (B). See `supabase/migrations/20260419100001b_baseline_status_backfill_{strict|optimistic}.sql`. Default: **strict**.

## Migrations — apply in this order

```
supabase/migrations/20260419100000_metrics_scraper_runs.sql
supabase/migrations/20260419100001_baseline_status.sql
supabase/migrations/20260419100001b_baseline_status_backfill_strict.sql  # OR …_optimistic.sql
supabase/migrations/20260419100002_data_health_view.sql
```

Use whatever migration runner the repo already uses (`scripts/db/apply-single-migration.ts` or direct `supabase db push` — check with existing workflow). **Do not bundle**; apply one at a time and watch for errors.

Notes:
- `20260419100001_baseline_status.sql` uses `CREATE OR REPLACE VIEW` (not `DROP CASCADE`), so `vw_learning` and other dependents are preserved.
- The baseline_status column is nullable by design; historical rows stay NULL unless you apply the optimistic backfill.

## Env flag check — Railway

- [ ] `RUNNER_MODE` on the **Mac runner** (not Railway) = `true`. Without this, `metricsScraperJob` will log runs with `status='skipped_not_runner'` — which is fine and observable, but no metrics get collected.
- [ ] On Railway (for H2 readiness, not required for H0): check whether `BRAIN_FEEDS_ENABLED` and `GROWTH_OBSERVATORY_ENABLED` are `true`. These gate `runSelfModelUpdate`, `runStrategyLibraryBuilder`, `runStagePlaybookBuilder` in `jobManager.ts:1419/1600`. Flip to true whenever H2 begins.

## First 10 minutes — sanity checks

```sql
-- The run-log should have entries already (every ~10 min).
SELECT run_at, runner_mode, status, updated_count, failed_count, duration_ms
FROM metrics_scraper_runs
ORDER BY run_at DESC
LIMIT 20;

-- Dashboard view. Expect most fields to be 0 or NULL for the first hour.
SELECT * FROM data_health;
```

## 48-hour gate

```sql
SELECT
  baseline_success_rate_7d,
  scraper_last_runner_completed_at,
  scraper_crashed_24h,
  outcomes_with_objective_score_7d,
  outcomes_with_profile_clicks_7d
FROM data_health;
```

**Advance to H1 only if:**
- `baseline_success_rate_7d >= 0.9`
- `scraper_last_runner_completed_at` within the last 60 minutes
- `scraper_crashed_24h = 0`
- `outcomes_with_objective_score_7d > 0`

**If gate fails:**
- `baseline_success_rate_7d` low → tail postingQueue logs for `[POSTING_QUEUE] ⚠️ Follower baseline capture failed` / `timed out`. Root-cause `getCurrentFollowerCount`.
- `scraper_last_runner_completed_at` stale → Mac runner isn't running metrics scrape. Check `RUNNER_MODE` + runner deployment.
- `scraper_crashed_24h > 0` → inspect `error_message` in `metrics_scraper_runs`.

## Rollback (if needed)

Each migration is independently reversible:
```sql
-- Undo baseline_status (safe — no data dropped, just columns removed)
ALTER TABLE content_generation_metadata_comprehensive DROP COLUMN IF EXISTS baseline_status;
ALTER TABLE content_generation_metadata_comprehensive DROP COLUMN IF EXISTS baseline_error;
-- Note: you'd also need to re-replace content_metadata view back to the prior column list.

-- Undo metrics_scraper_runs
DROP TABLE IF EXISTS metrics_scraper_runs;

-- Undo data_health view
DROP VIEW IF EXISTS data_health;
```

Code-side changes in `metricsScraperJob.ts`, `postingQueue.ts`, `multiPointFollowerTracker.ts` are backward-compatible — if the migrations aren't applied, the code degrades gracefully (the baseline_status writes become no-ops against a missing column, which logs warnings but doesn't crash).
