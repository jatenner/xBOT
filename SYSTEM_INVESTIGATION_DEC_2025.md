# 🔍 SYSTEM INVESTIGATION REPORT - December 2025
## "The Case of the Silent Bot"

**Investigator:** AI Assistant  
**Date:** December 2025  
**Case:** System not posting/replying for 12+ hours  
**Expected Behavior:** 2 posts/hour + 4 replies/hour  
**Actual Behavior:** No activity for 12 hours

---

## 🎯 EXECUTIVE SUMMARY

**Status:** 🔴 **CRITICAL FAILURE**  
**Last Activity:** 12+ hours ago  
**Root Causes Identified:** Multiple systemic issues preventing continuous operation

---

## 📋 INVESTIGATION FINDINGS

### 1. POSTING SYSTEM ANALYSIS

#### Expected Flow:
```
Plan Job (every 2h) → Generates 2 posts → Stores in content_metadata (status='queued')
    ↓
Posting Queue (every 5min) → Checks for queued content → Posts to Twitter → Updates status='posted'
```

#### Current Status:
- ✅ **Posting Queue Job:** Scheduled correctly (every 5 min, 0s delay)
- ❓ **Plan Job:** Status unknown - needs verification
- ❓ **Content Generation:** Unknown if running
- ❓ **Queue Status:** Unknown if content is queued

#### Potential Blockers:

**A. Plan Job Not Running**
- **Location:** `src/jobs/jobManager.ts:196-218`
- **Schedule:** Every `JOBS_PLAN_INTERVAL_MIN` minutes (default: 120 min = 2 hours)
- **Restart Protection:** `shouldRunPlanJobImmediately()` checks if last content >2h ago
- **Risk:** If `JOBS_PLAN_INTERVAL_MIN` is set too high (e.g., 720 min = 12h), job may not run frequently enough
- **Check Needed:** Verify `JOBS_PLAN_INTERVAL_MIN` environment variable

**B. Plan Job Blocked by LLM Guard**
- **Location:** `src/jobs/planJob.ts:82-104`
- **Check:** `isLLMAllowed()` can block content generation
- **Blockers:**
  - `OPENAI_API_KEY` not set
  - `AI_QUOTA_CIRCUIT_OPEN === 'true'`
  - Budget limits exceeded
- **Risk:** If LLM is blocked, no content gets generated
- **Check Needed:** Verify OpenAI API key and budget status

**C. Posting Queue Blocked by Circuit Breaker**
- **Location:** `src/jobs/postingQueue.ts:34-63`
- **Circuit Breaker:** Opens after 15 failures, blocks for 60 seconds
- **Risk:** If circuit breaker is open, posting queue skips all processing
- **Check Needed:** Verify circuit breaker state

**D. Posting Queue Blocked by Rate Limits**
- **Location:** `src/jobs/postingQueue.ts:461-580`
- **Check:** `checkPostingRateLimits()` verifies hourly limits
- **Risk:** If rate limit check fails or returns false, posting stops
- **Note:** Has graceful degradation (allows posting on error)
- **Check Needed:** Verify rate limit status

**E. Posting Disabled Flag**
- **Location:** `src/jobs/postingQueue.ts:147-150`
- **Check:** `flags.postingDisabled` blocks entire queue
- **Risk:** If `POSTING_DISABLED=true`, nothing posts
- **Check Needed:** Verify `POSTING_DISABLED` environment variable

---

### 2. REPLY SYSTEM ANALYSIS

#### Expected Flow:
```
Reply Opportunity Harvester (every 2h) → Finds viral tweets → Stores in reply_opportunities
    ↓
Reply Posting Job (every 30min) → Generates 2 replies → Stores in content_metadata (status='queued')
    ↓
Posting Queue (every 5min) → Processes replies same as posts → Posts to Twitter
```

#### Current Status:
- ✅ **Reply Posting Job:** Scheduled correctly (every 30 min, 1 min delay)
- ✅ **Harvester:** Scheduled correctly (every 2h, 10 min delay)
- ❓ **Reply Generation:** Unknown if running
- ❓ **Opportunity Pool:** Unknown if populated

#### Potential Blockers:

**A. Replies Disabled**
- **Location:** `src/jobs/jobManager.ts:119-174`
- **Check:** `ENABLE_REPLIES` environment variable
- **Default:** Enabled (unless explicitly set to 'false')
- **Risk:** If `ENABLE_REPLIES=false`, all reply jobs are skipped
- **Check Needed:** Verify `ENABLE_REPLIES` environment variable

