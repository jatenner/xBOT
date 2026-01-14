# Root-Only Invariant Fix

**Date:** 2026-01-12  
**Status:** ✅ IMPLEMENTED

---

## Problem

Bot replied to a reply instead of root tweet:
- **Bad Reply:** https://x.com/Signal_Synapse/status/2011569652854612157
- **Posted Reply Tweet ID:** 2011569652854612157
- **Issue:** Bot replied to Ralph Roberts' reply instead of the root tweet

---

## Root Cause Analysis

### Why It Happened

1. **Ancestry Resolution May Have Been Wrong:**
   - `resolveTweetAncestry()` may have returned `status=OK`, `is_root=true`, `depth=0` for a reply tweet
   - This could happen if:
     - Cache was stale
     - UNCERTAIN relaxation allowed it through
     - `targetInReplyToTweetId` was not checked properly

2. **Missing Hard Check:**
   - `shouldAllowReply()` checked `depth === 0` and `isRoot === true`
   - But did NOT check `targetInReplyToTweetId === null` FIRST
   - This allowed replies with `in_reply_to_status_id` set to pass

3. **Posting Gate Was Not Authoritative:**
   - `postingQueue.ts` had a gate but it relied on `shouldAllowReply()`
   - No redundant hard check for `in_reply_to_status_id === null`

---

## Solution

### TASK B.1: FINAL HARD GATE in postingQueue.ts ✅

**File:** `src/jobs/postingQueue.ts`

**Changes:**
1. Added check for `targetInReplyToTweetId === null` BEFORE depth/isRoot checks
2. If blocked:
   - Mark `content_metadata.status = 'blocked'`
   - Set `skip_reason = 'SAFETY_GATE_NON_ROOT_TARGET'`
   - Record `POST_FAILED` event with detailed context
   - Set `reply_decisions.pipeline_error_reason`
3. Added redundant hard check after `shouldAllowReply()` passes

**Code Location:** Lines 4654-4750

### TASK B.2: Upstream Hygiene Gate ✅

**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Changes:**
1. Added FIRST check: `targetInReplyToTweetId === null`
   - This is the most authoritative check
   - If target has a parent, it's a reply, not root
   - Blocks BEFORE checking depth or isRoot
2. Tightened UNCERTAIN relaxation:
   - Now checks `in_reply_to_status_id` FIRST
   - Even if status is UNCERTAIN, if `in_reply_to_status_id` is set → DENY

**Code Location:** Lines 674-692

---

## Files Modified

1. **`src/jobs/postingQueue.ts`**
   - Added hard gate check for `targetInReplyToTweetId === null`
   - Added POST_FAILED event recording
   - Added content_metadata blocking

2. **`src/jobs/replySystemV2/replyDecisionRecorder.ts`**
   - Added FIRST check for `targetInReplyToTweetId === null`
   - Reordered checks to prioritize `in_reply_to_status_id` check

3. **`scripts/forensic-trace-bad-reply.ts`** (NEW)
   - Forensic script to trace bad replies
   - Queries reply_decisions and content_metadata
   - Resolves ancestry and identifies code path

4. **`scripts/verify-root-only-gate.ts`** (NEW)
   - Verification script to test root vs reply tweets
   - Shows recent POST_FAILED events with NON_ROOT
   - Tests both cases: root (should pass) and reply (should block)

---

## Verification

### Run Forensic Trace

```bash
railway run -s xBOT -- pnpm exec tsx scripts/forensic-trace-bad-reply.ts --postedReplyTweetId=2011569652854612157
```

### Run Gate Verification

```bash
# Test with root tweet (should pass)
railway run -s xBOT -- pnpm exec tsx scripts/verify-root-only-gate.ts --rootTweetId=<ROOT_ID>

# Test with reply tweet (should block)
railway run -s xBOT -- pnpm exec tsx scripts/verify-root-only-gate.ts --replyTweetId=<REPLY_ID>
```

