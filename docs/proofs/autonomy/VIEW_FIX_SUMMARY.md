# View/Table Mismatch Fix Summary

**Date:** February 3, 2026  
**Status:** ✅ COMPLETE

## Issue

`content_metadata` is a VIEW, not a TABLE. The rate controller migration (`20260203_rate_controller_schema.sql`) was attempting to:
1. Add columns to `content_metadata` (which is a view)
2. Create indexes on `content_metadata` (which is a view)
3. Add comments to `content_metadata` columns (which is a view)

This caused errors because PostgreSQL doesn't allow DDL operations directly on views.

## Solution

### 1. Fixed Original Migration

**File:** `supabase/migrations/20260203_rate_controller_schema.sql`

**Changes:**
- Changed `ALTER TABLE content_metadata` → `ALTER TABLE content_generation_metadata_comprehensive`
- Changed index creation to target underlying table
- Changed comments to target underlying table
- Split CHECK constraint into separate statement (PostgreSQL limitation)

**Diff Summary:**
```diff
- ALTER TABLE content_metadata
+ ALTER TABLE content_generation_metadata_comprehensive
    ADD COLUMN IF NOT EXISTS prompt_version TEXT,
    ...

- CREATE INDEX ... ON content_metadata(...)
+ CREATE INDEX ... ON content_generation_metadata_comprehensive(...)

- COMMENT ON COLUMN content_metadata.prompt_version ...
+ COMMENT ON COLUMN content_generation_metadata_comprehensive.prompt_version ...
```

### 2. Created View Update Migration

**File:** `supabase/migrations/20260203_update_content_metadata_view.sql` (NEW)

**Purpose:** Update the view to include new columns so they're accessible via standard queries.

**SQL:**
```sql
DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
SELECT 
  -- ... all existing columns ...
  prompt_version,      -- NEW
  strategy_id,         -- NEW
  hour_bucket,         -- NEW
  outcome_score        -- NEW
FROM content_generation_metadata_comprehensive;
```

### 3. Fixed Old Migration

**File:** `supabase/migrations/20251001_alter_content_metadata_autonomous.sql`

**Issue:** Was creating indexes on `content_metadata` view.

**Fix:** Changed to target underlying table `content_generation_metadata_comprehensive`.

## Verification

### Proof Query

```sql
SELECT prompt_version, strategy_id, hour_bucket, outcome_score 
FROM content_metadata 
LIMIT 1;
```

**Result:** ✅ Successfully returns columns (all NULL initially, as expected)

### Verification Script

```bash
$ railway run pnpm run db:verify
```

**Output:**
```
📊 Checking content_metadata view columns:
  ✅ prompt_version: exists in view
  ✅ strategy_id: exists in view
  ✅ hour_bucket: exists in view
  ✅ outcome_score: exists in view
```

## Canonical Read Surface

The codebase uses `content_metadata` extensively via Supabase client:

```typescript
const { data } = await supabase
  .from('content_metadata')
  .select('prompt_version, strategy_id, hour_bucket, outcome_score')
  .eq('status', 'posted');
```

**Status:** ✅ All queries now work correctly with new columns.

## Files Changed

1. `supabase/migrations/20260203_rate_controller_schema.sql` - Fixed to target underlying table
2. `supabase/migrations/20260203_update_content_metadata_view.sql` - New migration for view update
3. `supabase/migrations/20251001_alter_content_metadata_autonomous.sql` - Fixed indexes
4. `scripts/ops/verify-migration.ts` - Updated to require view columns
5. `scripts/db/apply-rate-controller-migration.ts` - Marked as deprecated

## Migration Order

1. `20260203_rate_controller_schema.sql` - Adds columns to underlying table
2. `20260203_update_content_metadata_view.sql` - Updates view to include columns

Both migrations are idempotent and can be run multiple times safely.
