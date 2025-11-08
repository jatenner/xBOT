# Reply System Status - Nov 8, 2025

## 🎯 DESIRED STATE (What You Want)

- **4 replies posted per hour** consistently
- **Fully autonomous** - no manual intervention
- **Harvest viral tweets** in tiers (500+ likes)
- **Generate & post replies** automatically every 15 minutes

---

## 🔧 HOW THE SYSTEM IS DESIGNED

### **3-Stage Autonomous Pipeline:**

1. **🌾 HARVESTER** (Auto-runs every 2 hours, offset 10min)
   - Job: `mega_viral_harvester`
   - Searches Twitter for viral health tweets (500-100K+ likes)
   - Stores in `reply_opportunities` table
   - **Target:** 50-100 opportunities per run

2. **💬 REPLY GENERATION** (Auto-runs every 30min, offset 1min)
   - Job: `reply_posting` → calls `generateReplies()`
   - Pulls from `reply_opportunities`
   - Generates 5 replies per cycle using OpenAI
   - Queues in `content_metadata` with status='queued'
   - **Expected output:** 2 runs/hour × 5 replies = 10 attempts/hour

3. **🚀 POSTING QUEUE** (Auto-runs every 5min)
   - Job: `posting`
   - Posts queued replies to Twitter
   - Rate limited to 1 reply every 15min
   - **Expected output:** ~4 posted replies/hour

### **Expected Flow:**
```
Harvester (every 2h) → Reply Gen (every 30min) → Posting Queue (every 5min)
     ↓                        ↓                            ↓
50-100 opps              5 queued replies           1 posted reply
                                                    (every 15min)
```

---

## ❌ WHAT'S BROKEN (As of Now)

### **Critical Issue: Harvester Finding 0 Opportunities**

**Symptoms:**
- ✅ Harvester job IS scheduled and running
- ✅ No `__name` JavaScript errors (fix deployed)
- ❌ Finding **0 opportunities** in database
- ❌ Without opportunities → No replies generated
- ❌ Without replies → Nothing to post

**Possible Causes:**
1. **Twitter returned 0 results** - Search queries may not be finding tweets
2. **AI health filtering too strict** - Rejecting all tweets as not health-related
3. **Search parameters too restrictive** - 500+ likes, <12h old may be too narrow
4. **Authentication issue** - Session may not be working properly

---

## ✅ FIXES DEPLOYED (Today)

### **Fix #1: Removed `__name` JavaScript Error**
- **Commit:** 08368539
- **What:** Removed conflicting `__name` function declarations in 4 locations
- **File:** `src/ai/realTwitterDiscovery.ts`
- **Status:** ✅ Deployed (confirmed via admin API)
- **Result:** No more ReferenceError, but still finding 0 tweets

### **Fix #2: Added Harvester to Admin API**
- **Commit:** 1bb3d73f
- **What:** Added manual trigger endpoint for testing
- **Endpoint:** `/admin/jobs/run?name=harvester`
- **Status:** ✅ Deployed and working
- **Result:** Can trigger manually, but still finds 0 opportunities

---

## 🔍 NEXT STEPS TO DIAGNOSE

### **Option 1: Check If Twitter Search is Working**
The harvester searches Twitter with queries like:
```
min_faves:500 -filter:replies lang:en
```

**Possible issues:**
- Twitter's search may require login to see engagement metrics
- Search syntax may have changed
- Rate limiting from Twitter

### **Option 2: Lower the Bar**
Current minimum requirements:
- 500+ likes (FRESH tier)
- Posted in last 12 hours
- Health relevance score 7+/10 from AI

**Suggestion:** Temporarily lower to:
- 100+ likes
- Last 24 hours
- Health score 5+/10

### **Option 3: Check AI Health Filtering**
The harvester uses GPT-4o-mini to score health relevance (0-10).
If AI is scoring everything below threshold, nothing gets stored.

**Suggestion:** Add logging to see:
- How many tweets Twitter returns
- How many pass initial filters
- What AI health scores they get
- Why they're rejected

---

## 🎯 RECOMMENDED IMMEDIATE ACTIONS

1. **Add detailed logging to harvester** to see:
   - How many tweets Twitter returns
   - What health scores AI assigns
   - Why tweets are being rejected

2. **Lower tier thresholds temporarily** to test:
   - Start with 100+ likes instead of 500+
   - Extend time window to 24h
   - Lower health score threshold to 5/10

3. **Verify Twitter authentication** is working:
   - Session may have expired
   - May need to re-authenticate

4. **Check if search is returning results at all:**
   - May need to adjust search strategy
   - Try different search queries
   - Verify Twitter's API/scraping still works

---

## 📊 CURRENT DATABASE STATE

```
Reply Opportunities: 0
Replies Generated: 0
Replies Queued: 0
Replies Posted (24h): 0
```

**System is healthy, but starved for opportunities.**

---

## ⏰ AUTONOMOUS SCHEDULE (All Active)

- ✅ `mega_viral_harvester`: Every 2 hours, offset 10min
- ✅ `reply_posting`: Every 30 min, offset 1min  
- ✅ `posting`: Every 5 min
- ✅ All jobs scheduled and running

**Next automatic harvester run:** Within 2 hours of system restart

---

## 🚨 SUMMARY

**The reply system IS fully autonomous and properly configured.**

**The issue:** Harvester is running but finding 0 opportunities, which starves the entire pipeline.

**Root cause:** Unknown - need more logging to diagnose why Twitter searches return 0 results.

**Next step:** Add detailed logging to harvester to see exactly what's happening during tweet discovery and filtering.

