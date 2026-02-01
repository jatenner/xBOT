# Auth Blocker Report - Railway Session Invalid

**Date:** January 29, 2026  
**Status:** 🚫 BLOCKED - Auth freshness check failing on Railway

## Issue

Railway harvester is correctly failing-closed in P1 mode due to invalid auth session.

**Evidence:**
```
[HARVESTER_AUTH] logged_in=false handle=unknown url=https://x.com/home reason=no_timeline
[HARVESTER_AUTH] ❌ Authentication failed: no_timeline
[HARVESTER_AUTH] ⚠️ Skipping harvest cycle - authentication required
```

**Fail-Closed Behavior (Working as Designed):**
- Harvester checks auth before running
- In P1 mode, exits with code 1 if auth fails
- Emits `harvester_auth_blocked_p1` event to system_events

## Root Cause

The `TWITTER_SESSION_B64` environment variable on Railway contains a stale session. The session was pushed but is no longer valid (likely expired or invalidated by Twitter).

## Required Actions

### Option 1: Refresh Session Locally and Push (Recommended)

1. **Refresh session on Mac:**
   ```bash
   pnpm tsx scripts/refresh-x-session.ts
   ```
   This will:
   - Open browser
   - Wait for login
   - Save fresh session to `twitter_session.json`

2. **Push fresh session to Railway:**
   ```bash
   RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
   ```

3. **Verify auth on Railway:**
   ```bash
   railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts
   ```
   Look for: `[HARVESTER_AUTH] logged_in=true`

### Option 2: Use Executor Session (If Available)

If executor is running on Mac with valid session:
1. Export session from executor profile
2. Push to Railway using same script

## Verification

After pushing fresh session, verify:
```bash
railway run --service serene-cat pnpm tsx -e "
import('./src/utils/whoamiAuth').then(async ({ checkWhoami }) => {
  const { UnifiedBrowserPool } = await import('./src/browser/UnifiedBrowserPool');
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('auth_verify');
  try {
    const whoami = await checkWhoami(page);
    console.log('Auth check:', JSON.stringify(whoami, null, 2));
    process.exit(whoami.logged_in ? 0 : 1);
  } finally {
    await pool.releasePage(page);
  }
});
"
```

**Expected:** `logged_in: true`

## Next Steps After Auth Fixed

1. Run harvest cycle: `railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts`
2. Verify public candidates: `pnpm tsx scripts/ops/verify-public-candidates.ts`
3. Run scheduler: `railway run --service serene-cat REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true pnpm tsx scripts/ops/run-reply-v2-planner-once.ts`
4. Complete P1 posting flow

## Files Changed

- ✅ `src/jobs/replyOpportunityHarvester.ts` - Fail-closed auth check (lines 84-102)
- ✅ `src/utils/authFreshnessCheck.ts` - Auth freshness utilities
- ✅ `scripts/ops/push-twitter-session-to-railway.ts` - Session sync script

## Commits

- `25a26816` - P1 unblock: public discovery, auth fail-closed, tracker, readiness scripts
- `053023b1` - Fix fallbackQueries duplicate declaration
