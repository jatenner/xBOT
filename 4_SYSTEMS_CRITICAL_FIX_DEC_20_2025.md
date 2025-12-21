# 🚨 4 CRITICAL SYSTEMS - STATUS & FIXES REQUIRED
## Date: December 20, 2025 6:15 AM ET

---

## ⚠️ **OVERALL VERDICT: 3/4 SYSTEMS FAILING**

**Only DB saving is working correctly. All other systems have critical issues.**

---

## 📊 **SYSTEM 1: POSTING RATE** ❌ **FAILING**

### Current State:
- **Target:** 4 posts/hour
- **Actual:** 2.3 posts/hour (last 24h)
- **Gap:** **-1.7 posts/hour** (42% under target)

### Breakdown:
- **Last Hour:** 0 posts
- **Last 24 Hours:** 56 posts total

### Root Cause:
**System is under-posting** - likely due to:
1. Not enough content being generated
2. Posting jobs not running frequently enough
3. Browser pool overload blocking posting operations

### Impact:
- ❌ Only 56% of target volume
- ❌ Growth will be slower than expected
- ❌ Learning pipeline getting less data

### **FIX REQUIRED:**
```bash
# Check planJob frequency
railway logs --service xBOT | grep "PLAN_JOB" | tail -n 20

# Verify posting queue is running
railway logs --service xBOT | grep "POSTING_QUEUE" | tail -n 20

# Ensure browser pool has capacity
railway variables --set "MAX_CONCURRENT_BROWSER_OPS=2"
```

---

## 📊 **SYSTEM 2: TWEET HARVESTER** 🚨 **CRITICAL FAILURE**

### Current State:
- **Opportunities in last 24h:** 0
- **Total opportunities:** 0
- **High-quality targets:** 0

### Root Cause:
**Browser pool overload causing ALL searches to timeout!**

From logs:
```
[HARVESTER] ✗ Search failed for HEALTH HOT (500+): Queue timeout after 60s
[HARVESTER] ✗ Search failed for HEALTH VIRAL (1K+): Queue timeout after 60s
[HARVESTER] ✗ Search failed for BIOHACK (500+): Queue timeout after 60s
[HARVESTER] ⚠️ Pool still low (88/150)
[HARVESTER] 🔍 Searches processed: 0/9
[HARVESTER] 🌾 Harvested: 0 new viral tweet opportunities
```

**The harvester IS running, but can't complete searches because browser pool is saturated!**

### Impact:
- ❌ **NO reply opportunities being discovered**
- ❌ Reply system has nothing to work with
- ❌ Can't engage with viral content
- ❌ Missing growth opportunities

### **FIX REQUIRED:**

#### Option 1: Reduce Browser Load (IMMEDIATE)
```bash
# Temporarily disable heavy browser operations
railway variables --set "DISABLE_VI_SCRAPE=true" --service xBOT
railway variables --set "DISABLE_FOLLOWER_BASELINE=true" --service xBOT

# Give harvester higher priority
# (Need to modify code to prioritize harvester in browser pool)
```

#### Option 2: Increase Browser Capacity (MEDIUM-TERM)
```bash
# Increase max concurrent operations
railway variables --set "MAX_CONCURRENT_BROWSER_OPS=3" --service xBOT

# But this may cause memory issues - need to test
```

#### Option 3: Split Services (LONG-TERM)
- Run harvester in separate Railway service
- Dedicated browser pool for harvesting
- Won't compete with posting/metrics

---

## 📊 **SYSTEM 3: ACCOUNT DISCOVERY** 🚨 **CRITICAL FAILURE**

### Current State:
- **Total discovered accounts:** 0
- **Accounts in last 24h:** 0
- **Active accounts:** 0

### Root Cause:
**Same as harvester - browser pool overload OR discovery job not running!**

### Tables:
- `discovered_accounts` - completely empty
- No account discovery happening at all

### Impact:
- ❌ **NO new accounts to harvest from**
- ❌ Harvester has no seed accounts
- ❌ Can't diversify reply targets
- ❌ Stuck with initial hardcoded accounts (if any)

### **FIX REQUIRED:**

#### Step 1: Verify Job is Registered
```typescript
// Check src/jobs/jobManager.ts
// Look for account discovery job registration
// If missing, need to add it
```

#### Step 2: Check if Table Exists
```sql
-- Run in Supabase SQL editor
SELECT * FROM discovered_accounts LIMIT 10;

-- If table doesn't exist, need migration:
CREATE TABLE IF NOT EXISTS discovered_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  follower_count INTEGER,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  harvested_count INTEGER DEFAULT 0,
  last_harvested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discovered_accounts_username ON discovered_accounts(username);
CREATE INDEX idx_discovered_accounts_discovered_at ON discovered_accounts(discovered_at DESC);
```

#### Step 3: Seed Initial Accounts
```typescript
// Create scripts/seed-discovery-accounts.ts
// Manually add 20-30 high-quality health accounts
// Examples: @hubermanlab, @foundmyfitness, @peterattiamd, etc.
```

---

## 📊 **SYSTEM 4: DATABASE SAVING** ⚠️ **PARTIALLY WORKING**

### Current State:
- **Receipts (posted to X):** 56
- **DB entries (content_metadata):** 41
- **Posts with tweet_id:** 41 (100% of saved)
- **Truth gap:** **15 posts**

### Analysis:
✅ **GOOD:**
- All saved posts have tweet_id (100%)
- Receipt system is writing correctly
- No posts saved with missing IDs

⚠️ **ISSUE:**
- **15 posts posted to X but NOT saved to DB**
- 27% of posts are in truth gap
- Receipts show 56, DB shows 41

