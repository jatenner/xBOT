# 📊 DATA GATHERING & ANALYSIS - Understanding Before Fixing

## 🎯 OBJECTIVES

### Batch 1: Understand Content Quality
1. **NewsReporter:** What makes it "match quality"? What's the bar?
2. **Quality Threshold:** Will generators improve with data, or do we need to improve them now?

### Batch 2: Verify Posting Pipeline NOW
Run all 4 diagnostic steps to find the exact issue before coding

### Batch 3: Map Reply System Flow
Trace discovery → scoring to find exact disconnect

---

## 📝 BATCH 1 ANALYSIS - Content Quality

### Part 1: NewsReporter - What Does "Match Quality" Mean?

#### Questions to Answer:
1. What quality score do other generators achieve?
2. What makes content score 71 vs 85?
3. What's in the current NewsReporter prompt?
4. What's in the BEST generator prompts?
5. How do we make NewsReporter match the best?

#### Data to Gather:
- [ ] Read current NewsReporter prompt
- [ ] Read top-performing generator prompts (HumanVoice, Storyteller)
- [ ] Understand quality scoring criteria
- [ ] Compare prompts to find what makes them score higher
- [ ] Map out improvement strategy

---

### Part 2: Quality Threshold - Improve Generators or Lower Bar?

#### The Confusion:
You're right to question this! Two different philosophies:

**Option A: Lower Threshold (Quick Fix)**
- Changes: 75 → 70
- Logic: "Let current content through"
- Problem: Accepts lower quality
- Benefit: Posts start flowing NOW

**Option B: Improve Generators (Right Fix)**
- Changes: Make generators better
- Logic: "Fix the root cause"
- Problem: Takes longer
- Benefit: Actually better content

**Option C: Both (Smart Fix)**
- Lower threshold temporarily (70-72)
- Improve generators in parallel
- Gradually raise threshold as generators improve
- Logic: "Get posting NOW, improve quality SOON"

#### Your Question: "Will generators improve with data?"
**Answer:** YES AND NO

**YES - With Data:**
- Learning system uses performance data
- Over time, learns what content performs well
- Adjusts generation strategies
- **Timeline:** 1-2 weeks, 50+ posts

**NO - Not Automatically:**
- Generators won't magically get better
- Prompts need to be improved based on insights
- Learning informs us, we improve prompts
- **Process:** Data → Insights → Prompt Updates

#### Questions to Answer:
1. What quality scores do your 12 generators currently achieve?
2. Which generators consistently score 75+?
3. Which generators score 65-72 (need improvement)?
4. What's the quality scoring formula?
5. Can we improve generators to hit 75+ reliably?

#### Data to Gather:
- [ ] Check quality scoring code
- [ ] Understand what makes 75+ vs 71
- [ ] Compare high-scoring vs low-scoring generator prompts
- [ ] Determine if generator improvement is quick or long

---

## 🔍 BATCH 2 VERIFICATION - Posting Pipeline (DO NOW)

### Goal: Run diagnostics NOW to know exactly what's broken

### Step 1: Verify Database Storage
**Check if content is being saved at all**

Commands to run:
```sql
-- Check if table exists and has data
SELECT COUNT(*) as total_rows FROM content_metadata;

-- Check recent inserts
SELECT 
  id,
  decision_id,
  content_hash,
  status,
  scheduled_at,
  created_at,
  generation_source
FROM content_metadata 
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Check status distribution
SELECT status, COUNT(*) as count 
FROM content_metadata 
GROUP BY status;
```

**Expected Findings:**
- [ ] Table exists
- [ ] Has rows (if 0, database insert failing)
- [ ] Recent rows (within 2 hours)
- [ ] Status field values

---

### Step 2: Check Scheduled Times
**Verify timing logic**

```sql
-- Check scheduled_at vs created_at
SELECT 
  id,
  created_at,
  scheduled_at,
  (scheduled_at - created_at) as time_diff,
  status
FROM content_metadata 
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC;

-- Check how many are "ready" to post
SELECT COUNT(*) as ready_to_post
FROM content_metadata
WHERE status = 'queued'
AND scheduled_at <= NOW();
```

**Expected Findings:**
- [ ] How far in future is scheduled_at? (should be 0-30 min)
- [ ] Are posts "ready" according to time?
- [ ] Is grace window issue?

---

### Step 3: Check Status Field Logic
**Verify status flow**

