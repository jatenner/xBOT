# 📊 DEPLOYMENT MONITORING GUIDE

**Deployment:** November 4th, 2025  
**Changes:** All 3 tiers of content system improvements  
**Commit:** 1bb90e6c

---

## ✅ WHAT WAS DEPLOYED

### **Critical Fixes:**
1. ✅ Generator length validation (11 generators)
2. ✅ Meta-awareness schema fix
3. ✅ Reply error logging enhancement
4. ✅ System health endpoint

### **Performance:**
5. ✅ Generator performance tracking
6. ✅ Viral format AI analysis
7. ✅ Job consolidation (archived unused files)

### **Quality:**
8. ✅ Threads re-enabled at 5%
9. ✅ Error aggregation system
10. ✅ Migration cleanup (99→52 files)

---

## 🔍 MONITORING CHECKLIST

### **First 30 Minutes:**
```bash
# 1. Check deployment succeeded
railway logs --tail 50 | grep "DEPLOYMENT\|ERROR"

# 2. Verify health endpoint
railway run curl http://localhost:8080/health/system

# 3. Check for length errors (should be 0)
railway logs --tail 100 | grep "Content too long"

# 4. Verify generators loading
railway logs | grep "Generator.*updated\|Generator.*loaded"
```

**Expected:**
- ✅ No "Content too long" errors
- ✅ Health endpoint returns 200 OK
- ✅ Generators successfully loaded

---

### **First 2 Hours:**
```bash
# 1. Check post generation
railway logs | grep "UNIFIED_PLAN.*Generated" | tail -10

# 2. Verify success rate
railway run curl http://localhost:8080/health/system | grep success_rate

# 3. Monitor for threads (5% = occasional)
railway logs | grep "🧵 THREAD"

# 4. Check error aggregator
railway logs | grep "ERROR_SUMMARY"
```

**Expected:**
- ✅ 2-4 posts generated
- ✅ Success rate >75%
- ✅ Possibly 1 thread (5% chance)
- ✅ No high-frequency errors

---

### **First 24 Hours:**
```bash
# Full health check
railway run curl http://localhost:8080/health/system

# Generator performance
railway logs | grep "GENERATOR_STATS" | tail -20

# Thread count
railway logs | grep "🧵 THREAD" | wc -l

# Error summary
railway logs | grep "ERROR_SUMMARY" | tail -1
```

**Expected:**
- ✅ 30-40 posts successfully posted
- ✅ 1-3 threads (5% of 30-40 = 1.5-2)
- ✅ 0 length-related errors
- ✅ Success rate 80-90%
- ✅ Generator stats showing balanced usage

---

## 📈 SUCCESS METRICS

### **Day 1 Targets:**
| Metric | Target | How to Check |
|--------|--------|--------------|
| Posts | 30-40 | `/health/system` → metrics.posts_today |
| Success Rate | >80% | `/health/system` → metrics.success_rate_percent |
| Threads | 1-3 | `railway logs \| grep "🧵" \| wc -l` |
| Length Errors | 0 | `railway logs \| grep "too long"` |
| Generator Failures | <10% | `railway logs \| grep "GENERATOR_STATS"` |

### **Week 1 Targets:**
| Metric | Target | How to Check |
|--------|--------|--------------|
| Posts | 250-300 | Database query |
| Success Rate | >85% | `/health/system` |
| Threads | 12-20 | Database count |
| System Health | Green | `/health/system` → status |

---

## 🚨 ALERT CONDITIONS

### **Critical (Fix Immediately):**
- ❌ Success rate <50%
- ❌ Queue empty for >2 hours
- ❌ Same error >50 times/hour
- ❌ Threads 100% failing

**Action:** Check Railway logs, review recent changes, consider rollback

### **Warning (Monitor Closely):**
- ⚠️ Success rate 50-75%
- ⚠️ Queue depth <5 items
- ⚠️ Same error 10-20 times/hour
- ⚠️ Threads 50-75% failing

**Action:** Review logs, prepare fixes if trend continues

### **Normal (All Good):**
- ✅ Success rate >75%
- ✅ Queue depth 10-20 items
- ✅ Errors <10/hour
- ✅ Threads >75% succeeding

---

## 🔧 TROUBLESHOOTING

### **If length errors persist:**
```bash
# Check which generator is failing
railway logs | grep "Content too long"

# Reduce tokens further for that generator
# (already reduced to 120, could go to 100)
```

### **If threads fail completely:**
```bash
# Disable threads immediately
railway variables --set THREAD_PERCENTAGE=0

# Review thread posting logs
railway logs | grep "THREAD_COMPOSER\|BulletproofThread"

# Check ID extraction
railway logs | grep "ID extraction"
```

### **If success rate doesn't improve:**
```bash
# Check generator performance
railway run curl http://localhost:8080/health/system

# Review error categories
railway logs | grep "ERROR_SUMMARY"

# Check for new error patterns
railway logs | grep "❌" | tail -50
```

---

## 📞 HEALTH CHECK COMMANDS

```bash
# Quick status
railway run curl http://localhost:8080/health

# Detailed system health
railway run curl http://localhost:8080/health/system

# Generator performance
railway logs | grep "GENERATOR_STATS"

# Recent errors
railway logs | grep "ERROR_SUMMARY"

# Today's posts
railway logs | grep "posts_today"

# Thread activity
railway logs | grep "🧵"
```

---

## 🎯 ROLLBACK PLAN

If critical issues occur:

```bash
# Option 1: Revert last commit
git revert 1bb90e6c
git push origin main

# Option 2: Disable specific features
railway variables --set THREAD_PERCENTAGE=0  # Disable threads
# (generators already deployed, can't easily revert)

# Option 3: Full rollback to previous commit
git reset --hard HEAD~1
git push -f origin main  # (only if critical!)
```

---

## ✅ EXPECTED DEPLOYMENT TIMELINE

```
00:00 - Commit pushed to GitHub
00:02 - Railway detects change, starts build
00:05 - TypeScript compilation complete
00:07 - Docker image built
00:08 - New version deployed
00:09 - Health checks pass
00:10 - System fully operational

First post: ~00:15-00:30 (depending on schedule)
First thread: Within 24 hours (5% chance per post)
Full data: 24 hours of operation
```

---

## 📊 MONITORING DASHBOARD

**Access:** `/health/system`

**Key Fields:**
```json
{
  "status": "healthy|degraded|critical",
  "metrics": {
    "posts_today": 32,
    "posts_target": 48,
    "success_rate_percent": 85.4,
    "queue_depth": 12,
    "threads_today": 2
  },
  "generation": {
    "calls_total": 40,
    "calls_successful": 35,
    "calls_failed": 5,
    "failure_rate_percent": 12.5
  },
  "alerts": []
}
```

---

## 🎯 NEXT REVIEW

**Date:** November 7th, 2025 (72 hours post-deployment)

**Review Checklist:**
- [ ] Review 3-day metrics
- [ ] Analyze generator performance data
- [ ] Check thread success rate
- [ ] Review error trends
- [ ] Decide on thread percentage increase (5%→10%)

---

**Deployment Status:** ✅ Pushed to Railway  
**Monitoring:** Active  
**Expected Result:** 85-95% success rate, 0% length errors, 5% threads

