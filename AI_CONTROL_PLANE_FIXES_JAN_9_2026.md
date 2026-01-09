# AI Control Plane Wiring Fixes - January 9, 2026

## Issues Found During Validation

1. **AI Judge Not Being Called**: 0 `target_judge` calls in `llm_usage_log`
2. **Missing `feedRunId` Parameter**: `scoreCandidate` was referencing `feedRunId` but it wasn't a parameter
3. **Missing `judge_decision` in Return**: Final return statement didn't include `judge_decision` field

## Fixes Applied

### 1. `candidateScorer.ts`
- ✅ Added `feedRunId?: string` parameter to `scoreCandidate` function signature
- ✅ Added `judge_decision: judgeDecision || undefined` to final return statement (line 250)

### 2. Code Flow Verification
- ✅ `orchestrator.ts` correctly passes `feedRunId` to `scoreCandidate`
- ✅ `orchestrator.ts` correctly stores `judge_decision` and `ai_judge_decision` in database
- ✅ Judge is called after hard filters pass (line 113-123)
- ✅ Judge decision is used to influence acceptance (line 145-165)

## Deployment Required

The fixes are in the codebase but need to be deployed to production. After deployment:

1. **Expected Behavior**:
   - Judge will be called for candidates that pass hard filters (root, parody, spam, insufficient text)
   - Judge decisions will be stored in `candidate_evaluations.judge_decision` and `ai_judge_decision`
   - Judge will influence acceptance/rejection decisions

2. **Validation After Deployment**:
   - Run `pnpm tsx scripts/validate_ai_control_plane.ts`
   - Check `llm_usage_log` for `target_judge` calls
   - Verify `candidate_evaluations.judge_decision` is populated

## Current Status

- ✅ Code fixes complete
- ⏳ Awaiting deployment
- ⏳ Validation pending after deployment

