# ✅ IMMEDIATE FIXES APPLIED - November 20, 2025

## 🔧 Code Changes Made

### **Fix 1: Auto-Recovery for Stuck Posts**
**File:** `src/jobs/postingQueue.ts`

**What it does:**
- Automatically detects posts stuck in `status='posting'` for >30 minutes
- Resets them back to `status='queued'` so they can be retried
- Runs every time posting queue executes (every 5 minutes)

**Why it helps:**
- Prevents posts from being permanently stuck
- Recovers from timeout errors that left posts in posting state
- Ensures queue doesn't get blocked by failed posts

### **Fix 2: Enhanced Health Check**
**File:** `src/jobs/jobManager.ts`

**What it does:**
- Checks database for last content generation (more reliable than stats)
- Detects if no content generated in >3 hours
- Auto-triggers plan job if content generation stopped
- Checks for stuck posts and reports them
- Better logging of queue state

**Why it helps:**
- Catches plan job failures faster
- Auto-recovers from plan job crashes
- Provides better visibility into system state

---

## 🚀 IMMEDIATE ACTIONS YOU NEED TO TAKE

### **Step 1: Check Current System State**

Run this SQL query in your database to see what's happening:

```sql
-- Check last content generation
SELECT 
  decision_id, 
  decision_type, 
  status, 
  created_at,
  scheduled_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM content_metadata 
WHERE decision_type IN ('single', 'thread')
ORDER BY created_at DESC 
LIMIT 5;

-- Check queued posts
SELECT 
  COUNT(*) as queued_count,
  COUNT(CASE WHEN scheduled_at <= NOW() THEN 1 END) as ready_now
FROM content_metadata
WHERE status = 'queued';

-- Check stuck posts
SELECT COUNT(*) as stuck_count
FROM content_metadata
WHERE status = 'posting'
AND created_at < NOW() - INTERVAL '30 minutes';

-- Check recent posts
SELECT COUNT(*) as posts_last_4h
FROM posted_decisions
WHERE posted_at > NOW() - INTERVAL '4 hours';
```

### **Step 2: Check Railway Environment Variables**

```bash
railway variables
```

**Verify these are set correctly:**
- `POSTING_DISABLED` - Should NOT be set or should be `false`
- `MODE` - Should be `live` (not `shadow`)
- `JOBS_PLAN_INTERVAL_MIN` - Should be ≤ 120 (recommended: 60)
- `DRY_RUN` - Should NOT be set or should be `false`

### **Step 3: Check Railway Logs**

```bash
railway logs --tail 200 | grep -E "POSTING_QUEUE|PLAN_JOB|UNIFIED_PLAN|HEALTH_CHECK"
```

**Look for:**
- `[POSTING_QUEUE]` logs showing queue processing
- `[PLAN_JOB]` or `[UNIFIED_PLAN]` logs showing content generation
- `HEALTH_CHECK` logs showing system status
- Any error messages

### **Step 4: Manual Trigger (If Needed)**

If system is still not posting, manually trigger content generation:

```bash
# Option 1: Use Railway CLI
railway run pnpm run job:plan

# Option 2: Direct execution
railway run pnpm exec tsx -e "import('./dist/jobs/planJob').then(m => m.planContent())"
```

### **Step 5: Verify Fixes Are Working**

After deploying, check logs for:

1. **Stuck post recovery:**
   ```
   [POSTING_QUEUE] 🔄 Recovering X stuck posts...
   [POSTING_QUEUE] ✅ Recovered X stuck posts
   ```

2. **Health check improvements:**
   ```
   ✅ HEALTH_CHECK: Content pipeline healthy (X queued, Y ready, last gen Zh ago)
   ```

3. **Plan job auto-recovery:**
   ```
   🚨 HEALTH_CHECK: Last content generated Xh ago (>3h threshold)!
   🔧 ATTEMPTING EMERGENCY PLAN RUN...
   ```

---

## 📊 Expected Behavior After Fixes

### **Normal Operation:**
1. ✅ Plan job runs every 60-120 minutes
2. ✅ Generates 1-2 posts per run
3. ✅ Posts scheduled 30+ minutes apart
4. ✅ Posting queue runs every 5 minutes
5. ✅ Posts content when scheduled time arrives
6. ✅ Stuck posts auto-recover within 30 minutes
7. ✅ Health check detects issues within 30 minutes

### **Recovery Behavior:**
- If plan job stops → Health check triggers it within 30 minutes
- If posts get stuck → Auto-recovered every 5 minutes
- If queue is empty → Health check triggers plan job

---

## 🔍 Troubleshooting

### **If Still Not Posting:**

1. **Check if posting is disabled:**
   ```bash
   railway variables | grep POSTING
   ```
   If `POSTING_DISABLED=true`, set it to `false` or remove it.

2. **Check rate limits:**
   ```sql
   SELECT COUNT(*) 
   FROM posted_decisions 
   WHERE posted_at > NOW() - INTERVAL '1 hour'
   AND decision_type IN ('single', 'thread');
   ```
   If count >= 2, rate limit is blocking (this is normal, wait for next hour).

3. **Check for errors in logs:**
   ```bash
   railway logs --tail 500 | grep -i error
   ```

4. **Verify plan job interval:**
   ```bash
   railway variables | grep JOBS_PLAN_INTERVAL
   ```
   Should be ≤ 120 minutes.

---

## 📝 Next Steps

1. **Deploy these fixes** to Railway
2. **Monitor logs** for the next hour
3. **Check database** to verify content is being generated
4. **Verify posts** are going through

If issues persist after these fixes, the problem may be:
- Twitter authentication issues (Playwright session expired)
- Database connection problems
- Rate limits being too strict
- Plan job failing silently

---

## 🎯 Long-Term Improvements (Optional)

1. **Add monitoring dashboard** showing:
   - Last content generation time
   - Queue depth
   - Posting rate
   - Error rates

2. **Add alerts** for:
   - No content in >3 hours
   - No posts in >4 hours
   - High stuck post count

3. **Improve logging** with structured logs for easier debugging

