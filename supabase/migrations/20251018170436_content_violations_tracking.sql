-- ═══════════════════════════════════════════════════════════
-- CONTENT VIOLATIONS TRACKING
-- ═══════════════════════════════════════════════════════════
-- Purpose: Track content sanitization violations to identify
--          which generators need prompt improvements
-- Created: 2025-10-18
-- Phase: Content Quality Enhancement (Phase 1 & 4)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Table: content_violations
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Logs every content sanitization violation
-- Used to:
-- 1. Identify problematic generators
-- 2. Track improvement over time
-- 3. Inform prompt engineering decisions

CREATE TABLE IF NOT EXISTS content_violations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Generation Context
  generator_name TEXT NOT NULL, -- Which generator produced the violation
  topic TEXT, -- What topic was being generated
  format TEXT NOT NULL CHECK (format IN ('single', 'thread')), -- Format type
  
  -- Violation Details
  violation_type TEXT NOT NULL 
    CHECK (violation_type IN ('first_person', 'banned_phrase', 'low_specificity', 'incomplete_sentence')),
  severity TEXT NOT NULL 
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  detected_phrase TEXT, -- Exact phrase that violated rules
  context_snippet TEXT, -- Surrounding context (up to 100 chars)
  
  -- Content Info
  content_preview TEXT, -- First 200 chars of content
  full_content TEXT, -- Full generated content (for analysis)
  
  -- Quality Metrics
  specificity_score INTEGER DEFAULT 0, -- 0-10 scale
  specificity_matches TEXT[], -- What specificity patterns were found
  
  -- Action Taken
  action_taken TEXT NOT NULL 
    CHECK (action_taken IN ('rejected', 'retried', 'posted_anyway')),
  retry_succeeded BOOLEAN, -- If retried, did it succeed?
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes
  CONSTRAINT content_violations_generator_idx CHECK (LENGTH(generator_name) > 0)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Indexes for Performance
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Primary query: Find violations by generator
CREATE INDEX IF NOT EXISTS idx_violations_generator 
  ON content_violations(generator_name, created_at DESC);

-- Query: Track violations over time
CREATE INDEX IF NOT EXISTS idx_violations_time 
  ON content_violations(created_at DESC);

-- Query: Find critical violations
CREATE INDEX IF NOT EXISTS idx_violations_severity 
  ON content_violations(severity, created_at DESC) 
  WHERE severity IN ('critical', 'high');

-- Query: Track specific violation types
CREATE INDEX IF NOT EXISTS idx_violations_type 
  ON content_violations(violation_type, generator_name);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Table: generator_quality_metrics (Materialized View)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Pre-computed metrics for fast dashboard queries

CREATE MATERIALIZED VIEW IF NOT EXISTS generator_quality_metrics AS
SELECT 
  generator_name,
  COUNT(*) as total_violations,
  COUNT(*) FILTER (WHERE violation_type = 'first_person') as first_person_count,
  COUNT(*) FILTER (WHERE violation_type = 'banned_phrase') as banned_phrase_count,
  COUNT(*) FILTER (WHERE violation_type = 'low_specificity') as low_specificity_count,
  COUNT(*) FILTER (WHERE violation_type = 'incomplete_sentence') as incomplete_count,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_violations,
  COUNT(*) FILTER (WHERE action_taken = 'rejected') as rejection_count,
  COUNT(*) FILTER (WHERE action_taken = 'retried' AND retry_succeeded = true) as successful_retries,
  AVG(specificity_score) as avg_specificity_score,
  MAX(created_at) as last_violation,
  MIN(created_at) as first_violation
FROM content_violations
GROUP BY generator_name;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_generator_quality_metrics 
  ON generator_quality_metrics(generator_name);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Refresh Function (call periodically)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION refresh_generator_quality_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY generator_quality_metrics;
END;
$$ LANGUAGE plpgsql;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Useful Queries (for monitoring)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Top violators (last 7 days)
COMMENT ON MATERIALIZED VIEW generator_quality_metrics IS 
'Pre-computed quality metrics per generator. Refresh with: SELECT refresh_generator_quality_metrics();

Example queries:

-- Top violators (last 7 days)
SELECT 
  generator_name,
  COUNT(*) as violations,
  COUNT(*) FILTER (WHERE severity = ''critical'') as critical
FROM content_violations
WHERE created_at >= NOW() - INTERVAL ''7 days''
GROUP BY generator_name
ORDER BY violations DESC
LIMIT 10;

-- First-person violations by generator
SELECT 
  generator_name,
  COUNT(*) as first_person_violations,
  ARRAY_AGG(DISTINCT detected_phrase) as common_phrases
FROM content_violations
WHERE violation_type = ''first_person''
  AND created_at >= NOW() - INTERVAL ''30 days''
GROUP BY generator_name
ORDER BY first_person_violations DESC;

-- Improvement over time
SELECT 
  DATE_TRUNC(''day'', created_at) as day,
  COUNT(*) as violations
FROM content_violations
WHERE created_at >= NOW() - INTERVAL ''30 days''
GROUP BY day
ORDER BY day DESC;
';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Enable Row Level Security (RLS)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE content_violations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow full access to authenticated users (service role)
CREATE POLICY "Allow service role full access"
  ON content_violations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

