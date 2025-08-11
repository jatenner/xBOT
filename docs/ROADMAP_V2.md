# xBOT Learning Engine V2 Roadmap

**Generated**: 2025-08-11  
**Timeline**: 2-week incremental development plan  
**Strategy**: Build on existing Redis+Supabase stack with zero breaking changes

## Executive Summary

Transform xBOT from rule-based posting to intelligent learning system using Thompson sampling (bandit algorithms) and logistic regression scoring. All changes are additive and maintain backward compatibility with current posting engine.

## Implementation Strategy

### Core Principles
1. **Additive Only**: No breaking changes to existing code
2. **Dual Operation**: V1 and V2 systems run in parallel initially
3. **Feature Flagged**: `learning_engine_v2` feature flag controls activation
4. **Staged Rollout**: Gradual migration from V1 to V2 intelligence

### Technology Stack Extensions
- **Current**: Redis queues + Supabase analytics + Intelligence engine V1
- **Added**: Thompson sampling + Logistic regression + Enhanced queues + ML pipelines

## Week 1: Foundation & Candidate Generation

### Day 1-2: Candidate Generation Pipeline
**Scope**: Build content candidate generation and ranking system

**Files to Create/Modify**:
```
src/candidates/
├── trends.ts           # Gaming trends analysis (X API + curated)
├── news.ts            # Gaming news summarization  
├── clips.ts           # Clip manifest processing
└── index.ts           # Candidate orchestrator

src/types/
└── candidates.ts      # Candidate data types
```

**New Database Tables** (Migration: `20250812_candidate_system.sql`):
```sql
CREATE TABLE content_candidates (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    topic TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    media_hint TEXT DEFAULT 'none',
    freshness_score DECIMAL(3,2) DEFAULT 0.5,
    metadata JSONB DEFAULT '{}',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending'
);

CREATE INDEX idx_candidates_topic_generated ON content_candidates(topic, generated_at DESC);
CREATE INDEX idx_candidates_status ON content_candidates(status);
```

**Acceptance Criteria**:
- ✅ Generate 10-15 gaming topics per run
- ✅ Produce 2-3 variants per news headline
- ✅ Process local clip manifests with captions
- ✅ Content deduplication via Redis `content_hash:sha256:{hash}` (7d TTL)
- ✅ Integration test with dry-run mode

**Time Estimate**: 16 hours

### Day 3-4: Enhanced Safety Guards  
**Scope**: Expand safety filtering beyond current basic implementation

**Files to Create/Modify**:
```
src/safety/
├── guard.ts           # Enhanced safety pipeline
├── filters.ts         # Individual filter implementations
└── index.ts           # Safety orchestrator

src/types/
└── safety.ts          # Safety validation types
```

**Enhanced Safety Features**:
- Profanity list expansion (maintain current list + gaming-specific)
- Secrets regex enhancement (API keys, tokens, personal info)
- Hashtag limit enforcement (max 3, configurable)
- Content length validation
- Sentiment analysis integration (basic)

**Bot Config Extensions**:
```json
{
  "safety_config": {
    "max_hashtags": 3,
    "min_length": 10,
    "max_length": 280,
    "profanity_strict": true,
    "sentiment_threshold": -0.3
  }
}
```

**Acceptance Criteria**:
- ✅ All current safety features preserved
- ✅ Return `{ok: boolean, reasons: string[]}` format
- ✅ Configurable via bot_config
- ✅ Performance: <50ms per content piece
- ✅ Unit tests for all filter types

**Time Estimate**: 12 hours

### Day 5: Deduplication & Caching
**Scope**: Implement Redis-based content deduplication

**Files to Create/Modify**:
```
src/utils/
├── deduplication.ts   # Content hash and dedup logic
└── caching.ts         # Redis caching helpers

src/utils/redis/
└── key.ts             # Add dedup key patterns (existing file)
```

**Redis Key Additions**:
```typescript
// New keys in RedisKeys helper
contentHash: (hash: string) => key('content_hash', 'sha256', hash),
dedupTweet: (hash: string) => key('dedup', 'tweet', hash),
```

**Acceptance Criteria**:
- ✅ SHA256 hashing of normalized content
- ✅ 7-day TTL for deduplication cache
- ✅ Integration with candidate generation
- ✅ Performance: <10ms per hash operation

**Time Estimate**: 8 hours

## Week 2: Learning Engine & Scoring

### Day 6-8: Thompson Sampling (Bandit Algorithm)
**Scope**: Implement bandit algorithm for topic/time/tag optimization

