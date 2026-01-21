# 🧪 Growth Controller Test - Exact Commands

**Quick reference for E2E testing**

---

## STEP 1: Apply Migration

### Option A: Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → SQL Editor → New query
2. Copy contents of: `supabase/migrations/20260114_growth_controller_tables.sql`
3. Paste and Run

### Option B: Direct psql

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260114_growth_controller_tables.sql
```

### Verify

```sql
-- Run in Supabase Dashboard SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('growth_plans', 'growth_execution');

SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'increment_growth_execution';
```

**Expected:** 2 tables, 1 function

---

## STEP 2: Generate Plan

```bash
pnpm run runner:shadow-controller-once
```

### Verify

```sql
SELECT plan_id, window_start, window_end, target_posts, target_replies, 
       feed_weights, strategy_weights, resistance_backoff_applied
FROM growth_plans
ORDER BY window_start DESC
LIMIT 1;
```

**Copy the `plan_id` for next step**

---

## STEP 3: Enforcement Test

### Set Tiny Targets

```sql
-- Replace [PLAN_ID] with actual plan_id from Step 2
UPDATE growth_plans 
SET target_posts = 0, target_replies = 1
WHERE plan_id = '[PLAN_ID]';
```

### Enable Controller

```bash
export GROWTH_CONTROLLER_ENABLED=true
```

### Run Posting (CDP Required)

**Terminal 1 (CDP):**
```bash
pnpm run runner:chrome-cdp
```

**Terminal 2 (Posting):**
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=true \
  tsx scripts/runner/schedule-once.ts
```

### Expected Logs

Look for:
- `[GROWTH_CONTROLLER] ✅ Allowed: Within plan limits` (first reply)
- `[GROWTH_CONTROLLER] ⛔ BLOCKED: Reply limit reached: 1/1` (subsequent)
- `[GROWTH_CONTROLLER] ✅ Recorded reply: plan_id=...`

### Verify Counters

```sql
SELECT posts_done, replies_done 
FROM growth_execution 
WHERE plan_id = '[PLAN_ID]';
```

**Expected:** `replies_done = 1`, `posts_done = 0`

### Test Idempotency

**Rerun same posting command, then check counters again:**

```sql
SELECT posts_done, replies_done 
FROM growth_execution 
WHERE plan_id = '[PLAN_ID]';
```

**Expected:** Counters unchanged (still `replies_done = 1`)

---

## STEP 4: Disable Test

```bash
export GROWTH_CONTROLLER_ENABLED=false
```

**Run same posting command:**
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=false \
  tsx scripts/runner/schedule-once.ts
```

### Expected

- Should see `[RATE_LIMIT]` logs (not `[GROWTH_CONTROLLER]`)
- Execution counters unchanged

---

## STEP 5: Backoff Test

### Simulate Resistance

```bash
tsx scripts/test-resistance-signals.ts CONSENT_WALL 6
```

### Generate Plan

```bash
pnpm run runner:shadow-controller-once
```

### Verify Backoff

```sql
SELECT resistance_backoff_applied, backoff_reason, target_posts, target_replies
FROM growth_plans
ORDER BY window_start DESC
LIMIT 1;
```

**Expected:** `resistance_backoff_applied = true`, targets reduced

### Cleanup (Optional)

```sql
DELETE FROM system_events 
WHERE event_data->>'simulated' = 'true';
```

---

## Quick Verification Queries

### Check Active Plan
```sql
SELECT * FROM growth_plans
WHERE window_start <= NOW() AND window_end >= NOW();
```

### Check Execution
```sql
SELECT ge.*, gp.target_posts, gp.target_replies
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE gp.window_start <= NOW() AND gp.window_end >= NOW();
```

### Check Recent Plans
```sql
SELECT window_start, target_posts, target_replies, 
       resistance_backoff_applied, backoff_reason
FROM growth_plans
ORDER BY window_start DESC
LIMIT 5;
```

---

## Troubleshooting

**Plan not found:** Delete existing plan for current hour:
```sql
DELETE FROM growth_plans 
WHERE window_start <= NOW() AND window_end >= NOW();
```

**Counters not incrementing:** Check function exists:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'increment_growth_execution';
```

**Controller not enforcing:** Verify env var:
```bash
echo $GROWTH_CONTROLLER_ENABLED
# Should output: true
```
