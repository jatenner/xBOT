# Database Pipeline Operations Runbook

## 🚀 Quick Start

### Daily Operations
```bash
# Check application health
npm run health-check

# Run local migration test
npm run db:shadow

# Test startup guards
node scripts/test-startup-guards.js
```

### Emergency Procedures
```bash
# Stop posting immediately
export EMERGENCY_MODE=true

# Check database connectivity
scripts/remote-verify.sh

# Monitor Redis health
npm run redis-health
```

## 📋 Staging Verification Procedures

### Local Verification
```bash
# 1. Set environment variables
export STAGING_PROJECT_REF="uokidynvzfkxwvxlpnfu"
export APP_SCHEMA_VERSION="1.0.0"
export REDIS_PREFIX="stg:"

# 2. Run shadow test
npm run db:shadow

# 3. Test schema guard
node scripts/test-startup-guards.js
```

### Remote Staging Verification
```bash
# Set database URL
export STAGING_DB_URL="postgresql://postgres:PASSWORD@db.uokidynvzfkxwvxlpnfu.supabase.co:5432/postgres"

# Run verification
DB_URL="$STAGING_DB_URL" ./scripts/remote-verify.sh
```

### Manual Smoke Test
```bash
# Connect to staging database
PGPASSWORD='STAGING_PASSWORD' psql \
  -h db.uokidynvzfkxwvxlpnfu.supabase.co \
  -p 5432 -U postgres -d postgres \
  -f supabase/smoke.sql
```

## 🔄 Migration Workflow

### Development Process
1. **Create Migration**
   ```bash
   # Create new migration file
   supabase migration new your_migration_name
   
   # Edit migration in supabase/migrations/
   ```

2. **Local Testing**
   ```bash
   # Test migration locally
   npm run db:shadow
   
   # Verify no breaking changes
   npm run db:verify
   ```

3. **Create Pull Request**
   ```bash
   git checkout -b feature/your-migration
   git add supabase/migrations/
   git commit -m "feat: add your migration"
   git push origin feature/your-migration
   ```

4. **PR Verification**
   - GitHub Actions automatically runs staging verification
   - Review PR checks and address any failures
   - Merge only after all checks pass

### Production Deployment
1. **Prepare for Production**
   - Ensure staging verification passed
   - Review migration for production impact
   - Schedule deployment window if needed

2. **Deploy to Production**
   - Go to GitHub Actions
   - Select "Promote to Production" workflow
   - Click "Run workflow"
   - Type: `CONFIRM PRODUCTION DEPLOYMENT`
   - Wait for manual approval (if configured)
   - Monitor deployment progress

3. **Post-Deployment**
   - Verify application functionality
   - Check error logs
   - Monitor performance metrics
   - Confirm schema guard passes

## 🛡️ Schema Guard Operations

### Understanding Schema Guard
The schema guard prevents application startup when database schema doesn't match the expected version.

### Configuration
```bash
# Required environment variables
APP_SCHEMA_VERSION=1.0.0    # Expected schema version
APP_ENV=staging             # Environment (staging/production)
```

### Schema Version Management
```sql
-- Check current schema version
SELECT config_value FROM bot_config 
WHERE config_key = 'schema_version' 
AND environment = 'production';

-- Update schema version (during migration)
UPDATE bot_config 
SET config_value = jsonb_build_object(
  'version', '1.1.0',
  'migration', '002_new_features',
  'timestamp', NOW()::TEXT
)
WHERE config_key = 'schema_version' 
AND environment = 'production';
```

### Troubleshooting Schema Guard
```bash
# Test schema compatibility
node scripts/test-startup-guards.js

# Bypass schema guard (emergency only)
export SKIP_SCHEMA_GUARD=true

# Check database connection
scripts/remote-verify.sh
```

## 🔴 Redis Health Management

### Redis Configuration
```bash
# Environment variables
REDIS_URL=redis://...           # Connection URL
REDIS_PREFIX=stg:              # Namespace prefix (stg: or prod:)
```

