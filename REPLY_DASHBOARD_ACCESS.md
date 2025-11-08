# 🗺️ Reply System Map Dashboard - Access Guide

**Status:** ✅ DEPLOYED (Nov 8, 2025)

---

## 🚀 **Quick Access**

Your new Reply System Map Dashboard is live at:

```
https://xbot-production-844b.up.railway.app/dashboard/map?token=xbot-admin-2025
```

---

## 🎯 **What This Dashboard Shows**

### **Visual Flow Diagram:**

```
1. Reply Harvester [Status Badge]
   ↓
2. Reply Generation [Status Badge]
   ↓
3. Reply Queue [Status Badge]
   ↓
4. Reply Posting [Status Badge]
   ↓
5. Metrics Scraping [Status Badge]
```

### **For Each Component:**

✅ **Real-time Status:**
- 🟢 Green = Healthy
- 🟡 Yellow = Warning
- 🔴 Red = Critical/Broken

✅ **Live Metrics:**
- Opportunities available
- Replies generated/posted
- Expected vs actual performance

✅ **Fix Suggestions:**
- Exact commands to run
- Step-by-step instructions
- What to check next

✅ **Dependency Map:**
- Shows what each component depends on
- Helps trace problems to root cause

---

## 📊 **Current Dashboards Available**

### **Main Dashboards:**
1. `/dashboard` - Redirects to recent activity
2. `/dashboard/recent` - Recent posts feed
3. `/dashboard/posts` - Posts performance
4. `/dashboard/replies` - Reply performance
5. `/dashboard/health` - System health (detailed)
6. **`/dashboard/map` - Reply System Map** ← **NEW!**

### **Advanced Dashboards:**
7. `/dashboard/temporal` - Temporal intelligence
8. `/dashboard/followers` - Follower growth
9. `/dashboard/factors` - Factor analysis
10. `/dashboard/formatting` - Visual intelligence

---

## 🔍 **How to Use the Reply Map**

### **Step 1: Open the Dashboard**
Click or visit:
```
https://xbot-production-844b.up.railway.app/dashboard/map?token=xbot-admin-2025
```

### **Step 2: Check Overall Status**
At the top, you'll see:
- **Big emoji:** ✅ 🚨 ⚠️ shows overall health
- **Summary cards:** Count of critical/warning/healthy components

### **Step 3: Read the Flow**
Follow the numbered steps (1→5):
- Each step shows what's happening
- Status color tells you if it's working
- Metrics show actual numbers

