-- ============================================
-- FIX MIGRATION ISSUES
-- ============================================

-- ============================================
-- FIX 1: Create missing content_with_outcomes view
-- This view is needed by the learning system to load historical performance
-- ============================================

CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
    cm.decision_id,
    cm.content,
    cm.tweet_id,
    cm.posted_at,
    cm.created_at,
    cm.generator_name,
    cm.topic_cluster,
    cm.quality_score,
    cm.predicted_er,
    cm.predicted_engagement,
    cm.style,
    cm.hook_type,
    cm.hook_pattern,
    cm.cta_type,
    -- Actual performance metrics from engagement table
    tm.likes as actual_likes,
    tm.retweets as actual_retweets,
    tm.replies as actual_replies,
    tm.impressions as actual_impressions,
    tm.bookmarks as actual_bookmarks,
    -- Calculate actual engagement rate
    CASE 
        WHEN tm.impressions > 0 THEN 
            ((tm.likes + tm.retweets + tm.replies + tm.bookmarks)::numeric / tm.impressions::numeric)
        ELSE 0
    END as actual_engagement_rate,
    -- Also include from posted_tweets if we need more fields
    pt.content_type,
    pt.posting_strategy
FROM content_generation_metadata_comprehensive cm
LEFT JOIN tweet_engagement_metrics_comprehensive tm ON cm.tweet_id = tm.tweet_id
LEFT JOIN posted_tweets_comprehensive pt ON cm.tweet_id = pt.tweet_id
WHERE cm.status = 'posted' AND cm.tweet_id IS NOT NULL;

-- ============================================
-- FIX 2: Update content_violations table constraint
-- Add missing violation types that the code uses
-- ============================================

-- Drop the old constraint if it exists (ignore errors if doesn't exist)
ALTER TABLE content_violations 
DROP CONSTRAINT IF EXISTS content_violations_violation_type_check;

-- Add the updated constraint with ALL violation types (existing + new)
ALTER TABLE content_violations
ADD CONSTRAINT content_violations_violation_type_check 
CHECK (violation_type IN (
    -- Existing violation types in database
    'incomplete_sentence',
    'low_specificity',
    'banned_phrase',
    'first_person',
    -- New violation types from code
    'excessive_emojis',
    'duplicate_content',
    'unsafe_content',
    'inappropriate_language',
    'promotional',
    'clickbait',
    'misinformation',
    'length_violation',
    'format_violation',
    'quality_violation'
));

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check that the view was created
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'content_with_outcomes'
        ) THEN '✅ content_with_outcomes view exists'
        ELSE '❌ content_with_outcomes view NOT found'
    END as view_status;

-- Check the constraint
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'content_violations_violation_type_check'
            AND table_name = 'content_violations'
        ) THEN '✅ content_violations constraint exists'
        ELSE '❌ content_violations constraint NOT found'
    END as constraint_status;

-- Test the view (get count)
SELECT COUNT(*) as view_row_count FROM content_with_outcomes;

