# 🔒 INVARIANT ENFORCEMENT FIXES - January 2025

## CRITICAL ISSUES ADDRESSED

1. **Reply-threads being posted** (e.g., "2/6", "3/6")
2. **Replies inside reply-chains** (replying to replies instead of root tweets)
3. **Quota violations** (exceeding MAX_POSTS_PER_HOUR=2, MAX_REPLIES_PER_HOUR=4)

## PHASE 0: STOP THE BLEEDING ✅

**Commands Executed:**
```bash
railway variables --set "REPLIES_ENABLED=false" --set "DRAIN_QUEUE=true" --set "POSTING_ENABLED=false"
```

**Status:** ✅ Completed - Posting disabled

---

## PHASE 1: FORENSICS (IN PROGRESS)

**Bad Tweet IDs Identified:**
- `2008351265785360647` (shows "2/6" reply in-thread)
- `2008383011218170281` (replying to off-topic mention spam thread)

**Forensics Script Created:**
- `scripts/forensics-bad-tweets.ts` - Queries DB for bad tweet IDs and checks for violations

**Next Steps:**
- Run forensics script with proper .env loading
- Query Railway logs for build_sha fingerprints
- Check for multiple instances posting

---

## PHASE 2: CODE FIXES ✅

### FIX 1: Final Reply Gate in atomicPostExecutor ✅

**File:** `src/posting/atomicPostExecutor.ts`

**Changes:**
- Added **FINAL REPLY GATE** before posting (lines ~113-200)
- Enforces 3 critical invariants:
  1. **target_tweet_id must exist** - Blocks if missing
  2. **No thread-like content** - Rejects `/\b\d+\/\d+\b/`, `🧵`, multiple newlines
  3. **ROOT-ONLY** - Rejects if `root_tweet_id !== target_tweet_id`

**Fail-Closed Behavior:**
- Marks decision as `blocked` in DB
- Logs to `system_events` with `reply_gate_blocked` event
- Returns error without posting

**Code Location:**
```typescript
// Lines ~113-200 in atomicPostExecutor.ts
if (decision_type === 'reply') {
  // INVARIANT 1: target_tweet_id must exist
  // INVARIANT 2: Content must NOT contain thread markers
  // INVARIANT 3: root_tweet_id must equal target_tweet_id (ROOT-ONLY)
}
```

---

### FIX 2: Assertion to Prevent Reply Routing Through Thread Posting ✅

**File:** `src/jobs/postingQueue.ts`

**Changes:**
1. **In `processDecision()`** (line ~2483):
   - Added assertion: if `decision_type === 'reply'` inside `single/thread` block → throw + block

2. **In `postContent()`** (line ~3490):
   - Added assertion at function entry: if `decision_type === 'reply'` → throw + block
   - Marks decision as `blocked` with reason `reply_routed_through_postcontent_violation`

**Fail-Closed Behavior:**
- Throws error immediately
- Marks decision as `blocked` in DB
- Prevents any reply from being posted via thread posting path

**Code Location:**
```typescript
// Line ~2483 in postingQueue.ts (processDecision)
if (decision.decision_type === 'reply') {
  throw new Error(`[SEV_REPLY_THREAD_BLOCKED] CRITICAL: Reply decision routed through postContent!`);
}

// Line ~3490 in postingQueue.ts (postContent function)
if (decision.decision_type === 'reply') {
  throw new Error(`[SEV_REPLY_THREAD_BLOCKED] CRITICAL: Reply decision routed through postContent!`);
}
```

---

### FIX 3: Thread Continuation Fix ✅

**File:** `src/jobs/simpleThreadPoster.ts`

**Changes:**
- Changed `decision_type` from `'reply'` to `'thread'` for thread continuations (line ~176)
- Updated `pipeline_source` to `'simpleThreadPoster_thread_continuation'`

**Rationale:**
- Thread continuations (replying to previous tweet in thread) are NOT reply decisions
- They should be classified as `'thread'` not `'reply'` to avoid reply gate checks

**Code Location:**
```typescript
// Line ~176 in simpleThreadPoster.ts
decision_type: 'thread', // Thread continuation, not a reply decision
pipeline_source: 'simpleThreadPoster_thread_continuation',
```

---

### FIX 4: Concurrency-Safe Quota Enforcement ✅

**File:** `src/utils/contentRateLimiter.ts` (NEW)

**Changes:**
- Created new file for content posting rate limiting with PostgreSQL advisory locks
- Uses lock ID `987654322` (different from reply lock `987654321`)
- Wraps entire posting operation with lock
- Checks quota (rolling 60-minute window) while holding lock
- Prevents parallel workers from exceeding quota

