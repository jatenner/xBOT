-- Harden reply_decisions: Add status/confidence/method columns with NOT NULL constraints
-- Backfill existing rows from reason field

-- Step 1: Add columns (nullable first for backfill)
ALTER TABLE reply_decisions 
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('OK', 'UNCERTAIN', 'ERROR')),
  ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  ADD COLUMN IF NOT EXISTS method text DEFAULT 'unknown';

-- Step 2: Backfill from reason field
UPDATE reply_decisions
SET 
  status = CASE
    WHEN reason LIKE 'ANCESTRY_UNCERTAIN_FAIL_CLOSED%' THEN 'UNCERTAIN'
    WHEN reason LIKE 'ANCESTRY_ERROR_FAIL_CLOSED%' THEN 'ERROR'
    WHEN reason LIKE 'Root tweet allowed%' OR decision = 'ALLOW' THEN 'OK'
    ELSE 'UNCERTAIN'
  END,
  confidence = CASE
    WHEN reason LIKE '%confidence=HIGH%' THEN 'HIGH'
    WHEN reason LIKE '%confidence=MEDIUM%' THEN 'MEDIUM'
    WHEN reason LIKE '%confidence=LOW%' THEN 'LOW'
    ELSE 'UNKNOWN'
  END,
  method = COALESCE(
    NULLIF(method, NULL),
    CASE
      WHEN reason LIKE '%method=metadata%' THEN 'metadata'
      WHEN reason LIKE '%method=json%' THEN 'json'
      WHEN reason LIKE '%method=dom%' THEN 'dom'
      WHEN reason LIKE '%method=cache%' THEN 'cache'
      WHEN reason LIKE '%method=explicit_signals%' THEN 'explicit_signals'
      WHEN reason LIKE '%method=dom_verification%' THEN 'dom_verification'
      WHEN reason LIKE '%method=error%' THEN 'error'
      WHEN reason LIKE '%method=fallback%' THEN 'fallback'
      ELSE 'unknown'
    END
  )
WHERE status IS NULL OR confidence IS NULL OR method IS NULL OR method = 'unknown';

-- Step 3: Set NOT NULL constraints
ALTER TABLE reply_decisions
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'UNCERTAIN',
  ALTER COLUMN confidence SET NOT NULL,
  ALTER COLUMN confidence SET DEFAULT 'UNKNOWN',
  ALTER COLUMN method SET NOT NULL,
  ALTER COLUMN method SET DEFAULT 'unknown';

-- Step 4: Add cache_hit column if missing
ALTER TABLE reply_decisions 
  ADD COLUMN IF NOT EXISTS cache_hit boolean DEFAULT false;

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS idx_reply_decisions_status ON reply_decisions(status);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_method ON reply_decisions(method);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_status_method ON reply_decisions(status, method);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_cache_hit ON reply_decisions(cache_hit);

COMMENT ON COLUMN reply_decisions.status IS 'Resolution status: OK=resolved, UNCERTAIN=unclear, ERROR=failed';
COMMENT ON COLUMN reply_decisions.confidence IS 'Confidence level: HIGH/MEDIUM/LOW/UNKNOWN';
COMMENT ON COLUMN reply_decisions.method IS 'Resolution method: metadata/json/dom/cache/explicit_signals/dom_verification/error/fallback/unknown';