**Files to Create/Modify**:
```
src/learn/
├── bandit.ts          # Thompson sampling core logic
├── priors.ts          # Alpha/beta parameter management
└── index.ts           # Learning orchestrator

src/types/
└── learning.ts        # Learning algorithm types
```

**Redis Extensions** (Bandit state storage):
```typescript
// New Redis key patterns
banditTopic: (topic: string) => key('bandit', 'topic', topic),
banditHour: (hour: string) => key('bandit', 'hour', hour),
banditTag: (tag: string) => key('bandit', 'tag', tag),
```

**Bot Config Extensions**:
```json
{
  "learning_config": {
    "epsilon": 0.2,
    "bandit_enabled": true,
    "update_frequency": "15min",
    "min_samples": 10
  }
}
```

**Bandit State Schema** (Redis JSONB):
```json
{
  "alpha": 5,
  "beta": 3,
  "last_updated": "2025-08-12T10:00:00Z",
  "sample_count": 25,
  "success_rate": 0.625
}
```

**Acceptance Criteria**:
- ✅ Thompson sampling for topic, hour, tag dimensions
- ✅ Alpha/beta parameters stored in Redis (no TTL)
- ✅ Success defined as engagement_rate > historical median
- ✅ Integration with performance tracker for feedback
- ✅ Unit tests for bandit math

**Time Estimate**: 20 hours

### Day 9-10: Logistic Regression Scoring
**Scope**: Implement lightweight logistic regression for content scoring

**Files to Create/Modify**:
```
src/learn/
├── model.ts           # Logistic regression implementation
├── features.ts        # Feature extraction from content
└── scorer.ts          # Combined scoring (bandit + model)

src/types/
└── scoring.ts         # Scoring system types
```

**Feature Engineering**:
```typescript
interface ContentFeatures {
  hour: number;           // 0-23
  weekday: number;        // 0-6 (Sunday=0)
  topic: string;          // gaming, ai, tech, etc.
  tag_count: number;      // Number of hashtags
  media_hint: string;     // clip, image, none
  length_bucket: string;  // short, medium, long
  has_cta: boolean;       // Call-to-action present
}
```

**Model Weights Storage** (bot_config):
```json
{
  "model_weights": {
    "version": "1.0",
    "coefficients": {
      "hour_coef": [0.1, 0.15, ...],
      "weekday_coef": [0.2, 0.18, ...],
      "topic_coef": {"gaming": 0.3, "ai": 0.25},
      "tag_count_coef": 0.05,
      "media_coef": {"clip": 0.4, "image": 0.2},
      "length_coef": {"short": 0.1, "medium": 0.15},
      "cta_coef": 0.08
    },
    "intercept": -1.2
  }
}
```

**Acceptance Criteria**:
- ✅ Feature extraction from content and metadata
- ✅ Logistic regression probability calculation
- ✅ Model weights cached in Redis (1h TTL)
- ✅ Combined scoring: `final_score = ε * bandit_score + (1-ε) * model_score`
- ✅ Return top N candidates with explanation strings

**Time Estimate**: 18 hours

### Day 11-12: Scheduler Integration & Queue Management
**Scope**: Integrate V2 intelligence with existing posting scheduler

**Files to Create/Modify**:
```
src/schedule/
├── loop.ts            # Main scheduling loop with V2 integration
├── queue.ts           # Enhanced queue management
└── worker.ts          # Background processing worker

src/core/
└── autonomousPostingEngine.ts  # Modify to support V2 (existing file)
```

**New Queue Types**:
```typescript
// Enhanced queue system
pending_posts     -- Scored and scheduled posts
candidate_pool    -- Generated but unscored candidates  
learning_updates  -- Performance feedback for learning
```

**Integration Strategy**:
```typescript
// Feature flag controlled rollout
if (getFeatureFlag('learning_engine_v2')) {
  // Use V2 candidate generation + scoring
  candidates = await generateCandidatesV2();
  scored = await scoreWithBanditsAndModel(candidates);
} else {
  // Use existing V1 intelligence
  content = await intelligentContentGenerator.generate();
}
```

**Acceptance Criteria**:
- ✅ Rate limit pre-check via Redis counters (maintain existing)
- ✅ V2 candidate generation → scoring → safety → enqueue flow
- ✅ Worker pops from queue, posts if LIVE_POSTS=true
- ✅ Success writes to tweets table + analytics_sync queue
- ✅ Backward compatibility with V1 posting maintained

**Time Estimate**: 16 hours

### Day 13: Learning Loop & Analytics Integration
**Scope**: Implement feedback loop from performance to learning system

