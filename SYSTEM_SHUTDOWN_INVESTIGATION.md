# 🔍 SYSTEM SHUTDOWN INVESTIGATION - Detailed Analysis

**Date:** December 22, 2025  
**Issue:** System randomly shuts down and doesn't post or reply  
**Status:** Multiple blocking conditions identified

---

## 📊 EXECUTIVE SUMMARY

Your system has **8 major blocking conditions** that can cause it to stop posting/replying:

1. **Rate Limiting Blocks** (Most Common)
2. **NULL Tweet ID Recovery Block** (Critical)
3. **Browser Semaphore Deadlocks** (Resource Contention)
4. **Browser Health Gate Blocks** (Degraded State)
5. **Configuration Flags** (Environment Variables)
6. **Queue Blocking** (Stuck Posts)
7. **Content Generation Failures** (LLM Issues)
8. **Memory/Resource Exhaustion** (System Limits)

---

## 🚨 BLOCKING CONDITION #1: Rate Limiting (MOST COMMON)

### **Location:** `src/jobs/postingQueue.ts:232-299`

### **What Happens:**
- System checks hourly posting limits BEFORE each post
- If limit reached, **entire posting queue stops**
- Blocks both content posts AND replies

### **Blocking Code:**
```typescript
// Line 262: CRITICAL BLOCK
if (pendingIdPosts && pendingIdPosts.length > 0) {
  console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Found post with NULL tweet_id!`);
  return false;  // BLOCK posting until ID is recovered!
}

// Line 285: Rate limit block
if (postsThisHour >= maxPostsPerHour) {
  console.log(`[POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED`);
  return false;  // Blocks ALL posting
}
```

### **Symptoms:**
- Logs show: `⛔ HOURLY LIMIT REACHED: X/1`
- Logs show: `🚨 CRITICAL: Found post with NULL tweet_id!`
- Queue runs but processes 0 posts
- System appears "stuck" but is actually rate-limited

### **Recovery:**
- Wait for hourly window to reset
- Background job recovers NULL tweet IDs (runs every 30min)
- System auto-recovers after ID recovery

---

## 🚨 BLOCKING CONDITION #2: NULL Tweet ID Recovery Block (CRITICAL)

### **Location:** `src/jobs/postingQueue.ts:241-263`

### **What Happens:**
- System detects posts with `tweet_id = NULL` in last hour
- **BLOCKS ALL POSTING** until ID is recovered
- This is a safety measure to prevent duplicate posts

### **Blocking Code:**
```typescript
// Line 241-263: Safety block
const { data: pendingIdPosts } = await supabase
  .from('content_metadata')
  .select('decision_id, content, posted_at')
  .in('decision_type', ['single', 'thread'])
  .eq('status', 'posted')
  .is('tweet_id', null)  // Find posts missing IDs
  .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

