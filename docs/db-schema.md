# Snap2Health X-Bot Database Schema Documentation

## Overview
This document provides a comprehensive overview of the database schema for the Snap2Health X-Bot. The database uses PostgreSQL with Supabase and includes tables for tweet management, analytics, learning insights, and bot configuration.

---

## Core Tables

### `tweets`
**Purpose**: Stores original tweets posted by the bot
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| tweet_id | VARCHAR(255) | NO | - | Unique Twitter tweet ID |
| content | TEXT | NO | - | Tweet content text |
| tweet_type | VARCHAR(50) | YES | 'original' | Type of tweet |
| engagement_score | INTEGER | YES | 0 | Calculated engagement metric |
| likes | INTEGER | YES | 0 | Number of likes |
| retweets | INTEGER | YES | 0 | Number of retweets |
| replies | INTEGER | YES | 0 | Number of replies |
| impressions | INTEGER | YES | 0 | Number of impressions |
| has_snap2health_cta | BOOLEAN | YES | false | Contains call-to-action |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |
| embedding | vector(1536) | YES | - | AI embedding for similarity |
| style | TEXT | YES | 'DEFAULT' | Content style identifier |
| eng_score | INTEGER | YES | 0 | Additional engagement score |

**Use Cases**: Track bot's tweet performance, similarity detection, style analysis

---

### `replies`
**Purpose**: Stores replies posted by the bot to other tweets
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| reply_id | VARCHAR(255) | NO | - | Unique Twitter reply ID |
| parent_tweet_id | VARCHAR(255) | NO | - | ID of tweet being replied to |
| content | TEXT | NO | - | Reply content text |
| engagement_score | INTEGER | YES | 0 | Reply engagement metric |
| likes | INTEGER | YES | 0 | Number of likes |
| retweets | INTEGER | YES | 0 | Number of retweets |
| replies | INTEGER | YES | 0 | Number of replies to this reply |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

**Use Cases**: Track bot's reply performance, conversation engagement

---

### `target_tweets`
**Purpose**: Stores tweets identified as potential reply targets
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| tweet_id | VARCHAR(255) | NO | - | Target tweet ID |
| author_username | VARCHAR(255) | NO | - | Original tweet author |
| content | TEXT | NO | - | Original tweet content |
| engagement_score | INTEGER | YES | 0 | Target's engagement score |
| reply_potential_score | DECIMAL(3,2) | YES | 0 | AI-calculated reply potential |
| has_replied | BOOLEAN | YES | false | Whether bot has replied |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

**Use Cases**: Reply strategy, engagement targeting

---

## Analytics & Learning Tables

### `engagement_analytics`
**Purpose**: Stores detailed engagement metrics and learning data
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| content_type | VARCHAR(50) | NO | - | 'tweet' or 'reply' |
| content_id | UUID | NO | - | Reference to content |
| metric_type | VARCHAR(50) | NO | - | 'hourly', 'daily', 'weekly' |
| engagement_score | INTEGER | YES | 0 | Aggregated engagement |
| reach_score | INTEGER | YES | 0 | Reach metrics |
| recorded_at | TIMESTAMPTZ | YES | NOW() | Measurement timestamp |

**Use Cases**: Performance analysis, trend detection

---

### `learning_insights`
**Purpose**: Stores AI-generated insights about content performance
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| insight_type | VARCHAR(50) | NO | - | Type of insight learned |
| insight_data | JSONB | NO | - | Structured insight data |
| confidence_score | DECIMAL(3,2) | YES | 0 | Confidence in insight |
| performance_impact | DECIMAL(3,2) | YES | 0 | Expected performance impact |
| sample_size | INTEGER | YES | 0 | Number of samples used |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |
| expires_at | TIMESTAMPTZ | YES | NOW() + 30d | Insight expiration |

**Use Cases**: Machine learning, strategy optimization

---

### `content_themes`
**Purpose**: Tracks performance of different content themes
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| theme_name | VARCHAR(255) | NO | - | Theme identifier |
| keywords | TEXT[] | YES | - | Associated keywords array |
| avg_engagement | DECIMAL(5,2) | YES | 0 | Average engagement score |
| total_posts | INTEGER | YES | 0 | Number of posts in theme |
| best_performing_tweet_id | VARCHAR(255) | YES | - | Best tweet reference |
| last_used | TIMESTAMPTZ | YES | - | Last time theme was used |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

**Use Cases**: Content strategy, theme performance tracking

---

