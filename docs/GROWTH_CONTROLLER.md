# 🎯 Growth Controller

**Purpose:** Enforced policy control for cadence, sourcing, and strategy (when `GROWTH_CONTROLLER_ENABLED=true`).

---

## Overview

The Growth Controller promotes the Shadow Controller into an **enforced policy system** that governs:
- **Cadence** (posts/hour, replies/hour)
- **Sourcing weights** (curated/keyword/viral/discovered feeds)
- **Strategy weights** (topics, formats, generators)

**Key Principle:** Controller controls **policy decisions** (rates, weights, selection), NOT low-level mechanics (CDP connect, retries, DOM selectors).

---

## Architecture

### What is AI-Controlled vs Deterministic

**AI-Controlled (Policy):**
- ✅ Posting/reply cadence (targets per hour)
- ✅ Feed sourcing weights
- ✅ Strategy weights (topics, formats, generators)
- ✅ Exploration rate
- ✅ Platform resistance backoff

**Deterministic (Mechanics):**
- ✅ CDP browser connection
- ✅ Retry logic
- ✅ DOM selectors
- ✅ Error handling
- ✅ Database transactions
- ✅ Safety envelope enforcement

**Safety Guarantee:** Even if controller recommends extreme values, hard safety envelopes prevent violations.

---

## How Plans Are Generated

### Hourly Plan Generation

**Job:** `shadowControllerJob.ts` (runs hourly)

**Process:**
1. **Analyze Rewards:** Last 24-72h reward trends
2. **Check Resistance:** Platform signals (CONSENT_WALL, POST_FAIL, CHALLENGE)
3. **Compute Recommendations:**
   - Posts/hour: Based on trend (+1 if increasing, -1 if decreasing)
   - Replies/hour: Same heuristic
   - Feed weights: Heuristic-based (no LLM)
   - Strategy weights: From daily aggregates (last 7 days)
4. **Apply Backoff:** If resistance detected, reduce targets by 50%
5. **Store Plan:** Write to `growth_plans` table

**Heuristic-Based (No LLM):**
- Reward trend analysis (simple comparison)
- Feed weight defaults (no LLM needed)
- Strategy weights from data (daily aggregates)
- Platform resistance detection (count thresholds)

**LLM Use (If Needed):**
- Only for complex strategy analysis (future enhancement)
- Must propose policy within envelope
- Code validates all recommendations

---

## How Plans Are Enforced

### Posting Queue Enforcement

**File:** `src/jobs/postingQueue.ts`

**Process:**
1. Before posting, check `canPost()` from `growthController.ts`
2. If controller enabled and plan exists:
   - Check execution counters vs plan targets
   - Block if limit reached
3. If controller disabled:
   - Fall back to rate limiter (existing behavior)
4. After successful post:
   - Call `recordPost()` to increment counters

**Code Flow:**
```typescript
// Check before posting
const controllerCheck = await canPost(decision.decision_type);
if (!controllerCheck.allowed) {
  return false; // Block
}

// ... post content ...

// Record after success
await recordPost(plan.plan_id, decision.decision_type);
```

### Reply Orchestrator Enforcement

**File:** `src/jobs/replySystemV2/orchestrator.ts`

**Process:**
1. Get feed weights from active plan (if enabled)
2. Use plan weights to select candidates
3. Log which feed was used per candidate

**Code Flow:**
```typescript
if (GROWTH_CONTROLLER_ENABLED) {
  feedWeights = await getFeedWeights(); // From active plan
} else {
  feedWeights = defaults; // Fallback
}
```

---

## Safety Envelope

### Hard Limits

Even if controller recommends extreme values, these limits are enforced:

**Global Caps:**
- `SHADOW_MIN_POSTS_PER_HOUR` (default: 1)
- `SHADOW_MAX_POSTS_PER_HOUR` (default: 4)
- `SHADOW_MIN_REPLIES_PER_HOUR` (default: 2)
- `SHADOW_MAX_REPLIES_PER_HOUR` (default: 8)

