# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T18:39:00.914Z  
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

- **Decision ID:** 0b19165a-7f7d-46a9-bf14-f4900e3ca5d1
- **Proof Tag:** control-post-1769279744360
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A



## Log Excerpts

```
[POSTING_QUEUE] 🔒 Successfully claimed decision 452cc1e9-9243-449e-bac0-156e5463a171 for posting
[CONTENT_RATE_LIMIT] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769279707635)
[POSTING_QUEUE][SEM_TIMEOUT] decision_id=452cc1e9-9243-449e-bac0-156e5463a171 type=single timeoutMs=300000 priority=-1 proof_tag=control-post-1769279707635
[BROWSER_SEM] 🔓 posting acquired browser (priority -1)
[POSTING_QUEUE] 🌐 Using reliable Playwright posting...
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 180000ms (attempt 1, retry_count=0)
[POSTING_GUARD] ✅ Guard created: decision_id=452cc1e9-9243-449e-bac0-156e5463a171 source=postingQueue
[ATOMIC_POST]   decision_id=452cc1e9-9243-449e-bac0-156e5463a171 type=single source=postingQueue build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a
[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...
[ATOMIC_POST] 🎫 Creating posting permit...
[POSTING_GUARD] ✅ Verified: decision_id=452cc1e9-9243-449e-bac0-156e5463a171 source=postingQueue job=posting_1769279919549
[PROOF:control-post-1769279707635] [POST_TWEET] 📊 AUDIT_TRAIL: decision_id=452cc1e9-9243-449e-bac0-156e5463a171 pipeline_source=postingQueue job_run_id=posting_1769279919549 build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a db_env=7ef9c43a
ULTIMATE_POSTER: Acquiring page from UnifiedBrowserPool (operation: tweet_posting)...
[BROWSER_POOL] 📝 Request: tweet_posting (queue: 0, active: 0, priority: 0)
[BROWSER_POOL][TIMEOUT] label=tweet_posting timeoutMs=300000
[BROWSER_POOL]   → tweet_posting-1769279920031-2o6gc7519: Starting...
[BROWSER_POOL]   ✅ tweet_posting-1769279920031-2o6gc7519: Completed (54ms)
ULTIMATE_POSTER: ✅ CreateTweet GraphQL response capture active (30s timeout)
{"ts":"2026-01-24T18:39:00.222Z","app":"xbot","op":"ultimate_poster_retry","retry_count":0,"recoverable":true,"is_429":false}
{"ts":"2026-01-24T18:39:00.222Z","app":"xbot","op":"ultimate_poster_delay","delay_ms":2000,"is_429":false}
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** queued
- **Error Message:** N/A

### Failure Event Data
No POST_FAILED event found

### Outcomes Result
No outcomes result found

### Daemon Lifecycle Events
No daemon crash event found

- **Exit Event ID:** 746e8e1c-3a8b-49da-9d22-517819aa7171
- **Exit Reason:** signal


### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

**Failure Code:** QUEUE_STALL_NO_CLAIM

**Failure Message:** Decision was selected (1 EXECUTOR_PROOF_POST_SELECTED events) but not claimed after 184s



**Selected Event Count:** 1

**Claim Event Count:** 0
