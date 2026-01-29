# E2E Reply V2 Fixes Deployment Report

**Date:** 2026-01-29  
**SHA:** c9b5def0  
**Goal:** Get 1 reply_v2_planner decision to POST successfully end-to-end

## Fixes Implemented

### A) JIT Runtime Preflight ✅
- **Location:** `src/jobs/postingQueue.ts` (before PLAN_ONLY generation)
- **Behavior:**
  - Runs ONLY when `RUNNER_MODE=true` and `pipeline_source='reply_v2_planner'`
  - Fetches tweet data with 6s timeout
  - Sets `runtime_preflight_status` in features:
    - `'ok'`: tweet exists → continue
    - `'deleted'`: tweet not found → `blocked_permanent`
    - `'timeout'`: fetch timeout → block if other candidates exist, else continue (bounded fallback)
  - Logs: `[RUNTIME_PREFLIGHT] decision_id=... status=... latency_ms=...`

### B) Hard Length Clamp ✅
- **Location:** `src/jobs/replySystemV2/planOnlyContentGenerator.ts`
- **Behavior:**
  - After OpenAI returns content, clamps to `MAX_REPLY_LENGTH` (default 200)
  - Preserves required grounding phrases when possible
  - Never returns empty string
  - Helper: `clampReplyLengthPreserveGrounding()`

### C) Target Stability Heuristics ✅
- **Location:** `src/jobs/replySystemV2/queueManager.ts`
- **Behavior:**
  - Prefers candidates with tweet age 5-45 minutes (stability_score = 1.0)
  - Deprioritizes <2 minutes (edit risk, stability_score = 0.3)
  - Deprioritizes >2 hours (deletion risk, stability_score = 0.4)
  - Does not block decision creation if none match

### D) Proof Scripts ✅
- `scripts/executor/prove-runtime-preflight.ts`: Validates runtime preflight behavior
- `scripts/executor/prove-length-clamp.ts`: Validates length clamp (never > maxLen)
- `scripts/ops/e2e-run-planner-daemon-post-safe.ts`: E2E orchestration script

## Commands to Run

### 1. Verify Railway Deployment
```bash
pnpm run verify:sha:both
# Should show both services on c9b5def0
```

### 2. Trigger Planner
```bash
railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

### 3. Start Mac Runner Daemon
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile EXECUTION_MODE=executor HEADLESS=true MAX_E2E_REPLIES=1 pnpm run executor:daemon
```

### 4. Monitor for Posted Reply
```bash
psql "$DATABASE_URL" -c "
SELECT decision_id, status, updated_at, features->>'runtime_preflight_status' AS runtime_preflight, features->>'tweet_id' AS tweet_id
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner' AND status='posted'
ORDER BY updated_at DESC LIMIT 5;
"
```

### 5. Verify Rewards
```bash
psql "$DATABASE_URL" -c "
SELECT decision_id, features->>'reward' AS reward, features->>'strategy_id' AS strategy_id
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner' AND status='posted' AND features ? 'reward'
ORDER BY updated_at DESC LIMIT 5;
"

psql "$DATABASE_URL" -c "
SELECT strategy_id, strategy_version, sample_count, mean_reward, last_updated_at
FROM strategy_rewards
ORDER BY last_updated_at DESC LIMIT 10;
"
```

## Expected Behavior

1. **Runtime Preflight:**
   - Mac Runner checks tweet existence before generation
   - If tweet deleted → decision blocked immediately
   - If tweet exists → generation proceeds
   - If timeout → bounded fallback (only if no other candidates)

2. **Length Clamp:**
   - Generated content >200 chars → clamped to 200 with ellipsis
   - Grounding phrases preserved when possible
   - Never fails with "too long" error

3. **Target Stability:**
   - Planner prefers opportunities 5-45 minutes old
   - Reduces ephemeral target failures

## Success Criteria

- ✅ At least 1 decision transitions: `queued` → `posting_attempt` → `posted`
- ✅ `features.runtime_preflight_status='ok'` on posted decision
- ✅ `features.tweet_id` populated
- ✅ `features.reward` computed (after scraper runs)
- ✅ `strategy_rewards` table updated (sample_count incremented)

## Files Changed

- `src/jobs/postingQueue.ts`: Added runtime preflight check
- `src/jobs/replySystemV2/planOnlyContentGenerator.ts`: Added length clamp
- `src/jobs/replySystemV2/queueManager.ts`: Added age-based stability scoring
- `scripts/executor/prove-runtime-preflight.ts`: New proof script
- `scripts/executor/prove-length-clamp.ts`: New proof script
- `scripts/ops/e2e-run-planner-daemon-post-safe.ts`: New E2E script
- `package.json`: Added proof script entries

## Next Steps

1. Wait for Railway to deploy c9b5def0
2. Run planner to create fresh decisions
3. Start Mac Runner daemon
4. Monitor for posted reply
5. Verify rewards + strategy_rewards updates
