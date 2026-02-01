# Accessibility Filtering & P1 Volume Increase - Implementation Complete

**Date:** January 29, 2026  
**Goal:** Eliminate forbidden candidates upstream and increase attempt volume for P1 proving lane

## Summary

Implemented comprehensive accessibility tracking and filtering system to prevent re-attempting forbidden/login_wall/deleted tweets, plus increased scheduler attempt volume for P1 mode.

## Changes Made

### A) Candidate Source Tracking

**Files Modified:**
- `src/jobs/replySystemV2/tieredScheduler.ts` - Added candidate source logging
- `src/jobs/replyOpportunityHarvester.ts` - Added `discovery_source` tracking
- `src/ai/seedAccountHarvester.ts` - Added `discovery_source` tracking
- `src/ai/realTwitterDiscovery.ts` - Added `discovery_source` persistence

**Implementation:**
- Each candidate now logs: `tweet_id`, `author`, `harvest_source`, `discovery_source` when probe fails
- `discovery_source` format: `search_{tier}_{query_label}` for search-based, `seed_account_{username}` for seed-based
- Logged format: `[SCHEDULER] 📊 Candidate source: tweet_id=... author=@... harvest_source=... discovery=...`

### B) Accessibility Status Tracking

**Migration:** `supabase/migrations/20260129_add_accessibility_status.sql`

**New Columns:**
- `accessibility_status`: `unknown|ok|forbidden|login_wall|deleted` (default: `unknown`)
- `accessibility_checked_at`: TIMESTAMPTZ (when status was last checked)
- `accessibility_reason`: TEXT (reason for status)
- `discovery_source`: TEXT (which discovery strategy found this opportunity)

**Index:** `idx_reply_opportunities_accessibility` on `(accessibility_status, replied_to)` for fast filtering

**Files Modified:**
- `src/jobs/replySystemV2/tieredScheduler.ts` - Persists accessibility_status when probe fails/passes
- `src/jobs/replySystemV2/queueManager.ts` - Filters out `forbidden|login_wall|deleted` in `refreshCandidateQueue()`
- `src/ai/realTwitterDiscovery.ts` - Sets default `accessibility_status='unknown'` on insert

**Implementation:**
- Fast probe updates `accessibility_status` immediately when `forbidden`/`login_wall` detected
- Full preflight also updates status for `deleted`/`inaccessible` cases
- `refreshCandidateQueue()` excludes opportunities with `accessibility_status IN ('forbidden', 'login_wall', 'deleted')`
- Query filter: `.or('accessibility_status.is.null,accessibility_status.eq.unknown,accessibility_status.eq.ok')`

### C) Increased Scheduler Attempt Volume

**Environment Variable:** `P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK` (default: 20 in P1 mode, 3 otherwise)

**Files Modified:**
- `src/jobs/replySystemV2/tieredScheduler.ts`

**Changes:**
1. **Dynamic Max Attempts:** 
   ```typescript
   const defaultMaxAttempts = p1Mode ? 20 : 3;
   const PREFLIGHT_MAX_PER_CYCLE = parseInt(process.env.P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK || ... || String(defaultMaxAttempts), 10);
   ```

2. **Multi-Candidate Collection:**
   - P1 mode collects up to 20 candidates from queue (10 from tier 1, 10 from tier 2, remainder from tier 3)
   - Non-P1 mode collects 1 per tier (max 3 total)

3. **Probe Summary Logging:**
   - Tracks: `attempted`, `ok`, `forbidden`, `login_wall`, `deleted`, `timeout`
   - Emits: `[SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=X ok=Y forbidden=Z ...`

4. **Continue on Success (P1 mode):**
   - In P1 mode, scheduler continues trying candidates even after finding one that passes probe
   - Only breaks when max attempts reached or no more candidates available

### D) Discovery Source Tracking

**Files Modified:**
- `src/jobs/replyOpportunityHarvester.ts` - Sets `discovery_source` for search-based opportunities
- `src/ai/seedAccountHarvester.ts` - Sets `discovery_source` for seed-based opportunities
- `src/ai/realTwitterDiscovery.ts` - Persists `discovery_source` (falls back to `harvest_source` if not set)

**Format:**
- Search: `search_{tier}_{query_label}` (e.g., `search_fresh_health_tips`)
- Seed: `seed_account_{username}` (e.g., `seed_account_health_expert`)

## Code Changes Summary

### Migration
- ✅ `supabase/migrations/20260129_add_accessibility_status.sql` - Adds 4 new columns + index

### Core Logic
- ✅ `src/jobs/replySystemV2/tieredScheduler.ts`:
  - Lines 275: Dynamic `PREFLIGHT_MAX_PER_CYCLE` based on P1 mode
  - Lines 293-340: Multi-candidate collection in P1 mode
  - Lines 327-332: Probe results tracking
  - Lines 408-460: Accessibility status persistence + source logging
  - Lines 565-570: Continue trying in P1 mode after success
  - Lines 637-640: Probe summary logging

- ✅ `src/jobs/replySystemV2/queueManager.ts`:
  - Lines 101-108: Filters out `forbidden|login_wall|deleted` opportunities

- ✅ `src/ai/realTwitterDiscovery.ts`:
  - Line 1693: Sets `discovery_source` and `accessibility_status='unknown'` on insert

- ✅ `src/jobs/replyOpportunityHarvester.ts`:
  - Line 547: Sets `discovery_source` for search-based opportunities

- ✅ `src/ai/seedAccountHarvester.ts`:
  - Line 1233: Sets `discovery_source` for seed-based opportunities

## Testing

### Expected Behavior

1. **Source Tracking:**
   ```
   [SCHEDULER] 📊 Candidate source: tweet_id=... author=@... harvest_source=... discovery=...
   ```

2. **Accessibility Persistence:**
   - Probe failures update `reply_opportunities.accessibility_status`
   - Future `refreshCandidateQueue()` calls exclude these opportunities

3. **Increased Volume:**
   ```
   [SCHEDULER] 📊 Collected 20 candidates to try (P1 mode: true, max attempts: 20)
   [SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=20 ok=5 forbidden=10 login_wall=3 deleted=2 timeout=0
   ```

4. **Upstream Filtering:**
   - Candidates with `accessibility_status IN ('forbidden', 'login_wall', 'deleted')` are excluded from queue refresh

### Verification Commands

```bash
# Check accessibility status distribution
psql $DATABASE_URL -c "SELECT accessibility_status, COUNT(*) FROM reply_opportunities WHERE replied_to=false GROUP BY accessibility_status;"

# Check discovery sources
psql $DATABASE_URL -c "SELECT discovery_source, COUNT(*) FROM reply_opportunities WHERE replied_to=false GROUP BY discovery_source LIMIT 10;"

# Run scheduler with P1 mode
REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

## Next Steps

1. **Apply Migration:** Run migration on production database
2. **Monitor Logs:** Watch for `P1_PROBE_SUMMARY` logs showing increased attempt volume
3. **Verify Filtering:** Confirm forbidden candidates are excluded from future queue refreshes
4. **Diversify Harvester:** (Part D) Add more discovery strategies for public tweets (separate task)

## Notes

- Migration uses `DO $$` blocks with `IF NOT EXISTS` checks for safe re-runs
- Accessibility status defaults to `unknown` - only updated when probe/preflight runs
- Discovery source falls back to `harvest_source` if not explicitly set
- P1 mode increases volume but doesn't change core filtering logic (still requires `ok` status to proceed)
