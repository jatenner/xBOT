# Thread Iteration 2 Verification Commands

**Generated:** 2025-12-16T22:00:00Z

---

## Step 0 — Sanity Check (Verify Deployment)

**Assumption:** Deploy is correct if logs contain:
- `[BOOT] commit=aabf2b4f...`
- `XBOT_BOOT: Starting bulletproof production runtime...`

**Status:** ✅ Already verified in previous report

---

## Step 1 — Trigger Plan Cycle

**Command to run (ONLY when user says RUN):**

```bash
railway run --service xBOT -- pnpm plan:run:once
```

**If `plan:run:once` doesn't exist, check available scripts:**
```bash
cat package.json | grep -n "\"plan"
```

**Expected output:** Should show `"plan:run:once": "tsx scripts/plan-run-once.ts"` (already verified in package.json)

**After trigger:** Proceed to Step 2 readiness gate (bounded: up to 8 attempts)

---

## Step 2 — Capture and Filter Logs (with Readiness Gate)

**A) Run plan once:**
```bash
railway run --service xBOT -- pnpm plan:run:once
```

**B) Capture fresh logs:**
```bash
railway logs --service xBOT --lines 5000 > /tmp/xbot_thread_verify.txt 2>&1
echo "Lines: $(wc -l < /tmp/xbot_thread_verify.txt)"
```

**C) Readiness check (must show at least ONE line before proceeding):**
```bash
grep -nE "\[PLAN_JOB\]|\[THREAD_BOOST\]|\[QUEUE_CONTENT\].*THREAD QUEUED|\[THREAD_COMPOSER\]" /tmp/xbot_thread_verify.txt | tail -n 80
```

**Readiness gate logic:**
- Re-run capture + readiness check up to 8 attempts
- If still nothing after 8 attempts, stop and output: "No PLAN_JOB / THREAD QUEUED / THREAD_COMPOSER evidence in last 5000 lines after 8 attempts" and include the last 80 lines of readiness output
- Once C shows evidence (at least ONE line), proceed with Step 2 D/E/F/G

**D) Confirm BOOT commit line:**
```bash
grep -nE "\[BOOT\] commit=" /tmp/xbot_thread_verify.txt | tail -n 5
```

**E) Evidence (Iteration 2 canary patterns):**
```bash
grep -nE "\[QUEUE_CONTENT\].*THREAD QUEUED.*decision_id=|\[THREAD_COMPOSER\]\[TIMEOUT\]|\[THREAD_COMPOSER\]\[STAGE\]|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 250
```

**F) Success evidence:**
```bash
grep -nE "Native composer SUCCESS|Thread posted|Tweet IDs:|thread_tweet_ids|Database save SUCCESS|TWEET POSTED SUCCESSFULLY|POST COMPLETE|marked as posted|Tweet URL" /tmp/xbot_thread_verify.txt | tail -n 200
```

**G) Autopsy artifacts:**
```bash
grep -nE "thread_timeout_.*\.(png|html)|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 120
```

---

## Step 3 — Report Template

After running commands, fill in this report:

