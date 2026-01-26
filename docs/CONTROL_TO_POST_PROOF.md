# Control → Executor → X Proof (Posting)

**Date:** 2026-01-26T00:19:59.118Z  
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

- **Decision ID:** 0b29e8ab-acd6-47ec-b9b8-a1750b8e1867
- **Proof Tag:** control-post-1769386675196
- **Pipeline Source:** control_posting_queue
- **Decision Status:** posted
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A
- **Result URL:** https://x.com/Signal_Synapse/status/2015580329344446898
- **Tweet ID:** 2015580329344446898

## Log Excerpts

```
[POSTING_QUEUE][FLOW]    Calling writePostReceipt() with decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867, post_type=single, tweet_ids_count=1
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO WRITE RECEIPT - decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 tweet_id=2015580329344446898
[RECEIPT]    decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867
[RECEIPT] ✅ Proof-of-posting DURABLE (can reconcile even if next step fails)
[LIFECYCLE] decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 step=RECEIPT_SAVED receipt_id=e5ecb3b0-6161-492c-a9bd-3a76519861d6
[LIFECYCLE] decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 step=BACKUP_SAVED tweet_ids_count=1
[BROWSER_POOL][TIMEOUT] label=content_verification timeoutMs=180000
[CRITICAL] ⚠️⚠️⚠️ ABOUT TO CALL markDecisionPosted - decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 tweet_id=2015580329344446898
[POSTING_QUEUE][FLOW]    - decision_id: 0b29e8ab-acd6-47ec-b9b8-a1750b8e1867
[POSTING_QUEUE] ✅ Database updated (attempt 1/3): tweet_id 2015580329344446898 saved for decision 0b29e8ab-acd6-47ec-b9b8-a1750b8e1867
[POSTING_QUEUE] ⏭️ POST_SUCCESS already exists for decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 (written by atomicPostExecutor), skipping duplicate
[POSTING_QUEUE] 📝 Decision 0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 marked as posted with tweet ID: 2015580329344446898
[LIFECYCLE] decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 step=SUCCESS type=single tweet_id=2015580329344446898 tweet_ids_count=1
[POSTING_QUEUE][SUCCESS] decision_id=0b29e8ab-acd6-47ec-b9b8-a1750b8e1867 type=single tweet_id=2015580329344446898 url=https://x.com/Signal_Synapse/status/2015580329344446898
[RATE_LIMIT] 🔒 PROOF_MODE: Bypassing rate limit check for proof decision (proof_tag=control-reply-1769386658338)
[POSTING_QUEUE] 📝 🔍 DEBUG: About to update posting metrics
[POSTING_QUEUE] 🔒 Successfully claimed decision 04b01ae3-9d99-492c-94c9-11ead5608a88 for posting
[BROWSER_POOL][TIMEOUT] label=self_reply_check timeoutMs=180000
[BROWSER_POOL][TIMEOUT] label=context_verifier timeoutMs=180000
[REPLY_FAILED] decision_id=04b01ae3-9d99-492c-94c9-11ead5608a88 target_tweet_id=2014718451563004351 pipeline_error_reason=SAFETY_GATE_context_mismatch
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
- **Claim Attempt Event IDs:** 8e9d429f-c84f-4a9a-9fac-dd365d86d64c
- **Claim OK Count:** 1
- **Claim OK Event IDs:** 75a1c425-164c-4a60-af45-3ca44cebf4c7
- **Claim Fail Count:** 0
- **Claim Fail Event IDs:** N/A

- **Claim Stall Count:** 0
- **Claim Stall Event IDs:** N/A


### Skipped Events
No skipped events found


## Result

✅ **PASS** - All execution checks and executor safety invariants passed






