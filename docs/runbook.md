# Database Pipeline Operations Runbook

## 🚀 Quick Reference

### Daily Operations
```bash
# Check app startup guards
npm run test:guards

# Run local migration verification
npm run db:shadow

# Monitor Redis health
npm run redis:health
```

### Emergency Commands
```bash
# Bypass schema guard (emergency only)
export SKIP_SCHEMA_GUARD=true

# Check database connectivity
scripts/smoke.sql

# Monitor production health
curl https://your-app.railway.app/health
```

## 📋 How to Run Staging Verification Locally

### Prerequisites
```bash
# Required tools
supabase --version  # v2.23.4+
psql --version      # PostgreSQL client
node -v            # Node.js 18+

# Required environment variables
export STAGING_PROJECT_REF="uokidynvzfkxwvxlpnfu"
export PROD_PROJECT_REF="qtgjmaelglqhnlahqpbl"
export APP_SCHEMA_VERSION="1.0.0"
export APP_ENV="staging"
export REDIS_PREFIX="stg:"
```

### Local Migration Test
```bash
# 1. Test migrations with shadow database
npm run db:shadow

# 2. Test startup guards
node -e "
require('./src/utils/schemaVersionCheck').schemaVersionCheck()
  .then(() => console.log('✅ Schema guard passed'))
  .catch(err => console.log('❌ Schema guard failed:', err.message))
"

# 3. Test Redis health (if available)
node -e "
require('./src/utils/redis/health').checkRedisHealth()
  .then(result => console.log('Redis health:', result))
"
```

### Manual Database Connection
```bash
# Connect to staging (when DNS works)
PGPASSWORD='ChristopherNolanfan123!' psql \
  'sslmode=require host=db.uokidynvzfkxwvxlpnfu.supabase.co dbname=postgres user=postgres'

# Run smoke test
PGPASSWORD='ChristopherNolanfan123!' psql \
  'sslmode=require host=db.uokidynvzfkxwvxlpnfu.supabase.co dbname=postgres user=postgres' \
  -f scripts/smoke.sql
```

## 🔄 How the PR Gate Works

### Automatic PR Verification

1. **Trigger**: PR created/updated with changes to:
   - `supabase/migrations/**`
   - `supabase/verify/**` 
   - `scripts/smoke.sql`
   - `.github/workflows/pr-migrations.yml`

2. **Workflow Steps** (`.github/workflows/pr-migrations.yml`):
   ```bash
   # 1. Setup environment
   - Checkout code
   - Install Node.js, Supabase CLI, PostgreSQL client
   
   # 2. Link to staging
   - Use SUPABASE_ACCESS_TOKEN secret
   - Link to STAGING_PROJECT_REF
   
   # 3. Apply migrations
   - Run: supabase db push
   
   # 4. Verification
   - Run smoke tests with STAGING_DB_PASSWORD
   - Run schema verification scripts
   - Check for drift detection
   
   # 5. Report results
   - Update PR with success/failure status
   - Block merge if any step fails
   ```

3. **Required Secrets**:
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_d6fed4a8ceff1795b6a3c27bcb8bca75ee7e7fe7
   STAGING_PROJECT_REF=uokidynvzfkxwvxlpnfu  
   STAGING_DB_PASSWORD=ChristopherNolanfan123!
   ```

### Manual Verification Override
```bash
# If PR checks fail but you need to proceed (emergency only):
# 1. Review failure logs in GitHub Actions
# 2. Fix issues and push new commits
# 3. Re-run failed jobs if transient
# 4. Admin can override protection rules if absolutely necessary
```

## 🚀 How to Promote to Production

### Step-by-Step Production Deployment

1. **Prerequisites**:
   - PR merged successfully with green staging verification
   - No active incidents in production
   - Deployment window scheduled (if major changes)

2. **Initiate Deployment**:
   ```bash
   # Go to GitHub repository
   # Navigate to: Actions → "Promote to Production - Apply Migrations"
   # Click: "Run workflow"
   # Input: "CONFIRM PRODUCTION DEPLOYMENT" (exact text)
   # Click: "Run workflow"
   ```

3. **Approval Process**:
   - Workflow requires manual approval from production environment
   - Review deployment details in approval request
   - Approve or reject based on readiness

4. **Deployment Steps** (`.github/workflows/promote-prod.yml`):
   ```bash
   # 1. Validation
   - Confirm exact deployment text entered
   - Pre-flight database connectivity check
   
   # 2. Migration Application  
   - Link to production project
   - Apply migrations: supabase db push
   
   # 3. Verification
   - Run schema verification
   - Health check production database
   - Log deployment to audit_log
   
   # 4. Reporting
   - Generate deployment summary
   - Provide post-deployment checklist
   ```

5. **Required Secrets**:
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_d6fed4a8ceff1795b6a3c27bcb8bca75ee7e7fe7
   PROD_PROJECT_REF=qtgjmaelglqhnlahqpbl
   PROD_DB_PASSWORD=Christophernolanfan123!!
   ```