**Cooldowns:**
- Platform resistance backoff (automatic -50% reduction)
- Minimum targets (never below 1 post, 1 reply)

**Fail-Closed Behavior:**
- If controller check fails → fall back to rate limiter
- If plan not found → use defaults (don't block)
- If execution counter fails → allow (best effort)

---

## Platform Resistance Backoff

### Signals Detected

1. **CONSENT_WALL:** Count in last hour
   - Threshold: `RESISTANCE_CONSENT_WALL_THRESHOLD` (default: 5)
   - Action: Reduce targets by 50%

2. **POST_FAIL Bursts:** Count in last hour
   - Threshold: `RESISTANCE_POST_FAIL_THRESHOLD` (default: 10)
   - Action: Reduce targets by 50%

3. **CHALLENGE:** Any challenges detected
   - Action: Reduce targets by 50%

### Backoff Logic

```typescript
if (resistance.shouldBackoff) {
  finalPostsRec = Math.max(1, Math.floor(postsRecommendation * 0.5));
  finalRepliesRec = Math.max(1, Math.floor(repliesRecommendation * 0.5));
  backoffApplied = true;
  backoffReason = resistance.reason;
}
```

**Minimums:** Always at least 1 post, 1 reply (or system can choose to halt safely).

---

## Database Schema

### `growth_plans`

**Columns:**
- `plan_id` (UUID) - Primary key
- `window_start`, `window_end` (TIMESTAMPTZ) - Hour window
- `target_posts`, `target_replies` (INTEGER) - Cadence targets
- `feed_weights` (JSONB) - Sourcing weights
- `strategy_weights` (JSONB) - Strategy weights
- `exploration_rate` (NUMERIC) - 0.0 to 0.3
- `reason_summary` (TEXT) - Explanation
- `resistance_backoff_applied` (BOOLEAN) - Backoff flag
- `backoff_reason` (TEXT) - Why backoff was applied

**Unique Constraint:** `window_start` (one plan per hour)

### `growth_execution`

**Columns:**
- `plan_id` (UUID) - References `growth_plans`
- `posts_done` (INTEGER) - Posts executed this hour
- `replies_done` (INTEGER) - Replies executed this hour
- `last_updated` (TIMESTAMPTZ) - Last update time

**Idempotent Increments:** Uses `increment_growth_execution()` function

---

## Enabling/Disabling

### Enable Controller

```bash
# Set environment variable
export GROWTH_CONTROLLER_ENABLED=true

# Or in .env file
GROWTH_CONTROLLER_ENABLED=true
```

**Behavior:**
- Plans are enforced
- Posting/reply limits from plans
- Feed weights from plans
- Execution counters tracked

### Disable Controller

```bash
# Set to false or unset
export GROWTH_CONTROLLER_ENABLED=false
# or
unset GROWTH_CONTROLLER_ENABLED
```

**Behavior:**
- Plans still generated (shadow mode)
- Falls back to rate limiter
- Uses default feed weights
- No execution tracking

---

## Testing

### 1. Generate Plan

```bash
pnpm run runner:shadow-controller-once
```

**Verify:**
```sql
SELECT * FROM growth_plans ORDER BY window_start DESC LIMIT 1;
```

### 2. Test Enforcement (Tiny Targets)

**Set tiny targets in plan:**
```sql
UPDATE growth_plans 
SET target_posts = 0, target_replies = 1
WHERE plan_id = '...';
```

**Enable controller:**
```bash
export GROWTH_CONTROLLER_ENABLED=true
```

**Run posting queue:**
- Should only allow 1 reply
- Should block all posts
- Verify execution counters increment

**Verify:**
```sql
SELECT * FROM growth_execution WHERE plan_id = '...';
```

### 3. Test Disable

```bash
export GROWTH_CONTROLLER_ENABLED=false
```

**Run posting queue:**
- Should use rate limiter (existing behavior)
- Should not check plan limits
- Should not record execution

### 4. Test Feed Weights

**Modify plan feed weights:**
```sql
UPDATE growth_plans 
SET feed_weights = '{"curated_accounts": 0.8, "keyword_search": 0.2, "viral_watcher": 0.0, "discovered_accounts": 0.0}'::jsonb
WHERE plan_id = '...';
```

**Run reply orchestrator:**
- Should use 80% curated, 20% keyword
- Logs should show feed selection

---

## Querying Plans and Execution

### Get Active Plan

```sql
SELECT * FROM growth_plans
WHERE window_start <= NOW()
  AND window_end >= NOW()
ORDER BY window_start DESC
LIMIT 1;
```

### Get Execution Status

```sql
SELECT 
  gp.plan_id,
  gp.target_posts,
  gp.target_replies,
  ge.posts_done,
  ge.replies_done,
  (gp.target_posts - ge.posts_done) AS posts_remaining,
  (gp.target_replies - ge.replies_done) AS replies_remaining
FROM growth_plans gp
LEFT JOIN growth_execution ge ON gp.plan_id = ge.plan_id
WHERE gp.window_start <= NOW()
  AND gp.window_end >= NOW()
ORDER BY gp.window_start DESC
LIMIT 1;
```

### Get Recent Plans with Backoff

```sql
SELECT 
  window_start,
  target_posts,
  target_replies,
  resistance_backoff_applied,
  backoff_reason,
  reason_summary
FROM growth_plans
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY window_start DESC;
```

---

## Monitoring

### Check if Controller is Active

```sql
SELECT 
  COUNT(*) as active_plans,
  MAX(window_start) as latest_plan
FROM growth_plans
WHERE window_start <= NOW()
  AND window_end >= NOW();
```

### Check Execution vs Targets

```sql
SELECT 
  gp.window_start,
  gp.target_posts,
  gp.target_replies,
  ge.posts_done,
  ge.replies_done,
  CASE 
    WHEN ge.posts_done >= gp.target_posts THEN 'LIMIT_REACHED'
    ELSE 'OK'
  END as posts_status,
  CASE 
    WHEN ge.replies_done >= gp.target_replies THEN 'LIMIT_REACHED'
    ELSE 'OK'
  END as replies_status
FROM growth_plans gp
LEFT JOIN growth_execution ge ON gp.plan_id = ge.plan_id
WHERE gp.window_start >= NOW() - INTERVAL '24 hours'
ORDER BY gp.window_start DESC;
```

---

## Troubleshooting

### Controller Not Enforcing

**Check:**
1. `GROWTH_CONTROLLER_ENABLED=true` set?
2. Active plan exists for current hour?
3. Execution counters incrementing?

**Debug:**
```sql
-- Check if plan exists
SELECT * FROM growth_plans WHERE window_start <= NOW() AND window_end >= NOW();

-- Check execution
SELECT * FROM growth_execution ORDER BY last_updated DESC LIMIT 5;
```

### Plans Not Generated

**Check:**
1. Shadow controller job running?
2. Reward data available?
3. Database connection working?

**Debug:**
```sql
-- Check recent plans
SELECT * FROM growth_plans ORDER BY created_at DESC LIMIT 5;

-- Check system events
SELECT * FROM system_events WHERE event_type = 'SHADOW_PLAN' ORDER BY created_at DESC LIMIT 5;
```

### Feed Weights Not Applied

**Check:**
1. Controller enabled?
2. Plan has feed_weights?
3. Orchestrator using getFeedWeights()?

**Debug:**
- Check orchestrator logs for feed weight selection
- Verify plan.feed_weights is not null

---

## Next Steps

1. **Monitor:** Watch plans and execution for 1 week
2. **Tune:** Adjust heuristics based on results
3. **Enhance:** Add more sophisticated learning (if needed, with LLM bounds)
4. **Optimize:** Fine-tune backoff thresholds

---

## Safety Reminders

- ✅ Controller controls policy, NOT mechanics
- ✅ Hard safety envelopes always enforced
- ✅ Fail-closed behavior (falls back on errors)
- ✅ Kill switch available (`GROWTH_CONTROLLER_ENABLED=false`)
- ✅ Testable and reversible
