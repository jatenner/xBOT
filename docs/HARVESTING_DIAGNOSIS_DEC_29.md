# 🔍 HARVESTING SYSTEM DIAGNOSIS - Why Only Low-Engagement Tweets?

**Date:** December 29, 2025  
**Issue:** Harvester finding 180 opportunities, but NONE with 5000+ likes  
**Expected:** Should find tweets with 10K, 25K, 50K+ likes

---

## 📊 CURRENT STATE

**Database Check:**
- Total opportunities: 180
- With 5000+ likes: **0** (0%)
- With 1000+ likes: 84 (47%)
- Highest engagement: 4,600 likes

**Top rejected tweets:**
- @bryan_johnson: 4,600 likes (wellness) ❌
- @scarylawyerguy: 4,600 likes ❌
- @mkhammer: 4,400 likes (fitness) ❌

---

## 🚨 ROOT CAUSE ANALYSIS

### **Problem #1: Search Query Ordering**

**File:** `src/jobs/replyOpportunityHarvester.ts` (lines 103-115)

**Search Queries Array:**
```typescript
const searchQueries = [
  // Position 1-4: HEALTH-FOCUSED (500-1K likes)
  { label: 'HEALTH HOT (500+)', minLikes: 500 },
  { label: 'HEALTH VIRAL (1K+)', minLikes: 1000 },
  { label: 'BIOHACK (500+)', minLikes: 500 },
  { label: 'MENTAL HEALTH (500+)', minLikes: 500 },
  
  // Position 5-6: MID-TIER (1K-5K likes)
  { label: 'FRESH (1K+)', minLikes: 1000 },
  { label: 'TRENDING (5K+)', minLikes: 5000 },   // ← Position 6
  
  // Position 7-9: HIGH-ENGAGEMENT (10K+ likes) ← NEVER RUNS!
  { label: 'VIRAL (10K+)', minLikes: 10000 },    // ← Position 7
  { label: 'MEGA (25K+)', minLikes: 25000 },     // ← Position 8
  { label: 'ULTRA (50K+)', minLikes: 50000 }     // ← Position 9
];
```

**Current Limit:** `HARVESTER_MAX_SEARCHES_PER_RUN = 6`

**Result:**
- Searches 1-6 run (mostly 500-1K likes)
- Searches 7-9 **NEVER RUN** (10K+ likes)

---

### **Problem #2: Twitter Search Results Limitation**

**File:** `src/ai/realTwitterDiscovery.ts` (line 632)

```typescript
// Extract up to 50 tweets from search results
for (let i = 0; i < Math.min(tweetElements.length, 50); i++) {
```

**Issue:**
- Twitter's search page initially loads ~20-30 tweets
- System extracts max 50 tweets per search
- High-engagement tweets are RARE (maybe 1-2 per search)
- If not health-related, they get filtered out by AI

---

### **Problem #3: AI Health Filter Pass Rate**

**File:** `src/ai/realTwitterDiscovery.ts` (lines 740-762)

```typescript
// AI filters for health relevance (score >= 6)
const healthOpportunities = opportunities
  .filter((opp, index) => judgments[index].isHealthRelevant);

console.log(`✅ AI filtered: ${healthOpportunities.length}/${opportunities.length} health-relevant`);
```

**Typical Pass Rates:**
- Broad viral tweets: ~10-20% pass health filter
- Health-keyword searches: ~60-80% pass health filter

**Problem:**
- Query #7 (VIRAL 10K+) searches **ALL topics**, not health-specific
- Twitter returns 20-30 tweets total
- AI filters out 80-90% as not health-related
- **Result: 2-3 high-engagement health tweets per search cycle**

---

## 🎯 SOLUTION PATHWAYS

### **Option A: Prioritize High-Engagement Searches** (RECOMMENDED)

**Change search query order to prioritize engagement:**

```typescript
const searchQueries = [
  // RUN THESE FIRST (High engagement)
  { label: 'MEGA (25K+)', minLikes: 25000, query: 'min_faves:25000 -filter:replies lang:en' },
  { label: 'VIRAL (10K+)', minLikes: 10000, query: 'min_faves:10000 -filter:replies lang:en' },
  { label: 'TRENDING (5K+)', minLikes: 5000, query: 'min_faves:5000 -filter:replies lang:en' },
  
  // Then health-focused (for AI filtering)
  { label: 'HEALTH MEGA (10K+)', minLikes: 10000, query: '("health" OR "wellness" OR "fitness") min_faves:10000' },
  { label: 'HEALTH VIRAL (5K+)', minLikes: 5000, query: '("sleep" OR "nutrition" OR "workout") min_faves:5000' },
  { label: 'BIOHACK VIRAL (5K+)', minLikes: 5000, query: '("biohack" OR "longevity" OR "supplement") min_faves:5000' },
  
  // Fallback (lower engagement)
  { label: 'HEALTH HOT (1K+)', minLikes: 1000, query: '("metabolic" OR "cortisol" OR "glucose") min_faves:1000' },
  { label: 'FRESH (500+)', minLikes: 500, query: 'min_faves:500 -filter:replies lang:en' }
];
```

