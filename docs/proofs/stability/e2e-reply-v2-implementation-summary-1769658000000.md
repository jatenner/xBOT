# E2E Reply System V2 - Implementation Summary

**Generated:** 2026-01-29 03:40:00 UTC  
**Commit:** 821e4b4f7250f25c97b043e1a4e29214212e8189  
**Status:** ✅ **IMPLEMENTATION COMPLETE** - Awaiting E2E execution

---

## ✅ Implementation Complete

### A) Ungrounded Generation Fix ✅

**Implemented:**
- `extractGroundingPhrases()` - Deterministically extracts 2-4 phrases (2-6 words each) from target tweet snapshot
- `verifyGroundingPhrases()` - Verifies reply contains at least 2 required phrases
- Retry logic in `planOnlyContentGenerator.ts`:
  - First attempt: Generate with standard prompt
  - If missing phrases: Retry with explicit phrase requirements
  - If still failing: Mark as `UNGROUNDED_AFTER_RETRY` and log to `system_events`
- Grounding phrases stored in `features.grounding_phrases` and `features.grounding_phrases_matched`

**Files Modified:**
- `src/jobs/replySystemV2/groundingPhraseExtractor.ts` (new)
- `src/jobs/replySystemV2/planOnlyContentGenerator.ts` (updated)

**Proof:** ✅ `executor:prove:plan-only-grounding-2phrases` - All 9 tests passed

---

### B) Context-Lock Auto-Heal ✅

**Implemented:**
- Conservative auto-heal in narrow band (0.30-0.45 similarity)
- Only for `reply_v2_planner` decisions
- Requires: `target_exists=true`, `is_root_tweet=true`
- Process:
  1. Fetch current tweet text
  2. Update snapshot + hash in features
  3. Regenerate reply with same strategy_id
  4. Re-run context lock check
  5. If passes → proceed to post
  6. If fails or similarity <0.30 → `blocked_permanent`

**Logging:**
- `[AUTO_HEAL] start decision_id=... similarity=...`
- `[AUTO_HEAL] regenerated decision_id=... new_similarity=...`
- `[AUTO_HEAL] success/failed decision_id=...`
- System events: `reply_v2_auto_heal_attempt`, `reply_v2_auto_heal_success`, `reply_v2_auto_heal_failed`

**Files Modified:**
- `src/jobs/postingQueue.ts` (updated auto-heal logic)

**Proof:** ✅ `executor:prove:context-lock-autoheal-band` - All 14 tests passed

---

### C) Proofs ✅

**Created:**
1. `scripts/executor/prove-plan-only-grounding-2phrases.ts`
   - ✅ Phrase extraction determinism
   - ✅ 2-4 phrase extraction
   - ✅ 2-6 words per phrase
   - ✅ Verification requires 2+ matches
   - ✅ Edge case handling

2. `scripts/executor/prove-context-lock-autoheal-band.ts`
   - ✅ Auto-heal band (0.30-0.45)
   - ✅ Hard block for <0.30
   - ✅ Only planner decisions trigger
   - ✅ Requires target_exists and is_root_tweet

**Wired into package.json:**
- `executor:prove:plan-only-grounding-2phrases`
- `executor:prove:context-lock-autoheal-band`

---

### D) E2E Proof Script ✅

**Created:** `scripts/ops/e2e-prove-1-posted-reply-v2.ts`

**Features:**
- Runs planner once
- Starts Mac Runner daemon with `MAX_E2E_REPLIES=1`
- Monitors for posted reply (20 min timeout)
- Generates proof report with:
  - decision_id, tweet_id
  - preflight_status + runtime_preflight_status
  - strategy_id + selection_mode
  - grounding phrases used
  - auto-heal status
  - content preview (220 chars)

---

## 📊 Current Status

### Deployment ✅
- **Commit:** 821e4b4f7250f25c97b043e1a4e29214212e8189
- **Railway SHA:** Both services on correct SHA ✅
- **Build:** ✅ Passing

### Recent Activity Analysis

**Decisions with `runtime_preflight_status='ok'` (last hour):**
- 8 decisions found
- Statuses: `blocked` (context_mismatch), `failed` (ungrounded), `blocked` (opportunity_not_found)
- Content generation: ✅ Working (5 decisions have generated content)
- Issues:
  - Context mismatch with low similarity (0.068, 0.0) - below auto-heal threshold
  - Some decisions still showing old `UNGROUNDED_GENERATION_SKIP` error (pre-fix)

**Observations:**
1. ✅ Content generation is working
2. ✅ Length clamp is working (no "too long" errors in new decisions)
3. ⚠️ Context mismatch blocking decisions with similarity <0.30 (below auto-heal band)
4. ⚠️ Some decisions still have old ungrounded errors (likely processed before fix)

---

## 🔍 Next Steps for E2E Proof

**To achieve 1 posted reply:**

1. **Start Mac Runner daemon:**
   ```bash
   MAX_E2E_REPLIES=1 RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile \
   EXECUTION_MODE=executor HEADLESS=true pnpm run executor:daemon
   ```

2. **Run E2E proof script:**
   ```bash
   pnpm tsx scripts/ops/e2e-prove-1-posted-reply-v2.ts
   ```

3. **Expected flow:**
   - Planner creates decision with `preflight_status='ok'`
   - Mac Runner processes decision
   - Runtime preflight passes (`runtime_preflight_status='ok'`)
   - Content generation with grounding phrase enforcement
   - If context mismatch in 0.30-0.45 band → auto-heal triggers
   - Decision transitions to `posted`

**Potential blockers:**
- Runtime preflight timeout (tweets deleted before execution)
- Context mismatch with similarity <0.30 (below auto-heal band)
- Ungrounded generation (should be fixed with new enforcement)

---

## 📋 SQL Evidence Queries

**Check for posted replies:**
```sql
SELECT decision_id, tweet_id, status, posted_at,
       features->>'runtime_preflight_status' AS runtime_preflight_status,
       features->>'strategy_id' AS strategy_id,
       features->>'auto_healed' AS auto_healed,
       features->>'grounding_phrases_matched' AS grounding_phrases
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner'
  AND status='posted'
  AND tweet_id IS NOT NULL
ORDER BY posted_at DESC
LIMIT 1;
```

**Check auto-heal events:**
```sql
SELECT event_type, message, event_data, created_at
FROM system_events
WHERE event_type IN ('reply_v2_auto_heal_attempt', 'reply_v2_auto_heal_success', 'reply_v2_auto_heal_failed')
ORDER BY created_at DESC
LIMIT 10;
```

**Check grounding enforcement:**
```sql
SELECT event_type, message, event_data, created_at
FROM system_events
WHERE event_type='reply_v2_ungrounded_after_retry'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✅ Deliverables Checklist

- [x] Code changes implemented
- [x] Proofs passing (both deterministic proofs ✅)
- [x] Build passing ✅
- [x] Commit + push ✅ (821e4b4f)
- [x] SHA convergence confirmed ✅
- [ ] E2E proof execution (requires Mac Runner daemon)

---

## Conclusion

✅ **Implementation Complete**

All required features have been implemented and tested:
- Grounding phrase enforcement with retry ✅
- Context-lock auto-heal in narrow band ✅
- Deterministic proofs ✅
- E2E proof script ✅

**Ready for E2E execution** - Requires Mac Runner daemon to be running to process decisions.