### **Step 4: Fix Broken Components**
If you see 🔴 RED:
- Read the message (tells you what's wrong)
- Look for "HOW TO FIX" box (red box with instructions)
- Run the exact commands shown
- Refresh dashboard after fixing

### **Step 5: Monitor Dependencies**
At bottom of each component:
- "Depends on:" shows what it needs
- If parent is broken, children will be too
- Fix problems from top to bottom

---

## 🎯 **Example: Fixing Broken Harvester**

**What you'll see:**
```
🚨 REPLY SYSTEM: CRITICAL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Reply Harvester [CRITICAL]
   🚨 BROKEN: 0 opportunities available

   Metrics:
   • Available: 0
   • Last 24h: 0
   • Target: 150-250

   🔧 HOW TO FIX:
   1. Run: npx tsx scripts/check-twitter-auth.ts
   2. Check if browser is authenticated
   3. May need to re-login to Twitter

   Depends on: Browser Auth, Twitter Search
```

**What to do:**
1. Open terminal
2. Run: `npx tsx scripts/check-twitter-auth.ts`
3. Follow the diagnosis output
4. Fix the issue (likely auth)
5. Refresh dashboard to verify

---

## 🔄 **Dashboard Features**

### **Auto-Refresh:**
- Refreshes every 60 seconds automatically
- Shows live timestamp at bottom
- Manual refresh button (bottom right)

### **Mobile-Friendly:**
- Works on phone/tablet
- Responsive design
- Touch-friendly buttons

### **Color Coding:**
- 🟢 Green borders = Healthy
- 🟡 Yellow borders = Warning
- 🔴 Red borders = Critical
- Animated pulse on status icon

---

## 🛠️ **Diagnostic Tools Included**

### **Auth Checker:**
```bash
npx tsx scripts/check-twitter-auth.ts
```
- Checks if browser is logged into Twitter
- Tests search functionality
- Shows what selectors are working

### **Harvester Tester:**
```bash
npx tsx scripts/test-harvester-manual.ts
```
- Manually runs harvester
- Shows debug output
- Tests first 2 search tiers for speed

---

## 📋 **Daily Monitoring Workflow**

### **Every Morning (2 minutes):**

1. **Open dashboard:**
   ```
   https://xbot-production-844b.up.railway.app/dashboard/map?token=xbot-admin-2025
   ```

2. **Check top status:**
   - ✅ = All good, nothing to do
   - ⚠️ = Minor issues, monitor
   - 🚨 = Critical, needs immediate fix

3. **If critical:**
   - Read the red "HOW TO FIX" boxes
   - Run the commands shown
   - Refresh to verify fix worked

4. **Bookmark for quick access**

---

## 🎨 **What Each Section Means**

### **1. Reply Harvester**
- **What it does:** Finds viral tweets to reply to
- **Healthy:** Finding 150-250 opportunities
- **Warning:** < 50 opportunities
- **Critical:** 0 opportunities (broken)
- **Fix:** Usually browser authentication issue

### **2. Reply Generation**
- **What it does:** Creates reply content with AI
- **Healthy:** Generating 4 replies/hour
- **Warning:** Slow generation
- **Critical:** No replies generated despite opportunities
- **Fix:** Check OpenAI API, reply job logs

### **3. Reply Queue**
- **What it does:** Queues replies for posting
- **Healthy:** Always has 5-10 replies queued
- **Warning:** Empty queue
- **Critical:** N/A (cascades from generation)
- **Fix:** Fix generation first

### **4. Reply Posting**
- **What it does:** Posts replies to Twitter
- **Healthy:** ~96 replies/day (4/hour)
- **Warning:** < 48 replies/day
- **Critical:** 0 replies posted
- **Fix:** Check browser, posting queue job

### **5. Metrics Scraping**
- **What it does:** Tracks reply performance
- **Healthy:** 70%+ coverage
- **Warning:** < 30% coverage
- **Critical:** No metrics collected
- **Fix:** Check scraper job, browser pool

---

## 🚨 **Common Issues & Fixes**

### **Issue #1: Harvester Finding 0 Opportunities**
**Dashboard shows:**
```
1. Reply Harvester [CRITICAL]
   🚨 BROKEN: 0 opportunities available
```

**Fix:**
```bash
# 1. Check authentication
npx tsx scripts/check-twitter-auth.ts

# 2. If not authenticated:
rm -f storage_state.json
npx tsx scripts/setup-twitter-session.ts

# 3. Verify fix
npx tsx scripts/test-harvester-manual.ts
```

### **Issue #2: Nothing Being Posted**
**Dashboard shows:**
```
4. Reply Posting [CRITICAL]
   🚨 BROKEN: 0 replies in 24h
```

**Fix:**
- Check if harvester is working (step 1)
- If harvester is broken, fix that first
- If harvester is healthy, check posting queue logs

### **Issue #3: Low Opportunities But Working**
**Dashboard shows:**
```
1. Reply Harvester [WARNING]
   ⚠️ LOW: Only 30 opportunities
```

**Fix:**
- System is working but slow
- May need to adjust search criteria
- Check if AI health filter is too strict
- Monitor, may self-correct

---

## 📱 **Bookmark These URLs**

### **Quick Health Check:**
```
https://xbot-production-844b.up.railway.app/dashboard/map?token=xbot-admin-2025
```

### **Detailed System Health:**
```
https://xbot-production-844b.up.railway.app/dashboard/health?token=xbot-admin-2025
```

### **Performance Metrics:**
```
https://xbot-production-844b.up.railway.app/dashboard/posts?token=xbot-admin-2025
```

---

## ✅ **Success Indicators**

**Your reply system is healthy when you see:**

```
✅ REPLY SYSTEM: HEALTHY

Summary:
0 Critical • 0 Warnings • 7 Healthy

1. Reply Harvester ✅
   150-250 opportunities available
   
2. Reply Generation ✅
   4 replies/hour
   
3. Reply Queue ✅
   5-10 replies queued
   
4. Reply Posting ✅
   96 replies/day
   
5. Metrics Scraping ✅
   70%+ coverage
```

---

## 🎉 **You're All Set!**

Your new Reply System Map Dashboard is:
- ✅ Deployed to Railway
- ✅ Auto-updating every 60 seconds
- ✅ Showing real-time health status
- ✅ Providing actionable fix suggestions
- ✅ Ready to use right now

**Bookmark it and check it daily!** 🚀

