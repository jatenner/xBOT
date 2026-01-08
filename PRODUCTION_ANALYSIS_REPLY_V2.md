# 📊 PRODUCTION ANALYSIS: REPLY SYSTEM V2 + HARDENING

**Date:** January 8, 2026  
**Analysis Window:** Last 6 hours + 24 hours summary  
**Status:** 🔴 **CRITICAL - SYSTEM NOT RUNNING**

---

## A) EXECUTIVE SUMMARY

1. **🔴 SYSTEM INACTIVE:** No Reply System V2 activity detected in last 6 hours (0 evaluations, 0 SLO events, 0 replies via tiered_scheduler)
2. **⚠️ JOBS SCHEDULED BUT NOT EXECUTING:** Jobs are scheduled in `jobManager.ts` but producing zero activity (likely failing silently or not starting)
3. **📊 NO BASELINE DATA:** Cannot assess SLO performance, supply funnel, or quality outcomes (system never ran)
4. **🔧 IMMEDIATE ACTION REQUIRED:** Check Railway logs for job execution errors, verify imports work, test job execution manually
5. **🚀 OLD SYSTEM STILL ACTIVE:** Old reply system (`replyJob.ts`) is still running (1,250 SLO violations logged today) - Reply System V2 is parallel but inactive

---

## B) METRICS TABLE

| Metric | Last 6h | Last 24h | All Time | Status |
|--------|---------|----------|----------|--------|
| **SLO Performance** |
| Total SLO slots | 0 | 0 | 0 | ❌ No data |
| Posted successfully | 0 | 0 | 0 | ❌ No data |
| Missed slots | 0 | 0 | 0 | ❌ No data |
| Miss rate | N/A | N/A | N/A | ❌ No data |
| **Supply Funnel** |
| Candidates evaluated | 0 | 0 | 0 | ❌ No data |
| Passed filters | 0 | 0 | 0 | ❌ No data |
| Queue size (current) | 0 | N/A | 0 | ❌ Empty |
| Avg queue size | N/A | N/A | N/A | ❌ No data |
| Min queue size | N/A | N/A | N/A | ❌ No data |
| Tier distribution | N/A | N/A | N/A | ❌ No data |
| **Quality Outcomes** |
| Replies with 24h metrics | 0 | 0 | 0 | ❌ No data |
| Success rate (>=1000 views) | N/A | N/A | N/A | ❌ No data |
| Median views_24h | N/A | N/A | N/A | ❌ No data |
| Tier 1 performance | N/A | N/A | N/A | ❌ No data |
| Tier 2 performance | N/A | N/A | N/A | ❌ No data |
| Tier 3 performance | N/A | N/A | N/A | ❌ No data |

---

## C) ROOT CAUSES (RANKED BY IMPACT)

### 🔴 CRITICAL: System Not Running

**Root Cause #1: Environment Variables Not Loaded**
- **Frequency:** 100% (all jobs inactive)
- **Impact:** CRITICAL - System completely non-functional
- **Evidence:**
  - Manual test shows: `ZodError: DATABASE_URL Required, SUPABASE_URL Required, SUPABASE_SERVICE_ROLE_KEY Required`
  - 0 candidate evaluations in last 6 hours
  - 0 SLO events logged
  - 0 replies posted via Reply System V2
  - Queue is empty (0 candidates)
- **Root Cause:** Jobs are scheduled but failing silently due to missing environment variables
- **Fix Required:** Ensure `.env` is loaded OR Railway env vars are set correctly

**Root Cause #2: No Historical Data**
- **Frequency:** 100% (no baseline)
- **Impact:** HIGH - Cannot assess system performance
- **Evidence:**
  - No candidate evaluations ever created
  - No SLO events ever logged
  - No replies posted via Reply System V2
- **Possible Causes:**
  1. System just deployed (needs time to run)
  2. Jobs never started
  3. Initialization script not run

---

## D) TOP 10 FIXES (RANKED)

### 🔴 PRIORITY 1: Get System Running

**Fix #1: Fix Environment Variable Loading**
- **Expected Impact:** CRITICAL - Jobs will start running
- **Files:** `src/jobs/replySystemV2/orchestrator.ts`, Railway environment variables
- **Action:** 
  - ✅ Root cause identified: Missing DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  - Ensure Railway has these env vars set
  - OR add `import 'dotenv/config'` at top of orchestrator.ts
  - Test: Jobs should start executing after fix
- **Rollout:** Immediate (set env vars OR add dotenv import)
- **Rollback:** Remove dotenv import if Railway vars are set

**Fix #2: Add Job Execution Logging**
- **Expected Impact:** CRITICAL - See what's happening when jobs run
- **Files:** `src/jobs/replySystemV2/orchestrator.ts`, `src/jobs/replySystemV2/tieredScheduler.ts`
- **Action:**
  - Add `console.log('[REPLY_V2] Job started...')` at entry points
  - Add `system_events` logging for job start/completion
  - Wrap all imports in try-catch with error logging
  - Log to `system_events` table for visibility
- **Rollout:** Immediate (code change + deploy)
- **Rollback:** Revert logging changes

**Fix #3: Add Environment Variable Validation**
- **Expected Impact:** HIGH - Fail fast with clear errors
- **Files:** `src/jobs/replySystemV2/orchestrator.ts`
- **Action:**
  - Add env var check at start of `runFullCycle()`
  - Log missing vars to `system_events` if missing
  - Throw clear error message
- **Rollout:** Immediate (code change)
- **Rollback:** Remove validation