### Health Monitoring
```bash
# Check Redis health
node -e "
const { checkRedisHealth } = require('./src/utils/redisHealth');
checkRedisHealth().then(console.log);
"

# Test Redis connectivity
redis-cli -u "$REDIS_URL" PING

# Monitor Redis keys with prefix
redis-cli -u "$REDIS_URL" KEYS "stg:*"
```

### Redis Troubleshooting
```bash
# Test basic connectivity
redis-cli -u "$REDIS_URL" PING

# Check memory usage
redis-cli -u "$REDIS_URL" INFO memory

# Clear namespace (if needed)
redis-cli -u "$REDIS_URL" EVAL "
  for _,k in ipairs(redis.call('keys', ARGV[1])) do 
    redis.call('del', k) 
  end
" 0 "stg:*"

# Application fallback mode
export USE_REDIS=false
```

## 🚨 Emergency Procedures

### Database Connection Issues
1. **Check Network Connectivity**
   ```bash
   # Test DNS resolution
   nslookup db.uokidynvzfkxwvxlpnfu.supabase.co
   
   # Test port connectivity
   telnet db.uokidynvzfkxwvxlpnfu.supabase.co 5432
   ```

2. **Fallback to Local Development**
   ```bash
   # Start local Supabase
   supabase start
   
   # Update connection in .env
   SUPABASE_URL=http://localhost:54321
   ```

### Schema Mismatch Emergency
1. **Identify the Issue**
   ```bash
   # Check app vs database version
   echo "App version: $APP_SCHEMA_VERSION"
   
   # Check database version
   PGPASSWORD='PASSWORD' psql -h HOST -U postgres -d postgres \
     -c "SELECT config_value FROM bot_config WHERE config_key = 'schema_version';"
   ```

2. **Emergency Bypass** (Use Sparingly)
   ```bash
   # Temporarily skip schema guard
   export SKIP_SCHEMA_GUARD=true
   
   # Or update app version to match database
   export APP_SCHEMA_VERSION="database_version_here"
   ```

3. **Permanent Fix**
   - Apply missing migrations to database, OR
   - Deploy correct application version

### Redis Failure Recovery
1. **Application Continues Without Redis**
   - Schema guard still works (uses Supabase)
   - Performance may be reduced
   - All core functionality available

2. **Monitor Application Health**
   ```bash
   # Check if app is using fallback mode
   curl http://localhost:3000/health
   
   # Monitor logs for Redis warnings
   tail -f logs/application.log | grep -i redis
   ```

## 📊 Monitoring & Alerts

### Key Metrics to Monitor
- **Schema Guard**: Startup failures due to version mismatch
- **Redis Health**: Connection failures, high latency
- **Migration Success**: PR pipeline failures
- **Database Performance**: Query times, connection count

### Alert Conditions
- Schema guard preventing application startup
- Redis connection failures (> 30 seconds)
- Migration pipeline failures
- Database connection timeouts

### Logging Strategy
```bash
# Application logs
tail -f logs/app.log

# Database logs (if accessible)
# Redis logs (if accessible)

# GitHub Actions logs
# View in GitHub repository → Actions tab
```

## 🔧 Maintenance Tasks

### Weekly Tasks
- [ ] Review migration pipeline success rate
- [ ] Check Redis memory usage and cleanup
- [ ] Verify schema versions across environments
- [ ] Review database performance metrics

### Monthly Tasks
- [ ] Update Supabase CLI version
- [ ] Review and archive old migrations
- [ ] Test emergency procedures
- [ ] Update runbook documentation

### Quarterly Tasks
- [ ] Full disaster recovery test
- [ ] Review and update secret rotation
- [ ] Performance optimization review
- [ ] Security audit of pipeline

---

**Last Updated**: 2025-08-11  
**Next Review**: After first production deployment  
**On-Call Contact**: Development Team