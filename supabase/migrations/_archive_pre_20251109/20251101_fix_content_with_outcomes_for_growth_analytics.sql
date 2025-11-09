-- =====================================================================================
-- FIX content_with_outcomes VIEW FOR GROWTH ANALYTICS
-- =====================================================================================
-- Problem: The view is missing critical columns needed by growth analytics:
--   - actual_impressions (has 'impressions' but growth analytics expects 'actual_impressions')
--   - raw_topic, generator_name, visual_format, tone, angle, format_strategy
--
-- Solution: Recreate view to include ALL columns from content_generation_metadata_comprehensive
-- =====================================================================================

DROP VIEW IF EXISTS content_with_outcomes CASCADE;

CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
    -- From content_generation_metadata_comprehensive (all columns)
    cm.*,
    
    -- From outcomes table (if exists) - use COALESCE to prefer outcomes data over cm data
    COALESCE(o.likes, cm.actual_likes) as likes,
    COALESCE(o.retweets, cm.actual_retweets) as retweets,
    COALESCE(o.replies, cm.actual_replies) as replies,
    COALESCE(o.bookmarks, 0) as bookmarks,
    COALESCE(o.quotes, 0) as quotes,
    COALESCE(o.views, cm.actual_impressions) as views,
    COALESCE(o.profile_clicks, 0) as profile_clicks,
    COALESCE(o.engagement_rate, cm.actual_engagement_rate) as engagement_rate,
    o.followers_gained,
    o.followers_before,
    o.followers_after,
    o.collected_at,
    o.collected_pass,
    o.data_source
FROM content_generation_metadata_comprehensive cm
LEFT JOIN outcomes o ON cm.decision_id = o.decision_id
WHERE cm.status = 'posted'
  AND cm.tweet_id IS NOT NULL;

-- Grant permissions
GRANT SELECT ON content_with_outcomes TO anon, authenticated, service_role;

-- Add comment
COMMENT ON VIEW content_with_outcomes IS 'Posted content with outcomes - includes ALL metadata for growth analytics';

-- =====================================================================================
-- VERIFY THE FIX
-- =====================================================================================

-- Test that all critical columns exist
SELECT 
    COUNT(*) as total_rows,
    COUNT(actual_impressions) as has_actual_impressions,
    COUNT(raw_topic) as has_raw_topic,
    COUNT(generator_name) as has_generator_name,
    COUNT(visual_format) as has_visual_format,
    COUNT(tone) as has_tone,
    COUNT(angle) as has_angle,
    COUNT(format_strategy) as has_format_strategy
FROM content_with_outcomes
WHERE posted_at > NOW() - INTERVAL '7 days'
LIMIT 1;

\echo '✅ content_with_outcomes view fixed for growth analytics'

