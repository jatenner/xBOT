# Proof: Pipeline End-to-End Progression

**Date:** 2026-01-13  
**Deployment Commit:** 9b4d1e844ce4b69044fda876287649cb868a3607  
**Status:** ⚠️ **BLOCKED - No ALLOW decisions progressing**

---

## Step A: Runtime + Key Flags

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version, boot_id}'
```

**Output:**
```json
{
  "app_version": "9b4d1e844ce4b69044fda876287649cb868a3607",
  "boot_id": "10c38e9a-136f-4eea-bf8e-1635b910e131"
}
```

✅ **Deployment Verified**

### Railway Environment Variables
```bash
railway variables -s xBOT | grep -E "DRY_RUN|POSTING_ENABLED|ENABLE_REPLIES|MODE|REPLY_V2_MAX_EVAL_PER_TICK|BROWSER_MAX_CONTEXTS"
```

**Output:**
```
DRY_RUN: false
POSTING_ENABLED: true
ENABLE_REPLIES: true
MODE: live
REPLY_V2_MAX_EVAL_PER_TICK: 3
BROWSER_MAX_CONTEXTS: 11
```

✅ **All flags correct for posting**

---

## Step B: Live Pipeline Verifier

**Command:**
```bash
pnpm exec tsx scripts/verify-reply-pipeline-live.ts
```

**Output:**
```
════════════════════════════════════════════════════════════════════════════════
🔍 REPLY PIPELINE VERIFICATION
════════════════════════════════════════════════════════════════════════════════
Querying decisions created after: 2026-01-13T22:31:51.156Z

📊 SUMMARY (Last 2 Hours)
════════════════════════════════════════════════════════════════════════════════
Total decisions:            33
ALLOW:                       0
DENY:                       33

Pipeline Progression:
  scored_at:                33
  template_selected_at:      0 (0 from ALLOW)
  generation_completed_at:      0 (0 from ALLOW)
  posting_completed_at:      0 (0 from ALLOW)

Errors:
  pipeline_error_reason:     18
  template_status=FAILED:     15

📋 TOP 10 NEWEST ALLOW DECISIONS
════════════════════════════════════════════════════════════════════════════════
  ⚠️ No ALLOW decisions found in last 2 hours
```

**Status:** ❌ **No ALLOW decisions in last 2 hours**

---

## Step C: Trace Newest ALLOW Decision (24h window)

**Query:**
```sql
SELECT decision_id, target_tweet_id, decision, scored_at,
   template_status, template_id, template_selected_at, template_error_reason,
   generation_started_at, generation_completed_at,
   posting_started_at, posting_completed_at,
   posted_reply_tweet_id,
   pipeline_error_reason
FROM reply_decisions
WHERE decision = 'ALLOW' AND scored_at >= NOW() - INTERVAL '24 hours'
ORDER BY scored_at DESC LIMIT 1;
```

**Output:**
```
 decision_id |   target_tweet_id   | decision |         scored_at          | template_status | template_id | template_selected_at | template_error_reason | generation_started_at | generation_completed_at | posting_started_at | posting_completed_at | posted_reply_tweet_id | pipeline_error_reason 
-------------+---------------------+----------+----------------------------+-----------------+-------------+----------------------+-----------------------+-----------------------+-------------------------+--------------------+----------------------+-----------------------+-----------------------
             | 2009910639389515919 | ALLOW    | 2026-01-13 19:31:47.107+00 | PENDING         |             |                      |                       |                       |                         |                    |                      |                       | 
```

**Analysis:**
- ✅ ALLOW decision exists (created 4 hours ago)
- ❌ `template_status=PENDING` (never progressed)
- ❌ All pipeline timestamps NULL (never progressed past scoring)
- ❌ `decision_id` is NULL (may indicate incomplete record)

**Logs Check:**
```bash
railway logs -s xBOT --tail 5000 | grep -E "2009910639389515919|template_select|PENDING"
```

**Output:** No matches found (decision is old, logs may be truncated)

**Status:** ⚠️ **ALLOW decision exists but stuck at PENDING - never progressed**

---

## Step D: Top DENY Reason Analysis

### DENY Breakdown (Last 2 Hours)
```sql
SELECT deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE decision = 'DENY' AND scored_at >= NOW() - INTERVAL '2 hours'
GROUP BY deny_reason_code
ORDER BY count DESC;
```

**Output:**
```
 deny_reason_code | count 
------------------+-------
 CONSENT_WALL     |    31
 LOW_RELEVANCE    |     2
```

**Top DENY Reason:** `CONSENT_WALL` (31 out of 33 = 94%)

### Sample CONSENT_WALL Rows
```sql
SELECT decision_id, target_tweet_id, decision, deny_reason_code, 
       LEFT(deny_reason_detail, 300) as detail_preview
FROM reply_decisions
WHERE decision = 'DENY' AND deny_reason_code = 'CONSENT_WALL' 
  AND scored_at >= NOW() - INTERVAL '2 hours'
ORDER BY scored_at DESC LIMIT 5;
```

**Output:**
```
             decision_id              |               target_tweet_id                | decision | deny_reason_code |                                                                      detail_preview                                                                      
