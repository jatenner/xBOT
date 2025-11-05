# 🚨 Troubleshooting Quick Reference
**Last Updated:** November 5, 2025  
**Purpose:** 1-page guide to diagnose common issues FAST

---

## 🎯 Where to Start

**STEP 1:** Identify the symptom → Find the section below → Follow the checklist

---

## 📊 SYMPTOM: Dashboard Shows 0 Metrics

### **Problem:** Posts/Replies show 0 views, 0 likes, 0 ER

**Quick Checks:**
```bash
# 1. Check if scraper ran recently
railway logs | grep "METRICS_JOB.*complete"

# 2. Check if data is in outcomes table
psql $DATABASE_URL -c "SELECT tweet_id, impressions, likes, retweets FROM outcomes ORDER BY collected_at DESC LIMIT 5;"

# 3. Check if content_metadata has actual_* columns populated
psql $DATABASE_URL -c "SELECT tweet_id, actual_impressions, actual_likes, actual_retweets FROM content_metadata WHERE status='posted' ORDER BY posted_at DESC LIMIT 5;"
```

**Diagnosis:**
- ✅ **Scraper ran, outcomes has data, content_metadata is NULL** → Data sync broken
  - **Fix location:** `src/jobs/metricsScraperJob.ts` (add sync step)
  - **Read:** `docs/SCRAPER_DATA_FLOW_REFERENCE.md` lines 123-146
  
- ✅ **Scraper ran, outcomes has only impressions (likes=0)** → Scraper extraction broken
  - **Fix location:** `src/scrapers/bulletproofTwitterScraper.ts` (update selectors)
  - **Read:** `docs/SCRAPER_DATA_FLOW_REFERENCE.md` lines 206-230
  
- ❌ **Scraper didn't run** → Job scheduling issue
  - **Fix location:** `src/jobs/jobManager.ts`
  - **Check:** `railway logs | grep "metrics_batch"`

**Full Reference:** `docs/SCRAPER_DATA_FLOW_REFERENCE.md`

---

## 🕷️ SYMPTOM: Scraper Timing Out

### **Problem:** Logs show "BROWSER_OP_TIMEOUT" or metrics job fails

**Quick Checks:**
```bash
# 1. Check timeout duration
grep "BROWSER_OP_TIMEOUT" src/browser/BrowserSemaphore.ts

# 2. Check batch size
grep "limit(" src/jobs/metricsScraperJob.ts | head -3

# 3. Check recent failures
railway logs | grep "SCRAPING_FAILED"
```

**Diagnosis:**
- ✅ **Timeout = 240s, batch size = 20** → Too many tweets, not enough time
  - **Fix:** Increase timeout to 480s, reduce batch to 10
  - **Files:** `src/browser/BrowserSemaphore.ts`, `src/jobs/metricsScraperJob.ts`
  
- ✅ **"Invalid metrics extracted"** → Extraction logic broken
  - **Fix:** Check if analytics page selectors are correct
  - **File:** `src/scrapers/bulletproofTwitterScraper.ts` lines 550-650

**Full Reference:** `docs/SCRAPER_DATA_FLOW_REFERENCE.md` lines 270-276

---

## 🗄️ SYMPTOM: Database Error

### **Problem:** "column does not exist", "table not found", "constraint violation"

**Quick Checks:**
```bash
# 1. Check which table is mentioned in error
# Look for table name in error message

# 2. Verify table exists
psql $DATABASE_URL -c "\dt" | grep "table_name"

# 3. Check column exists
psql $DATABASE_URL -c "\d table_name"
```

**Common Issues:**

**"column 'metadata' does not exist"**
- **Cause:** Code trying to insert into deleted/renamed column
- **Fix location:** Search codebase for `metadata:`
- **Reference:** `docs/DATABASE_REFERENCE.md` lines 25-64

**"table 'vi_collected_tweets' does not exist"**
- **Cause:** VI migration not applied
- **Fix:** Apply `supabase/migrations/20251105_visual_intelligence_system.sql`
- **Reference:** `docs/VI_DATA_REFERENCE.md` lines 49-99

**"duplicate key value violates unique constraint"**
- **Cause:** Trying to insert duplicate tweet_id or decision_id
- **Fix:** Add `ON CONFLICT ... DO UPDATE` or check for existing record first
- **Reference:** `docs/DATABASE_REFERENCE.md` lines 150-180

**Full Reference:** `docs/DATABASE_REFERENCE.md`

---

## 🤖 SYMPTOM: VI System Not Collecting Data

### **Problem:** VI dashboard shows 0 accounts, 0 tweets, 0 patterns

**Quick Checks:**
```bash
# 1. Check if VI is enabled
echo $VISUAL_INTELLIGENCE_ENABLED  # Should be "true"

# 2. Check if accounts are seeded
psql $DATABASE_URL -c "SELECT COUNT(*) FROM vi_scrape_targets;"

# 3. Check if scraper ran
railway logs | grep "VI_ACCOUNT_SCRAPING"

# 4. Check if tweets collected
psql $DATABASE_URL -c "SELECT COUNT(*) FROM vi_collected_tweets;"
```

**Diagnosis:**
- ❌ **VISUAL_INTELLIGENCE_ENABLED = false** → Feature disabled
  - **Fix:** Set `VISUAL_INTELLIGENCE_ENABLED=true` in Railway
  
- ❌ **vi_scrape_targets is empty** → Accounts not seeded
  - **Fix:** Auto-seed runs on first `data_collection` job, wait for next run
  - **Manual:** Check `src/jobs/vi-job-extensions.ts` autoSeedIfNeeded()
  
