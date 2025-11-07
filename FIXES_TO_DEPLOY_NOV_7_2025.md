# 🔧 IMMEDIATE FIXES - Deploy Now

## 🚨 TWO CRITICAL FIXES REQUIRED

### Fix #1: Enable Reply System (BLOCKING 6 JOBS!)

**Problem:** Reply system completely broken - harvester not running, no replies going out

**Root Cause:** Missing `ENABLE_REPLIES=true` environment variable

**Fix:** Add to Railway environment variables:
```bash
ENABLE_REPLIES=true
```

**Impact:** Will enable 6 reply-related jobs:
1. mega_viral_harvester (every 2 hours)
2. reply_posting (every 30 min)
3. reply_metrics_scraper (every 30 min)
4. reply_learning (every 2 hours)
5. engagement_calculator (every 24 hours)
6. reply_conversion_tracking (every 90 min)

**Expected Result:**
- Harvester starts finding 150-250 viral health tweets
- Replies start posting at 4 per hour
- Reply metrics and learning systems activate

---

### Fix #2: Increase Posting Rate from 0.6 to 2 per hour

**Problem:** Posting rate set to 0.6/hour (1 post every 90 minutes) instead of 2/hour

**Root Cause:** Config value too low in `src/config/config.ts`

**Fix:** Already applied in code:
```typescript
// src/config/config.ts line 53
MAX_POSTS_PER_HOUR: z.number().default(2), // Changed from 0.6
MAX_DAILY_POSTS: z.number().default(20),   // Increased from 14
```

**Impact:** 
- Posts will go out 2x per hour (every 30 minutes)
- Daily target: 16-20 posts (up from 14)

---

## 📋 DEPLOYMENT STEPS

### Step 1: Update Railway Environment
```bash
# In Railway dashboard, add:
ENABLE_REPLIES=true
```

### Step 2: Deploy Code Changes
```bash
git add src/config/config.ts
git commit -m "fix: increase posting rate to 2/hour and add reply system docs"
git push origin main
```

### Step 3: Monitor Deployment
Wait 2-3 minutes for Railway to redeploy, then check logs:
```bash
railway logs
```

Look for:
```
💬 JOB_MANAGER: Reply jobs ENABLED
🔍 Starting TWEET-FIRST viral search harvesting
[HARVESTER] 🔥 Configured 8 FRESHNESS-OPTIMIZED discovery tiers
```

### Step 4: Verify Reply System (After 2 Hours)
```sql
-- Check reply opportunities are being harvested
SELECT COUNT(*) FROM reply_opportunities;
-- Should see 50-100 opportunities after first harvest

-- Check replies are being posted
SELECT COUNT(*) FROM content_metadata 
WHERE decision_type = 'reply' 
AND posted_at > NOW() - INTERVAL '2 hours';
-- Should see 6-8 replies after 2 hours
```

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify within 2 hours:

- [ ] Railway logs show "Reply jobs ENABLED"
- [ ] Harvester job starts (check for "HARVESTER" in logs)
- [ ] reply_opportunities table fills up (50-250 rows)
- [ ] Replies start posting (4 per hour)
- [ ] Content posts increase to 2 per hour
- [ ] Health check stops warning about "Very few reply opportunities"

---

## 📊 EXPECTED POSTING RATES AFTER FIXES

| Type | Target | Frequency | Daily Total |
|------|--------|-----------|-------------|
| Content Posts | 2/hour | Every 30min | 16-20 |
| Replies | 4/hour | Every 15min | 96 |
| **TOTAL** | **6/hour** | **Every 10min** | **112-116** |

---

## 🔍 TROUBLESHOOTING

### If reply system still doesn't start:
1. Check Railway environment: `railway vars`
2. Verify ENABLE_REPLIES=true is set
3. Check logs for: `flags.replyEnabled: true`
4. Restart deployment if needed

### If posting rate doesn't increase:
1. Check config loaded: Look for "MAX_POSTS_PER_HOUR" in startup logs
2. May need to wait for current rate limit window to reset
3. Monitor posting_queue logs for "Rate limit OK: X/2 posts"

---

## 🎯 SUCCESS CRITERIA

**Within 30 minutes:**
- Reply jobs scheduled ✅
- Harvester starts running ✅

**Within 2 hours:**
- 50+ reply opportunities harvested ✅
- 6-8 replies posted ✅
- 3-4 content posts ✅

**Within 24 hours:**
- 150-250 reply opportunities maintained ✅
- 90-100 replies posted ✅
- 16-20 content posts ✅

---

**Fixes Documented:** November 7, 2025 21:55 UTC  
**Deploy Priority:** CRITICAL - System partially down  
**Deploy Time:** < 5 minutes

