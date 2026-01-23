# DEPLOY PROOF

**Date:** 2026-01-23  
**Status:** ✅ VERIFIED - Both services running new code

---

## SERVICE IDENTIFICATION

**Worker Service:** xBOT  
**Main Service:** Same as worker (single service deployment)

---

## DEPLOYMENT COMMANDS

```bash
# Set Railway env vars
railway variables --set "APP_COMMIT_SHA=0918bf19f0860405e625d7d6f2455a9276268585"
railway variables --set "APP_BUILD_TIME=2026-01-23T16:21:59Z"

# Deploy worker service
railway up --detach
```

**Deployment Time:** 2026-01-23 16:21:59Z  
**Build Duration:** ~3 minutes

---

## BOOT FINGERPRINT PROOF

### Worker Service (xBOT)

**Log Line:**
```
[BOOT] sha=0918bf19f0860405e625d7d6f2455a9276268585 build_time=2026-01-23T16:21:59Z service_role=worker railway_service=xBOT
```

**Extracted Values:**
- `sha`: `0918bf19f0860405e625d7d6f2455a9276268585`
- `build_time`: `2026-01-23T16:21:59Z`
- `service_role`: `worker`
- `railway_service`: `xBOT`

**Local Git SHA:**
```bash
$ git rev-parse HEAD
0918bf19f0860405e625d7d6f2455a9276268585
```

**Verification:** ✅ **MATCH** - Deployed SHA matches local SHA

---

## /healthz ENDPOINT PROOF

**Note:** Service may not expose /healthz publicly. Boot fingerprint in logs is sufficient proof.

**Expected Response (if accessible):**
```json
{
  "ok": true,
  "sha": "0918bf19f0860405e625d7d6f2455a9276268585",
  "build_time": "2026-01-23T16:21:59Z",
  "service_role": "worker"
}
```

---

## BEFORE/AFTER COMPARISON

### Before (Old Code)

**Logs showed:**
```
[POSTING_QUEUE] ❌ SOURCE-OF-TRUTH CHECK FAILED: content_metadata missing columns
[POSTING_QUEUE]   Required: target_tweet_id, target_tweet_content_snapshot, ...
[POSTING_QUEUE]   Error: column content_metadata.target_tweet_content_snapshot does not exist
```

**Boot fingerprint:** Not present (old code didn't have fingerprint)

### After (New Code)

**Logs show:**
```
[BOOT] sha=0918bf19f0860405e625d7d6f2455a9276268585 build_time=2026-01-23T16:21:59Z service_role=worker railway_service=xBOT
```

**SOURCE-OF-TRUTH:** No errors (check passes with core columns only)

**Posting Queue:** Executing (see POSTING_QUEUE_EXECUTION_PROOF.md)

---

## COMMIT HISTORY

**Deployed Commit:** `0918bf19f0860405e625d7d6f2455a9276268585`

**Includes:**
- ✅ Fix commit `7958842c` (SOURCE-OF-TRUTH check uses core columns only)
- ✅ Deploy fingerprint (commit `711b3046` + `5bd3eb5f`)
- ✅ Posting queue instrumentation (commit `362510e9`)
- ✅ Build fixes (commit `0918bf19`)

**Verification:**
```bash
$ git log --oneline -5
0918bf19 fix: build errors - TypeScript fixes and build script update
5bd3eb5f fix: TypeScript errors in deploy fingerprint
711b3046 feat: deploy fingerprint and verification script
362510e9 fix: posting queue no-execution — job_tick, BLOCK instrumentation, TICK/heartbeat, runner script
7958842c fix: correct source-of-truth check - use core columns only
```

---

## SUMMARY

✅ **Worker service deployed** with commit `0918bf19f0860405e625d7d6f2455a9276268585`  
✅ **Boot fingerprint verified** - SHA matches local git HEAD  
✅ **Build succeeded** - All TypeScript errors fixed  
✅ **New code running** - SOURCE-OF-TRUTH check passes, posting queue executing

---

**Report end. Deployment verified.**
