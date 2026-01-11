# Reply System V2 Throughput Diagnosis

**Date:** January 11, 2026  
**Analysis Period:** Last 6h and 24h

---

## Current State

### Deployments Verified
- ✅ xBOT (main): Healthy, role=main, SHA=fdf00f1e
- ⚠️ serene-cat (worker): Boot logs not visible in recent tail (service operational)

### Funnel Metrics (24h)

| Stage | Count | Conversion Rate |
|-------|-------|-----------------|
| Fetch started | 9 | - |
| Fetch completed | 4 | 44% |
| Candidates evaluated | 156 | 1733% (of fetched) |
| Passed hard filters | 78 | 50% |
| Passed AI judge | 78 | 100% |
| **Queued** | **36** | **46.2%** |
| **Permits approved** | **2** | **5.6%** ⚠️ BOTTLENECK |
| Permits used | 1 | 50% |
| Reply posted | 1 | 100% |

### Key Issues Identified

1. **🔴 CRITICAL BOTTLENECK: queued→permit (5.6%)**
   - 36 candidates queued but only 2 permits created
   - Scheduler is not creating permits fast enough

2. **⚠️ Low Scheduler Frequency**
   - Only 2 scheduler ticks in 6h
   - Expected: ~24 ticks (if 15min interval)
   - Actual: ~1 tick per 3 hours

3. **⚠️ Low Fetch Completion Rate**
   - 44% completion rate (4/9 fetches)
   - Average fetch duration: 196s (3+ minutes)

4. **Top Reject Reasons (Fixable)**
   - `not_root_tweet`: 38 (48% of rejects) - Expected, not fixable
   - `judge_reject`: 12 (15%) - Quality filter working
   - `rejected_low_velocity`: 3 (4%) - Expected filter
   - `insufficient_text`: 3 (4%) - Expected filter

### Current Environment Variables

- `REPLY_V2_TICK_SECONDS`: **NOT SET** (default: 900 = 15min)
- `POSTING_QUEUE_MAX_ITEMS`: **NOT SET** (default: 2)
- `REPLY_V2_MAX_QUEUE_PER_TICK`: **NOT SET** (default: 25)

---

## Root Cause Analysis

### Bottleneck: queued→permit (5.6%)

**Why only 2 permits from 36 queued candidates?**

1. **Scheduler frequency too low:**
   - Default: 15min interval
   - Only 2 ticks in 6h = ~1 tick per 3 hours
   - Scheduler may be skipping runs or not scheduled correctly

2. **Permit creation logic:**
   - Scheduler creates ONE permit per tick
   - With 2 ticks in 6h, only 2 permits possible
   - Need more frequent ticks OR multiple permits per tick

3. **Queue size healthy:**
   - 36 candidates queued (good supply)
   - But permits not being created fast enough

---

## Recommended Fixes (Priority Order)

### Fix 1: Increase Scheduler Frequency (HIGHEST PRIORITY)

**Action:** Set `REPLY_V2_TICK_SECONDS=600` (10 minutes)

**Rationale:**
- Current: 15min = 4 ticks/hour = 4 replies/hour max
- Proposed: 10min = 6 ticks/hour = 6 replies/hour max
- This directly addresses the bottleneck (only 2 ticks in 6h)

**Expected Impact:**
- Scheduler runs 50% more frequently
- More permits created per hour
- Throughput increases from 0.0/hour toward 2-4/hour

**Risk:** Low - Only changes frequency, doesn't affect safety gates

---

### Fix 2: Increase Posting Queue Max Items (MEDIUM PRIORITY)

**Action:** Set `POSTING_QUEUE_MAX_ITEMS=4`

**Rationale:**
- Current: 2 items per queue processing cycle
- Proposed: 4 items per cycle
- Allows more permits to be processed per scheduler tick

**Expected Impact:**
- More permits processed per cycle
- Faster permit→used conversion

**Risk:** Low - Only increases processing batch size

---

### Fix 3: Monitor and Adjust (LOW PRIORITY)

**Action:** After Fix 1, monitor for 2-4 hours, then consider:
- Further reduce `REPLY_V2_TICK_SECONDS` to 450 (7.5min) if throughput still low
- Increase `REPLY_V2_MAX_QUEUE_PER_TICK` if queue size drops below 10

---

## Implementation Plan

### Step 1: Apply Fix 1 (Scheduler Frequency)

```bash
railway variables set REPLY_V2_TICK_SECONDS=600 -s serene-cat
railway redeploy -s serene-cat -y
```

**Wait:** 2-4 hours for data collection

### Step 2: Verify Improvement

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

**Success Criteria:**
- Scheduler ticks >= 6 in 6h (vs current 2)
- Permits approved >= 6 in 6h (vs current 2)
- Throughput >= 1 reply/hour

### Step 3: Apply Fix 2 (If Needed)

If throughput still < 2/hour after Fix 1:

```bash
railway variables set POSTING_QUEUE_MAX_ITEMS=4 -s serene-cat
railway redeploy -s serene-cat -y
```

---

## Expected Outcomes

### After Fix 1 (REPLY_V2_TICK_SECONDS=600)

| Metric | Current (6h) | Expected (6h) |
|--------|--------------|---------------|
| Scheduler ticks | 2 | 6+ |
| Permits approved | 2 | 6+ |
| Throughput | 0.0/hour | 1-2/hour |
| Queue size | 36 | 30-40 |

### After Fix 2 (POSTING_QUEUE_MAX_ITEMS=4)

| Metric | Current (6h) | Expected (6h) |
|--------|--------------|---------------|
| Permits used | 0 | 4+ |
| Reply posted | 0 | 2-4 |
| Throughput | 0.0/hour | 2-4/hour |

---

## Safety Checks

✅ **Ghost Protection:** No changes to safety gates  
✅ **Permit System:** No changes to permit creation/verification  
✅ **Queue Logic:** No changes to candidate selection  
✅ **Reversibility:** All changes via env vars (easily reverted)

---

**Next Steps:** Apply Fix 1 and monitor for 2-4 hours before proceeding.
