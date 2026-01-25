# Control → Executor → X Proof (Posting)

**Date:** 2026-01-25T22:28:14.126Z  
**Status:** ✅ PASS

## Machine Info

- **Hostname:** Mac-350.lan
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

- **Decision ID:** 7d02f035-0c15-42c9-b942-fb443ba48e5d
- **Proof Tag:** control-post-1769379926800
- **Pipeline Source:** control_posting_queue
- **Decision Status:** posted
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A
- **Result URL:** https://x.com/Signal_Synapse/status/2015552193932173614
- **Tweet ID:** 2015552193932173614

## Log Excerpts

```
[POST_TWEET] ✅ SUCCESS: tweet_id=2015552193932173614 decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d pipeline_source=postingQueue build_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a db_env=7ef9c43a
[ATOMIC_POST] 📊 Writing POST_SUCCESS event (idempotent)...
[ATOMIC_POST] ✅ POST_SUCCESS event written: decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d tweet_id=2015552193932173614
[PERFORMANCE_SNAPSHOT] 📋 Enqueueing snapshots for decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d tweet_id=2015552193932173614
[BROWSER_SEM] 🔐 posting released browser (queue: 0)
[LIFECYCLE] decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d step=POST_CLICKED tweet_id=2015552193932173614
[POSTING_QUEUE][FLOW]    Calling writePostReceipt() with decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d, post_type=single, tweet_ids_count=1
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO WRITE RECEIPT - decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d tweet_id=2015552193932173614
[RECEIPT]    decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d
[RECEIPT] ✅ Proof-of-posting DURABLE (can reconcile even if next step fails)
[LIFECYCLE] decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d step=RECEIPT_SAVED receipt_id=ff04f0b7-f358-495f-97b2-dd6217111271
[LIFECYCLE] decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d step=BACKUP_SAVED tweet_ids_count=1
[BROWSER_POOL][TIMEOUT] label=content_verification timeoutMs=180000
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO CALL markDecisionPosted - decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d tweet_id=2015552193932173614
[POSTING_QUEUE][FLOW]    - decision_id: 7d02f035-0c15-42c9-b942-fb443ba48e5d
[POSTING_QUEUE] ✅ Database updated (attempt 1/3): tweet_id 2015552193932173614 saved for decision 7d02f035-0c15-42c9-b942-fb443ba48e5d
[POSTING_QUEUE] ⏭️ POST_SUCCESS already exists for decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d (written by atomicPostExecutor), skipping duplicate
[POSTING_QUEUE] 📝 Decision 7d02f035-0c15-42c9-b942-fb443ba48e5d marked as posted with tweet ID: 2015552193932173614
[LIFECYCLE] decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d step=SUCCESS type=single tweet_id=2015552193932173614 tweet_ids_count=1
[POSTING_QUEUE][SUCCESS] decision_id=7d02f035-0c15-42c9-b942-fb443ba48e5d type=single tweet_id=2015552193932173614 url=https://x.com/Signal_Synapse/status/2015552193932173614
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

- **Claim Attempt Count:** 1
- **Claim Attempt Event IDs:** 95eeb942-3dbf-4378-b4f8-9f6d9f551d68
- **Claim OK Count:** 1
- **Claim OK Event IDs:** 30a61ee9-8b22-4e92-9c21-f722fe19f475
- **Claim Fail Count:** 0
- **Claim Fail Event IDs:** N/A

- **Claim Stall Count:** 0
- **Claim Stall Event IDs:** N/A


### Skipped Events
No skipped events found


## Result

✅ **PASS** - All execution checks and executor safety invariants passed






