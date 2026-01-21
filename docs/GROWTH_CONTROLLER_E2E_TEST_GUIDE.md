# 🧪 Growth Controller E2E Test Guide

**Purpose:** Validate Growth Controller end-to-end without breaking CDP posting.

---

## STEP 1: Apply Migration

### Option A: Supabase Dashboard (EASIEST)

1. **Go to Supabase Dashboard:**
   - Navigate to your project's SQL Editor

2. **Open SQL Editor:**
   - Click "SQL Editor" → "New query"

3. **Copy Migration SQL:**
   ```bash
   cat supabase/migrations/20260114_growth_controller_tables.sql
   ```
   Copy the entire contents.

4. **Paste and Run:**
   - Paste into SQL Editor
   - Click "Run" (or Cmd+Enter)
   - Wait for "Success" message

### Option B: Direct psql (If you have DB credentials)

```bash
# Get connection string from Supabase Dashboard
# Settings > Database > Connection String (Direct connection)

psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/20260114_growth_controller_tables.sql
```

### Verify Migration Applied

**Run this SQL in Supabase Dashboard:**

```sql
-- Check tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('growth_plans', 'growth_execution')
ORDER BY table_name;
```

**Expected Output:**
```
table_name          | column_count
--------------------+--------------
growth_execution    | 5
growth_plans        | 12
```

**Also verify function exists:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'increment_growth_execution';
```

**Expected Output:**
```
routine_name
-------------------
increment_growth_execution
```

**Paste the results here:** [PASTE RESULTS]

---

## STEP 2: Generate a Plan

### Command to Run

```bash
pnpm run runner:shadow-controller-once
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           🎭 SHADOW CONTROLLER (ONE TIME)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[GROWTH_CONTROLLER] 🎭 Generating shadow plan...
[GROWTH_CONTROLLER] ✅ Plan generated: X posts/h, Y replies/h (plan_id: ...)
[GROWTH_CONTROLLER] 📝 Explanation: ...
```

**Paste the full output here:** [PASTE OUTPUT]

### Verify Plan in Database

**Run this SQL:**

```sql
SELECT 
  plan_id,
  window_start,
  window_end,
  target_posts,
  target_replies,
  feed_weights,
  strategy_weights,
  exploration_rate,
  resistance_backoff_applied,
  backoff_reason,
  reason_summary,
  created_at
FROM growth_plans
ORDER BY window_start DESC
LIMIT 1;
```

**Expected:**
- `window_start` and `window_end` should be current hour boundaries
- `target_posts` and `target_replies` should be integers (1-4 and 2-8 typically)
- `feed_weights` should be JSONB with 4 keys
- `strategy_weights` should be JSONB with topics/formats/generators
- `resistance_backoff_applied` should be false (unless resistance detected)

**Paste the results here:** [PASTE RESULTS]

---

## STEP 3: Enforcement Test (Safe Tiny Targets)

### Set Environment Variables

```bash
export GROWTH_CONTROLLER_ENABLED=true
```

### Set Tiny Targets for Current Hour

**First, get the current hour's plan_id:**

```sql
SELECT plan_id, window_start, window_end
FROM growth_plans
WHERE window_start <= NOW()
  AND window_end >= NOW()
ORDER BY window_start DESC
LIMIT 1;
```

**Copy the plan_id, then update targets:**

```sql
-- Replace [PLAN_ID] with actual plan_id from above
UPDATE growth_plans 
SET target_posts = 0, target_replies = 1
WHERE plan_id = '[PLAN_ID]';
```

**Verify update:**
```sql
SELECT plan_id, target_posts, target_replies 
FROM growth_plans 
WHERE plan_id = '[PLAN_ID]';
```

**Expected:** `target_posts = 0`, `target_replies = 1`

**Paste the plan_id and verification here:** [PASTE RESULTS]

### Run One-Shot Posting (CDP Runner)

**Ensure Chrome CDP is running:**
```bash
# In a separate terminal, start CDP
pnpm run runner:chrome-cdp
```

**Then run posting:**
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=true \
  tsx scripts/runner/one-shot.ts
```

