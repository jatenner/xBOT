# 🚨 POSTING SYSTEM STOPPED - DIAGNOSIS & FIXES
**Date:** November 20, 2025  
**Issue:** System hasn't posted or replied in 4-5 hours

---

## 🔍 ROOT CAUSE ANALYSIS

Based on codebase analysis, here are the most likely causes:

### **1. Plan Job Not Running (Content Generation Stopped)**
**Location:** `src/jobs/jobManager.ts:196-218`

**Symptoms:**
- No new content in `content_metadata` table
- Queue is empty
- Posting queue has nothing to post

**Possible Causes:**
- Plan job interval too long (`JOBS_PLAN_INTERVAL_MIN` > 4 hours)
- Plan job crashed and didn't restart
- Restart protection not triggering
- Planner disabled (`flags.plannerEnabled = false`)

**Check:**
```sql
-- Check last content generation
SELECT decision_id, created_at, decision_type, status 
FROM content_metadata 
WHERE decision_type IN ('single', 'thread')
ORDER BY created_at DESC 
LIMIT 5;
```

### **2. Posting Queue Blocked by Rate Limits**
**Location:** `src/jobs/postingQueue.ts:96-273`

**Symptoms:**
- Content exists in queue but not posting
- Rate limit logs showing "HOURLY LIMIT REACHED"

**Possible Causes:**
- `MAX_POSTS_PER_HOUR` limit reached (default: 2)
- `MAX_REPLIES_PER_HOUR` limit reached (default: 4)
- Rate limit check counting incorrectly

**Check:**
```sql
-- Check posts in last hour
SELECT COUNT(*) as content_posts
FROM posted_decisions
WHERE decision_type IN ('single', 'thread')
AND posted_at > NOW() - INTERVAL '1 hour';

SELECT COUNT(*) as replies
FROM posted_decisions
WHERE decision_type = 'reply'
AND posted_at > NOW() - INTERVAL '1 hour';
```

### **3. Posting Disabled Flag**
**Location:** `src/jobs/postingQueue.ts:40-43`

**Symptoms:**
- Posting queue runs but immediately returns
- Log shows: `[POSTING_QUEUE] ⚠️ Posting disabled, skipping queue processing`

**Possible Causes:**
- `POSTING_DISABLED=true` in environment
- `MODE=shadow` (shadow mode disables posting)
- `flags.postingDisabled = true`

**Check:**
- Railway environment variables: `POSTING_DISABLED`, `MODE`, `DRY_RUN`
- Logs for: `posting_disabled=true`

### **4. No Queued Content Ready**
**Location:** `src/jobs/postingQueue.ts:280-423`

**Symptoms:**
- Content exists but `scheduled_at` is in future
- Grace window (5 min) not catching ready posts
- All content has `status != 'queued'`

**Possible Causes:**
- Content scheduled too far in future
- Content stuck in `status='posting'` (timeout didn't recover)
- Content marked as `status='failed'` or `status='cancelled'`

**Check:**
```sql
-- Check queued content
SELECT decision_id, decision_type, status, scheduled_at, created_at
FROM content_metadata
WHERE status = 'queued'
ORDER BY scheduled_at ASC
LIMIT 10;

-- Check stuck posts (status='posting' >30min)
SELECT decision_id, decision_type, status, created_at
FROM content_metadata
WHERE status = 'posting'
AND created_at < NOW() - INTERVAL '30 minutes';
```

### **5. Plan Job Interval Too Long**
**Location:** `src/jobs/jobManager.ts:215`

**Current Config:** `JOBS_PLAN_INTERVAL_MIN` (default: 60 minutes)

**Issue:** If interval is >4 hours, plan job won't run frequently enough to generate content.

**Check:**
- Railway variable: `JOBS_PLAN_INTERVAL_MIN`
- Should be ≤ 120 minutes (2 hours) for reliable content generation

---

## ✅ PERMANENT FIXES

### **Fix 1: Ensure Plan Job Runs Regularly**

**Problem:** Plan job may not be running frequently enough.

**Solution:**
1. Set `JOBS_PLAN_INTERVAL_MIN=60` (every hour)
2. Ensure restart protection is working
3. Add health check to detect if plan job hasn't run

**Implementation:**
```typescript
// In jobManager.ts, ensure shouldRunPlanJobImmediately() works
// This already exists at line 1372-1408
```

**Railway Command:**
```bash
railway variables --set JOBS_PLAN_INTERVAL_MIN=60
```

### **Fix 2: Add Plan Job Health Monitor**

**Problem:** No alert if plan job stops running.

**Solution:** Add health check that runs every 30 minutes to detect if plan job hasn't run in >3 hours.

**File:** `src/jobs/jobManager.ts` (add to existing health check at line 1184)

```typescript
// Add to existing health check
const { data: lastPlanRun } = await supabase
  .from('content_metadata')
  .select('created_at')
  .in('decision_type', ['single', 'thread'])
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (lastPlanRun) {
  const hoursSince = (Date.now() - new Date(lastPlanRun.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursSince > 3) {
    console.error(`🚨 HEALTH_CHECK: Plan job hasn't generated content in ${hoursSince.toFixed(1)}h!`);
    // Auto-trigger plan job
    await planContent();
  }
}
```

### **Fix 3: Fix Stuck Posts Recovery**

**Problem:** Posts stuck in `status='posting'` block queue.

**Solution:** Add auto-recovery for stuck posts in posting queue.

**File:** `src/jobs/postingQueue.ts` (add before `getReadyDecisions()`)

```typescript
// Auto-recover stuck posts
const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
const { data: stuckPosts } = await supabase
  .from('content_metadata')
  .select('decision_id')
  .eq('status', 'posting')
  .lt('created_at', thirtyMinAgo.toISOString());

