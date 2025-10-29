-- Pattern Tracking System Migration
-- Creates table to store content patterns for creativity analysis

CREATE TABLE IF NOT EXISTS content_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES content_metadata(decision_id),
  content TEXT NOT NULL,
  patterns JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_patterns_decision_id ON content_patterns(decision_id);
CREATE INDEX IF NOT EXISTS idx_content_patterns_created_at ON content_patterns(created_at);
CREATE INDEX IF NOT EXISTS idx_content_patterns_patterns ON content_patterns USING GIN(patterns);
