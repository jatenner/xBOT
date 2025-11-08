# 📋 POSTING SYSTEM LOG ANALYSIS GUIDE
**Date:** November 8, 2025  
**Purpose:** Extract evidence from Railway logs to diagnose posting system  
**Related:** POSTING_SYSTEM_COMPREHENSIVE_DIAGNOSIS_NOV_8_2025.md

---

## 🚀 QUICK START

### Export Logs to File
```bash
# Get last 500 log lines
railway logs --limit 500 > logs_$(date +%Y%m%d_%H%M%S).txt

# Get last 1000 log lines (more comprehensive)
railway logs --limit 1000 > logs_$(date +%Y%m%d_%H%M%S).txt

# Get last 2000 log lines (full system cycle)
railway logs --limit 2000 > logs_$(date +%Y%m%d_%H%M%S).txt
```

### Search Logs for Specific Patterns
```bash
# Plan job activity
railway logs --limit 500 | grep -E "PLAN_JOB|plan_job_start|GENERATING POST"

# Posting queue activity
railway logs --limit 500 | grep -E "POSTING_QUEUE|posting_queue_start"

# Rate limiting events
railway logs --limit 500 | grep -E "Rate limit|HOURLY LIMIT|posts attempted"

# Errors
railway logs --limit 500 | grep -E "ERROR|CRITICAL|Failed|❌"
```

---

## 🔍 LOG PATTERNS TO SEARCH FOR

### 1. PLAN JOB EXECUTION (Every 60 minutes)

#### Pattern: Plan Job Start
```
[INFO] op="plan_job_start" mode="live"
[INFO] op="generate_real" num_to_generate=2 target_rate="2/hour"
```

**What to Look For:**
- Should appear every 60 minutes
- Always shows `num_to_generate=2`
- Mode should be `"live"` not `"shadow"`

**Red Flags:**
- Missing plan_job_start messages (plan job not running)
- num_to_generate less than 2
- Mode is "shadow" (would generate synthetic content)
- Long gaps between runs (>70 minutes)

