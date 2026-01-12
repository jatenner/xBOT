-- Add error_reason column for template_status failures

ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS template_error_reason text;

CREATE INDEX IF NOT EXISTS idx_reply_decisions_template_status_created ON reply_decisions(template_status, created_at) WHERE template_status = 'PENDING';

COMMENT ON COLUMN reply_decisions.template_error_reason IS 'Reason for template_status=FAILED (e.g., TEMPLATE_SELECTION_TIMEOUT, UPDATE_FAILED, etc.)';
