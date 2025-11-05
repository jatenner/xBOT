# 📊 Dashboard Metrics Fix - November 5, 2025

## Problem Identified

Your dashboards showed **all zeros** for metrics (VIEWS, LIKES, VIRAL, ER) even though the Twitter scrapers were running.

## Root Cause

**Data Flow Disconnect:**

1. **Dashboard reads from:** `content_metadata` table
   - Columns: `actual_impressions`, `actual_likes`, `actual_retweets`, `actual_engagement_rate`

2. **Scrapers were writing to:** `outcomes`, `learning_posts`, `tweet_metrics` tables
   - **NOT updating `content_metadata` table!**

This created a disconnect where:
- ✅ Scrapers were working (running every 10-30 minutes)
- ✅ Metrics were being collected from Twitter
- ✅ Data was being stored in `outcomes` table
- ❌ **Dashboard couldn't see the data** (reading from different table)

## The Fix

Updated `src/jobs/metricsScraperJob.ts` to also update the `content_metadata` table:

```typescript
// 🔥 NEW: Update content_metadata table (used by dashboard!)
const engagementRate = metrics.views && metrics.views > 0 
  ? ((metrics.likes + metrics.retweets + metrics.replies) / metrics.views) 
  : 0;

const { error: contentMetadataError } = await supabase
  .from('content_metadata')
  .update({
    actual_impressions: metrics.views ?? null,  // Dashboard shows as "VIEWS"
    actual_likes: metrics.likes ?? 0,           // Dashboard shows as "LIKES"
    actual_retweets: metrics.retweets ?? 0,     // Used for viral score
    actual_replies: metrics.replies ?? 0,       // Used for engagement rate
    actual_engagement_rate: engagementRate,     // Dashboard shows as "ER"
    updated_at: new Date().toISOString()
  })
  .eq('decision_id', post.decision_id);
```

## What This Means

**Before Fix:**
- Scrapers run every 10-30 minutes ✅
- Metrics stored in `outcomes` table ✅
- Dashboard shows all zeros ❌

**After Fix:**
- Scrapers run every 10-30 minutes ✅
- Metrics stored in `outcomes` table ✅
- Metrics **ALSO** stored in `content_metadata` table ✅
- Dashboard shows real data ✅

## When Will Metrics Appear?

1. **Deployment:** ~2-3 minutes (deploying now)
2. **First scraper run:** Up to 10 minutes (next scheduled run at :07, :17, :27, :37, :47, :57)
3. **Dashboard refresh:** Immediately after scraper runs

**Timeline:** You should see metrics start populating within **10-15 minutes** of deployment.

## How to Verify

1. Wait for deployment to complete
2. Check Railway logs for: `[METRICS_JOB] ✅ Dashboard data updated`
3. Refresh dashboard - you should see:
   - VIEWS column populated
   - LIKES column populated
   - VIRAL scores calculated
   - ER (Engagement Rate) percentages

## Notes

- **Existing posts:** The scraper will update metrics for posts from the last 3 days on next run
- **New posts:** Will automatically have metrics tracked
- **Both dashboards:** Posts dashboard AND Replies dashboard should both show metrics now
- **Historical data:** Metrics are already in `outcomes` table, just weren't visible in dashboard

## Commit

```
commit 85c73e2f
Fix dashboard metrics - connect scraper to content_metadata table
```

Deployed to Railway at: November 5, 2025, 10:45 AM

