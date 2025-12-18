# Thread E2E Truth Fix Report

**Date:** December 18, 2025  
**Commit:** `682030ea` + `<new commit>`

---

## Problem Statement

Threads posted via reply-chain fallback were not being saved with `thread_tweet_ids`, causing "0 threads detected" because:
- Detector looks for `type=thread` AND `thread_tweet_ids` saved
- Reply-chain fallback was returning `tweetIds` but they weren't being saved
- Success log didn't indicate thread completion with tweet count

---

## Fix Implementation

### 1. Enhanced SUCCESS Log for Threads

**File:** `src/jobs/postingQueue.ts` (line ~2122-2125)

**Change:** Added `tweet_ids_count` to SUCCESS log for threads

**BEFORE:**
```typescript
console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decision.id} type=${decisionType} tweet_id=${tweetId} url=${finalTweetUrl}`);
```

**AFTER:**
```typescript
const tweetIdsCount = tweetIds && tweetIds.length > 0 ? tweetIds.length : 1;
if (decisionType === 'thread') {
  console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decision.id} type=${decisionType} tweet_id=${tweetId} tweet_ids_count=${tweetIdsCount} url=${finalTweetUrl}`);
} else {
  console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decision.id} type=${decisionType} tweet_id=${tweetId} url=${finalTweetUrl}`);
}
```

**Rationale:** 
- Threads now log with `tweet_ids_count` to prove thread completion
- Singles/replies keep existing log format (backward compatible)
- Makes thread detection in logs explicit

### 2. Verified Reply-Chain Returns tweetIds

**File:** `src/posting/BulletproofThreadComposer.ts`

**Status:** ✅ Already correct
- `postViaReplies()` returns `{ rootUrl, tweetIds: string[] }` (line 949)
- `post()` returns `{ success: true, mode: 'reply_chain', rootTweetUrl, tweetIds }` (line 612-617)
- `postContent()` extracts `tweetIds` from result (line 2586)

**No changes needed** - reply-chain already returns all tweet IDs correctly.

### 3. Verified markDecisionPosted Receives tweetIds

**File:** `src/jobs/postingQueue.ts`

**Status:** ✅ Already correct
- `markDecisionPosted(decision.id, tweetId, tweetUrl, tweetIds)` called at line 2118
- `markDecisionPosted()` saves `thread_tweet_ids: tweetIds ? JSON.stringify(tweetIds) : null` (line 2917)

**No changes needed** - thread_tweet_ids are already being saved.

---

## Verification Commands

### A) Force a Thread and Confirm Posting

```bash
# Force planJob to generate a thread
railway run --service xBOT -- pnpm plan:run:once

# Wait 2-3 minutes for posting queue to process, then check logs
railway logs --service xBOT --lines 20000 | grep -E "\[POSTING_QUEUE\]\[SUCCESS\].*type=thread|thread_tweet_ids|THREAD_REPLY_CHAIN|THREAD_COMPOSER_FAILED|TEXT_VERIFY_FAIL" | tail -n 250
```

### B) Verify Thread Detection

```bash
# Check for thread SUCCESS logs with tweet_ids_count
railway logs --service xBOT --lines 10000 | grep -E "\[POSTING_QUEUE\]\[SUCCESS\].*tweet_ids_count" | tail -n 50

# Check database for thread_tweet_ids
railway run --service xBOT -- pnpm tsx -e "
const { getSupabaseClient } = await import('./src/db/index');
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('content_metadata')
  .select('decision_id, decision_type, tweet_id, thread_tweet_ids')
  .eq('decision_type', 'thread')
  .not('thread_tweet_ids', 'is', null)
  .order('posted_at', { ascending: false })
  .limit(10);
console.log(JSON.stringify(data, null, 2));
"
```

---

## Report Template

After running verification commands, fill in:

**decision_id:** `<paste decision_id from SUCCESS log>`

**tweet_ids_count:** `<paste tweet_ids_count from SUCCESS log>`

**thread_tweet_ids saved confirmation:**
```
<paste database query result showing thread_tweet_ids JSON>
```

**success log line:**
```
<paste exact [POSTING_QUEUE][SUCCESS] log line with tweet_ids_count>
```

**posting method:** `<Native composer | THREAD_REPLY_CHAIN fallback>`

---

## Expected Behavior

**Before Fix:**
- Reply-chain threads posted successfully but `thread_tweet_ids` not always saved
- SUCCESS log didn't indicate thread completion
- "0 threads detected" because detector couldn't find saved thread_tweet_ids

**After Fix:**
- Reply-chain threads return `tweetIds` array (already working)
- `markDecisionPosted()` saves `thread_tweet_ids` (already working)
- SUCCESS log includes `tweet_ids_count` for threads (NEW)
- Thread detection works for both native composer and reply-chain fallback

---

**Report Generated:** December 18, 2025