**Fix #4: Verify Curated Accounts**
- **Expected Impact:** HIGH - Ensure feed has accounts to fetch from
- **Files:** `scripts/init-reply-system-v2.ts`
- **Action:**
  - ✅ Sources exist (verified: 3 sources enabled)
  - ⚠️ Check curated accounts count (may be too low - only 5 seeded)
  - Expand to 50+ accounts if count is low
  - Verify accounts are health-focused and active
- **Rollout:** Immediate (check count, expand if needed)
- **Rollback:** N/A

**Fix #5: Add Job Health Monitoring**
- **Expected Impact:** HIGH - Detect job failures early
- **Files:** `src/jobs/jobManager.ts`, `src/jobs/replySystemV2/main.ts`
- **Action:**
  - Add `system_events` logging for job start/completion
  - Add error logging with stack traces
  - Add job execution time tracking
- **Rollout:** Immediate (code change + deploy)
- **Rollback:** Revert changes

### ⚠️ PRIORITY 2: Supply Funnel (Once Running)

**Fix #6: Expand Curated Accounts**
- **Expected Impact:** HIGH - Increase candidate supply
- **Files:** `scripts/init-reply-system-v2.ts`
- **Action:**
  - Expand `CURATED_ACCOUNTS` from 5 to 200-500 accounts
  - Focus on high-signal health accounts
  - Add accounts from different categories (experts, influencers, researchers)
- **Rollout:** Gradual (add 50 accounts at a time)
- **Rollback:** Remove accounts from list

**Fix #7: Increase Feed Frequency**
- **Expected Impact:** MEDIUM - More candidates per hour
- **Files:** `src/jobs/replySystemV2/orchestrator.ts`
- **Action:**
  - Reduce fetch interval from 5min to 3min (if rate limits allow)
  - Or increase tweets per account/keyword
- **Rollout:** Test with one feed first
- **Rollback:** Revert interval changes

**Fix #8: Adjust Queue TTL**
- **Expected Impact:** MEDIUM - Keep more candidates available
- **Files:** `src/jobs/replySystemV2/queueManager.ts`
- **Action:**
  - Increase base TTL from 60min to 90min
  - Reduce velocity-based TTL reduction
- **Rollout:** Gradual (monitor queue size)
- **Rollback:** Revert TTL calculation

**Fix #9: Lower Tier 3 Threshold (If Behind Schedule)**
- **Expected Impact:** MEDIUM - More candidates eligible
- **Files:** `src/jobs/replySystemV2/tieredScheduler.ts`
- **Action:**
  - Allow Tier 3 (>=500 views) even when not behind schedule
  - Or reduce Tier 3 threshold to >=300 views
- **Rollout:** Test for 24h, monitor quality
- **Rollback:** Revert threshold

**Fix #10: Add Fallback Feed Sources**
- **Expected Impact:** MEDIUM - Diversify candidate sources
- **Files:** `src/jobs/replySystemV2/orchestrator.ts`
- **Action:**
  - Add trending topics feed
  - Add hashtag-based feed
  - Add engagement-based feed (high likes/replies)
- **Rollout:** Add one feed at a time
- **Rollback:** Disable feed in `candidate_sources`

---

## E) NEXT 24H EXPERIMENT PLAN

### Phase 1: Get System Running (Hours 0-4)

**What to Change:**
1. ✅ Jobs ARE scheduled (verified)
2. ✅ Root cause found: Missing env vars (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
3. Fix env var loading (add `import 'dotenv/config'` OR ensure Railway vars set)
4. Add env var validation with clear errors
5. Expand curated accounts from 5 to 50+

**Success Metrics:**
- At least 1 candidate evaluation created
- At least 1 SLO event logged
- Jobs executing without errors
- `system_events` shows job start/completion logs

**Rollback Conditions:**
- Jobs still not running after 4 hours
- Critical import errors (fix imports)
- Database connection failures (check DATABASE_URL)

### Phase 2: Baseline Data Collection (Hours 4-12)

**What to Change:**
1. Monitor job execution
2. Collect baseline metrics
3. Verify traceability (run trace script on any posted replies)

**Success Metrics:**
- >=10 candidates evaluated/hour
- Queue size >=5 candidates
- At least 1 reply posted via Reply System V2

**Rollback Conditions:**
- <5 candidates/hour after 8 hours
- Queue remains empty
- No replies posted

### Phase 3: Supply Optimization (Hours 12-24)

**What to Change:**
1. Expand curated accounts to 50 (if baseline shows low supply)
2. Monitor SLO performance
3. Adjust queue TTL if needed

**Success Metrics:**
- >=20 candidates evaluated/hour
- Queue size >=10 candidates
- SLO hit rate >=75% (3/4 slots per hour)

**Rollback Conditions:**
- Quality drops (parody/spam accounts pass filters)
- Queue still empty after expansion
- SLO hit rate <50%

---

## IMMEDIATE ACTION ITEMS

1. **🔴 URGENT:** Fix environment variable loading (add `import 'dotenv/config'` to orchestrator.ts) ✅ DONE
2. **🔴 URGENT:** Verify Railway has DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY set
3. **🔴 URGENT:** Expand curated accounts from 5 to 50+ (current: only 5 accounts)
4. **⚠️ HIGH:** Deploy fix and monitor first job execution
5. **⚠️ HIGH:** Add job health monitoring (system_events logging)

---

## RECOMMENDATIONS

1. **Start with diagnostics:** System appears deployed but not running - need to identify why
2. **Add monitoring:** Cannot assess performance without data - need job health checks
3. **Gradual rollout:** Once running, expand supply gradually (don't lower quality gates)
4. **Quality first:** Maintain anti-parody/spam/root gates even if supply is low initially

---

**Next Steps:**
1. Check Railway logs immediately
2. Verify job scheduling
3. Run initialization script
4. Monitor for first 4 hours
5. Collect baseline data before optimizing

