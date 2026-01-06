# Ghost Investigation Log - xBOT Single-Writer Control Recovery

## Investigation Started: 2026-01-05 23:37:30 EST

Goal: Achieve 90% confidence single-writer control by detecting and eliminating ghost posters.

---

## 2026-01-06 00:37:46 ET

**Action:** Initial investigation and setup

**Commands:**
```bash
# Check posting status
railway variables | grep -E "POSTING_ENABLED|REPLIES_ENABLED|DRAIN_QUEUE"

# Run verifier for last 1 hour
pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=1

# Check Railway logs
railway logs --lines 500 | grep -E "ATOMIC_POST|POST_TWEET|BYPASS_BLOCKED"

# Check for posts in last 15 minutes
pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=0.25
```

**Key Output:**
- ✅ POSTING_ENABLED=false, REPLIES_ENABLED=false, DRAIN_QUEUE=true
- ⚠️ Found 1 tweet in last hour with build_sha='dev' (tweet_id: 2008238440857382912, posted at 03:43:41 UTC)
- ✅ Last 15 minutes: CLEAN (0 tweets)
- ✅ Railway logs show only queue operations, no posting activity

**Conclusion:** 
- Posting is disabled correctly
- One 'dev' build_sha tweet from 54 minutes ago (before disable)
- No recent posting activity
- Railway missing RAILWAY_GIT_COMMIT_SHA env var (causing 'dev' build_sha)

**Next Step:** Set Railway build SHA env var, then monitor for 15 minutes

---
