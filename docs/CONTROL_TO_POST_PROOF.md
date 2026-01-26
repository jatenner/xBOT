# Control → Executor → X Proof (Posting)

**Date:** 2026-01-26T00:13:28.464Z  
**Status:** ✅ PASS

## Machine Info

- **Hostname:** Mac-354.lan
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
| Pages Max | ✅ | 0 | HARD |

## Evidence

- **Decision ID:** 67cab35d-e720-4431-8813-c1a1184b0a50
- **Proof Tag:** control-post-1769386336478
- **Pipeline Source:** control_posting_queue
- **Decision Status:** posted
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A
- **Result URL:** https://x.com/Signal_Synapse/status/2015578668731359522
- **Tweet ID:** 2015578668731359522

## Log Excerpts

```
[LIFECYCLE] decision_id=67cab35d-e720-4431-8813-c1a1184b0a50 step=RECEIPT_SAVED receipt_id=069cc06d-9ab6-4a34-9a84-bb0b825be9e9
[LIFECYCLE] decision_id=67cab35d-e720-4431-8813-c1a1184b0a50 step=BACKUP_SAVED tweet_ids_count=1
[BROWSER_POOL][TIMEOUT] label=content_verification timeoutMs=180000
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO CALL markDecisionPosted - decision_id=67cab35d-e720-4431-8813-c1a1184b0a50 tweet_id=2015578668731359522
[POSTING_QUEUE][FLOW]    - decision_id: 67cab35d-e720-4431-8813-c1a1184b0a50
[POSTING_QUEUE] ✅ Database updated (attempt 1/3): tweet_id 2015578668731359522 saved for decision 67cab35d-e720-4431-8813-c1a1184b0a50
[POSTING_QUEUE] ⏭️ POST_SUCCESS already exists for decision_id=67cab35d-e720-4431-8813-c1a1184b0a50 (written by atomicPostExecutor), skipping duplicate
[POSTING_QUEUE] 📝 Decision 67cab35d-e720-4431-8813-c1a1184b0a50 marked as posted with tweet ID: 2015578668731359522
[LIFECYCLE] decision_id=67cab35d-e720-4431-8813-c1a1184b0a50 step=SUCCESS type=single tweet_id=2015578668731359522 tweet_ids_count=1
[POSTING_QUEUE][SUCCESS] decision_id=67cab35d-e720-4431-8813-c1a1184b0a50 type=single tweet_id=2015578668731359522 url=https://x.com/Signal_Synapse/status/2015578668731359522
[RATE_LIMIT] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-reply-1769385414061)
[POSTING_QUEUE] 📝 🔍 DEBUG: About to update posting metrics
[POSTING_QUEUE] 🔒 Successfully claimed decision f0cf46c6-57ee-4e06-9b93-deefc9f02f50 for posting
[BROWSER_POOL][TIMEOUT] label=self_reply_check timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=context_verifier timeoutMs=180000
[PIPELINE] decision_id=f0cf46c6-57ee-4e06-9b93-deefc9f02f50 stage=post ok=start detail=posting_started
[POSTING_QUEUE] 🎯 Pipeline stage: posting_started_at=2026-01-26T00:13:21.977Z for decision_id=f0cf46c6-57ee-4e06-9b93-deefc9f02f50
[BROWSER_SEM] 🔓 reply_posting acquired browser (priority -1)
[BROWSER_SEM] ❌ Operation failed for reply_posting: Duplicate reply prevented: Already replied to 2014718451563004351
[BROWSER_SEM] 🔐 reply_posting released browser (queue: 0)
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
- **Claim Attempt Event IDs:** d33698d8-cd40-47e2-beea-f5e1b6defd33
- **Claim OK Count:** 1
- **Claim OK Event IDs:** f16e27a2-eb03-4582-a74c-8ccd19569572
- **Claim Fail Count:** 0
- **Claim Fail Event IDs:** N/A

- **Claim Stall Count:** 0
- **Claim Stall Event IDs:** N/A


### Skipped Events
No skipped events found


## Result

✅ **PASS** - All execution checks and executor safety invariants passed






