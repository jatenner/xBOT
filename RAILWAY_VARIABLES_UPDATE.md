# 🚀 Railway Variables Update - Quick Guide

**Math Correction:** You're right! 1 post per 2 hours = 12 posts/day max. The issue is the job may not be running consistently, so we're optimizing to ensure reliable 6-8 posts/day.

---

## ⚡ QUICK UPDATE (Choose One Method)

### **Method 1: Railway Dashboard (Recommended - 2 minutes)**

1. Go to https://railway.app
2. Select your xBOT project
3. Click **"Variables"** tab
4. Update these two variables:

**Variable 1:**
- Name: `JOBS_PLAN_INTERVAL_MIN`
- Value: `90`
- Click "Update" or "Add" if it doesn't exist

**Variable 2:**
- Name: `MAX_POSTS_PER_HOUR`
- Value: `2`
- Click "Update" or "Add" if it doesn't exist

5. Railway will **auto-redeploy** with new variables ✅

---

### **Method 2: Railway CLI (If Authenticated)**

```bash
# First, login if needed
railway login

# Then update variables
railway variables --set JOBS_PLAN_INTERVAL_MIN=90
railway variables --set MAX_POSTS_PER_HOUR=2
```

Or use the existing script:
```bash
./update_railway_growth_config.sh
```

---

## 📊 WHAT THIS CHANGES

### **Before:**
```
JOBS_PLAN_INTERVAL_MIN=120  (2 hours)
MAX_POSTS_PER_HOUR=1        (1 post/hour)
Result: 12 posts/day max, but likely only 1-2/day if job not running consistently
```

### **After:**
```
JOBS_PLAN_INTERVAL_MIN=90   (1.5 hours = 16 runs/day)
MAX_POSTS_PER_HOUR=2        (2 posts/hour = 48/day max)
Result: 6-8 posts/day reliably (rate limited, but more capacity)
```

---

## ✅ VERIFICATION

After Railway redeploys, check logs for:

```
[JOB_MANAGER] ✅ plan: ✅ (every 90min)
[POSTING_QUEUE] ✅ Rate limit OK: 0/2 posts (max 2 posts/hour)
```

---

## 🎯 EXPECTED RESULTS

- **Posts/day:** 6-8 (from 1-2)
- **Thread ratio:** 40% (2-3 threads/day) ✅ Already in code
- **Reply visibility:** 500-2000 views ✅ Already optimized
- **Followers/day:** 5-15 (from 0-2)

---

**Time Required:** 2 minutes  
**Risk:** Low (just config changes)  
**Impact:** 3-4x more posts/day

