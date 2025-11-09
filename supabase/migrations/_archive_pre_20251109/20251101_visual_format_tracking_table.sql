-- Visual format usage tracking table
CREATE TABLE IF NOT EXISTS visual_format_usage (
  id BIGSERIAL PRIMARY KEY,
  approach TEXT NOT NULL,
  generator TEXT NOT NULL,
  topic_snippet TEXT,
  tone TEXT,
  angle_snippet TEXT,
  format_strategy TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visual_format_usage_used_at ON visual_format_usage(used_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_format_usage_approach ON visual_format_usage(approach);
CREATE INDEX IF NOT EXISTS idx_visual_format_usage_generator ON visual_format_usage(generator);

