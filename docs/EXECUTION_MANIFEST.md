# 🎯 EXECUTION MANIFEST - COMPLETE TODAY

**Start Time:** December 29, 2025  
**Goal:** Self-optimizing reply system shipped and tested  
**Estimated Completion:** 6-8 hours  
**Status:** READY TO EXECUTE

---

## 📋 EXACT FILES TO CHANGE

### **PHASE 1: QUICK WINS (1-2 hours)**

**Files to Create:**
1. `supabase/migrations/20251229_engagement_tiers.sql`

**Files to Modify:**
1. `src/jobs/replyOpportunityHarvester.ts`

**Environment Variables:**
1. `HARVESTER_MAX_SEARCHES_PER_RUN=9` (Railway)

**Expected Output:**
- Migration applied successfully
- Harvester logs show: "Search 1/9: ULTRA-VIRAL (100K+)"
- Database: `reply_opportunities.engagement_tier` populated

---

### **PHASE 2: PERFORMANCE TRACKING (2-3 hours)**

**Files to Create:**
1. `supabase/migrations/20251229_analytics_foundation.sql`
2. `src/analytics/PerformanceAnalyzer.ts`
3. `src/jobs/analyticsJob.ts`
4. `scripts/analytics-report.ts`

**Files to Modify:**
1. `src/jobs/jobManager.ts` (register analyticsJob)
2. `package.json` (add analytics:report script)

**Expected Output:**
- Tables created: `reply_performance_analytics`
- Analytics job registered and running
- CLI command works: `pnpm analytics:report`
- Dashboard shows: Tier | Replies | Avg Followers | ROI

---

### **PHASE 3: FEEDBACK LOOPS (2-3 hours)**

**Files to Create:**
1. `src/intelligence/OpportunityScorer.ts`

**Files to Modify:**
1. `src/jobs/replyOpportunityHarvester.ts` (proven accounts search)
2. `src/jobs/replyJob.ts` (smart generator selection)
3. `src/jobs/replyMetricsScraperJob.ts` (account updates)

**Expected Output:**
- Harvester logs: "Priority search: @bryan_johnson, @hubermanlab"
- Reply logs: "Selected ResearchSynthesizer (3 samples, +14.2 avg followers)"
- Database: `discovered_accounts.avg_followers_per_reply` updated

---

## 🔄 EXECUTION ORDER

```
1. Phase 1 Migration → Apply
2. Phase 1 Code → Deploy → Verify (30 min)
   ├─ Check logs for new search order
   └─ Query database for engagement_tier

3. Phase 2 Schema → Apply
4. Phase 2 Code → Deploy → Verify (30 min)
   ├─ Trigger analytics job manually
   └─ Run CLI report

5. Phase 3 Code → Deploy → Verify (30 min)
   ├─ Check logs for intelligent behavior
   └─ Monitor for 2-4 hours

6. Final Verification
   ├─ Monitor replies in real-time
   ├─ Check learning data in database
   └─ Generate performance report
```

---

## ✅ VERIFICATION CHECKLIST

### **After Phase 1:**
- [ ] Migration applied (check Supabase)
- [ ] Harvester logs show: ULTRA-VIRAL, MEGA-VIRAL searches first
- [ ] Database query: `SELECT engagement_tier, COUNT(*) FROM reply_opportunities GROUP BY engagement_tier;`
- [ ] Expected: At least 20% VIRAL+ tier

### **After Phase 2:**
- [ ] Tables exist: `reply_performance_analytics`
- [ ] Analytics job in logs: `[ANALYTICS] 📊 Starting performance analysis...`
- [ ] CLI report runs: `pnpm analytics:report`
- [ ] Output shows: Tier breakdown with ROI scores

### **After Phase 3:**
- [ ] Harvester searches proven accounts: `[HARVESTER] 🎯 Found X proven performers`
- [ ] Generator selection logs: `[REPLY_JOB] ✅ Selected X (Y samples)`
- [ ] Account updates: `discovered_accounts` has `avg_followers_per_reply > 0`
- [ ] Opportunity scoring: Multi-dimensional scores calculated

### **Final Test (2-4 hours monitoring):**
- [ ] Watch reply posting in real-time
- [ ] Check if replying to higher engagement tweets
- [ ] Verify metrics being collected
- [ ] Run analytics report after 4 hours
- [ ] Confirm learning data accumulating

---

## 🎯 SUCCESS CRITERIA

**Technical Success:**
- ✅ All 3 phases deployed without errors
- ✅ All jobs running (harvester, analytics, reply, metrics)
- ✅ All tables populated with data
- ✅ No rollbacks needed

**Business Success:**
- ✅ Replies targeting 25K+ like tweets (vs 5K+ before)
- ✅ Performance analytics showing tier breakdown
- ✅ System prioritizing proven accounts
- ✅ Learning data accumulating in database

**Proof of Learning:**
- ✅ After 4 hours: `reply_performance_analytics` has rows
- ✅ Top tier identified with confidence score
- ✅ Proven accounts being prioritized in searches
- ✅ Generator selection based on history (if data available)

---

## 🚀 READY TO EXECUTE

All files identified. All changes mapped. All verifications defined.

Starting Phase 1 now.

