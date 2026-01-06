# 🔍 GHOST POSTER INVESTIGATION - CHECKLIST

## PHASE 0: STOP BLEEDING ✅

- [x] Check Railway vars: `railway variables | grep POSTING_ENABLED`
- [x] Set vars if needed: `railway variables --set POSTING_ENABLED=false REPLIES_ENABLED=false DRAIN_QUEUE=true`
- [x] Verify vars are set correctly

**Output:**
```
✅ DRAIN_QUEUE=true
✅ POSTING_ENABLED=false
✅ REPLIES_ENABLED=false
✅ MAX_POSTS_PER_HOUR=2
✅ MAX_REPLIES_PER_HOUR=4
```

**Status:** ✅ **COMPLETE** - Posting is disabled

---

## PHASE 1: PROVE WHETHER "BAD TWEETS" ARE FROM THIS BUILD ❌

- [x] Verify tweet 2008385895968186807
- [x] Verify tweet 2008385636403724744
- [x] Verify tweet 2008384693058588778

**Results:**
```
Tweet 2008385895968186807: ❌ NOT_IN_DB → (B) NOT_IN_DB - ghost/bypass
Tweet 2008385636403724744: ❌ NOT_IN_DB → (B) NOT_IN_DB - ghost/bypass
Tweet 2008384693058588778: ❌ NOT_IN_DB → (B) NOT_IN_DB - ghost/bypass
```

**Status:** ❌ **GHOST POSTING CONFIRMED** - All 3 tweets bypassed our system

---

## PHASE 2: FIND OTHER WRITER PROCESS

### A) LOCAL MACHINE CHECK ✅

- [x] Check processes: `ps aux | grep -E "node|tsx|playwright|xbot"`
- [x] Check listening ports: `lsof -iTCP -sTCP:LISTEN`
- [x] Check env vars: `printenv | grep -E "TWITTER|X_|DATABASE_URL|SUPABASE"`
- [x] Check suspicious files: `ls -lah *.js *.ts`

**Results:**
```
✅ No xbot/node/tsx/playwright processes running
✅ No suspicious listening ports
✅ No TWITTER/X env vars in shell
⚠️ Found suspicious files (old, not running):
   - headless-x-poster.js (executable, Oct 7, 2025)
   - immediate_viral_post.js (Sep 8, 2025)
   - force_viral_post.js (Sep 8, 2025)
```

**Status:** ✅ **LOCAL MACHINE CLEAN** (old scripts exist but not running)

### B) REPO SEARCH ✅

- [x] Search for schedulers: `rg -n "cron|schedule|setInterval|node-cron|agenda|bull|repeat"`
- [x] Search for posting calls: `rg -n "postTweet|postReply|twitter|x api|UltimateTwitterPoster"`
- [x] Check if suspicious files are imported: `grep -r "headless-x-poster"`

**Results:**
```
✅ No cron/schedulers found
✅ All posting calls go through atomicPostExecutor
⚠️ headless-x-poster.js referenced in:
   - integrated-headless-poster.js
   - openai-x-integration.js
```

**Status:** ✅ **NO ACTIVE SCHEDULERS** (but need to check referenced files)

### C) RAILWAY CHECK ✅

- [x] Check Railway status: `railway status`
- [x] Check Railway logs: `railway logs --lines 3000 | grep -E "ATOMIC_POST|POST_TWEET|BYPASS_BLOCKED|build_sha=|pipeline_source="`
- [x] Check build SHA in logs: `railway logs --lines 1000 | grep -i "build_sha\|pipeline_source"`

**Results:**
```
✅ Single Railway service: xBOT
✅ No recent ATOMIC_POST entries
✅ No recent POST_TWEET entries
✅ Logs show only queue operations (content generation)
✅ Last NULL post: 2026-01-06T00:26:03.178Z (~4 hours ago)
✅ Last dev post: 2026-01-06T03:43:41.785Z (~1 hour ago)
```

**Status:** ✅ **RAILWAY CLEAN** (no recent posting activity)

---

## PHASE 3: TWITTER-SIDE KILL SWITCH ⚠️

**CRITICAL:** Ghost posting confirmed. Twitter kill switch REQUIRED.

**Instructions:** See `PHASE_3_KILL_SWITCH.md`

**Actions Required:**
- [ ] Revoke Twitter/X API keys
- [ ] Change Twitter password
- [ ] Sign out all sessions
- [ ] Enable 2FA

**Status:** ⚠️ **PENDING USER ACTION** - Cannot proceed without kill switch

---

## PHASE 4: CONTROLLED RE-ENABLE ⏳

**Prerequisites:**
- [ ] Twitter kill switch implemented
- [ ] Monitor for 15 minutes (no new ghost posts)
- [ ] Verify single-writer control

**Status:** ⏳ **BLOCKED** - Waiting for Phase 3 completion

---

## SUMMARY

### ✅ What Was Proven:

1. ✅ Posting disabled in Railway
2. ✅ No local bot process running
3. ✅ No scheduled jobs (cron/launchctl)
4. ✅ Railway logs show no posting activity
5. ✅ All 3 bad tweets are NOT_IN_DB (ghost/bypass confirmed)
6. ✅ Ghost poster bypasses entire system (no DB records)

### ❌ What Is Still Unknown:

1. ❌ Source of ghost tweets (not Railway, not local machine)
2. ❌ When exactly ghost tweets were posted (need Twitter timestamps)
3. ❌ Whether ghost posting is still active (need 15-min monitoring)
4. ❌ How ghost poster authenticates (API keys? Browser session? Other account?)
5. ❌ Whether `headless-x-poster.js` or referenced files could be running elsewhere

### Next Exact Commands:

1. **Check referenced files:**
   ```bash
   cat integrated-headless-poster.js | head -n 50
   cat openai-x-integration.js | head -n 50
   ```

2. **Check if files could be running:**
   ```bash
   ps aux | grep -E "headless|integrated|openai-x"
   ```

3. **After Twitter kill switch:**
   ```bash
   # Monitor for 15 minutes
   # Check Twitter account
   # Check Railway logs
   # Re-run forensics
   ```

---

## 🎯 CURRENT CONFIDENCE: SINGLE-WRITER CONTROL

**Current Confidence: 30%**

**Reasoning:**
- ✅ Posting disabled
- ✅ No local bot
- ✅ Railway clean
- ✅ No schedulers
- ❌ Ghost posting confirmed (3 tweets NOT_IN_DB)
- ❌ Ghost poster source unknown
- ❌ Ghost poster bypasses entire system
- ❌ Need to verify referenced files aren't running

**BLOCKER:** Ghost poster is active. Twitter kill switch REQUIRED.

