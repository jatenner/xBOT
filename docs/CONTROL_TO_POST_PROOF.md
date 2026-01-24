# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T17:15:07.590Z  
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
| Windows Opened | ❌ | 1 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 1 | HARD |

## Evidence

- **Decision ID:** ff2b4897-8b80-484b-94c0-5cd0e2b1cb83
- **Proof Tag:** control-post-1769274292283
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A


## Log Excerpts

```
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769274292283)
[EXECUTOR_DAEMON] ts=2026-01-24T17:13:17.913Z pages=1 browser_launches=1 posting_ready=4 posting_attempts=0 reply_ready=0 reply_attempts=0 backoff=0s
[POSTING_QUEUE] ✅ job_tick start SERVICE_ROLE=worker RUNNER_MODE=true EXECUTION_MODE=executor isExecutorMode=true GROWTH_CONTROLLER_ENABLED=false ALLOW_TEST_POSTS=false postingDisabled=false postingDisabledEnv=false
[POSTING_QUEUE] 🚀 Starting posting queue (cert_mode=false, max_items=2)
{"ts":"2026-01-24T17:14:18.358Z","app":"xbot","op":"posting_queue_start"}
{"ts":"2026-01-24T17:14:18.723Z","app":"xbot","op":"posting_queue","content_rate_limited":true,"note":"replies_may_still_proceed"}
[POSTING_QUEUE] ⏸️ Post 95e2edd4-7012-4b16-8424-a7910c3035ed blocked by rate limits (32min old)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit for proof decision (proof_tag=control-post-1769272910608)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit for proof decision (proof_tag=control-post-1769273266080)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit for proof decision (proof_tag=control-post-1769273930327)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit for proof decision (proof_tag=control-post-1769274292283)
[POSTING_QUEUE] ✅ After rate limits: 4 decisions can post (0 content, 3 replies available)
[POSTING_QUEUE] 🔍 DIAGNOSTIC [4/4]: decision_id=ff2b4897-8b80-484b-94c0-5cd0e2b1cb83 type=single gate=PASS reason=
[POSTING_QUEUE] 🎯 Proof decision selected: ff2b4897-8b80-484b-94c0-5cd0e2b1cb83 (proof_tag: control-post-1769274292283)
{"ts":"2026-01-24T17:14:19.721Z","app":"xbot","op":"posting_queue","ready_count":4,"grace_minutes":5}
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769272910608)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769273266080)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769273930327)
[POSTING_QUEUE] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-post-1769274292283)
[EXECUTOR_DAEMON] ts=2026-01-24T17:14:20.439Z pages=1 browser_launches=1 posting_ready=4 posting_attempts=0 reply_ready=0 reply_attempts=0 backoff=0s
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

