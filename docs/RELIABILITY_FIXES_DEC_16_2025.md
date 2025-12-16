# Reliability Fixes - December 16, 2025

## Diagnosis Summary

**Stuck at:** Content queue insert stage  
**Root Cause:** Schema cache errors preventing content from being queued

### Issues Found:
1. ✅ **FIXED:** `structure_type` column missing from `content_metadata` view
2. ✅ **FIXED:** `hook_type` column missing from `content_metadata` view  
3. ✅ **FIXED:** Numeric overflow in `quality_score` (values > 9.9999)
4. ⚠️ **TODO:** Dead-letter handling for failed posts
5. ⚠️ **TODO:** Watchdog job for stuck pipeline
6. ⚠️ **TODO:** Heartbeat logging for all jobs

---

## Fixes Applied

### 1. Schema Migration (`20251216_fix_phase5_schema_columns.sql`)
- Adds `structure_type` column to underlying table
- Adds `hook_type` column check (should already exist)
- Updates `content_metadata` view to include both columns

**Status:** Migration created, needs to be applied via Supabase CLI

### 2. Numeric Overflow Fix (`planJob.ts`)
- Clamps `quality_score` to valid DECIMAL(5,4) range (0-9.9999)
- Converts 0-100 scale to 0-1.0 scale if needed
- Clamps `predicted_er` to valid range

**Status:** ✅ Code fix applied

### 3. Conditional Experiment Fields (`planJob.ts`, `replyJob.ts`)
- Only includes `experiment_group`/`hook_variant` when `ENABLE_PHASE4_EXPERIMENTS=true`
- Prevents schema cache errors when experiments disabled

**Status:** ✅ Already fixed in previous session

---

## Reliability Features (Feature-Flagged)

### Dead-Letter Handling
**Location:** `src/jobs/postingQueue.ts`  
**Feature Flag:** `ENABLE_DEAD_LETTER_HANDLING=true`

After N retries (default: 5), mark item as `failed_permanent` and continue processing other items.

### Watchdog Job
**Location:** `src/jobs/watchdogJob.ts` (new)  
**Feature Flag:** `ENABLE_WATCHDOG_JOB=true`

Checks every 15 minutes:
- If `last_posted_at > 90 minutes ago` AND `queue not empty`:
  - Reset Playwright session
  - Re-attempt next queued item
  - Log `[WATCHDOG]` events

### Heartbeat Logging
**Location:** All job files  
**Feature Flag:** `ENABLE_HEARTBEAT_LOGGING=true`

Each job logs `[HEARTBEAT]` with:
- Job name
- Cycle success/failure
- Timestamp
- Queue depth (if applicable)

---

## Health Check Script

**Command:** `pnpm health:check`

**Outputs:**
- Last planJob run time
- Queue depth (queued items)
- Last post time
- Last errors summary
- System health status

---

## Next Steps

1. **Apply migration:** Run `supabase migration up` or apply via Railway
2. **Deploy code fixes:** Already committed, will auto-deploy
3. **Enable reliability features:** Set feature flags in Railway
4. **Monitor:** Watch logs for `[WATCHDOG]` and `[HEARTBEAT]` entries

---

## Rollback Plan

If issues occur:
1. Disable feature flags: `ENABLE_DEAD_LETTER_HANDLING=false`, `ENABLE_WATCHDOG_JOB=false`
2. Revert migration if needed (view can be recreated without new columns)
3. Code fixes are backward-compatible (only add safeguards)

