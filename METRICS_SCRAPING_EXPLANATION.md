# 📊 Metrics Scraping System Explained

## How It Works

### Job Frequency
- **Runs every 20 minutes**
- Processes up to **20 tweets per run** (configurable via `METRICS_MAX_POSTS_PER_RUN`)

### Priority System (3 Tiers)

**PRIORITY 1: Missing Metrics (Last 7 Days)**
- Up to **15 posts per run**
- Only posts with `actual_impressions = NULL or 0`
- Most aggressive scraping

**PRIORITY 2: Recent Posts (Last 24 Hours)**
- Up to **5 posts per run**
- Scrapes even if they already have metrics (refreshes)
- Ensures fresh data for new posts

**PRIORITY 3: Historical (7-30 Days Old)**
- Up to **3 posts per run**
- Only if missing metrics (`actual_impressions = NULL or 0`)
- Less frequent scraping

### Skip Logic
- If metrics were collected in **last 30 minutes**, skip (unless missing metrics)
- Prevents redundant scraping

## Realistic Expectations

### Scenario: 10,000 Total Tweets, 90 Posted Today

**Today's 90 Tweets:**
- ✅ Scraped every **20-40 minutes** (Priority 2)
- ✅ Refreshed even if they have metrics
- ✅ Should be **GREEN** most of the time

**Last 7 Days (~630 tweets):**
- ✅ Missing metrics scraped aggressively (Priority 1)
- ✅ Up to 15 per run = ~45 per hour = ~1,080 per day
- ✅ All missing metrics should be caught within hours

**7-30 Days Old (~2,000 tweets):**
- ⚠️ Only scraped if missing metrics (Priority 3)
- ⚠️ Up to 3 per run = ~9 per hour = ~216 per day
- ⚠️ May take days to catch all missing metrics

**>30 Days Old (~7,280 tweets):**
- ❌ Not scraped at all
- ❌ Metrics stay as last collected

## Color Coding Logic

### GREEN (Fresh)
- Metrics scraped **< 1 hour ago**
- Expected for: Today's tweets, recent posts

### YELLOW (Acceptable)
- Metrics scraped **1-6 hours ago**
- Expected for: Yesterday's tweets, posts with metrics

### RED (Stale/Missing)
- Metrics scraped **> 6 hours ago** OR **no metrics at all**
- Expected for: Older tweets, posts that failed scraping

## Next Batch Timing

**For Today's Tweets:**
- Next scrape: **20 minutes** from last run
- Should see updates frequently

**For Missing Metrics (Last 7 Days):**
- Next scrape: **20 minutes** from last run
- Up to 15 processed per cycle
- If you have 100 missing, expect ~7 cycles (2.3 hours) to catch all

**For Historical (7-30 Days):**
- Next scrape: **20 minutes** from last run
- Up to 3 processed per cycle
- Much slower to catch all missing metrics

## Dashboard Display

Show for each post/reply:
- **Last Scraped:** Timestamp of `updated_at` from `content_metadata`
- **Color:** Based on time since last scrape
- **Status:** "Fresh", "Acceptable", or "Stale/Missing"

