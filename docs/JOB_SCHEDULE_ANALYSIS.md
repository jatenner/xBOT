# 📊 Job Schedule Analysis - Current + Proposed VI Jobs

## Current Job Schedule (Existing)

### High Frequency Jobs:
- **posting**: Every 5 min (0 min delay) - CRITICAL
- **metrics_scraper**: Every 20 min (0 min delay)
- **sync_follower**: Every 30 min (32 min delay)
- **reply_posting**: Every 30 min (1 min delay) - if enabled
- **learn**: Every 60 min (45 min delay)
- **account_discovery**: Every 90 min (25 min delay)
- **reply_conversion_tracking**: Every 90 min (95 min delay) - if enabled

### Medium Frequency Jobs:
- **plan**: Every 2 hours (0-2 min delay)
- **attribution**: Every 2 hours (70 min delay)
- **outcomes_real**: Every 2 hours (100 min delay)

### Low Frequency Jobs:
- **viral_scraper**: Every 4 hours (180 min delay)
- **analytics**: Every 6 hours (180 min delay)
- **data_collection**: Every 6 hours (220 min delay)
- **ai_orchestration**: Every 6 hours (200 min delay)
- **peer_scraper**: Every 8 hours (260 min delay)
- **news_scraping**: Every 12 hours (240 min delay)

**Total: ~17 jobs currently**

---

## Proposed VI Jobs (New)

### My Original Plan (TOO AGGRESSIVE):
- VI: Account monitoring - Every 6 hours ❌
- VI: Viral hunter - Every 8 hours ❌  
- VI: Classifier - Every 3 hours ❌
- VI: Visual analyzer - Every 3 hours ❌
- VI: Intelligence builder - Daily ❌
- VI: Account finder - Weekly ❌

**Problem:** Too many frequent jobs, would create conflicts

---

## REVISED VI Job Schedule (CONSERVATIVE)

### Option A: Merge with Existing Jobs (RECOMMENDED)
**Don't add 6 new jobs - merge into existing jobs instead:**

```
1. Account Monitoring → Merge with peer_scraper (runs every 8 hours)
   - peer_scraper already scrapes health accounts
   - Just extend it to scrape VI accounts too
   - No new job needed

2. Classifier + Analyzer → Merge with data_collection (runs every 6 hours)
   - data_collection already processes data
   - Add VI classification step
   - No new job needed

3. Intelligence Builder → Merge with learn job (runs every 60 min)
   - learn job already builds intelligence
   - Add VI intelligence building
   - No new job needed

4. Account Finder → Merge with account_discovery (runs every 90 min)
   - account_discovery already finds accounts
   - Extend to find VI micro-influencers
   - No new job needed
```

**Result: 0 new jobs, extend 4 existing jobs**

---

### Option B: Minimal New Jobs (MODERATE)
**Add only 2 new jobs with long intervals:**

```
1. VI: Account Processing (Every 12 hours at 6am, 6pm)
   - Scrapes accounts
   - Classifies tweets
   - Analyzes patterns
   - Builds intelligence
   - ALL IN ONE JOB (fewer jobs, longer runtime)

2. VI: Account Discovery (Weekly on Sunday 4am)
   - Finds new micro-influencers
   - Runs once per week
```

**Result: 2 new jobs total (manageable)**

---

### Option C: Ultra-Minimal (SAFEST)
**Single job that does everything:**

```
VI: Complete Pipeline (Every 24 hours at 3am)
  - Scrapes all 100 accounts
  - Classifies all new tweets  
  - Analyzes visual patterns
  - Builds intelligence
  - Finds new accounts
  - ONE job, runs once daily during low traffic
```

**Result: 1 new job total (safest, but slower data collection)**

---

## My Recommendation: Option A (Merge with Existing)

**Why:**
- ✅ No new jobs (zero scheduling conflicts)
- ✅ Leverages existing infrastructure
- ✅ More frequent data collection
- ✅ Less complex to maintain

**How:**
```typescript
// src/jobs/peerScraperJob.ts (existing file, extend it)
async function runPeerScraping() {
  // EXISTING: Scrape peer accounts for format learning
  await scrapePeerAccounts();
  
  // NEW: Also scrape VI accounts
  if (process.env.VISUAL_INTELLIGENCE_ENABLED === 'true') {
    await scrapeVIAccounts(); // New function
  }
}

// src/jobs/dataCollectionJob.ts (existing file, extend it)
async function collectData() {
  // EXISTING: Collect comprehensive data
  await collectComprehensiveData();
  
  // NEW: Also classify and analyze VI tweets
  if (process.env.VISUAL_INTELLIGENCE_ENABLED === 'true') {
    await classifyVITweets(); // New function
    await analyzeVIPatterns(); // New function
  }
}
```

**Impact:**
- Existing jobs run slightly longer (adds ~5-10 min)
- But no new jobs to manage
- Less complexity
- Feature flag controlled

