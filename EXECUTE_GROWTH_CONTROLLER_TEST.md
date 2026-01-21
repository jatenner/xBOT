# 🧪 Execute Growth Controller E2E Test

**Follow these steps in order. Paste back ONLY what's requested.**

---

## STEP 1: Apply Migration

### Method: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard:**
   - Go to your Supabase project
   - Click "SQL Editor" → "New query"

2. **View migration file:**
   ```bash
   cat supabase/migrations/20260114_growth_controller_tables.sql
   ```
   Copy the ENTIRE output.

3. **Paste and Run:**
   - Paste into Supabase SQL Editor
   - Click "Run" (or Cmd+Enter)
   - Wait for "Success" message

### Verification Query

**Run this in Supabase SQL Editor:**

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('growth_plans', 'growth_execution')
ORDER BY table_name;
```

**PASTE BACK ONLY THESE 2 LINES:**
```
table_name
-----------
growth_execution
growth_plans
```

**Also verify function:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'increment_growth_execution';
```

**PASTE BACK:** The `routine_name` value (should be `increment_growth_execution`)

---

## STEP 2: Generate Plan

### Command
```bash
pnpm run runner:shadow-controller-once
```

### PASTE BACK

**Paste this exact line from output:**
```
[GROWTH_CONTROLLER] ✅ Plan generated: X posts/h, Y replies/h (plan_id: ...)
```

**Also extract and paste the plan_id** (UUID format, e.g., `a1b2c3d4-e5f6-...`)

### Verification Query

**Run this in Supabase SQL Editor:**

```sql
SELECT 
  plan_id,
  window_start,
  window_end,
  target_posts,
  target_replies,
  resistance_backoff_applied,
  created_at
FROM growth_plans
ORDER BY window_start DESC
LIMIT 1;
```

**PASTE BACK:** The entire row (all columns)

---

## STEP 3: Enforcement Test

### Step 3a: Set Tiny Targets

**Replace `[PLAN_ID]` with actual plan_id from Step 2, then run:**

```sql
UPDATE growth_plans 
SET target_posts = 0, target_replies = 1
WHERE plan_id = '[PLAN_ID]';
```

**Verify:**
```sql
SELECT plan_id, target_posts, target_replies 
FROM growth_plans 
WHERE plan_id = '[PLAN_ID]';
```

**PASTE BACK:** Should show `target_posts = 0`, `target_replies = 1`

### Step 3b: Enable Controller and Run

**Set environment:**
```bash
export GROWTH_CONTROLLER_ENABLED=true
```

**Start CDP (Terminal 1):**
```bash
pnpm run runner:chrome-cdp
```
(Leave this running)

**Run posting (Terminal 2):**
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=true \
  tsx scripts/runner/schedule-once.ts
```

### PASTE BACK - Log Lines

**Look for and paste these 3 specific log lines:**

1. **Controller check (first attempt):**
   ```
   [GROWTH_CONTROLLER] ✅ Allowed: Within plan limits (plan_id: ...)
   ```

2. **Recorded after success:**
   ```
   [GROWTH_CONTROLLER] ✅ Recorded reply: plan_id=...
   ```

3. **Blocked (subsequent attempt):**
   ```
   [GROWTH_CONTROLLER] ⛔ BLOCKED: Reply limit reached: 1/1
   ```

**If any are missing, paste what you see instead**

### Step 3c: Verify Counters

**Run this SQL:**

```sql
SELECT 
  ge.plan_id,
  ge.posts_done,
  ge.replies_done,
  ge.last_updated,
  gp.target_posts,
  gp.target_replies
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE ge.plan_id = '[PLAN_ID]';
```

**PASTE BACK:** The entire row - should show `replies_done = 1`, `posts_done = 0`

### Step 3d: Test Idempotency

**Rerun the same posting command:**
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=true \
  tsx scripts/runner/schedule-once.ts
```

**Then check counters again:**
```sql
SELECT posts_done, replies_done, last_updated
FROM growth_execution
WHERE plan_id = '[PLAN_ID]';
```

**PASTE BACK:** The row - counters should be unchanged (still `replies_done = 1`)

---

## STEP 4: Disable Test

### Change Environment
```bash
export GROWTH_CONTROLLER_ENABLED=false
```

### Run Posting
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=false \
  tsx scripts/runner/schedule-once.ts
```

### PASTE BACK - Log Line

**Look for this log line:**
```
[RATE_LIMIT] ⏸️  Reply rate limit reached (X/4 this hour)
```
or
```
[RATE_LIMIT] ⏸️  Post rate limit reached (X/2 this hour)
```

**PASTE BACK:** The `[RATE_LIMIT]` line you see

**Verify counters unchanged:**
```sql
SELECT posts_done, replies_done 
FROM growth_execution 
WHERE plan_id = '[PLAN_ID]';
```

**PASTE BACK:** Should still be `replies_done = 1`, `posts_done = 0`

---

## STEP 5: Backoff Test

### Step 5a: Simulate Resistance

```bash
tsx scripts/test-resistance-signals.ts CONSENT_WALL 6
```

### PASTE BACK

**Paste this line:**
```
✅ Inserted 6 mock CONSENT_WALL events
```

### Step 5b: Generate Plan

```bash
pnpm run runner:shadow-controller-once
```

### PASTE BACK - Log Lines

**Paste these 3 lines:**
```
[GROWTH_CONTROLLER] ⚠️ Platform resistance detected: CONSENT_WALL threshold exceeded: 6 in last hour (threshold: 5)
[GROWTH_CONTROLLER] 📉 Applying backoff: X → Y posts, Z → W replies
[GROWTH_CONTROLLER] ✅ Plan generated: Y posts/h, W replies/h (plan_id: ...)
```

### Step 5c: Verify Backoff

**Run this SQL:**

```sql
SELECT 
  plan_id,
  target_posts,
  target_replies,
  resistance_backoff_applied,
  backoff_reason,
  reason_summary
FROM growth_plans
ORDER BY window_start DESC
LIMIT 1;
```

**PASTE BACK:** The entire row - should show:
- `resistance_backoff_applied = true`
- `backoff_reason` contains "CONSENT_WALL"
- `target_posts` and `target_replies` reduced

---

## Once You've Pasted All Results

I'll:
1. Update the test report with your results
2. Diagnose any failures
3. Fix code if needed
4. Generate final report

**Start with STEP 1 and paste back the verification results!**
