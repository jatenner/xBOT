# Session Refresh Proof - End-to-End Execution

**Date:** 2026-02-04  
**Timestamp:** 1770178333  
**Purpose:** Refresh TWITTER_SESSION_B64 and prove production execution

---

## PHASE 0 — Preconditions / Sanity

### ✅ Scripts Exist

```
scripts/ops/refresh-twitter-session-b64.ts: ✅ EXISTS
scripts/ops/verify-twitter-session.ts: ✅ EXISTS
```

### ✅ .gitignore Updated

```
runtime/secrets/
*.cookies.json
*.storage.json
```

**Status:** ✅ **PASS** - All preconditions met

---

## PHASE 1 — Generate Session Locally

### Attempt 1: Existing Chrome Profile

**Command:**
```bash
export PLAYWRIGHT_PERSIST_BROWSER=true
export RUNNER_PROFILE_DIR="$HOME/Library/Application Support/Google/Chrome"
pnpm exec tsx scripts/ops/refresh-twitter-session-b64.ts
```

**Result:** ❌ **FAILED** - Chrome profile locked (Chrome already running)

**Error:**
```
The profile appears to be in use by another Google Chrome process (34694)
```

### Attempt 2: Manual Login Fallback

**Command:**
```bash
export MODE=manual
export HEADLESS=false
pnpm exec tsx scripts/ops/refresh-twitter-session-b64.ts
```

**Result:** ⏳ **REQUIRES USER INTERACTION**

**Status:** Script launched headed browser and waited for login, but timed out after 120 seconds.

**Note:** Phase 1 requires interactive user login. User must:
1. Run the manual login script
2. Log in to X.com in the opened browser window
3. Wait for script to complete and capture the base64 output

**Next Steps for User:**
```bash
# Close any running Chrome instances first, then:
export MODE=manual
export HEADLESS=false
pnpm exec tsx scripts/ops/refresh-twitter-session-b64.ts

# After login completes, script will output:
# TWITTER_SESSION_B64=<REDACTED_BASE64>
```

---

## PHASE 2 — Verify Locally

**Status:** ⏳ **PENDING** - Requires Phase 1 completion

**Command (once session generated):**
```bash
export TWITTER_SESSION_B64="<CAPTURED_BASE64>"
pnpm exec tsx scripts/ops/verify-twitter-session.ts
```

**Expected PASS Criteria:**
- ✅ auth_token cookie present (no value printed)
- ✅ ct0 cookie present (no value printed)
- ✅ Navigation to https://x.com/home succeeds
- ✅ SAFE_GOTO_OK events logged

---

## PHASE 3 — Install into Railway

**Status:** ⏳ **PENDING** - Requires Phase 1 completion

**Commands (once session verified locally):**
```bash
# Ensure Railway auth
railway status || railway login --browserless

# Set for xBOT service
railway variables --service xBOT --set TWITTER_SESSION_B64="<CAPTURED_BASE64>"

# Set for serene-cat service
railway variables --service serene-cat --set TWITTER_SESSION_B64="<CAPTURED_BASE64>"
```

**Note:** Commands will not echo the secret value.

---

## PHASE 4 — Redeploy Services

**Status:** ⏳ **PENDING** - Requires Phase 3 completion

**Commands:**
```bash
railway up --service xBOT --detach
railway up --service serene-cat --detach
```

**Verification:**
```bash
railway status
# Check for recent deployment IDs
```

---

## PHASE 5 — Proof System is Executing

### Current Production Status (Pre-Refresh)

**Railway Logs Check:**
```bash
railway logs --service xBOT -n 600 | grep -E "BOOT|JOB_MANAGER|HOURLY_TICK|executeHourlyTick|RATE_CONTROLLER"
```

**Result:**
- ✅ JOB_MANAGER logs found (reply_v2_fetch jobs running)
- ❌ No HOURLY_TICK or executeHourlyTick logs found
- ❌ No RATE_CONTROLLER logs found

**DB Verification Results:**

**1. Rate Controller State:**
```
❌ No rate_controller_state rows found
```
**Interpretation:** Hourly tick is not executing (no state rows created/updated)

**2. SAFE_GOTO Events (last 3h):**
```
SAFE_GOTO_ATTEMPT: 0
SAFE_GOTO_OK: 0
SAFE_GOTO_FAIL: 0
```
**Interpretation:** Navigation pipeline not active (no navigation attempts)

**3. Posted Replies (last 3h):**
```
Total posted: 0
```
**Interpretation:** No replies posted in last 3 hours

**4. Skip Reasons / Infra Blocks:**
```
No skip events found
No infra block events found
```
**Interpretation:** System is idle (no execution attempts)

**Railway Variables Status:**
- ✅ TWITTER_SESSION_B64 exists in xBOT service (value redacted)
- ✅ TWITTER_SESSION_B64 exists in serene-cat service (value redacted)

**Conclusion:** System has session configured but hourly tick is not executing. This aligns with earlier audit findings that hourly tick import path was incorrect. After session refresh and redeploy, hourly tick should resume execution.

