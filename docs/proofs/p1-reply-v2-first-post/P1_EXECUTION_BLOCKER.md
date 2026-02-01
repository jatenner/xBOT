# P1 Execution Blocker - Harvester Authentication

**Date:** January 29, 2026  
**Status:** ⚠️ Blocked - Harvester Auth Failure

## Issue

The harvester is failing authentication checks locally, preventing fresh harvest cycles with the new public-only discovery lane.

## Error

```
[HARVESTER_AUTH] logged_in=false handle=unknown url=https://x.com/home reason=no_timeline
[HARVESTER_AUTH] ❌ Authentication failed: no_timeline
```

## Attempted Solutions

1. ✅ **Session Sync Script:** Tried `sync-twitter-session-from-profile.ts` - requires CDP running
2. ✅ **Refresh Session:** Tried `refresh-x-session.ts` - session saved but auth cookies not found
3. ❌ **Harvester Still Fails:** Auth check fails even after session refresh

## Current State

- ✅ **Code Complete:** Public-only discovery lane implemented
- ✅ **Migration Applied:** `forbidden_authors` table exists
- ✅ **Filtering Ready:** Author-level memory system ready
- ❌ **Harvester Blocked:** Cannot run fresh harvest locally due to auth

## Next Steps

### Option 1: Run Harvest on Railway
The harvester should run on Railway worker service where authentication is properly configured:

```bash
# On Railway, harvester daemon should run automatically
# Or trigger manually:
railway run --service xBOT pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

### Option 2: Fix Local Auth
1. Ensure `TWITTER_SESSION_B64` is set and valid in local `.env`
2. Verify session has `auth_token` and `ct0` cookies
3. Re-run harvester after auth is verified

### Option 3: Use Existing Opportunities
If there are existing opportunities in the database, we could:
1. Check for any candidates that might work
2. Run scheduler on existing candidates
3. Document that public_search_* candidates will come from next Railway harvest

## Verification Commands

```bash
# Check existing opportunities
pnpm tsx scripts/ops/check-recent-opportunities.ts

# Check for public_search_* candidates
psql $DATABASE_URL -c "SELECT discovery_source, COUNT(*) FROM reply_opportunities WHERE discovery_source LIKE 'public_search_%' GROUP BY discovery_source;"

# Run scheduler (will work even without fresh harvest)
REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true \
pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

## Conclusion

The public-only discovery lane code is complete and ready. The blocker is local harvester authentication. The harvest should run successfully on Railway where the session is properly configured.
