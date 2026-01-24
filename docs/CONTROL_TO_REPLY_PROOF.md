# Control → Executor → X Proof (Reply)

**Date:** 2026-01-24T05:06:57.564Z  
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
| Pages Max | ✅ | 1 | HARD |

## Evidence

- **Decision ID:** 9431d5b1-1506-4cf4-89b3-5e783dc8301f
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769230905421
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A
- **Tick Count (Last 15m):** 1
- **Last Tick At:** 2026-01-24T05:05:52.362+00:00
- **Proof Selected Event Present:** true
- **Proof Selected Event ID:** 511d44ac-0d51-4265-8282-10bc5842b5e6
- **Rate Limit Active:** false

- **Rate Limit Seconds Remaining:** 0



## Log Excerpts

```
[KEYWORD_FEED] ⏱️ Timeout or error: Keyword feed timeout after 90s (90065ms)
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769230990674-ukb49pb8y duration_ms=60001 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=1, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_keyword_cholesterol_1769230928382: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=1, active=1/5)
[BROWSER_POOL][TIMEOUT] label=curated_feed timeoutMs=180000
[CURATED_FEED] ⏱️ Timeout or error: Curated feed timeout after 90s (90153ms)
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769231067359-3cxg129zv duration_ms=60001 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=2, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_DrRanganChatterjee_1769231067113: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=2, active=1/5)
[EXECUTOR_DAEMON] ts=2026-01-24T05:05:52.360Z pages=1 browser_launches=1 posting_ready=5 posting_attempts=5 reply_ready=0 reply_attempts=0 backoff=60s last_error=Cannot read properties of undefined (reading 'evaluated')
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: discovered_accounts_fetch waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[DISCOVERED_FEED] ❌ Feed failed after 60112ms: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=2, active=1/5)
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769231129362-f7qikm7mb duration_ms=60003 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=1, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_DrRanganChatterjee_1769231067113: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=1, active=1/5)
[BROWSER_POOL][TIMEOUT] label=keyword_feed timeoutMs=180000
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** failed
- **Error Message:** Queue stall: not claimed within 300s (ticks: 1)

### Failure Event Data

```json
{
  "step": "proof_timeout_queued",
  "failed_at": "2026-01-24T05:06:56.735Z",
  "proof_tag": "control-reply-1769230905421",
  "error_code": "QueueStall",
  "error_name": "QueueStall",
  "app_version": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
  "decision_id": "9431d5b1-1506-4cf4-89b3-5e783dc8301f",
  "error_message": "Decision not claimed within 300s. Tick count: 1, Last tick: 2026-01-24T05:05:52.362+00:00, Proof selected: yes",
  "pipeline_source": "postingQueue",
  "target_tweet_id": "2014718451563004351"
}
```

- **Error Code:** QueueStall
- **HTTP Status:** N/A
- **Is Rate Limit:** No
- **Is Timeout:** No


### Outcomes Result
No outcomes result found

### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

**Failure Code:** QueueStall