**B. Reply Quota Exceeded**
- **Location:** `src/jobs/replyJob.ts:97-168`
- **Checks:**
  - Hourly quota: `MAX_REPLIES_PER_HOUR` (default: 4)
  - Daily quota: `MAX_REPLIES_PER_DAY` (default: 100)
  - Time between replies: `MIN_MINUTES_BETWEEN` (default: 15)
- **Risk:** If quota exceeded, reply generation stops
- **Check Needed:** Verify reply quota status

**C. Empty Opportunity Pool**
- **Location:** `src/jobs/replyOpportunityHarvester.ts`
- **Requirement:** Needs 200-300 opportunities in pool
- **Risk:** If pool is empty, no replies can be generated
- **Check Needed:** Verify `reply_opportunities` table has recent entries

**D. Browser Health Gate**
- **Location:** `src/jobs/jobManager.ts:473-477`
- **Check:** `shouldRunLowPriority()` blocks harvester if browser degraded
- **Risk:** If browser is unhealthy, harvester doesn't run
- **Check Needed:** Verify browser health status

---

### 3. METRICS SCRAPING ANALYSIS

#### Expected Flow:
```
Metrics Scraper Job (every 20min) → Scrapes posted tweets → Updates outcomes table
```

#### Current Status:
- ✅ **Metrics Scraper:** Scheduled correctly (every 20 min, 0s delay)
- ❓ **Scraping Activity:** Unknown if running
- ❓ **Browser Health:** Unknown if blocking scraping

#### Potential Blockers:

**A. Browser Health Gate**
- **Location:** `src/jobs/jobManager.ts:270-274`
- **Check:** `shouldRunLowPriority()` blocks scraper if browser degraded
- **Risk:** If browser is unhealthy, metrics scraping stops
- **Check Needed:** Verify browser health status

**B. No Posts to Scrape**
- **Risk:** If no posts exist, scraper has nothing to do
- **Check Needed:** Verify recent posts exist in database

---

### 4. TWEET HARVESTING ANALYSIS

#### Expected Flow:
```
Mega Viral Harvester (every 2h) → Searches Twitter → Stores opportunities in reply_opportunities
```

#### Current Status:
- ✅ **Harvester:** Scheduled correctly (every 2h, 10 min delay)
- ❓ **Harvesting Activity:** Unknown if running
- ❓ **Opportunity Pool:** Unknown if populated

#### Potential Blockers:

**A. Browser Health Gate**
- **Location:** `src/jobs/jobManager.ts:473-477`
- **Check:** `shouldRunLowPriority()` blocks harvester if browser degraded
- **Risk:** If browser is unhealthy, harvesting stops
- **Check Needed:** Verify browser health status

**B. Empty Account Pool**
- **Requirement:** Needs accounts in `discovered_accounts` table
- **Risk:** If no accounts discovered, harvester can't find opportunities
- **Check Needed:** Verify `discovered_accounts` table has entries

---

## 🔍 CRITICAL CHECKS NEEDED

### 1. Environment Variables
```bash
# Check these critical variables:
POSTING_DISABLED          # Should be unset or 'false'
ENABLE_REPLIES            # Should be 'true' or unset (defaults to true)
JOBS_PLAN_INTERVAL_MIN    # Should be reasonable (60-120 min, not 720)
OPENAI_API_KEY            # Must be set for content generation
```

### 2. Database State
```sql
-- Check last post/reply:
SELECT decision_type, status, posted_at, created_at 
FROM content_metadata 
WHERE decision_type IN ('single', 'thread', 'reply')
ORDER BY COALESCE(posted_at, created_at) DESC 
LIMIT 10;

-- Check queued content:
SELECT COUNT(*) as queued_count, decision_type
FROM content_metadata
WHERE status = 'queued'
GROUP BY decision_type;

-- Check opportunity pool:
SELECT COUNT(*) as opportunity_count
FROM reply_opportunities
WHERE tweet_posted_at > NOW() - INTERVAL '24 hours';
```

### 3. Job Execution Status
```bash
# Check Railway logs for:
- [PLAN_JOB] or [UNIFIED_PLAN] logs
- [REPLY_JOB] or [REPLY_POSTING] logs
- [POSTING_QUEUE] logs
- [METRICS_SCRAPER] logs
- [HARVESTER] logs
- Circuit breaker warnings
- Rate limit warnings
- Browser health warnings
```

