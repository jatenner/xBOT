# Thread Verification + Duplicate SUCCESS Fix Report

**Date:** December 18, 2025  
**Commit:** `010453ff` + `1d286a26`

---

## PART A: Thread Timeout Investigation

**Thread Processing + Outcomes:**
```
708:[POSTING_QUEUE] 🧵 Processing thread: 8392c954-4eee-443c-bd98-174511da9e9b
733:[POSTING_QUEUE] 🧵 🔍 DEBUG: decision_id=8392c954-4eee-443c-bd98-174511da9e9b decision_type=thread
735:[POSTING_QUEUE][SEM_TIMEOUT] decision_id=8392c954-4eee-443c-bd98-174511da9e9b type=thread timeoutMs=360000
946:[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=8392c954-4eee-443c-bd98-174511da9e9b decision_type=thread error_name=Error error_message=Playwright posting failed: thread_post_7_tweets timed out after 240000ms

1311:[POSTING_QUEUE] 🧵 Processing thread: 07eec120-cc5e-4d6c-bf43-58e4322da57d
1341:[POSTING_QUEUE] 🧵 🔍 DEBUG: decision_id=07eec120-cc5e-4d6c-bf43-58e4322da57d decision_type=thread
1343:[POSTING_QUEUE][SEM_TIMEOUT] decision_id=07eec120-cc5e-4d6c-bf43-58e4322da57d type=thread timeoutMs=360000
1949:[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=07eec120-cc5e-4d6c-bf43-58e4322da57d decision_type=thread error_name=Error error_message=Playwright posting failed: thread_post_7_tweets timed out after 240000ms

1988:[POSTING_QUEUE] 🧵 Processing thread: 8e991781-8a83-40a8-bec3-9ef124088275
2017:[POSTING_QUEUE] 🧵 🔍 DEBUG: decision_id=8e991781-8a83-40a8-bec3-9ef124088275 decision_type=thread
2019:[POSTING_QUEUE][SEM_TIMEOUT] decision_id=8e991781-8a83-40a8-bec3-9ef124088275 type=thread timeoutMs=360000
2676:[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=8e991781-8a83-40a8-bec3-9ef124088275 decision_type=thread error_name=Error error_message=Playwright posting failed: thread_post_6_tweets timed out after 240000ms
```

**Thread Failure Reasons:**
```
1383:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="Eating like a caveman for 30 days sounds wild, but here's a surprising twist: ma"
1712:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="Eating like a caveman for 30 days sounds wild, but here's a surprising twist: ma"
1849:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="Sea vegetables are a nutritional powerhouse! 🌊 Did you know they contain up to "
2070:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="Sea vegetables are a nutritional powerhouse! 🌊 Did you know they contain up to "
2235:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="📊 1/6 🥐 I stopped eating breakfast for a month. What happened? Let's dive into"
2548:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="📊 1/6 🥐 I stopped eating breakfast for a month. What happened? Let's dive into"
2555:🧵 THREAD_COMPOSER_FAILED (attempt 1): TEXT_VERIFY_FAIL idx=0 got="" want~="Sea vegetables are a nutritional powerhouse! 🌊 Did you know they contain up to "
```

**Timeout Analysis:**
- Threads timing out at **240s** (from `BulletproofThreadComposer` adaptive timeout, attempt 1)
- BrowserSemaphore configured for **360s** timeout (correct)
- UnifiedBrowserPool configured for **360s** timeout (correct)
- **No 180s timeouts for threads** - 180s timeout is only for `metrics_batch` (background operation)

