-- ================================================================
-- PHASE 2: ENHANCE METRICS QUALITY TRACKING
-- Adds validation and confidence fields to existing tables
-- ================================================================
-- 
-- Purpose: Track data quality, validation results, and scraper versions
-- Impact: Backward compatible - only adds columns, doesn't modify existing data
-- Rollback: Can safely drop columns if needed
--

-- ================================================================
-- ENHANCE real_tweet_metrics TABLE
-- ================================================================

-- Add quality tracking fields
ALTER TABLE real_tweet_metrics 
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ADD COLUMN IF NOT EXISTS scraper_version TEXT DEFAULT 'bulletproof_v2_scoped',
  ADD COLUMN IF NOT EXISTS selector_used JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS anomaly_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS anomaly_reasons TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS validation_warnings TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN real_tweet_metrics.confidence_score IS 'Confidence in scraped data quality (0.0-1.0). Based on selector reliability and validation checks.';
COMMENT ON COLUMN real_tweet_metrics.scraper_version IS 'Version of scraper used (e.g., bulletproof_v2_scoped). Helps track improvements.';
COMMENT ON COLUMN real_tweet_metrics.selector_used IS 'JSON map of which selector worked for each metric. For debugging.';
COMMENT ON COLUMN real_tweet_metrics.validation_passed IS 'TRUE if passed all sanity checks. FALSE if anomalies detected.';
COMMENT ON COLUMN real_tweet_metrics.anomaly_detected IS 'TRUE if any validation anomaly was detected (impossible values, spikes, etc.)';
COMMENT ON COLUMN real_tweet_metrics.anomaly_reasons IS 'Array of anomaly descriptions if detected.';
COMMENT ON COLUMN real_tweet_metrics.validation_warnings IS 'Array of warnings (less critical than anomalies).';

-- ================================================================
-- ENHANCE engagement_snapshots TABLE
-- ================================================================

-- Add quality tracking fields to snapshots
ALTER TABLE engagement_snapshots
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS anomaly_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scraper_version TEXT DEFAULT 'bulletproof_v2_scoped';

-- ================================================================
-- CREATE HIGH-QUALITY METRICS VIEW
-- For AI systems to use - only verified, high-quality data
-- ================================================================

CREATE OR REPLACE VIEW verified_metrics AS
SELECT *
FROM real_tweet_metrics
WHERE 
  is_verified = TRUE
  AND validation_passed = TRUE
  AND confidence_score >= 0.8
  AND anomaly_detected = FALSE
ORDER BY collected_at DESC;

COMMENT ON VIEW verified_metrics IS 'Only high-quality, verified metrics for AI training. Filters out anomalies and low-confidence data.';

-- ================================================================
-- CREATE DATA QUALITY VIEW
-- For monitoring dashboard
-- ================================================================

CREATE OR REPLACE VIEW metrics_quality_stats AS
SELECT 
  DATE_TRUNC('day', collected_at) as day,
  scraper_version,
  COUNT(*) as total_metrics,
  COUNT(*) FILTER (WHERE validation_passed = TRUE) as passed_validation,
  COUNT(*) FILTER (WHERE anomaly_detected = TRUE) as anomalies_detected,
  ROUND(AVG(confidence_score), 3) as avg_confidence,
  ROUND(
    COUNT(*) FILTER (WHERE validation_passed = TRUE)::DECIMAL / COUNT(*) * 100, 
    2
  ) as validation_pass_rate
FROM real_tweet_metrics
WHERE collected_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', collected_at), scraper_version
ORDER BY day DESC, scraper_version;

COMMENT ON VIEW metrics_quality_stats IS 'Daily data quality metrics for monitoring dashboard. Shows validation rates, confidence scores, anomalies.';

-- ================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Index for querying high-quality metrics
CREATE INDEX IF NOT EXISTS idx_real_tweet_metrics_quality
ON real_tweet_metrics(validation_passed, confidence_score, is_verified)
WHERE validation_passed = TRUE AND is_verified = TRUE;

