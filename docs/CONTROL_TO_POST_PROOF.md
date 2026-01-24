# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T18:02:47.222Z  
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

- **Decision ID:** a33ba31c-a8d6-4a9f-a8cd-1e08eb4d80f0
- **Proof Tag:** control-post-1769277694463
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A



## Log Excerpts

```
🚩 FEATURE_FLAGS: mode=live posting=ON
[POSTING_QUEUE] 🔒 Successfully claimed decision 01f1bf12-f0d5-4327-98d0-f44af6884948 for posting
[CONTENT_RATE_LIMIT] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769276918227)
[POSTING_QUEUE][SEM_TIMEOUT] decision_id=01f1bf12-f0d5-4327-98d0-f44af6884948 type=single timeoutMs=300000 priority=-1 proof_tag=control-post-1769276918227
[BROWSER_SEM] 🔓 posting acquired browser (priority -1)
[POSTING_QUEUE] 🌐 Using reliable Playwright posting...
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 180000ms (attempt 1, retry_count=0)
[POSTING_GUARD] ✅ Guard created: decision_id=01f1bf12-f0d5-4327-98d0-f44af6884948 source=postingQueue
[ATOMIC_POST]   decision_id=01f1bf12-f0d5-4327-98d0-f44af6884948 type=single source=postingQueue build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a
[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...
[ATOMIC_POST] 🎫 Creating posting permit...
[POSTING_GUARD] ✅ Verified: decision_id=01f1bf12-f0d5-4327-98d0-f44af6884948 source=postingQueue job=posting_1769277699021
[PROOF:control-post-1769276918227] [POST_TWEET] 📊 AUDIT_TRAIL: decision_id=01f1bf12-f0d5-4327-98d0-f44af6884948 pipeline_source=postingQueue job_run_id=posting_1769277699021 build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a db_env=7ef9c43a
ULTIMATE_POSTER: Acquiring page from UnifiedBrowserPool (operation: tweet_posting)...
[BROWSER_POOL] 📝 Request: tweet_posting (queue: 0, active: 0, priority: 0)
[BROWSER_POOL][RECOVER] reason=browser_disconnected action=reset label=tweet_posting
[BROWSER_POOL][TIMEOUT] label=tweet_posting timeoutMs=300000
[BROWSER_POOL]   → tweet_posting-1769277699467-lc0rkeyrs: Starting...
[BROWSER_POOL]   ✅ tweet_posting-1769277699467-lc0rkeyrs: Completed (38ms)
ULTIMATE_POSTER: ✅ CreateTweet GraphQL response capture active (30s timeout)
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

**Failure Code:** EXECUTOR_NOT_TICKING

**Failure Message:** No EXECUTOR_DAEMON_TICK events found after 61s




