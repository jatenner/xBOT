-- Add pipeline stage timestamps to reply_decisions
-- Tracks exactly where ALLOW decisions stall

ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_selected_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS posting_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS posting_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_error_reason text; -- More specific than template_error_reason

-- Indexes for stage analysis
CREATE INDEX IF NOT EXISTS idx_reply_decisions_stage_timestamps ON reply_decisions(created_at, template_status, scored_at, template_selected_at, generation_started_at);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_pipeline_error ON reply_decisions(pipeline_error_reason) WHERE pipeline_error_reason IS NOT NULL;

COMMENT ON COLUMN reply_decisions.scored_at IS 'When candidate was scored and decision row created';
COMMENT ON COLUMN reply_decisions.template_selected_at IS 'When template was selected (template_status=SET)';
COMMENT ON COLUMN reply_decisions.generation_started_at IS 'When reply generation started';
COMMENT ON COLUMN reply_decisions.generation_completed_at IS 'When reply generation completed';
COMMENT ON COLUMN reply_decisions.posting_started_at IS 'When posting to Twitter started';
COMMENT ON COLUMN reply_decisions.posting_completed_at IS 'When posting to Twitter completed';
COMMENT ON COLUMN reply_decisions.pipeline_error_reason IS 'Specific pipeline stage error (e.g., TEMPLATE_SELECTION_TIMEOUT, GENERATION_TIMEOUT)';
