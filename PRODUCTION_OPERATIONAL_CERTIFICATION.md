# PRODUCTION OPERATIONAL CERTIFICATION

**Date**: 2026-01-09  
**Status**: 🔄 **VERIFYING**  
**Goal**: Certify Reply System V2 is fully operational with at least 1 permit USED + posted_tweet_id

---

## ROOT CAUSE ANALYSIS

### Diagnosis Results

**A) Posting-Related Events (Last 60m)**:
- `posting_attempt_started: 13`
- `posting_blocked_wrong_service: 10` ← **BLOCKER**
- `posting_attempt_failed: 2`

**B) Posting Blocked Events**:
- `posting_blocked_wrong_service: 10` ← **ROOT CAUSE**

**C) Permit Statuses**:
- `REJECTED: 6` ← All permits rejected

**D) Newest Permits**:
- All 5 newest permits have `status=REJECTED`
- All created in last 60 minutes
- All have `pipeline_source='reply_v2_scheduler'`

### Root Cause Identified

**Issue**: Service identity check was using `RAILWAY_SERVICE_NAME` and `ROLE` env vars, but we switched to `SERVICE_ROLE` as the single source of truth. The posting code was still checking the old env vars, causing all posts to be blocked.

**Additional Issue**: `postingQueue.ts` was using `pipeline_source='postingQueue_reply'` but permits are created with `pipeline_source='reply_v2_scheduler'`, causing a mismatch.

---

## FIXES IMPLEMENTED

### Fix 1: Service Identity Check

**Files Modified**:
- `src/posting/UltimateTwitterPoster.ts` (2 locations)
- `src/posting/BulletproofThreadComposer.ts`

**Change**: Updated service identity check to use `SERVICE_ROLE` env var instead of `RAILWAY_SERVICE_NAME`/`ROLE`:

```typescript
// OLD:
const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown';
const role = process.env.ROLE || 'unknown';
const isWorker = serviceName.toLowerCase().includes('worker') || role.toLowerCase() === 'worker';

// NEW:
const serviceRole = (process.env.SERVICE_ROLE || '').toLowerCase();
const isWorker = serviceRole === 'worker';
```

### Fix 2: Pipeline Source Mismatch

**File Modified**: `src/jobs/postingQueue.ts`

**Change**: Updated `pipeline_source` in posting guard to match permit:

```typescript
// OLD:
pipeline_source: 'postingQueue_reply',

// NEW:
pipeline_source: 'reply_v2_scheduler', // Must match permit's pipeline_source
```

---

## DEPLOYMENT

**Commands Executed**:
```bash
git add -A
git commit -m "Fix posting blocker: use SERVICE_ROLE for service check, fix pipeline_source mismatch"
git push origin main
railway up --detach -s xBOT
railway up --detach -s serene-cat
```

**Expected SHA**: [Will be populated]

**Status**: ✅ **DEPLOYED**

---

## VERIFICATION (POST-DEPLOY)

### A) Posting Events (Last 10m)

**Results**: [Will be populated]

### B) Permit Statuses (Last 10m)

**Results**: [Will be populated]

### C) Newest Permits

**Results**: [Will be populated]

### D) Permits USED with tweet_id (Last 10m)

**Count**: [Will be populated]

---

## CERTIFICATION CRITERIA

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1+ `posting_attempt_success` event | [ ] | [Will be populated] |
| 1+ `post_attempts` row status=USED with `posted_tweet_id` | [ ] | [Will be populated] |
| 0 new ghosts since deploy timestamp | [ ] | [Will be populated] |
| Running git_sha matches HEAD in boot heartbeat | [ ] | [Will be populated] |

---

## VERDICT

**Status**: 🔄 **VERIFYING**

**Blockers Fixed**: ✅ Service identity check, pipeline_source mismatch  
**Deployed**: ✅ Both services redeployed  
**Verification**: ⏳ Waiting for post-deploy metrics

**Overall**: 🔄 **VERIFYING** - Fixes deployed, awaiting proof

---

**Report Generated**: 2026-01-09T23:30:00

