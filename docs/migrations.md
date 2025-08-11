# Database Migration Runbook

## 🎯 Overview

This automated migration pipeline eliminates manual SQL pasting in the Supabase dashboard and ensures safe, validated database changes across all environments.

## 📋 Pipeline Flow

### 1. 🧪 Shadow Testing (PR Stage)
- **Trigger**: Pull requests touching migration files
- **What happens**: 
  - Spins up fresh PostgreSQL container
  - Applies all migrations in order with `-v ON_ERROR_STOP=1`
  - Runs verification and drift checks
  - Comments results on PR
- **Purpose**: Catch migration issues before they reach any real environment

### 2. 🚀 Staging Deployment (Auto)
- **Trigger**: Push to `main` branch after PR merge
- **What happens**:
  - Uses Supabase CLI to apply migrations to staging
  - Runs verification checks
  - Uploads results as artifacts
- **Purpose**: Test migrations against real Supabase infrastructure

### 3. 🏭 Production Deployment (Manual Approval)
- **Trigger**: Manual approval after staging success
- **What happens**:
  - Requires manual approval in GitHub
  - Applies migrations to production
  - Runs final verification
  - Monitors for issues
- **Purpose**: Controlled production deployment with human oversight

## 🔧 Adding a New Migration

### Step 1: Create Migration File
```bash
# Use chronological naming
touch supabase/migrations/$(date +%Y%m%d_%H%M%S)_add_user_preferences.sql
```

### Step 2: Write Additive-Only SQL
```sql
-- ✅ GOOD: Additive changes only
BEGIN;

SET lock_timeout = '30s';
SET statement_timeout = '60s';

-- Add new column
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::JSONB;

-- Add index
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);

-- Seed data using UPSERT
INSERT INTO bot_config (environment, config_key, config_value, metadata, updated_at)
VALUES ('production', 'user_preferences_enabled', '{"enabled": true}', '{"created_by": "migration"}', NOW())
ON CONFLICT ON CONSTRAINT bot_config_env_key_unique 
DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW();

COMMIT;
```

### Step 3: Local Testing
```bash
# Test with shadow environment (requires Docker + psql)
npm run db:shadow

# Or manually test syntax
psql -f supabase/migrations/your_new_migration.sql
```

### Step 4: Create Pull Request
- Push your branch with the new migration
- Pipeline automatically runs shadow testing
- Review results in PR comments
- Address any issues and push fixes
- Merge when tests pass

### Step 5: Monitor Deployment
- Staging deploys automatically on merge
- Check GitHub Actions for staging results
- Approve production deployment when ready
- Monitor production verification results

## 📜 Migration Rules

### ✅ ALWAYS DO
- **Additive-only**: Only `CREATE`, `ALTER TABLE ADD`, `CREATE INDEX IF NOT EXISTS`
- **Idempotent**: Use `IF NOT EXISTS`, `IF EXISTS`, proper `ON CONFLICT`
- **JSONB-first**: Add flexible fields as JSONB to avoid future schema changes
- **Transactions**: Wrap in `BEGIN; ... COMMIT;`
- **Timeouts**: Set conservative `lock_timeout` and `statement_timeout`
- **Unique constraints**: Ensure they exist before any `ON CONFLICT` upserts

### ❌ NEVER DO
- **Destructive operations**: `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE`
- **Data manipulation**: Large `UPDATE`/`DELETE` in migrations (use separate data scripts)
- **Environment-specific code**: Keep migrations environment-agnostic
- **Dependencies on application code**: Migrations must be self-contained

## 🏗 File Structure

```
supabase/
├── migrations/
│   ├── 0001_baseline.sql           # Foundation with 5 core tables
│   └── YYYYMMDD_HHMMSS_*.sql      # Your migrations (chronological)
└── verify/
    ├── verify.sql                  # Post-migration validation
    └── drift_check.sql             # Schema drift detection

scripts/
├── migrate-shadow.sh               # Local shadow testing
├── migrate-stage.sh                # Staging deployment
└── migrate-prod.sh                 # Production deployment

.github/workflows/
└── db-migrations.yml               # CI/CD pipeline
```

## 🔄 Local Commands

```bash
# Test migration locally (requires Docker + psql)
npm run db:shadow

# Deploy to staging (requires STAGING_PROJECT_REF)
export STAGING_PROJECT_REF=your_staging_ref
npm run db:stage

# Deploy to production (requires PROD_PROJECT_REF + confirmation)
export PROD_PROJECT_REF=your_prod_ref
npm run db:prod
```

## 🔧 Rollback Procedures

### Option 1: Revert Migration (Preferred)
```bash
# Create rollback migration
touch supabase/migrations/$(date +%Y%m%d_%H%M%S)_rollback_user_preferences.sql

# Content: Reverse the changes (only if safe)
BEGIN;
-- Only if safe and non-destructive
ALTER TABLE users DROP COLUMN IF EXISTS preferences;
DELETE FROM bot_config WHERE config_key = 'user_preferences_enabled';
COMMIT;
```

### Option 2: Git Revert
```bash
# Revert the problematic commit
git revert <commit-hash>
git push origin main
# Pipeline will automatically deploy the reverted state
```

### Option 3: Supabase Backup Restore (Emergency)
```bash
# Use Supabase dashboard or CLI
supabase db dump --project-ref <PROJECT_REF> --restore-from <BACKUP_ID>
```

## 🚨 Troubleshooting

### Migration Fails in Shadow Test
1. Check the error in GitHub Actions logs
2. Fix the SQL locally
3. Test with `npm run db:shadow`
4. Push the fix to your PR branch
5. Pipeline re-runs automatically

### Staging Deployment Fails
1. Check Supabase dashboard for connection issues
2. Verify `STAGING_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`
3. Check for schema conflicts in staging
4. Run verification manually if needed

### Production Needs Emergency Fix
1. Create hotfix branch from main
2. Add minimal fix migration
3. Push through pipeline (shadow → staging → production)
4. For critical issues, coordinate with team for manual intervention

## 🔍 Required Environment Variables

Set these in your GitHub repository secrets:

```bash
SUPABASE_ACCESS_TOKEN       # Supabase service account token
STAGING_PROJECT_REF         # Staging project reference ID
PROD_PROJECT_REF           # Production project reference ID
STAGING_DB_URL             # PostgreSQL connection for verification (optional)
PRODUCTION_DB_URL          # PostgreSQL connection for verification (optional)
```

## 🏆 Best Practices

### Schema Design
- **Use JSONB**: Prefer `metadata JSONB` over multiple columns
- **Index strategically**: Add indexes for actual query patterns
- **Unique constraints**: Always add before `ON CONFLICT` upserts
- **Default values**: Always provide sensible defaults

### Migration Timing
- **Small batches**: Multiple small migrations > one large migration
- **Off-peak hours**: Schedule production deployments during low usage
- **Coordinate with team**: Announce schema changes that affect application code

### Monitoring
- **Check verification logs**: Always review post-deployment verification
- **Monitor application**: Watch for errors after schema changes
- **Database performance**: Monitor query performance after index changes

---

**🎉 Success!** This pipeline ensures your database changes are always safe, tested, and reversible. No more manual SQL pasting in dashboards!
