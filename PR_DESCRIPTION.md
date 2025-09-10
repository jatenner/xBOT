# Production-Grade OpenAI Budget & Reliability Fixes

## Summary

This PR implements production-grade fixes to enforce a hard $5/day OpenAI spending cap with strict budget controls, eliminates JSON parsing errors, improves Playwright reliability, and ensures proper database/TLS configuration.

## Key Issues Resolved

1. **Budget Overruns** - Spending exceeded $5 with 0 posts due to retries, warmups, and pipeline tests consuming budget without production value
2. **JSON Parse Failures** - `JSON_PARSE_ERROR: Unterminated string` causing fallback content generation and budget drain  
3. **Database Insert Failures** - `message: undefined` errors preventing cost logging
4. **TLS Configuration Issues** - `self-signed certificate in certificate chain` blocking migrations
5. **Playwright Reliability** - `COMPOSER_NOT_FOCUSED` and infinite retry loops

## Changes Made

### 🔒 **Atomic Budget Gate**
- **`src/budget/atomicBudgetGate.ts`** - Redis Lua scripts for race-condition-free budget enforcement
- `ensureBudget(intent, cost)` - Check before every LLM call
- `commitCost(intent, actualCost)` - Atomic cost tracking with `INCRBYFLOAT`
- Hard $5/day cap with detailed logging (`intent`, `estimated_cost`, `actual_cost`)

### 📝 **Strict JSON Enforcement** 
- **`src/services/openAIService.ts`** - Force `response_format: json_schema { strict: true }` for content generation
- **`src/ai/followerGrowthContentEngine.ts`** - Remove JSON repair logic, fail fast on invalid JSON
- **`src/errors/InvalidJsonError.ts`** - Typed error for JSON failures  
- `max_tokens >= 800` to prevent truncation, truncation guard throws on `finish_reason: 'length'`

### 🚫 **Production Cost Controls**
- **`src/config/featureFlags.ts`** - Feature flags to disable costly operations:
  - `PIPELINE_TESTS_ENABLED=false` - Disable test endpoints
  - `ALLOW_FALLBACK_GENERATION=false` - No fallback content on JSON failures
  - `ALLOW_LLM_CACHE_WARMUP=false` - Disable smart cache LLM calls
- **`src/utils/pipelineTest.ts`** - Gate pipeline tests behind feature flag
- **`src/lib/smartCacheManager.ts`** - Skip cache warming if disabled

### 🗄️ **Database & TLS Fixes**
- **`src/db/supabaseService.ts`** - Service role client for writes, bypasses RLS
- **`supabase/migrations/20250910_api_usage.sql`** - Proper `api_usage` table with schema + RLS
- **`scripts/setup-ssl-cert.sh`** - Download Supabase CA certificate
- **`Dockerfile`** - Install SSL certificates during Railway build
- Consistent `sslmode=require` across runtime and migrations

### 🎭 **Playwright Bounded Retries**
- **`src/posting/bulletproofTwitterComposer.ts`** - Max 2 attempts, no escalation
- Navigate to `https://x.com/compose/tweet` for reliability
- X/Twitter Q3 2025 selectors: `data-testid="tweetTextarea_0"`
- Block `**/*analytics*` requests to reduce noise
- Throw `COMPOSER_NOT_AVAILABLE` on final failure (no infinite loops)

### 🚀 **Integration & Monitoring**
- **`src/main-bulletproof.ts`** - Enhanced startup logging with budget status and feature flags
- All LLM call sites updated to use `ensureBudget()` / `commitCost()`
- Service role client for reliable cost logging to Supabase

## Files Changed

### New Files
- `src/budget/atomicBudgetGate.ts` - Atomic Redis budget enforcement
- `src/config/featureFlags.ts` - Production feature flag system  
- `src/errors/InvalidJsonError.ts` - Typed JSON error handling
- `src/db/supabaseService.ts` - Service role database client
- `supabase/migrations/20250910_api_usage.sql` - API usage table schema
- `scripts/setup-ssl-cert.sh` - SSL certificate setup
- `Dockerfile` - Railway deployment with SSL