**Or if you have a simpler posting test script:**
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=true \
  tsx scripts/runner/schedule-once.ts
```

### Expected Logs

**Look for these log messages:**

1. **Controller enabled:**
   ```
   [GROWTH_CONTROLLER] ✅ Allowed: Within plan limits (plan_id: ...)
   ```

2. **First reply allowed:**
   ```
   [GROWTH_CONTROLLER] ✅ Allowed: Within plan limits
   [POSTING_QUEUE] ✅ Reply posted successfully
   [GROWTH_CONTROLLER] ✅ Recorded reply: plan_id=...
   ```

3. **Subsequent replies blocked:**
   ```
   [GROWTH_CONTROLLER] ⛔ BLOCKED: Reply limit reached: 1/1
   ```

4. **Posts blocked:**
   ```
   [GROWTH_CONTROLLER] ⛔ BLOCKED: Post limit reached: 0/0
   ```

**Paste relevant log lines here:** [PASTE LOGS]

### Verify Execution Counters

**Run this SQL:**

```sql
SELECT 
  ge.plan_id,
  ge.posts_done,
  ge.replies_done,
  ge.last_updated,
  gp.target_posts,
  gp.target_replies,
  (gp.target_posts - ge.posts_done) AS posts_remaining,
  (gp.target_replies - ge.replies_done) AS replies_remaining
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE ge.plan_id = '[PLAN_ID]';
```

**Expected:**
- `replies_done` should be exactly `1`
- `posts_done` should be `0`
- `replies_remaining` should be `0`
- `posts_remaining` should be `0`

**Paste the results here:** [PASTE RESULTS]

### Test Idempotency

**Rerun the posting command again (same command as above):**

```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=true \
  tsx scripts/runner/schedule-once.ts
```

**Check counters again:**
```sql
SELECT posts_done, replies_done, last_updated
FROM growth_execution
WHERE plan_id = '[PLAN_ID]';
```

**Expected:**
- Counters should NOT increment (still `replies_done = 1`, `posts_done = 0`)
- `last_updated` may change, but counters should be idempotent

**Paste the results here:** [PASTE RESULTS]

---

## STEP 4: Disable Test

### Set Environment Variable

```bash
export GROWTH_CONTROLLER_ENABLED=false
# or
unset GROWTH_CONTROLLER_ENABLED
```

### Run Same Posting Command

```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
  GROWTH_CONTROLLER_ENABLED=false \
  tsx scripts/runner/schedule-once.ts
```

### Expected Behavior

**Look for these log messages:**

1. **No controller check:**
   - Should NOT see `[GROWTH_CONTROLLER]` logs
   - Should see `[RATE_LIMIT]` logs instead

2. **Rate limiter used:**
   ```
   [RATE_LIMIT] ⏸️  Reply rate limit reached (X/4 this hour)
   ```
   or
   ```
   [RATE_LIMIT] ⏸️  Post rate limit reached (X/2 this hour)
   ```

3. **Execution counters NOT updated:**
   - `growth_execution` counters should remain unchanged

**Paste relevant log lines here:** [PASTE LOGS]

**Verify execution counters unchanged:**
```sql
SELECT posts_done, replies_done, last_updated
FROM growth_execution
WHERE plan_id = '[PLAN_ID]';
```

**Paste the results here:** [PASTE RESULTS]

---

## STEP 5: Backoff Test (Safe Simulation)

### Create Simulation Script

**Create file:** `scripts/test-resistance-signals.ts`

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🧪 Simulating platform resistance signals...');
  
  // Insert mock CONSENT_WALL events
  const now = new Date();
  const events = [];
  
  for (let i = 0; i < 6; i++) {
    events.push({
      event_type: 'CONSENT_WALL',
      severity: 'warning',
      message: `Test: Consent wall ${i + 1}`,
      event_data: { test: true, simulated: true },
      created_at: new Date(now.getTime() - i * 10 * 60 * 1000).toISOString(), // Spread over last hour
    });
  }
  
  const { error } = await supabase.from('system_events').insert(events);
  
  if (error) {
    console.error(`❌ Failed to insert events: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Inserted ${events.length} mock CONSENT_WALL events`);
  console.log('💡 Now run: pnpm run runner:shadow-controller-once');
  console.log('💡 Expected: Plan should have resistance_backoff_applied=true');
}

main();
```

