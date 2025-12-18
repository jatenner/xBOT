# Signals Verification Report

**Date:** December 17, 2025  
**Purpose:** Verify recovery and success signals are working in production

---

## 1) Deployment Confirmed

**Status:** [YES/NO]

**Evidence:**
- [ ] `[BOOT] commit=<sha>` line found in logs (if present)
- [ ] `[BROWSER_POOL][DEBUG] caught_error` logs appear
- [ ] `[BROWSER_POOL][RECOVER]` logs appear (if disconnect errors occur)
- [ ] `[POSTING_QUEUE][SUCCESS]` logs appear (if posts succeed)

**Log Evidence:**
```
[Paste relevant log lines here]
```

---

## 2) Recovery Triggered

**Status:** [YES/NO]

**Evidence Lines:**
```
[Paste [BROWSER_POOL][RECOVER] log lines here]
```

**Debug Evidence:**
```
[Paste [BROWSER_POOL][DEBUG] log lines here]
```

**Analysis:**
- Disconnect errors detected: [YES/NO]
- Recovery pattern matched: [YES/NO]
- Pool reset occurred: [YES/NO]
- Retry attempted: [YES/NO]

---

## 3) Posting Success Confirmed

**Status:** [YES/NO]

**Evidence Lines:**
```
[Paste [POSTING_QUEUE][SUCCESS] log lines here]
```

**Analysis:**
- Success logs include decision_id: [YES/NO]
- Success logs include tweet_id: [YES/NO]
- Success logs include url: [YES/NO]
- Success logs include type (single/thread/reply): [YES/NO]

**Count:**
- Total success logs found: [N]
- Time range: [start time] to [end time]

---

## 4) Are "Posted X/Y" Summaries Truthful?

**Status:** [YES/NO]

**Reasoning:**
- [ ] Success logs appear for each "Posted X/Y" increment
- [ ] Success logs only appear after DB save succeeds
- [ ] Summary count matches success log count (approximately)
- [ ] No "Posted X/Y" without corresponding success logs

**Evidence:**
```
[Paste "Posted X/Y" summary lines and corresponding success logs]
```

---

## 5) One Next Fix Only (if NOT GREEN)

**Current State:** [GREEN/YELLOW/RED]

**Issue:**
[Describe the single most critical issue if not GREEN]

**Fix:**
[Describe the ONE code/config change needed]

**File:** [file path]
**Function:** [function name]
**Change:** [exact change needed]

---

## Pass/Fail Criteria

### ✅ GREEN Criteria (All Must Pass)
- [ ] At least one `[POSTING_QUEUE][SUCCESS]` appears with decision_id + tweet_id + url
- [ ] If disconnect errors appear, at least one matching `[BROWSER_POOL][RECOVER]` appears
- [ ] "Posted X/Y" summaries match success log counts (approximately)

### ⚠️ YELLOW Criteria
- [ ] Some success logs appear
- [ ] But disconnect errors still frequent OR recoveries happening often
- [ ] Queue may be draining slowly

### ❌ RED Criteria (Any Triggers RED)
- [ ] No success logs AND queue not draining
- [ ] Disconnect errors occur with ZERO recoveries
- [ ] Recovery logs appear but no success logs

---

## Verification Commands Used

```bash
# 1. Capture logs
railway logs --service xBOT --lines 5000 > /tmp/xbot_verify_signals.txt 2>&1

# 2. Check recovery signals
grep -nE "\[BROWSER_POOL\]\[RECOVER\]" /tmp/xbot_verify_signals.txt | tail -n 80

# 3. Check debug signals
grep -nE "\[BROWSER_POOL\]\[DEBUG\] (caught_error|disconnected_match)" /tmp/xbot_verify_signals.txt | tail -n 120

# 4. Check success signals
grep -nE "\[POSTING_QUEUE\]\[SUCCESS\]" /tmp/xbot_verify_signals.txt | tail -n 80

# 5. Check disconnect errors
grep -nE "Target page, context or browser has been closed|browserContext\.newPage.*closed" /tmp/xbot_verify_signals.txt | tail -n 120

# 6. Convenience script (if available)
pnpm verify:posting:signals
# OR if running via Railway:
railway run --service xBOT -- pnpm verify:posting:signals
```

---

## Next Steps

**If GREEN:**
- Monitor signals for 24 hours
- Verify queue continues draining
- Check recovery rate declines over time

**If YELLOW:**
- [See section 5 for specific fix]

**If RED:**
- [See section 5 for specific fix]
- Consider emergency pool reset if needed

---

**Last Updated:** December 17, 2025

