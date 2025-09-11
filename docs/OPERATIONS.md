# xBOT Operations Runbook

## Overview
This runbook covers monitoring, troubleshooting, and maintenance of the xBOT production system on Railway.

## Deployment Health Check

After each deployment, verify these success patterns in Railway logs:

```bash
railway logs | grep -E "(DB_MIGRATE|MIGRATIONS|DB_HEALTH|CHROMIUM|BUDGET)"
```

### Expected Success Logs

✅ **Database Migration**
```
✅ DB_MIGRATE: Connected successfully with SSL
✅ MIGRATIONS: completed successfully (api_usage + RLS)
✅ DB_HEALTH: Service role insert test successful
```

✅ **Browser Setup**
```
✅ CHROMIUM: Browser launched successfully
```

✅ **Budget System**
```
✅ BUDGET_RESERVED: $0.0050 (Total: $0.0050/$5.0000)
```

### Failure Patterns to Watch For

❌ **Migration Issues**
```
❌ DB_MIGRATE_ERROR: [error message]
❌ DB_HEALTH: Service role test failed
```

❌ **Browser Issues**
```
❌ CHROMIUM: browserType.launch failed: [error]
Executable doesn't exist at [path]
```

❌ **Budget Issues**
```
❌ BUDGET_EXCEEDED: Would exceed daily limit
❌ USAGE_LOG_FAIL: [error details]
```

## Environment Variables Required

### Database Configuration
- `DATABASE_URL` - Supabase connection string (primary, not pooler)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for bypassing RLS
- `MIGRATION_SSL_MODE=require` - Enable SSL for migrations
- `MIGRATION_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt` - SSL cert path

### Redis Configuration
- `REDIS_URL` - Redis connection string
- `REDIS_TLS=true` - Enable TLS for Redis (if required)

### OpenAI Configuration
- `OPENAI_API_KEY` - OpenAI API key
- `DAILY_OPENAI_LIMIT_USD=5` - Daily spending limit (default: $5)

### Feature Flags
- `POSTING_DISABLED=true` - Keep posting disabled by default
- `REAL_METRICS_ENABLED=true` - Enable browser-based metrics collection

## How to Check Migrations Ran

### 1. Check Migration Logs
```bash
railway logs | grep -E "(DB_MIGRATE|MIGRATIONS)" | tail -10
```

### 2. Verify api_usage Table Exists
Connect to Supabase and run:
```sql
SELECT COUNT(*) FROM api_usage;
SELECT * FROM api_usage WHERE intent = 'bootstrap' LIMIT 1;
```

### 3. Check RLS Policy
```sql
SELECT policyname, tablename FROM pg_policies 
WHERE tablename = 'api_usage' AND policyname = 'api_usage_all';
```

## Budget and Health Monitoring

### Check Current Budget Usage
```bash
railway logs | grep "BUDGET_RESERVED\|BUDGET_EXCEEDED" | tail -20
```

### Monitor API Usage Logging
```bash
railway logs | grep "API_USAGE_LOG\|USAGE_LOG" | tail -10
```

### Browser Health Check
```bash
railway logs | grep "CHROMIUM\|PLAYWRIGHT" | tail -10
```

## Troubleshooting

### Migration Failures

**SSL Certificate Issues:**
- Check if `MIGRATION_SSL_ROOT_CERT_PATH` points to valid cert
- Fallback: Set `MIGRATION_SSL_MODE=disable` temporarily
- Manual fix: Run migration SQL directly in Supabase SQL Editor

**Connection Issues:**
- Verify `DATABASE_URL` is the primary connection (not pooler)
- Check Supabase project is not paused
- Verify service role key has proper permissions

### Browser Launch Failures

**Common Fixes:**
- Check `REAL_METRICS_ENABLED=true` in environment
- Verify Playwright installed correctly in Docker build
- Browser will auto-retry up to 2 times with backoff

### Budget System Issues

**Budget Gate Failures:**
- Check Redis connection: `railway logs | grep REDIS`
- Verify budget calculations: look for arithmetic errors
- Manual reset: Clear Redis key `budget:[YYYY-MM-DD]`

## Manual Recovery Procedures

### 1. Manual Database Migration
If automatic migration fails, run this SQL in Supabase SQL Editor:

```sql
-- Create api_usage table
create table if not exists api_usage (
  id               bigserial primary key,
  intent           text not null,
  model            text not null,
  prompt_tokens    integer default 0 not null,
  completion_tokens integer default 0 not null,
  cost_usd         numeric(12,6) default 0 not null,
  meta             jsonb default '{}'::jsonb not null,
  created_at       timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_api_usage_created_at on api_usage(created_at desc);
create index if not exists idx_api_usage_intent on api_usage(intent);
create index if not exists idx_api_usage_model on api_usage(model);

-- Enable RLS
alter table api_usage enable row level security;

-- Create permissive policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'api_usage' and policyname = 'api_usage_all'
  ) then
    create policy api_usage_all on api_usage for all using (true) with check (true);
  end if;
end$$;
```

### 2. Reset Daily Budget
```bash
# Connect to Redis and delete today's budget key
redis-cli DEL "budget:$(date +%Y-%m-%d)"
```

### 3. Force Browser Reinstall
Redeploy with cleared cache or manually run:
```bash
npx playwright install --with-deps chromium
```

## Log Analysis Commands

### Monitor Real-time Activity
```bash
railway logs --follow | grep -E "(POST_|BUDGET_|DB_|CHROMIUM)"
```

### Check Last 24 Hours Error Rate
```bash
railway logs | grep -E "(ERROR|FAILED|❌)" | wc -l
```

### Analyze API Usage Patterns
```bash
railway logs | grep "BUDGET_RESERVED" | tail -50
```

### Find Performance Issues
```bash
railway logs | grep -E "(SLOW|TIMEOUT|RETRY)" | tail -20
```

## Alert Thresholds

Set up monitoring for these patterns:

- **Critical:** `❌ DB_MIGRATE_ERROR` (migration system down)
- **Critical:** `❌ BUDGET_EXCEEDED` (spending control failed)
- **Warning:** `⚠️ API_USAGE_LOG_FAILED` (logging issues)
- **Warning:** `❌ CHROMIUM.*failed` (metrics collection down)
- **Info:** `BUDGET_RESERVED` (normal spending activity)

## Contact Information

For issues beyond this runbook:
- Check GitHub Issues: [repository URL]
- Review Railway deployment logs
- Verify Supabase project status
- Check OpenAI API status page
