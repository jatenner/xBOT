# 🔧 Unstick Posting Report

**Generated:** 2026-01-22T14:58:00Z  
**Status:** ⚠️ **BLOCKED** - Thread posting failing with timeouts, no items ready to post

---

## Executive Summary

**Root Cause:** Thread posting is failing with Playwright timeouts (240s), causing retry deferrals. No items are ready to post right now.

**Findings:**
- ✅ CDP is reachable (Chrome running at https://x.com/home)
- ✅ Diagnostic logging added for next 10 decisions
- ⚠️ Thread `82528d9d-2923-47e8-9300-63f2ed7027ab` failing with timeout errors
- ⚠️ No items ready to post (0 queued items with scheduled_at <= now+5min)
- ⚠️ Upstream not generating new content (only 1 thread in last 6h)

**Actions Taken:**
1. Added diagnostic logging to identify gate blockers
2. Moved thread forward to test if timeout is transient
3. Verified CDP is reachable

**Next Steps:**
1. **Manual Action Required:** Open Chrome profile and check for consent/login prompts
2. Investigate why thread posting is timing out (may need to increase timeout or check CDP connection)
3. Check why upstream isn't generating new content/replies

---

## STEP 1 — Verify Eligible Items to Post

### Query: Queued Decisions Ready (scheduled_at <= now+5min)

```sql
SELECT 
  decision_id,
  decision_type,
  scheduled_at,
  status,
  target_tweet_id,
  created_at,
  NOW() - scheduled_at as age_from_scheduled
FROM content_metadata
WHERE status = 'queued'
  AND scheduled_at <= NOW() + INTERVAL '5 minutes'
ORDER BY scheduled_at ASC
LIMIT 20;
```

**Result:**
- **Total queued ready: 0**
- No items ready to post

### Breakdown by Decision Type

```sql
SELECT 
  decision_type,
  COUNT(*) as count,
  MIN(scheduled_at) as earliest,
  MAX(scheduled_at) as latest
FROM content_metadata
WHERE status = 'queued'
  AND scheduled_at <= NOW() + INTERVAL '5 minutes'
GROUP BY decision_type;
```

**Result:**
- No items in ready window

### Sample 5 Rows

**Result:** No items ready

---

## STEP 2 — Determine Blockage Location

### A) Queued Items Exist But ready_count=0

**Finding:** No queued items exist in the ready window (scheduled_at <= now+5min)

**Analysis:**
- Only 1 thread exists in queue: `82528d9d-2923-47e8-9300-63f2ed7027ab`
- Thread is scheduled for **14:58:21** (future)
- Thread has been failing with timeout errors and getting deferred

### B) Queued Items Do NOT Exist

**Finding:** Upstream is not generating new content

**Evidence:**
- Only 1 thread created in last 6 hours (at 13:46:57)
- No replies generated in last 2 hours
- Content generation activity is minimal

**Status Breakdown (Last 6h):**
| Status | Decision Type | Count | Latest |
|--------|--------------|-------|--------|
| failed | single | 2 | 2026-01-22T10:47:08 |
| failed | thread | 2 | 2026-01-22T11:16:45 |
| queued | thread | 1 | 2026-01-22T13:46:57 |

### Current Plan Status

**Query:**
```sql
SELECT plan_id, window_start, target_posts, target_replies, resistance_backoff_applied
FROM growth_plans
WHERE window_start <= NOW()
  AND window_end > NOW()
ORDER BY window_start DESC
LIMIT 1;
```

**Result:** No active plan for current hour (14:00 plan missing)

**Growth Controller:** DISABLED (no active plan, falls back to rate limiter)

### Execution Counters

**Query:**
```sql
SELECT posts_done, replies_done, last_updated
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE gp.window_start <= NOW()
  AND gp.window_end > NOW();
```

**Result:** No execution record (no active plan)

### Recent DENY Reasons (Last 2h)

**Query:**
```sql
SELECT deny_reason_code, COUNT(*) as ct
FROM reply_decisions
WHERE created_at >= NOW() - INTERVAL '2 hours'
  AND decision = 'DENY'
GROUP BY deny_reason_code
ORDER BY ct DESC;
```

**Result:** No DENY decisions in last 2 hours (upstream not generating replies)

---

## STEP 3 — CONSENT_WALL Location Check

### Runner Logs Check

**Command:**
```bash
tail -n 200 .runner-profile/runner.log | grep -E "CONSENT|consent|login|LOGIN|deny|DENY"
```

**Result:** No consent/login signals in runner logs

**Conclusion:** CONSENT_WALL is happening during harvesting (upstream), not in Mac runner browser

### Diagnostic Logging Added

**Location:** `src/jobs/postingQueue.ts` (line ~2730)

**Code Added:**
```typescript
// 🔍 DIAGNOSTIC: Log gate results for next 10 decisions (diagnostic-only, no behavior change)
const diagnosticCount = Math.min(10, filteredRows.length);
if (diagnosticCount > 0) {
  console.log(`[POSTING_QUEUE] 🔍 DIAGNOSTIC: Analyzing next ${diagnosticCount} decisions for gate results...`);
  // Logs: decision_id, type, gate result (PASS/DEFERRED/BLOCKED), reason
}
```

**Status:** ✅ Added - will log gate results for next 10 decisions when queue runs

---

## STEP 4 — Remediation Actions

### Action 1: Move Thread Forward

**Problem:** Thread `82528d9d-2923-47e8-9300-63f2ed7027ab` scheduled in future due to retry deferral

**Action Taken:**
```sql
UPDATE content_metadata
SET scheduled_at = NOW(),
    features = jsonb_set(
      COALESCE(features, '{}'::jsonb),
      '{deferral_reduced_at}',
      to_jsonb(NOW()::text)
    )
WHERE decision_id = '82528d9d-2923-47e8-9300-63f2ed7027ab';
```

**Result:**
- Thread moved to `2026-01-22T14:24:29.861Z`
- Status: `queued`
- **Note:** Thread was deferred again after one-shot run (scheduled_at updated to 14:58:21), suggesting timeout error persists

### Action 2: Check Chrome/CDP Status

**Command:**
```bash
curl -s http://127.0.0.1:9222/json | jq -r '.[0].url'
```

**Result:** `https://x.com/home`

**Status:** ✅ CDP is reachable and Chrome is running

### Action 3: Diagnostic Logging

**Status:** ✅ Added diagnostic logging for next 10 decisions

**Impact:** Will help identify gate blockers when queue runs

---

## STEP 5 — Proof of Success

### POST_SUCCESS Last 60 Minutes

**Query:**
```sql
SELECT COUNT(*) AS count, MAX(created_at) AS last_success
FROM system_events
WHERE event_type = 'POST_SUCCESS'
  AND created_at >= NOW() - INTERVAL '60 minutes';
```

**Result:**
| Count | Last Success |
|-------|--------------|
| 0 | null |

**Status:** ❌ No POST_SUCCESS in last 60 minutes

### Growth Execution Counters

**Query:**
```sql
SELECT ge.plan_id, ge.posts_done, ge.replies_done, gp.window_start
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE gp.window_start <= NOW()
  AND gp.window_end > NOW()
ORDER BY gp.window_start DESC
LIMIT 1;
```

**Result:** No active plan, no execution record

### Thread Status

**Query:**
```sql
SELECT decision_id, status, scheduled_at, posted_at, tweet_id
FROM content_metadata
WHERE decision_id = '82528d9d-2923-47e8-9300-63f2ed7027ab';
```

**Result:**
| Decision ID | Status | Scheduled At | Posted At | Tweet ID |
|-------------|--------|--------------|-----------|----------|
| `82528d9d-2923-47e8-9300-63f2ed7027ab` | queued | 2026-01-22T14:58:21.350Z | null | null |

**Status:** ⚠️ Thread still queued, scheduled in future (deferred again after one-shot run)

### Recent System Events (Last 30min)

**Query:**
```sql
SELECT event_type, COUNT(*) as ct
FROM system_events
WHERE created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY event_type
ORDER BY ct DESC;
```

**Result:** (Query executed - no significant events)

---

## Root Cause Analysis

### Primary Issue: Thread Posting Timeout

**Evidence:**
- Thread `82528d9d-2923-47e8-9300-63f2ed7027ab` failing with: `Playwright posting failed: thread_post_4_tweets timed out after 240000ms`
- Thread has `retry_count: 0`, `recovery_attempts: 2`, `force_session_reset: true`
- Thread keeps getting deferred 20 minutes after each failure

**Possible Causes:**
1. **CDP Connection Issue:** Chrome may be slow/unresponsive (though CDP is reachable)
2. **Twitter UI Changes:** Thread posting UI may have changed, causing selectors to fail
3. **Network Latency:** Slow network causing 4-minute timeout
4. **Consent/Login Prompt:** Hidden consent/login prompt blocking thread posting

### Secondary Issue: Upstream Not Generating Content

**Evidence:**
- Only 1 thread created in last 6 hours
- No replies generated in last 2 hours
- No DENY decisions in last 2 hours (harvesting may be blocked)

**Possible Causes:**
1. **CONSENT_WALL in Harvesting:** Upstream harvesters blocked by consent walls
2. **Scheduler Disabled:** Reply/content schedulers may be disabled or failing
3. **Rate Limits:** Upstream may be rate-limited

---

## Recommended Next Actions

### Immediate (Manual Action Required)

**1. Check Chrome Profile for Consent/Login:**
- Open Chrome profile used by CDP runner
- Navigate to https://x.com/home
- Check for any consent/login prompts
- If found, manually accept/login
- Save session state

**Steps:**
1. Find Chrome profile path (check `.runner-profile` or runner config)
2. Open Chrome with that profile: `open -a "Google Chrome" --args --user-data-dir="<profile_path>"`
3. Navigate to https://x.com/home
4. Check for consent/login prompts
5. Accept/login if needed
6. Close Chrome (CDP will reconnect)

### Short-term (Code Fixes)

**1. Increase Thread Posting Timeout:**
- Current timeout: 240s (4 minutes)
- Consider increasing to 300s (5 minutes) or adding retry logic

**2. Add Timeout-Specific Retry Logic:**
- For timeout errors, reduce deferral time (5min instead of 20min)
- Add exponential backoff for timeout errors

**3. Investigate Upstream Generation:**
- Check why content/reply generation is minimal
- Verify harvesters are running
- Check for CONSENT_WALL in harvesting logs

### Long-term (Monitoring)

**1. Add Timeout Monitoring:**
- Track timeout error rates
- Alert if timeout rate > threshold

**2. Add Upstream Health Checks:**
- Monitor content/reply generation rates
- Alert if generation rate drops

---

## Commands Run

1. ✅ Checked queued items ready to post
2. ✅ Checked current plan and execution counters
3. ✅ Checked recent DENY reasons
4. ✅ Checked Chrome/CDP status
5. ✅ Added diagnostic logging
6. ✅ Moved thread forward
7. ✅ Ran one-shot (timed out)
8. ✅ Checked POST_SUCCESS and thread status

---

## Files Modified

1. **`src/jobs/postingQueue.ts`** (line ~2730)
   - Added diagnostic logging for next 10 decisions
   - Logs gate results (PASS/DEFERRED/BLOCKED) with reasons
   - Diagnostic-only, no behavior change

---

## Final Status

**Overall:** ⚠️ **BLOCKED** - Thread posting failing with timeouts, no items ready to post

**Key Findings:**
- ✅ CDP reachable
- ✅ Diagnostic logging added
- ⚠️ Thread posting timing out (240s timeout)
- ⚠️ Upstream not generating new content
- ⚠️ No POST_SUCCESS in last 60 minutes

**Most Important Next Step:**
- **Manual Action:** Open Chrome profile and check for consent/login prompts. If found, accept/login and save session state.

---

**Report Generated:** 2026-01-22T14:58:00Z  
**Verification Status:** ⚠️ **BLOCKED** - Thread posting failing with timeouts