### 4. Browser Health
```bash
# Check for browser health issues:
- BrowserSemaphore blocking
- BrowserHealthGate warnings
- Playwright errors
- Session expiration
```

---

## 🚨 MOST LIKELY ROOT CAUSES (Ranked)

### 1. 🔴 **CRITICAL: Plan Job Not Running**
**Probability:** High  
**Impact:** No content generated = nothing to post  
**Evidence Needed:**
- Check if `JOBS_PLAN_INTERVAL_MIN` is set too high (e.g., 720 min)
- Check if plan job logs exist in last 12 hours
- Check if LLM is blocked (OpenAI API key, budget)

### 2. 🔴 **CRITICAL: Posting Disabled**
**Probability:** Medium-High  
**Impact:** Entire posting system blocked  
**Evidence Needed:**
- Check `POSTING_DISABLED` environment variable
- Check if posting queue logs show "disabled" status

### 3. 🟡 **MODERATE: Circuit Breaker Open**
**Probability:** Medium  
**Impact:** Posting queue skips all processing  
**Evidence Needed:**
- Check posting queue logs for circuit breaker warnings
- Check if 15+ failures occurred recently

### 4. 🟡 **MODERATE: Browser Health Degraded**
**Probability:** Medium  
**Impact:** All browser-dependent jobs blocked  
**Evidence Needed:**
- Check browser health gate status
- Check for Playwright errors
- Check session expiration

### 5. 🟢 **LOW: Reply System Disabled**
**Probability:** Low  
**Impact:** Only affects replies, not posts  
**Evidence Needed:**
- Check `ENABLE_REPLIES` environment variable
- Check reply job logs

---

## 📊 INVESTIGATION CHECKLIST

### Immediate Checks:
- [ ] Verify `POSTING_DISABLED` is not set to 'true'
- [ ] Verify `ENABLE_REPLIES` is 'true' or unset
- [ ] Verify `JOBS_PLAN_INTERVAL_MIN` is reasonable (60-120 min)
- [ ] Verify `OPENAI_API_KEY` is set
- [ ] Check database for last post/reply timestamp
- [ ] Check database for queued content
- [ ] Check Railway logs for job execution
- [ ] Check Railway logs for errors/warnings

### Deep Dive Checks:
- [ ] Verify plan job is scheduled and running
- [ ] Verify posting queue is processing
- [ ] Verify reply job is scheduled and running
- [ ] Verify harvester is populating opportunity pool
- [ ] Verify browser health is OK
- [ ] Verify circuit breaker state
- [ ] Verify rate limit status
- [ ] Verify LLM budget status

---

## 🎯 RECOMMENDED ACTIONS

### Immediate (Do Now):
1. **Check Environment Variables**
   - Run: `railway variables` or check Railway dashboard
   - Verify critical flags are set correctly

2. **Check Database State**
   - Query last post/reply timestamp
   - Query queued content count
   - Query opportunity pool size

3. **Check Railway Logs**
   - Look for job execution logs
   - Look for error messages
   - Look for blocking conditions

### Short-Term (Fix Issues Found):
1. **If Plan Job Not Running:**
   - Lower `JOBS_PLAN_INTERVAL_MIN` to 60 min
   - Manually trigger plan job once
   - Verify content generation works

2. **If Posting Disabled:**
   - Remove `POSTING_DISABLED` or set to 'false'
   - Restart service

3. **If Circuit Breaker Open:**
   - Investigate why failures occurred
   - Reset circuit breaker manually if needed
   - Fix underlying issues

4. **If Browser Health Degraded:**
   - Check Playwright session
   - Restart browser pool
   - Verify session is valid

### Long-Term (Prevent Recurrence):
1. **Add Monitoring**
   - Alert when no posts for 2+ hours
   - Alert when plan job hasn't run
   - Alert when circuit breaker opens

2. **Improve Resilience**
   - Better error handling
   - Automatic recovery mechanisms
   - Health check endpoints

3. **Documentation**
   - Document all blocking conditions
   - Create troubleshooting guide
   - Add system status dashboard

---

## 📝 NOTES

- System has restart protection for plan job (`shouldRunPlanJobImmediately`)
- System has graceful degradation for rate limit errors
- System has circuit breaker for posting failures
- System has browser health gates for browser-dependent jobs
- All jobs use staggered timing to prevent collisions

**Next Steps:** Execute the investigation checklist to identify the specific root cause(s).

