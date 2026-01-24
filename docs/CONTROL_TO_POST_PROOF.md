# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T18:04:34.471Z  
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

- **Decision ID:** 672eb32e-14f5-427a-bf35-dc468d0e65f6
- **Proof Tag:** control-post-1769277802136
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A



## Log Excerpts

```
[RATE_LIMIT] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769276459222)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769276459222)
[POSTING_QUEUE] 📝 🔍 DEBUG: About to update posting metrics
[POSTING_QUEUE] 🔒 Successfully claimed decision c6203213-9983-462b-9434-38df01a0d9ec for posting
[CONTENT_RATE_LIMIT] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769276459222)
[POSTING_QUEUE][SEM_TIMEOUT] decision_id=c6203213-9983-462b-9434-38df01a0d9ec type=single timeoutMs=300000 priority=-1 proof_tag=control-post-1769276459222
[BROWSER_SEM] 🔓 posting acquired browser (priority -1)
[POSTING_QUEUE] 🌐 Using reliable Playwright posting...
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 300000ms (attempt 3, retry_count=2)
[POSTING_GUARD] ✅ Guard created: decision_id=c6203213-9983-462b-9434-38df01a0d9ec source=postingQueue
[ATOMIC_POST]   decision_id=c6203213-9983-462b-9434-38df01a0d9ec type=single source=postingQueue build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a
[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...
[ATOMIC_POST] 🎫 Creating posting permit...
[POSTING_GUARD] ✅ Verified: decision_id=c6203213-9983-462b-9434-38df01a0d9ec source=postingQueue job=posting_1769277862364
[PROOF:control-post-1769276459222] [POST_TWEET] 📊 AUDIT_TRAIL: decision_id=c6203213-9983-462b-9434-38df01a0d9ec pipeline_source=postingQueue job_run_id=posting_1769277862364 build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a db_env=7ef9c43a
ULTIMATE_POSTER: Acquiring page from UnifiedBrowserPool (operation: tweet_posting)...
[BROWSER_POOL] 📝 Request: tweet_posting (queue: 0, active: 0, priority: 0)
[BROWSER_POOL][TIMEOUT] label=tweet_posting timeoutMs=300000
[BROWSER_POOL]   → tweet_posting-1769277862826-36w8lxogn: Starting...
[BROWSER_POOL]   ✅ tweet_posting-1769277862826-36w8lxogn: Completed (61ms)
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

**Failure Message:** No EXECUTOR_DAEMON_TICK events found after 60s




