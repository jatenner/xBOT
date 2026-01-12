-- Add deny_reason_code column to reply_decisions
-- Used for structured analytics of DENY decisions

ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS deny_reason_code text;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_deny_reason_code 
  ON reply_decisions(deny_reason_code) 
  WHERE deny_reason_code IS NOT NULL;

-- Add index for decision + deny_reason_code queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_decision_deny_reason 
  ON reply_decisions(decision, deny_reason_code) 
  WHERE decision = 'DENY';

COMMENT ON COLUMN reply_decisions.deny_reason_code IS 'Structured reason code for DENY decisions: NON_ROOT, ANCESTRY_UNCERTAIN, ANCESTRY_ERROR, LOW_RELEVANCE, LOW_AUTHOR_SIGNAL, LOW_QUALITY_SCORE, CONSENT_WALL, OTHER';
