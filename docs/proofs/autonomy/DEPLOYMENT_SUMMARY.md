# 🚀 PRODUCTION CUTOVER SUMMARY

**Date:** February 3, 2026  
**Status:** ⏳ **IN PROGRESS**

---

## STEP 1: MIGRATION APPLICATION ⚠️

**Status:** ⚠️ **PENDING** - Requires manual application

**Action Required:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260203_rate_controller_schema.sql`
3. Paste and run
4. Verify success

**Verification:**
```bash
railway run pnpm exec tsx scripts/ops/verify-migration.ts
```

**Expected:** All tables/columns/RPC functions exist

---

## STEP 2: SCHEMA PREFLIGHT ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/rateController/schemaPreflight.ts`

**Behavior:**
- Runs on boot (jobManager.ts)
- Runs before each hourly tick
- If failed: Sets `SAFE_MODE=true`, skips execution
- Logs to `system_events` on failure

**Proof:** `docs/proofs/autonomy/SCHEMA_PREFLIGHT.md`

---

## STEP 3: DEPLOYMENT ⏳

**Status:** ⏳ **PENDING**

**Commands:**
```bash
railway service xBOT
railway up --detach
railway logs -n 400 | grep -E "HOURLY_TICK|SCHEMA_PREFLIGHT"
```

**Expected:** Hourly tick JSON logs emitted

---

## STEP 4: 48-HOUR BURN-IN ⏳

**Status:** ⏳ **PENDING**

**Plan:** `docs/proofs/autonomy/BURN_IN_48H.md`

**Checkpoints:**
- Hour 0: Deployment verification
- Hour 12: Mid-day check
- Hour 24: Learning loop verification
- Hour 48: Final summary

---

## ANSWERS TO QUESTIONS

### A) Hourly Tick Entrypoint

**Location:** `src/jobs/jobManager.ts:279-295`

**Wiring:**
```typescript
this.scheduleStaggeredJob(
  'hourly_tick',
  async () => {
    await this.safeExecute('hourly_tick', async () => {
      const { hourlyTickJob } = await import('./hourlyTickJob');
      await hourlyTickJob();
    });
  },
  60 * MINUTE, // Every hour
  0 // Start immediately
);
```

**Flow:**
1. `jobManager.ts` schedules hourly tick
2. `hourlyTickJob.ts` → `executeHourlyTick()` → `rateController.ts` → `hourlyTick.ts`

### B) SAFE_MODE Environment Variable

**Answer:** ✅ **IMPLEMENTED** - Set by schema preflight

**Location:** `src/rateController/schemaPreflight.ts:118`

**Behavior:**
- Set to `'true'` if preflight fails
- Set to `'false'` if preflight passes
- Checked in `hourlyTick.ts` before execution

**No separate env var needed** - managed internally by preflight system

### C) Migrations on Deploy

**Answer:** ⚠️ **PARTIAL** - DDL requires manual application

**Current State:**
- `src/db/migrations/index.ts` - Runtime migration runner (for DML)
- `scripts/bulletproof_migrate.js` - Migration script (requires `exec_sql` RPC)
- **DDL (CREATE TABLE, ALTER TABLE) cannot be run via Supabase JS client**

**Cleanest Option:**
1. **Manual via Supabase Dashboard** (recommended for DDL)
2. **Railway console + psql** (alternative)
3. **Future:** Create `exec_sql` RPC function in Supabase for programmatic DDL

**Recommendation:** Manual application via Supabase Dashboard SQL Editor (one-time, then schema preflight ensures it's applied)

---

## CODE CHANGES COMMITTED

**Files Modified:**
- `src/jobs/jobManager.ts` - Hourly tick scheduling + preflight on boot
- `src/jobs/postingQueue.ts` - Add metadata fields on post
- `src/posting/atomicPostExecutor.ts` - Add metadata fields on post
- `src/rateController/hourlyTick.ts` - Schema preflight check

**Files Created:**
- `src/rateController/rateController.ts` - Main controller logic
- `src/rateController/hourlyTick.ts` - Hourly execution
- `src/rateController/learningLoop.ts` - Learning loop
- `src/rateController/schemaPreflight.ts` - Schema verification
- `src/rateController/metadataHelpers.ts` - Metadata extraction
- `src/jobs/hourlyTickJob.ts` - Job entrypoint
- `src/jobs/learningLoopJob.ts` - Learning loop job
- `supabase/migrations/20260203_rate_controller_schema.sql` - Migration
- `scripts/ops/verify-migration.ts` - Verification script

**Documentation:**
- `docs/proofs/autonomy/HIGH_VOLUME_CONTROLLER.md`
- `docs/proofs/autonomy/IMPLEMENTATION_SUMMARY.md`
- `docs/proofs/autonomy/PROD_MIGRATION_APPLIED.md`
- `docs/proofs/autonomy/SCHEMA_PREFLIGHT.md`
- `docs/proofs/autonomy/PROD_TICK_LIVENESS.md`
- `docs/proofs/autonomy/BURN_IN_48H.md`

---

**Status:** ⏳ **AWAITING MIGRATION APPLICATION + DEPLOYMENT**