### `timing_insights`
**Purpose**: Stores optimal posting time analysis
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| hour_of_day | INTEGER | NO | - | Hour (0-23) |
| day_of_week | INTEGER | NO | - | Day (0=Sunday, 6=Saturday) |
| avg_engagement | DECIMAL(5,2) | YES | 0 | Average engagement for time |
| post_count | INTEGER | YES | 0 | Number of posts at this time |
| confidence_level | DECIMAL(3,2) | YES | 0 | Statistical confidence |
| last_updated | TIMESTAMPTZ | YES | NOW() | Last calculation time |

**Use Cases**: Optimal posting schedule, timing strategy

---

### `style_performance`
**Purpose**: Tracks performance of different content styles
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| style_type | VARCHAR(50) | NO | - | Style identifier |
| avg_engagement | DECIMAL(5,2) | YES | 0 | Average engagement |
| total_posts | INTEGER | YES | 0 | Total posts in style |
| success_rate | DECIMAL(3,2) | YES | 0 | Success percentage |
| last_updated | TIMESTAMPTZ | YES | NOW() | Last update time |

**Use Cases**: Style optimization, content strategy

---

## Configuration & Control Tables

### `bot_config`
**Purpose**: Stores bot configuration and settings
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| key | VARCHAR(255) | NO | - | Configuration key |
| value | TEXT | NO | - | Configuration value |
| description | TEXT | YES | - | Human-readable description |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

**Use Cases**: Bot behavior configuration, feature toggles

---

### `control_flags`
**Purpose**: Emergency controls and feature flags
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | - | Primary key (flag name) |
| value | BOOLEAN | NO | false | Flag state |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

**Use Cases**: Kill switches, emergency controls, feature flags

---

### `api_usage`
**Purpose**: Tracks daily API usage for quota management
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| date | DATE | NO | - | Primary key (usage date) |
| writes | INTEGER | YES | 0 | Number of write operations |
| reads | INTEGER | YES | 0 | Number of read operations |

**Use Cases**: API quota management, usage monitoring

---

## Media & Content Tables

### `media_history`
**Purpose**: Tracks image usage to prevent repetition
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| url | TEXT | NO | - | Image URL |
| caption | TEXT | YES | - | Image caption/description |
| source | TEXT | YES | 'unsplash' | Image source |
| used_at | TIMESTAMPTZ | YES | NOW() | When image was used |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |

**Use Cases**: Image rotation, avoiding duplicates

---

### `news_cache`
**Purpose**: Caches news articles for content generation
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| title | TEXT | NO | - | Article title |
| url | TEXT | NO | - | Article URL |
| source | TEXT | NO | - | News source |
| content | TEXT | YES | - | Article content |
| cached_at | TIMESTAMPTZ | YES | NOW() | Cache timestamp |
| metadata | JSONB | YES | '{}' | Additional metadata |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |

**Use Cases**: Content inspiration, news integration

---

### `content_recycling`
**Purpose**: Manages evergreen content recycling
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | SERIAL | NO | - | Primary key |
| original_tweet_id | TEXT | NO | - | Original tweet reference |
| last_recycled | TIMESTAMPTZ | YES | NOW() | Last recycling time |
| recycle_count | INTEGER | YES | 1 | Number of times recycled |

**Use Cases**: Content reuse, evergreen strategies

---

## Database Maintenance

### Indexes
- Performance indexes on frequently queried columns
- Vector similarity index for embeddings
- Time-based indexes for analytics queries

### Row Level Security (RLS)
- Enabled on all tables
- Service role has full access
- Policies configured for security

### Functions
- `incr_write()`: Increment write counter
- `incr_read()`: Increment read counter
- `increment_image_usage()`: Track image usage

---

## Usage Patterns

### High Activity Tables
- `tweets`: Core content storage
- `bot_config`: Frequent configuration reads
- `api_usage`: Daily quota tracking

### Medium Activity Tables
- `learning_insights`: Periodic AI analysis
- `media_history`: Image selection
- `news_cache`: Content source caching

### Low Activity Tables
- `timing_insights`: Weekly analysis updates
- `style_performance`: Monthly optimization
- `content_themes`: Theme performance tracking

---

## Cleanup Candidates

Tables with potentially low usage that may be candidates for cleanup:
- Tables with 0 rows and no recent activity
- Tables not referenced in current codebase
- Deprecated features or experimental tables

**Note**: Before removing any table, ensure it's not used by:
1. Current application code
2. Scheduled jobs or cron tasks
3. Data analysis or reporting tools
4. Backup or migration scripts

---

*Last updated: $(date)*
*For questions about this schema, consult the development team or database administrator.* 