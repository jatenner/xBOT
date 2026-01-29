# Planner Queue Empty Fix - Proof Report

**Generated:** 2026-01-29T14:29:21.121Z  
**Commit:** unknown  
**Fix:** Widen freshness window from 2h to 24h in refreshCandidateQueue

---

## ✅ SUCCESS: Queue Empty Fix Verified

### Root Cause
- **Filter:** 2-hour freshness window in `refreshCandidateQueue()`
- **Impact:** Excluded 84 valid candidates (only 1 in 2h window, 85 in 24h window)
- **Location:** `src/jobs/replySystemV2/queueManager.ts:68`

### Fix Applied
- Changed freshness window from 2h to 24h when `runStartedAt` not provided
- Safe because runtime preflight gating protects against stale tweets
- Queue manager already filters by `passed_hard_filters=true` and `predicted_tier <= 3`

### Verification Results

**Baseline Counts:**
- 2h window: 1 candidates
- 24h window: 85 candidates

**refreshCandidateQueue Result:**
- Evaluated: 50
- Queued: 25
- Expired: 0

**Queue Status:**
- Non-expired queued entries: 26
- Queued decisions (last hour): 0

---

## SQL Evidence

```sql
-- Candidates available in 24h window
SELECT COUNT(*) AS count_24h
FROM candidate_evaluations
WHERE passed_hard_filters = true
  AND predicted_tier <= 3
  AND status IN ('evaluated', 'queued')
  AND created_at > NOW() - INTERVAL '24 hours';

-- Queue status
SELECT status, COUNT(*) 
FROM reply_candidate_queue
WHERE expires_at > NOW()
GROUP BY status;

-- Queued decisions
SELECT COUNT(*) AS queued_decisions
FROM content_generation_metadata_comprehensive
WHERE pipeline_source = 'reply_v2_planner'
  AND status = 'queued'
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Conclusion

✅ **Fix VERIFIED**

The widened freshness window (2h → 24h) allows the planner to find sufficient candidates for queue population. Runtime preflight gating ensures stale tweets are blocked at execution time, making this change safe.
