# Proof: Pipeline End-to-End Progression

**Date:** 2026-01-13  
**Deployment Commit:** efabef9cbb150812f21118264f1b33c57ee86aa1  
**Deploy Time:** 2026-01-13 03:46:23 UTC  
**Status:** ⚠️ DEPLOYED BUT NO ALLOW DECISIONS YET

---

## A) Deployment Proof

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id}'
```

**Output:**
```json
{
  "app_version": "efabef9cbb150812f21118264f1b33c57ee86aa1",
  "boot_id": "69701549-8460-4fb9-b21b-285d08c69baf"
}
```

✅ **Deployment Verified:** New app_version matches HEAD commit.

---

## B) Scheduler Activity

### System Events (Last Hour)
```sql
SELECT event_type, created_at, message 
FROM system_events 
WHERE event_type LIKE '%reply_v2_scheduler%' 
  AND created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Results:**
- `reply_v2_scheduler_job_started`: 4 runs in last hour
- `reply_v2_scheduler_job_error`: 4 errors in last hour

**Latest Error:**
```
Reply V2 scheduler job error: Non-root reply blocked: ANCESTRY_ERROR_FAIL_CLOSED: 
status=ERROR, target=2009911509749522866, method=error, 
error=Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=2, active=0/5)
```

**Root Cause:** Browser pool timeouts causing ancestry resolution failures → DENY decisions.

---

## C) Pipeline Progression Query

### Counts (Last 2 Hours)
```sql
SELECT 
  COUNT(*) as total,
  COUNT(template_selected_at) as template_selected,
  COUNT(generation_completed_at) as generation_completed,
  COUNT(posting_completed_at) as posting_completed,
  COUNT(posted_reply_tweet_id) as posted
FROM reply_decisions
WHERE decision = 'ALLOW' 
  AND created_at > NOW() - INTERVAL '2 hours';
```

**Results:**
```
 total | template_selected | generation_completed | posting_completed | posted 
-------+-------------------+----------------------+-------------------+--------
     0 |                 0 |                    0 |                 0 |      0
```

⚠️ **No ALLOW decisions in last 2 hours.**

### Decision Breakdown (Last Hour)
```sql
SELECT decision, COUNT(*) as count, COUNT(pipeline_error_reason) as with_error
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY decision;
```

**Results:**
```
 decision | count | with_error 
----------+-------+------------
 DENY     |    17 |          0
```

**Analysis:** 17 DENY decisions, 0 ALLOW decisions. All failures are due to ancestry resolution timeouts.

---

## D) Sample Decision Analysis

### Decision ID: `572aa168-e349-4359-9e33-887dbfad9450`
```sql
SELECT 
  decision_id, target_tweet_id, decision, scored_at, 
  template_status, template_selected_at, pipeline_error_reason
FROM reply_decisions
WHERE decision_id = '572aa168-e349-4359-9e33-887dbfad9450';
```

**Results:**
```
 decision_id              |   target_tweet_id   | decision |         scored_at          | template_status | template_selected_at | pipeline_error_reason 
--------------------------+---------------------+----------+---------------------------+-----------------+----------------------+-----------------------
 572aa168-e349-4359-9e33-887dbfad9450 | 2009911509749522866 | DENY     | 2026-01-13 03:47:48.212+00 | FAILED          |                      | 
```

**Observations:**
- ✅ `scored_at` is set (decision was created)
- ⚠️ `template_status=FAILED` but `template_selected_at` is NULL
- ⚠️ `pipeline_error_reason` is NULL (should be set by outer catch block)

**Issue:** Outer catch block is setting `template_status=FAILED` but not setting `template_selected_at` or `pipeline_error_reason`. This suggests the catch block code path may not be fully executing the DB update.

---

## E) Queue Status

```sql
SELECT COUNT(*) as queue_size
FROM reply_candidate_queue
WHERE status = 'queued' AND expires_at > NOW();
```

**Results:**
```
 queue_size 
------------
        136
```

✅ **Queue has 136 candidates** - scheduler has candidates to process.

---

## F) Railway Logs Analysis

### [PIPELINE] Logs
```bash
railway logs -s xBOT --tail 3000 | grep "\[PIPELINE\]"
```

**Results:** No [PIPELINE] logs found in Railway logs.

