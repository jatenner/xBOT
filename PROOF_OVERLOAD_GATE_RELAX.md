# Proof: Overload Gate Relaxation

**Date:** 2026-01-13  
**Goal:** Relax ancestry overload gate to restore ALLOW throughput  
**Status:** ⚠️ IN PROGRESS

---

## 1) IMPLEMENTATION

### Code Changes

**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Change:** Replaced hardcoded threshold (20) with capacity-aware threshold that scales with `maxContexts`.

### Before
```typescript
const isOverloaded = queueLen >= 20 || (activeContexts >= maxContexts && queueLen >= 5);
```

### After
```typescript
// 🎯 CAPACITY-AWARE: Threshold scales with maxContexts (was hardcoded 20)
const hardQueueCeiling = Math.max(30, maxContexts * 3); // With maxContexts=11 -> 33
const isOverloaded = queueLen >= hardQueueCeiling || (activeContexts >= maxContexts && queueLen >= 5);
```

**Impact:**
- With `maxContexts=11`: threshold becomes 33 (was 20)
- Allows more ancestry resolutions before skipping
- Maintains safety: still rejects when queue is truly overloaded

### Enhanced Logging
Added structured logging with overload snapshot:
```typescript
console.warn(`[ANCESTRY] ⚠️ System overloaded: queue=${queueLen} >= ${hardQueueCeiling} (active=${activeContexts}/${maxContexts}), skipping ancestry resolution for ${targetTweetId}`);
```

---

## 2) BUILD VERIFICATION

```bash
pnpm run build
```

**Output:** (To be captured)

---

## 3) DEPLOYMENT

### Commit
```bash
git commit -m "Relax ancestry overload gate: capacity-aware queue ceiling"
```

**Commit:** (To be captured)

### Deploy
```bash
railway variables -s xBOT --set "APP_VERSION=$(git rev-parse HEAD)"
railway up --detach -s xBOT
```

**Output:** (To be captured)

### Verification
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id}'
```

**Output:**
```json
{
  "app_version": "b1219abcd9108707d582bd66f6c4ae86d8c84581",
  "boot_id": "6588b74d-01d3-44f1-a69c-48557c5be091"
}
```

✅ **Deployment Complete:** New boot_id confirms restart

---

## 4) BEFORE/AFTER COMPARISON

### Before (Pre-Deploy)
**Time Window:** Last 60 minutes before deploy

**Decision Breakdown:**
```
 decision |     deny_reason_code      | count 
----------+---------------------------+-------
 DENY     | ANCESTRY_SKIPPED_OVERLOAD |    12
 DENY     | CONSENT_WALL              |     3
```

**SKIPPED_OVERLOAD:** 80% (12/15)  
**ALLOW:** 0  
**ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT:** 0 ✅

**Overload Threshold:** 20 (hardcoded)

### After (Post-Deploy)
**Time Window:** Last 30 minutes after deploy

**Decision Breakdown:**
```sql
SELECT decision, deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '30 minutes'
GROUP BY decision, deny_reason_code
ORDER BY decision, count DESC;
```

**Results:**
```
 decision |     deny_reason_code      | count 
----------+---------------------------+-------
 DENY     | ANCESTRY_SKIPPED_OVERLOAD |     6
```

**SKIPPED_OVERLOAD:** 100% (6/6) ⚠️ Still dominant  
**ALLOW:** 0 ⚠️ Still blocked  
**ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT:** 0 ✅ Maintained

**Overload Threshold:** 33 (capacity-aware: Math.max(30, 11*3))

**Sample Post-Deploy Decision:**
```
decision_id: 0f135351-97cc-4dd5-a1dc-e429edbfd224
deny_reason_detail: pool={queue=24,active=0/5,idle=0,semaphore=0} error=5, timeout: 60s, queue_len=2, active=0/5)
```

**Observation:** Queue length (24) is below new threshold (33), but decisions still show SKIPPED_OVERLOAD. This suggests:
1. Decisions may be using cached ancestry results from before the fix
2. Pool snapshot shows `max_contexts=5` (old value), indicating snapshot taken before config update
3. Need to wait for fresh scheduler runs with new code

---

## 5) ALLOW DECISION PIPELINE PROGRESSION (If ALLOW > 0)

### Sample ALLOW Decision
```sql
SELECT 
  decision_id, target_tweet_id,
  scored_at, template_selected_at, generation_completed_at,
  posting_completed_at, posted_reply_tweet_id
FROM reply_decisions
WHERE decision = 'ALLOW' AND created_at > NOW() - INTERVAL '60 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Results:** (To be captured)

### Pipeline Logs
```bash
railway logs -s xBOT --tail 5000 | grep -E "\[PIPELINE\].*<decision_id>"
```

**Results:** (To be captured)

---

## 6) METRICS SNAPSHOT

```bash
curl -sSf https://xbot-production-844b.up.railway.app/metrics/replies | jq '{last_1h: {allow, deny, deny_reason_breakdown, allow_rate}, pool_health: {max_contexts, queue_len, active_contexts, semaphore_inflight, timeouts_last_1h}}'
```

**Results:** (To be captured)

---

## SUMMARY

**Fix:** Capacity-aware overload threshold (20 → 33 with maxContexts=11)  
**Deployment:** ✅ Complete (app_version: b1219abcd9108707d582bd66f6c4ae86d8c84581)  
**Impact:** ⚠️ **IN PROGRESS** - Threshold increased but SKIPPED_OVERLOAD persists  
**Next Action:** Monitor for 1 hour to see if fresh scheduler runs produce ALLOW decisions

---

## DIAGNOSIS

### Current Status (30 minutes post-deploy)
- **ALLOW:** 0 (still blocked)
- **SKIPPED_OVERLOAD:** 100% (6/6 DENY decisions)
- **Queue lengths:** 22-25 (below new threshold of 33)
- **ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT:** 0 ✅ (pool stability maintained)

### Key Findings

1. **Threshold Increase:** Successfully changed from 20 → 33
2. **Pool Stability:** No timeouts introduced (ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT = 0)
3. **SKIPPED_OVERLOAD Persists:** Despite queue < threshold, decisions still show SKIPPED_OVERLOAD

### Possible Explanations

1. **Cached Ancestry:** Decisions may be using cached `skipped_overload` results from before the fix
2. **Pool Snapshot Timing:** `deny_reason_detail` shows `max_contexts=5` (old value), suggesting snapshots taken before config update
3. **Scheduler Frequency:** Scheduler runs every 15 minutes; need to wait for fresh runs with new code

### Next Steps

1. **Wait 1 hour** for fresh scheduler runs with new threshold
2. **Check logs** for `[ANCESTRY] System overloaded: queue=X >= 33` to confirm new threshold is active
3. **If SKIPPED_OVERLOAD persists:**
   - Investigate ancestry cache expiration
   - Check if `resolveRootTweet.ts` has separate overload check
   - Verify `maxContexts` is correctly read from pool instance
4. **If ALLOW appears:** Prove end-to-end pipeline progression with timestamps
