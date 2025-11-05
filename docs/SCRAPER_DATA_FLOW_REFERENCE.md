# Scraper & Data Flow Reference
**Last Updated:** November 5, 2025  
**Purpose:** Complete map of ALL scrapers and how data flows through the system

---

## 🎯 The Problem We're Solving

**ISSUE:** Multiple scrapers, multiple tables, data not syncing correctly.

**GOAL:** 
1. Understand EVERY scraper
2. Know which table each writes to
3. Ensure data flows to dashboards correctly

---

## 📊 Complete Scraper Map

### **CATEGORY 1: YOUR Content Metrics (Main System)**

#### **Scraper 1: metricsScraperJob**
- **File:** `src/jobs/metricsScraperJob.ts`
- **Schedule:** Every 10-20 minutes
- **What it scrapes:** YOUR posted tweets (singles + threads + replies)
- **Data source:** Twitter analytics page (requires login)
- **Metrics collected:**
  - ✅ Impressions (views)
  - ⚠️ Likes (currently broken - returns 0)
  - ⚠️ Retweets (currently broken - returns 0)
  - ⚠️ Replies (currently broken - returns 0)
- **Stores in:** `outcomes` table
- **Should sync to:** `content_metadata.actual_*` columns
- **Status:** 🚨 BROKEN - Only getting impressions, not syncing to dashboard

#### **Scraper 2: bulletproofTwitterScraper**
- **File:** `src/scrapers/bulletproofTwitterScraper.ts`
- **What it does:** Helper/utility for metrics scraper
- **Provides:** Robust selectors and retry logic
- **Status:** ✅ Working (used by metricsScraperJob)

#### **Scraper 3: realMetricsScraper**
- **File:** `src/scrapers/realMetricsScraper.ts`
- **What it does:** Alternative metrics scraper
- **Status:** ❓ Unknown if actively used

---

### **CATEGORY 2: Reply Opportunities (Content Discovery)**

#### **Scraper 4: peerScraperJob**
- **File:** `src/jobs/peerScraperJob.ts`
- **Schedule:** Every 8 hours
- **What it scrapes:** Timelines of peer health accounts
- **Purpose:** Find high-engagement tweets to reply to
- **Metrics collected:** Likes, RTs, Replies (for opportunity scoring)
- **Stores in:** `reply_opportunities` table
- **Extended by:** VI account scraping (runVIAccountScraping)
- **Status:** ✅ Working

---

### **CATEGORY 3: Viral Tweet Learning (Content Intelligence)**

#### **Scraper 5: viralScraperJob**
- **File:** `src/jobs/viralScraperJob.ts`
- **Schedule:** Every 4 hours
- **What it scrapes:** Trending/viral health tweets
- **Purpose:** Learn from viral content patterns
- **Stores in:** `viral_tweets_learned` table
- **Status:** ✅ Working

#### **Scraper 6: trendingViralScraper**
- **File:** `src/scraper/trendingViralScraper.ts`
- **What it does:** Helper for viralScraperJob
- **Status:** ✅ Working

---

### **CATEGORY 4: Visual Intelligence (NEW System)**

#### **Scraper 7: viAccountScraper (VI System)**
- **File:** `src/intelligence/viAccountScraper.ts`
- **Schedule:** Every 8 hours (extends peerScraperJob)
- **What it scrapes:** 100 health accounts for format learning
- **Purpose:** Collect thousands of tweets to learn visual patterns
- **Metrics collected:**
  - ✅ Views (REAL from Twitter - fixed today!)
  - ✅ Likes
  - ✅ Retweets
  - ✅ Replies
- **Stores in:** `vi_collected_tweets` table
- **Status:** ✅ FIXED - Ready to collect real data
- **Next run:** ~3 PM today

---

### **CATEGORY 5: Account Discovery**

#### **Scraper 8: accountDiscoveryJob**
- **File:** `src/jobs/accountDiscoveryJob.ts`
- **Schedule:** Every 90 minutes
- **What it scrapes:** Twitter hashtags/networks for new accounts
- **Purpose:** Find new accounts to reply to
- **Stores in:** `reply_pool` table
- **Extended by:** VI micro-influencer discovery
- **Status:** ✅ Working

---

### **CATEGORY 6: System Health**

#### **Scraper 9: followerCountTracker**
- **File:** `src/tracking/followerCountTracker.ts`
- **What it scrapes:** YOUR follower count
- **Stores in:** `follower_snapshots` table
- **Status:** ✅ Working

---

## 🗄️ Database Tables & Data Flow

### **YOUR Content Flow (BROKEN ❌)**

```
STEP 1: Posting
├─ content_metadata table
├─ Columns: decision_id, tweet_id, content, status
└─ Status after posting: tweet_id populated ✅

STEP 2: Metrics Scraping (metricsScraperJob)
├─ Reads: content_metadata (where status = 'posted')
├─ Scrapes: Twitter analytics page
├─ Stores in: outcomes table
└─ Status: Only impressions scraped, likes/RTs/replies = 0 ❌

STEP 3: Data Sync (MISSING! ❌)
├─ Should sync: outcomes → content_metadata.actual_*
├─ Currently: NOT HAPPENING
└─ Result: Dashboard shows empty metrics ❌

STEP 4: Dashboard Display
├─ Reads: content_metadata.actual_*
├─ Shows: NULL (because sync isn't working)
└─ Result: No metrics visible ❌
```

