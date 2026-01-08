# 🚀 GO LIVE CHECKLIST - Production Re-enablement

**Target:** 2 posts/hour + 4 replies/hour with full persistence + metrics + learning

**Last Updated:** 2026-01-08

---

## Prerequisites

- ✅ Railway deployment is healthy (`/status` returns `ready: true`)
- ✅ Database connectivity verified (Supabase)
- ✅ Environment variables synced (use `pnpm env:pull` locally)
- ✅ Session state is valid (`pnpm whoami:live` shows `logged_in=true`)

---

## Phase A: Harvest Only (Posting + Replies Disabled)

**Goal:** Validate storage + scoring without posting

### Step 1: Set Railway Environment Variables

```bash
# Harvesting enabled (if running locally, otherwise Railway should have HARVESTING_ENABLED=false)
HARVESTING_ENABLED=true

# Posting/replies DISABLED for safety
POSTING_ENABLED=false
REPLIES_ENABLED=false

# Harvest cadence (every 15 min for production)
JOBS_HARVEST_INTERVAL_MIN=15

# Keep other jobs running (metrics, learning)
MODE=live
JOBS_AUTOSTART=true
```

### Step 2: Deploy and Monitor

```bash
# Deploy to Railway
git push origin main

# Monitor logs for harvest runs
railway logs --tail | grep -E "SEED_HARVEST|OPP_UPSERT|GUARDRAIL"
```

### Step 3: Verify Storage + Scoring

**Expected Logs:**
- `[SEED_HARVEST] ✅ @username: X/Y stored` (X > 0)
- `[OPP_UPSERT] tweet_id=... relevance=0.XX replyability=0.XX` (both > 0)
- `[SEED_HARVEST] ✅ GUARDRAIL: All N stored opportunities have relevance_score > 0` (or < 50% zero)

**Verification Commands:**

```bash
# Check opportunities were stored
railway run -- pnpm exec tsx scripts/opportunity-top.ts 60

# Verify scoring (should show relevance > 0 for most)
railway run -- pnpm exec tsx scripts/opportunity-top.ts 60 | grep -E "Relevance|relevance_score"

# Check DB directly
railway run -- pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('reply_opportunities')
  .select('target_tweet_id, relevance_score, replyability_score, selection_reason')
  .eq('selection_reason', 'harvest_v2')
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  .limit(20);
console.log('Recent opportunities:', JSON.stringify(data, null, 2));
const zeroRelevance = data?.filter(o => (o.relevance_score || 0) === 0).length || 0;
console.log(\`Zero relevance count: \${zeroRelevance}/\${data?.length || 0}\`);
"
```

**Success Criteria:**
- ✅ Opportunities stored in last 60 min > 0
- ✅ < 50% have `relevance_score=0`
- ✅ `replyability_score` > 0 for stored opportunities
- ✅ `selection_reason='harvest_v2'` for all stored rows

---

## Phase B: Replies Enabled (Posting Disabled)

**Goal:** Validate DB records + metrics without actual posting

### Step 1: Update Railway Environment Variables

```bash
# Enable replies (but NOT posting)
REPLIES_ENABLED=true
POSTING_ENABLED=false

# Set reply cadence (every 15 min = 4 replies/hour)
JOBS_REPLY_INTERVAL_MIN=15

# Use Ramp Mode Level 3 for quotas (4 replies/hr)
RAMP_MODE=true
RAMP_LEVEL=3
```

### Step 2: Deploy and Monitor

```bash
# Deploy
git push origin main

# Monitor reply generation (should create decisions but NOT post)
railway logs --tail | grep -E "REPLY_JOB|REPLY_PICK|REPLY_DRYRUN|decision_id"
```

### Step 3: Verify DB Records + Metrics

**Expected Logs:**
- `[REPLY_JOB] ✅ Generated N replies` (N <= 4 per hour)
- `[REPLY_PICK] Selected opportunity: tweet_id=...` (with relevance > 0.45)
- Decision records created in `content_generation_metadata_comprehensive` with `status='queued'`

**Verification Commands:**

```bash
# Check reply decisions were created (but not posted)
railway run -- pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('content_generation_metadata_comprehensive')
  .select('decision_id, decision_type, status, target_tweet_id, created_at')
  .eq('decision_type', 'reply')
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  .order('created_at', { ascending: false })
  .limit(10);
console.log('Recent reply decisions:', JSON.stringify(data, null, 2));
console.log('Status breakdown:', data?.reduce((acc, d) => {
  acc[d.status] = (acc[d.status] || 0) + 1;
  return acc;
}, {}));
"

# Verify no actual posts (tweet_id should be null)
railway run -- pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('content_generation_metadata_comprehensive')
  .select('decision_id, tweet_id, status')
  .eq('decision_type', 'reply')
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
const withTweetId = data?.filter(d => d.tweet_id).length || 0;
console.log(\`Reply decisions with tweet_id: \${withTweetId}/\${data?.length || 0} (should be 0 if posting disabled)\`);
"
```

**Success Criteria:**
- ✅ Reply decisions created in DB (`status='queued'`)
- ✅ No actual posts (`tweet_id` is null)
- ✅ Quota respected (≤ 4 replies/hour)
- ✅ Metrics collection still running (check `metrics_scraper` logs)

---

## Phase C: Full Production (Posting Enabled)

**Goal:** Validate no ghost posts and quotas respected

### Step 1: Update Railway Environment Variables