```markdown
# Thread Iteration 2 Verification Report

**Generated:** [TIMESTAMP]

---

## 1) Verdict
GREEN / YELLOW / RED

---

## 2) Deployment Evidence

**BOOT commit line:**
```
[PASTE EXACT LINE FROM LOGS]
```

---

## 3) Thread Queued?

**YES/NO**

**Log line(s):**
```
[PASTE EXACT LOG LINES WITH LINE NUMBERS]
```

---

## 4) THREAD_COMPOSER Instrumentation Seen?

**YES/NO**

**Log line(s):**
```
[PASTE EXACT LOG LINES WITH LINE NUMBERS]
```

**Expected patterns:**
- `[THREAD_COMPOSER][TIMEOUT] 🎯 Posting attempt X/3 - Using adaptive timeout: 240s/300s/360s`
- `[THREAD_COMPOSER][STAGE] 🎯 Stage: navigation - Starting...`
- `[THREAD_COMPOSER][STAGE] ✅ Stage: navigation - Done ([X]ms)`
- `[THREAD_COMPOSER][STAGE] 🎯 Stage: typing tweet X/Y - Starting...`
- `[THREAD_COMPOSER][STAGE] ✅ Stage: typing tweet X/Y - Done ([X]ms)`
- `[THREAD_COMPOSER][STAGE] 🎯 Stage: submit - Starting...`
- `[THREAD_COMPOSER][STAGE] ✅ Stage: submit - Done ([X]ms)`
- `[THREAD_COMPOSER][STAGE] 🎯 Stage: tweet_id_extraction - Starting...`
- `[THREAD_COMPOSER][STAGE] ✅ Stage: tweet_id_extraction - Done ([X]ms)`

---

## 5) Did a Thread Post Successfully?

**YES/NO**

**Tweet IDs:**
```
[PASTE EXACT LOG LINES SHOWING TWEET IDs]
```

**DB save evidence:**
```
[PASTE EXACT LOG LINES SHOWING DATABASE SAVE]
```

---

## 6) If failed: stall stage

**Stall stage:** [typing / submit / extraction / unknown]

**Supporting stage logs:**
```
[PASTE EXACT LOG LINES SHOWING WHERE IT STALLED]
```

**Analysis:**
- Last completed stage: [stage name] at [timestamp]
- Stall stage: [stage name] started at [timestamp]
- Duration before timeout: [X] seconds
- Timeout value used: [240s / 300s / 360s / none]

---

## 7) Autopsy artifacts

**YES/NO**

**File paths:**
```
[PASTE EXACT PATHS FROM AUTOPSY LOGS]
```

**Banners noted:**
- Rate limit banner: YES/NO
- Error banner: YES/NO
- Composer visible: YES/NO
- Current URL: [URL from logs]

---

## 8) ONE next fix only (single change, single file)

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

---

**Status:** [PENDING_USER_RUN / COMPLETE]
```

---

## Commands Summary (Ready to Run)

**When user says RUN, execute in this exact sequence:**

1. **A) Run plan once:**
   ```bash
   railway run --service xBOT -- pnpm plan:run:once
   ```

2. **B) Capture fresh logs:**
   ```bash
   railway logs --service xBOT --lines 5000 > /tmp/xbot_thread_verify.txt 2>&1
   echo "Lines: $(wc -l < /tmp/xbot_thread_verify.txt)"
   ```

3. **C) Readiness check (re-run B+C up to 8 attempts):**
   ```bash
   grep -nE "\[PLAN_JOB\]|\[THREAD_BOOST\]|\[QUEUE_CONTENT\].*THREAD QUEUED|\[THREAD_COMPOSER\]" /tmp/xbot_thread_verify.txt | tail -n 80
   ```
   
   **Readiness gate logic:**
   - If C shows nothing: Re-run B, then re-run C
   - Maximum 8 attempts total
   - If still nothing after 8 attempts: Stop and output "No PLAN_JOB / THREAD QUEUED / THREAD_COMPOSER evidence in last 5000 lines after 8 attempts" + last 80 lines of readiness output
   - Once C shows evidence (at least ONE line), proceed to D

4. **D) Confirm BOOT commit line:**
   ```bash
   grep -nE "\[BOOT\] commit=" /tmp/xbot_thread_verify.txt | tail -n 5
   ```

5. **E) Extract Iteration 2 canary patterns:**
   ```bash
   grep -nE "\[QUEUE_CONTENT\].*THREAD QUEUED.*decision_id=|\[THREAD_COMPOSER\]\[TIMEOUT\]|\[THREAD_COMPOSER\]\[STAGE\]|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 250
   ```

6. **F) Extract success evidence:**
   ```bash
   grep -nE "Native composer SUCCESS|Thread posted|Tweet IDs:|thread_tweet_ids|Database save SUCCESS|TWEET POSTED SUCCESSFULLY|POST COMPLETE|marked as posted|Tweet URL" /tmp/xbot_thread_verify.txt | tail -n 200
   ```

7. **G) Extract autopsy artifacts:**
   ```bash
   grep -nE "thread_timeout_.*\.(png|html)|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 120
   ```

8. **Fill in report template above**

---

**Status:** ⏸️ READY - Awaiting user command "RUN"

