# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T03:19:44.252Z  
**Status:** ❌ FAIL

## Machine Info

- **Hostname:** Mac.lan
- **Platform:** darwin
- **Architecture:** arm64
- **Node Version:** v22.14.0
- **Runner Profile Dir:** /Users/jonahtenner/Desktop/xBOT/.runner-profile

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Control Decision Created | ✅ | control_posting_queue | - |
| Decision Queued | ✅ | failed | - |
| Decision Claimed | ✅ | failed | - |
| Attempt Recorded | ❌ | N/A | - |
| Result Recorded | ❌ | N/A | - |
| Success/Failure Event | ❌ | N/A | - |
| Exactly One Decision | ✅ | 1 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 0 | HARD |

## Evidence

- **Decision ID:** 4c7f539a-4de8-4deb-84c4-d91921a2a485
- **Proof Tag:** control-post-1769224473086
- **Pipeline Source:** control_posting_queue
- **Decision Status:** failed
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A


## Log Excerpts

```
[BROWSER_SEM] ❌ Operation failed for posting: Playwright posting failed: single_post timed out after 180000ms
[BROWSER_SEM] 🔐 posting released browser (queue: 0)
[POSTING_QUEUE][FLOW] ❌ STEP 1/4 FAILED: Twitter posting failed
[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=4c7f539a-4de8-4deb-84c4-d91921a2a485 decision_type=single error_name=Error error_message=Playwright posting failed: single_post timed out after 180000ms
[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=4c7f539a-4de8-4deb-84c4-d91921a2a485 stack=Error: Playwright posting failed: single_post timed out after 180000ms
    at withBrowserLock.timeoutMs.timeoutMs (/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:5341:13)
    at async postContent (/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:4755:10)
    at async <anonymous> (/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3637:22)
    at async processDecision (/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3636:22)
    at async processPostingQueue (/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:1862:21)
[POSTING_QUEUE] ❌ POSTING FAILED: Playwright posting failed: single_post timed out after 180000ms
[POSTING_QUEUE] 📝 Error: Playwright posting failed: single_post timed out after 180000ms
[POSTING_QUEUE] 📝 🔍 DEBUG: About to update posting metrics
[POSTING_QUEUE] 🔒 Successfully claimed decision 18d7f556-f45e-4b9f-89fe-1e96ca1eb7e2 for posting
[POSTING_QUEUE] 📝 🔍 DEBUG: About to update posting metrics
[POSTING_QUEUE] 🔒 Successfully claimed decision 4fd86317-f3c1-43fc-a20d-553b2f9e74fc for posting
[POSTING_QUEUE] 📝 🔍 DEBUG: About to update posting metrics
[POSTING_QUEUE] 🔒 Successfully claimed decision 60519174-7540-4399-b3b0-e99eaa130659 for posting
ULTIMATE_POSTER: Acquiring page from UnifiedBrowserPool (operation: tweet_posting)...
[BROWSER_POOL] 📝 Request: tweet_posting (queue: 0, active: 1, priority: 0)
```

## Result

❌ **FAIL** - One or more checks failed
