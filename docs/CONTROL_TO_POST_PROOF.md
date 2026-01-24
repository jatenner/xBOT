# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T18:58:30.000Z  
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
| Pages Max | ✅ | 1 | HARD |

## Evidence

- **Decision ID:** fb22879d-5cd3-464e-a84d-de9d530805aa
- **Proof Tag:** control-post-1769280915112
- **Pipeline Source:** control_posting_queue
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A



## Log Excerpts

```
/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3821:12: ERROR: The symbol "decisionFeatures" has already been declared (failures: 1, backoff: 60s)
[EXECUTOR_DAEMON] ts=2026-01-24T18:55:17.049Z pages=1 browser_launches=1 posting_ready=0 posting_attempts=0 reply_ready=0 reply_attempts=0 backoff=60s last_error=Transform failed with 1 error:
/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3821:12: ERROR: The symbol "decisionFeatures" has already been declared
/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3821:12: ERROR: The symbol "decisionFeatures" has already been declared (failures: 2, backoff: 120s)
[EXECUTOR_DAEMON] ts=2026-01-24T18:56:17.452Z pages=1 browser_launches=1 posting_ready=0 posting_attempts=0 reply_ready=0 reply_attempts=0 backoff=120s last_error=Transform failed with 1 error:
/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3821:12: ERROR: The symbol "decisionFeatures" has already been declared
/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3821:12: ERROR: The symbol "decisionFeatures" has already been declared (failures: 3, backoff: 300s)
[EXECUTOR_DAEMON] ts=2026-01-24T18:58:17.868Z pages=1 browser_launches=1 posting_ready=0 posting_attempts=0 reply_ready=0 reply_attempts=0 backoff=300s last_error=Transform failed with 1 error:
/Users/jonahtenner/Desktop/xBOT/src/jobs/postingQueue.ts:3821:12: ERROR: The symbol "decisionFeatures" has already been declared
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
No daemon exit event found

### Claim Events

- **Claim Attempt Count:** 0
- **Claim Attempt Event IDs:** N/A
- **Claim OK Count:** 0
- **Claim OK Event IDs:** N/A
- **Claim Fail Count:** 0
- **Claim Fail Event IDs:** N/A

- **Claim Stall Count:** 0
- **Claim Stall Event IDs:** N/A


### Skipped Events
No skipped events found


## Result

❌ **FAIL** - One or more checks failed

**Failure Code:** QUEUE_STALL_NO_SELECT

**Failure Message:** Decision remained queued for 182s with executor tick_start_seen=true but no EXECUTOR_PROOF_POST_CANDIDATE_FOUND events

**Tick Start Seen:** true

**Tick Start TS:** 2026-01-24T18:58:17.809+00:00


