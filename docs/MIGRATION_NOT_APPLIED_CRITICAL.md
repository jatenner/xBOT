# ❌ CRITICAL: MIGRATION DID NOT AUTO-APPLY

**Date:** 2026-01-22  
**Migration:** `supabase/migrations/20260122_add_is_test_post_column.sql`  
**Status:** ❌ **NOT APPLIED**

---

## Verification Result

**Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'content_metadata'
  AND column_name = 'is_test_post';
```

**Result:** ❌ **0 rows returned** - Column does not exist

---

## Impact

- ❌ `is_test_post` column missing from `content_metadata`
- ❌ Test/prod lane guardrail cannot function
- ❌ Migration health guard will fail-closed (prevents posting)
- ⚠️  System is in safe state (fail-closed) but feature is non-functional

---

## Root Cause Analysis

**Migration File:** ✅ Exists at `supabase/migrations/20260122_add_is_test_post_column.sql`

**Possible Causes:**
1. **Supabase migration runner not configured** - Migrations in `supabase/migrations/` may not auto-apply
2. **Migration file naming** - Supabase may require specific naming convention
3. **Migration system not running** - Railway/Supabase integration may not be active
4. **Migration already attempted but failed** - Check Supabase migration logs

---

## Fix Required

### Option 1: Manual Application (Immediate)

Run the migration SQL directly in Supabase SQL Editor:

```sql
BEGIN;

ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS is_test_post BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_metadata_is_test_post 
ON content_metadata (is_test_post) 
WHERE is_test_post = true;

COMMIT;
```

### Option 2: Fix Auto-Migration (Long-term)

1. **Check Supabase migration configuration:**
   - Verify `supabase/migrations/` is configured in Supabase project
   - Check if migrations are set to auto-apply on deploy
   - Review Railway build logs for migration execution

2. **Verify migration file format:**
   - Ensure file matches Supabase migration naming: `YYYYMMDDHHMMSS_name.sql`
   - Current file: `20260122_add_is_test_post_column.sql` (may need timestamp)

3. **Check migration runner:**
   - If using Supabase CLI: Run `supabase db push`
   - If using Railway: Verify migration hook in build process

---

## Verification After Fix

Run:
```bash
pnpm exec tsx scripts/verify/verify-migration-is-test-post.ts
```

Expected: ✅ Column exists with correct properties

---

## Migration Health Guard Status

The migration health guard in `src/jobs/postingQueue.ts` will:
- ✅ Detect missing column
- ✅ Log `[MIGRATION_HEALTH] ❌ CRITICAL` error
- ✅ Write `MIGRATION_HEALTH_CHECK_FAILED` event
- ✅ **Fail-closed:** Posting queue will not process decisions

This is **correct behavior** - system is safe but non-functional until migration is applied.

---

**Action Required:** Apply migration manually or fix auto-migration configuration
