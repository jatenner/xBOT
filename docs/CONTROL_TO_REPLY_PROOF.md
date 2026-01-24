# Control → Executor → X Proof (Reply)

**Date:** 2026-01-24T04:58:53.586Z  
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

- **Decision ID:** 0830afa1-a500-4da5-8ee8-d2c005c2b08e
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769230418197
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A





## Log Excerpts

```
[REPLY_SELECT] ✅ 2014923463748710463 confirmed as ROOT tweet (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=false)
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT] ✅ Resolved 2014918534929830280 → root 2014907089517478231 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT] ✅ Resolved 2014918534929830280 → root 2014907089517478231 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT] ✅ 2014916840720650482 confirmed as ROOT tweet (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=false)
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=curated_feed timeoutMs=180000
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769230606476-rfzct1dly duration_ms=60003 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=0, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_DrRanganChatterjee_1769230606256: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=0, active=1/5)
[CURATED_FEED] ⏱️ Timeout or error: Curated feed timeout after 90s (90112ms)
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