```bash
# Enable posting
POSTING_ENABLED=true
REPLIES_ENABLED=true

# Ramp Mode Level 3 (2 posts/hr + 4 replies/hr)
RAMP_MODE=true
RAMP_LEVEL=3

# Posting queue runs every 5 min (checks quotas internally)
JOBS_POSTING_INTERVAL_MIN=5

# Reply job runs every 15 min (4 replies/hour)
JOBS_REPLY_INTERVAL_MIN=15

# Harvest runs every 15 min
JOBS_HARVEST_INTERVAL_MIN=15
```

### Step 2: Deploy and Monitor

```bash
# Deploy
git push origin main

# Monitor posting (should respect quotas)
railway logs --tail | grep -E "POSTING_QUEUE|RAMP_MODE|posts_last_hour|replies_last_hour"
```

### Step 3: Verify No Ghost Posts + Quotas

**Expected Logs:**
- `[RAMP_MODE] ramp_enabled=true ramp_level=3 posts_last_hour=X replies_last_hour=Y` (X ≤ 2, Y ≤ 4)
- `[POSTING_QUEUE] ✅ Posted: tweet_id=...` (with DB record)
- `[POSTING_QUEUE] 🛑 Quota exceeded: posts_last_hour=2` (when limit hit)

**Verification Commands:**

```bash
# Check posts in last hour (should be ≤ 2)
railway run -- pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('content_generation_metadata_comprehensive')
  .select('decision_id, tweet_id, decision_type, created_at, actual_posted_at')
  .eq('status', 'posted')
  .gte('actual_posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  .order('actual_posted_at', { ascending: false });
console.log('Posts in last hour:', data?.length || 0);
console.log('Breakdown:', data?.reduce((acc, d) => {
  acc[d.decision_type] = (acc[d.decision_type] || 0) + 1;
  return acc;
}, {}));
data?.forEach(d => console.log(\`  \${d.decision_type}: \${d.tweet_id || 'NO_TWEET_ID'} at \${d.actual_posted_at}\`));
"

# Check replies in last hour (should be ≤ 4)
railway run -- pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('content_generation_metadata_comprehensive')
  .select('decision_id, tweet_id, decision_type, created_at, actual_posted_at')
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .gte('actual_posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  .order('actual_posted_at', { ascending: false });
console.log('Replies in last hour:', data?.length || 0);
data?.forEach(d => console.log(\`  Reply: \${d.tweet_id || 'NO_TWEET_ID'} at \${d.actual_posted_at}\`));
"

# Verify no ghost posts (all posts have DB records)
railway run -- pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=1
```

**Success Criteria:**
- ✅ Posts ≤ 2/hour (quota respected)
- ✅ Replies ≤ 4/hour (quota respected)
- ✅ All posts have DB records (`tweet_id` not null, `status='posted'`)
- ✅ No ghost posts (verify-not-in-db shows 0 missing)
- ✅ Metrics collection running (`metrics_scraper` logs show activity)
- ✅ Learning updates running (`learn` job logs show activity)

---

## Production Environment Variables (Final)

Copy-paste this block into Railway Variables:

```bash
# Core Mode
MODE=live
JOBS_AUTOSTART=true

# Harvesting (if running locally, set HARVESTING_ENABLED=false on Railway)
HARVESTING_ENABLED=false
JOBS_HARVEST_INTERVAL_MIN=15

# Posting + Replies
POSTING_ENABLED=true
REPLIES_ENABLED=true
JOBS_POSTING_INTERVAL_MIN=5
JOBS_REPLY_INTERVAL_MIN=15

# Ramp Mode (2 posts/hr + 4 replies/hr)
RAMP_MODE=true
RAMP_LEVEL=3

# Quotas (backup enforcement)
MAX_POSTS_PER_HOUR=2
REPLIES_PER_HOUR=4

# Reply Configuration
REPLY_BATCH_SIZE=2
REPLY_MINUTES_BETWEEN=15
REPLY_MAX_PER_DAY=100
REPLY_STAGGER_BASE_MIN=5
REPLY_STAGGER_INCREMENT_MIN=10

# Learning + Metrics (keep enabled)
JOBS_LEARN_INTERVAL_MIN=60
JOBS_PLAN_INTERVAL_MIN=60
```

---

## Local Verification Commands

```bash
# 1. Sync Railway env vars
pnpm env:pull

# 2. Verify session
pnpm whoami:live

# 3. Test harvest (local only)
pnpm harvest:once

# 4. Check opportunities
pnpm exec tsx scripts/opportunity-top.ts 60

# 5. Test reply selection (dry run)
OPP_LOOKBACK_MINUTES=180 pnpm reply:dry

# 6. Verify no ghost posts (if posting enabled)
pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=1
```

---

## Rollback Plan

If issues detected:

1. **Disable posting immediately:**
   ```bash
   railway variables --set "POSTING_ENABLED=false"
   railway variables --set "REPLIES_ENABLED=false"
   ```

2. **Check logs for root cause:**
   ```bash
   railway logs --tail | grep -E "ERROR|CRITICAL|GUARDRAIL"
   ```

3. **Verify DB integrity:**
   ```bash
   railway run -- pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=24
   ```

4. **Fix issues and redeploy before re-enabling**

---

## Monitoring Checklist (First 24 Hours)

- [ ] Hour 1: Check quotas respected (≤ 2 posts, ≤ 4 replies)
- [ ] Hour 2: Verify no ghost posts
- [ ] Hour 4: Check relevance_score guardrail (< 50% zero)
- [ ] Hour 6: Verify metrics collection running
- [ ] Hour 12: Check learning updates running
- [ ] Hour 24: Full system health check

---

## Success Indicators

✅ **System is healthy when:**
- Quotas respected (2 posts/hr, 4 replies/hr)
- No ghost posts (all posts have DB records)
- Relevance scoring working (< 50% zero relevance)
- Metrics collection active
- Learning updates running
- No critical errors in logs

