# Control → Executor → X Proof (Reply)

**Date:** 2026-01-25T21:56:52.762Z  
**Status:** ❌ FAIL

## Machine Info

- **Hostname:** Mac-350.lan
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
| Success/Failure Event | ✅ | bae8e78e-9846-40de-a5bf-d4ffa9e120f6 | - |
| Exactly One Decision | ✅ | 1 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 1 | HARD |

## Evidence

- **Decision ID:** 1db7ad10-5e77-4141-9bf2-8a125f632690
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769377899036
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** bae8e78e-9846-40de-a5bf-d4ffa9e120f6



- **Semantic Similarity Used:** 0.750










## Log Excerpts

```
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT] ✅ Resolved 2015543125322641620 → root 2015489613469540730 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT] ✅ Resolved 2015543125322641620 → root 2015489613469540730 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[BROWSER_POOL][TIMEOUT] label=resolve_root_tweet timeoutMs=180000
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[BROWSER_POOL][TIMEOUT] label=curated_feed timeoutMs=180000
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769378009200-nft8q3y09 duration_ms=60003 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=0, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_DrDanielAmen_1769378008933: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=0, active=1/5)
[CURATED_FEED] ⏱️ Timeout or error: Curated feed timeout after 90s (90109ms)
[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: resolve_root_tweet waited 60s (timeout: 60s)
[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart
[ANCESTRY_TRACE] stage=acquire_context decision_id=ancestry-1769378071212-k1e8b9tq5 duration_ms=60003 success=false error=acquire_context_timeout: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=1, active=1/5)
[REPLY_SELECT] ❌ Error resolving root for consent_wall_DrDanielAmen_1769378008933: ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: Queue timeout after 60s - pool overloaded (priority: 5, timeout: 60s, queue_len=1, active=1/5)
[BROWSER_POOL][TIMEOUT] label=discovered_accounts_fetch timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=curated_feed timeoutMs=180000
[EXECUTOR_DAEMON] ts=2026-01-25T21:55:54.490Z pages=1 browser_launches=1 posting_ready=1 posting_attempts=1 reply_ready=0 reply_attempts=0 backoff=60s last_error=Cannot read properties of undefined (reading 'evaluated')
[DISCOVERED_FEED] ❌ Feed failed after 90176ms: Discovered accounts feed timeout after 90s
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** blocked
- **Error Message:** {"target_exists":true,"is_root_tweet":true,"content_similarity":0.06521739130434782,"fetched_text":"Surprisingly, 20 minutes of nature exposure can elevate mood and reduce cortisol by 20% (Stanford 2022). This counters the notion that only long vacations enhance well-being. However, not for those wi","snapshot_text":"This is a test tweet content snapshot for control→executor proof. It must be at least 20 characters long to pass FINAL_REPLY_GATE."}

### Failure Event Data

```json
{
  "failed_at": "2026-01-25T21:51:49.670Z",
  "decision_id": "1db7ad10-5e77-4141-9bf2-8a125f632690",
  "skip_reason": "context_mismatch",
  "error_message": "{\"target_exists\":true,\"is_root_tweet\":true,\"content_similarity\":0.06521739130434782,\"fetched_text\":\"Surprisingly, 20 minutes of nature exposure can elevate mood and reduce cortisol by 20% (Stanford 2022). This counters the notion that only long vacations enhance well-being. However, not for those wi\",\"snapshot_text\":\"This is a test tweet content snapshot for control→executor proof. It must be at least 20 characters long to pass FINAL_REPLY_GATE.\"}",
  "target_tweet_id": "2014718451563004351",
  "pipeline_error_reason": "SAFETY_GATE_context_mismatch"
}
```

- **Error Code:** UNKNOWN
- **HTTP Status:** N/A
- **Is Rate Limit:** No
- **Is Timeout:** No


### Outcomes Result
No outcomes result found

### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

**Failure Code:** UNKNOWN
