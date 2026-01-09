# PRODUCTION OPERATIONAL CERTIFICATION

**Date**: 2026-01-09  
**Status**: 🔄 **VERIFYING**  
**Goal**: Certify Reply System V2 is fully operational with at least 1 permit USED + posted_tweet_id

---

## ROOT CAUSE ANALYSIS

### Diagnosis Results

**A) Posting-Related Events (Last 60m)**:
- `posting_attempt_started: 13`
- `posting_blocked_wrong_service: 10` ← **BLOCKER #1**
- `posting_attempt_failed: 2`

**B) Posting Blocked Events**:
- `posting_blocked_wrong_service: 10` ← **ROOT CAUSE #1**

**C) Permit Statuses**:
- `REJECTED: 6` ← All permits rejected

**D) Rejected Permit Analysis**:
- **Reason Code**: `target_not_root` ← **ROOT CAUSE #2**
- **Error**: `root=null target=... is_root=false in_reply_to=none`
- **Issue**: `root_tweet_id` not set in scheduler decisions

### Root Causes Identified

**Issue #1**: Service identity check was using `RAILWAY_SERVICE_NAME` and `ROLE` env vars, but we switched to `SERVICE_ROLE` as the single source of truth. The posting code was still checking the old env vars, causing all posts to be blocked.

**Issue #2**: `pipeline_source` mismatch - `postingQueue.ts` was using `'postingQueue_reply'` but permits are created with `'reply_v2_scheduler'`.

**Issue #3**: `root_tweet_id` not set in scheduler decisions, causing permit approval to reject all permits with `target_not_root` error.

---

## FIXES IMPLEMENTED

### Fix 1: Service Identity Check

**Files Modified**:
- `src/posting/UltimateTwitterPoster.ts` (2 locations)
- `src/posting/BulletproofThreadComposer.ts`

**Change**: Updated service identity check to use `SERVICE_ROLE` env var:

```typescript
const serviceRole = (process.env.SERVICE_ROLE || '').toLowerCase();
const isWorker = serviceRole === 'worker';
```

### Fix 2: Pipeline Source Mismatch

**File Modified**: `src/jobs/postingQueue.ts`

**Change**: Updated `pipeline_source` to match permit:

```typescript
pipeline_source: 'reply_v2_scheduler', // Must match permit's pipeline_source
```

### Fix 3: Root Tweet ID Not Set

**File Modified**: `src/jobs/replySystemV2/tieredScheduler.ts`

**Change**: Set `root_tweet_id = target_tweet_id` in both decision tables:

```typescript
root_tweet_id: candidate.candidate_tweet_id, // 🔒 CRITICAL: Set root_tweet_id = target_tweet_id for root-only replies
```

---

## DEPLOYMENT

**Commands Executed**:
```bash
git commit -m "Fix posting blocker: use SERVICE_ROLE for service check, fix pipeline_source mismatch"
git commit -m "Fix remaining SERVICE_ROLE check and pipeline_source in atomicPostExecutor"
git commit -m "Fix root_tweet_id not set in scheduler decisions"
railway up --detach -s xBOT
railway up --detach -s serene-cat
railway redeploy -s serene-cat -y
```

**Expected SHA**: `745e4215`

**Status**: ✅ **DEPLOYED**

---

## VERIFICATION (POST-DEPLOY)

### Certification Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1+ `post_attempts` row status=USED with `posted_tweet_id` | 🔄 | [Verifying] |
| 1+ `posting_attempt_success` event | 🔄 | [Verifying] |
| 0 new ghosts since deploy timestamp | 🔄 | [Verifying] |
| Running git_sha matches HEAD in boot heartbeat | 🔄 | [Verifying] |

### Results

**1) Permits USED with tweet_id**: [Will be populated]  
**2) Posting success events**: [Will be populated]  
**3) New ghosts since deploy**: [Will be populated]  
**4) Running SHA match**: [Will be populated]  
**5) Recent permit statuses**: [Will be populated]

---

## VERDICT

**Status**: 🔄 **VERIFYING**

**Blockers Fixed**: ✅ Service identity check, pipeline_source mismatch, root_tweet_id not set  
**Deployed**: ✅ Worker service redeployed  
**Verification**: ⏳ Waiting for post-deploy metrics

**Overall**: 🔄 **VERIFYING** - All fixes deployed, awaiting proof

---

**Report Generated**: 2026-01-09T23:45:00
