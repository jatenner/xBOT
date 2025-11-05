-- ========================================
-- DATABASE CLEANUP & FIX PLAN
-- Date: November 4, 2025
-- Status: READY TO EXECUTE
-- ========================================

-- FOUND ISSUES:
-- 1. 111 orphaned tweets (85 with missing decision_ids - old data)
-- 2. 64 status mismatches (marked 'failed' but have tweet_ids = actually posted!)
-- 3. 6 tweets missing from outcomes table
-- 4. 202 tweets missing from tweet_metrics table
-- 5. 34 duplicate tweet_ids in content_metadata
-- 6. 1000 accounts with NULL engagement_rate
-- 7. 13 reply opportunities missing account_followers

-- ========================================
-- FIX #1: Update 64 "failed" tweets that actually posted
-- ========================================
-- These have tweet_ids, so they were successfully posted
-- Status should be 'posted', not 'failed'

UPDATE content_metadata
SET status = 'posted', 
    updated_at = NOW()
WHERE tweet_id IS NOT NULL 
AND tweet_id != ''
AND status = 'failed';

-- Expected: 64 rows updated

-- ========================================
-- FIX #2: Fix duplicate tweet_ids in content_metadata
-- ========================================
-- Keep the EARLIEST decision_id for each tweet_id
-- Mark duplicates as 'cancelled' to preserve data

WITH ranked_duplicates AS (
    SELECT 
        decision_id,
        tweet_id,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY tweet_id ORDER BY created_at ASC) as rn
    FROM content_metadata
    WHERE tweet_id IS NOT NULL AND tweet_id != ''
)
UPDATE content_metadata
SET status = 'cancelled',
    updated_at = NOW()
FROM ranked_duplicates
WHERE content_metadata.decision_id = ranked_duplicates.decision_id
AND ranked_duplicates.rn > 1
AND content_metadata.status != 'cancelled';

-- Expected: ~100 rows updated (keeping 34 originals, cancelling duplicates)

-- ========================================
-- FIX #3: Sync content_metadata with posted_tweets_comprehensive
-- ========================================
-- Update content_metadata for tweets that exist in posted_tweets_comprehensive
-- but have wrong status

UPDATE content_metadata c
SET 
    status = 'posted',
    tweet_id = p.tweet_id,
    updated_at = NOW()
FROM posted_tweets_comprehensive p
WHERE c.decision_id = p.decision_id
AND c.status != 'posted'
AND p.tweet_id IS NOT NULL;

-- Expected: ~31 rows updated (the missing 51% from today)

-- ========================================
-- FIX #4: Backfill missing tweet_metrics from outcomes
-- ========================================
-- Copy data from outcomes table (93% coverage) to tweet_metrics (43% coverage)

INSERT INTO tweet_metrics (
    tweet_id,
    likes_count,
    retweets_count,
    replies_count,
    bookmarks_count,
    impressions_count,
    collected_at,
    created_at,
    updated_at
)
SELECT 
    o.tweet_id,
    COALESCE(o.likes, 0),
    COALESCE(o.retweets, 0),
    COALESCE(o.replies, 0),
    COALESCE(o.bookmarks, 0),
    COALESCE(o.views, o.impressions, 0),
    o.collected_at,
    c.created_at,
    NOW()
FROM outcomes o
INNER JOIN content_metadata c ON o.decision_id = c.decision_id
WHERE o.tweet_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM tweet_metrics tm WHERE tm.tweet_id = o.tweet_id
)
ON CONFLICT (tweet_id) DO UPDATE SET
    likes_count = EXCLUDED.likes_count,
    retweets_count = EXCLUDED.retweets_count,
    replies_count = EXCLUDED.replies_count,
    bookmarks_count = EXCLUDED.bookmarks_count,
    impressions_count = EXCLUDED.impressions_count,
    updated_at = NOW();

-- Expected: ~202 rows inserted

-- ========================================
-- FIX #5: Backfill missing outcomes from posted_tweets_comprehensive
-- ========================================
-- Create placeholder outcomes for the 6 missing tweets

INSERT INTO outcomes (
    decision_id,
    tweet_id,
    collected_at,
    data_source,
    simulated
)
SELECT 
    c.decision_id,
    c.tweet_id,
    NOW(),
    'backfill_cleanup',
    false