if (stuckPosts && stuckPosts.length > 0) {
  console.log(`[POSTING_QUEUE] 🔄 Recovering ${stuckPosts.length} stuck posts...`);
  for (const post of stuckPosts) {
    await supabase
      .from('content_metadata')
      .update({ status: 'queued' })
      .eq('decision_id', post.decision_id);
  }
}
```

### **Fix 4: Improve Rate Limit Detection**

**Problem:** Rate limits may be incorrectly calculated.

**Solution:** Add logging and fix rate limit check.

**File:** `src/jobs/postingQueue.ts:96-273`

Already has good logging, but ensure:
- Rate limit check uses correct time window
- Counts both `single` and `thread` as content posts
- Doesn't double-count

### **Fix 5: Ensure Posting Queue Runs Even With Empty Queue**

**Problem:** If queue is empty, system may not generate new content.

**Solution:** Plan job should run independently, but add fallback.

**Already exists:** Plan job runs on schedule regardless of queue state.

**Enhancement:** Add queue depth monitor (currently disabled at line 47).

---

## 🚀 IMMEDIATE ACTIONS

### **Step 1: Check Railway Logs**
```bash
railway logs --tail 100
```

Look for:
- `[POSTING_QUEUE]` logs
- `[UNIFIED_PLAN]` or `[PLAN_JOB]` logs
- `posting_disabled=true` warnings
- Rate limit messages

### **Step 2: Check Database State**
```sql
-- Last content generated
SELECT MAX(created_at) as last_generation
FROM content_metadata
WHERE decision_type IN ('single', 'thread');

-- Queued posts
SELECT COUNT(*) as queued_count
FROM content_metadata
WHERE status = 'queued';

-- Recent posts
SELECT COUNT(*) as recent_posts
FROM posted_decisions
WHERE posted_at > NOW() - INTERVAL '4 hours';
```

### **Step 3: Manual Trigger (If Needed)**
```bash
# Trigger plan job manually
railway run pnpm exec tsx -e "import('./dist/jobs/planJob').then(m => m.planContent())"

# Or use package.json script
railway run pnpm run job:plan
```

### **Step 4: Verify Environment Variables**
```bash
railway variables
```

Ensure:
- `POSTING_DISABLED` is not set or `false`
- `MODE=live` (not `shadow`)
- `JOBS_PLAN_INTERVAL_MIN` ≤ 120
- `DRY_RUN` is not set or `false`

---

## 📊 MONITORING RECOMMENDATIONS

### **Add Health Check Endpoint**
Create `/health/posting` endpoint that checks:
1. Last content generation time
2. Queue depth
3. Posting flags status
4. Rate limit status
5. Stuck posts count

### **Add Alerts**
- Alert if no content generated in >3 hours
- Alert if no posts in >4 hours
- Alert if queue depth >20 (backlog)
- Alert if stuck posts >5

---

## 🔧 CODE CHANGES NEEDED

1. **Add stuck post recovery** (Fix 3)
2. **Enhance health check** (Fix 2)
3. **Add monitoring endpoint** (optional)
4. **Verify rate limit logic** (Fix 4)

---

## 📝 TESTING CHECKLIST

After fixes:
- [ ] Plan job runs on schedule
- [ ] Content generated every interval
- [ ] Posting queue processes ready posts
- [ ] Rate limits work correctly
- [ ] Stuck posts auto-recover
- [ ] No false rate limit blocks

---

## 🎯 EXPECTED BEHAVIOR

**Normal Operation:**
1. Plan job runs every 60-120 minutes
2. Generates 1-2 posts per run
3. Posts scheduled 30+ minutes apart
4. Posting queue runs every 5 minutes
5. Posts content when scheduled time arrives
6. Rate limits: max 2 content/hour, 4 replies/hour

**If System Stops:**
- Health check should detect within 30 minutes
- Auto-recovery should trigger plan job
- Stuck posts should auto-recover
- Alerts should fire