-- Index for finding anomalies
CREATE INDEX IF NOT EXISTS idx_real_tweet_metrics_anomalies
ON real_tweet_metrics(anomaly_detected, collected_at DESC)
WHERE anomaly_detected = TRUE;

-- Index for scraper version tracking
CREATE INDEX IF NOT EXISTS idx_real_tweet_metrics_scraper_version
ON real_tweet_metrics(scraper_version, collected_at DESC);

-- Index for engagement_snapshots quality
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_quality
ON engagement_snapshots(validation_passed, confidence_score)
WHERE validation_passed = TRUE;

-- ================================================================
-- UPDATE EXISTING DATA (Backfill defaults)
-- ================================================================

-- Mark all existing data as validated (they're already in the system)
-- But with slightly lower confidence since they weren't validated with new system
UPDATE real_tweet_metrics
SET 
  confidence_score = 0.85,  -- Slightly lower for legacy data
  validation_passed = TRUE,
  scraper_version = 'legacy_unvalidated'
WHERE confidence_score IS NULL OR scraper_version IS NULL;

UPDATE engagement_snapshots
SET 
  confidence_score = 0.85,
  validation_passed = TRUE,
  scraper_version = 'legacy_unvalidated'
WHERE confidence_score IS NULL OR scraper_version IS NULL;

-- ================================================================
-- FUNCTION: Get Data Quality Report
-- ================================================================

CREATE OR REPLACE FUNCTION get_data_quality_report(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
  metric_name TEXT,
  metric_value NUMERIC,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH quality_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE validation_passed = TRUE) as passed,
      COUNT(*) FILTER (WHERE anomaly_detected = TRUE) as anomalies,
      ROUND(AVG(confidence_score), 3) as avg_confidence
    FROM real_tweet_metrics
    WHERE collected_at >= NOW() - INTERVAL '1 hour' * hours_back
  )
  SELECT 
    'Total Metrics'::TEXT,
    total::NUMERIC,
    'info'::TEXT
  FROM quality_stats
  
  UNION ALL
  
  SELECT 
    'Validation Pass Rate'::TEXT,
    ROUND(passed::DECIMAL / NULLIF(total, 0) * 100, 2),
    CASE 
      WHEN ROUND(passed::DECIMAL / NULLIF(total, 0) * 100, 2) >= 95 THEN 'healthy'
      WHEN ROUND(passed::DECIMAL / NULLIF(total, 0) * 100, 2) >= 85 THEN 'warning'
      ELSE 'critical'
    END::TEXT
  FROM quality_stats
  
  UNION ALL
  
  SELECT 
    'Anomaly Rate'::TEXT,
    ROUND(anomalies::DECIMAL / NULLIF(total, 0) * 100, 2),
    CASE 
      WHEN ROUND(anomalies::DECIMAL / NULLIF(total, 0) * 100, 2) <= 5 THEN 'healthy'
      WHEN ROUND(anomalies::DECIMAL / NULLIF(total, 0) * 100, 2) <= 15 THEN 'warning'
      ELSE 'critical'
    END::TEXT
  FROM quality_stats
  
  UNION ALL
  
  SELECT 
    'Average Confidence'::TEXT,
    avg_confidence,
    CASE 
      WHEN avg_confidence >= 0.9 THEN 'healthy'
      WHEN avg_confidence >= 0.75 THEN 'warning'
      ELSE 'critical'
    END::TEXT
  FROM quality_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_data_quality_report(INTEGER) IS 'Returns data quality metrics for last N hours. Use for health monitoring.';

-- ================================================================
-- GRANT PERMISSIONS
-- ================================================================

GRANT SELECT ON verified_metrics TO anon, authenticated;
GRANT SELECT ON metrics_quality_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_data_quality_report(INTEGER) TO anon, authenticated;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251019002140_enhance_metrics_quality_tracking completed successfully';
  RAISE NOTICE 'Added quality tracking fields to real_tweet_metrics and engagement_snapshots';
  RAISE NOTICE 'Created views: verified_metrics, metrics_quality_stats';
  RAISE NOTICE 'Created function: get_data_quality_report()';
END $$;

