-- Phase 0.2 backfill — STRICT option (DEFAULT / RECOMMENDED).
--
-- This migration is a no-op. It exists only to make the choice explicit in the
-- migration history: "we chose to leave historical rows with baseline_status = NULL".
--
-- Consequence: learning queries using `WHERE baseline_status = 'success'` will
-- exclude all pre-Phase-0.2 posts. We accept the loss of historical learning
-- signal in exchange for only trusting attribution data we can verify was captured.
--
-- Apply EITHER this file OR 20260419100001b_baseline_status_backfill_optimistic.sql,
-- not both. If you skip both, the default behavior is identical to strict.

DO $$
BEGIN
  RAISE NOTICE '[baseline_status backfill] STRICT policy applied: historical rows left as NULL.';
  RAISE NOTICE '[baseline_status backfill] Learning signal will only include posts made after baseline_status was instrumented.';
END $$;
