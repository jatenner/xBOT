# Database Migration Runner Fix

**Date:** 2026-02-04  
**Issue:** Railway boot failing with `ERR_MODULE_NOT_FOUND: /app/scripts/db/apply-migrations.ts`

## Step 1: Package.json Script Inspection

**db:migrate script:** `tsx scripts/db/apply-migrations.ts`  
**File exists in repo:** ✅ YES (`scripts/db/apply-migrations.ts`)

## Step 2: File Existence Verification

**Local file check:** ✅ EXISTS  
**Git tracking:** ✅ TRACKED (`git ls-files` confirms)

## Step 3: Root Cause

**Issue:** Dockerfile does NOT copy `scripts/` directory to Railway container  
**Evidence:** Dockerfile only copies:
- `dist/` (compiled output)
- `public/`
- `supabase/`
- `package.json`

**Missing:** `scripts/` directory (needed for `tsx scripts/db/apply-migrations.ts`)

## Step 4: Fix Applied

**Dockerfile Change:** Added `COPY --from=builder /app/scripts ./scripts`  
**Location:** After `COPY --from=builder /app/supabase ./supabase`  
**Reason:** `tsx` needs source TypeScript files, not compiled JavaScript

## Step 5: Commit & Deploy

**Commit:** `fix: restore db:migrate runner for Railway boot`  
**Git Push:** ✅ SUCCESS  
**Railway Deploy:** ✅ Initiated

## Step 6: Post-Deploy Proof

**Migration Logs:**
```
[WORKER] 🔧 Running database migrations...
> xbot@1.0.0 db:migrate /app
> tsx scripts/db/apply-migrations.ts
🔧 Starting migration runner...
✅ Connected to database
🔒 Acquiring advisory lock...
✅ Advisory lock acquired
✅ Migrations table ready
📊 Found 124 previously applied migrations
📋 Found 124 migration files
📄 Applying migration: 20251001_alter_content_metadata_autonomous.sql
```

**Service Boot Status:** ❌ **FAILING** - Migration script runs but fails during migration application

**Error:** Migration fails at `applyMigration` function (line 119), causing fail-fast exit

## Summary

**db:migrate script:** `tsx scripts/db/apply-migrations.ts` ✅  
**File path:** `scripts/db/apply-migrations.ts` ✅ EXISTS (now copied to Railway container)  
**Final command:** `pnpm run db:migrate` → `tsx scripts/db/apply-migrations.ts` ✅  
**Dockerfile fix:** ✅ Added `COPY --from=builder /app/scripts ./scripts`  
**Migration execution:** ⚠️ **PARTIAL** - Script runs but migration application fails

**Status:** File access issue RESOLVED, but migration execution failing (separate issue to investigate)
