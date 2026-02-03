# 🎯 HIGH-VOLUME AUTONOMOUS RATE CONTROLLER

**Date:** February 3, 2026  
**Status:** ✅ Implemented

---

## OVERVIEW

Autonomous rate controller that adapts posting/reply rates based on:
- Recent outcomes (yield)
- Recent failures (429, login walls, errors)
- Budgets remaining
- Backoff state

**Targets:**
- Replies: Up to 4/hour (96/day)
- Timeline posts: Up to 1/hour (24/day), peak burst 2/hour if safe

---

## ARCHITECTURE

### Components

1. **Rate Controller** (`src/rateController/rateController.ts`)
   - Computes hourly targets based on mode (WARMUP/GROWTH/COOLDOWN)
   - Pulls inputs from DB (outcomes, failures, budgets, backoff)
   - Stores state in `rate_controller_state` table

2. **Hourly Tick** (`src/rateController/hourlyTick.ts`)
   - Executes replies/posts with jitter spacing
   - Logs observability JSON

3. **Learning Loop** (`src/rateController/learningLoop.ts`)
   - Updates `outcome_score` for recent posts
   - Updates `strategy_weights`, `hour_weights`, `prompt_version_weights`

4. **Metadata Helpers** (`src/rateController/metadataHelpers.ts`)
   - Computes `hour_bucket` (ET timezone)
   - Extracts `prompt_version` and `strategy_id` from decisions

---

## DATABASE SCHEMA

### New Columns in `content_metadata`:
- `prompt_version TEXT` - Prompt/template version identifier
- `strategy_id TEXT` - Strategy identifier (e.g., "baseline", "high_topic_fit")
- `hour_bucket INTEGER` - Hour of day (0-23) when posted (America/New_York)
- `outcome_score NUMERIC` - Computed score: (likes + retweets*2 + replies*3 + bookmarks*0.5) / max(1, impressions)

### New Tables:
- `rate_controller_state` - Hourly targets and execution state
- `strategy_weights` - Learned weights for strategy selection
- `hour_weights` - Learned weights for hour-of-day optimization
- `prompt_version_weights` - Learned weights for prompt version selection

**Migration:** `supabase/migrations/20260203_rate_controller_schema.sql`

---

## MODES

### WARMUP (Default)
- Replies: 1/hour (peak), 0.5/hour (off-peak)
- Posts: 0/hour (ramp up after warmup period)
- Search: Allowed if budget available

### GROWTH
- Replies: Up to 4/hour (peak), 2/hour (off-peak)
- Posts: 1/hour (peak burst 2/hour if safe)
- Search: Allowed if budget available

### COOLDOWN
- Replies: 0/hour
- Posts: 0/hour
- Search: Disabled
- Triggered by: 429 errors OR login walls OR risk_score > 0.5

---

## SCHEDULING

### Hourly Tick
- Runs every hour (replaces 5-min posting queue)
- Spacing: Jittered ±5 minutes
- Timezone: America/New_York

### Peak Hours (50-80% reduction off-peak)
- 7-10am ET
- 12-2pm ET
- 6-10pm ET

### Learning Loop
- Runs daily (24 hours)
- Updates outcome scores and weights

---

## OBSERVABILITY

### Hourly JSON Log
```json
{
  "timestamp": "2026-02-03T14:00:00Z",
  "mode": "GROWTH",
  "targets": {
    "replies": 4,
    "posts": 1
  },
  "executed": {
    "replies": 3,
    "posts": 1
  },
  "risk": 0.15,
  "yield": 0.032,
  "budgets_remaining": {
    "nav": 15,
    "search": 1
  },
  "blocked_until": null
}
```

---

## TESTING

### 1. Apply Migration
```bash
# Via Supabase Dashboard SQL Editor
# Run: supabase/migrations/20260203_rate_controller_schema.sql
```

