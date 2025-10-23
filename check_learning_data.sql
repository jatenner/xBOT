-- Check if learning loops are actually storing data

-- 1. Check post_attribution table (main learning table)
SELECT 
  COUNT(*) as total_posts,
  AVG(COALESCE(engagement_rate, 0)) as avg_engagement,
  AVG(COALESCE(followers_gained, 0)) as avg_followers,
  AVG(COALESCE(impressions, 0)) as avg_views,
  AVG(COALESCE(likes, 0)) as avg_likes,
  MAX(posted_at) as most_recent_post
FROM post_attribution;

-- 2. Check if ANY post has data
SELECT 
  post_id,
  likes,
  retweets,
  replies,
  impressions,
  engagement_rate,
  followers_gained,
  posted_at
FROM post_attribution
ORDER BY posted_at DESC
LIMIT 5;

-- 3. Check outcomes table (backup learning table)
SELECT 
  COUNT(*) as total_outcomes,
  AVG(COALESCE(likes, 0)) as avg_likes,
  AVG(COALESCE(views, 0)) as avg_views,
  MAX(collected_at) as most_recent_collection
FROM outcomes;
