# 🚀 Deploy Instructions - Fix Tweet Posting

## **What Was Wrong**

1. **Plan job never ran** - startup errors were silently swallowed
2. **Wrong database tables** - 9 files querying non-existent `content_decisions` table
3. **Over-generation** - generating 4-8 posts/hour but only posting 2/hour

## **What Was Fixed**

### **Code Changes:**
1. ✅ Fixed all database table references (`content_decisions` → `posted_decisions`/`outcomes`)
2. ✅ Added immediate plan job execution on startup
3. ✅ Made job manager errors LOUD and visible
4. ✅ Changed generation rate: 1 post per cycle (was 2)
5. ✅ Fixed TypeScript compilation errors from table changes

### **Build Status:**
```
✅ TypeScript compilation: PASSED
✅ All fixes applied
✅ Ready to deploy
```

## **Deploy Steps**

### **1. Update Railway Environment Variable**
```bash
railway variables --set JOBS_PLAN_INTERVAL_MIN=30
```

**Why:** With 30-minute intervals + 1 post per cycle = exactly 2 posts/hour

Current value is `15` which would generate 4 posts/hour (too many)

### **2. Build and Push**
```bash
npm run build
git add -A
git commit -m "fix: content generation and posting flow for 2 posts/hour"
git push origin main
```

Railway will auto-deploy from main branch.

### **3. Monitor Startup Logs**
Watch for these SUCCESS indicators:
```
✅ JOB_MANAGER: All timers started successfully
🚀 STARTUP: Running immediate plan job to populate queue...
[UNIFIED_PLAN] 🚀 Generating content with UNIFIED ENGINE
[UNIFIED_PLAN] ✅ Generated 1 decisions
[UNIFIED_PLAN] 💾 Storing 1 decisions to database...
✅ STARTUP: Initial plan job completed
```

### **4. Verify Posting (within 30 min)**
```
[POSTING_QUEUE] 📝 Found 1 decisions ready for posting
[POSTING_QUEUE] ✅ Posted 1/1 decisions
```

## **Expected Timeline After Deploy**

```
T+0min:  System starts, generates 1 post immediately
         Post scheduled for T+10min
         
T+10min: Posting job finds ready post, posts to Twitter ✅ (1st post)

T+30min: Plan job runs, generates 1 post
         Post scheduled for T+40min
         
T+40min: Posting job finds ready post, posts to Twitter ✅ (2nd post)

T+60min: Plan job runs, generates 1 post (next hour cycle begins)
```

**Result: Exactly 2 posts per hour** ✅

## **If Errors Occur**

Look for these in logs:
```
❌ FATAL: JOB_MANAGER failed to start: ...
❌ ❌ ❌ JOB MANAGER STARTUP FAILED ❌ ❌ ❌
```

These are now LOUD and visible (not silently hidden).

## **Rollback Plan**

If deploy fails:
```bash
git revert HEAD
git push origin main
```

Railway will auto-deploy previous version.

---

**Ready to Deploy:** YES ✅  
**Breaking Changes:** NO  
**Database Migration Required:** NO (tables already exist)  
**Downtime Expected:** ~30 seconds (Railway restart)

