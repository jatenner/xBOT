# End-to-End Pipeline Verification Report

**Date**: 2026-01-21T03:31:33Z  
**Git Commit**: `846d8792` (Export checkSession function for direct imports)  
**Branch**: `main`

---

## Executive Summary

✅ **SESSION**: PASS (SESSION_OK)  
⚠️ **HARVEST**: PARTIAL (1 opportunity inserted, but timed out at 90s watchdog)  
⚠️ **EVALUATE**: PARTIAL (1 opportunity evaluated, 0 new evaluations created - already evaluated)  
✅ **QUEUE**: PASS (1 candidate queued)  
❌ **SCHEDULER**: FAIL (0 candidates processed, 0 decisions created)  
⚠️ **POSTING**: PARTIAL (1 ready decision found, but posting failed due to browser pool issues)  
❌ **POST_SUCCESS**: FAIL (0 POST_SUCCESS events)

**Pipeline Status**: Stopped at schedule stage. Scheduler found no candidates to process despite 1 candidate in queue.

---

## Stage-by-Stage Results

### 1. Session Check ✅ PASS

```
SESSION_OK
URL: https://x.com/home
Reason: Session OK: left nav=true, compose=true, avatar=true
```

**Status**: Session is valid and authenticated.

---

### 2. Harvest ⚠️ PARTIAL

**Opportunities Inserted**: `1`

**Details**:
- Harvest watchdog triggered at 90s timeout
- HARVEST_POSTCHECK found 1 opportunity inserted before timeout
- Opportunity URL: `https://x.com/i/status/2011833090759680304`
- Author: `@hubermanlab`
- Content preview: "Does cannabis undermine progression in life? (& let's not get into the "it's not as bad as alcohol"... that's stoner logic..."

**Root Cause**: Harvest is slow - CDP validation per tweet takes significant time. Watchdog resilience is working (DB check found inserted opportunities).

---

### 3. Evaluate ⚠️ PARTIAL

**Opportunities Evaluated**: `1`  
**Evaluations Created**: `0`  
**Evaluations Failed**: `0`

**Details**:
- Opportunity `2011833090759680304` was skipped because it was already evaluated
- No fresh evaluations were created this run

**Root Cause**: The harvested opportunity was already in the database from a previous run. Fresh opportunities are needed to create new evaluations.

---

### 4. Queue Refresh ✅ PASS

**Candidates Queued (after run start)**: `1`  
**Candidates Removed by Cleanup**: `0`

**Details**:
- Queue refresh filtered for recent evaluations (created_at >= 2026-01-21T01:33:19.776Z)
- Found 1 candidate to consider
- Rejected synthetic: 0
- Rejected missing metadata: 0
- Rejected already queued: 0
- **Queued: 1 new candidate**

**Status**: Queue refresh successfully queued 1 candidate from existing evaluation.

---

### 5. Scheduler ❌ FAIL

**Candidates Fetched**: Unknown (scheduler exited after session check)  
**Candidates Processed**: `0`  
**Decisions Created**: `0`

**Details**:
- Scheduler session check: ✅ PASS (session_ok: true)
- Scheduler configuration logged correctly:
  - RUNNER_MODE: true
  - RUNNER_BROWSER: cdp
  - RUNNER_PROFILE_DIR: ./.runner-profile
  - RUN_STARTED_AT: not set (when run standalone)
- **Issue**: Scheduler appears to have exited after session check without fetching candidates
- One-shot workflow shows: "✅ Schedule complete: 0 candidates processed, 0 decisions created"

**Root Cause Hypothesis**:
1. Scheduler may not be finding candidates due to `RUN_STARTED_AT` filtering when run standalone (no fresh candidates match)
2. Queue refresh queued 1 candidate, but scheduler might be looking for fresh candidates only (with RUN_STARTED_AT filter)
3. When scheduler is called from one-shot with `RUN_STARTED_AT`, it may not find the queued candidate if the candidate's `created_at` is before `runStartedAt`

**Next Action**: Investigate why scheduler doesn't find queued candidates. Check if scheduler candidate query respects `RUN_STARTED_AT` vs `created_at` on candidates in queue.

---

### 6. Posting ⚠️ PARTIAL