**Files to Create/Modify**:
```
src/learn/
├── ingest.ts          # Performance metrics ingestion
├── feedback.ts        # Learning feedback processing
└── updater.ts         # Bandit parameter updates

src/intelligence/
└── tweetPerformanceTracker.ts  # Enhance existing tracker
```

**Learning Loop Flow**:
```typescript
// Every 15 minutes
1. Pull metrics for last 24h posts
2. Calculate engagement_rate for each post
3. Compare against historical median by topic
4. Update bandit priors (alpha++ for success, beta++ for failure)
5. Write audit_log entries for learning updates
```

**Database Extensions** (Migration: `20250813_learning_metrics.sql`):
```sql
-- Add learning tracking to existing tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS 
  learning_metadata JSONB DEFAULT '{}';

-- Index for learning queries
CREATE INDEX IF NOT EXISTS idx_tweets_learning_metadata_gin 
  ON tweets USING GIN (learning_metadata);
```

**Acceptance Criteria**:
- ✅ 15-minute learning loop (configurable via bot_config)
- ✅ Engagement rate calculation and historical median comparison
- ✅ Bandit prior updates in Redis
- ✅ Audit logging of learning decisions
- ✅ Performance metrics: <30s per learning cycle

**Time Estimate**: 14 hours

### Day 14: Analytics Views & Dashboard Integration
**Scope**: Create SQL views and operational dashboards for V2 system

**Files to Create/Modify**:
```
src/ops/
├── health.ts          # Enhanced health checks for V2
├── dashboard.ts       # V2 analytics dashboard
└── reports.ts         # Daily/weekly reporting

docs/perf/
└── README.md          # V2 performance analysis guide
```

**SQL Views** (Migration: `20250814_analytics_views.sql`):
```sql
-- Recent posts with V2 metadata
CREATE OR REPLACE VIEW vw_recent_posts AS
SELECT 
  id, content, posted_at, 
  analytics->>'engagement_rate' as engagement_rate,
  learning_metadata->>'bandit_score' as bandit_score,
  learning_metadata->>'model_score' as model_score,
  metadata->>'topic' as topic
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
ORDER BY posted_at DESC;

-- Topic performance over 7 days
CREATE OR REPLACE VIEW vw_topics_perf_7d AS
SELECT 
  metadata->>'topic' as topic,
  COUNT(*) as post_count,
  AVG((analytics->>'engagement_rate')::DECIMAL) as avg_engagement,
  AVG((learning_metadata->>'bandit_score')::DECIMAL) as avg_bandit_score
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
  AND metadata->>'topic' IS NOT NULL
GROUP BY metadata->>'topic'
ORDER BY avg_engagement DESC;

-- Time of day performance over 7 days
CREATE OR REPLACE VIEW vw_time_of_day_perf_7d AS
SELECT 
  EXTRACT(HOUR FROM posted_at) as hour,
  COUNT(*) as post_count,
  AVG((analytics->>'engagement_rate')::DECIMAL) as avg_engagement,
  AVG((learning_metadata->>'bandit_score')::DECIMAL) as avg_bandit_score
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM posted_at)
ORDER BY hour;
```

**Health Check Enhancements**:
```typescript
// Extended health checks for V2
- Redis PING + queue depths + bandit state health
- Supabase SELECT 1 + view accessibility
- Last candidate generation timestamp
- Learning loop status and last update
- Model performance metrics
```

**Acceptance Criteria**:
- ✅ One-line health status for V2 system
- ✅ SQL views for recent posts, topic performance, time analysis
- ✅ Performance documentation for reading views
- ✅ Integration with existing health endpoints

**Time Estimate**: 12 hours

## Configuration Management

### Bot Config Keys (Additive)
```json
{
  "learning_engine_v2": false,           # Feature flag
  "candidate_generation": {
    "topics_per_run": 15,
    "variants_per_news": 3,
    "clip_processing": true
  },
  "bandit_config": {
    "epsilon": 0.2,
    "min_samples": 10,
    "update_frequency_minutes": 15
  },
  "model_config": {
    "version": "1.0",
    "feature_weights": {...},
    "retraining_threshold": 0.05
  },
  "safety_enhanced": {
    "max_hashtags": 3,
    "sentiment_threshold": -0.3,
    "strict_mode": true
  }
}
```

### Redis Key Extensions
```typescript
// V2 Redis key patterns (added to existing)
candidatePool: () => queueKey('candidate_pool'),
learningUpdates: () => queueKey('learning_updates'),
banditState: (dimension: string, value: string) => 
  key('bandit', dimension, value),
modelCache: (version: string) => 
  cacheKey('model', version),
dedupContent: (hash: string) => 
  key('content_hash', 'sha256', hash)
```

