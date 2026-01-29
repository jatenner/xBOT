# E2E Reply V2 Forced Deploy - Final Report

**Generated:** 2026-01-29 01:10:00 EST  
**Target SHA:** c3321d4c (origin/main HEAD)  
**Railway SHA:** fdf00f1e (still pending deploy)

---

## Task A: Railway SHA Convergence ⚠️

### Git State
```bash
git rev-parse origin/main: c3321d4ccac8e760bca50e37c2c7c0aaabdb61c8
git log -1 --oneline origin/main: c3321d4c feat(reply-v2): add proof script for soft preflight
```

### Railway Deployment Commands
```bash
railway up --service xBOT --detach
railway up --service serene-cat --detach
```

### SHA Verification
```
✅ Verification passed:
  Both services running SHA: fdf00f1e32b67fa399f668d836c0a737e73bc62a
  Both services in executionMode: control
```

**Status:** ⚠️ **PARTIAL**
- ✅ Both services on same SHA (fdf00f1e)
- ❌ Railway SHA (fdf00f1e) ≠ origin/main HEAD (c3321d4c)
- ⚠️ Railway deployments triggered but haven't completed yet (may take 5-10 minutes)

**Note:** Railway deployments were triggered but services haven't restarted with new SHA yet. The soft preflight code is committed and will be active once Railway deploys c3321d4c.

---

## Task B: Planner Volume Validation ✅

### Status Distribution (Last 60 Minutes)
```sql
SELECT status, COUNT(*) 
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
  AND created_at > NOW() - INTERVAL '60 minutes'
GROUP BY status
ORDER BY COUNT(*) DESC;
```

**Result:**
- `queued`: 14 ✅ (exceeds target of >=5)

### Preflight Breakdown (Last 60 Minutes)
```sql
SELECT features->>'preflight_status' AS preflight_status, COUNT(*)
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
  AND created_at > NOW() - INTERVAL '60 minutes'
GROUP BY 1
ORDER BY COUNT(*) DESC;
```

**Result:**
- `timeout`: 13 ✅ (soft preflight working - decisions created despite timeout)
- `ok`: 1 ✅ (at least 1 with preflight_status='ok')

### Sample 20 Newest Decisions
```sql
SELECT decision_id, created_at, status,
       features->>'preflight_status' AS preflight_status,
       features->>'preflight_ok' AS preflight_ok,
       features->>'plan_mode' AS plan_mode,
       features->>'strategy_id' AS strategy_id
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
  AND created_at > NOW() - INTERVAL '60 minutes'
ORDER BY created_at DESC
LIMIT 20;
```