### Post-Deployment Verification
```bash
# 1. Check application health
curl https://your-app.railway.app/health

# 2. Verify schema version
# App should start successfully with schema guard

# 3. Monitor logs
# Railway logs should show successful startup

# 4. Verify core functionality
# Test key application features
```

## 🔄 Rollback Notes

### Database Rollback Strategies

1. **Schema Rollback** (Complex - Avoid if Possible):
   ```bash
   # Database schema rollbacks are complex and risky
   # Prevention is better than rollback:
   - Always use additive-only migrations
   - New columns should be nullable initially  
   - Use feature flags for major changes
   ```

2. **Application Rollback** (Preferred):
   ```bash
   # Rollback application deployment on Railway:
   # 1. Go to Railway dashboard
   # 2. Select previous successful deployment
   # 3. Redeploy previous version
   # 4. Update APP_SCHEMA_VERSION if needed
   ```

3. **Emergency Schema Fixes**:
   ```bash
   # If database issue prevents app startup:
   
   # Option 1: Bypass schema guard temporarily
   export SKIP_SCHEMA_GUARD=true
   
   # Option 2: Create emergency migration
   supabase migration new emergency_fix_issue_description
   # Write corrective SQL
   # Deploy via normal process
   
   # Option 3: Manual database fix (last resort)
   PGPASSWORD='Christophernolanfan123!!' psql \
     'sslmode=require host=db.qtgjmaelglqhnlahqpbl.supabase.co dbname=postgres user=postgres' \
     -c "-- Emergency fix SQL here"
   ```

### Feature Flag Rollback
```bash
# Disable features via bot_config without schema changes:
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{feature_name}', 'false')
WHERE config_key = 'feature_flags' AND environment = 'production';
```

### Job/Process Rollback
```bash
# Disable posting temporarily:
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{autonomous_posting}', 'false')
WHERE config_key = 'feature_flags' AND environment = 'production';

# Or via Railway environment:
# Set LIVE_POSTS=false in Railway dashboard
```

## 🔐 GitHub Secrets Required

### Repository Secrets Setup

Navigate to: `GitHub Repository → Settings → Secrets and variables → Actions`

#### Production Secrets
```bash
# Supabase Integration
SUPABASE_ACCESS_TOKEN
Value: sbp_d6fed4a8ceff1795b6a3c27bcb8bca75ee7e7fe7

# Production Database
PROD_PROJECT_REF  
Value: qtgjmaelglqhnlahqpbl

PROD_DB_PASSWORD
Value: Christophernolanfan123!!
```

#### Staging Secrets  
```bash
# Staging Database
STAGING_PROJECT_REF
Value: uokidynvzfkxwvxlpnfu

STAGING_DB_PASSWORD  
Value: ChristopherNolanfan123!
```

### Secret Security Notes
- Secrets are never logged in workflow outputs
- Use GitHub's secret masking in logs
- Rotate secrets periodically for security
- Never commit secrets to repository
- Railway env uses different secrets (production Supabase keys only)

## 🛡️ Schema Guard Operations

### Schema Version Management

