# Control → Executor → X Proof (Posting)

**Date:** 2026-01-25T21:51:38.700Z  
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

- **Decision ID:** f4f071e9-c682-41de-949e-b47f16ab45f1
- **Proof Tag:** control-post-1769377793922
- **Pipeline Source:** control_posting_queue
- **Decision Status:** posted
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A
- **Result URL:** https://x.com/Signal_Synapse/status/2015542970867384753
- **Tweet ID:** 2015542970867384753

## Log Excerpts

```
[TWEET_ID_BACKUP] 💾 Saved tweet_id 2015542970867384753 to backup file (decision: f4f071e9...)
[POSTING_QUEUE] 💾 Tweet ID saved to backup file: 2015542970867384753
[POSTING_QUEUE] 🎉 TWEET POSTED SUCCESSFULLY: 2015542970867384753
[POSTING_QUEUE] 🔗 Tweet URL: https://x.com/Signal_Synapse/status/2015542970867384753
[POSTING_QUEUE] 🔍 Verifying content matches tweet_id 2015542970867384753...
[BROWSER_POOL][TIMEOUT] label=content_verification timeoutMs=180000
[POSTING_QUEUE] 💾 Database save attempt 1/5 for tweet 2015542970867384753...
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO CALL markDecisionPosted - decision_id=f4f071e9-c682-41de-949e-b47f16ab45f1 tweet_id=2015542970867384753
[POSTING_QUEUE][FLOW]    - decision_id: f4f071e9-c682-41de-949e-b47f16ab45f1
[POSTING_QUEUE][FLOW]    - tweet_id: 2015542970867384753
[POSTING_QUEUE][FLOW]    - tweet_url: https://x.com/Signal_Synapse/status/2015542970867384753
[POSTING_QUEUE] ✅ Database updated (attempt 1/3): tweet_id 2015542970867384753 saved for decision f4f071e9-c682-41de-949e-b47f16ab45f1
[POSTING_QUEUE] ⏭️ POST_SUCCESS already exists for decision_id=f4f071e9-c682-41de-949e-b47f16ab45f1 (written by atomicPostExecutor), skipping duplicate
[POSTING_QUEUE] 📝 Decision f4f071e9-c682-41de-949e-b47f16ab45f1 marked as posted with tweet ID: 2015542970867384753
[CRITICAL] 📊 DB SAVE RESULT: ok=true, savedTweetIds=["2015542970867384753"]
[POSTING_QUEUE][FLOW]    Result: ok=true, savedTweetIds=["2015542970867384753"], classification=single
[POSTING_QUEUE][FLOW]    Result: ok=true, savedTweetIds=["2015542970867384753"], classification=single
[LIFECYCLE] decision_id=f4f071e9-c682-41de-949e-b47f16ab45f1 step=SUCCESS type=single tweet_id=2015542970867384753 tweet_ids_count=1
[POSTING_QUEUE][SUCCESS] decision_id=f4f071e9-c682-41de-949e-b47f16ab45f1 type=single tweet_id=2015542970867384753 url=https://x.com/Signal_Synapse/status/2015542970867384753
[EXECUTOR_DAEMON] ts=2026-01-25T21:51:24.526Z pages=1 browser_launches=1 posting_ready=1 posting_attempts=1 reply_ready=0 reply_attempts=0 backoff=0s
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
- **Claim Attempt Event IDs:** 218b5791-cb39-4e03-968d-12d409c596ba
- **Claim OK Count:** 1
- **Claim OK Event IDs:** e3238623-448e-4470-a270-081906b105ab
- **Claim Fail Count:** 0
- **Claim Fail Event IDs:** N/A

- **Claim Stall Count:** 0
- **Claim Stall Event IDs:** N/A


### Skipped Events
No skipped events found


## Result

✅ **PASS** - All execution checks and executor safety invariants passed






