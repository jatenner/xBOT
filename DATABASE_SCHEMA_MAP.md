# 🗺️ xBOT DATABASE SCHEMA MAP
*Complete reference for all tables, constraints, and relationships*

## 📊 **CORE TABLES**

### `tweets` (Main Posting Table)
- **Purpose**: Stores all bot tweets and performance data
- **Key Columns**:
  - `tweet_id` (TEXT) - Unique identifier
  - `content` (TEXT) - Tweet content
  - `likes`, `retweets`, `replies`, `impressions` (INTEGER)
  - `viral_score`, `engagement_score` (INTEGER)
  - `quality_score` (INTEGER) - **NEWLY ADDED** for learning
  - `learning_metadata` (JSONB) - **NEWLY ADDED** for learning data
  - `was_posted` (BOOLEAN) - **NEWLY ADDED** track posting status

### `contextual_bandit_arms` (Content Format Optimization)
- **Purpose**: Multi-arm bandit for content format selection
- **Key Constraints**:
  - `arm_type` MUST be one of: `'format'`, `'timing'`, `'engagement'`
  - `id`, `arm_name`, `arm_type`, `features` are NOT NULL
- **Current Data**: 10 arms (5 format, 3 timing, 2 engagement)
- **Columns**:
  - `arm_name` (TEXT) - Unique identifier
  - `arm_type` (TEXT) - Type category (constrained)
  - `features` (JSONB) - Arm characteristics 
  - `total_selections`, `success_count`, `failure_count` (INTEGER)
  - `total_reward`, `avg_reward`, `confidence_score` (NUMERIC)

### `enhanced_timing_stats` (Posting Time Optimization)
- **Purpose**: Learn optimal posting times by hour/day
- **Key Columns**:
  - `hour_of_day` (INTEGER) - Hour (0-23) **NOT** `hour`
  - `day_of_week` (INTEGER) - Day (0-6, Sunday=0)
  - `total_posts`, `total_engagement`, `total_impressions` (INTEGER)
  - `success_count`, `failure_count` (INTEGER)
  - `confidence_score`, `avg_engagement_rate`, `viral_hit_rate` (NUMERIC)
- **Current Data**: 18 optimal time slots populated

### `format_stats` (Existing)
- **Purpose**: Content format performance tracking
- **Current Data**: 1 test format entry

## 🔧 **ESSENTIAL FUNCTIONS**

### `calculate_engagement_score(likes, retweets, replies, impressions)`
- **Returns**: DECIMAL engagement score
- **Formula**: likes + (retweets × 2) + (replies × 3)

### `get_optimal_posting_time(target_day_of_week)`
- **Returns**: optimal_hour, day_of_week, predicted_engagement, confidence
- **Logic**: Finds best time based on engagement × confidence score

### `get_bandit_arm_statistics()`
- **Returns**: All arms with success rates and confidence levels
- **Usage**: For content format selection decisions

### `get_best_content_format()`
- **Returns**: TEXT arm_name of best performing format
- **Logic**: Highest success rate among 'format' type arms

### `update_tweet_performance(tweet_id, likes, retweets, replies, impressions)`
- **Returns**: BOOLEAN success status
- **Purpose**: Update tweet metrics and recalculate scores

## 📈 **ANALYTICS VIEWS**

### `high_performing_tweets`
- **Purpose**: Show tweets with viral_score ≥ 6 OR engagement_score ≥ 20
- **Includes**: All tweet data plus computed engagement scores

### `bandit_performance_analysis`
- **Purpose**: Analyze bandit arm performance by type
- **Groups**: Format, timing, engagement arms with success rates

## 🚨 **CRITICAL CONSTRAINTS TO REMEMBER**

1. **contextual_bandit_arms.arm_type**: ONLY `'format'`, `'timing'`, `'engagement'`
2. **contextual_bandit_arms NOT NULL**: `id`, `arm_name`, `arm_type`, `features`
3. **enhanced_timing_stats**: Use `hour_of_day` NOT `hour`
4. **All learning tables**: Empty before our setup - now populated

## 🔄 **MIGRATION BEST PRACTICES**

1. **Always check constraints first**: Use our constraint analysis queries
2. **Test with single INSERT**: Before bulk operations
3. **Use exact column names**: From information_schema.columns
4. **Respect data types**: TEXT vs VARCHAR vs ENUM differences
5. **Handle NOT NULL**: Provide all required fields

## 🎯 **INTEGRATION POINTS**

The bot code should now use:
- `get_optimal_posting_time()` for scheduling
- `get_best_content_format()` for content generation
- `update_tweet_performance()` after posting
- `calculate_engagement_score()` for scoring

## ✅ **CURRENT STATUS**
- **Database**: Fully operational with learning system
- **Tables**: All populated with realistic data
- **Functions**: All tested and working
- **Views**: Created for analytics
- **Constraints**: All satisfied and documented
