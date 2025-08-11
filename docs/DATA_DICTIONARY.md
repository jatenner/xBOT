# xBOT Data Dictionary

**Generated**: 2025-08-11  
**Source**: Analyzed from `supabase/migrations/0001_baseline.sql` and code inspection

## Core Tables

### tweets
**Purpose**: Core content storage and analytics  
**Source of Truth**: Yes  

| Column | Type | Constraints | Purpose | Source |
|--------|------|-------------|---------|---------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing tweet ID | Migration |
| tweet_id | TEXT | UNIQUE NOT NULL | Twitter's unique tweet identifier | Migration |
| content | TEXT | NOT NULL | Tweet text content | Migration |
| posted_at | TIMESTAMPTZ | DEFAULT NOW() | When tweet was posted | Migration |
| platform | TEXT | DEFAULT 'twitter' | Publishing platform | Migration |
| metadata | JSONB | DEFAULT '{}' | Flexible content metadata | Migration |
| analytics | JSONB | DEFAULT '{}' | Performance metrics | Migration |

**Indexes**:
- `idx_tweets_posted_at` (posted_at DESC)
- `idx_tweets_platform` (platform)
- `idx_tweets_metadata_gin` (metadata GIN)
- `idx_tweets_analytics_gin` (analytics GIN)

**JSONB Fields**:
- `metadata`: Contains content type, topics, generation params
- `analytics`: Contains likes, retweets, replies, impressions, engagement_rate

### bot_config
**Purpose**: System configuration and feature flags  
**Source of Truth**: Yes  

| Column | Type | Constraints | Purpose | Source |
|--------|------|-------------|---------|---------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing config ID | Migration |
| environment | TEXT | NOT NULL DEFAULT 'production' | Environment scope | Migration |
| config_key | TEXT | NOT NULL | Configuration key name | Migration |
| config_value | JSONB | NOT NULL DEFAULT '{}' | Configuration value | Migration |
| metadata | JSONB | DEFAULT '{}' | Config metadata | Migration |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp | Migration |

**Constraints**:
- `bot_config_env_key_unique` UNIQUE (environment, config_key)

**Key Configuration Keys**:
- `schema_version`: Database schema version tracking
- `redis_config`: Redis connection and caching settings
- `rate_limits`: Posting and API rate limits
- `feature_flags`: Feature toggles and experimental settings

### daily_summaries
**Purpose**: Daily analytics snapshots  
**Source of Truth**: Yes  

| Column | Type | Constraints | Purpose | Source |
|--------|------|-------------|---------|---------|
| day | DATE | NOT NULL | Summary date | Migration |
| summary_type | TEXT | NOT NULL | Type of summary | Migration |
| environment | TEXT | DEFAULT 'production' | Environment scope | Migration |
| metrics | JSONB | DEFAULT '{}' | Daily metrics | Migration |
| metadata | JSONB | DEFAULT '{}' | Summary metadata | Migration |

**Primary Key**: (day, summary_type, environment)

**Indexes**:
- `idx_daily_summaries_day` (day DESC)
- `idx_daily_summaries_type` (summary_type)
- `idx_daily_summaries_env` (environment)

### audit_log
**Purpose**: System event tracking and compliance  
**Source of Truth**: Yes  

| Column | Type | Constraints | Purpose | Source |
|--------|------|-------------|---------|---------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing log ID | Migration |
| ts | TIMESTAMPTZ | DEFAULT NOW() | Event timestamp | Migration |
| event_type | TEXT | NOT NULL | Type of event | Migration |
| component | TEXT | NOT NULL | System component | Migration |
| event_data | JSONB | DEFAULT '{}' | Event details | Migration |
| context | JSONB | DEFAULT '{}' | Event context | Migration |

**Indexes**:
- `idx_audit_log_ts` (ts DESC)
- `idx_audit_log_component` (component)
- `idx_audit_log_event_type` (event_type)
- `idx_audit_log_event_data_gin` (event_data GIN)

