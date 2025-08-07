# CURRENT TWEET_ANALYTICS SCHEMA DOCUMENTATION
*Extracted from Supabase on 2025-08-06 at 3:00 PM*

## ✅ EXISTING COLUMNS (31 total)

| Column Name | Data Type | Nullable | Purpose |
|-------------|-----------|----------|---------|
| id | uuid | NO | Primary key |
| tweet_id | character varying | NO | Twitter tweet ID |
| likes | integer | YES | Like count |
| retweets | integer | YES | Retweet count |
| replies | integer | YES | Reply count |
| quotes | integer | YES | Quote tweet count |
| bookmarks | integer | YES | Bookmark count |
| impressions | integer | YES | Impression count |
| views | integer | YES | View count |
| profile_visits | integer | YES | Profile visit count |
| detail_expands | integer | YES | Detail expand count |
| url_clicks | integer | YES | URL click count |
| media_views | integer | YES | Media view count |
| engagement_rate | numeric | YES | Engagement rate |
| viral_score | numeric | YES | Viral score |
| performance_score | numeric | YES | Performance score |
| follower_count_before | integer | YES | Followers before tweet |
| follower_count_after | integer | YES | Followers after tweet |
| new_followers_attributed | integer | YES | New followers from tweet |
| snapshot_interval | character varying | YES | Data collection interval |
| snapshot_time | timestamp with time zone | YES | When metrics collected |
| collected_via | character varying | YES | Collection method |
| collection_confidence | numeric | YES | Data confidence score |
| content | text | YES | Tweet content |
| content_type | character varying | YES | Content type (text/thread/etc) |
| has_media | boolean | YES | Has media attachments |
| has_hashtags | boolean | YES | Has hashtags |
| has_mentions | boolean | YES | Has mentions |
| word_count | integer | YES | Word count |
| created_at | timestamp with time zone | YES | Record creation time |
| updated_at | timestamp with time zone | YES | Record update time |

## 🚨 MISSING COLUMNS CAUSING ERRORS

Based on the error logs, these columns are missing and causing storage failures:

### Critical Missing Columns:
1. **click_through_rate** (DECIMAL/NUMERIC) - Referenced in error logs
2. **is_viral** (BOOLEAN) - Referenced in my previous failed SQL
3. **thread_performance** (JSONB) - For thread-specific metrics
4. **optimal_timing** (JSONB) - For timing analysis
5. **audience_segment** (VARCHAR) - For audience targeting
6. **growth_attribution** (JSONB) - For follower growth tracking
7. **learning_features** (JSONB) - For AI learning data
8. **ab_test_group** (VARCHAR) - For A/B testing
9. **success_prediction** (NUMERIC) - For pre-posting predictions

## 📋 MIGRATION STRATEGY

Now I can create a precise migration that adds ONLY the missing columns without conflicts.