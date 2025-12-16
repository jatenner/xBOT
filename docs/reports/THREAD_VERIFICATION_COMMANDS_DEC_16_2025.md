# Thread Reliability Verification Commands (Iteration 2)

**Generated:** 2025-12-16T21:05:00Z

---

## Step 1 — Commands to Run

### A) Capture logs:
```bash
railway logs --service xBOT --lines 3000 > /tmp/xbot_thread_verify.txt 2>&1
echo "Logs captured: $(wc -l < /tmp/xbot_thread_verify.txt) lines"
```

### B) Show thread queue + posting attempts:
```bash
grep -nE "\[QUEUE_CONTENT\].*THREAD QUEUED|\[POSTING_QUEUE\].*thread|\[THREAD_COMPOSER\]" /tmp/xbot_thread_verify.txt | tail -n 250
```

### C) Stage timing evidence:
```bash
grep -nE "\[THREAD_COMPOSER\]\[STAGE\]" /tmp/xbot_thread_verify.txt | tail -n 250
```

### D) Timeout + escalation evidence:
```bash
grep -nE "\[THREAD_COMPOSER\]\[TIMEOUT\]" /tmp/xbot_thread_verify.txt | tail -n 120
```

### E) Autopsy artifacts:
```bash
grep -nE "thread_timeout_.*\.(png|html)|\[THREAD_COMPOSER\]\[AUTOPSY\]" /tmp/xbot_thread_verify.txt | tail -n 80
```

### F) Success evidence (must include tweet IDs + DB save):
```bash
grep -nE "Thread posted|Native composer SUCCESS|TWEET POSTED SUCCESSFULLY|✅ thread POSTED SUCCESSFULLY|Tweet IDs:|thread_tweet_ids|Database save SUCCESS|POST COMPLETE|marked as posted|Tweet URL" /tmp/xbot_thread_verify.txt | tail -n 120
```

### G) Extract decision_ids for analysis (THREAD_COMPOSER + QUEUE_CONTENT only):
```bash
grep -nE "\[QUEUE_CONTENT\].*decision_id=|\[THREAD_COMPOSER\].*decisionId=|\[THREAD_COMPOSER\].*decision_id=" /tmp/xbot_thread_verify.txt | tail -n 120
```

---

## Step 2 — Decision Logic for Verdict

### GREEN Criteria (ALL must be true):
1. ✅ At least ONE thread posted successfully (evidence: "Thread posted" OR "Native composer SUCCESS" OR "Tweet IDs:" with multiple IDs)
2. ✅ `thread_tweet_ids` saved to database (evidence: "Database save SUCCESS" OR "thread_tweet_ids" in logs)
3. ✅ Stage logs show all stages completed (navigation → typing → submit → extraction)
4. ✅ No timeouts on successful thread
5. ✅ Queue is draining (threads being processed)

### YELLOW Criteria (ANY of these):
1. ⚠️ Threads are being queued but timing out before completion
2. ⚠️ Stage logs show stall at specific stage (typing/submit/extraction)
3. ⚠️ Autopsy artifacts exist (screenshots/HTML saved)
4. ⚠️ Partial success (some threads post, others timeout)
5. ⚠️ Queue growing but not draining

### RED Criteria (ANY of these):
1. ❌ No threads being queued at all
2. ❌ All threads failing immediately (no stage logs)
3. ❌ Complete system failure (no THREAD_COMPOSER logs)
4. ❌ Database errors preventing thread saves
5. ❌ Browser pool completely broken

---

## Step 3 — Stall Location Detection

### If NO success, identify stall location:

**typing:**
- Evidence: `[THREAD_COMPOSER][STAGE] 🎯 Stage: typing tweet X/Y - Starting` appears
- Evidence: `[THREAD_COMPOSER][STAGE] ✅ Stage: typing tweet X/Y - Done` does NOT appear for all tweets
- Duration: Last typing start time → timeout time

**submit:**
- Evidence: `[THREAD_COMPOSER][STAGE] 🎯 Stage: submit - Starting` appears
- Evidence: `[THREAD_COMPOSER][STAGE] ✅ Stage: submit - Done` does NOT appear
- Duration: Submit start time → timeout time

**tweet_id_extraction:**
- Evidence: `[THREAD_COMPOSER][STAGE] 🎯 Stage: tweet_id_extraction - Starting` appears
- Evidence: `[THREAD_COMPOSER][STAGE] ✅ Stage: tweet_id_extraction - Done` does NOT appear
- Duration: Extraction start time → timeout time

**unknown:**
- Evidence: No stage logs at all OR logs cut off before any stage completes
- Duration: Navigation complete → timeout (no further stage logs)

---

## Step 4 — Report Template

After running commands, fill in this template:

