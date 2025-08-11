# xBOT Learning Engine V2 Runbook

**Version**: 2.0.0  
**Last Updated**: 2025-08-11  
**Environment**: Staging & Production

## Quick Reference

### Health Check
```bash
npm run health:check
```

### Staging Dry-Run
```bash
# Set environment
export APP_ENV=staging
export LIVE_POSTS=false
export REDIS_PREFIX=stg:

# Generate candidates
npm run candidates:refresh

# Test scheduling
npm run schedule:test

# Test learning loop
npm run learning:test
```

### Promote to Production
```bash
# 1. Apply migrations to production
supabase link --project-ref "$PROD_PROJECT_REF"
supabase db push

# 2. Set production config (via Supabase dashboard or SQL)
# learning_engine_v2: false (start in shadow mode)
# post_fraction: 0 (no actual posting)
# epsilon: 0.2 (exploration rate)

# 3. Deploy code to Railway
git push origin main

# 4. Monitor health
npm run health:check
```

## Configuration Flags

### Core Flags (in bot_config table)

| Flag | Default | Purpose | Values |
|------|---------|---------|---------|
| `learning_engine_v2` | `false` | Enable V2 learning system | `true/false` |
| `post_fraction` | `0` | Fraction of candidates to actually post | `0.0-1.0` |
| `epsilon` | `0.2` | Exploration rate for bandits | `0.0-1.0` |
| `post_interval_min` | `60` | Minimum minutes between posts | `15-180` |
| `max_hashtags` | `3` | Maximum hashtags per post | `1-5` |
| `quiet_hours` | `[2,3,4,5]` | Hours to avoid posting (local time) | Array of hours |

### Environment Variables

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `APP_ENV` | Yes | Environment identifier | `staging`, `production` |
| `LIVE_POSTS` | Yes | Enable actual posting | `true`, `false` |
| `REDIS_PREFIX` | Yes | Redis key namespace | `stg:`, `prod:` |
| `REDIS_URL` | Yes | Redis connection string | `rediss://...` |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service key | `eyJ...` |

## Staging Operations

### 1. Environment Setup
```bash
# Copy template and configure
cp .env.template .env

# Required variables for staging:
APP_ENV=staging
LIVE_POSTS=false
REDIS_PREFIX=stg:
STAGING_PROJECT_REF=your_staging_ref
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_staging_service_key
REDIS_URL=your_redis_url
```

### 2. Migration Testing
```bash
# Link to staging project
supabase link --project-ref "$STAGING_PROJECT_REF"

# Apply migrations
supabase db push

# Verify views created
psql "$SUPABASE_URL" -c "SELECT COUNT(*) FROM information_schema.views WHERE table_name LIKE 'vw_%'"
```

### 3. Candidate Generation
```bash
# Generate fresh candidates
npm run candidates:refresh

# Expected output:
# - 20-40 candidates generated from gaming sources
# - 0 duplicates (first run)
# - Queue depth: 20-40
# - Top topics: gaming_fps, gaming_battle_royale, etc.
```

### 4. Shadow Mode Testing
```bash
# Run single scheduling cycle
npm run schedule:test

# Expected behavior:
# - Picks top candidate from queue
# - Runs safety checks
# - Logs "SHADOW MODE - Would post: ..."
# - No actual posting (LIVE_POSTS=false)
```

### 5. Learning Loop Testing
```bash
# Test learning system (needs historical data)
npm run learning:test

# Expected output:
# - Processes recent tweets (last 24h)
# - Updates bandit priors
# - Logs learning summary to audit_log
```

### 6. Health Monitoring
```bash
# Check all systems
npm run health:check

# Expected one-line output:
# [timestamp] xBOT Health: HEALTHY | Redis:✅ | DB:✅ | Queue:25 | Bandits:12 | LastPost:none | Posts/h:0
```

## Production Deployment

### Phase 1: Shadow Mode
```bash
# 1. Deploy code with V2 disabled
# learning_engine_v2: false
# post_fraction: 0

# 2. Monitor existing V1 system continues
npm run health:check

# 3. Generate candidates in background
npm run candidates:refresh
```

### Phase 2: Learning Mode
```bash
# 1. Enable learning without posting
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{learning_engine_v2}', 'true')
WHERE environment = 'production' AND config_key = 'feature_flags';

# 2. Monitor bandit updates
npm run learning:test

# 3. Check performance
SELECT * FROM vw_learning_performance ORDER BY day DESC LIMIT 7;
```

### Phase 3: Gradual Rollout
```bash
# 1. Start with 10% posting
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{post_fraction}', '0.1')
WHERE environment = 'production' AND config_key = 'learning_config';

# 2. Monitor for 24-48 hours
npm run health:check

# 3. Increase gradually: 0.1 → 0.3 → 0.7 → 1.0
```

### Phase 4: Full V2 Operation
```bash
# 1. Set full posting fraction
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{post_fraction}', '1.0')
WHERE environment = 'production' AND config_key = 'learning_config';

# 2. Monitor engagement metrics
SELECT * FROM vw_topics_perf_7d ORDER BY avg_engagement_rate DESC;
```

## Monitoring & Analytics