### system_health
**Purpose**: Health monitoring and diagnostics  
**Source of Truth**: Yes  

| Column | Type | Constraints | Purpose | Source |
|--------|------|-------------|---------|---------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing health ID | Migration |
| ts | TIMESTAMPTZ | DEFAULT NOW() | Health check timestamp | Migration |
| component | TEXT | NOT NULL | System component | Migration |
| status | TEXT | NOT NULL | Health status | Migration |
| metrics | JSONB | DEFAULT '{}' | Health metrics | Migration |
| details | JSONB | DEFAULT '{}' | Health details | Migration |

**Indexes**:
- `idx_system_health_ts` (ts DESC)
- `idx_system_health_component` (component)
- `idx_system_health_status` (status)

## JSONB Schema Patterns

### tweets.metadata
```json
{
  "content_type": "question|statement|list|thread|quote|fact",
  "topics": ["gaming", "ai", "technology"],
  "generation_params": {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 280
  },
  "source": "autonomous|manual|scheduled",
  "tags": ["#gaming", "#ai"],
  "media_hint": "clip|image|none",
  "freshness_score": 0.85
}
```

### tweets.analytics
```json
{
  "likes": 42,
  "retweets": 8,
  "replies": 15,
  "bookmarks": 12,
  "impressions": 1250,
  "engagement_rate": 0.062,
  "follower_growth": 3,
  "collected_at": "2025-08-11T12:00:00Z",
  "viral_threshold": false,
  "performance_tier": "high|medium|low"
}
```

### bot_config.config_value Examples

#### schema_version
```json
{
  "version": "1.0.0",
  "migration": "0001_baseline",
  "timestamp": "2025-08-11T10:00:00Z"
}
```

#### feature_flags
```json
{
  "autonomous_posting": true,
  "redis_dual_store": true,
  "analytics_collection": true,
  "growth_optimization": true,
  "learning_engine_v2": false
}
```

#### rate_limits
```json
{
  "posts_per_hour": 12,
  "posts_per_day": 75,
  "api_calls_per_minute": 100,
  "emergency_brake": true
}
```

## Environment Separation Strategy

### Row-Level Environment Isolation
- All tables include `environment` column
- Values: `production`, `staging`, `development`
- Queries filtered by `APP_ENV` environment variable
- No cross-environment data leakage

### Configuration Environment Mapping
```
Local Development  → environment = 'staging'
CI/CD Pipeline     → environment = 'staging'
Railway Production → environment = 'production'
```

## Migration Strategy

### Schema Evolution
- **Additive Only**: No DROP operations in migrations
- **JSONB First**: New fields added to JSONB columns
- **Indexed JSONB**: GIN indexes for performance
- **Backward Compatible**: Supports both old and new schemas

### Data Integrity
- Foreign key relationships avoided for flexibility
- Application-level referential integrity
- Audit logging for all data changes
- Schema version checking at startup

## Analytics Calculation Patterns

### Engagement Rate Formula
```sql
engagement_rate = (likes + retweets + replies + bookmarks) / impressions
```

### Performance Scoring
```sql
performance_tier = CASE
  WHEN engagement_rate > 0.1 THEN 'high'
  WHEN engagement_rate > 0.05 THEN 'medium'
  ELSE 'low'
END
```

### Growth Attribution
- Tweet-level follower growth tracking
- Time-window correlation analysis
- Topic-based growth attribution

## Future V2 Extensions

### Planned JSONB Fields

#### tweets.metadata (V2)
- `bandit_scores`: Thompson sampling scores by topic
- `model_score`: Logistic regression prediction
- `exploration_factor`: ε-greedy exploration rate
- `candidate_rank`: Original ranking in candidate set

#### bot_config.config_value (V2)
- `bandit_priors`: Alpha/beta parameters by topic
- `model_weights`: Logistic regression coefficients
- `exploration_rate`: Global ε parameter
- `learning_schedule`: Update frequency settings