# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T18:13:34.682Z  
**Status:** ❌ FAIL

## Machine Info

- **Hostname:** Mac-312.lan
- **Platform:** darwin
- **Architecture:** arm64
- **Node Version:** v22.14.0
- **Runner Profile Dir:** /Users/jonahtenner/Desktop/xBOT/.runner-profile

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Control Decision Created | ✅ | control_posting_queue | - |
| Decision Queued | ✅ | queued | - |
| Decision Claimed | ❌ | queued | - |
| Attempt Recorded | ❌ | N/A | - |
| Result Recorded | ❌ | N/A | - |
| Success/Failure Event | ❌ | N/A | - |
| Exactly One Decision | ✅ | 1 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 0 | HARD |

## Evidence

- **Decision ID:** a40996ff-7809-4acf-a116-b38ebd2da90a
- **Proof Tag:** control-post-1769278241834
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A



## Log Excerpts

```
[POSTING_QUEUE] 🌐 Using reliable Playwright posting...
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 180000ms (attempt 1, retry_count=0)
[POSTING_GUARD] ✅ Guard created: decision_id=a33ba31c-a8d6-4a9f-a8cd-1e08eb4d80f0 source=postingQueue
[ATOMIC_POST]   decision_id=a33ba31c-a8d6-4a9f-a8cd-1e08eb4d80f0 type=single source=postingQueue build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a
[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...
[ATOMIC_POST] 🎫 Creating posting permit...
[POSTING_GUARD] ✅ Verified: decision_id=a33ba31c-a8d6-4a9f-a8cd-1e08eb4d80f0 source=postingQueue job=posting_1769278245975
[PROOF:control-post-1769277694463] [POST_TWEET] 📊 AUDIT_TRAIL: decision_id=a33ba31c-a8d6-4a9f-a8cd-1e08eb4d80f0 pipeline_source=postingQueue job_run_id=posting_1769278245975 build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a db_env=7ef9c43a
ULTIMATE_POSTER: Acquiring page from UnifiedBrowserPool (operation: tweet_posting)...
[BROWSER_POOL] 📝 Request: tweet_posting (queue: 0, active: 0, priority: 0)
[BROWSER_POOL][RECOVER] reason=browser_disconnected action=reset label=tweet_posting
[BROWSER_POOL][TIMEOUT] label=tweet_posting timeoutMs=300000
[BROWSER_POOL]   → tweet_posting-1769278246383-8lnas3krc: Starting...
[BROWSER_POOL]   ✅ tweet_posting-1769278246383-8lnas3krc: Completed (38ms)
ULTIMATE_POSTER: ✅ CreateTweet GraphQL response capture active (30s timeout)
[BROWSER_SEM] ⏱️ WARNING: posting taking longer than expected (150s)
/Users/jonahtenner/Desktop/xBOT/src/posting/UltimateTwitterPoster.ts:1800
          reject(new Error(`CreateTweet GraphQL response timeout (${timeoutMs}ms)`));
Error: CreateTweet GraphQL response timeout (30000ms)
    at Timeout._onTimeout (/Users/jonahtenner/Desktop/xBOT/src/posting/UltimateTwitterPoster.ts:1800:18)
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** queued
- **Error Message:** N/A

### Failure Event Data
No POST_FAILED event found

### Outcomes Result
No outcomes result found

### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed






