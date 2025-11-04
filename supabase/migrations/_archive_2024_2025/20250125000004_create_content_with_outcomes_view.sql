-- =====================================================================================
-- CRITICAL: Create content_with_outcomes view for learning system
-- =====================================================================================
-- This view joins posted_decisions with outcomes for easy querying
-- Used by: dynamicFewShotProvider.ts, learning systems, analytics

BEGIN;

-- Drop existing view if it exists
DROP VIEW IF EXISTS content_with_outcomes CASCADE;

-- Create the view with all necessary columns
CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
  pd.decision_id,
  pd.tweet_id,
  pd.content,
  pd.decision_type,
  pd.posted_at,
  pd.created_at as decision_created_at,
  pd.topic_cluster,
  pd.quality_score,
  pd.predicted_er,
  pd.generation_source,
  pd.target_tweet_id,
  pd.target_username,
  o.likes,
  o.retweets,
  o.replies,
  o.bookmarks,
  o.quotes,
  o.impressions,
  o.views,
  o.profile_clicks,
  o.engagement_rate,
  o.followers_gained,
  o.followers_before,
  o.followers_after,
  o.collected_at,
  o.collected_pass,
  o.data_source
FROM posted_decisions pd
LEFT JOIN outcomes o ON pd.decision_id = o.decision_id;

-- Grant access to view
GRANT SELECT ON content_with_outcomes TO anon, authenticated, service_role;

-- Add helpful comment
COMMENT ON VIEW content_with_outcomes IS 'Convenience view joining posted_decisions with outcomes for learning system queries';

COMMIT;