```markdown
# Thread Reliability Verification Report (Iteration 2)

## 1) Verdict
GREEN / YELLOW / RED

## 2) Did a thread post successfully?
YES/NO

**Evidence lines:**
```
[PASTE EXACT LOG LINES WITH LINE NUMBERS FROM COMMAND F]
```

## 3) Top 3 decision_ids observed

**Selection rule:** Pick the 3 most recent unique decision_ids that appear in either:
- `[QUEUE_CONTENT] THREAD QUEUED` (from Command B)
- `[THREAD_COMPOSER][TIMEOUT]` (from Command D)

Do NOT pick ids from unrelated logs.

| decision_id | attempt_count | final_outcome | stall_stage | stage_duration_summary |
|-------------|---------------|---------------|-------------|------------------------|
| [uuid-1] | [X] | [success/timeout] | [typing/submit/extraction/unknown] | nav=[ms] typing=[ms/NA] submit=[ms/NA] extract=[ms/NA] timeout=[240/300/360/none] |
| [uuid-2] | [X] | [success/timeout] | [typing/submit/extraction/unknown] | nav=[ms] typing=[ms/NA] submit=[ms/NA] extract=[ms/NA] timeout=[240/300/360/none] |
| [uuid-3] | [X] | [success/timeout] | [typing/submit/extraction/unknown] | nav=[ms] typing=[ms/NA] submit=[ms/NA] extract=[ms/NA] timeout=[240/300/360/none] |

**How to extract:**
- Run Command G to find decision_ids (only from QUEUE_CONTENT or THREAD_COMPOSER logs)
- For each decision_id, count attempts from Command D (`[THREAD_COMPOSER][TIMEOUT]` logs)
- Determine outcome from Command F (success) or Command D (timeout)
- Determine stall stage from Command C (last completed stage)
- Extract stage durations from Command C:
  - nav: `[THREAD_COMPOSER][STAGE] ✅ Stage: navigation - Done ([X]ms)`
  - typing: Sum of all `[THREAD_COMPOSER][STAGE] ✅ Stage: typing tweet X/Y - Done ([X]ms)` OR "NA" if incomplete
  - submit: `[THREAD_COMPOSER][STAGE] ✅ Stage: submit - Done ([X]ms)` OR "NA" if incomplete
  - extract: `[THREAD_COMPOSER][STAGE] ✅ Stage: tweet_id_extraction - Done ([X]ms)` OR "NA" if incomplete
  - timeout: From Command D `[THREAD_COMPOSER][TIMEOUT] 🎯 Posting attempt X/3 - Using adaptive timeout: [240/300/360]s` OR "none" if success

## 4) If NO: where did it stall?
[typing / submit / tweet_id_extraction / unknown]

**Evidence:**
- Last completed stage: [stage name] at [timestamp]
- Stall stage: [stage name] started at [timestamp]
- Duration before timeout: [X] seconds
- Timeout value used: [240s / 300s / 360s]

**Log lines:**
```
[PASTE EXACT LOG LINES FROM COMMAND C SHOWING STALL]
```

## 5) Autopsy artifacts found?
YES/NO

**If YES:**
- Screenshot paths: `/tmp/thread_timeout_<decisionId>_<attempt>.png`
- HTML paths: `/tmp/thread_timeout_<decisionId>_<attempt>.html`
- Current URL logged: [URL]
- Rate limit banner: YES/NO
- Error banner: YES/NO
- Composer visible: YES/NO

## 6) Recommendation: ONE next fix only (PR-ready)

**If timeouts still occur, provide exact PR commit:**

**File:** `src/posting/BulletproofThreadComposer.ts`

**Function:** `[function name]`

**Exact change:**
```typescript
// BEFORE:
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

## Step 5 — What to Look For

### Success Indicators:
- `[THREAD_COMPOSER][STAGE] ✅ Stage: typing tweet X/Y - Done` for all tweets
- `[THREAD_COMPOSER][STAGE] ✅ Stage: submit - Done`
- `[THREAD_COMPOSER][STAGE] ✅ Stage: tweet_id_extraction - Done`
- `Tweet IDs: [2001..., 2001..., ...]`
- `Database save SUCCESS` OR `thread_tweet_ids` in DB update logs
- `POST COMPLETE` OR `marked as posted` OR `Tweet URL`

### Failure Indicators:
- `[THREAD_COMPOSER][TIMEOUT] ⏱️ Timeout on attempt X/3`
- `[THREAD_COMPOSER][AUTOPSY] 📸 Screenshot saved`
- Missing stage completion logs
- No tweet IDs extracted

---

## Step 6 — PR-Ready Fix Format

If timeouts occur, the recommendation MUST be formatted as a single commit PR:

**Example format:**

```markdown
## 6) Recommendation: ONE next fix only (PR-ready)

**File:** `src/posting/BulletproofThreadComposer.ts`

**Function:** `postViaComposer`

**Exact change:**
```typescript
// BEFORE (line 374):
await tb0.type(segments[0], { delay: 5 });

// AFTER:
await tb0.type(segments[0], { delay: 2 });
```

**Constant/Value to change:**
- Constant name: `delay` parameter
- Current value: `5`
- New value: `2`
- Line number: `374`

**Rationale:** Typing delay of 5ms is still too slow for 7-8 tweet threads. Reducing to 2ms will cut total typing time from ~35s to ~14s, staying well under 240s timeout.
```

**Rules:**
- NO alternatives ("try X or Y")
- NO multiple files
- NO vague descriptions ("optimize typing")
- MUST specify exact line number
- MUST show before/after code
- MUST specify exact constant/value

---

**Next Step:** Run commands A-G, then fill in the report template above.

