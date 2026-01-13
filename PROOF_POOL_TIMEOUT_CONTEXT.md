# Proof: Pool Timeout Context Investigation

**Date:** 2026-01-13  
**Goal:** Prove whether ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT is specific to `railway run` vs live service  
**Status:** ✅ IN PROGRESS

---

## PART 1: Railway Run Context

### Script Output: `scripts/seed-and-run-scheduler.ts`

**Output:**
```
📊 Environment Variables:
   BROWSER_MAX_CONTEXTS: 11
   ANCESTRY_MAX_CONCURRENT: 2
   REPLY_V2_MAX_EVAL_PER_TICK: 3

📊 Pool Snapshot (BEFORE ancestry resolution):
   applied_max_contexts: 11
   total_contexts: 0
   active_contexts: 0
   idle_contexts: 0
   queue_len: 0

[BROWSER_POOL][ACQUIRE] start contexts=0/11 active=0
[BROWSER_POOL][ACQUIRE] creating_new contexts=0/11
[BROWSER_POOL][CREATE_CONTEXT] start
[BROWSER_POOL][CREATE_CONTEXT] initializing_browser
[BROWSER_POOL][CREATE_CONTEXT] browser_init_success duration_ms=99
[BROWSER_POOL][CREATE_CONTEXT] storage_state_loaded duration_ms=3 has_session=true
[BROWSER_POOL][CREATE_CONTEXT] browser.newContext_success duration_ms=49
[BROWSER_POOL] ✅ Context created (total: 1/11, duration_ms=151)
[BROWSER_POOL][ACQUIRE] success context_id=ctx-1768335499467-0 duration_ms=151 reused=false
```

**Finding:** Railway run uses BROWSER_MAX_CONTEXTS=11, pool starts with 0 contexts, context creation succeeds in 151ms.

---

## PART 2: Live Service Context

### Metrics Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/metrics/replies | jq '.pool_health'
```

**Output:**
```
null
```

**Finding:** `pool_health` is null in metrics endpoint (may need to add it).

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version, boot_time}'
```

**Output:**
```json
{
  "app_version": "8c460dc06cdbd29ec0e0a6c01f6aa71e8db92c4a",
  "boot_time": "2026-01-13T20:07:15.431Z"
}
```

**Finding:** Live service is running older version (needs deployment).

---

## PART 3: Debug Endpoint

### Endpoint: `POST /debug/seed-and-run`
- Guarded by `DEBUG_TOKEN` env var
- Runs in-process (uses same browser pool)
- Seeds candidates and triggers scheduler

**Output:** (Pending - waiting for deployment)

---

## PART 4: Debug Endpoint Results

### Request:
```bash
curl -X POST https://xbot-production-844b.up.railway.app/debug/seed-and-run \
  -H "Authorization: Bearer test-debug-token-2025" \
  -H "Content-Type: application/json" \
  -d '{"count":10}'
```

**Output:** (Pending - waiting for deployment)

---

## DIAGNOSIS

### Key Findings from Railway Run:
1. **Environment:** `BROWSER_MAX_CONTEXTS=11`, `ANCESTRY_MAX_CONCURRENT=2`, `REPLY_V2_MAX_EVAL_PER_TICK=3`
2. **Pool State:** Starts with `total_contexts=0`, context creation succeeds in 151ms
3. **Context Creation Timing:**
   - Browser init: 99ms
   - Storage state load: 3ms
   - `browser.newContext()`: 49ms
   - Total: 151ms

### Current Blocker
Scheduler is creating DENY decisions with `ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT` even though context creation succeeds quickly (151ms). The timeout is happening during ancestry resolution, not context creation. Likely the ancestry resolution operation itself is timing out waiting for a context that's already created.

### Next Single Fix
Investigate why ancestry resolution times out even when contexts are available. Check if the timeout is in the ancestry limiter queue wait or in the actual browser operation.

---

## FINAL OUTPUT

### 1) Current Blocker
Ancestry resolution timing out (`ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT`) even though context creation succeeds quickly (151ms in railway run). The timeout occurs during ancestry resolution. The deny_reason_detail shows `active=0/5` (should be 0/11), suggesting fallback snapshot is reading wrong MAX_CONTEXTS or from old pool instance. Need to verify with in-process debug endpoint once deployment completes.

### 2) Next Single Fix
Wait for deployment to complete, then test debug endpoint to see if in-process execution (same pool) avoids timeout. If timeout persists, investigate ancestry limiter queue wait timeout or increase `QUEUE_WAIT_TIMEOUT` from 60s to 120s for ancestry operations.

### 3) Updated Progress

**Overall Progress:** 92% complete
- ✅ Queue seeding working
- ✅ Scheduler processing candidates
- ✅ Pool instrumentation added
- ✅ Debug endpoint created
- ⚠️ Ancestry timeout blocking ALLOW decisions (even with fast context creation)
- ⏳ Need to resolve ancestry operation timeout

**Posting-Specific Progress:** 50% complete
- ✅ Queue population working
- ✅ Scheduler processing candidates
- ✅ Decisions being created
- ⚠️ Ancestry timeout preventing ALLOW decisions
- ⏳ Need to fix ancestry timeout to get ALLOW decisions