**Impact:**
- Positions 1-3 now search for 25K+, 10K+, 5K+ likes
- Positions 4-6 add health keywords to high-engagement searches
- **Guaranteed to find mega-viral tweets first**

**Expected Result:**
- 50+ opportunities with 5K+ likes
- 10-20 opportunities with 10K+ likes
- 2-5 opportunities with 25K+ likes

---

### **Option B: Increase Search Limit**

**Change:** `HARVESTER_MAX_SEARCHES_PER_RUN` from 6 → 9

**Impact:**
- All 9 queries run (including VIRAL, MEGA, ULTRA)
- More searches = more time (30min → 45min per cycle)
- Still depends on Twitter search results

**Pros:**
- Simple change
- Covers all engagement tiers

**Cons:**
- Longer harvest time
- Doesn't prioritize high-engagement

---

### **Option C: Add Twitter Scroll for More Results**

**Add scrolling to load more tweets:**

```typescript
// In findViralTweetsViaSearch()
// After initial page load, scroll 3-5 times to load more tweets
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
}
```

**Impact:**
- Load 50-100 tweets per search instead of 20-30
- Higher chance of finding mega-viral tweets
- Increases time per search (10s → 20s)

**Pros:**
- More thorough scraping
- Better coverage per query

**Cons:**
- Slower harvesting
- May hit rate limits

---

### **Option D: Targeted Health Account Searches**

**Add health-specific account queries:**

```typescript
// Search tweets FROM known health accounts
{ label: 'HEALTH LEADERS (10K+)', minLikes: 10000, 
  query: '(from:bryan_johnson OR from:hubermanlab OR from:foundmyfitness) min_faves:10000' }
```

**Impact:**
- Guaranteed high-engagement health content
- No AI filtering needed (already health-related)
- Smaller pool but higher quality

---

## 🏆 RECOMMENDED FIX (Combination)

**1. Reorder Searches (Option A)**
   - Move MEGA, VIRAL to positions 1-2
   - Add health-keyword variants at positions 3-4

**2. Increase Limit (Option B)**
   - Change `HARVESTER_MAX_SEARCHES_PER_RUN` from 6 → 9
   - Ensures all tiers run

**3. Add Scrolling (Option C)**
   - Add 3 scrolls per search
   - Load 50-80 tweets instead of 20-30

**Expected Outcome:**
- 100+ opportunities with 5K+ likes
- 20-30 opportunities with 10K+ likes
- 5-10 opportunities with 25K+ likes

---

## 📝 IMPLEMENTATION CHECKLIST

### **Quick Win (5 minutes):**
- [ ] Reorder `searchQueries` array (Option A)
- [ ] Increase `HARVESTER_MAX_SEARCHES_PER_RUN` to 9 (Option B)
- [ ] Deploy and monitor

### **Medium Effort (30 minutes):**
- [ ] Add scrolling logic (Option C)
- [ ] Test on staging
- [ ] Deploy to production

### **Advanced (1 hour):**
- [ ] Add targeted health account searches (Option D)
- [ ] Implement adaptive scrolling (more scrolls for high-engagement queries)
- [ ] Add telemetry to track success rate per tier

---

## 🎯 SUCCESS METRICS

**Before Fix:**
- 0/180 opportunities with 5000+ likes (0%)
- Highest engagement: 4,600 likes

**After Fix (Expected):**
- 100+/200 opportunities with 5000+ likes (50%+)
- 20+/200 opportunities with 10000+ likes (10%+)
- Highest engagement: 50K+ likes

---

## 🔧 FILES TO MODIFY

1. **`src/jobs/replyOpportunityHarvester.ts`**
   - Reorder `searchQueries` array (lines 103-115)
   
2. **Railway Environment Variables**
   - `HARVESTER_MAX_SEARCHES_PER_RUN`: 6 → 9

3. **`src/ai/realTwitterDiscovery.ts`** (optional)
   - Add scrolling in `findViralTweetsViaSearch()` (after line 566)

---

## ⚡ IMMEDIATE ACTION

**The harvester is configured correctly but in the wrong order.**

The system CAN find mega-viral tweets (10K+, 25K+, 50K+) - the queries exist!

They're just not running because they're at positions 7-9 and the limit is 6.

**Fix in 5 minutes:**
1. Reorder search queries (high-engagement first)
2. Increase search limit to 9
3. Deploy

**Result:**
- Your system will start harvesting 25K+ like tweets immediately
- 4 replies/hour to mega-viral content ✅