**Ready Count**: `1` (but posting failed)  
**Retry Deferral**: 1 decision in retry until `2026-01-21T03:33:48.037+00:00` (retry #1)  
**Tweet URL**: None (posting failed)

**Details**:
- Found 1 decision ready: `d80f4500-027c-4663-9b1d-fc85d59c37c0`
- Decision was recovered from stuck state (stuck 77min, reset to queued)
- Thread posting attempted but failed with timeout after 240s
- **Error**: `Playwright posting failed: thread_post_4_tweets timed out after 240000ms`
- Browser pool issues: Playwright browser executable missing
  - Error: `Executable doesn't exist at /Users/jonahtenner/Desktop/xBOT/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell`

**Root Cause**: 
1. Posting queue is using Playwright browser pool, but Playwright browsers are not installed
2. System is using CDP mode (Chrome DevTools Protocol), but posting queue is trying to use Playwright's browser pool
3. Need to configure posting queue to use CDP mode when `RUNNER_BROWSER=cdp`

**Next Action**: Install Playwright browsers OR configure posting queue to use CDP runner when in runner mode.

---

### 7. POST_SUCCESS Verification ❌ FAIL

**POST_SUCCESS Count (last 60 minutes)**: `0`  
**POST_SUCCESS Count (last 24h)**: `0`  
**Recent successful posts (from reply_decisions)**: `0`

**Status**: No successful posts found.

---

## Diagnostics Summary

**Opportunities inserted last 2h**: `6`  
**Recent opportunities by status**: `pending: 6`  
**Candidate queue (last 2h)**:
- Total: `5`
- Synthetic: `0`
- Missing metadata: `0`
- Valid: `5`

**Candidate evaluations created last 2h**: `2`

---

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| SESSION | SESSION_OK | ✅ |
| opportunities_inserted (this run) | 1 | ⚠️ |
| opportunities_evaluated (this run) | 1 | ⚠️ |
| evaluations_created (this run) | 0 | ❌ |
| candidates_queued_after_runStartedAt | 1 | ✅ |
| scheduler: candidates_fetched | Unknown | ❓ |
| scheduler: candidates_processed | 0 | ❌ |
| scheduler: decisions_created | 0 | ❌ |
| posting_queue: ready_count | 1 | ⚠️ |
| posting_queue: retry_deferral | Yes (until 2026-01-21T03:33:48.037Z) | ⚠️ |
| POST_SUCCESS count (last 24h) | 0 | ❌ |

---

## Debug Artifacts

**Harvest Debug**:
- `.runner-profile/harvest_debug/no_content_*.png` (multiple files)
- `.runner-profile/harvest_debug/no_content_*.html` (multiple files)

**Session Check**:
- `.runner-profile/session_check.png`

**Harvest State**:
- `.runner-profile/harvest_state.json`

---

## Root Cause Analysis

### Primary Issues

1. **Scheduler Not Finding Candidates** ❌
   - **Observation**: Queue refresh queued 1 candidate, but scheduler processed 0
   - **Hypothesis**: Scheduler query may be filtering by `RUN_STARTED_AT` on candidate `created_at`, but the queued candidate's evaluation was created before `runStartedAt`
   - **Evidence**: One-shot shows "0 candidates processed" even though queue refresh queued 1
   - **Fix Needed**: Review scheduler candidate query logic - ensure it finds queued candidates regardless of `RUN_STARTED_AT` when candidate is in queue

2. **Posting Queue Browser Pool Mismatch** ❌
   - **Observation**: Posting queue tries to use Playwright browser pool, but browsers not installed
   - **Error**: `Executable doesn't exist at .../chrome-headless-shell-mac-arm64/chrome-headless-shell`
   - **Root Cause**: System is in CDP mode (`RUNNER_BROWSER=cdp`), but posting queue defaults to Playwright
   - **Fix Needed**: Configure posting queue to use CDP runner mode when `RUNNER_BROWSER=cdp` is set

3. **No Fresh Evaluations Created** ⚠️
   - **Observation**: Harvested opportunity was already evaluated
   - **Impact**: Pipeline depends on fresh opportunities to create new evaluations
   - **Status**: Not a blocker if existing evaluations can be used (which queue refresh did)

---

## Next Steps (Smallest Fixes First)

### Priority 1: Fix Scheduler Candidate Query

**Issue**: Scheduler not finding queued candidates  
**Fix**: Modify `scripts/runner/schedule-and-post.ts` candidate query to:
- When `RUN_STARTED_AT` is set, still fall back to non-fresh candidates if no fresh ones found
- Ensure queued candidates are found regardless of evaluation `created_at` timestamp

**Command to verify**:
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:schedule-once
```
**Expected**: Should find and process the 1 queued candidate, creating at least 1 decision

### Priority 2: Fix Posting Queue Browser Mode

**Issue**: Posting queue using Playwright instead of CDP  
**Fix**: Configure posting queue to respect `RUNNER_BROWSER=cdp` environment variable  
**Alternative**: Install Playwright browsers: `pnpm exec playwright install`

**Command to verify**:
```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:once -- --once
```
**Expected**: Should post successfully using CDP, or show clear error if CDP posting not supported

---

## Verification Commands Run

```bash
# 1. Session check
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:session
# Result: ✅ SESSION_OK

# 2. One-shot workflow
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:one-shot
# Result: ⚠️ Harvest timeout but 1 opportunity inserted, 1 candidate queued, 0 decisions created

# 3. Scheduler standalone
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:schedule-once
# Result: ❌ Exited after session check, 0 candidates processed

# 4. Posting poll
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:once -- --once
# Result: ⚠️ Found 1 ready decision, but posting failed due to Playwright browser missing

# 5. POST_SUCCESS verification
pnpm exec tsx scripts/verify-post-success.ts --minutes=60
# Result: ❌ 0 POST_SUCCESS events

# 6. Diagnostics
pnpm run runner:diagnostics
# Result: 6 opportunities, 5 candidates in queue, 2 evaluations created last 2h
```

---

## Conclusion

The pipeline successfully:
- ✅ Maintains session authentication
- ✅ Harvests opportunities (with timeout resilience)
- ✅ Queues candidates from existing evaluations

The pipeline fails at:
- ❌ Scheduler not finding queued candidates (likely query filter issue)
- ❌ Posting queue browser mode mismatch (Playwright vs CDP)

**Recommendation**: Fix scheduler candidate query first (Priority 1), then address posting queue browser mode (Priority 2). With these fixes, the pipeline should progress to `decisions_created >= 1` and potentially `POST_SUCCESS >= 1`.
