-- Phase 0.2 backfill — OPTIMISTIC option.
--
-- For rows posted BEFORE Phase 0.2 was instrumented, set baseline_status='success'
-- if we have a non-null followers_before. This preserves weeks of historical
-- learning signal at the cost of assuming those old baselines were captured
-- correctly (they were not always — there were periods of silent flaking).
--
-- ONLY apply this if you accept the risk that some old "success" rows were
-- actually flaky captures. Run the two SELECTs before applying to quantify.
--
-- Apply EITHER this file OR 20260419100001b_baseline_status_backfill_strict.sql,
-- not both.

BEGIN;

-- Preview counts before mutation (informational; RAISE NOTICE so it shows in logs).
DO $$
DECLARE
  will_backfill BIGINT;
  will_leave_null BIGINT;
BEGIN
  SELECT COUNT(*) INTO will_backfill
  FROM content_generation_metadata_comprehensive
  WHERE baseline_status IS NULL
    AND followers_before IS NOT NULL;

  SELECT COUNT(*) INTO will_leave_null
  FROM content_generation_metadata_comprehensive
  WHERE baseline_status IS NULL
    AND followers_before IS NULL;

  RAISE NOTICE '[baseline_status backfill] OPTIMISTIC: marking % rows as success (have followers_before), leaving % rows NULL (no baseline).',
    will_backfill, will_leave_null;
END $$;

-- The backfill itself.
UPDATE content_generation_metadata_comprehensive
SET baseline_status = 'success'
WHERE baseline_status IS NULL
  AND followers_before IS NOT NULL;

COMMIT;
