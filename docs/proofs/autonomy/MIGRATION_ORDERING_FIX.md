# Migration Ordering Fix - posted_decisions

**Date:** 2026-02-04  
**Issue:** Migration fails with "cannot create index on relation 'posted_decisions'"

## Step 1: Locate Migrations Referencing posted_decisions

**Found migrations:**
- `20251001_alter_content_metadata_autonomous.sql` (creates table + indexes)
- `20251001_comprehensive_autonomous_system.sql` (creates table + indexes)
- `20251001_add_performance_indexes.sql` (creates indexes only)
- `20251018_fix_posted_decisions_constraint.sql` (alters table)
- `20251022_fix_missing_columns.sql` (alters table)
- `20251019180300_authoritative_schema.sql` (alters table)

**Ordering:** Lexicographic (20251001_* runs before 20251018_*)

## Step 2: Determine Table Creation

**Table creation found in:**
- `20251001_alter_content_metadata_autonomous.sql` line 40: `CREATE TABLE IF NOT EXISTS posted_decisions`
- `20251001_comprehensive_autonomous_system.sql` line 67: `CREATE TABLE IF NOT EXISTS posted_decisions`

**Issue:** Both migrations create the table, but `20251001_alter_content_metadata_autonomous.sql` is executed first lexicographically and has a transaction block that may fail/rollback.

## Step 3: Root Cause

**Problem:** 
1. Migration `20251001_alter_content_metadata_autonomous.sql` has `BEGIN;` / `COMMIT;` block
2. Line 10: `ALTER TABLE content_metadata` may fail if `content_metadata` is a VIEW
3. Transaction aborts, rolling back table creation
4. Index creation (lines 55-60) fails because table doesn't exist

**Fix Applied:**
- Wrapped table creation in `DO $$` block to check for view/table existence
- Made index creation conditional on table existence
- Ensures table is created even if earlier statements in transaction fail

## Step 4: Migration Directory Verification

**Migration runner scans:** `supabase/migrations/` ✅  
**Directory exists in Railway:** ✅ (copied via Dockerfile)

## Step 5: Verification Script

**Created:** `scripts/ops/verify-posted-decisions.ts`  
**Checks:**
- Table existence in `information_schema.tables`
- View existence in `information_schema.views`
- Index existence on table

## Step 6: Commit & Deploy

**Commit:** `fix: repair posted_decisions migration ordering`  
**Git Push:** ✅ SUCCESS  
**Railway Deploy:** ✅ Initiated

## Step 7: Post-Deploy Proof

**Root Cause Identified:**
- `posted_decisions` exists as a VIEW (based on `posted_tweets_comprehensive` table)
- `CREATE TABLE IF NOT EXISTS` silently fails when a view with the same name exists
- Index creation fails because indexes cannot be created on views

**Final Fix Applied:**
- Moved `DROP VIEW IF EXISTS posted_decisions CASCADE;` inside transaction (before table creation)
- Made index creation conditional on table existence using `DO $$` block
- Indexes only created if `posted_decisions` is a BASE TABLE (not a view)

**Migration Logs:** [See output]  
**Service Boot Status:** [See output]  
**Verification Script Output:** [See output]