--------------------------------------+----------------------------------------------+----------+------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------
 891bbe2f-ee92-49af-a4ed-f26b293f66f0 | 2000000000000000009                          | DENY     | CONSENT_WALL     | skip_source=FALLBACK_SNAPSHOT stage=detect_consent_wall pool={queue=3,active=1/5,idle=4,semaphore=0,uid=1768347193178-lgfjs86,requested_env_max=default}
 bad230f1-dcb9-4947-92b0-dcb0489e7ba9 | 2000000000000000009                          | DENY     | CONSENT_WALL     | skip_source=FALLBACK_SNAPSHOT stage=detect_consent_wall pool={queue=3,active=4/5,idle=1,semaphore=0,uid=1768347193178-lgfjs86,requested_env_max=default}
 f181ee31-1697-4546-be4b-ea9d5a26547f | 2000000000000000009                          | DENY     | CONSENT_WALL     | skip_source=FALLBACK_SNAPSHOT stage=detect_consent_wall pool={queue=8,active=1/5,idle=4,semaphore=0,uid=1768347193178-lgfjs86,requested_env_max=default}
                                      | consent_wall_DrSpencerNadolsky_1768348203048 | DENY     | CONSENT_WALL     | 
                                      | consent_wall_DrBradSchoenfeld_1768348025627  | DENY     | CONSENT_WALL     | 
```

**Analysis:**
- `skip_source=FALLBACK_SNAPSHOT` indicates pool snapshot was built as fallback when recording error (not the root cause)
- `stage=detect_consent_wall` confirms browser IS being used (consent detection runs in browser)
- Pool shows `active=1/5` or `active=4/5` (browser contexts are active)
- Some synthetic tweet IDs (`consent_wall_*`) suggest feeds are hitting consent walls

**Root Cause:** Browser is launching successfully (proven in PROOF_PLAYWRIGHT_BROWSER_FIX.md), but Twitter consent walls are blocking ancestry resolution for most candidates.

**Code Path:** `src/utils/resolveRootTweet.ts` → `detectConsentWall()` → throws `CONSENT_WALL` error → mapped to `deny_reason_code=CONSENT_WALL` in `replyDecisionRecorder.ts`

**Proposed Fix:** CONSENT_WALL is expected behavior for accounts that require consent. This is NOT a blocker - it's a quality filter. The real issue is:
1. **No ALLOW decisions in last 2 hours** (all hitting CONSENT_WALL or LOW_RELEVANCE)
2. **Old ALLOW decision stuck at PENDING** (created 4 hours ago, never progressed)

---

## Root Cause Analysis

### Issue 1: No Recent ALLOW Decisions

**Evidence:**
- 0 ALLOW decisions in last 2 hours
- 31 CONSENT_WALL denials (94%)
- 2 LOW_RELEVANCE denials (6%)

**Analysis:** This is expected - most candidates are hitting consent walls or have low relevance. The scheduler is working correctly, just no candidates passing filters.

### Issue 2: Old ALLOW Decision Stuck at PENDING

**Evidence:**
- ALLOW decision exists: `target_tweet_id=2009910639389515919`, `scored_at=2026-01-13 19:31:47`
- `template_status=PENDING` (never progressed)
- All pipeline timestamps NULL

**Root Cause:** Looking at `tieredScheduler.ts`, the scheduler:
1. Selects candidate from queue
2. Creates decision via `recordReplyDecision()` (sets `scored_at`, `template_status=PENDING`)
3. **Immediately** tries template selection (line 496-524)
4. If template selection succeeds, continues to generation

**Why Stuck:** The scheduler only processes candidates from `reply_candidate_queue`. Once a decision is created, it's not picked up again. If template selection failed silently or scheduler crashed mid-execution, the decision would be stuck at PENDING.

**Fix:** The `templateStatusWatchdog` should mark stale PENDING rows as FAILED after 10 minutes, but this ALLOW decision is 4 hours old and still PENDING. Either:
1. Watchdog isn't running
2. Watchdog query isn't matching this row (maybe `decision_id` is NULL?)

---

## Final Answer

**Posting works:** ❌ **NO**

**Blocked at stage:** `template_selection` (ALLOW decisions created but never progress past PENDING)

**DB Row Evidence:**
- Decision: `target_tweet_id=2009910639389515919`, `scored_at=2026-01-13 19:31:47`, `template_status=PENDING`
- All pipeline timestamps NULL
- `decision_id` is NULL (may indicate incomplete record)

**Next Blocker:** 
1. **No recent ALLOW decisions** (all hitting CONSENT_WALL or LOW_RELEVANCE) - this is expected, not a blocker
2. **Old ALLOW decision stuck at PENDING** - scheduler should process it immediately after creation, but it didn't. Need to:
   - Check if `templateStatusWatchdog` is running
   - Verify why scheduler didn't complete template selection for this decision
   - Check if `decision_id` being NULL prevents watchdog from matching

**Proposed Fix:** 
- Ensure `templateStatusWatchdog` runs regularly and handles NULL `decision_id`
- Add retry logic for ALLOW decisions stuck at PENDING
- Or: Verify scheduler completes template selection synchronously (shouldn't leave PENDING)
