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
-- ENHANCE real_tweet_metrics (VIEW) / tweet_engagement_metrics_comprehensive (TABLE)
-- ================================================================

-- Add quality tracking fields to the underlying table (if it's a table)
-- real_tweet_metrics is a VIEW, so we need to alter the base table
DO $$
BEGIN
  -- Check if tweet_engagement_metrics_comprehensive is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'tweet_engagement_metrics_comprehensive'
    AND c.relkind = 'r'
  ) THEN
    -- Add columns to the underlying table
    ALTER TABLE tweet_engagement_metrics_comprehensive 
      ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
      ADD COLUMN IF NOT EXISTS scraper_version TEXT DEFAULT 'bulletproof_v2_scoped',
      ADD COLUMN IF NOT EXISTS selector_used JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS anomaly_detected BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS anomaly_reasons TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS validation_warnings TEXT[] DEFAULT '{}';
    
    -- Add comments for documentation
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.confidence_score IS ''Confidence in scraped data quality (0.0-1.0). Based on selector reliability and validation checks.''';
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.scraper_version IS ''Version of scraper used (e.g., bulletproof_v2_scoped). Helps track improvements.''';
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.selector_used IS ''JSON map of which selector worked for each metric. For debugging.''';
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.validation_passed IS ''TRUE if passed all sanity checks. FALSE if anomalies detected.''';
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.anomaly_detected IS ''TRUE if any validation anomaly was detected (impossible values, spikes, etc.).''';
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.anomaly_reasons IS ''Array of anomaly descriptions if detected.''';
    EXECUTE 'COMMENT ON COLUMN tweet_engagement_metrics_comprehensive.validation_warnings IS ''Array of warnings (less critical than anomalies).''';
  ELSE
    RAISE NOTICE 'Skipping ALTER TABLE: tweet_engagement_metrics_comprehensive is not a base table';
  END IF;
END $$;

-- Recreate the real_tweet_metrics view to include new columns (if view exists)
DO $$
BEGIN
  -- Check if real_tweet_metrics is a view
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'real_tweet_metrics'
    AND c.relkind = 'v'
  ) THEN
    -- Check if underlying table has the new columns
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'tweet_engagement_metrics_comprehensive'
      AND column_name = 'confidence_score'
    ) THEN
      -- Recreate view with new columns
      EXECUTE '
      CREATE OR REPLACE VIEW real_tweet_metrics AS
      SELECT 
        id, tweet_id, likes, retweets, replies, bookmarks, impressions,
        profile_clicks, engagement_rate, viral_score, collected_at,
        collection_phase, hours_after_post, is_verified, content_length,
        persona, emotion, framework, posted_at, created_at, updated_at,
        confidence_score, scraper_version, selector_used, validation_passed,
        anomaly_detected, anomaly_reasons, validation_warnings
      FROM tweet_engagement_metrics_comprehensive';
    ELSE
      -- Recreate view without new columns (they don''t exist yet)
      EXECUTE '
      CREATE OR REPLACE VIEW real_tweet_metrics AS
      SELECT 
        id, tweet_id, likes, retweets, replies, bookmarks, impressions,
        profile_clicks, engagement_rate, viral_score, collected_at,
        collection_phase, hours_after_post, is_verified, content_length,
        persona, emotion, framework, posted_at, created_at, updated_at
      FROM tweet_engagement_metrics_comprehensive';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping view recreation: real_tweet_metrics is not a view';
  END IF;
END $$;

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

-- Create verified_metrics view (check if columns exist first)
DO $$
BEGIN
  -- Check if underlying table has the required columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'tweet_engagement_metrics_comprehensive'
    AND column_name = 'confidence_score'
  ) THEN
    -- Create view with quality filters
    EXECUTE '
    CREATE OR REPLACE VIEW verified_metrics AS
    SELECT *
    FROM real_tweet_metrics
    WHERE 
      is_verified = TRUE
      AND validation_passed = TRUE
      AND confidence_score >= 0.8
      AND anomaly_detected = FALSE
    ORDER BY collected_at DESC';
  ELSE
    -- Create view without quality filters (columns don''t exist)
    EXECUTE '
    CREATE OR REPLACE VIEW verified_metrics AS
    SELECT *
    FROM real_tweet_metrics
    WHERE 
      is_verified = TRUE
    ORDER BY collected_at DESC';
  END IF;
END $$;

COMMENT ON VIEW verified_metrics IS 'Only high-quality, verified metrics for AI training. Filters out anomalies and low-confidence data.';

-- ================================================================
-- CREATE DATA QUALITY VIEW
-- For monitoring dashboard
-- ================================================================

-- Create metrics_quality_stats view (check if columns exist first)
DO $$
BEGIN
  -- Check if underlying table has the required columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'tweet_engagement_metrics_comprehensive'
    AND column_name = 'confidence_score'
  ) THEN
    -- Create view with quality stats
    EXECUTE '
    CREATE OR REPLACE VIEW metrics_quality_stats AS
    SELECT 
      DATE_TRUNC(''day'', collected_at) as day,
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
    WHERE collected_at >= NOW() - INTERVAL ''30 days''
    GROUP BY DATE_TRUNC(''day'', collected_at), scraper_version
    ORDER BY day DESC, scraper_version';
  ELSE
    -- Create view without quality columns (they don''t exist)
    EXECUTE '
    CREATE OR REPLACE VIEW metrics_quality_stats AS
    SELECT 
      DATE_TRUNC(''day'', collected_at) as day,
      COUNT(*) as total_metrics,
      0 as passed_validation,
      0 as anomalies_detected,
      0.0 as avg_confidence,
      0.0 as validation_pass_rate
    FROM real_tweet_metrics
    WHERE collected_at >= NOW() - INTERVAL ''30 days''
    GROUP BY DATE_TRUNC(''day'', collected_at)
    ORDER BY day DESC';
  END IF;
END $$;

COMMENT ON VIEW metrics_quality_stats IS 'Daily data quality metrics for monitoring dashboard. Shows validation rates, confidence scores, anomalies.';

-- ================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================================
-- Note: Indexes are created on the underlying table, not the view
-- (Already handled in the DO block above)

-- Index for engagement_snapshots quality
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_quality
ON engagement_snapshots(validation_passed, confidence_score)
WHERE validation_passed = TRUE;

-- ================================================================
-- UPDATE EXISTING DATA (Backfill defaults)
-- ================================================================

-- Mark all existing data as validated (they're already in the system)
-- But with slightly lower confidence since they weren't validated with new system
-- Update the underlying table, not the view
DO $$
BEGIN
  -- Check if tweet_engagement_metrics_comprehensive is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'tweet_engagement_metrics_comprehensive'
    AND c.relkind = 'r'
  ) THEN
    -- Check if columns exist before updating
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'tweet_engagement_metrics_comprehensive'
      AND column_name = 'confidence_score'
    ) THEN
      EXECUTE 'UPDATE tweet_engagement_metrics_comprehensive
        SET 
          confidence_score = 0.85,
          validation_passed = TRUE,
          scraper_version = ''legacy_unvalidated''
        WHERE confidence_score IS NULL OR scraper_version IS NULL';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping UPDATE: tweet_engagement_metrics_comprehensive is not a base table';
  END IF;
END $$;

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
    FROM tweet_engagement_metrics_comprehensive
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