**Root Cause:** Threads are timing out at 240s (BulletproofThreadComposer's attempt 1 timeout) before reaching BrowserSemaphore's 360s timeout. This suggests the timeout is coming from within the thread composer's retry logic.

---

## PART B: Duplicate SUCCESS Log Investigation

**SUCCESS Log Locations Found:**
1. **Line 2125:** `src/jobs/postingQueue.ts` - In `processDecision()` after `markDecisionPosted()` succeeds
2. **Line 2949:** `src/jobs/postingQueue.ts` - Inside `markDecisionPosted()` after DB save succeeds

**Evidence:**
```
1812:[POSTING_QUEUE][SUCCESS] decision_id=d1af4051-17d1-4161-babd-d9dc72842781 type=unknown tweet_id=2001706836119163235
1815:[POSTING_QUEUE][SUCCESS] decision_id=d1af4051-17d1-4161-babd-d9dc72842781 type=reply tweet_id=2001706836119163235

2189:[POSTING_QUEUE][SUCCESS] decision_id=fbbcf4f5-2dec-42f0-b983-a3331d941b5c type=unknown tweet_id=2001708003121066289
2192:[POSTING_QUEUE][SUCCESS] decision_id=fbbcf4f5-2dec-42f0-b983-a3331d941b5c type=single tweet_id=2001708003121066289

4973:[POSTING_QUEUE][SUCCESS] decision_id=09427a77-bbcc-4d55-9d1f-36b9d55e8ab6 type=unknown tweet_id=2001711480882729036
4976:[POSTING_QUEUE][SUCCESS] decision_id=09427a77-bbcc-4d55-9d1f-36b9d55e8ab6 type=reply tweet_id=2001711480882729036
```

**Root Cause:** 
- `markDecisionPosted()` logs `[POSTING_QUEUE][SUCCESS]` internally at line 2949 with `type=unknown`
- Caller (`processDecision()`) also logs `[POSTING_QUEUE][SUCCESS]` at line 2125 with correct `decision.decision_type`
- Result: Every successful post logs SUCCESS twice (once with `type=unknown`, once with correct type)

---

## PART C: Results

**THREAD STATUS:**
- **success threads found?** 0
- **last thread success lines:** None found
- **last thread failure line:** 
  - `2676:[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=8e991781-8a83-40a8-bec3-9ef124088275 decision_type=thread error_name=Error error_message=Playwright posting failed: thread_post_6_tweets timed out after 240000ms`
- **stall reason:** TEXT_VERIFY_FAIL (paste verification failing, textarea remains empty) + 240s timeout (BulletproofThreadComposer attempt 1 timeout)

**TIMEOUT SOURCE:**
- **Thread timeouts:** Occurring at **240s** (BulletproofThreadComposer adaptive timeout for attempt 1)
- **BrowserSemaphore:** Using **360s** timeout for thread_posting (correct, but not reached)
- **UnifiedBrowserPool:** Using **360s** timeout for thread_posting (correct, but not reached)
- **180s timeout:** Only for `metrics_batch` (background operation, not threads)

**Analysis:** Threads are timing out at 240s from `BulletproofThreadComposer.getThreadTimeoutMs(0)` which returns 240000ms for attempt 1. This timeout is enforced before BrowserSemaphore's 360s timeout can take effect.

**DUPLICATE SUCCESS ROOT CAUSE:**
- **where it logs from:** 
  - Line 2125: `processDecision()` function (caller) - logs with correct `decision.decision_type`
  - Line 2949: `markDecisionPosted()` function (callee) - logs with `type=unknown`
- **why it logs twice:** 
  - `markDecisionPosted()` logs SUCCESS internally after DB save succeeds (line 2949)
  - Caller (`processDecision()`) also logs SUCCESS after `markDecisionPosted()` returns (line 2125)
  - Both logs fire for every successful post
- **single-file fix proposal:**

**File:** `src/jobs/postingQueue.ts`

**BEFORE (line 2947-2949):**
```typescript
        dbSaveSuccess = true;
        console.log(`[POSTING_QUEUE] ✅ Database updated (attempt ${dbAttempt}/${MAX_DB_RETRIES}): tweet_id ${tweetId} saved for decision ${decisionId}`);
        
        // ✅ EXPLICIT SUCCESS LOG: Log after DB save confirms post is complete
        const finalTweetUrl = tweetUrl || `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetId}`;
        console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decisionId} type=unknown tweet_id=${tweetId} url=${finalTweetUrl}`);
        
        break; // Success - exit retry loop
```

**AFTER (line 2947-2951):**
```typescript
        dbSaveSuccess = true;
        console.log(`[POSTING_QUEUE] ✅ Database updated (attempt ${dbAttempt}/${MAX_DB_RETRIES}): tweet_id ${tweetId} saved for decision ${decisionId}`);
        
        // ✅ SUCCESS log removed - caller (processDecision) will log SUCCESS with correct decision_type
        // Removed duplicate: console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decisionId} type=unknown tweet_id=${tweetId} url=${finalTweetUrl}`);
        
        break; // Success - exit retry loop
```

**Rationale:** 
- Caller (`processDecision()`) has access to `decision.decision_type` (single/thread/reply)
- `markDecisionPosted()` only knows `type=unknown` (less accurate)
- Single source of truth: caller logs SUCCESS with correct type at line 2125
- Prevents duplicate logs and ensures accurate `decision_type` in logs

---

**Report Generated:** December 18, 2025
