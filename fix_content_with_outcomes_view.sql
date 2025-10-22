-- FIX content_with_outcomes view to use correct column names
-- The view was referencing "likes" but the table has "actual_likes" aliased columns

DROP VIEW IF EXISTS content_with_outcomes CASCADE;

CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
    cm.*,
    -- Expose metrics with simple names for backwards compatibility
    COALESCE(tm.likes, cm.actual_likes) as likes,
    COALESCE(tm.retweets, cm.actual_retweets) as retweets,
    COALESCE(tm.replies, cm.actual_replies) as replies,
    COALESCE(tm.impressions, cm.actual_impressions) as impressions,
    COALESCE(tm.bookmarks, 0) as bookmarks,
    COALESCE(tm.profile_clicks, 0) as profile_clicks,
    COALESCE(tm.engagement_rate, cm.actual_engagement_rate) as engagement_rate,
    pt.content_type,
    pt.posting_strategy,
    pt.topic_category
FROM content_generation_metadata_comprehensive cm
LEFT JOIN tweet_engagement_metrics_comprehensive tm ON cm.tweet_id = tm.tweet_id
LEFT JOIN posted_tweets_comprehensive pt ON cm.tweet_id = pt.tweet_id;

-- Verify the view works
SELECT 
    decision_id,
    content,
    likes,
    retweets,
    replies,
    impressions,
    actual_likes
FROM content_with_outcomes 
WHERE likes IS NOT NULL
ORDER BY likes DESC
LIMIT 5;

\echo '✅ View fixed and verified'