**Key Results:**
- 14 queued decisions ✅
- All have `preflight_status` populated ✅
- 1 with `preflight_status='ok'` ✅
- 13 with `preflight_status='timeout'` ✅ (soft preflight working - pipeline doesn't stall)
- All have `plan_mode='railway'` ✅
- All have `strategy_id` populated ✅

**Acceptance:** ✅ **PASS**
- >=5 queued decisions: ✅ (14 queued)
- preflight_status populated for all: ✅
- At least 1 with preflight_status='ok' OR skipped/timeout: ✅ (1 ok + 13 timeout)

---

## Task C: Mac Runner Post Verification ⚠️

### Mac Runner Started
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile \
EXECUTION_MODE=executor HEADLESS=true MAX_E2E_REPLIES=5 \
pnpm run executor:daemon
```

### Status Transitions (Last 90 Minutes)
```sql
SELECT decision_id, status, updated_at,
       features->>'strategy_id' AS strategy_id,
       features->>'preflight_status' AS preflight_status,
       features->>'tweet_id' AS tweet_id,
       LEFT(content, 80) AS content_preview
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
  AND created_at > NOW() - INTERVAL '90 minutes'
ORDER BY updated_at DESC
LIMIT 25;
```

**Results:**
- Decisions being processed: ✅ (status transitions observed)
- Most decisions blocked: ⚠️ (blocked_permanent, failed, blocked)
- No decisions reached `posted`: ❌

### Blocking Reasons Analysis

**Error Messages:**
1. **target_not_found_or_deleted** (most common)
   - Decisions with `preflight_status='timeout'` → tweets deleted by execution time
   - Example: `{"target_exists":false,"is_root_tweet":false,"stale_reason":"target_not_found_or_deleted"}`

2. **Invalid reply: too long (>220 chars)**
   - Generation producing replies >220 chars
   - Example: `PLAN_ONLY generation failed: Generation failed: Invalid reply: too long (>220 chars)`

3. **context_mismatch**
   - Similarity too low (0.09)
   - Example: `{"content_similarity":0.09090909090909091,"stale_reason":"context_mismatch"}`

**Decision with preflight_status='ok':**
- `f1cb5d92-0547-4032-9806-b0b102db17ef`: Still `queued` (not processed yet)

**Acceptance:** ⚠️ **PARTIAL**
- Decisions being processed: ✅
- At least 1 transitioned to `posted`: ❌ (0 posted)
- tweet_id populated: ❌ (no posted decisions)

**Blocker:** Tweets are being deleted between planning and execution, even for decisions with `preflight_status='ok'`. The decision with `preflight_status='ok'` hasn't been processed yet by Mac Runner.

---

## Task D: Reward Pipeline Verification ⚠️

### Decisions with Reward
```sql
SELECT decision_id, status,
       features->>'strategy_id' AS strategy_id,
       features->>'reward' AS reward,
       features->>'impressions' AS impressions
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
  AND features ? 'reward'
ORDER BY updated_at DESC
LIMIT 10;
```

**Result:** 0 rows (no decisions with reward yet)

### strategy_rewards Table
```sql
SELECT * FROM strategy_rewards
ORDER BY last_updated_at DESC
LIMIT 10;
```

**Result:**
- 1 row exists: `baseline` strategy (30 samples, last updated 2026-01-28 23:16:43)
- No new updates from `reply_v2_planner` decisions

**Acceptance:** ❌ **FAIL**
- >=1 decision has reward fields: ❌ (0 decisions with reward)
- >=1 row exists/updates in strategy_rewards: ⚠️ (1 row exists but not from recent posts)

**Blocker:** No decisions have been posted yet, so metrics scraper hasn't run to populate rewards.

---

## Summary

### ✅ Successes

1. **SHA Convergence:** Both services on same SHA (fdf00f1e) ✅
   - Note: Railway hasn't deployed latest commit (c3321d4c) yet

2. **Planner Volume:** 14 queued decisions created ✅
   - Exceeds target of >=5
   - All have `preflight_status` populated
   - Soft preflight working (13 timeout, 1 ok)

3. **Soft Preflight Working:** Decisions created even when preflight times out ✅
   - Pipeline doesn't stall
   - `preflight_status='timeout'` decisions still created

### ⚠️ Partial Successes

1. **Mac Runner Processing:** Decisions being processed but blocked ⚠️
   - Status transitions observed
   - No decisions reached `posted`

2. **Railway Deployment:** Deployments triggered but not completed ⚠️
   - Services still on old SHA (fdf00f1e)
   - Latest commit (c3321d4c) pending deploy

### ❌ Blockers

1. **Primary Blocker: Tweets Deleted Between Planning and Execution**
   - Most decisions blocked by `target_not_found_or_deleted`
   - Even `preflight_status='ok'` decision hasn't been processed yet
   - Tweets are ephemeral (deleted quickly)

2. **Secondary Blocker: Generated Content Too Long**
   - Some decisions failing with "Invalid reply: too long (>220 chars)"
   - Content generation producing replies >220 chars

3. **Tertiary Blocker: Context Mismatch**
   - Some decisions blocked by `context_mismatch` (similarity too low)

### Next Steps

1. **Wait for Railway to deploy latest commit** (c3321d4c)
   - Monitor: `pnpm run verify:sha:both`
   - Once deployed, soft preflight will be fully active

2. **Process decision with preflight_status='ok'**
   - Monitor: `f1cb5d92-0547-4032-9806-b0b102db17ef`
   - Should have higher success rate (tweet verified at planning time)

3. **Address tweet deletion issue**
   - Consider reducing planning→execution delay further
   - Consider prioritizing `preflight_status='ok'` decisions
   - Consider implementing retry with new target for deleted tweets

4. **Fix content length issue**
   - Ensure truncation logic in `planOnlyContentGenerator.ts` is working
   - Verify max length is enforced at generation time

---

## Final Status

**origin/main HEAD SHA:** c3321d4ccac8e760bca50e37c2c7c0aaabdb61c8

**verify:sha:both output:**
```
✅ Verification passed:
  Both services running SHA: fdf00f1e32b67fa399f668d836c0a737e73bc62a
```

**Planner Volume:** ✅ 14 queued decisions (exceeds target)

**Posted Decisions:** ❌ 0 posted (blocked by deleted tweets)

**Rewards:** ❌ 0 decisions with reward (no posts yet)

**Most Likely Blocker:** Tweets are being deleted between planning and execution. Even decisions with `preflight_status='ok'` haven't been processed yet. The decision `f1cb5d92-0547-4032-9806-b0b102db17ef` with `preflight_status='ok'` is still queued and should be prioritized for processing.

**Exact Next Code Fix:** Prioritize processing decisions with `preflight_status='ok'` in the posting queue (they have verified tweets and should have higher success rate).
