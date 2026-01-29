# E2E Reply V2 PLAN_ONLY Pipeline - Forced Deployment Report

**Generated:** 2026-01-29 00:27:00 EST  
**Latest Commit:** 0d1d97f8 (preflight timeout increase)  
**Railway SHA:** 2cd09365 ✅ (deployed successfully)

---

## Task A: Force Railway Deployment ✅

### Git State Verification
```bash
git rev-parse HEAD: 2cd09365c5105c1bc3398a7163b1dae99af1b57e
git log -1: 2cd09365 feat(reply-v2): add preflight proof of existence storage and verification
```

### Railway Deployment
```bash
railway up --detach
```

### SHA Convergence Verification
```
✅ Verification passed:
  Both services running SHA: 2cd09365c5105c1bc3398a7163b1dae99af1b57e
  Both services in executionMode: control
```

**Status:** ✅ **SUCCESS** - Both Railway services deployed to SHA 2cd09365

---

## Task B: Force Planner Cycle ⚠️

### Planner Script Created
**File:** `scripts/ops/run-reply-v2-planner-once.ts`
- Invokes `attemptScheduledReply()` exactly once
- Runs in PLAN_ONLY mode on Railway
- Verifies decisions created with preflight proof

### Execution Results
**Command:** `railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts`

**Result:** ❌ **PREFLIGHT_TIMEOUT**

**Details:**
- Planner found candidates (tier 3)
- Preflight check timed out (15s timeout)
- Error: "Shell present but tweet missing" - tweets likely deleted
- 0 decisions created

**Attempts:**
1. First run: Candidate `2016640751795400960` - PREFLIGHT_TIMEOUT (8s)
2. Second run: Candidate `2016654292120183164` - PREFLIGHT_TIMEOUT (8s)
3. Third run: Candidate `2016656684853432684` - PREFLIGHT_TIMEOUT (15s)

### SQL Verification Queries

**Status Distribution:**
```sql
SELECT status, COUNT(*) FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
AND created_at > NOW() - INTERVAL '60 minutes'
GROUP BY status;
```

**Result:**
- `blocked_permanent`: 6
- `failed`: 4
- `blocked`: 3
- `queued`: 0 ❌

**Recent Decisions:**
```sql
SELECT decision_id, created_at, status,
       features->>'preflight_ok' AS preflight_ok,
       features->>'preflight_text_hash' AS preflight_text_hash,
       features->>'strategy_id' AS strategy_id,
       scheduled_at
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
AND created_at > NOW() - INTERVAL '60 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

**Result:** All decisions have `preflight_ok=null` (created before preflight proof implementation)

**Acceptance Criteria:** ❌ **NOT MET**
- Required: >=5 queued decisions with `preflight_ok='true'`
- Actual: 0 queued decisions

---

## Task C: Mac Runner Consumption ⏳

**Daemon Status:** Running (`/tmp/mac-runner-e2e-final.log`)

**Monitoring Query:**
```sql
SELECT decision_id, status, updated_at,
       features->>'strategy_id' AS strategy_id,
       features->>'preflight_ok' AS preflight_ok,
       features->>'tweet_id' AS tweet_id,
       LEFT(content, 80) AS preview
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
AND created_at > NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC
LIMIT 20;
```

**Result:** No decisions reached `posting_attempt` or `posted` status

**Acceptance Criteria:** ❌ **NOT MET**
- Required: At least 1 decision reaches `posting_attempt` then `posted` with `tweet_id`
- Actual: 0 decisions posted

---

## Task D: Error Logging ✅

### System Events Added
**Event Types:**
1. `reply_v2_planner_no_candidates` - Logs when no candidates found
2. `reply_v2_planner_preflight_failed` - Logs preflight failures with error type

**Implementation:**
- Added to `src/jobs/replySystemV2/tieredScheduler.ts`
- Logs queue size, tier distribution, denied tweet IDs
- Logs preflight error type (timeout vs other)

**Status:** ✅ **IMPLEMENTED** (commit c6ef9aed)

---

## Root Cause Analysis

### Primary Blocker: Preflight Timeout
**Issue:** Preflight check times out (15s) because tweets are deleted or protected

**Evidence:**
- Error: "Shell present but tweet missing"
- All candidates fail preflight check
- No decisions created with `preflight_ok=true`

**Possible Causes:**
1. Tweets deleted between queue evaluation and preflight check
2. Protected/locked accounts
3. Browser navigation issues on Railway
4. Rate limiting or consent walls

### Secondary Blocker: No Fresh Candidates
**Issue:** Queue has only tier 3 candidates, all failing preflight

**Evidence:**
- Queue size: 2 candidates (both tier 3)
- No tier 1 or tier 2 candidates available
- Harvester creating opportunities but not being evaluated into queue

---

## Recommendations

1. **Skip Preflight for Tier 3 Candidates** (temporary workaround)
   - Allow preflight to fail gracefully for tier 3
   - Create decision anyway with `preflight_ok=false`
   - Let Mac Runner verify at posting time

2. **Refresh Candidate Queue**
   - Run `refreshCandidateQueue()` before planner
   - Ensure fresh opportunities are evaluated

3. **Increase Harvester Frequency**
   - More opportunities = better chance of live tweets
   - Filter out protected accounts earlier

4. **Monitor Preflight Success Rate**
   - Track `preflight_ok=true` vs `preflight_ok=false` decisions
   - Adjust timeout or skip logic based on success rate

---

## Final Status

**Railway Deployment:** ✅ **SUCCESS** (SHA 2cd09365)  
**Planner Execution:** ⚠️ **PARTIAL** (runs but no decisions created)  
**Preflight Proof:** ❌ **BLOCKED** (all preflight checks timeout)  
**Mac Runner Consumption:** ⏳ **WAITING** (no queued decisions to process)  
**Posted Replies:** ❌ **0** (no decisions reached posted status)  
**Rewards:** ⏳ **PENDING** (no posts to reward)

**Next Steps:**
1. Investigate why preflight checks timeout (tweets deleted? browser issues?)
2. Consider skipping preflight for tier 3 candidates as temporary workaround
3. Refresh candidate queue to get fresher candidates
4. Monitor Mac Runner logs for any queued decisions