**Possible Reasons:**
1. Logs are being filtered/truncated
2. Code path isn't being hit (scheduler fails before creating ALLOW decisions)
3. Logs haven't been flushed yet

### Scheduler Logs
```bash
railway logs -s xBOT --tail 5000 | grep -E "\[SCHEDULER\]|attemptScheduledReply"
```

**Results:** No matches found (logs may be truncated or filtered).

---

## G) Root Cause Analysis

### Primary Blocker: Browser Pool Timeouts

**Evidence:**
1. All scheduler runs fail with `ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT`
2. Error message: "Queue timeout after 60s - pool overloaded"
3. Pool state: `queue_len=2, active=0/5` (suggests pool is stuck)

**Impact:**
- Ancestry resolution fails → DENY decisions
- No ALLOW decisions created → pipeline never progresses
- Template selection/generation/posting never executed

### Secondary Issue: Outer Catch Block Not Fully Executing

**Evidence:**
- `template_status=FAILED` is set
- But `template_selected_at` and `pipeline_error_reason` are NULL

**Expected Behavior (from code):**
```typescript
if (current?.template_status === 'PENDING' && !current?.template_selected_at) {
  updates.template_selected_at = new Date().toISOString();
  updates.pipeline_error_reason = errorReason;
}
```

**Actual Behavior:** Only `template_status` is being updated.

**Possible Cause:** The decision is created as DENY (not ALLOW), so `template_status` might not be 'PENDING' when the catch block runs, or the catch block isn't executing the full update logic.

---

## H) Next Steps

### Immediate Fix Required: Browser Pool Timeout

**Problem:** Browser pool is timing out during ancestry resolution, preventing ALLOW decisions.

**Recommended Actions:**

1. **Check Browser Pool Configuration:**
   - Verify `BROWSER_MAX_CONTEXTS` is set correctly (should be 9 per previous fixes)
   - Check if pool is actually creating contexts or stuck

2. **Increase Ancestry Timeout:**
   - Current: 60s
   - Suggested: 120s (to allow for consent wall handling)

3. **Fix Pool Stuck State:**
   - Pool shows `active=0/5` but queue_len=2, suggesting contexts aren't being released
   - May need pool reset/recovery logic

### Secondary Fix: Ensure Catch Block Updates All Fields

**Problem:** Outer catch block isn't setting all failure fields.

**Fix:** Ensure catch block checks for DENY decisions and sets appropriate fields:
```typescript
// In outer catch block, check if decision exists and is DENY
if (decisionId) {
  const { data: current } = await supabase
    .from('reply_decisions')
    .select('decision, template_status, template_selected_at, generation_completed_at, posting_completed_at')
    .eq('decision_id', decisionId)
    .single();
  
  // Mark stages as failed regardless of decision type
  const updates: any = {
    pipeline_error_reason: errorReason,
  };
  
  if (!current?.template_selected_at) {
    updates.template_selected_at = new Date().toISOString();
    updates.template_status = 'FAILED';
  }
  // ... similar for other stages
}
```

---

## I) Proof Checklist Status

- ✅ Deployment verified (`app_version` matches HEAD)
- ✅ Scheduler running (4 runs in last hour)
- ❌ ALLOW decisions created (0 in last 2 hours)
- ❌ Template selection progressing (no ALLOW decisions to progress)
- ❌ Generation progressing (no ALLOW decisions to progress)
- ❌ Posting progressing (no ALLOW decisions to progress)
- ⚠️ Error handling working (partially - catch block sets `template_status` but not all fields)

---

## J) Conclusion

**Status:** ⚠️ **DEPLOYED BUT BLOCKED**

The pipeline stall fix has been deployed successfully, but we cannot verify end-to-end progression because:

1. **No ALLOW decisions are being created** due to browser pool timeouts during ancestry resolution
2. **All candidates are being DENIED** before they can progress through template selection → generation → posting

**To Verify Pipeline Fix:**
1. Fix browser pool timeout issue
2. Generate at least 1 ALLOW decision
3. Verify it progresses through all stages with [PIPELINE] logs
4. Re-run this proof document

**Current Blocker:** Browser pool timeout preventing ancestry resolution → preventing ALLOW decisions → preventing pipeline progression verification.