## Testing Strategy

### Unit Tests
- **Bandit Algorithm**: Alpha/beta updates, Thompson sampling math
- **Feature Extraction**: Content → feature vector transformation
- **Safety Guards**: All filter types with edge cases
- **Deduplication**: Hash generation and collision handling

### Integration Tests
- **Candidate Generation**: End-to-end pipeline with real content
- **Learning Loop**: Metrics ingestion → bandit updates
- **Queue Processing**: Candidate → scored → posted flow
- **Dual Operation**: V1 and V2 running in parallel

### Staging Validation
- **Dry Run Mode**: LIVE_POSTS=false, full V2 pipeline
- **Performance Testing**: Learning loop timing and resource usage
- **Safety Validation**: Enhanced guards catch problematic content
- **Analytics**: Views return expected data

## Deployment Strategy

### Week 1 Deployment
- **Day 2**: Candidate generation (feature flag OFF)
- **Day 4**: Enhanced safety guards (parallel to existing)
- **Day 5**: Deduplication system (passive mode)

### Week 2 Deployment  
- **Day 8**: Bandit algorithm (learning mode only, no decisions)
- **Day 10**: Model scoring (parallel scoring, V1 decisions)
- **Day 12**: V2 scheduler integration (feature flag controlled)
- **Day 14**: Full V2 system (opt-in via feature flag)

### Rollout Plan
1. **Week 3**: Staging validation with LIVE_POSTS=false
2. **Week 4**: Production deployment with learning_engine_v2=false
3. **Week 5**: Enable V2 learning (bandit updates, parallel decisions)
4. **Week 6**: Gradual V2 decision making (low epsilon, high V1 weight)
5. **Week 7**: Full V2 operation (learning_engine_v2=true)

## Success Metrics

### Technical KPIs
- **Deployment Success**: Zero breaking changes, all V1 functionality preserved
- **Performance**: V2 operations <100ms overhead vs V1
- **Reliability**: V2 system 99.9% uptime, graceful fallback to V1
- **Data Quality**: Learning loop 100% completion rate

### Business KPIs
- **Engagement Improvement**: 20%+ increase in average engagement rate
- **Growth Acceleration**: 15%+ improvement in follower growth velocity  
- **Content Quality**: Reduced duplicate/low-performing content by 50%
- **Operational Efficiency**: 30% reduction in manual content curation

## Risk Mitigation

### Technical Risks
- **Performance Impact**: Extensive performance testing, gradual rollout
- **Data Loss**: Dual storage pattern, comprehensive backups
- **Learning Divergence**: Historical baseline tracking, manual override
- **Queue Overflow**: Enhanced monitoring, automatic cleanup

### Business Risks
- **Engagement Drop**: Feature flag instant rollback capability
- **Content Quality Issues**: Enhanced safety guards, manual review queue
- **Operational Complexity**: Comprehensive documentation, training materials

## Daily Operating Rhythm

### Staging Operations
```bash
# Daily staging dry-run validation
1. npm run schedule:dry-run          # Run scheduler with LIVE_POSTS=false
2. Check candidate quality in logs   # Ensure top picks look good
3. Validate safety guard effectiveness
4. Review learning metrics in views
```

### Production Operations
```bash
# Production deployment and monitoring
1. Start with 1 post/hour until stable
2. Scale to 2-3 posts/hour once confident
3. Monitor learning job every 15 minutes
4. Check docs/perf/README.md for daily metrics
```

### Performance Tuning
```bash
# Weekly performance optimization
1. Review 7-day engagement metrics
2. If engagement drops >30%:
   - Increase epsilon to 0.3 (more exploration)
   - Widen topic allowlist for 24-48h
   - Monitor bandit convergence
3. Adjust model weights based on performance
```

## Post-V2 Evolution Path

### 10k+ Likes Strategy
1. **Media Focus**: Prioritize short, crisp clips and viral content
2. **Timeliness**: Real-time response to patch drops, gaming events, finals
3. **Social Proof**: Quote tweets of viral clips with intelligent commentary
4. **Network Effects**: Coordinate with 2-3 allied creators for early engagement
5. **Interactive Content**: Run polls → follow-up with clip-based answers
6. **Daily Iteration**: Bandit algorithms compound gains with consistent optimization

This roadmap provides a concrete, actionable plan to transform xBOT into an intelligent learning system while maintaining all current functionality and reliability.