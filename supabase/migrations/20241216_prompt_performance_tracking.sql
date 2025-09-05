-- Migration: Add prompt performance tracking table for bandit learning
-- This enables automatic prompt optimization based on engagement data

CREATE TABLE IF NOT EXISTS prompt_performance (
  id SERIAL PRIMARY KEY,
  post_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  persona TEXT NOT NULL,
  emotion TEXT NOT NULL,
  framework TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  viral_score INTEGER DEFAULT 0,
  hours_after_post INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_performance_persona ON prompt_performance(persona);
CREATE INDEX IF NOT EXISTS idx_prompt_performance_emotion ON prompt_performance(emotion);
CREATE INDEX IF NOT EXISTS idx_prompt_performance_framework ON prompt_performance(framework);
CREATE INDEX IF NOT EXISTS idx_prompt_performance_engagement ON prompt_performance(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_performance_recorded_at ON prompt_performance(recorded_at DESC);

-- Add RLS policy if needed
ALTER TABLE prompt_performance ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all operations
CREATE POLICY "Service role can manage prompt performance" ON prompt_performance
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon/authenticated to read (for analytics)
CREATE POLICY "Allow read access to prompt performance" ON prompt_performance
FOR SELECT TO anon, authenticated
USING (true);

COMMENT ON TABLE prompt_performance IS 'Tracks performance metrics for different prompt configurations to enable automatic optimization';
COMMENT ON COLUMN prompt_performance.prompt_version IS 'Version identifier for the prompt used';
COMMENT ON COLUMN prompt_performance.persona IS 'Persona used in the prompt (e.g., Dr. Elena Vasquez)';
COMMENT ON COLUMN prompt_performance.emotion IS 'Emotional framework used (e.g., Curiosity)';
COMMENT ON COLUMN prompt_performance.framework IS 'Content framework used (e.g., Mechanism Master)';
COMMENT ON COLUMN prompt_performance.engagement_rate IS 'Total engagement / impressions ratio';
COMMENT ON COLUMN prompt_performance.hours_after_post IS 'Hours elapsed since post when metrics were recorded';
