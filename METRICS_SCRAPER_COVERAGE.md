# 📊 METRICS SCRAPER COVERAGE EXPLAINED

## 🎯 QUESTION: Does metrics scraper scrape 100% of tweets daily?

**Answer:** **NO** - It uses **priority-based selective scraping** with limits per run.

---

## 🔄 HOW IT WORKS

### **Job Runs:** Every 10 minutes
```typescript
// Runs every 10 minutes
// Processes MAX 23 tweets per run (15 + 5 + 3)
```

### **Priority System:**

#### **Priority 1: Missing Metrics (Last 7 Days)** - 15 tweets max
```typescript
// Posts missing metrics (actual_impressions is null or 0)
// Last 7 days
.limit(15)
```

#### **Priority 2: Recent Refresh (Last 24 Hours)** - 5 tweets max
```typescript
// Recent posts that might need refresh
// Even if they have metrics, refresh for accuracy
.limit(5)
```

#### **Priority 3: Historical Missing (7-30 Days Old)** - 3 tweets max
```typescript
// Historical tweets with missing metrics
// Scrape less frequently
.limit(3)
```

---

## 📊 COVERAGE CALCULATION

### **Per Run:**
- Max tweets per run: **23 tweets** (15 + 5 + 3)

### **Per Hour:**
- Runs per hour: **6 runs** (every 10 minutes)
- Max tweets per hour: **138 tweets** (6 × 23)

### **Per Day:**
- Max tweets per day: **3,312 tweets** (24 × 138)

---

## ⚠️ BUT IT'S SELECTIVE, NOT 100%

### **What Gets Scraped:**

1. **Missing Metrics** ✅ (Priority)
   - Tweets with `actual_impressions IS NULL` or `= 0`
   - Last 7 days
   - **15 per run**

2. **Recent Posts** ✅ (Refresh)
   - Last 24 hours
   - Even if they have metrics (for accuracy)
   - **5 per run**

3. **Historical Missing** ✅ (Backfill)
   - 7-30 days old
   - Only if missing metrics
   - **3 per run**

### **What Gets Skipped:**

1. **Old Tweets with Metrics** ❌
   - 30+ days old with existing metrics
   - Not scraped (assumed stable)

2. **Recent Tweets with Metrics** ⚠️
   - Last 24h with metrics: Only 5 refreshed per run
   - Most skipped unless missing

3. **Very Old Tweets** ❌
   - 30+ days old
   - Not scraped at all

---

## 📈 EXAMPLE: 1000 Tweets

**Scenario:** You have 1000 tweets total

### **Day 1:**
- Missing metrics (last 7 days): ~50 tweets
- Recent posts (last 24h): ~10 tweets
- Historical missing (7-30 days): ~100 tweets

**Scraped:** ~138 tweets (priority order)
- First 15 missing metrics
- First 5 recent posts
- First 3 historical missing

**Remaining:** ~862 tweets not scraped yet

### **Day 2:**
- Next 15 missing metrics
- Next 5 recent posts
- Next 3 historical missing

**Scraped:** ~138 more tweets

**Total after 2 days:** ~276 tweets scraped

### **To Scrape All 1000:**
- **Time needed:** ~7-8 days (1000 ÷ 138 = 7.2 days)
- **But:** Only if all tweets are missing metrics
- **Reality:** Most tweets get metrics after first scrape, so only missing ones get re-scraped

---

## ✅ WHY THIS DESIGN?

### **Benefits:**

1. **Efficient** 💪
   - Focuses on tweets that need scraping
   - Doesn't waste time on tweets with existing metrics
   - Prioritizes recent/important tweets

2. **Resource-Friendly** 🛡️
   - Limits browser operations
   - Prevents memory exhaustion
   - Respects Twitter rate limits

3. **Smart Prioritization** 🧠
   - Missing metrics = highest priority
   - Recent posts = refresh for accuracy
   - Historical = backfill when needed

---

## 🎯 SUMMARY

**Does it scrape 100% daily?** ❌ **NO**

**What it does:**
- ✅ Scrapes **missing metrics** aggressively (15 per run)
- ✅ Refreshes **recent posts** (5 per run)
- ✅ Backfills **historical missing** (3 per run)
- ✅ Max **138 tweets/hour** = **3,312 tweets/day**

**For 1000 tweets:**
- Takes **~7-8 days** to scrape all if all are missing metrics
- But most tweets get metrics after first scrape
- Only missing metrics get re-scraped

**This is efficient:** Focuses on what needs scraping, not everything.