### 2. Verify Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'rate_controller_state',
  'strategy_weights',
  'hour_weights',
  'prompt_version_weights'
);
```

### 3. Test Rate Controller
```bash
# Compute targets for current hour
railway run pnpm exec tsx -e "
import { computeRateTargets } from './src/rateController/rateController.js';
const targets = await computeRateTargets();
console.log(JSON.stringify(targets, null, 2));
"
```

### 4. Test Hourly Tick
```bash
# Run hourly tick manually
railway run pnpm exec tsx -e "
import { executeHourlyTick } from './src/rateController/hourlyTick.js';
await executeHourlyTick();
"
```

### 5. Test Learning Loop
```bash
# Run learning loop manually
railway run pnpm exec tsx -e "
import { runLearningLoop } from './src/rateController/learningLoop.js';
await runLearningLoop();
"
```

### 6. Check Rate Controller State
```sql
SELECT * FROM rate_controller_state 
ORDER BY hour_start DESC 
LIMIT 10;
```

### 7. Check Weights
```sql
-- Strategy weights
SELECT * FROM strategy_weights ORDER BY weight DESC;

-- Hour weights
SELECT * FROM hour_weights ORDER BY hour_bucket;

-- Prompt version weights
SELECT * FROM prompt_version_weights ORDER BY weight DESC;
```

---

## CONFIGURATION

### Environment Variables
- `ENABLE_LEGACY_POSTING_QUEUE=true` - Re-enable 5-min posting queue (testing)
- `ENABLE_LEGACY_REPLY_SCHEDULER=true` - Re-enable reply_v2_scheduler (testing)

### Default Behavior
- Hourly tick replaces 5-min posting queue
- Reply scheduling handled by hourly tick
- Legacy schedulers disabled by default

---

## ANSWERS TO QUESTIONS

### A) Current Hard Schedulers
- **posting:** Every 5 min → **REPLACED** by hourly tick
- **reply_v2_scheduler:** Every 15 min → **DISABLED** (handled by hourly tick)
- **plan:** Every 60 min → **KEPT** (generates content)
- **metrics_scraper:** Every 20 min → **KEPT** (scrapes metrics)
- **analytics:** Every 6 hours → **KEPT** (analytics)

### B) Impressions Reliability
- ✅ **Yes, we can fetch impressions** via analytics page scraping
- **Proxy metric:** If impressions unavailable, use `(likes + retweets*2 + replies*3) / max(1, views)` where views is more reliably scraped
- **Current:** `outcome_score` uses impressions when available, falls back to engagement rate

### C) Timeline Posting Module
- ✅ **Exists:** `UltimateTwitterPoster.postTweet()` for single tweets
- ✅ **Threads:** `BulletproofThreadComposer.post()` for threads
- **Called from:** `postingQueue.ts` → `postContent()`
- **Status:** Complete, no changes needed

### D) DB Columns
- ✅ **prompt_version:** Added to `content_metadata` (extracted from `features.prompt_version` or generator_name)
- ✅ **strategy_id:** Added to `content_metadata` (extracted from `features.strategy_id` or generator_name)
- ✅ **hour_bucket:** Added to `content_metadata` (computed from `posted_at` in ET timezone)
- ✅ **outcome_score:** Added to `content_metadata` (computed by learning loop: `(likes + retweets*2 + replies*3 + bookmarks*0.5) / max(1, impressions)`)

---

## EVIDENCE

### Migration Applied
```sql
-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_metadata' 
AND column_name IN ('prompt_version', 'strategy_id', 'hour_bucket', 'outcome_score');
```

### Hourly Tick Running
```bash
# Check logs for hourly tick execution
railway logs -n 100 | grep HOURLY_TICK
```

### Rate Controller State
```sql
-- Check recent hourly targets
SELECT hour_start, mode, target_replies_this_hour, target_posts_this_hour, 
       executed_replies, executed_posts, risk_score, yield_score
FROM rate_controller_state 
ORDER BY hour_start DESC 
LIMIT 24;
```

---

## NEXT STEPS

1. ✅ Migration applied
2. ✅ Hourly tick integrated
3. ✅ Learning loop scheduled
4. ⏳ Monitor for 24 hours
5. ⏳ Adjust thresholds based on performance
6. ⏳ Ramp from WARMUP to GROWTH after stable period

---

**Status:** ✅ **IMPLEMENTED** - Ready for testing