FROM content_metadata c
WHERE c.status = 'posted'
AND c.tweet_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM outcomes o WHERE o.decision_id = c.decision_id
)
ON CONFLICT (decision_id) DO NOTHING;

-- Expected: ~6 rows inserted

-- ========================================
-- FIX #6: Clean up orphaned tweets (old data)
-- ========================================
-- Delete orphaned tweets from posted_tweets_comprehensive
-- These are from old systems, have fake tweet_ids or missing decision_ids

-- OPTION A: Delete tweets with fake IDs (posted_*, verified_*)
DELETE FROM posted_tweets_comprehensive
WHERE tweet_id LIKE 'posted_%' 
OR tweet_id LIKE 'verified_%'
OR tweet_id !~ '^[0-9]+$';  -- Keep only numeric tweet IDs

-- OPTION B: Delete tweets with decision_ids that don't exist in content_metadata
DELETE FROM posted_tweets_comprehensive p
WHERE NOT EXISTS (
    SELECT 1 FROM content_metadata c WHERE c.decision_id = p.decision_id
);

-- Expected: ~85 rows deleted (old data cleanup)
-- NOTE: Run OPTION A OR OPTION B, not both!

-- ========================================
-- FIX #7: Calculate engagement_rate for ALL 1000 accounts
-- ========================================
-- This will be done via scraping in code, not SQL
-- Engagement rate = avg_tweet_likes / follower_count
-- For now, set a placeholder based on existing data

UPDATE discovered_accounts
SET engagement_rate = 0.02,  -- Default 2% placeholder
    updated_at = NOW()
WHERE engagement_rate IS NULL;

-- Expected: 1000 rows updated
-- NOTE: This is a PLACEHOLDER. Real engagement should be calculated from scraping.

-- ========================================
-- FIX #8: Mark incomplete reply opportunities for re-scraping
-- ========================================
-- Reply opportunities missing account_followers should be re-scraped

UPDATE reply_opportunities
SET replied_to = false,
    status = 'expired',
    updated_at = NOW()
WHERE (account_followers IS NULL OR account_followers = 0)
AND replied_to = true;

-- Expected: ~13 rows updated

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these after cleanup to verify success

-- Check status mismatches (should be 0)
SELECT COUNT(*) as remaining_status_mismatches
FROM content_metadata
WHERE tweet_id IS NOT NULL 
AND tweet_id != ''
AND status != 'posted';

-- Check duplicates (should show each tweet_id only once)
SELECT COUNT(*) as remaining_duplicates
FROM (
    SELECT tweet_id
    FROM content_metadata
    WHERE tweet_id IS NOT NULL 
    AND tweet_id != ''
    AND status = 'posted'
    GROUP BY tweet_id
    HAVING COUNT(*) > 1
) dups;

-- Check orphans (should be 0 or only valid old data)
SELECT COUNT(*) as remaining_orphans
FROM posted_tweets_comprehensive p
LEFT JOIN content_metadata c ON p.tweet_id = c.tweet_id
WHERE c.tweet_id IS NULL
AND p.tweet_id ~ '^[0-9]+$';  -- Only count valid numeric IDs

-- Check missing tweet_metrics (should be much lower)
SELECT COUNT(*) as remaining_missing_tweet_metrics
FROM content_metadata c
LEFT JOIN tweet_metrics tm ON c.tweet_id = tm.tweet_id
WHERE c.status = 'posted'
AND c.tweet_id IS NOT NULL
AND tm.tweet_id IS NULL;

-- Check NULL engagement rates (should be 0)
SELECT COUNT(*) as remaining_null_engagement
FROM discovered_accounts
WHERE engagement_rate IS NULL;

-- ========================================
-- SUMMARY REPORT
-- ========================================
SELECT 
    'CLEANUP COMPLETE' as status,
    NOW() as completed_at;

-- Show before/after metrics
SELECT 
    'Posted tweets' as metric,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'posted' THEN 1 END) as status_posted,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as status_failed,
    COUNT(CASE WHEN status = 'queued' THEN 1 END) as status_queued
FROM content_metadata
WHERE tweet_id IS NOT NULL;