**Tables involved:**
- `content_metadata` - Your posted content (actual_impressions, actual_likes, etc.)
- `outcomes` - Scraped metrics (impressions, likes, retweets, replies)
- `tweet_metrics` - Alternative metrics storage (legacy?)

---

### **VI Content Flow (WORKING ✅)**

```
STEP 1: Account Seeding
├─ vi_scrape_targets table
├─ 100 accounts auto-seeded
└─ Status: ✅ Complete

STEP 2: Tweet Scraping (viAccountScraper)
├─ Reads: vi_scrape_targets
├─ Scrapes: Twitter timelines
├─ Stores in: vi_collected_tweets
└─ Status: ✅ Ready (fixed today, runs at 3 PM)

STEP 3: Classification (viProcessor)
├─ Reads: vi_collected_tweets (where classified = false)
├─ Uses: OpenAI to classify topic/angle/tone
├─ Stores in: vi_content_classification
└─ Status: ✅ Ready (runs every 6h)

STEP 4: Visual Analysis (viProcessor)
├─ Reads: vi_collected_tweets (where analyzed = false)
├─ Extracts: Emojis, line breaks, hooks, etc.
├─ Stores in: vi_visual_formatting
└─ Status: ✅ Ready (runs every 6h)

STEP 5: Intelligence Building (viProcessor)
├─ Reads: vi_content_classification + vi_visual_formatting
├─ Aggregates: Tier-weighted patterns
├─ Stores in: vi_format_intelligence
└─ Status: ✅ Ready (automatic)

STEP 6: Dashboard Display
├─ Reads: All vi_* tables
├─ Shows: Real-time data
└─ Status: ✅ Working
```

**Tables involved (all independent, no conflicts):**
- `vi_scrape_targets`
- `vi_collected_tweets`
- `vi_content_classification`
- `vi_visual_formatting`
- `vi_format_intelligence`
- `vi_viral_unknowns`

---

## 🚨 BROKEN: YOUR Content Metrics

### **Problem 1: Scraper Only Getting Impressions**
**Location:** `src/jobs/metricsScraperJob.ts` → `src/metrics/scrapingOrchestrator.ts` → `src/scrapers/bulletproofTwitterScraper.ts`

**Expected:**
```javascript
{
  impressions: 10700,
  likes: 33,
  retweets: 5,
  replies: 2
}
```

**Actual:**
```javascript
{
  impressions: 17,
  likes: 0,  // ❌ BROKEN
  retweets: 0,  // ❌ BROKEN
  replies: 0  // ❌ BROKEN
}
```

**Root cause:** Scraper selectors are failing to find likes/RTs/replies on Twitter

---

### **Problem 2: Data Not Syncing to Dashboard**
**Location:** Missing sync process from `outcomes` → `content_metadata`

**Current:**
```
outcomes table: HAS impressions (17, 30, 41, 47, 57)
content_metadata.actual_impressions: NULL ❌
```

**Expected:**
```
outcomes table: HAS all metrics
content_metadata.actual_*: SYNCED ✅
Dashboard: SHOWS metrics ✅
```

**Root cause:** No automated sync process exists

---

## ✅ WORKING: VI System

### **Data Flow (Complete)**
```
1. Seed 100 accounts → vi_scrape_targets ✅
2. Scrape timelines → vi_collected_tweets ✅
3. AI classification → vi_content_classification ✅
4. Visual analysis → vi_visual_formatting ✅
5. Build intelligence → vi_format_intelligence ✅
6. Display on dashboard → /dashboard/formatting ✅
```

**Status:** All tables clean, scraper fixed, ready to collect real data

---

## 🛠️ Fixes Needed

### **Fix 1: Metrics Scraper (High Priority)**
**Problem:** Only getting impressions, not likes/RTs/replies
**Files to check:**
- `src/scrapers/bulletproofTwitterScraper.ts` (selector logic)
- `src/metrics/scrapingOrchestrator.ts` (orchestration)
**Solution:** Update selectors to match current Twitter DOM

### **Fix 2: Data Sync (High Priority)**
**Problem:** outcomes table → content_metadata not syncing
**Files to check:**
- `src/jobs/metricsScraperJob.ts` (should sync after scraping)
- Look for sync/update logic
**Solution:** Add sync step after metrics collection

### **Fix 3: Engagement Rate Calculation**
**Problem:** All ER = 0.00%
**Depends on:** Fix 1 + Fix 2
**Formula:** `(likes + RTs + replies) / impressions`

---

## 📋 For Future PRs

**When adding new scraper:**
1. ✅ Document in this file (which table it writes to)
2. ✅ Ensure no table conflicts
3. ✅ Add sync process if needed for dashboards
4. ✅ Test data flow end-to-end

**When modifying existing scraper:**
1. ✅ Check if other scrapers depend on it
2. ✅ Verify data still flows to dashboards
3. ✅ Update this doc if table schema changes

**Current Scraper Status:**
- ✅ VI System: Clean, fixed, ready
- ❌ Main Metrics: Broken (partial data, no sync)
- ✅ Viral Scraper: Working
- ✅ Peer Scraper: Working
- ✅ Account Discovery: Working

