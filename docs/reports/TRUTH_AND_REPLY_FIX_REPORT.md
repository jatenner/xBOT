# Truth & Reply Quality Fix Report

**Date:** 2025-12-18  
**Engineer:** xBOT Truth + Reply Quality Lead  
**Status:** 🟡 IN PROGRESS

---

## Executive Summary

Addressing 3 critical issues:
1. **Thread reality mismatch**: Threads visible on X but not recorded in DB
2. **Reply quality**: Contextless, too long, bot-like replies
3. **Truth instrumentation**: Ironclad proof that posts succeeded

---

## Phase 1: Diagnosis — COMPLETED ✅

### 1.1 Thread Verification Script

**Created:** `scripts/verify-threads-last6h.ts`

**Purpose:** Diagnostic script to prove thread truth by querying DB for last 6h of posted decisions and detecting threads based on `thread_tweet_ids length >= 2`.

**Command:** `pnpm verify:threads:last6h`

**Initial Findings (Last 6H):**
```
Total posted: 4
Singles: 3
Threads (thread_tweet_ids_len >= 2): 0
Replies: 1
Thread-intended but not recorded: 0
```

**Conclusion:** No threads with `thread_tweet_ids_len >= 2` found in last 6 hours, confirming the mismatch.

### 1.2 THREAD_RESULT Logging

**Added logging at post completion:**

**In `BulletproofThreadComposer.ts`:**
- `postViaReplies()`: Logs `[THREAD_RESULT] mode=REPLY_CHAIN root_tweet_id=... tweet_ids_count=N tweet_ids=...`
- `postViaComposer()`: Logs `[THREAD_RESULT] mode=NATIVE_COMPOSER root_tweet_id=... tweet_ids_count=1 tweet_ids=...`

**In `postingQueue.ts`:**
- Added `[DB_THREAD_SAVE]` log before `markDecisionPosted()` when `tweetIds.length >= 2`

**Evidence:** These logs will fire BEFORE `markDecisionPosted()`, providing ironclad proof of what IDs were captured.

---

## Phase 2: Fix Thread Recording — IN PROGRESS 🔄

### 2.1 Root Cause Analysis

**Problem:** `BulletproofThreadComposer.post()` returns different shapes:
- Native composer: `{ rootUrl, tweetIds: [] }` (empty array)
- Reply chain: `{ rootUrl, tweetIds: ['id1', 'id2', ...] }` (populated array)

**Impact:** When native composer succeeds, `tweetIds` is empty, so `markDecisionPosted()` receives `tweetIds=[]` and doesn't save `thread_tweet_ids`.

### 2.2 Fix Strategy

**Normalize post result shape:**
1. Native composer should return `tweetIds: [rootTweetId]` (single-element array)
2. Reply chain already returns full array
3. `postingQueue.ts` already extracts and passes `result.tweetIds` to `markDecisionPosted()`

**Implementation:** (PENDING)
- Modify `postViaComposer()` to extract root tweet ID and return `tweetIds: [rootTweetId]`
- Ensure `markDecisionPosted()` always saves `thread_tweet_ids` when `tweetIds.length >= 1`

---

## Phase 3: Fix Reply Quality — PENDING ⏳

### 3.1 Context Fetching

**Goal:** Fetch target tweet text + parent tweet text (1 hop) when generating replies.

**Implementation Plan:**
- Add `fetchReplyContext()` function in `replyJob.ts`
- Store context with decision payload
- Log `[REPLY_CTX] decision_id=... target_excerpt="..." parent_excerpt="..."`

### 3.2 Reply Quality Gates

**Contract:**
- Output <= 280 chars, 1-2 sentences
- Include at least 1 concrete reference to target tweet
- Quality gate: if fails, regenerate up to 2 times, else skip posting and mark `failed_soft`

### 3.3 Reply Style Router

**Styles:**
- witty-smart
- crisp-educational
- curious-question

**Logging:** `[REPLY_GEN] decision_id=... style=... chars=... overlapScore=...`

---

## Phase 4: Verification — PENDING ⏳

### 4.1 Scripts

- ✅ `pnpm verify:threads:last6h` — Created
- ⏳ `pnpm verify:replies:sample20` — Pending

### 4.2 Force Test Cases

**Thread Test:**
1. Force a thread decision
2. Wait until it posts
3. Confirm:
   - `[THREAD_RESULT] tweet_ids_count>=2`
   - `[DB_THREAD_SAVE] tweet_ids_count>=2`
   - Supabase `thread_tweet_ids_len>=2`

**Reply Test:**
1. Generate 20 replies (dry-run)
2. Write report with pass/fail reasons

---

## Phase 5: Deployment & Final Verification — PENDING ⏳

### 5.1 Deployment Checklist

- [ ] Commit all changes
- [ ] Push to main
- [ ] Set Railway vars (if needed)
- [ ] Monitor logs for new signals

### 5.2 Evidence Collection

**Before Metrics:**
- Posted threads (last 24h): 1
- Thread `tweet_ids_count=1`: 1
- Threads with `thread_tweet_ids_len >= 2`: 0

**After Metrics:** (Pending)

**Log Evidence:** (Pending)

**Supabase Rows:** (Pending)

---

## Verdict

**Current Status:** 🟡 YELLOW

**Phase 1:** ✅ Complete  
**Phase 2:** 🔄 In Progress  
**Phase 3:** ⏳ Pending  
**Phase 4:** ⏳ Pending  
**Phase 5:** ⏳ Pending

**Next Action:** Complete Phase 2 (normalize thread result shape) and deploy for testing.

---

**Report Generated:** 2025-12-18T21:30:00Z