### Updated Files
- `src/services/openAIService.ts` - Atomic budget integration + strict JSON
- `src/ai/followerGrowthContentEngine.ts` - Remove JSON repair, strict parsing
- `src/posting/bulletproofTwitterComposer.ts` - Bounded retries + current selectors
- `src/content/EnhancedContentGenerator.ts` - Budget gate integration
- `src/utils/pipelineTest.ts` - Feature flag gate
- `src/lib/smartCacheManager.ts` - Feature flag for warmups  
- `src/main-bulletproof.ts` - Enhanced startup logging
- `env.template` - Production environment variables

## Environment Variables Required

```bash
# Production Budget Controls
PIPELINE_TESTS_ENABLED=false
ALLOW_FALLBACK_GENERATION=false  
ALLOW_LLM_CACHE_WARMUP=false
DAILY_OPENAI_LIMIT_USD=5

# Database SSL Configuration
DB_SSL_MODE=require
DB_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt
MIGRATION_SSL_MODE=require
MIGRATION_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt

# Supabase Service Role for Writes
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## How to Verify

### 1. **Startup Logs Should Show:**
```
🏁 FEATURE_FLAGS:
   PIPELINE_TEST_ENABLED: false
   ALLOW_FALLBACK_GENERATION: false
   ALLOW_LLM_CACHE_WARMUP: false
   POSTING_DISABLED: false
   DAILY_OPENAI_LIMIT_USD: $5

💰 BUDGET_KEY: prod:openai_cost:2025-09-10
💰 BUDGET_STATUS: $0.0000 / $5.0000 (5.0000 remaining)
🛡️ BUDGET_GATE: ENABLED

🔐 SERVICE_ROLE_KEY: PRESENT
🔒 DATABASE_SSL: require ✅
✅ DATABASE_CONNECTION: Service role client working
```

### 2. **Follower Content Generation:**
```bash
curl -X POST /api/generate-content
```
**Expected logs:**
```
💰 BUDGET_GATE: OK intent=follower_growth_content est=$0.0045 current=$0.0000
✅ CONTENT_GENERATED: Using strict JSON schema with max_tokens=400
💰 BUDGET_COMMIT: actual=$0.0045 total=$0.0045 intent=follower_growth_content
📊 API_USAGE_LOGGED: follower_growth_content $0.0045
```
**No JSON_PARSE_ERROR or JSON_REPAIR_ERROR logs**

### 3. **Budget Enforcement Test:**
```bash
# Temporarily set low budget limit
export DAILY_OPENAI_LIMIT_USD=0.01
```
**Expected:** Calls blocked with `BUDGET_EXCEEDED` after $0.01 spent

### 4. **Playwright Posting:**
```bash
curl -X POST /api/test-post -d '{"content":"Test post"}'
```
**Expected logs:**
```
🎯 COMPOSER_ATTEMPT: 1/2
✅ COMPOSER_FOUND: Element located successfully
✅ CONTENT_ENTERED: 9 characters typed  
✅ BULLETPROOF_SUCCESS: Post submitted successfully
```

### 5. **Feature Flag Verification:**
- Pipeline test endpoints return `{ skipped: true, reason: 'pipeline_tests_disabled' }`
- Cache warming logs show `⏭️ SMART_CACHE: Cache warming disabled`
- JSON failures throw `InvalidJsonError` instead of generating fallback content

## Expected Impact

- **✅ Zero budget overruns** - Hard $5/day cap with atomic enforcement
- **✅ Zero JSON parse errors** - Strict schema eliminates malformed responses  
- **✅ Reliable database logging** - Service role client ensures cost tracking
- **✅ Stable Playwright posting** - Bounded retries prevent infinite loops
- **✅ Secure TLS connections** - Proper SSL for all database operations
- **📈 Improved reliability** - Production-grade error handling and monitoring

## Deployment Notes

1. **Railway:** Dockerfile automatically downloads SSL certificates during build
2. **Environment:** Ensure all required environment variables are set
3. **Migration:** Run `supabase migration up` to create `api_usage` table
4. **Monitoring:** Check startup logs for proper configuration
5. **Testing:** Verify budget gate with low limit before production deployment