**DB Proofs:**

**1. Rate Controller State:**
```bash
railway run --service xBOT pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index.js';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('rate_controller_state')
  .select('hour_start, updated_at, target_replies_this_hour, executed_replies')
  .order('updated_at', { ascending: false })
  .limit(3);
console.log(JSON.stringify(data, null, 2));
"
```

**2. SAFE_GOTO Events (last 3h):**
```bash
railway run --service xBOT pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index.js';
const supabase = getSupabaseClient();
const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { count } = await supabase
  .from('system_events')
  .select('*', { count: 'exact', head: true })
  .eq('event_type', 'SAFE_GOTO_ATTEMPT')
  .gte('created_at', threeHoursAgo);
console.log('SAFE_GOTO_ATTEMPT count (last 3h):', count || 0);
"
```

**3. Posted Replies (last 3h):**
```bash
railway run --service xBOT pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index.js';
const supabase = getSupabaseClient();
const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { count } = await supabase
  .from('content_metadata')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'posted')
  .eq('decision_type', 'reply')
  .gte('posted_at', threeHoursAgo);
console.log('Posted replies (last 3h):', count || 0);
"
```

**4. Navigation Events:**
```bash
railway logs --service xBOT -n 600 | grep -E "SAFE_GOTO_(ATTEMPT|OK|FAIL)|CONSENT_WALL_(DETECTED|DISMISSED|BLOCKED)"
```

**5. Comprehensive Verification Script:**
```bash
railway run --service xBOT pnpm exec tsx scripts/ops/verify-production-execution.ts
```

---

## Summary

### ✅ Completed

1. **Preconditions:** All scripts exist, .gitignore updated
2. **Scripts Created:** Refresh and verify scripts ready
3. **Safety Measures:** Secrets directory gitignored, fail-closed validation implemented
4. **Production Verification Script:** Created `scripts/ops/verify-production-execution.ts`
5. **Current Production Status:** Verified (see Phase 5 results)

### ⏳ Pending User Action

1. **Phase 1:** User must run refresh script interactively (manual login mode)
2. **Phase 2:** Verify session locally after generation
3. **Phase 3:** Set Railway variables (both services)
4. **Phase 4:** Redeploy services
5. **Phase 5:** Re-verify production execution after refresh

### 📊 Current Production Status

**TWITTER_SESSION_B64:** ✅ EXISTS in both Railway services (values redacted)

**System Execution Status:**
- ❌ Hourly tick: NOT executing (no rate_controller_state rows)
- ❌ Navigation pipeline: NOT active (0 SAFE_GOTO events in last 3h)
- ❌ Replies posted: 0 in last 3h
- ✅ Job manager: Running (reply_v2_fetch jobs active)

**Root Cause:** Hourly tick not executing (likely due to import path issue identified in earlier audit)

**After Session Refresh:** Once session is refreshed and services redeployed, hourly tick should resume execution.

### 📋 Next Steps

1. **User runs:**
   ```bash
   export MODE=manual
   export HEADLESS=false
   pnpm exec tsx scripts/ops/refresh-twitter-session-b64.ts
   ```
2. **User logs in** to X.com in opened browser
3. **User captures** the `TWITTER_SESSION_B64=<BASE64>` output (redacted in logs)
4. **User verifies** locally:
   ```bash
   export TWITTER_SESSION_B64="<CAPTURED>"
   pnpm exec tsx scripts/ops/verify-twitter-session.ts
   ```
5. **User sets** Railway variables and redeploys
6. **User verifies** production execution using Phase 5 commands

---

## Production Verification Commands (Post-Refresh)

**After session refresh and deployment, run:**

```bash
# 1. Check hourly tick execution
railway logs --service xBOT -n 600 | grep -E "HOURLY_TICK|executeHourlyTick|RATE_CONTROLLER"

# 2. Check rate_controller_state updated_at (should be recent)
railway run --service xBOT pnpm exec tsx scripts/ops/production-readiness-audit.ts

# 3. Check navigation events
railway logs --service xBOT -n 600 | grep -E "SAFE_GOTO_(ATTEMPT|OK|FAIL)"

# 4. Check posted replies
railway run --service xBOT pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index.js';
const supabase = getSupabaseClient();
const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { count, data } = await supabase
  .from('content_metadata')
  .select('tweet_id, posted_at', { count: 'exact' })
  .eq('status', 'posted')
  .eq('decision_type', 'reply')
  .gte('posted_at', threeHoursAgo)
  .order('posted_at', { ascending: false })
  .limit(3);
console.log('Posted replies (last 3h):', count || 0);
if (data && data.length > 0) {
  console.log('Recent replies:', data.map(r => ({ tweet_id: r.tweet_id, posted_at: r.posted_at })));
}
"
```

---

## Notes

- **No secrets printed:** All base64 values redacted in logs
- **Fail-closed validation:** Scripts exit with error if auth cookies missing
- **Intermediate files:** Stored in `runtime/secrets/` (gitignored)
- **Railway variables:** Set via CLI (values not echoed)
