-- Add template_weights and prompt_version_weights to control_plane_state
-- For learning loop v1: policy-driven template selection

ALTER TABLE control_plane_state
  ADD COLUMN IF NOT EXISTS template_weights JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version_weights JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN control_plane_state.template_weights IS 'Policy weights for template selection (template_id -> weight)';
COMMENT ON COLUMN control_plane_state.prompt_version_weights IS 'Policy weights for prompt version selection (template_id -> version -> weight)';
