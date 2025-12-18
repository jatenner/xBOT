# Thread E2E Verification Report

**Date:** December 18, 2025  
**Commit:** `ecef70a0` + `75fba30d`  
**Verification Time:** 19:07-19:08 UTC

---

## 1) Verdict

**RED** - Thread forcing mechanism not working; no threads generated or posted

---

## 2) Decision under test

**decision_id:** `ad98133e-f378-4d5a-be55-85a91fa12121` (found in logs at line 3204)

**queued evidence (line numbers):**
```
3204:[POSTING_QUEUE] 🧵 Processing thread: ad98133e-f378-4d5a-be55-85a91fa12121
```

**claimed evidence (line numbers):**
```
<No "Successfully claimed" log found for this decision_id in recent logs>
```

**Note:** Found one thread processing log, but no subsequent activity found. Logs may have rotated or decision was processed earlier.

---

## 3) Posting path

**Native composer used?** UNKNOWN (no evidence found in recent logs)

**Reply-chain fallback used?** UNKNOWN (no evidence found in recent logs)

**If fallback: did it complete?** UNKNOWN (no evidence found in recent logs)

---

## 4) Success confirmation

**[POSTING_QUEUE][SUCCESS] type=thread present?** NO

**Evidence:**
```
<No [POSTING_QUEUE][SUCCESS] type=thread logs found in recent 8000 lines>
```

**tweet_ids_count present?** NO (no thread SUCCESS logs found)

**DB save success for this decision?** UNKNOWN (no evidence found)

---

## 5) If not GREEN: stall location

**Stall location:** **thread-generation** (root cause: thread forcing not working)

**Evidence lines:**
```
From plan:run:once output:
[THREAD_VERIFY] 🔬 forcing thread for verification (slot=comparison)
[PLAN_JOB] 📝 Generated single tweet (250 chars)  ← Should have been a thread!
[THREAD_BOOST][DEBUG] enabled=true rate=0.5 rng=0.470 selected=false chosenDecisionType=single slot=comparison
```

**Root Cause Analysis:**
1. `[THREAD_VERIFY] 🔬 forcing thread` log appears, indicating thread forcing is attempted
2. But `[PLAN_JOB] 📝 Generated single tweet` shows actual generation produced a single tweet
3. `[THREAD_BOOST][DEBUG] selected=false` shows thread boost didn't trigger
4. Final decision queued: `53dfaed6-5590-4bec-a293-077de7e756d5` with `decision_type=single`

**Conclusion:** Thread forcing mechanism (`THREAD_VERIFY`) logs the attempt but doesn't actually force thread generation. The content generator still produces single tweets.

---

## 6) ONE next fix only (PR-ready)

**File:** `src/jobs/planJob.ts`

**Function:** Thread forcing logic (where `[THREAD_VERIFY]` is logged)

**Exact BEFORE/AFTER code snippet:**

**BEFORE:**
```typescript
// Current code logs [THREAD_VERIFY] but doesn't enforce thread generation
console.log(`[THREAD_VERIFY] 🔬 forcing thread for verification (slot=${slot})`);
// ... content generation continues with decisionType potentially being 'single'
```

**AFTER:**
```typescript
// Force decisionType to 'thread' when THREAD_VERIFY is active
if (process.env.FORCE_THREAD_VERIFICATION === 'true' || /* other thread forcing condition */) {
  console.log(`[THREAD_VERIFY] 🔬 forcing thread for verification (slot=${slot})`);
  decisionType = 'thread'; // ← EXPLICITLY SET decisionType
  // Ensure generator produces thread format
  formatStrategy = { format_type: 'thread', ... };
}
```

**Line number:** Find where `[THREAD_VERIFY]` is logged and add explicit `decisionType = 'thread'` assignment

**Rationale:** 
- `[THREAD_VERIFY]` log indicates thread forcing is attempted, but `decisionType` is not actually forced to 'thread'
- Content generators respect `decisionType` parameter, so setting it explicitly will ensure thread generation
- Thread boost (`THREAD_BOOST`) uses probability (50%), but thread verification should be deterministic (100%)

**Alternative Fix (if thread forcing is in a different location):**
- Ensure `decisionType` is set to `'thread'` BEFORE calling content generators
- Verify generators receive `decisionType='thread'` and respect it
- Add explicit check: `if (forcingThread) { decisionType = 'thread'; }`

---

## Additional Findings

**Thread Processing Found:**
- One thread decision found: `ad98133e-f378-4d5a-be55-85a91fa12121`
- No subsequent processing logs found (may have been processed earlier or logs rotated)

**Thread Success Logs:**
- Zero `[POSTING_QUEUE][SUCCESS] type=thread` logs found in recent 8000 lines
- Zero `[POSTING_QUEUE][SUCCESS] type=thread tweet_ids_count=` logs found

**Thread Failures:**
- No `TEXT_VERIFY_FAIL` logs found in recent logs
- No `THREAD_COMPOSER_FAILED` logs found
- No thread timeout logs found

**Conclusion:** Threads are not being generated due to thread forcing mechanism not working. Once fixed, threads should be generated and can then be verified for posting success.

---

**Report Generated:** December 18, 2025
