# 📊 Metrics Update Frequency - The Truth

## ❌ Common Misconception
**"Every tweet should be updated every 6 hours"**

## ✅ Reality

### Update Frequency by Tweet Age

**Today's Tweets (Last 24 Hours):**
- ✅ **Updated every 20-40 minutes** (Priority 2)
- ✅ Refreshed even if they already have metrics
- ✅ Should be GREEN most of the time

**Yesterday's Tweets (1-7 Days Old):**
- ⚠️ **Only updated if missing metrics** (Priority 1)
- ⚠️ If they already have metrics, they WON'T be refreshed
- ⚠️ Could stay stale for days/weeks

**Older Tweets (7-30 Days Old):**
- ⚠️ **Only updated if missing metrics** (Priority 3)
- ⚠️ Up to 3 per run = very slow
- ⚠️ If they have metrics, never refreshed

**Very Old Tweets (>30 Days):**
- ❌ **Never updated**
- ❌ Metrics stay as last collected

## Why This Design?

### Skip Logic (Line 153-184)
```typescript
// Skip if we have metrics AND updated recently (last 30 min)
if (hasMetrics && recentlyUpdated) {
  skipped++;
  continue; // Don't scrape again
}
```

**Reason:** Prevents redundant scraping. If a tweet has metrics and was scraped recently, skip it.

### Priority System
1. **Priority 1:** Missing metrics (last 7 days) - up to 15 per run
2. **Priority 2:** Recent posts (last 24h) - up to 5 per run - **ONLY THESE REFRESH**
3. **Priority 3:** Historical (7-30 days) - up to 3 per run - **ONLY IF MISSING**

## Realistic Expectations

### Scenario: 10,000 Total Tweets, 90 Posted Today

**Today's 90 Tweets:**
- ✅ Updated every 20-40 min
- ✅ Always fresh (GREEN)

**Yesterday's ~630 Tweets:**
- ⚠️ If they have metrics: **NOT refreshed** (stays YELLOW/RED)
- ⚠️ If missing metrics: Scraped aggressively (Priority 1)

**7-30 Days Old (~2,000 tweets):**
- ⚠️ If they have metrics: **NOT refreshed** (stays RED)
- ⚠️ If missing metrics: Scraped slowly (Priority 3)

**>30 Days Old (~7,280 tweets):**
- ❌ **Never updated** (stays RED forever)

## The Problem

**Current behavior:**
- Only today's tweets get refreshed regularly
- Older tweets with metrics are NEVER refreshed
- They can be days/weeks old

**What you might want:**
- All tweets refreshed periodically (e.g., every 6 hours)
- Or at least tweets from last 7 days refreshed daily

## Solution Options

### Option 1: Refresh All Recent Tweets Periodically
Modify scraper to refresh tweets from last 7 days every 6 hours, regardless of whether they have metrics.

### Option 2: Staggered Refresh Schedule
- Today's tweets: Every 20 min
- Yesterday's tweets: Every 6 hours
- Last 7 days: Every 24 hours
- Older: Never

### Option 3: Keep Current (Efficient)
- Only scrape what's needed (missing metrics)
- Only refresh today's tweets
- Accept that older tweets stay stale

## Current Behavior Summary

**Will every tweet be updated every 6 hours?**
- ❌ **NO** - Only today's tweets get refreshed regularly
- ❌ Older tweets with metrics are NEVER refreshed
- ✅ Only missing metrics get scraped (Priority 1 & 3)

**Is this a problem?**
- Depends on your needs
- If you want fresh metrics for all recent tweets, yes
- If you only care about today's performance, no

