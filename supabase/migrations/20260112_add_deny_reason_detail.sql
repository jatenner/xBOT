-- Add deny_reason_detail column to reply_decisions
-- Stores stage-specific error details for ANCESTRY_* timeout codes

ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS deny_reason_detail text;

-- Add index for detail queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_deny_reason_detail 
  ON reply_decisions(deny_reason_detail) 
  WHERE deny_reason_detail IS NOT NULL;

COMMENT ON COLUMN reply_decisions.deny_reason_detail IS 'Detailed error information for DENY decisions, including stage and error context (e.g., "stage=acquire_context error=timeout")';
