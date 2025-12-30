# 🚨 RAILWAY CLI DIAGNOSTIC COMMANDS

## Step 1: Login to Railway
```bash
railway login
```

## Step 2: Link to Project (if needed)
```bash
railway link
```

## Step 3: Run Diagnostic Script
```bash
railway run pnpm exec tsx scripts/railway-diagnose.ts
```

## Step 4: Check Logs
```bash
# Recent logs
railway logs --lines 200

# Filter for posting issues
railway logs --lines 500 | grep -E "\[POSTING_QUEUE\]|\[UNIFIED_PLAN\]|Circuit breaker|No queued"
```

## Step 5: Manual Fixes

### Fix #1: Trigger Plan Job (Generate Content)
```bash
railway run node -e "require('./dist/jobs/planJob').planContent()"
```

### Fix #2: Restart Service (Reset Circuit Breaker)
```bash
railway restart
```

### Fix #3: Check Environment Variables
```bash
railway variables
```

Look for:
- `POSTING_DISABLED` (should be unset or false)
- `JOBS_PLAN_INTERVAL_MIN` (should be 120)
- `MAX_POSTS_PER_HOUR` (should be 1)

---

## Alternative: Direct Database Queries (Supabase Dashboard)

### Check Queued Content
```sql
SELECT COUNT(*) as queued_count
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
  AND scheduled_at <= NOW();
```

### Check Recent Posts
```sql
SELECT 
  decision_type,
  status,
  posted_at,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(posted_at, created_at))) / 3600 as hours_ago
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Stuck Posts
```sql
SELECT 
  decision_id,
  decision_type,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_stuck
FROM content_metadata
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

### Check Plan Job
```sql
SELECT 
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM job_heartbeats
WHERE job_name = 'plan'
ORDER BY created_at DESC
LIMIT 1;
```

### Recover Stuck Posts
```sql
UPDATE content_metadata
SET status = 'queued'
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '1 hour';
```

---

## Quick Fix Script (Run on Railway)

```bash
railway run node -e "
const { getSupabaseClient } = require('./dist/db/index');
(async () => {
  const supabase = getSupabaseClient();
  
  // Recover stuck posts
  const { data: stuck } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'posting')
    .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
  
  if (stuck?.length) {
    await supabase
      .from('content_metadata')
      .update({ status: 'queued' })
      .in('decision_id', stuck.map(s => s.decision_id));
    console.log('Recovered', stuck.length, 'stuck posts');
  }
  
  // Check queue
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', new Date().toISOString());
  
  console.log('Queued content:', queued?.length || 0);
})();
"
```

---

## Expected Results

**Normal:**
- Queued content: 1-5 posts
- Last post: < 2 hours ago
- Plan job: < 3 hours ago
- Stuck posts: 0

**Problem:**
- Queued content: 0
- Last post: > 10 hours ago
- Plan job: > 3 hours ago
- Stuck posts: > 0

---

**Run these commands in order to diagnose and fix the issue.**



