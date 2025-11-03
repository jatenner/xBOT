# 📊 Viral Learning System - Monitoring Guide

## ⏰ Check-In Time: 5-8 Hours After Deploy

**Deploy Time:** November 3, 2025 ~11:30 AM  
**First Check:** November 3, 2025 ~5:00 PM  

---

## 🚀 Quick Check Commands

### 1. Run the Monitor Dashboard
```bash
cd /Users/jonahtenner/Desktop/xBOT
pnpm tsx scripts/monitor-viral-learning.ts
```

This will show you:
- ✅ How many viral tweets scraped
- ✅ What patterns AI learned
- ✅ Your recent post quality
- ✅ System health status

---

## 📋 What You Should See

### **Ideal Scenario (After 5-8 hours):**

```
📊 VIRAL TWEET LIBRARY STATUS:

  Total viral tweets: 90-180
  Added today: 90-180
  Added last 8 hours: 60-120

  ✅ System is learning! (120 patterns collected)
```

### **Expected Pattern Examples:**
```
🧠 LEARNED PATTERNS:

  Hook Types:
    • question_hook: 45 examples
    • contrarian_stat: 32 examples
    • data_lead: 28 examples
    • curiosity_driven: 15 examples
```

### **Your Posts Should Look Like:**
```
📝 RECENT POSTS:

  1. ✅ POSTED (5:23 PM)
     "Research from the Journal of Sexual Medicine shows..."
     
  2. ✅ QUEUED (5:20 PM)
     "Music can boost dopamine, enhancing mood and motivation..."
```

---

## ⚠️ Troubleshooting

### **If No Tweets Scraped (Total: 0)**

**Check Railway Logs:**
```bash
railway logs | grep -i "viral_scraper\|peer_scraper" | tail -50
```

**Look for:**
- ✅ `[VIRAL_SCRAPER_JOB] 🔥 Starting viral tweet collection...`
- ✅ `[VIRAL_SCRAPER_JOB] ✅ Scraped X viral tweets`
- ❌ `Browser timeout` → Browser session needs refresh
- ❌ `Not logged in` → Session expired

**Fix:**
```bash
# If browser session expired, will need to re-authenticate
# (This is rare, session should be stable)
```

### **If Some Tweets Scraped But Low Quality**

**Check the database directly:**
```bash
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE why_it_works IS NOT NULL) as analyzed,
  AVG(pattern_strength) as avg_strength
FROM viral_tweet_library 
WHERE scraped_at > NOW() - INTERVAL '8 hours';
"
```

**Expected:**
- `total`: 60-120 (2-3 cycles at 30 tweets each)
- `analyzed`: Should match `total` (AI analyzed all)
- `avg_strength`: 7.0-9.0 (high quality patterns)

---

## 📊 Database Queries (Manual Check)

### Check Scraper Activity:
```sql
-- Recent viral tweets
SELECT 
  author_handle,
  views,
  engagement_rate,
  hook_type,
  LEFT(why_it_works, 60) as insight
FROM viral_tweet_library 
WHERE scraped_at > NOW() - INTERVAL '8 hours'
ORDER BY engagement_rate DESC
LIMIT 10;
```

### Check Your Post Quality:
```sql
-- Recent posts format quality
SELECT 
  LEFT(content, 100) as preview,
  CASE 
    WHEN content LIKE '%**%' THEN '❌ markdown'
    WHEN content LIKE '%#%' THEN '❌ hashtag'
    WHEN LENGTH(content) > 280 THEN '❌ too long'
    ELSE '✅ clean'
  END as quality,
  created_at
FROM content_metadata 
WHERE created_at > NOW() - INTERVAL '3 hours'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Scraper Schedule:
```bash
# See when next scraper run is scheduled
railway logs | grep "JOB_MANAGER.*viral_scraper" | tail -5
```

---

## 🎯 Success Criteria (5-8 Hours)

### ✅ Minimum Success:
- [ ] At least 60 viral tweets scraped
- [ ] AI analyzed them (has `why_it_works` insights)
- [ ] Recent posts have no markdown/hashtags
- [ ] System shows "⏳ Learning in progress"

### ✅✅ Good Success:
- [ ] 120+ viral tweets scraped
- [ ] Multiple hook types learned (question, contrarian, data-lead)
- [ ] Recent posts look professionally formatted
- [ ] System shows "🚀 Active learning"

### ✅✅✅ Excellent Success:
- [ ] 180+ viral tweets scraped
- [ ] Diverse patterns (5+ hook types)
- [ ] Your tweets are using learned patterns
- [ ] Engagement improving on new posts

---

## 📈 Long-Term Monitoring

### **Day 3 Check:**
- Target: 500+ viral tweets
- Status should show: "✅ Fully operational"

### **Week 1 Check:**
- Target: 800-1000 viral tweets (continuous refresh)
- Compare engagement: Week 1 avg vs Baseline

### **Week 4 Check:**
- Compare engagement: Week 4 avg vs Week 1
- Expected improvement: +30-50%

---

## 🆘 Need Help?

If after 8 hours:
- Zero tweets scraped → Check Railway logs for errors
- Posts still have markdown → Clear queue and wait for fresh generation
- Scraper running but failing → May need browser session refresh

**To manually trigger scraper (testing):**
```bash
# This will attempt to scrape (may fail locally without browser session)
pnpm tsx scripts/scrape-trending-viral.ts --max 5
```

**Note:** Scraper works best on Railway where browser session is authenticated!

---

## ✅ Expected Timeline

```
Hour 0:  Deploy ✅
Hour 3:  First viral scrape (30 tweets)
Hour 7:  Second viral scrape (60 total)
Hour 11: Third viral scrape (90 total)
Day 3:   Hit 500+ tweets (fully trained)
Day 7+:  Continuous learning (steady state)
```

**Run the monitor script now to see current status! 📊**

```bash
pnpm tsx scripts/monitor-viral-learning.ts
```