The schema guard compares `APP_SCHEMA_VERSION` environment variable with the database `schema_version` in `bot_config` table.

#### Version Format
```bash
# Semantic versioning: MAJOR.MINOR.PATCH
APP_SCHEMA_VERSION=1.0.0

# Database stores version in bot_config:
{
  "version": "1.0.0",
  "migration": "0001_baseline", 
  "timestamp": "2025-08-11T..."
}
```

#### Compatibility Rules
```typescript
// Exact match (safest)
DB: 1.0.0, App: 1.0.0 → ✅ Compatible

// Database newer (usually safe)  
DB: 1.1.0, App: 1.0.0 → ✅ Compatible

// App newer (requires migration)
DB: 1.0.0, App: 1.1.0 → ❌ Incompatible - run migrations

// Major version mismatch
DB: 2.0.0, App: 1.0.0 → ❌ Incompatible - version conflict
```

#### Emergency Bypass
```bash
# Development/emergency only:
export SKIP_SCHEMA_GUARD=true

# Application will start with warning but bypass version check
# Use only for debugging or emergency recovery
```

### Troubleshooting Schema Issues

#### Schema Guard Blocks Startup
```bash
# 1. Check versions
echo "App version: $APP_SCHEMA_VERSION"

# 2. Check database version  
PGPASSWORD='PASSWORD' psql 'connection_string' -c \
  "SELECT config_value FROM bot_config WHERE config_key = 'schema_version';"

# 3. Options:
# - Run migrations to update database
# - Update APP_SCHEMA_VERSION to match database
# - Emergency bypass with SKIP_SCHEMA_GUARD=true
```

#### Database Connection Issues
```bash
# Test connectivity
PGPASSWORD='PASSWORD' psql 'connection_string' -c "SELECT 1;"

# Check Supabase status
# Visit: https://status.supabase.com/

# Verify project ref and password
# Double-check environment variables
```

## 🔴 Redis Operations

### Redis Environment Isolation

Each environment uses a different Redis prefix:
- **Staging**: `REDIS_PREFIX=stg:`
- **Production**: `REDIS_PREFIX=prod:`

### Redis Health Monitoring
```bash
# Check Redis connectivity
node -e "
const { checkRedisHealth } = require('./src/utils/redis/health');
checkRedisHealth().then(console.log);
"

# Test specific Redis operations
redis-cli -u "$REDIS_URL" PING
redis-cli -u "$REDIS_URL" SET "stg:test" "value"
redis-cli -u "$REDIS_URL" GET "stg:test"
```

### Redis Key Management
```bash
# List keys by environment
redis-cli -u "$REDIS_URL" KEYS "stg:*"    # Staging keys
redis-cli -u "$REDIS_URL" KEYS "prod:*"   # Production keys

# Clear environment (emergency only)
redis-cli -u "$REDIS_URL" EVAL "
  for _,k in ipairs(redis.call('keys', ARGV[1])) do 
    redis.call('del', k) 
  end
" 0 "stg:*"
```

### Redis Troubleshooting
```bash
# Common issues and solutions:

# 1. Connection timeout
# - Check REDIS_URL format
# - Verify network connectivity
# - Check Redis Cloud status

# 2. Memory issues  
redis-cli -u "$REDIS_URL" INFO memory

# 3. Application continues without Redis
# - Redis failures are non-fatal
# - App uses Supabase fallback
# - Monitor performance impact
```

---

## 📞 Support & Escalation

### On-Call Procedures
1. **Database Issues**: Check verification report, run health checks
2. **Schema Conflicts**: Review schema guard logs, consider bypass
3. **Redis Problems**: Verify connectivity, check memory usage
4. **Deployment Failures**: Review GitHub Actions logs, check secrets

### Emergency Contacts
- **Database Issues**: Development Team
- **Infrastructure**: Railway/Supabase Support  
- **Redis**: Redis Cloud Support

### Documentation Updates
- Update this runbook after major changes
- Keep verification report current
- Document lessons learned from incidents

**Last Updated**: 2025-08-11  
**Next Review**: After first production deployment