**Add to package.json:**
```json
"runner:test-resistance": "tsx scripts/test-resistance-signals.ts"
```

### Run Simulation

```bash
tsx scripts/test-resistance-signals.ts
```

**Expected Output:**
```
🧪 Simulating platform resistance signals...
✅ Inserted 6 mock CONSENT_WALL events
💡 Now run: pnpm run runner:shadow-controller-once
```

**Paste the output here:** [PASTE OUTPUT]

### Generate Plan with Backoff

```bash
pnpm run runner:shadow-controller-once
```

**Expected Output:**
```
[GROWTH_CONTROLLER] ⚠️ Platform resistance detected: CONSENT_WALL threshold exceeded: 6 in last hour (threshold: 5)
[GROWTH_CONTROLLER] 📉 Applying backoff: X → Y posts, Z → W replies
[GROWTH_CONTROLLER] ✅ Plan generated: Y posts/h, W replies/h (plan_id: ...)
```

**Paste the output here:** [PASTE OUTPUT]

### Verify Backoff in Plan

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

**Expected:**
- `resistance_backoff_applied` = `true`
- `backoff_reason` contains "CONSENT_WALL threshold exceeded"
- `target_posts` and `target_replies` should be reduced (approximately 50% of normal)

**Paste the results here:** [PASTE RESULTS]

### Cleanup Test Events (Optional)

```sql
DELETE FROM system_events 
WHERE event_type = 'CONSENT_WALL' 
  AND event_data->>'simulated' = 'true';
```

---

## Final Verification Checklist

- [ ] Migration applied successfully (tables exist)
- [ ] Plan generated (growth_plans has row)
- [ ] Enforcement works (tiny targets block correctly)
- [ ] Execution counters increment (idempotent)
- [ ] Disable works (falls back to rate limiter)
- [ ] Backoff works (resistance signals trigger reduction)

---

## Troubleshooting

### Migration Fails

**Error:** "relation already exists"
- Tables may already exist - check with verification SQL
- If they exist, migration is already applied

**Error:** "permission denied"
- Use Supabase Dashboard SQL Editor (has full permissions)
- Or ensure using service role key

### Plan Not Generated

**Check:**
- Reward data exists? (`reward_features` table has rows)
- Database connection working?
- Check logs for errors

**Debug:**
```sql
SELECT COUNT(*) FROM reward_features;
SELECT COUNT(*) FROM daily_aggregates;
```

### Enforcement Not Working

**Check:**
- `GROWTH_CONTROLLER_ENABLED=true` set?
- Active plan exists for current hour?
- Check logs for `[GROWTH_CONTROLLER]` messages

**Debug:**
```sql
-- Check if plan exists
SELECT * FROM growth_plans 
WHERE window_start <= NOW() AND window_end >= NOW();

-- Check execution
SELECT * FROM growth_execution 
WHERE plan_id = (SELECT plan_id FROM growth_plans WHERE window_start <= NOW() AND window_end >= NOW() LIMIT 1);
```

### Counters Not Incrementing

**Check:**
- `recordPost()` called after successful post?
- Check logs for `[GROWTH_CONTROLLER] ✅ Recorded` messages
- Verify function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'increment_growth_execution';`

---

## Next Steps After Validation

Once all tests pass:
1. ✅ Enable in production: `GROWTH_CONTROLLER_ENABLED=true`
2. ✅ Monitor plans and execution for 24 hours
3. ✅ Verify enforcement working correctly
4. ✅ Tune heuristics based on results
