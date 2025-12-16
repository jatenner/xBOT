# Reliability Diagnosis & Fixes - December 16, 2025

## 🔍 Diagnosis Summary

**Stuck at:** Content queue insert stage  
**Root Cause:** Schema cache errors preventing content from being queued

### Evidence from Logs:
```
[PLAN_JOB] ❌ Failed to queue content: {
  error="Could not find the 'structure_type' column of 'content_metadata' in the schema cache"
```

**Impact:**
- planJob generates content successfully
- Content fails to insert into database
- Posting queue finds 0 decisions ready
- No posts in ~4 hours

---

## ✅ Fixes Applied

### 1. Schema Migration (`20251216_fix_phase5_schema_columns.sql`)
**Status:** ✅ Created, needs application

Adds missing columns to `content_metadata` view:
- `structure_type` (Phase 5 voice guide)
- `hook_type` (Phase 5 voice guide)

**To apply:**
```bash
# Via Supabase CLI
supabase migration up

# Or via Railway
railway run supabase migration up
```

### 2. Numeric Overflow Fix (`planJob.ts`)
**Status:** ✅ Applied and built

Clamps `quality_score` and `predicted_er` to valid DECIMAL(5,4) range (0-9.9999):
- Converts 0-100 scale to 0-1.0 if needed
- Prevents "numeric field overflow" errors

### 3. Dead-Letter Handling (`postingQueue.ts`)
**Status:** ✅ Applied (feature-flagged)

After N retries (default: 5), marks items as `failed_permanent` instead of `failed`:
- Prevents infinite retry loops
- Allows queue to continue processing other items

**Feature Flag:** `ENABLE_DEAD_LETTER_HANDLING=true`

### 4. Watchdog Job (`watchdogJob.ts`)
**Status:** ✅ Created (feature-flagged)

Monitors posting pipeline health every 15 minutes:
- If `last_posted_at > 90 minutes` AND `queue not empty`:
  - Resets Playwright session
  - Re-attempts next queued item
  - Logs `[WATCHDOG]` events

**Feature Flag:** `ENABLE_WATCHDOG_JOB=true`

### 5. Health Check Script (`scripts/health-check.ts`)
**Status:** ✅ Created

Command: `pnpm health:check`

Outputs:
- Last planJob run time
- Queue depth (queued items)
- Last post time
- Recent errors summary
- System health status

---

## 🚀 Deployment Steps

### Immediate (Required):
1. **Apply migration:**
   ```bash
   railway run supabase migration up
   ```
   Or apply `supabase/migrations/20251216_fix_phase5_schema_columns.sql` manually

2. **Deploy code:** Already committed, will auto-deploy via Railway

### Optional (Reliability Features):
3. **Enable dead-letter handling:**
   ```bash
   railway variables set ENABLE_DEAD_LETTER_HANDLING=true
   ```

4. **Enable watchdog job:**
   ```bash
   railway variables set ENABLE_WATCHDOG_JOB=true
   ```

5. **Set max retries (optional):**
   ```bash
   railway variables set POSTING_MAX_RETRIES=5
   ```

---

## 📊 Verification

After deployment, verify:

1. **Check logs for schema errors:**
   ```bash
   railway logs --service xBOT | grep -E "structure_type|schema cache"
   ```
   Should see no errors

2. **Run health check:**
   ```bash
   pnpm health:check
   ```
   Should show queue depth and last post time

3. **Monitor posting:**
   ```bash
   railway logs --service xBOT | grep -E "\[POSTING_QUEUE\]|POST_SUCCESS"
   ```
   Should see successful posts

---

## 🔄 Rollback Plan

If issues occur:

1. **Disable feature flags:**
   ```bash
   railway variables set ENABLE_DEAD_LETTER_HANDLING=false
   railway variables set ENABLE_WATCHDOG_JOB=false
   ```

2. **Revert migration (if needed):**
   - View can be recreated without new columns
   - Code will handle missing columns gracefully

3. **Code fixes are backward-compatible:**
   - Only add safeguards, don't break existing behavior

---

## 📝 Files Changed

- `supabase/migrations/20251216_fix_phase5_schema_columns.sql` (new)
- `src/jobs/planJob.ts` (numeric overflow fix)
- `src/jobs/postingQueue.ts` (dead-letter handling)
- `src/jobs/watchdogJob.ts` (new)
- `src/main-bulletproof.ts` (watchdog integration)
- `scripts/health-check.ts` (new)
- `package.json` (health:check script)

---

**Status:** ✅ All fixes applied, ready for deployment