**Integration:**
- `src/jobs/postingQueue.ts` line ~2517: Wraps `postContent()` call with `withContentLock()`

**How It Works:**
1. Acquire advisory lock (blocks other workers)
2. Check rate limit (count posts in last 60m)
3. Enforce MAX_POSTS_PER_HOUR=2
4. Execute posting operation
5. Release lock automatically (even on error)

**Code Location:**
```typescript
// src/utils/contentRateLimiter.ts
export async function withContentLock<T>(operation: () => Promise<T>): Promise<T> {
  // Acquire lock
  // Check quota
  // Execute operation
  // Release lock
}

// src/jobs/postingQueue.ts line ~2517
result = await withContentLock(async () => {
  return await postContent(decision);
});
```

**Note:** Reply quota enforcement already exists in `src/utils/replyRateLimiter.ts` with `withReplyLock()`.

---

## PHASE 3: VERIFICATION (PENDING)

### Required Verification Steps:

1. **Re-enable posting in controlled mode:**
   ```bash
   railway variables --set "POSTING_ENABLED=true"
   railway variables --set "REPLIES_ENABLED=true"
   railway variables --set "DRAIN_QUEUE=false"
   ```

2. **Trigger ONE controlled reply + ONE controlled post** via admin endpoints

3. **Show logs proving:** PREWRITE → POST → UPDATE for both

4. **Run SQL Quota Sanity Checks:**
   ```sql
   -- Count posts (all tweets posted) in last 60m
   SELECT COUNT(*) FROM content_generation_metadata_comprehensive
   WHERE status='posted' AND posted_at > NOW()-INTERVAL '60 minutes';
   
   -- Count replies in last 60m
   SELECT COUNT(*) FROM content_generation_metadata_comprehensive
   WHERE status='posted' AND decision_type='reply' AND posted_at > NOW()-INTERVAL '60 minutes';
   ```

5. **Check for Reply Invariant Violations (must be 0):**
   ```sql
   -- Thread-like reply violations
   SELECT COUNT(*) FROM content_generation_metadata_comprehensive
   WHERE status='posted' AND decision_type='reply'
     AND (content ~ '\m\d+/\d+\M' OR content LIKE '1/%' OR content LIKE '%🧵%' OR content LIKE E'%\n%')
     AND posted_at > NOW()-INTERVAL '24 hours';
   
   -- Target is reply violations
   SELECT COUNT(*) FROM content_generation_metadata_comprehensive
   WHERE status='posted' AND decision_type='reply'
     AND (target_in_reply_to_tweet_id IS NOT NULL
       OR (target_conversation_id IS NOT NULL AND target_conversation_id != target_tweet_id))
     AND posted_at > NOW()-INTERVAL '24 hours';
   ```

6. **Print `/status/reply` JSON** to verify system state

---

## SUMMARY OF CHANGES

### Files Modified:
1. `src/posting/atomicPostExecutor.ts` - Added final reply gate
2. `src/jobs/postingQueue.ts` - Added assertions + content lock wrapping
3. `src/jobs/simpleThreadPoster.ts` - Fixed thread continuation classification
4. `src/utils/contentRateLimiter.ts` - NEW: Content quota enforcement with locks

### Key Invariants Enforced:

1. ✅ **Replies target ROOT TWEETS ONLY** - Enforced in `atomicPostExecutor` + `checkReplySafetyGates`
2. ✅ **Replies are SINGLE TWEETS ONLY** - Enforced in `atomicPostExecutor` (no thread markers)
3. ✅ **DB TRUTH: Every post/reply has DB row** - Already enforced via prewrite
4. ✅ **QUOTAS enforced from DB with concurrency-safe locks** - `withContentLock()` + `withReplyLock()`
5. ✅ **Reply decisions NEVER route through thread posting** - Assertions in `postContent()` + `processDecision()`

---

## DEPLOYMENT CHECKLIST

- [ ] Review all code changes
- [ ] Run linter (✅ No errors)
- [ ] Test forensics script (requires .env)
- [ ] Deploy to Railway
- [ ] Re-enable posting in controlled mode
- [ ] Run verification SQL queries
- [ ] Monitor logs for `[REPLY_GATE]`, `[CONTENT_LOCK]`, `[SEV_REPLY_THREAD_BLOCKED]` messages
- [ ] Verify no violations in last 24h

---

## PROGRESS STATUS

- ✅ **Phase 0:** Stop bleeding - COMPLETE
- 🔄 **Phase 1:** Forensics - IN PROGRESS (script created, needs execution)
- ✅ **Phase 2:** Fixes - COMPLETE
- ⏳ **Phase 3:** Verification - PENDING

**Current Progress: ~75%** (Code fixes complete, forensics + verification pending)