- ❌ **vi_collected_tweets has 0 rows but scraper ran** → Scraping failed
  - **Check logs:** `railway logs | grep "VI_SCRAPER_ERROR"`
  - **Common cause:** Twitter rate limits, browser issues

**Full Reference:** `docs/VI_DATA_REFERENCE.md`

---

## 🔧 SYMPTOM: Posting Works But Wrong Data Stored

### **Problem:** Posts appear on Twitter but database has wrong tweet_id or missing fields

**Quick Checks:**
```bash
# 1. Check latest posted content
psql $DATABASE_URL -c "SELECT decision_id, tweet_id, content, status FROM content_metadata WHERE status='posted' ORDER BY posted_at DESC LIMIT 3;"

# 2. Verify tweet_id format
# Should be: numeric string like "1986152054276984868"
# NOT: URL or short string

# 3. Check for NULL tweet_ids
psql $DATABASE_URL -c "SELECT COUNT(*) FROM content_metadata WHERE status='posted' AND tweet_id IS NULL;"
```

**Diagnosis:**
- ✅ **tweet_id is NULL** → Posting succeeded but ID extraction failed
  - **Fix location:** `src/posting/` (check postReply, postSingle functions)
  - **Look for:** Tweet ID extraction from Twitter response
  
- ✅ **tweet_id has wrong format** → Parsing error
  - **Fix:** Validate extraction regex/logic
  - **Files:** Search for `extractTweetId` or `tweet_id =`

**Full Reference:** `docs/DATABASE_REFERENCE.md` lines 66-70

---

## 📋 Common File Locations

**Scrapers:**
- Main metrics: `src/jobs/metricsScraperJob.ts`
- Core logic: `src/scrapers/bulletproofTwitterScraper.ts`
- VI scraper: `src/intelligence/viAccountScraper.ts`

**Database:**
- Schema docs: `docs/DATABASE_REFERENCE.md`
- Migrations: `supabase/migrations/`
- Client: `src/db/index.ts`

**Jobs:**
- Job manager: `src/jobs/jobManager.ts`
- All jobs: `src/jobs/*.ts`

**Config:**
- Environment: `src/config/env.ts`
- Logging: `src/lib/logger.ts`

---

## 🔍 Debugging Commands

**View Recent Logs:**
```bash
railway logs --tail 100 | grep "ERROR\|FAILED\|❌"
```

**Check Job Health:**
```bash
railway logs | grep "JOB_.*: Completed\|FAILED"
```

**Database Quick Audit:**
```bash
# Count records in key tables
psql $DATABASE_URL -c "
SELECT 
  'content_metadata' as table, COUNT(*) as rows FROM content_metadata
UNION ALL
SELECT 'outcomes', COUNT(*) FROM outcomes
UNION ALL
SELECT 'vi_collected_tweets', COUNT(*) FROM vi_collected_tweets;
"
```

**Find Broken Scrapers:**
```bash
railway logs | grep "SCRAPING_FAILED\|Invalid metrics"
```

---

## 📚 Full Documentation Index

**Quick References:**
1. 👉 **This file** - Fast troubleshooting
2. `docs/SCRAPER_DATA_FLOW_REFERENCE.md` - All scrapers explained
3. `docs/DATABASE_REFERENCE.md` - All tables explained
4. `docs/VI_DATA_REFERENCE.md` - VI system complete reference

**Context Files:**
5. `docs/context.md` - Project overview
6. `docs/constraints.md` - Technical rules
7. `docs/tasks.md` - Priorities

**Infrastructure:**
8. `src/config/env.ts` - Environment validation
9. `src/lib/logger.ts` - Logging system
10. `.github/workflows/ci.yml` - CI checks

---

## 🚀 Last Resort: Nuclear Options

**Scraper completely broken?**
```bash
# 1. Check if browser pool is healthy
railway logs | grep "BROWSER_POOL"

# 2. Restart jobs
# (Railway auto-restarts on deploy, or use Railway dashboard)
```

**Database out of sync?**
```bash
# 1. Manual sync outcomes → content_metadata
psql $DATABASE_URL -c "
UPDATE content_metadata cm
SET 
  actual_impressions = o.impressions,
  actual_likes = o.likes,
  actual_retweets = o.retweets,
  actual_replies = o.replies,
  actual_engagement_rate = o.engagement_rate
FROM outcomes o
WHERE cm.decision_id = o.decision_id
  AND cm.status = 'posted';
"
```

**VI system stuck?**
```bash
# 1. Reset VI tables (DESTRUCTIVE - clears all collected tweets)
psql $DATABASE_URL -c "
TRUNCATE vi_collected_tweets, vi_content_classification, 
         vi_visual_formatting, vi_format_intelligence CASCADE;
"

# 2. Re-seed accounts
# Auto-seeds on next data_collection job run
```

---

## ✅ Success Indicators

**Healthy System:**
```
✅ Dashboard shows real metrics (views, likes, RTs)
✅ Scraper runs every 20 min without errors
✅ VI dashboard shows growing tweet count
✅ Logs show "✅ JOB_*: Completed successfully"
✅ No BROWSER_TIMEOUT or SCRAPING_FAILED errors
```

**Current Status (Nov 5, 2025):**
- ✅ Posting: Working
- ✅ Replies: Working
- ⚠️ Main Metrics Scraper: Fixed (awaiting next run to verify)
- ✅ VI System: Fixed (runs at 7 PM tonight)

