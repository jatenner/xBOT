# CDP Posting Test Guide

**Goal**: Prove end-to-end CDP posting works by getting 1 real reply posted and POST_SUCCESS logged.

**Status**: ✅ CDP posting implemented, seed script ready, testing workflow defined.

---

## Quick Test Workflow

### Step 1: Seed Test Decision

```bash
# Replace REAL_TWEET_ID with an actual tweet ID you want to reply to
# Example: Find a tweet from @hubermanlab or another health account
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile \
pnpm run runner:seed-decision -- --tweet_id=REAL_TWEET_ID
```

**Expected Output**:
```
✅ Test decision created successfully!
📋 Decision Details:
   decision_id: <uuid>
   status: queued
   scheduled_at: <timestamp>
   content: "Quick note: sleep quality and sunlight timing matter more than most people think."
```

### Step 2: Run Posting with CDP

```bash
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
POSTING_BYPASS_RETRY_DEFERRAL=true \
pnpm run runner:once -- --once
```

**What to Look For**:
- `[POSTING] CDP mode enabled` or `[POSTING] Using CDP mode` in logs
- Decision should be processed
- CDP connection should be used (not Playwright browser pool)

### Step 3: Verify POST_SUCCESS

```bash
pnpm exec tsx scripts/verify-post-success.ts --minutes=60
```

**Expected**: At least 1 POST_SUCCESS event with tweet URL.

---

## What This Proves

✅ **CDP Posting Path Works**: System can post via CDP connection to system Chrome  
✅ **End-to-End Flow**: Decision → Post → Success verification  
✅ **Infrastructure Ready**: Once proven, focus shifts to upstream automation (harvest/eval/queue/schedule)

---

## Current System Architecture

**Railway (Brain)**:
- Scoring, decisions, learning, DB writes
- No browser automation (avoids bot detection from cloud IPs)

**Mac Runner (Hands)**:
- All X.com browser automation
- Playwright connected to real Chrome via CDP (`--remote-debugging-port=9222`)
- Uses `RUNNER_PROFILE_DIR` for cookies/session persistence

**Pipeline Flow**:
```
Harvest → Validate/Extract → Insert reply_opportunities → 
Evaluate → Queue → Schedule → Post → Verify (POST_SUCCESS) → Learn
```

---

## Recent Fixes Applied

1. ✅ **CDP Posting Implementation**: `UltimateTwitterPoster` now uses CDP when `RUNNER_MODE=true` and `RUNNER_BROWSER=cdp`
2. ✅ **Retry Deferral Bypass**: `POSTING_BYPASS_RETRY_DEFERRAL=true` flag for testing
3. ✅ **One-shot Summary**: Fixed stage tracking and metrics reporting
4. ✅ **Seed Script**: Manual test decision creation for guaranteed posting attempts

---

## Next Steps After CDP Posting Verified

Once we have 1 successful POST_SUCCESS:

1. **Fix Upstream Automation**:
   - Harvest: Ensure consistent opportunity insertion
   - Evaluation: Generate candidate_evaluations reliably
   - Queue: Refresh candidate queue automatically
   - Schedule: Create reply_decisions from queued candidates

2. **Scale to Daily Cadence**:
   - Target: 2 posts + 4 replies/day
   - Learning loops for follower growth
   - Quality gates and rate limiting

3. **Monitoring & Learning**:
   - Track engagement metrics
   - Learn from successful posts
   - Optimize reply quality and timing

---

## Troubleshooting

**Issue**: Seed script fails with "env not found"
- **Fix**: Run `pnpm run runner:autosync` first, or ensure `.env.local` exists

**Issue**: Posting uses Playwright instead of CDP
- **Check**: `RUNNER_MODE=true` and `RUNNER_BROWSER=cdp` are set
- **Check**: Chrome CDP is running on port 9222 (`pnpm run runner:session` should work)

**Issue**: No POST_SUCCESS after posting
- **Check**: Rate limits (2 posts/4 replies per hour)
- **Check**: Post actually succeeded (verify on X.com manually)
- **Check**: `verify-post-success.ts` is looking at correct time window

---

**Last Updated**: 2026-01-21T04:15:00Z
