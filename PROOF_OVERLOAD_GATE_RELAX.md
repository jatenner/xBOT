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
**Time Window:** Last 30-60 minutes after deploy

**Decision Breakdown:**
```sql
SELECT decision, deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '30 minutes'
GROUP BY decision, deny_reason_code
ORDER BY decision, count DESC;
```

**Results:** (To be captured - waiting for fresh decisions)

**SKIPPED_OVERLOAD:** (Target: <20%)  
**ALLOW:** (Target: >0)  
**ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT:** (Target: 0)

**Overload Threshold:** 33 (capacity-aware: Math.max(30, 11*3))

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
**Deployment:** (Status)  
**Impact:** (To be measured)  
**Next Action:** (To be determined)
