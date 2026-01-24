# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T04:43:10.071Z  
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
| Control Decision Created | ✅ | control_posting_queue | - |
| Decision Queued | ✅ | posted | - |
| Decision Claimed | ✅ | posted | - |
| Attempt Recorded | ❌ | N/A | - |
| Result Recorded | ❌ | N/A | - |
| Success/Failure Event | ✅ | 773da599-ec60-4b30-a962-cf6928644041 | - |
| Exactly One Decision | ✅ | 1 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 0 | HARD |

## Evidence

- **Decision ID:** e808fa1d-ad9a-47d0-a697-d54fbdf2d53f
- **Proof Tag:** control-post-1769229474295
- **Pipeline Source:** control_posting_queue
- **Decision Status:** posted
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** 773da599-ec60-4b30-a962-cf6928644041
- **Result URL:** https://x.com/Signal_Synapse/status/2014920952824422910

## Log Excerpts

```
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=curated_feed timeoutMs=180000
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769229676183-afop8hqu8 duration_ms=60002 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=0, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_DrJustinSonnenburg_1769229675976: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=0, active=1/5)
[CURATED_FEED] ⏱️ Timeout or error: Curated feed timeout after 90s (90106ms)
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** posted
- **Error Message:** N/A

### Failure Event Data
No POST_FAILED event found

### Outcomes Result
No outcomes result found

### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

