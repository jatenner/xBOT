-- 🚨 EMERGENCY: CLEAN ALL FAKE METRICS FROM DATABASE
-- These massive engagement numbers are completely unrealistic for a small account

-- 1. Reset tweet analytics to realistic small account levels
UPDATE tweet_analytics 
SET 
  likes = LEAST(likes, 50),              -- Cap likes at 50 max
  retweets = LEAST(retweets, 10),        -- Cap retweets at 10 max  
  replies = LEAST(replies, 20),          -- Cap replies at 20 max
  impressions = LEAST(impressions, 1000), -- Cap impressions at 1000 max
  updated_at = NOW()
WHERE likes > 50 OR retweets > 10 OR replies > 20 OR impressions > 1000;

-- 2. Reset main tweets table
UPDATE tweets 
SET 
  likes = LEAST(likes, 50),
  retweets = LEAST(retweets, 10), 
  replies = LEAST(replies, 20),
  impressions = LEAST(impressions, 1000),
  updated_at = NOW()
WHERE likes > 50 OR retweets > 10 OR replies > 20 OR impressions > 1000;

-- 3. Reset engagement snapshots
UPDATE engagement_snapshots 
SET 
  likes = LEAST(likes, 50),
  retweets = LEAST(retweets, 10),
  replies = LEAST(replies, 20), 
  impressions = LEAST(impressions, 1000),
  updated_at = NOW()
WHERE likes > 50 OR retweets > 10 OR replies > 20 OR impressions > 1000;

-- 4. Reset any engagement history with fake numbers
UPDATE engagement_history 
SET 
  likes = LEAST(likes, 50),
  retweets = LEAST(retweets, 10),
  replies = LEAST(replies, 20),
  impressions = LEAST(impressions, 1000),
  updated_at = NOW()
WHERE likes > 50 OR retweets > 10 OR replies > 20 OR impressions > 1000;

-- 5. Clean up competitor data with fake millions of followers
UPDATE competitor_accounts 
SET 
  follower_count = LEAST(follower_count, 100000), -- Cap at 100K max
  growth_rate = LEAST(growth_rate, 1000),         -- Cap growth at 1K/day max
  updated_at = NOW()
WHERE follower_count > 100000 OR growth_rate > 1000;

-- 6. Add realistic follower count expectation for small accounts
UPDATE tweets 
SET 
  follower_count_before = LEAST(COALESCE(follower_count_before, 17), 100),
  follower_count_after = LEAST(COALESCE(follower_count_after, 17), 100)
WHERE follower_count_before > 100 OR follower_count_after > 100;

-- Verification queries
SELECT 'AFTER CLEANUP - Tweet Analytics:' as check_type, 
       MAX(likes) as max_likes, 
       MAX(retweets) as max_retweets, 
       MAX(replies) as max_replies,
       MAX(impressions) as max_impressions
FROM tweet_analytics;

SELECT 'AFTER CLEANUP - Main Tweets:' as check_type,
       MAX(likes) as max_likes, 
       MAX(retweets) as max_retweets, 
       MAX(replies) as max_replies,
       MAX(impressions) as max_impressions  
FROM tweets;

SELECT 'AFTER CLEANUP - Competitors:' as check_type,
       MAX(follower_count) as max_followers,
       MAX(growth_rate) as max_growth_rate
FROM competitor_accounts;

-- Log the cleanup
INSERT INTO system_logs (log_level, component, message, created_at)
VALUES ('INFO', 'emergency_cleanup', 'Cleaned fake engagement metrics - reset to realistic small account levels', NOW());

SELECT '✅ FAKE METRICS CLEANUP COMPLETE' as status,
       'All engagement numbers now realistic for small account' as result;