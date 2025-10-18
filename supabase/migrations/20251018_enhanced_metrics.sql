-- ============================================================================
-- ENHANCED METRICS FOR AGGRESSIVE GROWTH
-- ============================================================================
-- Adds 6 new metrics to improve autonomous learning and algorithm understanding
--
-- NEW SCRAPED METRICS:
--   1. quote_tweets: High-intent sharing (better signal than retweets)
--   2. profile_clicks: Direct conversion intent tracking
--   3. first_hour_engagement: Twitter algorithm pickup speed
--
-- NEW CALCULATED METRICS:
--   4. engagement_rate: Quality of reach (total engagement / impressions)
--   5. virality_coefficient: Shareability signal (shares / views)
--   6. conversion_rate: Close rate (followers gained / profile clicks)
--
-- These metrics enable the autonomous system to:
--   - Understand Twitter algorithm patterns
--   - Track conversion funnel (impressions → profile clicks → followers)
--   - Identify viral patterns early
--   - Learn causality, not just correlation
-- ============================================================================

-- Add new columns to outcomes table
DO $$ 
BEGIN
  -- Scraped Metrics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'quote_tweets'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN quote_tweets INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'profile_clicks'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN profile_clicks INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'first_hour_engagement'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN first_hour_engagement INTEGER DEFAULT 0;
  END IF;

  -- Calculated Metrics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'engagement_rate'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN engagement_rate NUMERIC(5,4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'virality_coefficient'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN virality_coefficient NUMERIC(5,4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'conversion_rate'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN conversion_rate NUMERIC(6,5);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outcomes_quote_tweets ON outcomes(quote_tweets) WHERE quote_tweets > 0;
CREATE INDEX IF NOT EXISTS idx_outcomes_profile_clicks ON outcomes(profile_clicks) WHERE profile_clicks > 0;
CREATE INDEX IF NOT EXISTS idx_outcomes_engagement_rate ON outcomes(engagement_rate) WHERE engagement_rate IS NOT NULL;

-- Create a view for enhanced metrics analysis
CREATE OR REPLACE VIEW enhanced_metrics_summary AS
SELECT 
  o.decision_id,
  o.tweet_id,
  o.collected_at,
  -- Core Metrics
  o.likes,
  o.retweets,
  o.quote_tweets,
  o.replies,
  o.impressions,
  o.bookmarks,
  -- Conversion Funnel
  o.profile_clicks,
  o.followers_gained,
  -- Performance Indicators
  o.first_hour_engagement,
  o.engagement_rate,
  o.virality_coefficient,
  o.conversion_rate,
  -- Generator Attribution
  cm.generator_name,
  cm.generator_confidence,
  cm.experiment_arm,
  -- Calculated Total Engagement
  (COALESCE(o.likes, 0) + COALESCE(o.retweets, 0) + COALESCE(o.quote_tweets, 0) + 
   COALESCE(o.replies, 0) + COALESCE(o.bookmarks, 0)) as total_engagement,
  -- Profile Click Through Rate
  CASE 
    WHEN o.impressions > 0 THEN (o.profile_clicks::numeric / o.impressions::numeric)
    ELSE NULL 
  END as profile_ctr
FROM outcomes o
LEFT JOIN content_metadata cm ON cm.decision_id::text = o.decision_id::text
WHERE o.simulated = false;

-- Add comment for documentation
COMMENT ON VIEW enhanced_metrics_summary IS 'Comprehensive view of all metrics including new quote tweets, profile clicks, and calculated performance indicators for autonomous learning system';

-- Create function to calculate and update derived metrics
CREATE OR REPLACE FUNCTION calculate_derived_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate Engagement Rate: (total engagement) / impressions
  IF NEW.impressions > 0 THEN
    NEW.engagement_rate := (
      COALESCE(NEW.likes, 0) + 
      COALESCE(NEW.retweets, 0) + 
      COALESCE(NEW.quote_tweets, 0) + 
      COALESCE(NEW.replies, 0) + 
      COALESCE(NEW.bookmarks, 0)
    )::numeric / NEW.impressions::numeric;
  END IF;

  -- Calculate Virality Coefficient: (retweets + quote_tweets) / impressions
  IF NEW.impressions > 0 THEN
    NEW.virality_coefficient := (
      COALESCE(NEW.retweets, 0) + 
      COALESCE(NEW.quote_tweets, 0)
    )::numeric / NEW.impressions::numeric;
  END IF;

  -- Calculate Conversion Rate: followers_gained / profile_clicks
  IF NEW.profile_clicks > 0 THEN
    NEW.conversion_rate := NEW.followers_gained::numeric / NEW.profile_clicks::numeric;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate derived metrics on insert/update
DROP TRIGGER IF EXISTS calculate_derived_metrics_trigger ON outcomes;
CREATE TRIGGER calculate_derived_metrics_trigger
  BEFORE INSERT OR UPDATE ON outcomes
  FOR EACH ROW
  EXECUTE FUNCTION calculate_derived_metrics();

-- Migration complete
-- Added 6 new metrics columns: quote_tweets, profile_clicks, first_hour_engagement,
-- engagement_rate, virality_coefficient, conversion_rate

