# xBOT Redis Key Mapping

**Generated**: 2025-08-11  
**Source**: Analyzed from Redis utilities and codebase patterns

## Key Prefix Strategy

### Environment Isolation
- **Staging**: `stg:` prefix (local development, CI/CD)
- **Production**: `prod:` prefix (Railway deployment)
- **Default**: `app:` prefix (fallback)

### Prefix Management
- **Helper Function**: `key(...parts)` in `src/utils/redis/key.ts`
- **Environment Variable**: `REDIS_PREFIX`
- **Automatic Prefixing**: All Redis operations use the helper

## Current Key Patterns

### Health & Monitoring
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}health:check` | 60s | Health verification | `src/utils/redis/key.ts` |
| `{prefix}health` | - | Legacy health key | `src/utils/redis/health.ts` |

### Rate Limiting
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}rate_limit:posting:{hour}` | 1h | Posts per hour counter | `src/utils/redis/key.ts` |
| `{prefix}rate_limit:api:{minute}` | 1m | API calls per minute | `src/utils/redis/key.ts` |

### Caching
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}cache:tweet:{tweetId}` | 24h | Tweet data cache | `src/utils/redis/key.ts` |
| `{prefix}cache:config:{key}` | 1h | Configuration cache | `src/utils/redis/key.ts` |
| `{prefix}tweets:recent` | 30m | Recent tweets list | `src/utils/redis/key.ts` |

### Queues (FIFO with Priority)
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}queue:sync_to_supabase` | - | Redis → Supabase sync | `src/lib/dualStoreManager.ts` |
| `{prefix}queue:analytics_processing` | - | Analytics processing | `src/utils/redis/key.ts` |
| `{prefix}queue:pending_posts` | - | Scheduled posts (V2) | Future |

### Locks
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}lock:posting_in_progress` | 5m | Prevent concurrent posting | `src/utils/redis/key.ts` |
| `{prefix}lock:sync_in_progress` | 10m | Prevent concurrent sync | `src/utils/redis/key.ts` |

### Analytics & Stats
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}stats:daily:{date}` | 7d | Daily performance metrics | `src/utils/redis/key.ts` |
| `{prefix}stats:hourly:{hour}` | 48h | Hourly performance metrics | `src/utils/redis/key.ts` |

### Temporary Data
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}temp:draft:{id}:1h` | 1h | Draft tweet storage | `src/utils/redis/key.ts` |
| `{prefix}temp:session:{sessionId}:24h` | 24h | Session storage | `src/utils/redis/key.ts` |

## Queue Data Structures

### Queue Implementation
- **Type**: Redis Sorted Sets (ZADD/ZREVRANGE)
- **Priority**: Higher score = higher priority
- **Ordering**: Priority first, then FIFO within priority
- **Persistence**: No TTL on queue keys

### Queue Item Schema
```typescript
interface QueueItem {
  id: string;           // Unique item identifier
  type: string;         // Item type for processing
  data: any;           // Item payload
  priority: number;    // Processing priority (0-100)
  createdAt: Date;     // Creation timestamp
  retryCount: number;  // Retry attempt counter
}
```

### Current Queue Usage

#### sync_to_supabase Queue
```typescript
// Purpose: Background sync from Redis to Supabase
// Location: src/lib/dualStoreManager.ts
// Priority: Standard (50)
// Retry: 3 attempts with exponential backoff
```

#### analytics_processing Queue
```typescript
// Purpose: Process tweet analytics and metrics
// Location: Planned for V2
// Priority: Low (25)
// Retry: 5 attempts
```

## Deduplication Strategy

### Content Hashing
| Key Pattern | TTL | Purpose | Source |
|-------------|-----|---------|---------|
| `{prefix}content_hash:sha256:{hash}` | 7d | Prevent duplicate content | Future V2 |
| `{prefix}dedup:tweet:{hash}` | 24h | Tweet deduplication | Current (inferred) |

### Hash Generation
```typescript
// Content normalization then SHA256
const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
const hash = crypto.createHash('sha256').update(normalized).digest('hex');
```

## Configuration Caching

### Cache Strategy
- **Source**: Supabase `bot_config` table
- **Cache Duration**: 1 hour TTL
- **Invalidation**: Version-based cache busting
- **Fallback**: Direct Supabase query on cache miss

### Configuration Keys
```typescript
// Cache keys for different config types
cache:config:schema_version      // Schema version tracking
cache:config:feature_flags       // Feature toggles
cache:config:rate_limits         // Rate limiting configs
cache:config:redis_config        // Redis-specific settings
cache:config:bandit_priors       // V2: Bandit algorithm state
cache:config:model_weights       // V2: ML model parameters
```

## Performance Monitoring

### Key Metrics Tracked
- **Queue Depths**: Number of items in each queue
- **Processing Latency**: Time from enqueue to completion
- **Cache Hit Rates**: Redis cache effectiveness
- **Error Rates**: Failed operations per key pattern

### Health Check Patterns
```typescript
// Health verification sequence
1. PING                              // Basic connectivity
2. SET {prefix}health:check test     // Write test
3. GET {prefix}health:check          // Read test
4. EXPIRE {prefix}health:check 60    // TTL test
```

## Environment-Specific Usage

### Staging Environment (`stg:`)
- Higher cache TTLs for development speed
- Smaller queue sizes
- More verbose logging
- Safe for data experiments

### Production Environment (`prod:`)
- Optimized TTLs for performance
- Larger queue capacities
- Minimal logging
- Strict data consistency

## Key Collision Prevention

### Namespace Strategy
- Environment prefixes prevent cross-environment collisions
- Consistent key patterns across all operations
- Central key management via helper functions
- Pattern validation in utilities

### Cleanup Patterns
```bash
# Environment-specific cleanup
KEYS stg:*                          # All staging keys
KEYS prod:temp:*                    # Production temporary keys
KEYS {prefix}queue:*                # All queue keys
```

## Future V2 Key Extensions

### Bandit Algorithm Keys
```typescript
// Thompson sampling parameters by topic/time
bandit:topic:{topic}:alpha          // Success count
bandit:topic:{topic}:beta           // Failure count
bandit:hour:{hour}:alpha            // Time-based success
bandit:hour:{hour}:beta             // Time-based failure
bandit:tag:{tag}:alpha              // Tag-based success
bandit:tag:{tag}:beta               // Tag-based failure
```

### Model Scoring Keys
```typescript
// Logistic regression model state
model:weights:v1                    // Model coefficients
model:performance:accuracy          // Model accuracy metrics
model:training:last_update          // Last training timestamp
```

### Learning Engine Keys
```typescript
// Learning loop state
learn:last_ingest                   // Last metrics collection
learn:processing_lock               // Prevent concurrent learning
learn:performance_baseline          // Historical performance baseline
```

## Redis Memory Optimization

### TTL Strategy
- **Short TTL**: Rate limits, health checks (< 1 hour)
- **Medium TTL**: Caches, temporary data (1-24 hours)
- **Long TTL**: Analytics, deduplication (1-7 days)
- **No TTL**: Queues, persistent state

### Eviction Policy
- **Configuration**: `allkeys-lru` (Least Recently Used)
- **Memory Limit**: Set via `REDIS_MAX_MEMORY` environment
- **Monitoring**: Track memory usage in health checks