# Control → Executor → X Proof (Posting)

**Date:** 2026-01-24T19:03:35.545Z  
**Status:** ✅ PASS

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
| Decision Queued | ✅ | posted | - |
| Decision Claimed | ✅ | posted | - |
| Attempt Recorded | ❌ | N/A | - |
| Result Recorded | ❌ | N/A | - |
| Success/Failure Event | ✅ | N/A | - |
| Exactly One Decision | ✅ | 1 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 1 | HARD |

## Evidence

- **Decision ID:** ce631dee-6503-4752-8fc7-ff52a6caced0
- **Proof Tag:** control-post-1769281173411
- **Pipeline Source:** control_posting_queue
- **Decision Status:** posted
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A
- **Result URL:** https://x.com/Signal_Synapse/status/2015138300814639129
- **Tweet ID:** 2015138300814639129

## Log Excerpts

```
[ATOMIC_POST] 📊 Writing POST_SUCCESS event (idempotent)...
[ATOMIC_POST] ✅ POST_SUCCESS event written: decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 tweet_id=2015138300814639129
[PERFORMANCE_SNAPSHOT] 📋 Enqueueing snapshots for decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 tweet_id=2015138300814639129
[BROWSER_SEM] 🔐 posting released browser (queue: 0)
[LIFECYCLE] decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 step=POST_CLICKED tweet_id=2015138300814639129
[POSTING_QUEUE][FLOW]    Calling writePostReceipt() with decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0, post_type=single, tweet_ids_count=1
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO WRITE RECEIPT - decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 tweet_id=2015138300814639129
[RECEIPT]    decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0
[RECEIPT] ✅ Proof-of-posting DURABLE (can reconcile even if next step fails)
[LIFECYCLE] decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 step=RECEIPT_SAVED receipt_id=2c46cdab-e9a1-4530-8fa5-5eef03e15e5c
[LIFECYCLE] decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 step=BACKUP_SAVED tweet_ids_count=1
[BROWSER_POOL][TIMEOUT] label=content_verification timeoutMs=180000
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO CALL markDecisionPosted - decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 tweet_id=2015138300814639129
[POSTING_QUEUE][FLOW]    - decision_id: ce631dee-6503-4752-8fc7-ff52a6caced0
[POSTING_QUEUE] ✅ Database updated (attempt 1/3): tweet_id 2015138300814639129 saved for decision ce631dee-6503-4752-8fc7-ff52a6caced0
[POSTING_QUEUE] ⏭️ POST_SUCCESS already exists for decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 (written by atomicPostExecutor), skipping duplicate
[POSTING_QUEUE] 📝 Decision ce631dee-6503-4752-8fc7-ff52a6caced0 marked as posted with tweet ID: 2015138300814639129
[LIFECYCLE] decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 step=SUCCESS type=single tweet_id=2015138300814639129 tweet_ids_count=1
[POSTING_QUEUE][SUCCESS] decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0 type=single tweet_id=2015138300814639129 url=https://x.com/Signal_Synapse/status/2015138300814639129
[EXECUTOR_DAEMON] ts=2026-01-24T19:03:23.600Z pages=1 browser_launches=1 posting_ready=3 posting_attempts=3 reply_ready=0 reply_attempts=0 backoff=0s
```

## Diagnostic Snapshot (Failure Analysis)

### Decision Status
- **Final Status:** posted
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
- **Claim OK Count:** 1
- **Claim OK Event IDs:** b3630213-3cde-4221-9bfc-d6d565aad906
- **Claim Fail Count:** 0
- **Claim Fail Event IDs:** N/A

- **Claim Stall Count:** 0
- **Claim Stall Event IDs:** N/A


### Skipped Events
No skipped events found


## Result

✅ **PASS** - All execution checks and executor safety invariants passed