### Root Cause:
**Truth gap is happening!**

Possible causes:
1. `markDecisionPosted()` failing silently
2. Receipt written but DB save throws error
3. Reconciliation job not running
4. Posts from before receipt system was deployed

### **FIX REQUIRED:**

#### Step 1: Run Reconciliation
```bash
# Force reconciliation of orphan receipts
pnpm truth:reconcile:last24h

# Or via Railway
railway run --service xBOT "pnpm truth:reconcile:last24h"
```

#### Step 2: Verify Reconciliation Job is Running
```bash
railway logs --service xBOT | grep "RECONCILE" | tail -n 20
```

#### Step 3: Check for DB Save Failures
```bash
railway logs --service xBOT | grep "DB_SAVE_FAIL\|markDecisionPosted" | tail -n 30
```

---

## 🎯 **PRIORITY FIXES**

### **IMMEDIATE (Do Now):**

1. **Fix Browser Pool Overload** (CRITICAL)
   ```bash
   # Reduce browser load temporarily
   railway variables --set "DISABLE_VI_SCRAPE=true" --service xBOT
   
   # Already done:
   # DISABLE_FOLLOWER_BASELINE=true ✅
   # DISABLE_METRICS_JOB=false ✅ (we want metrics)
   ```

2. **Verify Harvester Can Run**
   ```bash
   # After reducing load, check if harvester succeeds
   railway logs --service xBOT | grep "HARVESTER.*Harvested:" | tail -n 10
   
   # Should see: "Harvested: X new viral tweet opportunities" where X > 0
   ```

3. **Check Account Discovery Job**
   ```bash
   # See if it's even registered
   railway logs --service xBOT | grep "DISCOVERY\|discovered_accounts" | tail -n 20
   ```

### **SHORT-TERM (Next 24h):**

1. **Seed Discovery Accounts** (if table is empty)
   - Create manual seed script
   - Add 30 high-quality health accounts
   - Verify accounts appear in table

2. **Run Truth Reconciliation**
   - Fix 15 orphan receipts
   - Verify all posts are saved

3. **Optimize Browser Pool**
   - Review browser operation priorities
   - Give posting & harvesting higher priority
   - Consider increasing capacity (test memory first)

### **MEDIUM-TERM (Next 7 days):**

1. **Increase Posting Rate**
   - Debug why only 2.3/hour instead of 4/hour
   - Adjust job frequencies
   - Ensure enough content is generated

2. **Monitor Harvester Performance**
   - Track opportunity discovery rate
   - Aim for 20-50 opportunities/day
   - Verify quality (>10K followers, >70% confidence)

3. **Split Browser-Heavy Services**
   - Consider separate Railway service for harvesting
   - Dedicated browser pool
   - Won't compete with posting

---

## 📊 **SUCCESS CRITERIA**

### **When ALL 4 systems are working:**

✅ **System 1: Posting Rate**
- 4 posts/hour average (96/day)
- Mix of singles, threads, replies
- Consistent throughout day

✅ **System 2: Tweet Harvester**
- 20-50 opportunities/day
- 10+ high-quality (>10K followers)
- Regular discovery (not all at once)

✅ **System 3: Account Discovery**
- 5-20 new accounts/day
- Diverse follower counts
- Actively harvested from

✅ **System 4: Database Saving**
- Receipts = DB entries (0 truth gap)
- 100% tweet_id capture
- Reconciliation running every 5min

---

## 🚨 **WHAT TO DO RIGHT NOW**

### **Step 1: Fix Browser Pool** (2 minutes)
```bash
cd /Users/jonahtenner/Desktop/xBOT
railway variables --set "DISABLE_VI_SCRAPE=true" --service xBOT
```

### **Step 2: Monitor Harvester** (5 minutes)
```bash
# Wait 5 minutes for next harvester cycle
sleep 300

# Check if harvester succeeded
railway logs --service xBOT | grep "HARVESTER" | tail -n 30
```

### **Step 3: Check Account Discovery** (5 minutes)
```bash
# Look for discovery job in logs
railway logs --service xBOT | grep -i "discovery" | tail -n 30

# Check if discovered_accounts table exists and has data
# Run in Supabase SQL editor:
# SELECT COUNT(*) FROM discovered_accounts;
```

### **Step 4: Run Reconciliation** (2 minutes)
```bash
# Fix 15 orphan receipts
railway run --service xBOT "pnpm truth:reconcile:last24h"
```

### **Step 5: Verify Systems** (10 minutes)
```bash
# Re-run 4 systems audit in 30 minutes
# Should see:
# - Posting rate improving
# - Harvester finding opportunities
# - Discovery finding accounts (if job exists)
# - Truth gap closing (15 → 0)
```

---

## 📈 **EXPECTED TIMELINE**

### **In 30 minutes:**
- Browser pool no longer overloaded
- Harvester successfully completing searches
- Opportunities being discovered (if accounts seeded)

### **In 2 hours:**
- 20-30 new opportunities in pool
- Replies starting to post
- Posting rate increasing toward 4/hour

### **In 24 hours:**
- All 4 systems operational
- 4 posts/hour sustained
- Learning pipeline active
- Growth trajectory on track

---

## 🎯 **BOTTOM LINE**

**The entire system is being choked by browser pool overload.**

**Root cause:** Too many browser operations competing for limited resources.

**Solution:** Reduce non-critical browser operations (VI scrape, follower baseline) to free up capacity for critical operations (posting, harvesting, metrics).

**Once browser pool is healthy, all 4 systems should recover naturally.**