### Key SQL Views
```sql
-- Recent posts with V2 scores
SELECT * FROM vw_recent_posts ORDER BY posted_at DESC LIMIT 10;

-- Topic performance last 7 days
SELECT * FROM vw_topics_perf_7d ORDER BY avg_engagement_rate DESC;

-- Best posting hours
SELECT * FROM vw_time_of_day_perf_7d ORDER BY avg_engagement_rate DESC;

-- Learning system performance
SELECT * FROM vw_learning_performance ORDER BY day DESC LIMIT 7;

-- Bandit performance from audit logs
SELECT * FROM vw_bandit_performance ORDER BY day DESC LIMIT 7;
```

### Redis Monitoring
```bash
# Check queue depths
redis-cli --scan --pattern "stg:queue:*" | xargs redis-cli mget

# Check bandit states
redis-cli --scan --pattern "stg:bandit:*" | head -10

# Check content hashes (deduplication)
redis-cli --scan --pattern "stg:content_hash:*" | wc -l
```

### Performance Tuning

#### If Engagement Drops >30%
```bash
# 1. Increase exploration
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{epsilon}', '0.3')
WHERE environment = 'production' AND config_key = 'learning_config';

# 2. Widen topic diversity for 24-48h
# Add more gaming topics to allowlist

# 3. Monitor bandit convergence
SELECT * FROM vw_bandit_performance WHERE day > NOW() - INTERVAL '3 days';
```

#### If Queue Empties Frequently
```bash
# 1. Increase candidate generation frequency
# Run candidates:refresh more often

# 2. Expand content sources
# Enable more topics in sources configuration

# 3. Check source performance
SELECT * FROM vw_content_sources_perf ORDER BY success_rate DESC;
```

## Troubleshooting

### Common Issues

#### "Queue is empty"
```bash
# Check candidate generation
npm run candidates:refresh

# Check source configuration
node -e "const {ContentSourceManager} = require('./dist/candidates/sources'); console.log(new ContentSourceManager().getSourceStats())"
```

#### "Redis not responding"
```bash
# Check Redis connectivity
redis-cli ping

# Check Redis prefix
echo $REDIS_PREFIX

# Verify key patterns
redis-cli --scan --pattern "${REDIS_PREFIX}*" | head -5
```

#### "Safety check failed"
```bash
# Check safety configuration
node -e "const {ContentSafetyGuard} = require('./dist/safety/guard'); console.log(new ContentSafetyGuard().getConfig())"

# Test specific content
node -e "const {ContentSafetyGuard} = require('./dist/safety/guard'); const guard = new ContentSafetyGuard(); console.log(guard.validate({text: 'Your test content here'}))"
```

#### "Learning cycle errors"
```bash
# Check database connectivity
npm run health:check

# Verify analytics data exists
SELECT COUNT(*) FROM tweets WHERE analytics IS NOT NULL AND analytics != '{}';

# Check bandit system
node -e "const {GamingBanditManager} = require('./dist/learn/bandit'); new GamingBanditManager().getPerformanceReport().then(console.log)"
```

### Emergency Procedures

#### Disable V2 System
```sql
-- Immediate rollback to V1
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{learning_engine_v2}', 'false')
WHERE environment = 'production' AND config_key = 'feature_flags';
```

#### Stop All Posting
```sql
-- Emergency brake
UPDATE bot_config 
SET config_value = jsonb_set(config_value, '{post_fraction}', '0')
WHERE environment = 'production' AND config_key = 'learning_config';
```

#### Clear Queue
```bash
# Clear candidate queue
redis-cli del "${REDIS_PREFIX}queue:candidates"

# Clear content hashes
redis-cli --scan --pattern "${REDIS_PREFIX}content_hash:*" | xargs redis-cli del
```

## Required GitHub Secrets

For CI/CD pipelines to work, ensure these secrets are configured:

### Repository Secrets
- `STAGING_PROJECT_REF`: Supabase staging project reference
- `PROD_PROJECT_REF`: Supabase production project reference
- `STAGING_DB_PASSWORD`: Staging database password for psql
- `PROD_DB_PASSWORD`: Production database password for psql
- `SUPABASE_ACCESS_TOKEN`: Supabase CLI access token

### Environment-Specific Secrets

#### Staging Environment
- `STAGING_SUPABASE_URL`: Staging Supabase project URL
- `STAGING_SUPABASE_KEY`: Staging service role key

#### Production Environment (Protected)
- `PROD_SUPABASE_URL`: Production Supabase project URL
- `PROD_SUPABASE_KEY`: Production service role key

## Daily Operations Checklist

### Morning (9 AM)
- [ ] Check health status: `npm run health:check`
- [ ] Review overnight performance: Query `vw_recent_posts`
- [ ] Verify queue depth: Should be 20-50 candidates
- [ ] Check bandit learning: Query `vw_bandit_performance`

### Evening (6 PM)
- [ ] Refresh candidates: `npm run candidates:refresh`
- [ ] Review engagement metrics: Query `vw_topics_perf_7d`
- [ ] Adjust epsilon if needed (weekly tuning)
- [ ] Monitor for any alerts or warnings

### Weekly (Monday)
- [ ] Review 7-day performance trends
- [ ] Tune exploration rate based on performance
- [ ] Update content source weights if needed
- [ ] Plan any configuration adjustments
- [ ] Review and clean old Redis keys

This runbook ensures reliable operation of the xBOT Learning Engine V2 system with proper monitoring, troubleshooting, and operational procedures.