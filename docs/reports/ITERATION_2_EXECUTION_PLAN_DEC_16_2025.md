# Iteration 2 Verification Execution Plan

**Generated:** 2025-12-16T22:10:00Z

---

## Exact Commands to Execute (in order)

### Step A — Trigger plan cycle (run once)
```bash
railway run --service xBOT -- pnpm plan:run:once
```

### Step B — Capture fresh logs
```bash
railway logs --service xBOT --lines 5000 > /tmp/xbot_thread_verify.txt 2>&1
echo "Lines: $(wc -l < /tmp/xbot_thread_verify.txt)"
```

### Step C — Readiness check (up to 8 attempts)
```bash
grep -nE "\[PLAN_JOB\]|\[THREAD_BOOST\]|\[QUEUE_CONTENT\].*THREAD QUEUED|\[THREAD_COMPOSER\]" /tmp/xbot_thread_verify.txt | tail -n 80
```

**Readiness gate logic:**
- Repeat Step B then Step C up to 8 times max
- If at least one line appears, proceed to Step D
- If still empty after 8 attempts:
  - Print: "No PLAN_JOB / THREAD_BOOST / THREAD QUEUED / THREAD_COMPOSER evidence in last 5000 lines after 8 attempts"
  - Print last 80 lines of grep output (even if empty)
  - Stop

### Step D — Confirm deployment BOOT commit line
```bash
grep -nE "\[BOOT\] commit=" /tmp/xbot_thread_verify.txt | tail -n 5
```

### Step E — Extract Iteration 2 canary patterns
```bash
grep -nE "\[QUEUE_CONTENT\].*THREAD QUEUED.*decision_id=|\[THREAD_COMPOSER\]\[TIMEOUT\]|\[THREAD_COMPOSER\]\[STAGE\]|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 250
```

### Step F — Extract success evidence
```bash
grep -nE "Native composer SUCCESS|Thread posted|Tweet IDs:|thread_tweet_ids|Database save SUCCESS|TWEET POSTED SUCCESSFULLY|POST COMPLETE|marked as posted|Tweet URL" /tmp/xbot_thread_verify.txt | tail -n 200
```

### Step G — Extract autopsy artifacts
```bash
grep -nE "thread_timeout_.*\.(png|html)|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 120
```

---

## Report Template

After execution, produce:

```markdown
# Thread Reliability Verification Report (Iteration 2)

**Generated:** [TIMESTAMP]

---

## 1) Verdict
GREEN / YELLOW / RED

---

## 2) Deployment Evidence

**BOOT commit line:**
```
[PASTE EXACT LINE FROM STEP D]
```

---

## 3) Thread Queued?

**YES/NO**

**Exact log lines:**
```
[PASTE EXACT LOG LINES WITH LINE NUMBERS FROM STEP E]
```

---

## 4) THREAD_COMPOSER Instrumentation Seen?

**YES/NO**

**Exact log lines:**
```
[PASTE EXACT LOG LINES WITH LINE NUMBERS FROM STEP E]
```

---

## 5) Thread Posted Successfully?

**YES/NO**

**Tweet IDs:**
```
[PASTE EXACT LOG LINES FROM STEP F]
```

**DB save evidence:**
```
[PASTE EXACT LOG LINES FROM STEP F]
```

---

## 6) If NO: Stall Stage

**Stall stage:** [typing / submit / extraction / unknown]

**Exact stage logs:**
```
[PASTE EXACT LOG LINES SHOWING WHERE IT STALLED FROM STEP E]
```

**Timeout used:** [240s / 300s / 360s / none]

**Analysis:**
- Last completed stage: [stage name] at [timestamp]
- Stall stage: [stage name] started at [timestamp]
- Duration before timeout: [X] seconds

---

## 7) Autopsy Artifacts

**YES/NO**

**File paths:**
```
[PASTE EXACT PATHS FROM STEP G]
```

**Banner/URL notes:**
- Rate limit banner: YES/NO
- Error banner: YES/NO
- Composer visible: YES/NO
- Current URL: [URL from logs]

---

## 8) ONE Next Fix Only (PR-ready)

**If GREEN:**
```
No changes needed. Monitor for 24h with:
railway logs --service xBOT --lines 2000 | grep -E "\[THREAD_COMPOSER\]\[STAGE\].*Done|\[THREAD_COMPOSER\]\[TIMEOUT\]|\[QUEUE_CONTENT\].*THREAD QUEUED" | tail -n 100
```

**If YELLOW/RED:**
**File:** `src/posting/BulletproofThreadComposer.ts`

**Function:** `[function name]`

**Exact change:**
```typescript
// BEFORE (line X):
[exact line of code]

// AFTER:
[exact line of code]
```

**Constant/Value to change:**
- Constant name: `[CONSTANT_NAME]`
- Current value: `[current value]`
- New value: `[new value]`
- Line number: `[line number]`

**Rationale:** [Why this exact change addresses the stall]
```

---

**Status:** ⏸️ READY - Awaiting user command "RUN"