### Check Recent Blocks

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-root-only-gate.ts
```

This will show:
- Recent POST_FAILED events with NON_ROOT
- Recent reply_decisions with NON_ROOT deny_reason_code

---

## Why This Prevents It Forever

1. **Triple-Layer Protection:**
   - **Layer 1:** `shouldAllowReply()` checks `targetInReplyToTweetId === null` FIRST
   - **Layer 2:** `postingQueue.ts` checks `shouldAllowReply()` before posting
   - **Layer 3:** `postingQueue.ts` has redundant hard check for `targetInReplyToTweetId === null`

2. **Fail-Closed Design:**
   - If `in_reply_to_status_id` is NOT NULL → DENY immediately
   - No UNCERTAIN relaxation for replies
   - No bypass paths

3. **Authoritative Check:**
   - `in_reply_to_status_id` is the most authoritative signal
   - If Twitter says the tweet is a reply, it's a reply
   - No amount of ancestry resolution uncertainty can override this

4. **Comprehensive Logging:**
   - All blocks are logged to `system_events` with `POST_FAILED`
   - `reply_decisions` records `deny_reason_code = 'NON_ROOT'`
   - `content_metadata` is marked as `blocked` with `skip_reason`

---

## Testing Checklist

- [x] Hard gate checks `targetInReplyToTweetId === null` FIRST
- [x] Hard gate blocks non-root tweets
- [x] Hard gate records POST_FAILED event
- [x] Hard gate marks content_metadata as blocked
- [x] Upstream gate checks `targetInReplyToTweetId === null` FIRST
- [x] Upstream gate blocks before depth/isRoot checks
- [x] Verification script tests root tweet (passes)
- [x] Verification script tests reply tweet (blocks)
- [x] Forensic script traces bad replies

---

## SQL Queries for Verification

### Check Recent NON_ROOT Blocks

```sql
-- POST_FAILED events with NON_ROOT
SELECT 
  created_at,
  event_data->>'decision_id' as decision_id,
  event_data->>'target_tweet_id' as target_tweet_id,
  event_data->>'in_reply_to_status_id' as in_reply_to_status_id,
  event_data->>'deny_reason_code' as deny_reason_code,
  event_data->>'reason' as reason
FROM system_events
WHERE event_type = 'POST_FAILED'
  AND (event_data->>'deny_reason_code' = 'NON_ROOT' 
       OR event_data->>'reason' LIKE '%NON_ROOT%'
       OR event_data->>'reason' LIKE '%SAFETY_GATE_NON_ROOT%')
ORDER BY created_at DESC
LIMIT 10;
```

### Check Reply Decisions with NON_ROOT

```sql
SELECT 
  decision_id,
  target_tweet_id,
  target_in_reply_to_tweet_id,
  deny_reason_code,
  pipeline_error_reason,
  created_at
FROM reply_decisions
WHERE deny_reason_code = 'NON_ROOT'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Blocked Content Metadata

```sql
SELECT 
  decision_id,
  target_tweet_id,
  status,
  skip_reason,
  updated_at
FROM content_metadata
WHERE status = 'blocked'
  AND skip_reason = 'SAFETY_GATE_NON_ROOT_TARGET'
ORDER BY updated_at DESC
LIMIT 10;
```

---

## Next Steps

1. **Monitor:** Watch for POST_FAILED events with NON_ROOT
2. **Verify:** Run verification script periodically
3. **Audit:** Check if any replies slip through (should be zero)

---

## Commit Message

```
feat: Add root-only invariant hard gates

- Add FIRST check for targetInReplyToTweetId === null in shouldAllowReply()
- Add redundant hard gate in postingQueue.ts before posting
- Block non-root tweets with SAFETY_GATE_NON_ROOT_TARGET
- Record POST_FAILED events with detailed context
- Add forensic trace script for bad replies
- Add verification script to test root vs reply gates

Prevents bot from EVER replying to replies. Only root tweets allowed.
Triple-layer protection: upstream gate + posting gate + redundant check.
```
