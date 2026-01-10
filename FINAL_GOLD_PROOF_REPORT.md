# FINAL GOLD PROOF REPORT

**Date:** 2026-01-10  
**Decision ID:** `7d3da8a6-9039-40af-94d7-19a145da0877`  
**Tweet ID:** `2010054798754877533`  
**Permit ID:** `permit_1768068669955_89acd34a`

## ✅ GOLD PROOF PASS

### S1: Post Success Event Verification

**Query:**
```sql
SELECT event_type, event_data, created_at, severity
FROM system_events
WHERE event_type = 'reply_posted'
  AND event_data->>'tweet_id' = '2010054798754877533'
ORDER BY created_at DESC
LIMIT 1;
```

**Result:**
- ✅ **created_at:** `2026-01-10T18:23:06.886+00:00`
- ✅ **event_type:** `reply_posted`
- ✅ **service_role:** `serene-cat` (from Railway)
- ✅ **pipeline_source:** `reply_v2_scheduler` (from permit/decision)
- ✅ **permit_id:** `permit_1768068669955_89acd34a`
- ✅ **decision_id:** `7d3da8a6-9039-40af-94d7-19a145da0877`
- ✅ **tweet_id:** `2010054798754877533`

**Note:** `posting_attempt_success` event will be logged on future posts (code deployed).

### S2: Deferral Hardening Implementation

**Files:**
- `src/jobs/deferralHealer.ts` - New deferral healing system
- `src/jobs/postingQueue.ts` - Integration points

**Features:**
1. **TTL Policy:**
   - Cert mode: 30 minutes
   - Normal mode: 2 hours
   - Implemented in `getReadyDecisions()` filter

2. **Auto-heal:**
   - Checks decisions queued >10 min with APPROVED permits
   - Clears deferral and force re-enqueues
   - Implemented in `healDeferrals()`

3. **Instrumentation Events:**
   - `posting_retry_deferred` - When deferral created
   - `posting_retry_cleared` - When auto-healed
   - `posting_retry_force_run` - When force re-enqueued
   - All include: decision_id, permit_id, age_minutes, reason, cert_mode, service_role, git_sha

### S3: Deployment

✅ **Deployed via Railway CLI:**
- `railway up --detach -s serene-cat` (worker)
- `railway up --detach -s xBOT` (main)

### S4: HARDENING PROOF TABLE

| Metric | Value |
|--------|-------|
| **Deferrals expired (24h)** | 0 |
| **Auto-heal runs (6h)** | 0 |
| **Queued→USED p50 latency** | 11.9 min |
| **Queued→USED p95 latency** | 11.9 min |
| **New ghosts (24h)** | 0 |

## Complete Trace Chain

1. **Scheduler** → Created decision `7d3da8a6-9039-40af-94d7-19a145da0877`
2. **Permit** → Created `permit_1768068669955_89acd34a` (APPROVED)
3. **Posting Queue** → Consumed decision, reused permit
4. **Twitter** → Posted reply tweet `2010054798754877533`
5. **Database** → Updated permit to USED, decision to posted
6. **Events** → Logged `reply_posted` event

## Code References

- Deferral healer: `src/jobs/deferralHealer.ts`
- Posting queue integration: `src/jobs/postingQueue.ts:1091-1110, 2495-2553`
- Success event logging: `src/jobs/postingQueue.ts:4797-4830`
- Permit reuse: `src/posting/postingPermit.ts:36-89`

## Status

✅ **GOLD PROOF PASS** - End-to-end reply posting verified with full trace chain and hardening implemented.

