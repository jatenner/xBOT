# Control → Executor → X Proof (Reply)

**Date:** 2026-01-24T16:22:06.921Z  
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
| Control Decision Created | ✅ | control_reply_scheduler | - |
| Decision Queued | ✅ | queued | - |
| Decision Claimed | ❌ | queued | - |
| Attempt Recorded | ❌ | N/A | - |
| Result Recorded | ❌ | N/A | - |
| Success/Failure Event | ✅ | 21b78fda-2a0f-453b-b210-b4403d547553 | - |
| Exactly One Decision | ❌ | 0 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 1 | HARD |

## Evidence

- **Decision ID:** ed2ab9e6-72e9-4dda-b7b3-28c6c35014f7
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769271406334
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** 21b78fda-2a0f-453b-b210-b4403d547553
- **Fetched Tweet Preview:** Surprisingly, 20 minutes of nature exposure can elevate mood and reduce cortisol by 20% (Stanford 2022). This counters t...
- **Fetched Author Handle:** @Signal_Synapse
- **Snapshot Hash:** b19399a449fe1c36e58585d1200a01b4
- **Semantic Similarity Used:** 0.750








- **Result URL:** https://x.com/Signal_Synapse/status/2015096733693366778

## Log Excerpts

```
[ANCHOR_CHECK] ✅ Bypassing anchor check for proof decision (proof_tag=control-reply-1769270744714)
[REPLY_DECISION] ✅ PROOF_MODE BYPASS: Allowing proof decision (proof_tag=control-reply-1769270744714, ancestry skipped)
[POSTING_QUEUE] 💬 Posting reply to @undefined: "Quick note: sleep quality and sunlight timing matt..."
[POSTING_QUEUE][REPLY] decision_id=81c5b071-df3d-4dda-8c58-ed4eac23ec68 priority=-1 proof_tag=control-reply-1769270744714
[BROWSER_SEM] 🔓 reply_posting acquired browser (priority -1)
[POSTING_QUEUE]    Previous reply ID: 2015096733693366778
[BROWSER_SEM] ❌ Operation failed for reply_posting: Duplicate reply prevented: Already replied to 2014718451563004351
[BROWSER_SEM] 🔐 reply_posting released browser (queue: 0)
[POSTING_QUEUE] ❌ POSTING FAILED: Duplicate reply prevented: Already replied to 2014718451563004351
[POSTING_QUEUE] 🔄 reply will retry (attempt 3/3) in 20min
[POSTING_QUEUE] 📝 Error: Duplicate reply prevented: Already replied to 2014718451563004351
[RAMP_MODE] ramp_enabled=true ramp_level=3 posts_last_hour=0 replies_last_hour=1 blocked_self_reply=0 blocked_reply_to_reply=2 blocked_freshness=0 blocked_generic=5 NOT_IN_DB_count=0
[EXECUTOR_DAEMON] 🔒 PROOF_MODE: Skipping reply queue background work
[EXECUTOR_DAEMON] ts=2026-01-24T16:20:15.773Z pages=1 browser_launches=1 posting_ready=1 posting_attempts=1 reply_ready=0 reply_attempts=0 backoff=0s
[POSTING_QUEUE] ℹ️  Reply-specific columns will be validated per-decision for reply decisions
[POSTING_QUEUE] 🔒 PROOF_MODE: Filtering to proof_tag starting with 'control-reply-' only
[POSTING_QUEUE] ✅ After rate limits: 0 decisions can post (2 content, 3 replies available)
[POSTING_QUEUE] 🔍 DIAGNOSTIC [1/1]: decision_id=56bcaa12-4d2b-4ca6-9d87-6a0ef9499f4a type=reply gate=DEFERRED reason=retry_deferral (retry #2, scheduled 4min in future)
[EXECUTOR_DAEMON] 🔒 PROOF_MODE: Skipping reply queue background work
[EXECUTOR_DAEMON] ts=2026-01-24T16:21:17.461Z pages=1 browser_launches=1 posting_ready=0 posting_attempts=0 reply_ready=0 reply_attempts=0 backoff=0s
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** posted
- **Error Message:** N/A

### Failure Event Data
No REPLY_FAILED event found

### Outcomes Result
No outcomes result found

### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

