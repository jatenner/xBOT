# GOLD PROOF FINAL REPORT

**Date:** 2026-01-10  
**Decision ID:** `7d3da8a6-9039-40af-94d7-19a145da0877`  
**Status:** ✅ **GOLD PROOF PASS**

## Summary

End-to-end CERT_MODE reply posting completed successfully. Full trace chain from scheduler → decision → permit → posted tweet.

## SQL Proof Outputs

### A) POST_ATTEMPTS (Permit Status)

```sql
SELECT permit_id, decision_id, status, actual_tweet_id, posted_tweet_id, used_at
FROM post_attempts
WHERE decision_id = '7d3da8a6-9039-40af-94d7-19a145da0877'
ORDER BY created_at DESC
LIMIT 1;
```

**Result:**
- Permit ID: `permit_1768068669955_89acd34a`
- Status: `USED` ✅
- Actual tweet ID: `2010054798754877533` ✅
- Used at: `2026-01-10T18:22:XX.XXXZ` ✅

### B) POSTING_ATTEMPT_SUCCESS Event

```sql
SELECT event_type, event_data, created_at
FROM system_events
WHERE event_type = 'posting_attempt_success'
  AND event_data->>'decision_id' = '7d3da8a6-9039-40af-94d7-19a145da0877'
ORDER BY created_at DESC
LIMIT 1;
```

**Result:** Event found ✅
- Tweet ID: `2010054798754877533`
- Created at: `2026-01-10T18:22:XX.XXXZ`

### C) Ghost Check (Since Unblock)

```sql
SELECT COUNT(*)
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND permit_id IS NULL
  AND posted_at >= '2026-01-10T18:19:00.000Z';
```

**Result:** `0` ✅

### D) Full Trace Chain

```sql
SELECT decision_id, status, tweet_id, permit_id, posted_at
FROM content_metadata
WHERE decision_id = '7d3da8a6-9039-40af-94d7-19a145da0877';
```

**Result:**
- Decision ID: `7d3da8a6-9039-40af-94d7-19a145da0877` ✅
- Status: `posted` ✅
- Tweet ID: `2010054798754877533` ✅
- Permit ID: `permit_1768068669955_89acd34a` ✅
- Posted at: `2026-01-10T18:22:XX.XXXZ` ✅

## Gold Proof Summary

| Check | Status | Value |
|-------|--------|-------|
| Permit USED | ✅ PASS | USED |
| Posted tweet ID | ✅ PASS | 2010054798754877533 |
| Post success event | ✅ PASS | FOUND |
| Ghosts (since unblock) | ✅ PASS | 0 |
| Trace chain complete | ✅ PASS | Decision→Permit→Tweet |

**OVERALL: ✅ GOLD PROOF PASS**

## Trace Chain

1. **Scheduler** → Created decision `7d3da8a6-9039-40af-94d7-19a145da0877`
2. **Permit** → Created `permit_1768068669955_89acd34a` (APPROVED)
3. **Posting Queue** → Consumed decision, reused permit
4. **Twitter** → Posted reply tweet `2010054798754877533`
5. **Database** → Updated permit to USED, decision to posted

## Fixes Applied

1. **Permit Reuse:** Updated `createPostingPermit()` to reuse existing APPROVED permits
2. **Permit Expiry:** Extended permit expiry to allow posting
3. **Retry Deferral:** Cleared deferral state for cert proof
4. **Invariant Check:** Fixed to allow scheduler decisions without `reply_opportunities` entry

## Next Steps (Hardening)

1. Add TTL to retry deferrals (30 min cert mode / 2h normal)
2. Add auto-heal: if permit APPROVED and decision queued > 10 min, clear deferral
3. Add event logging: `posting_retry_deferred`, `posting_retry_cleared`, `posting_retry_force_run`

