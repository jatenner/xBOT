# Control → Executor → X Proof (Reply)

**Date:** 2026-01-24T04:49:35.512Z  
**Status:** ❌ FAIL

## Machine Info

- **Hostname:** Mac-305.lan
- **Platform:** darwin
- **Architecture:** arm64
- **Node Version:** v22.14.0
- **Runner Profile Dir:** /Users/jonahtenner/Desktop/xBOT/.runner-profile

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Control Decision Created | ✅ | control_reply_scheduler | - |
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

- **Decision ID:** 379c6ee6-5cc7-4c73-89a8-ee8c93a55db4
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769229860371
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A


## Log Excerpts

```
[POSTING_QUEUE] ❌ Atomic posting failed: Posting timeout after 240s
{"ts":"2026-01-24T04:48:26.526Z","app":"xbot","op":"ultimate_poster_retry","retry_count":1,"recoverable":true,"is_429":false}
{"ts":"2026-01-24T04:48:26.526Z","app":"xbot","op":"ultimate_poster_delay","delay_ms":4000,"is_429":false}
[FAILURE_RECORDER] ✅ Recorded POST_FAILED for decision_id=29e6f6f1-cdc5-4b19-8d45-cb448eb8eb46 error_code=AtomicPostFailed
[POSTING_QUEUE] ❌ Playwright system error: Posting timeout after 240s
[FAILURE_RECORDER] ✅ Recorded POST_FAILED for decision_id=29e6f6f1-cdc5-4b19-8d45-cb448eb8eb46 error_code=PLAYWRIGHT_TIMEOUT
[BROWSER_SEM] ❌ Operation failed for posting: Playwright posting failed: Posting timeout after 240s
[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=29e6f6f1-cdc5-4b19-8d45-cb448eb8eb46 decision_type=single error_name=Error error_message=Playwright posting failed: Posting timeout after 240s
[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=29e6f6f1-cdc5-4b19-8d45-cb448eb8eb46 stack=Error: Playwright posting failed: Posting timeout after 240s
    at withBrowserLock.timeoutMs.timeoutMs (/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:5446:13)
[POSTING_QUEUE] ❌ POSTING FAILED: Playwright posting failed: Posting timeout after 240s
[BROWSER_POOL][TIMEOUT] label=tweet_verification timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=tweet_posting timeoutMs=300000
[BROWSER_POOL][TIMEOUT] label=tweet_verification timeoutMs=180000
ULTIMATE_POSTER: Page error: ApiError: https://x.com/i/api/graphql/178EtFdhcGqmoyzKL4muaA/Viewer HTTP-429 codes:[1003]
[POSTING_QUEUE] 📝 Error: Playwright posting failed: Posting timeout after 240s
[POSTING_QUEUE][SEM_TIMEOUT] decision_id=df340249-8b73-4e5f-b51a-b968788cf55c type=single timeoutMs=300000
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 300000ms (attempt 3, retry_count=2)
[BROWSER_POOL][TIMEOUT] label=tweet_posting timeoutMs=300000
ULTIMATE_POSTER: Page error: ApiError: https://x.com/i/api/graphql/178EtFdhcGqmoyzKL4muaA/Viewer HTTP-429 codes:[1003]
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** queued
- **Error Message:** N/A

### Failure Event Data
No REPLY_FAILED event found

### Outcomes Result
No outcomes result found

### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

