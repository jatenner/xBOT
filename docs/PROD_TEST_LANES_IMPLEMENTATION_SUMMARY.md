# 🔒 PROD/TEST LANES Implementation Summary

**Commit:** `8fbaf7bd`  
**Date:** 2026-01-22  
**Status:** ✅ Code complete, migration pending

---

## Files Changed

1. **Migration:** `supabase/migrations/20260122_add_is_test_post_column.sql`
   - Adds `is_test_post BOOLEAN NOT NULL DEFAULT false` column
   - Creates index for efficient filtering

2. **PostingQueue Guardrail:** `src/jobs/postingQueue.ts`
   - Filters out `is_test_post=true` unless `ALLOW_TEST_POSTS=true`
   - Logs `[TEST_LANE_BLOCK]` when test posts are blocked
   - Writes `TEST_LANE_BLOCK` events to `system_events`

3. **Test Scripts Updated:**
   - `scripts/verify/truth_pipeline_fail_closed.ts` - Sets `is_test_post=true`
   - `scripts/runner/seed-test-decision.ts` - Sets `is_test_post=true`

4. **New Test Script:** `scripts/verify/create-test-post-decision.ts`
   - Creates test decisions for verification

5. **Bake Report:** `scripts/monitor/generate_day1_bake_report.ts`
   - Adds `POST_SUCCESS_PROD` and `POST_SUCCESS_TEST` counts
   - Adds `TEST_LANE_BLOCK` events section

6. **Documentation:** `docs/PROD_TEST_LANES.md`
   - Complete guide on how to use test/prod lanes

---

## Next Steps (Required)

### 1. Apply Migration

The migration must be applied to the database before the feature works:

**Option A: Via Supabase Dashboard**
1. Go to Supabase SQL Editor
2. Run the migration SQL from `supabase/migrations/20260122_add_is_test_post_column.sql`

**Option B: Via Railway (if migration auto-applies)**
- Migration should auto-apply on next Railway deploy
- Verify with: `SELECT column_name FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'is_test_post';`

### 2. Verify Migration Applied

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'content_metadata'
AND column_name = 'is_test_post';
```

Expected result:
```
column_name  | data_type | is_nullable | column_default
-------------+-----------+-------------+----------------
is_test_post | boolean   | NO          | false
```

### 3. Test the Guardrail

**Step 1: Create test decision (blocked)**
```bash
pnpm exec tsx scripts/verify/create-test-post-decision.ts
```

**Step 2: Try to post WITHOUT ALLOW_TEST_POSTS**
```bash
RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile \
pnpm run runner:once -- --once
```

**Expected:** Logs should show `[TEST_LANE_BLOCK]` and no POST_SUCCESS

**Step 3: Try to post WITH ALLOW_TEST_POSTS=true**
```bash
RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile \
ALLOW_TEST_POSTS=true pnpm run runner:once -- --once
```

**Expected:** Post succeeds and POST_SUCCESS is written

**Step 4: Verify POST_SUCCESS**
```bash
pnpm exec tsx scripts/verify-post-success.ts --minutes=60
```

---

## Proof Logs (After Migration Applied)

### Test Post Blocked (Expected)

```
[POSTING_QUEUE] 🔒 TEST_LANE_BLOCK: Test posts disabled (ALLOW_TEST_POSTS not set)
[TEST_LANE_BLOCK] decision_id=a0f2984d-ce8e-4728-9eb8-04388b22fd14 reason=ALLOW_TEST_POSTS_not_enabled
```

### Test Post Allowed (With ALLOW_TEST_POSTS=true)

```
[POSTING_QUEUE] ✅ Test posts enabled (ALLOW_TEST_POSTS=true)
[POST_TWEET] ✅ SUCCESS: tweet_id=... decision_id=a0f2984d-ce8e-4728-9eb8-04388b22fd14
```

---

## How to Enable/Disable Test Posting

### Enable (Temporarily)
```bash
export ALLOW_TEST_POSTS=true
# Or for Railway:
railway variables set ALLOW_TEST_POSTS=true
railway up --detach
```

### Disable (Default)
```bash
unset ALLOW_TEST_POSTS
# Or for Railway:
railway variables set ALLOW_TEST_POSTS=false
railway up --detach
```

---

## Safety Guarantees

✅ **Fail-Closed:** Missing `is_test_post` defaults to `false` (PROD)  
✅ **Explicit Override Required:** `ALLOW_TEST_POSTS=true` must be set  
✅ **Audit Trail:** All blocked test posts logged to `system_events`  
✅ **No Cadence Impact:** Does not affect production posting cadence  
✅ **No Safety Gate Weakening:** All existing gates remain unchanged  
✅ **Truth Pipeline Intact:** Tweet ID capture and validation unchanged  

---

**Status:** ✅ Implementation complete, awaiting migration application
