# Environment Variables - Copy to Production

Add these environment variables to your Railway deployment:

```env
# Topic filtering for replies
REPLY_TOPIC_MODE=health_only
REPLY_HEALTH_THRESHOLD=0.70
REPLY_ALLOWLIST_TOPICS=health,nutrition,fitness,sleep,stress,hydration,habits,metabolism,recovery,wellness,mental health,exercise,diet,supplements
BLOCK_POLITICS=true

# Playwright stability settings
PLAYWRIGHT_PERSIST_BROWSER=true
PLAYWRIGHT_MAX_CONTEXT_RETRIES=3
PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS=800
PLAYWRIGHT_CONTEXT_TIMEOUT_MS=300000

# Content generation enhancements
SMART_GENERATION_ENABLED=true
AB_TEST_CANDIDATES=3

# Schema management (if using Supabase Management API)
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_PAT=your-personal-access-token
SUPABASE_PG_META_PATH=/postgres/v1/query
```

## Mode Explanations

### REPLY_TOPIC_MODE Options:
- `health_only`: Only reply to explicitly health-related content
- `smart_ride_along`: Reply to health content + trending topics with health pivots, never politics

### Environment Validation:
The system will automatically detect available credentials and choose the best schema management approach:
1. Direct DB URL (preferred)
2. Supabase pg-meta API
3. Supabase Management API (fallback)
4. Graceful skip if none available