if (pendingIdPosts && pendingIdPosts.length > 0) {
  console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Found post with NULL tweet_id!`);
  console.error(`[POSTING_QUEUE] 🚫 This breaks rate limiting (can't count it)`);
  console.error(`[POSTING_QUEUE] 🚫 This breaks metrics scraping (can't collect data)`);
  return false;  // BLOCK posting until ID is recovered!
}
```

### **Symptoms:**
- Logs show: `🚨 CRITICAL: Found post with NULL tweet_id!`
- Logs show: `🚫 This breaks rate limiting (can't count it)`
- Posting completely stops
- Background recovery job should fix this (runs every 30min)

### **Recovery:**
- Background job `tweet_id_recovery` runs every 30 minutes
- Manually trigger: Check `src/jobs/tweetIdRecoveryJob.ts`
- Once ID recovered, posting resumes automatically

---

## 🚨 BLOCKING CONDITION #3: Browser Semaphore Deadlocks

### **Location:** `src/browser/BrowserSemaphore.ts`

### **What Happens:**
- Only **1 browser operation** can run at a time
- If browser operation hangs (timeout, crash), semaphore locks
- All other browser jobs wait indefinitely
- Default timeout: **180 seconds (3 minutes)**

### **Blocking Code:**
```typescript
// Line 128: Timeout protection
const BROWSER_OP_TIMEOUT = Number(process.env.BROWSER_LOCK_TIMEOUT_MS ?? 180000);

// Line 130-135: Timeout handler
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    console.error(`[BROWSER_SEM] ⏱️ TIMEOUT: ${jobName} exceeded ${BROWSER_OP_TIMEOUT/1000}s`);
    reject(new Error(`Browser operation timeout after ${BROWSER_OP_TIMEOUT/1000}s`));
  }, BROWSER_OP_TIMEOUT);
});
```

### **Symptoms:**
- Logs show: `⏳ [jobName] waiting (priority X, queue: Y)`
- Logs show: `⏱️ TIMEOUT: [jobName] exceeded 180s`
- Multiple jobs stuck in queue
- Browser pool appears "frozen"

### **Recovery:**
- Timeout auto-releases lock after 180s
- If persistent, check browser pool health
- Restart service if browser pool corrupted

---

## 🚨 BLOCKING CONDITION #4: Browser Health Gate

### **Location:** `src/browser/BrowserHealthGate.ts`

### **What Happens:**
- Low-priority jobs check browser health before running
- If browser is "degraded", jobs skip execution
- Affects: `metrics_scraper`, `reply_metrics_scraper`, `mega_viral_harvester`

### **Blocking Code:**
```typescript
// Line 38-41: Health check
export async function shouldRunLowPriority(): Promise<boolean> {
  const status = await getBrowserHealth();
  return status === 'healthy';  // Returns false if degraded
}

// Used in jobManager.ts:473-477
if (!(await shouldRunLowPriority())) {
  await recordJobSkip('mega_viral_harvester', 'browser_degraded');
  return;  // Skip job execution
}
```

### **Symptoms:**
- Logs show: `[JOB_NAME] Skipped: browser_degraded`
- Metrics scraping stops
- Reply harvesting stops
- Browser health probe fails (timeout >1.5s)

### **Recovery:**
- Browser health auto-recovers when pool stabilizes
- Check browser pool for memory leaks
- Restart service if persistent

---

## 🚨 BLOCKING CONDITION #5: Configuration Flags

### **Location:** `src/config/featureFlags.ts`, `src/config/envFlags.ts`

### **What Happens:**
- Environment variables can disable entire systems
- Flags checked at startup and during execution
- If flags change, system may not detect until restart

### **Blocking Flags:**
```typescript
// POSTING_DISABLED: Blocks all posting
if (flags.postingDisabled) {
  log({ op: 'posting_queue', status: 'disabled' });
  return;  // Exit immediately
}

// ENABLE_REPLIES: Blocks reply system
if (!repliesEnabled) {
  console.warn('⚠️ Reply system is DISABLED');
  // All reply jobs skipped
}

// LIVE_POSTS: Legacy flag (may still be checked)
if (!flags.LIVE_POSTS) {
  return { allowed: false, reason: 'LIVE_POSTS=false' };
}
```

### **Symptoms:**
- Logs show: `⚠️ Posting disabled, skipping queue processing`
- Logs show: `⚠️ Reply system is DISABLED`
- System runs but does nothing
- No errors, just silent skipping

### **Recovery:**
- Check Railway environment variables
- Verify: `POSTING_DISABLED=false`, `ENABLE_REPLIES=true`
- Restart service after flag changes

---

## 🚨 BLOCKING CONDITION #6: Queue Blocking (Stuck Posts)

### **Location:** `src/jobs/postingQueue.ts:45-66`

### **What Happens:**
- Posts stuck in `status='posting'` >30 minutes block queue
- System auto-recovers these, but if recovery fails, queue stalls
- Stale items (>2h singles, >6h threads) can accumulate

### **Blocking Code:**
```typescript
// Line 45-66: Auto-recovery for stuck posts
const { data: stuckPosts } = await supabase
  .from('content_metadata')
  .select('decision_id, decision_type, created_at')
  .eq('status', 'posting')
  .lt('created_at', thirtyMinAgo.toISOString());

if (stuckPosts && stuckPosts.length > 0) {
  // Auto-recover by resetting to 'queued'
  // But if this fails, posts remain stuck
}
```

### **Symptoms:**
- Logs show: `🔄 Recovering X stuck posts (status='posting' >30min)`
- Posts remain in 'posting' status
- Queue processes but posts never complete
- Database shows posts stuck for hours

### **Recovery:**
- Auto-recovery runs every 5 minutes (posting queue cycle)
- Manual fix: Update stuck posts to 'queued' status
- Check for database connection issues

---

## 🚨 BLOCKING CONDITION #7: Content Generation Failures

### **Location:** `src/jobs/planJob.ts`

### **What Happens:**
- LLM budget exceeded → No content generated
- OpenAI quota issues → Generation fails
- Content validation fails → Posts rejected
- Gate chain blocks → Content never queued

### **Blocking Code:**
```typescript
// Line 73-77: LLM check
const llmCheck = isLLMAllowed();
if (!llmCheck.allowed) {
  log({ op: 'generate_real', blocked: true, reason: llmCheck.reason });
  return;  // Exit without generating
}

// Line 126-139: Substance validation
if (!substanceCheck.isValid) {
  console.log(`[SUBSTANCE] ⛔ Post REJECTED: ${substanceCheck.reason}`);
  // Retries, but if all fail, no content queued
}
```

### **Symptoms:**
- Logs show: `⚠️ No queued content found in database at all`
- Logs show: `[PLAN_JOB] ❌ LLM generation failed`
- Logs show: `[SUBSTANCE] ⛔ Post REJECTED`
- Queue empty despite plan job running

### **Recovery:**
- Check OpenAI budget/quota
- Check `DAILY_OPENAI_LIMIT_USD` setting
- Review content quality thresholds
- Check gate chain configuration

---

## 🚨 BLOCKING CONDITION #8: Memory/Resource Exhaustion

### **Location:** `src/jobs/jobManager.ts:1113-1144`

### **What Happens:**
- Memory critical → Jobs skipped
- Browser pool corrupted → All browser jobs fail
- Resource exhaustion → System unstable

### **Blocking Code:**
```typescript
// Line 1117-1137: Memory check
if (memory.status === 'critical') {
  console.error(`🧠 Memory critical (${memory.rssMB}MB) - performing emergency cleanup`);
  
  // After cleanup, if still critical:
  if (afterCleanup.status === 'critical') {
    // Non-critical jobs skipped
    if (jobName !== 'plan' && jobName !== 'posting') {
      console.error(`🧠 Memory still critical - skipping job`);
      await recordJobSkip(jobName, `memory_critical_${afterCleanup.rssMB}mb`);
      return;  // Skip job
    }
  }
}
```

### **Symptoms:**
- Logs show: `🧠 Memory critical (XXXMB)`
- Logs show: `🧠 Memory still critical - skipping job`
- Jobs randomly skip execution
- System becomes unstable

### **Recovery:**
- Emergency cleanup runs automatically
- Check for memory leaks in browser pool
- Increase Railway memory allocation
- Restart service if persistent

---

## 🔧 DIAGNOSTIC CHECKLIST

When system stops posting/replying, check these in order:

### **1. Check Rate Limits**
```bash
# Look for these log patterns:
⛔ HOURLY LIMIT REACHED
🚨 CRITICAL: Found post with NULL tweet_id
```

### **2. Check Browser Health**
```bash
# Look for:
⏳ [jobName] waiting (priority X, queue: Y)
⏱️ TIMEOUT: [jobName] exceeded 180s
[JOB_NAME] Skipped: browser_degraded
```

### **3. Check Configuration**
```bash
# Verify Railway environment variables:
POSTING_DISABLED=false
ENABLE_REPLIES=true
LIVE_POSTS=true (if legacy flag exists)
```

### **4. Check Queue Status**
```sql
-- Check for stuck posts:
SELECT decision_id, status, created_at 
FROM content_metadata 
WHERE status = 'posting' 
  AND created_at < NOW() - INTERVAL '30 minutes';

-- Check for NULL tweet_ids:
SELECT decision_id, posted_at 
FROM content_metadata 
WHERE status = 'posted' 
  AND tweet_id IS NULL 
  AND posted_at > NOW() - INTERVAL '1 hour';
```

### **5. Check Content Generation**
```bash
# Look for:
⚠️ No queued content found in database at all
[PLAN_JOB] ❌ LLM generation failed
[SUBSTANCE] ⛔ Post REJECTED
```

### **6. Check Memory**
```bash
# Look for:
🧠 Memory critical (XXXMB)
🧠 Memory still critical - skipping job
```

---

## 🎯 QUICK FIXES

### **Fix #1: Reset Stuck Posts**
```sql
UPDATE content_metadata 
SET status = 'queued' 
WHERE status = 'posting' 
  AND created_at < NOW() - INTERVAL '30 minutes';
```

### **Fix #2: Recover NULL Tweet IDs**
- Background job runs every 30min automatically
- Manual trigger: Check `src/jobs/tweetIdRecoveryJob.ts`

### **Fix #3: Force Browser Semaphore Release**
- Restart service (clears all locks)
- Or wait for 180s timeout

### **Fix #4: Check Environment Variables**
```bash
# In Railway dashboard, verify:
POSTING_DISABLED=false
ENABLE_REPLIES=true
```

### **Fix #5: Clear Browser Pool**
- Restart service (clears browser pool)
- Check for memory leaks

---

## 📊 MONITORING RECOMMENDATIONS

### **Add Alerts For:**
1. Posts stuck in 'posting' status >30min
2. NULL tweet_ids in last hour
3. Browser health degraded >5min
4. Memory critical >10min
5. Rate limit reached (expected, but monitor frequency)
6. Content generation failures >3 consecutive

### **Dashboard Metrics:**
- Posts queued vs posted (should match)
- Average time in 'posting' status (should be <5min)
- Browser semaphore queue length (should be <3)
- Memory usage trends
- Rate limit hit frequency

---

## 🔄 SYSTEM FLOW DIAGRAM

```
┌─────────────────┐
│  Posting Queue  │  ← Runs every 5min
│   (Every 5min)  │
└────────┬────────┘
         │
         ├─→ Check Rate Limits ──→ ❌ BLOCKED if limit reached
         │
         ├─→ Check NULL IDs ──→ ❌ BLOCKED if NULL IDs found
         │
         ├─→ Get Ready Posts ──→ ✅ Continue if posts available
         │
         ├─→ Browser Semaphore ──→ ⏳ WAIT if browser busy
         │
         ├─→ Post to Twitter ──→ ✅ Success or ❌ Retry
         │
         └─→ Save to Database ──→ ✅ Complete
```

---

## 📝 SUMMARY

**Most Likely Causes (in order):**
1. **Rate limiting** (hourly limits reached)
2. **NULL tweet ID block** (safety mechanism)
3. **Browser semaphore deadlock** (resource contention)
4. **Content generation failures** (LLM issues)
5. **Configuration flags** (environment variables)

**System has auto-recovery for:**
- Stuck posts (every 5min)
- NULL tweet IDs (every 30min)
- Browser timeouts (180s auto-release)
- Memory issues (emergency cleanup)

**Manual intervention needed for:**
- Configuration flag changes (restart required)
- Persistent browser pool corruption (restart)
- Database connection issues (check Railway)

---

**Next Steps:**
1. Check Railway logs for specific blocking patterns
2. Run diagnostic SQL queries above
3. Verify environment variables
4. Monitor for 24 hours to identify pattern
5. Add alerts for critical conditions

