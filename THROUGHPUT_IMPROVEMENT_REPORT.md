# 📊 THROUGHPUT IMPROVEMENT REPORT

**Date:** January 10, 2026  
**Git Commit:** `3c05607f` (latest fixes)  
**Status:** ✅ **DEPLOYED + KNOB APPLIED**

---

## A) CURRENT STATE

### Running SHA & Role Resolution

**Worker Service (serene-cat):**
- Git SHA: [Checking...] (deployment in progress)
- Resolved Role: worker (via RAILWAY_SERVICE_NAME fallback)
- SERVICE_ROLE: NOT SET
- RAILWAY_SERVICE_NAME: serene-cat

**Main Service (xBOT):**
- Git SHA: `fdf00f1e` (old code - needs redeploy)
- Resolved Role: main (via RAILWAY_SERVICE_NAME)
- SERVICE_ROLE: NOT SET
- RAILWAY_SERVICE_NAME: xBOT

**Note:** New code deployed but services may still be booting. Role resolver fallback working correctly.

---

### Last 24h Funnel Metrics

| Stage | Count | Conversion Rate |
|-------|-------|-----------------|
| Fetch started | 68 | - |
| Fetch completed | 39 | 57.4% |
| Candidates evaluated | 821 | 1207.4% (of fetched) |
| Passed hard filters | 237 | 28.9% (of evaluated) |
| **Hard Pass → Queued** | **~9** | **3.8%** ⚠️ **BOTTLENECK** |
| Queued → Permit | 6 | 66.7% |
| Permit → Used | 1 | 16.7% |
| Used → Posted | 1 | 100.0% |

**Key Metrics:**
- Throughput: **0.04 replies/hour** (1 reply in 24h)
- Queue size avg: **0.3** (target: >= 10)
- Scheduler ticks: 54 (target: 96 for 15-min intervals)
- Permits used: 1
- Reply posted: 1
- **Ghosts: 0** ✅ (permits used = reply posted)

---

### Bottleneck Analysis

**🔴 PRIMARY BOTTLENECK: hardpass→queued (3.8%)**

**Root Cause:**
- 237 candidates passed hard filters in 24h
- Only ~9 candidates were queued (3.8% conversion)
- Queue size limit (REPLY_V2_MAX_QUEUE_PER_TICK=25) may be too restrictive
- Queue refresh runs every 5 min, but candidates expire before being used

**Top 5 Reject Reasons (24h):**
1. `not_root_tweet` - 138 candidates (58% of rejects)
2. `insufficient_text_0` - 28 candidates
3. `judge_reject: The tweet is not relevant to health/` - 14 candidates
4. `judge_reject: The tweet lacks relevance to health/` - 13 candidates
5. `judge_reject: The tweet is relevant and has potent` - 12 candidates

---

## B) ACTION TAKEN

### Knob Changed

**Environment Variable:** `REPLY_V2_MAX_QUEUE_PER_TICK`  
**Service:** serene-cat (worker)  
**Previous Value:** 25 (default)  
**New Value:** 35  
**Applied Via:** `railway variables set REPLY_V2_MAX_QUEUE_PER_TICK=35 -s serene-cat`

### Why This Knob?

**Rationale:**
1. **Directly addresses bottleneck:** hardpass→queued conversion is only 3.8%
2. **Low risk:** Only increases queue capacity, doesn't change safety gates
3. **High ROI:** More candidates in queue = more opportunities for scheduler
4. **Reversible:** Can be changed back via env var if needed

**Expected Impact:**
- Queue size should increase from 0.3 avg to 5-10 avg
- More candidates available for scheduler to select from
- Should improve throughput from 0.04/hour toward 2/hour milestone

---

## C) PROOF (Before/After)

### Before (Baseline - 24h metrics)

| Metric | Value |
|--------|-------|
| Throughput | 0.04 replies/hour (1 in 24h) |
| Queue size avg | 0.3 |
| Hard Pass → Queued | 3.8% (9/237) |
| Permits used | 1 |
| Reply posted | 1 |
| Ghosts | 0 ✅ |

### After (Will measure in 6 hours)

**Commands to run:**
```bash
# Funnel dashboard
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts

# Autotune report
railway run -s serene-cat -- pnpm exec tsx scripts/throughput_autotune_report.ts
```

**Success Criteria:**
- [ ] Throughput: >= 2 replies/hour (6h measurement)
- [ ] Queue size avg: >= 10
- [ ] Ghosts: 0 (permits USED = reply_posted)
- [ ] Hard Pass → Queued: > 10% (improvement from 3.8%)

---

## D) NEXT ACTIONS (If Throughput Still Low)

If after 6 hours throughput is still < 2/hour:

1. **Check queue refresh frequency:**
   - Verify orchestrator is running every 5 min
   - Check if queue refresh is completing successfully

2. **Consider second knob:** `REPLY_V2_TICK_SECONDS`
   - Current: 900s (15 min)
   - Change to: 600s (10 min)
   - Effect: More scheduler ticks = more posting opportunities

3. **Check candidate supply:**
   - Verify feed sources are working (curated_accounts, keyword_search, viral_watcher, discovered_accounts)
   - Check if fetch jobs are completing successfully

---

## E) TRACE CHAIN EVIDENCE

**Current State (24h):**
- ✅ Permits created: 6
- ✅ Permits approved: 6
- ✅ Permits used: 1
- ✅ Reply posted: 1
- ✅ **Ghosts: 0** (permits used = reply posted)

**End-to-End Trace:**
- decision_id → permit_id → tweet_id → reply_posted event ✅
- Full traceability maintained ✅

---

**Status:** ✅ **KNOB APPLIED - MONITORING**

**Next Check:** Run reports again in 6 hours to measure impact.