```sql
-- What statuses exist
SELECT DISTINCT status FROM content_metadata;

-- Status flow over time
SELECT 
  status,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  COUNT(*) as count
FROM content_metadata
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY first_seen;
```

**Expected Findings:**
- [ ] What statuses are actually used? (queued, planned, posted?)
- [ ] Does generation set correct status?
- [ ] Does posting queue look for correct status?

---

### Step 4: Trace Posting Queue Query
**Find the exact query used**

Files to read:
- `src/jobs/postingQueue.ts`
- `src/jobs/jobManager.ts`
- Any file with "posting" or "queue"

**Look for:**
- [ ] SQL SELECT query that fetches posts
- [ ] WHERE conditions (status = ?)
- [ ] Time conditions (scheduled_at ?)
- [ ] ORDER BY and LIMIT

**Compare to actual database:**
- [ ] Does query match table schema?
- [ ] Does status match what's in DB?
- [ ] Does time window make sense?

---

## 🔍 BATCH 3 TRACING - Reply System (DO NOW)

### Goal: Map the entire discovery → scoring flow

### Step 1: Trace Discovery Storage
**Where do discovered accounts go?**

Files to read:
- `src/ai/accountDiscovery.ts`
- `src/engagement/realReplySystem.ts`
- Any file with "discovery"

**Look for:**
1. Discovery function (what finds the 5 accounts?)
2. Storage code (where are they saved?)
   ```typescript
   // Find code like:
   await supabase.from('???').insert(accounts)
   ```
3. Table name (discovered_accounts? target_accounts? reply_targets?)
4. Data structure (what fields are saved?)

**Map it out:**
```
Discovery finds accounts
  ↓
Stores to TABLE_NAME
  ↓
Fields: [username, follower_count, etc]
```

---

### Step 2: Trace Scoring Query
**Where does scoring look for accounts?**

**Look for:**
1. Scoring function (what scores accounts?)
2. Query code (where does it fetch from?)
   ```typescript
   // Find code like:
   const accounts = await supabase.from('???').select()
   ```
3. Filters/conditions (what WHERE clauses?)
4. Time windows (recent only? all time?)

**Map it out:**
```
Scoring queries TABLE_NAME
  ↓
Conditions: [age < 24h?, status = 'new'?]
  ↓
Returns: ??? accounts
```

---

### Step 3: Find The Disconnect
**Compare Step 1 and Step 2**

**Possible Issues:**
- [ ] Different table names? (stores to A, queries from B)
- [ ] Time window too narrow? (stores now, queries for yesterday)
- [ ] Status mismatch? (stores as 'discovered', queries for 'pending')
- [ ] Missing fields? (query expects field X that's not stored)
- [ ] Async timing? (query runs before insert completes)

**Document:**
```
STORE: Table X, status Y, no time filter
QUERY: Table Z, status W, time < 24h
ISSUE: Tables don't match!
```

---

## 📋 DATA GATHERING CHECKLIST

### Before We Code Anything:

#### Batch 1 Data:
- [ ] Read NewsReporter current prompt
- [ ] Read top generator prompts  
- [ ] Understand quality scoring formula
- [ ] Compare generator quality scores
- [ ] Map improvement strategy

#### Batch 2 Data:
- [ ] Run database queries (4 steps)
- [ ] Read posting queue code
- [ ] Find exact issue in pipeline
- [ ] Document findings

#### Batch 3 Data:
- [ ] Trace discovery code
- [ ] Trace scoring code
- [ ] Map the disconnect
- [ ] Document findings

---

## 🎯 WHAT THIS GIVES US

**After gathering all this data:**

1. **Batch 1:** We'll know EXACTLY how to improve NewsReporter (not just make it less strict)
2. **Quality Threshold:** We'll know if generators CAN hit 75+ or if we need to lower threshold
3. **Batch 2:** We'll know the EXACT bug in posting pipeline (not guessing)
4. **Batch 3:** We'll know the EXACT disconnect in reply system

**Then:**
- Fixes will be precise (not trial and error)
- Implementation will be fast (know exactly what to change)
- Less risk of breaking things (full understanding)

---

## 🚀 READY TO START GATHERING?

**I'll now:**
1. Read all the code
2. Run all the database queries
3. Trace all the flows
4. Document everything
5. Create specific fix plans

**No coding, just understanding.**

Want me to start?

