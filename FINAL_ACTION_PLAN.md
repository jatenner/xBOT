# Reply System V2 Throughput Fix - Final Action Plan

**Date:** January 11, 2026  
**Commit:** `df0cc39a`  
**Status:** ✅ Fix 1 Applied - Monitoring Phase

---

## Executive Summary

**Problem:** Low reply throughput (0.0/hour vs target 4/hour)  
**Root Cause:** Scheduler frequency too low (only 2 ticks in 6h vs expected ~24)  
**Fix Applied:** Increased `REPLY_V2_TICK_SECONDS` from 900 (15min) to 600 (10min)  
**Expected Impact:** Throughput increases from 0.0/hour toward 1-2/hour initially

---

## Diagnosis Results

### 1. Deployments Verified ✅

- **xBOT (main):** Healthy, role=main, SHA=fdf00f1e
- **serene-cat (worker):** Operational (boot logs not visible in recent tail)

### 2. Production Reports Analysis

**Funnel Metrics (24h):**
- Fetch started: 9, completed: 4 (44% completion)
- Candidates evaluated: 156
- Passed hard filters: 78 (50%)
- Passed AI judge: 78 (100%)
- **Queued: 36** ✅
- **Permits approved: 2** ⚠️ **BOTTLENECK**
- Permits used: 1
- Reply posted: 1

**Bottleneck Identified:** queued→permit (5.6% conversion)

**Top 5 Reject Reasons:**
1. `not_root_tweet`: 38 (48%) - Expected, not fixable
2. `judge_reject`: 12 (15%) - Quality filter working
3. `rejected_low_velocity`: 3 (4%) - Expected filter
4. `insufficient_text`: 3 (4%) - Expected filter
5. Various judge_reject: 3 (4%) - Quality filter working

**Analysis:** Reject reasons are mostly expected. Issue is **throughput**, not quality.

### 3. Orchestrator/Memory Status ✅

- ✅ Orchestrator running (logs show cycles completing)
- ✅ No memory skipping/OOM/killed messages
- ✅ Fetch cycles completing successfully
- ⚠️ Fetch completion rate: 44% (some timeouts after 196s)

---

## Root Cause Analysis

**Primary Bottleneck: queued→permit (5.6%)**

**Why:**
1. Scheduler frequency too low: Only 2 ticks in 6h (expected ~24 ticks)
2. Default `REPLY_V2_TICK_SECONDS=900` (15min) not being respected
3. Scheduler creates ONE permit per tick, so low tick frequency = low permit creation

**Secondary Issues:**
- Fetch completion rate: 44% (some fetches timing out)
- Queue supply healthy (36 candidates) but permits not created fast enough

---

## Fix Applied: Step 1

### Change: Increase Scheduler Frequency

**Environment Variable:**
```bash
REPLY_V2_TICK_SECONDS=600  # Changed from 900 (15min) to 600 (10min)
```

**Rationale:**
- Current: 15min interval = 4 ticks/hour max = 4 replies/hour theoretical max
- Proposed: 10min interval = 6 ticks/hour = 6 replies/hour theoretical max
- Directly addresses bottleneck (only 2 ticks in 6h observed)

**Expected Impact:**
- Scheduler runs 50% more frequently
- More permits created per hour
- Throughput increases from 0.0/hour toward 1-2/hour initially

**Risk Assessment:**
- ✅ Low risk - Only changes frequency, doesn't affect safety gates
- ✅ Reversible - Can revert via env var
- ✅ No code changes required

**Command Executed:**
```bash
railway variables --set "REPLY_V2_TICK_SECONDS=600" -s serene-cat
railway redeploy -s serene-cat -y
```

---

## Verification Plan

### Step 1: Wait for Data Collection (2-4 hours) ⏳

After redeploy, wait 2-4 hours for scheduler to run multiple cycles.

### Step 2: Re-run Funnel Dashboard

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

**Success Criteria:**
- ✅ Scheduler ticks >= 6 in 6h (vs current 2)
- ✅ Permits approved >= 6 in 6h (vs current 2)
- ✅ Throughput >= 1 reply/hour (vs current 0.0/hour)
- ✅ Queue size remains healthy (>= 20)

### Step 3: If Throughput Still Low, Apply Fix 2

**Fix 2: Increase Posting Queue Max Items**

```bash
railway variables --set "POSTING_QUEUE_MAX_ITEMS=4" -s serene-cat
railway redeploy -s serene-cat -y
```

**Rationale:**
- Current: 2 items per queue processing cycle
- Proposed: 4 items per cycle
- Allows more permits to be processed per scheduler tick

**Expected Impact:**
- More permits processed per cycle
- Faster permit→used conversion

---

## Expected Outcomes

### After Fix 1 (REPLY_V2_TICK_SECONDS=600)

| Metric | Current (6h) | Expected (6h) | Target |
|--------|--------------|---------------|--------|
| Scheduler ticks | 2 | 6+ | 6+ |
| Permits approved | 2 | 6+ | 6+ |
| Permits used | 0 | 3+ | 4+ |
| Reply posted | 0 | 2-4 | 4+ |
| Throughput | 0.0/hour | 1-2/hour | 2-4/hour |
| Queue size | 36 | 30-40 | >= 20 |

### After Fix 2 (if needed: POSTING_QUEUE_MAX_ITEMS=4)

| Metric | Current (6h) | Expected (6h) | Target |
|--------|--------------|---------------|--------|
| Permits used | 0 | 4+ | 6+ |
| Reply posted | 0 | 3-6 | 4+ |
| Throughput | 0.0/hour | 2-4/hour | 4/hour |

---

## Monitoring Commands

### Check Scheduler Activity

```bash
railway logs -s serene-cat --tail 500 | grep -E "SCHEDULER|reply_v2_scheduler"
```

### Check Permit Creation

```bash
railway logs -s serene-cat --tail 500 | grep -E "permit|PERMIT"
```

### Run Funnel Dashboard

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

### Run Throughput Report

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/throughput_autotune_report.ts
```

### Run Production Report

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_production_report.ts
```

---

## Safety Checks

✅ **Ghost Protection:** No changes to safety gates  
✅ **Permit System:** No changes to permit creation/verification logic  
✅ **Queue Logic:** No changes to candidate selection  
✅ **Reversibility:** All changes via env vars (easily reverted)  
✅ **Zero Code Changes:** Only environment variable adjustments

---

## Next Steps

1. ✅ **DONE:** Applied `REPLY_V2_TICK_SECONDS=600`
2. ✅ **DONE:** Redeployed worker service
3. ⏳ **WAIT:** 2-4 hours for data collection
4. ⏳ **TODO:** Re-run funnel dashboard to verify improvement
5. ⏳ **TODO:** If throughput still < 2/hour, apply Fix 2 (`POSTING_QUEUE_MAX_ITEMS=4`)

---

## Summary

**Single Biggest Bottleneck:** queued→permit (5.6% conversion)  
**Root Cause:** Scheduler frequency too low (2 ticks in 6h vs expected ~24)  
**Fix Applied:** Increased scheduler frequency from 15min to 10min  
**Expected Improvement:** Throughput from 0.0/hour → 1-2/hour initially

**Status:** ✅ Fix 1 applied, monitoring for 2-4 hours before next step.
