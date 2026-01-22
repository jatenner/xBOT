# ❌ AUTO MIGRATION DID NOT APPLY

**Date:** 2026-01-22  
**Migration:** `supabase/migrations/20260122_add_is_test_post_column.sql`  
**Status:** ❌ **NOT APPLIED**

---

## Diagnosis

The migration file exists and was committed, but the `is_test_post` column does not exist in the database.

### Verification Query
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'content_metadata'
  AND column_name = 'is_test_post';
```

**Result:** 0 rows (column does not exist)

---

## Root Cause Analysis

### Possible Causes

1. **No automatic migration runner configured**
   - Railway may not be configured to run Supabase migrations on deploy
   - No migration script in `package.json` or deployment hooks

2. **Migration file naming/path issue**
   - Migration file exists but may not be in the correct location for auto-apply
   - Supabase CLI may require specific naming conventions

3. **Migration not included in deploy**
   - Migration files may not be included in Railway build/deploy process
   - Supabase migrations may need to be applied separately

---

## Minimal Fix Options

### Option A: Manual SQL Application (Immediate)

Apply the migration directly via Supabase SQL Editor:

```sql
BEGIN;

ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS is_test_post BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_metadata_is_test_post 
ON content_metadata (is_test_post) 
WHERE is_test_post = true;

COMMENT ON COLUMN content_metadata.is_test_post IS 
'Flag to separate test posts from production. Test posts are blocked by default unless ALLOW_TEST_POSTS=true env var is set.';

COMMIT;
```

**Pros:** Immediate, no code changes  
**Cons:** Manual step, doesn't fix auto-migration for future

### Option B: Add Migration Runner Script (Recommended)

Create a migration runner that executes on Railway deploy:

1. **Add to `package.json`:**
   ```json
   {
     "scripts": {
       "migrate": "supabase db push --password $SUPABASE_DB_PASSWORD"
     }
   }
   ```

2. **Add to Railway build/deploy:**
   - Run `pnpm run migrate` after build, before start
   - Or add as a separate Railway service that runs migrations

**Pros:** Fixes auto-migration for future  
**Cons:** Requires Railway configuration

### Option C: Supabase Migration Webhook

If Supabase has webhook/API for migrations:
- Configure Railway to call Supabase migration API on deploy
- Requires Supabase API access

---

## Recommended Immediate Action

**Apply migration manually via Supabase SQL Editor** (Option A) to unblock the feature, then investigate Option B for future migrations.

---

## Migration Health Guard

The code now includes a migration health guard that will:
- Check for `is_test_post` column at PostingQueue startup
- Disable posting if column is missing (fail-closed)
- Log loud error messages

This prevents unsafe behavior but also means posting will be disabled until migration is applied.

---

**Next Steps:**
1. Apply migration manually (Option A)
2. Verify migration applied: Re-run verification query
3. Test guardrails: Run proof steps 3-5
4. Configure auto-migration: Set up Option B for future
