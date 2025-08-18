# xBOT Database & Content Quality Implementation

## Prerequisites

- Node.js 18+ environment
- Access to Supabase project (URL and service role key)
- Railway deployment environment
- Redis instance (for posting locks)

## Implementation Steps

### 1. Install Dependencies (if new deps added)

```bash
npm install
```

### 2. Apply Database Migration

**Option A: Via Supabase SQL Editor (Recommended)**

1. Copy the contents of `migrations/2025-08-18-telemetry.sql`
2. Open your Supabase project dashboard → SQL Editor
3. Paste and execute the migration SQL
4. Verify successful execution (should see "Success" message)

**Option B: Via psql (if you have direct database access)**

```bash
psql "your-supabase-connection-string" -f migrations/2025-08-18-telemetry.sql
```

### 3. Verify Schema Implementation

```bash
npm run verify:schema
```

**Expected Output:**
```
🔍 SCHEMA_VERIFY: Starting comprehensive schema verification
📋 Checking table: tweet_metrics
✅ Table tweet_metrics exists and is accessible
✅ All required columns present in tweet_metrics
📋 Checking table: learning_posts
✅ Table learning_posts exists and is accessible
✅ All required columns present in learning_posts
🧪 Performing smoke tests...
✅ Smoke test passed for tweet_metrics
✅ Smoke test passed for learning_posts
✅ SCHEMA_VERIFY: All checks passed
🎉 Database schema is ready for xBOT operations
```

### 4. Environment Configuration

**Optional: Enable IPv4-only mode (if ENETUNREACH issues persist)**

Add to your Railway environment variables:

```
SUPABASE_IPV4_ONLY=true
```

**Required Environment Variables (should already be set):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_ANON_KEY` - Anon key for public operations
- `REDIS_URL` - Redis connection string for posting locks

### 5. Deploy and Start xBOT

Deploy to Railway as usual. The bot will automatically:

1. Run schema verification at startup
2. Initialize the new BrowserManager for stability
3. Use AdminClient for all database writes
4. Implement cadence gating to prevent spam

### 6. Verify Deployment Success

Monitor Railway logs for these key indicators:

```
✅ Environment validation passed
🗄️ Checking database schema...
SCHEMA_GUARD: schema ensure OK
DB: adminClient ready (service-role)
🏥 Health server listening on 0.0.0.0:8080
🤖 Starting autonomous posting engine...
CADENCE: bootstrap mode - first post
```

**No more repeated spam of:**
- ❌ "Minimum interval not met" every few seconds
- ❌ "Could not find column X in schema cache"
- ❌ "permission denied for table tweet_metrics"
- ❌ "browser.newContext: Target page, context or browser has been closed"

### 7. Functional Verification

**Test posting workflow:**

```bash
# Check health endpoints
curl https://your-app.railway.app/status
curl https://your-app.railway.app/env
curl https://your-app.railway.app/playwright

# If logs show successful posts, verify they include:
# - METRICS_UPSERT_OK logs
# - LEARNING_UPSERT_OK logs
# - No repeated "Minimum interval not met" spam
# - Replies show contextual mirroring of source tweets
# - Threads follow the new narrative structure
```

## New Features Implemented

### Database & Schema
- ✅ **Dual Supabase clients**: PublicClient (anon) and AdminClient (service-role)
- ✅ **IPv4 fallback**: Resolves ENETUNREACH issues with `SUPABASE_IPV4_ONLY=true`
- ✅ **Idempotent migrations**: Safe to run multiple times
- ✅ **Self-healing**: Automatic schema fixes on first column-not-found error
- ✅ **Graceful degradation**: Metrics failures don't crash posting

### Browser Reliability
- ✅ **BrowserManager singleton**: Eliminates context-closed errors
- ✅ **Auto-recovery**: Exponential backoff on browser failures
- ✅ **Circuit breaker**: Pause metrics tracking after 3 consecutive failures

### Cadence & Logging
- ✅ **CadenceGate**: Prevents redundant posting attempts during cooldown
- ✅ **Bootstrap mode**: More frequent posting for accounts with <5 total posts
- ✅ **Rate-limited logs**: No more spam of identical error messages

### Content Quality
- ✅ **Thread Composer v2**: Narrative-driven structure with hooks, steps, proof, pitfalls, CTAs
- ✅ **Reply Engine v2**: Contextual replies that mirror source tweet keywords
- ✅ **Quality Gate**: LLM-based scoring for hook strength, specificity, safety
- ✅ **Medical safety**: Blocks unsafe phrasing, treatment claims, diagnostic language

### Testing
- ✅ **Jest test suites**: Cadence logic, reply contextuality, quality gate thresholds
- ✅ **Schema verification**: Automated smoke tests for database operations

## Troubleshooting

### If `npm run verify:schema` fails:

1. Check environment variables are correctly set
2. Verify Supabase project is accessible
3. Re-run the migration SQL in Supabase SQL Editor
4. Check for any RLS policies blocking service_role access

### If posting fails with "permission denied":

1. Ensure SUPABASE_SERVICE_ROLE_KEY is set (not ANON key)
2. Verify RLS policies allow service_role access
3. Check Railway logs for AdminClient initialization

### If browser automation fails frequently:

1. Enable `PLAYWRIGHT_HEADLESS=false` for debugging
2. Set `PLAYWRIGHT_SLOW_MO=1000` to slow down actions
3. Check Railway memory limits (Playwright is memory-intensive)

### If cadence logic seems wrong:

1. Check `/tmp/cadence-state.json` for current state
2. Use `CadenceGate.reset()` method to clear state for testing
3. Verify `MIN_POST_INTERVAL_MINUTES` environment variable

## Success Metrics

**You'll know the implementation is working when:**

1. ✅ **No database permission errors** in logs
2. ✅ **Successful METRICS_UPSERT_OK** logs after posts
3. ✅ **No browser context-closed errors**
4. ✅ **Single-line cadence logs** (not spam every few seconds)
5. ✅ **Contextual replies** that reference source tweet content
6. ✅ **Structured threads** with clear hooks, steps, and CTAs
7. ✅ **Quality gate filtering** blocks low-quality content
8. ✅ **Medical safety** prevents unsafe health claims

## Monitoring Commands

```bash
# Test individual components
npm run test:cadence
npm run test:reply  
npm run test:quality

# Verify schema integrity
npm run verify:schema

# Manual migration (if needed)
npm run migrate:meta
```

The bot should now operate with significantly improved reliability, content quality, and database consistency while maintaining all existing functionality.