#### Pattern: Content Generation
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 GENERATING POST 1/2 (attempt 1/3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**What to Look For:**
- Should see "GENERATING POST 1/2" and "GENERATING POST 2/2"
- Attempt 1/3 is normal (first try)
- Both posts generated successfully

**Red Flags:**
```
⚠️ Post 1 could not be generated after 3 attempt(s)
⚠️ No posts generated this cycle
attempt 2/3   (indicating first attempt failed)
attempt 3/3   (indicating first two attempts failed)
```

#### Pattern: Batch Summary
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BATCH SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Generated: 2/2 posts
```

**What to Look For:**
- "Generated: 2/2 posts" (success)
- High diversity percentages (80-100%)
- Unique topics, tones, angles

**Red Flags:**
```
✅ Generated: 0/2 posts
✅ Generated: 1/2 posts
⚠️ No posts generated this cycle
```

#### Pattern: Scheduling
```
📅 SMART SCHEDULING (EXACTLY 2 posts/hour):
   Post 1: scheduled for 2025-11-08T16:00:00.000Z (NOW)
   Post 2: scheduled for 2025-11-08T16:30:00.000Z (+30 min)
```

**What to Look For:**
- Post 1 scheduled for NOW or within 1 minute
- Post 2 scheduled for +30 minutes
- ISO timestamp format

**Red Flags:**
- Both posts scheduled for same time
- Posts scheduled for past time
- Missing scheduling messages

---

### 2. POSTING QUEUE EXECUTION (Every 5 minutes)

#### Pattern: Queue Start
```
[INFO] op="posting_queue_start"
```

**What to Look For:**
- Should appear every 5 minutes
- Regular rhythm (no large gaps)

**Red Flags:**
- Missing for >10 minutes (queue not running)
- Appears too frequently (<4 minutes) or too rarely (>6 minutes)

#### Pattern: Rate Limit Check
```
[POSTING_QUEUE] 📊 Content posts attempted this hour: 0/2
[POSTING_QUEUE] ✅ Rate limit OK: 0/2 posts
```

**What to Look For:**
- Count should be 0, 1, or 2
- Should say "Rate limit OK" if count < 2
- Count should reset to 0 or 1 after an hour passes

**Red Flags:**
```
[POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED: 2/2
[POSTING_QUEUE] ⏰ Next slot in ~X minutes
[POSTING_QUEUE] 📊 Content posts attempted this hour: 3/2  (impossible!)
```

#### Pattern: Ready Posts Query
```
[POSTING_QUEUE] 📅 Fetching posts ready within 5 minute window
[POSTING_QUEUE] 🕒 Current time: 2025-11-08T16:05:00.000Z
[POSTING_QUEUE] 🕒 Grace window: 2025-11-08T16:10:00.000Z
[POSTING_QUEUE] 📊 Content posts: 2, Replies: 0
```

**What to Look For:**
- Grace window is current time + 5 minutes
- Content posts count matches what was generated
- Not finding content from hours ago (should already be posted)

**Red Flags:**
```
[POSTING_QUEUE] 📊 Content posts: 0, Replies: 0  (no content ready - why?)
[POSTING_QUEUE] 📊 Content posts: 10, Replies: 5  (backlog building up)
```

#### Pattern: NULL Tweet ID Detection (CRITICAL)
```
[POSTING_QUEUE] 🚨 CRITICAL: Found post with NULL tweet_id!
[POSTING_QUEUE] 📝 Content: "..."
[POSTING_QUEUE] ⏱️ Posted 5 minutes ago, ID still NULL
[POSTING_QUEUE] 🚫 This breaks rate limiting (can't count it)
[POSTING_QUEUE] 🚫 This breaks metrics scraping (can't collect data)
[POSTING_QUEUE] 🔄 Background job should recover ID, blocking posting until fixed
```

**This is THE MOST CRITICAL ERROR to look for!**

**What It Means:**
- A post was published to Twitter successfully
- But the tweet_id was not captured
- System blocks ALL posting until ID is recovered
- Should be recovered by ID recovery job (every 10 min)

**Impact:**
- Complete posting freeze
- Could last up to 10 minutes (until recovery job runs)
- If recovery fails, could block indefinitely

**How Often Should This Happen:**
- RARELY - ideally never
- Once per week = concerning
- Once per day = major problem
- Multiple times per hour = critical system failure

#### Pattern: Successful Posting
```
[POSTING_QUEUE] ✅ Posted 1/1 decisions (1 content, 0 replies)
[POSTING_QUEUE] ✅ Posted 2/2 decisions (2 content, 0 replies)
```

**What to Look For:**
- "Posted X/Y decisions" where X = Y (all posts succeeded)
- Split between content and replies makes sense
- Appears regularly throughout the day

**Red Flags:**
```
[POSTING_QUEUE] ✅ Posted 0/2 decisions (0 content, 0 replies)
[POSTING_QUEUE] ✅ Posted 1/3 decisions (0 content, 1 replies)
[POSTING_QUEUE] ❌ Failed to post decision XXX
```

---

### 3. RATE LIMITING BEHAVIOR

#### Pattern: Normal Operation
```
[POSTING_QUEUE] 📊 Content posts attempted this hour: 0/2
[POSTING_QUEUE] ✅ Rate limit OK: 0/2 posts
... (post happens) ...
[POSTING_QUEUE] 📊 Content posts attempted this hour: 1/2
[POSTING_QUEUE] ✅ Rate limit OK: 1/2 posts
... (post happens) ...
[POSTING_QUEUE] 📊 Content posts attempted this hour: 2/2
[POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED: 2/2
[POSTING_QUEUE] ⏰ Next slot in ~30 minutes
```

**Timeline:**
1. Hour starts: 0/2 (can post)
2. First post: 1/2 (can still post)
3. Second post: 2/2 (BLOCKED)
4. 30 minutes later: First post ages out, back to 1/2

#### Pattern: Incorrect Blocking (BUG)
```
[POSTING_QUEUE] 📊 Content posts attempted this hour: 2/2
[POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED: 2/2

(But checking database shows posts were created 90 minutes ago,
 only posted 20 minutes ago - should only count 1 in last hour)
```

**This indicates the rate limit bug (using created_at instead of posted_at)**

---

### 4. THREAD POSTING

#### Pattern: Thread Detection
```
[POSTING_QUEUE] 🧵 Detected thread with 3 parts
[THREAD_COMPOSER] Using REPLY_CHAIN mode
[THREAD_COMPOSER] Posting tweet 1/3...
[THREAD_COMPOSER] ✅ Tweet 1 posted: 1234567890
[THREAD_COMPOSER] Posting tweet 2/3 as reply to 1234567890...
[THREAD_COMPOSER] ✅ Tweet 2 posted: 1234567891
[THREAD_COMPOSER] Posting tweet 3/3 as reply to 1234567891...
[THREAD_COMPOSER] ✅ Tweet 3 posted: 1234567892
[THREAD_COMPOSER] ✅ Thread posted successfully
```

**What to Look For:**
- All tweets in thread post successfully
- Tweet IDs are captured
- Reply chain works correctly

#### Pattern: Thread Failure
```
[THREAD_COMPOSER] ❌ REPLY_CHAIN mode failed: [error message]
[THREAD_COMPOSER] 🔄 Falling back to COMPOSER mode...
```

**Red Flags:**
```
[THREAD_COMPOSER] ❌ REPLY_CHAIN mode failed
[THREAD_COMPOSER] ❌ COMPOSER mode also failed
[THREAD_COMPOSER] ❌ Thread posting completely failed
```

---

### 5. ERROR PATTERNS

#### Pattern: LLM Budget Exhausted
```
[PLAN_JOB] ❌ LLM budget exhausted
[PLAN_JOB] ⚠️ Cannot generate content
op="generate_real" blocked=true reason="budget_exceeded"
```

**Impact:** No content generated this cycle

#### Pattern: Playwright/Browser Errors
```
[PLAYWRIGHT] ❌ Browser session expired
[PLAYWRIGHT] ❌ Failed to navigate to Twitter
[POSTING] ❌ Failed to post: Playwright error
```

**Impact:** Posts can't be published to Twitter

#### Pattern: Database Errors
```
[POSTING_QUEUE] ❌ Rate limit check failed: [database error]
[POSTING_QUEUE] 🛡️ BLOCKING posts as safety measure
```

**Impact:** All posting blocked as safety measure

---

## 📊 LOG ANALYSIS CHECKLIST

### ✅ Phase 1: System Rhythm (5 minutes)

1. **Check Plan Job Frequency**
   ```bash
   railway logs --limit 1000 | grep "plan_job_start" | head -20
   ```
   - Count how many times it appears
   - Calculate time between occurrences
   - Should be ~60 minutes apart

2. **Check Posting Queue Frequency**
   ```bash
   railway logs --limit 1000 | grep "posting_queue_start" | head -30
   ```
   - Count how many times it appears
   - Calculate time between occurrences
   - Should be ~5 minutes apart

3. **Overall System Health**
   ```bash
   railway logs --limit 500 | grep -E "ERROR|CRITICAL|❌" | wc -l
   ```
   - Count total errors
   - <10 errors = healthy
   - 10-50 errors = concerning
   - >50 errors = critical

### ✅ Phase 2: Content Generation (10 minutes)

4. **Verify 2 Posts Generated Per Cycle**
   ```bash
   railway logs --limit 1000 | grep "Generated:.*posts"
   ```
   - Should see "Generated: 2/2 posts"
   - Count how many times it says 0/2, 1/2, or 2/2

5. **Check Generation Failures**
   ```bash
   railway logs --limit 1000 | grep -E "could not be generated|No posts generated"
   ```
   - Should be rare or non-existent
   - If frequent: content generation is broken

6. **Check Duplicate Detection**
   ```bash
   railway logs --limit 1000 | grep -i "duplicate"
   ```
   - Some duplicates detected is normal (system working)
   - All posts flagged as duplicate = problem

### ✅ Phase 3: Posting Success (15 minutes)

7. **Check NULL Tweet ID Blocking**
   ```bash
   railway logs --limit 1000 | grep "NULL tweet_id"
   ```
   - **THIS IS THE MOST IMPORTANT CHECK**
   - Should be zero or very rare
   - If present: major blocker

8. **Check Posting Success Rate**
   ```bash
   railway logs --limit 1000 | grep "Posted.*decisions"
   ```
   - Look for "Posted X/Y" where X = Y
   - Calculate success rate
   - >90% = good, <80% = problem

9. **Check Rate Limit Blocks**
   ```bash
   railway logs --limit 1000 | grep "HOURLY LIMIT REACHED"
   ```
   - Should appear after every 2 posts
   - Should NOT appear when <2 posts in last hour

### ✅ Phase 4: Timing Analysis (10 minutes)

10. **Check Post Scheduling**
    ```bash
    railway logs --limit 500 | grep "scheduled for"
    ```
    - Posts should be +0min and +30min apart
    - Not multiple posts at same time

11. **Check Actual Posting Times**
    ```bash
    railway logs --limit 500 | grep -E "Posted.*ago|Posted at"
    ```
    - Posts should happen close to scheduled time
    - Large delays indicate problems

---

## 🎯 EVIDENCE COLLECTION TEMPLATE

After running log analysis, fill out this template:

```
POSTING SYSTEM LOG ANALYSIS RESULTS
Date: [fill in]
Logs Analyzed: Last [X] lines
Time Period: [approximate hours covered]

1. PLAN JOB
   ✅ Running regularly? YES / NO
   ✅ Interval: ___ minutes (expected: 60)
   ✅ Generating 2 posts? YES / NO / SOMETIMES
   ❌ Generation failures: ___ occurrences
   ❌ LLM budget issues: YES / NO

2. POSTING QUEUE
   ✅ Running regularly? YES / NO
   ✅ Interval: ___ minutes (expected: 5)
   ✅ Finding ready posts? YES / NO / SOMETIMES
   ❌ NULL tweet_id blocking: ___ occurrences
   ❌ Database errors: ___ occurrences

3. RATE LIMITING
   ✅ Blocking after 2 posts? YES / NO / INCONSISTENT
   ✅ Unblocking after 1 hour? YES / NO / CAN'T TELL
   ❌ Incorrect blocks: ___ occurrences
   ❌ Posts exceeding limit: ___ occurrences

4. POSTING SUCCESS
   ✅ Posts publishing? YES / NO / SOMETIMES
   ✅ Success rate: ___% (from "Posted X/Y" messages)
   ❌ Twitter errors: ___ occurrences
   ❌ Browser failures: ___ occurrences

5. THREAD POSTING
   ✅ Threads working? YES / NO / CAN'T TELL
   ❌ Thread failures: ___ occurrences
   ❌ Fallback to composer: ___ occurrences

6. OVERALL ASSESSMENT
   System Status: HEALTHY / DEGRADED / BROKEN
   Posting Rate: Achieving 2/hour? YES / NO / UNKNOWN
   Critical Issues: [list any NULL tweet_id, browser failures, etc.]
   Recommendations: [what to investigate further]
```

---

## 🔥 CRITICAL INDICATORS

### 🚨 STOP EVERYTHING IF YOU SEE:

1. **Multiple NULL tweet_id messages in last hour**
   - System is completely blocked
   - No posts going out
   - Need immediate fix

2. **"Browser session expired" repeatedly**
   - Twitter authentication lost
   - Cannot post anything
   - Need to re-authenticate

3. **"LLM budget exhausted" in last 24 hours**
   - Content generation stopped
   - No new posts being created
   - Need to reset budget or wait

4. **"Database error" in posting queue**
   - System blocking all posts as safety
   - Database connection issue
   - Need database fix

---

## 📁 LOG EXPORT COMMANDS REFERENCE

### Basic Export
```bash
# Last 500 lines to file
railway logs --limit 500 > logs.txt

# Last 1000 lines to file
railway logs --limit 1000 > logs.txt

# Last 2000 lines (full cycle)
railway logs --limit 2000 > logs_full.txt
```

### Filtered Exports
```bash
# Plan job only
railway logs --limit 1000 | grep "PLAN_JOB" > logs_plan.txt

# Posting queue only
railway logs --limit 1000 | grep "POSTING_QUEUE" > logs_posting.txt

# Errors only
railway logs --limit 1000 | grep -E "ERROR|CRITICAL|❌" > logs_errors.txt

# Last 24 hours (if supported)
railway logs --since "24 hours ago" > logs_24h.txt
```

### Search in Exported File
```bash
# Count plan job runs
grep "plan_job_start" logs.txt | wc -l

# Count successful posts
grep "Posted.*decisions" logs.txt | wc -l

# Find NULL tweet_id issues
grep "NULL tweet_id" logs.txt

# Find rate limit blocks
grep "HOURLY LIMIT REACHED" logs.txt
```

---

## 🏁 CONCLUSION

After completing this log analysis, you should have:

1. ✅ Evidence of how often plan job runs
2. ✅ Evidence of how often posting queue runs
3. ✅ Evidence of actual posting frequency
4. ✅ Evidence of any blocking issues (NULL tweet_id)
5. ✅ Evidence of generation success rate
6. ✅ Evidence of posting success rate
7. ✅ List of critical errors to address

**Next Step:** Combine log analysis with database query results to create complete picture of system health.

**Reference:** See POSTING_SYSTEM_DIAGNOSTIC_QUERIES.sql for database queries to run alongside log analysis.

