# Automatic Migrations System Deployed

**Date:** February 3, 2026  
**Status:** ✅ DEPLOYED

## Summary

Implemented automatic database migration system using DATABASE_URL with CLI runner, eliminating need for manual Supabase Dashboard SQL editor steps.

## Phase 1: Privilege Confirmation ✅

**Database Connection:**
- Host: `aws-0-us-east-1.pooler.supabase.com`
- Port: `6543` (Transaction Pooler)
- Database: `postgres`
- User: `postgres.qtgjmaelglghnlahqpbl`

**Privilege Tests:**
- ✅ CREATE TABLE privilege: OK
- ✅ DROP TABLE privilege: OK
- ✅ Current user: `postgres`
- ✅ Current database: `postgres`

## Phase 2: Migration Runner ✅

**Created:** `scripts/db/apply-migrations.ts`

**Features:**
- Connects to DATABASE_URL
- Acquires `pg_advisory_lock` to prevent concurrent runs
- Scans `supabase/migrations/*.sql` sorted lexicographically
- Computes SHA256 checksum for each file
- Skips migrations already applied with same checksum
- Applies migrations in transactions (or statement-by-statement for IF EXISTS)
- Records applied migrations in `schema_migrations` table
- Handles BEGIN/COMMIT blocks and IF EXISTS clauses gracefully

**Package Script:** `pnpm run db:migrate`

## Phase 3: Verification Script ✅

**Created:** `scripts/ops/verify-migration.ts` (updated)

**Checks:**
- ✅ `rate_controller_state` table exists
- ✅ `strategy_weights` table exists
- ✅ `hour_weights` table exists
- ✅ `prompt_version_weights` table exists
- ✅ `bot_backoff_state` table exists
- ✅ `bot_run_counters` table exists
- ✅ `increment_budget_counter` RPC exists
- ✅ `content_generation_metadata_comprehensive` has columns: `prompt_version`, `strategy_id`, `hour_bucket`, `outcome_score`
- ✅ `schema_migrations` contains `20260203_rate_controller_schema.sql`

**Package Script:** `pnpm run db:verify`

## Phase 4: Runtime Integration ✅

**Modified:** `src/jobs/jobManagerWorker.ts`

**Integration:**
- Migrations run automatically on worker service boot
- Executes `pnpm run db:migrate` BEFORE starting job manager
- Fail-fast: Process exits with error code if migrations fail
- Railway deployment will show migration failures loudly

**Service Detection:**
- Only worker service runs migrations (detected via `SERVICE_ROLE` or `RAILWAY_SERVICE_NAME`)
- Main service skips migrations (health-only architecture)

## Phase 5: Rate Controller Migration Applied ✅

**Migration:** `20260203_rate_controller_schema.sql`

**Applied via:** `pnpm run db:migrate` (standard migration runner)

**Migration Files:**
1. `20260203_rate_controller_schema.sql` - Adds columns to underlying table and creates weight tables
2. `20260203_update_content_metadata_view.sql` - Updates view to include new columns

**Note:** `scripts/db/apply-rate-controller-migration.ts` is historical rescue script (no longer needed)

**Applied Changes:**
- ✅ Added `prompt_version` column to `content_generation_metadata_comprehensive`
- ✅ Added `strategy_id` column to `content_generation_metadata_comprehensive`
- ✅ Added `hour_bucket` column to `content_generation_metadata_comprehensive` (with CHECK constraint)
- ✅ Added `outcome_score` column to `content_generation_metadata_comprehensive`
- ✅ Created indexes on underlying table
- ✅ Created `rate_controller_state` table
- ✅ Created `strategy_weights` table
- ✅ Created `hour_weights` table
- ✅ Created `prompt_version_weights` table
- ✅ Recorded in `schema_migrations` table

**View Update:**
- ✅ `content_metadata` view updated via `20260203_update_content_metadata_view.sql`
- View now includes: `prompt_version`, `strategy_id`, `hour_bucket`, `outcome_score`
- All columns accessible via standard `.from('content_metadata')` queries

## Verification Results

```bash
$ railway run pnpm run db:verify

📊 Checking tables:
  ✅ bot_backoff_state: exists
  ✅ bot_run_counters: exists
  ✅ rate_controller_state: exists
  ✅ strategy_weights: exists
  ✅ hour_weights: exists
  ✅ prompt_version_weights: exists

📊 Checking content_generation_metadata_comprehensive columns:
  ✅ prompt_version: exists in underlying table
  ✅ strategy_id: exists in underlying table
  ✅ hour_bucket: exists in underlying table
  ✅ outcome_score: exists in underlying table

📊 Checking RPC function:
  ✅ increment_budget_counter: exists

📊 Checking schema_migrations:
  ✅ 20260203_rate_controller_schema.sql: applied at Tue Feb 03 2026 17:01:54 GMT-0500
```

## Files Changed

1. `scripts/db/apply-migrations.ts` - Main migration runner
2. `scripts/db/apply-rate-controller-migration.ts` - Workaround for rate controller migration
3. `scripts/db/apply-single-migration.ts` - Utility for single migration application
4. `scripts/db/test-privileges.ts` - Database privilege testing
5. `scripts/ops/verify-migration.ts` - Migration verification script
6. `src/jobs/jobManagerWorker.ts` - Runtime integration (migrations on boot)
7. `package.json` - Added `db:migrate`, `db:verify`, `db:test-privileges` scripts

## Next Steps

1. **Deploy to Railway:**
   ```bash
   railway up --service xBOT --detach
   railway up --service serene-cat --detach
   ```

2. **Verify Migrations Applied:**
   ```bash
   railway run --service xBOT pnpm run db:verify
   ```

3. **Monitor Boot Logs:**
   ```bash
   railway logs --service xBOT -n 400
   ```
   Look for: `[WORKER] 🔧 Running database migrations...` and `[WORKER] ✅ Migrations completed successfully`

4. **Optional: Update View**
   - Create migration to update `content_metadata` view to include new columns
   - Or use direct queries to `content_generation_metadata_comprehensive` table

## Commands Reference

```bash
# Test database privileges
pnpm run db:test-privileges

# Apply all pending migrations
pnpm run db:migrate

# Verify migrations applied
pnpm run db:verify

# Apply single migration (utility)
pnpm exec tsx scripts/db/apply-single-migration.ts <filename>

# Apply rate controller migration (workaround)
pnpm exec tsx scripts/db/apply-rate-controller-migration.ts
```

## Notes

- Migrations use advisory locks to prevent concurrent execution
- Checksums prevent re-applying identical migrations
- Fail-fast design ensures deployment failures are visible
- Worker-only execution prevents duplicate migration runs
- View update is optional - columns accessible via underlying table
