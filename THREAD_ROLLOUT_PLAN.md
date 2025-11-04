# 🧵 THREAD GRADUAL ROLLOUT PLAN

**Date:** November 4th, 2025  
**Status:** Phase 1 Activated

---

## 📅 ROLLOUT SCHEDULE

### **Phase 1: Initial Testing** (Week 1 - Nov 4-10)
```
THREAD_PERCENTAGE=5
Expected: ~2-3 threads/day out of 40-48 posts
Monitoring: Success rate, ID extraction, formatting
```

### **Phase 2: Increase** (Week 2 - Nov 11-17)
```
THREAD_PERCENTAGE=10
Expected: ~4-5 threads/day
Validation: Compare thread vs single engagement
```

### **Phase 3: Target** (Week 3 - Nov 18-24)
```
THREAD_PERCENTAGE=15
Expected: ~7 threads/day (target achieved)
Monitoring: Sustained performance
```

---

## 📊 MONITORING CHECKLIST

### **Daily Checks:**
- [ ] Thread success rate >90%
- [ ] Tweet IDs extracted successfully
- [ ] No broken thread chains
- [ ] Formatting correct (no labels/numbers)

### **Weekly Analysis:**
```sql
-- Compare thread vs single performance
SELECT 
  decision_type,
  COUNT(*) as posts,
  AVG(likes) as avg_likes,
  AVG(retweets) as avg_retweets,
  AVG(engagement_rate) as avg_er
FROM posted_decisions
WHERE posted_at >= NOW() - INTERVAL '7 days'
GROUP BY decision_type;
```

---

## 🚨 ROLLBACK TRIGGERS

If any of these occur, reduce THREAD_PERCENTAGE:

1. Thread success rate <80%
2. Broken thread chains >10%
3. ID extraction failures >20%
4. User reports formatting issues

**Rollback command:**
```bash
railway variables --set THREAD_PERCENTAGE=0
```

---

## ✅ SUCCESS CRITERIA

Phase 1 succeeds if (after 7 days):
- ✅ 15+ threads posted successfully
- ✅ Success rate >90%
- ✅ No critical errors
- ✅ Thread engagement >= single engagement

Phase 2 succeeds if (after 7 days):
- ✅ 30+ threads posted successfully
- ✅ Success rate >90%
- ✅ Thread engagement improving

Phase 3 succeeds if (sustained):
- ✅ ~50 threads/month (7/day × 7 days)
- ✅ Consistent performance
- ✅ Learning system has thread data

---

**Current Status:** Phase 1 Active (5% threads enabled)

