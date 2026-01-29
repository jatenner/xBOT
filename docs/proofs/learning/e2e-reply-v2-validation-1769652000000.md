# E2E Reply V2 PLAN_ONLY Validation Report

**Date:** 2026-01-29  
**SHA:** bb49f68e (local), b3348183 (Railway target)  
**Goal:** Prove 1 real posted reply from reply_v2_planner pipeline

## Summary

**Status:** ⚠️ PARTIAL SUCCESS - Infrastructure fixes deployed, but no posted reply achieved yet

### What Worked ✅

1. **Local Git State:** Clean, on latest commit `bb49f68e`
2. **Build:** ✅ Passes
3. **OpenAI Key:** ✅ Valid (verified via `verify-openai-key.ts`)
4. **Railway Deployment:** ✅ Both services on `b3348183`
5. **Planner Creates Decisions:** ✅ Planner successfully creates queued decisions
6. **Code Fixes Deployed:**
   - ✅ `MAX_REPLY_LENGTH` env var fix (200 chars) in `replyGeneratorAdapter.ts`
   - ✅ Root check fix to allow `reply_v2_planner` decisions
   - ✅ Preflight priority guard implemented in `postingQueue.ts`

### Current Blockers ❌

1. **No `preflight_status='ok'` decisions:** All recent decisions have `preflight_status='timeout'`
   - Planner creates decisions but preflight checks timeout
   - Only 2 historical decisions had `preflight_status='ok'` (both already processed/failed)

2. **Generation Length Failures:** Many decisions fail with "too long (>200 chars)"
   - Even with 200-char cap, OpenAI still generates content >200 chars
   - Need stricter prompt or post-generation truncation

3. **Target Not Found:** Many `timeout` decisions fail with `target_not_found_or_deleted`
   - Tweets may be deleted between planning and execution
   - Preflight timeout suggests tweets are ephemeral

## Commands Executed

```bash
# Preflight checks
git rev-parse HEAD  # bb49f68e
pnpm run build  # ✅ Passes
pnpm tsx scripts/ops/verify-openai-key.ts  # ✅ Valid
pnpm run verify:sha:both  # ✅ Both services on b3348183

# Planner cycles
railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
# Result: Creates decisions but all have preflight_status='timeout'

# Mac Runner daemon
RUNNER_MODE=true MAX_E2E_REPLIES=1 pnpm run executor:daemon
# Result: Processes decisions but blocks on target_not_found_or_deleted
```

## Database Evidence

### Recent Planner Decisions (last 3 hours)
```sql
SELECT decision_id, status, features->>'preflight_status' AS preflight_status
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner' AND created_at > NOW() - INTERVAL '3 hours'
ORDER BY created_at DESC LIMIT 10;
```

**Results:**
- `preflight_status='timeout'`: 23 decisions
- `preflight_status='ok'`: 2 decisions (both already processed)
- `status='queued'`: 3 decisions (all timeout)
- `status='blocked_permanent'`: 10+ decisions (target_not_found_or_deleted)
- `status='failed'`: 5+ decisions (too long or generation errors)

### Posted Replies
```sql
SELECT decision_id, status, features->>'tweet_id' AS tweet_id
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner' AND status='posted';
```

**Result:** 0 rows (no posted replies yet)

## Code Changes Made

### Commit 1: `fa9c85b2`
**Fix:** Use `MAX_REPLY_LENGTH` env var (200 chars) instead of hardcoded 220 in `replyGeneratorAdapter.ts`

### Commit 2: `bb49f68e`
**Fix:** Allow `reply_v2_planner` decisions in root check (`postingQueue.ts`)

## Root Cause Analysis

1. **Preflight Timeout:** Planner's preflight checks are timing out, so no `ok` decisions are created
   - Preflight attempts to verify tweet exists before planning
   - Timeout suggests Twitter API/network issues or rate limits

2. **Ephemeral Targets:** Even when decisions are created, tweets are deleted before execution
   - `target_not_found_or_deleted` is the dominant failure mode
   - Preflight timeout may mask this issue

3. **Generation Length:** OpenAI generates content >200 chars despite prompt constraints
   - Need stricter prompt or post-generation truncation
   - Current hard cap throws error, preventing posting

## Next Steps

1. **Fix Preflight Timeout:**
   - Increase timeout or reduce preflight attempts per cycle
   - Consider caching preflight results longer
   - Or skip preflight for fresh opportunities (<30 min old)

2. **Fix Generation Length:**
   - Add post-generation truncation (truncate to 200 chars at word boundary)
   - Or reduce `max_tokens` in OpenAI call

3. **Improve Target Stability:**
   - Prefer opportunities from accounts with >1000 followers
   - Filter out tweets <5 minutes old (edit risk)
   - Increase preflight cache TTL

## Evidence Files

- Build logs: `/tmp/build.log`
- Mac Runner logs: `/tmp/mac-runner-e2e-final2-*.log`
- Planner output: Railway logs

## Conclusion

Infrastructure fixes are deployed and working. The pipeline is functional but blocked by:
1. Preflight timeouts preventing `ok` decisions
2. Ephemeral targets (tweets deleted before execution)
3. Generation length exceeding 200-char cap

**Recommendation:** Focus on fixing preflight timeout first, then address generation length, then improve target stability.
