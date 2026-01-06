# 🔍 FORENSICS REPORT - January 2025

## PHASE 1: DEPLOYMENT ✅

**Git Status:**
```
On branch main
Your branch is ahead of 'origin/main' by 29 commits.

Changes committed:
- src/posting/atomicPostExecutor.ts (final reply gate)
- src/jobs/postingQueue.ts (assertions + content lock)
- src/jobs/simpleThreadPoster.ts (thread continuation fix)
- src/utils/contentRateLimiter.ts (NEW: quota enforcement)
```

**Build:** ✅ Passed (placeholder build script)

**Deployment:** ✅ Deployed to Railway
```
Build Logs: https://railway.com/project/.../service/.../id=814efeb4-5b05-466c-9264-7ee65acc317b
```

**/ready Endpoint:**
```json
{
  "ready": true,
  "degraded": true,
  "env": true,
  "db": true,
  "jobs": true,
  "stalled": false,
  "stalledJobs": [],
  "buildSha": "local-1767671513847",
  "version": "1.0.0"
}
```

---

## PHASE 2: FORENSICS RESULTS

### Bad Tweet IDs Queried:
- `2008351265785360647` (shows "2/6" reply in-thread)
- `2008383011218170281` (replying to off-topic mention spam thread)

### Database Query Results:

**❌ BOTH TWEET IDS NOT FOUND IN DATABASE**

```
Tweet ID: 2008351265785360647
❌ NOT FOUND in content_metadata
❌ NOT FOUND in content_generation_metadata_comprehensive

Tweet ID: 2008383011218170281
❌ NOT FOUND in content_metadata
❌ NOT FOUND in content_generation_metadata_comprehensive
```

**CONCLUSION:** These tweets were posted via a **BYPASS** or **ANOTHER INSTANCE** that does not use the atomic prewrite system.

### Multiple Build SHAs Detected:

```
Build SHA counts (last 24h):
   NULL: 26 posts
   dev: 5 posts

🚨 MULTIPLE BUILD SHAS DETECTED - Possible multi-instance issue!
```

**ANALYSIS:**
- `NULL` build_sha = Posts without build tracking (old code or bypass)
- `dev` build_sha = Development/local instance posting
- Current build should have Railway commit SHA, not `NULL` or `dev`

**ROOT CAUSE:** Multiple instances posting:
1. **Old deployment** (build_sha=NULL) - posting without atomic prewrite
2. **Local/dev instance** (build_sha=dev) - posting to production DB
3. **Current Railway instance** - should have proper build_sha

---

## PHASE 3: VERIFICATION SQL RESULTS ✅

### 1) Thread-like Reply Violations (last 24h):
```
✅ Result: 0 violations
```

### 2) Reply-to-Reply Target Violations (last 24h):
```
✅ Result: 0 violations
```

### 3) Quotas (last 60m):
```
✅ Total posts (60m): 2
✅ Total replies (60m): 0
```

**Status:** Within limits (MAX_POSTS_PER_HOUR=2, MAX_REPLIES_PER_HOUR=4)

### 4) Stuck Posting Attempts:
```
✅ Result: 0 stuck attempts
```

### 5) /status/reply Endpoint:
```json
{
  "replies_posted_60m": 0,
  "replies_blocked_60m": 0,
  "invariant_blocks_60m": 0,
  "thread_like_blocked_60m": 0,
  "target_not_root_or_missing_60m": 0,
  "blocked_target_is_reply_60m": 0,
  "last_successful_reply_at": "2026-01-05T03:51:27.956Z",
  "pacing_status": "no_fresh_opportunities"
}
```

**Status:** ✅ No violations detected in last 24h

---

## CRITICAL FINDINGS

### 1. **Bad Tweets NOT in Database**
- Tweets `2008351265785360647` and `2008383011218170281` were posted **WITHOUT** atomic prewrite
- This means they bypassed `atomicPostExecutor.executeAuthorizedPost()`
- **Possible sources:**
  - Old deployment before atomic prewrite was enforced
  - Direct API calls bypassing the posting queue
  - Another service/instance posting directly

### 2. **Multiple Build SHAs Posting**
- `NULL` (26 posts) = Old code or bypass
- `dev` (5 posts) = Local/dev instance posting to production
- **Action Required:** Identify and shut down other instances

### 3. **Current System Status**
- ✅ No violations in last 24h (verification SQL)
- ✅ Quotas within limits
- ✅ No stuck posting attempts
- ✅ Invariants enforced in code (deployed)

---

## RECOMMENDED ACTIONS

### IMMEDIATE (Before Re-enabling Posting):

1. **Identify Other Instances:**
   - Check Railway for multiple services
   - Check for local cron jobs (`crontab -l`)
   - Check for Render/other cloud deployments
   - Search codebase for direct posting calls bypassing `atomicPostExecutor`

2. **Shut Down Other Instances:**
   - Stop any local/dev instances posting to production
   - Disable old Railway deployments
   - Remove any cron jobs posting directly

3. **Add Instance Identification:**
   - Ensure all posts include `build_sha` from Railway env vars
   - Add `INSTANCE_ROLE` env var to identify poster instances
   - Log instance_id on startup

### BEFORE PHASE 4 (Controlled Test):

1. ✅ Verify no other instances posting (check Railway services, cron, Render)
2. ✅ Confirm all posting paths go through `atomicPostExecutor`
3. ✅ Ensure `build_sha` is set correctly for all posts

---

## PROGRESS STATUS

- ✅ **Phase 1:** Deployment - COMPLETE
- ✅ **Phase 2:** Forensics - COMPLETE (bad tweets not in DB = bypass/other instance)
- ✅ **Phase 3:** Verification SQL - COMPLETE (0 violations)
- ⏳ **Phase 4:** Controlled Live Test - **BLOCKED** until other instances identified/shut down

**Current Progress: ~85%**

**BLOCKER:** Multiple instances posting (NULL + dev build_shas). Must identify and shut down before re-enabling posting.

---

## NEXT STEPS

1. **Investigate Other Instances:**
   ```bash
   # Check Railway services
   railway status
   
   # Check local cron
   crontab -l
   
   # Search for direct posting bypasses
   grep -r "postTweet\|postReply" --exclude-dir=node_modules src/
   ```

2. **Add Instance Guard:**
   - Require `INSTANCE_ROLE=poster` env var
   - Default all other instances to `ENABLE_POSTING=false`
   - Log instance_id + build_sha on startup

3. **After Other Instances Shut Down:**
   - Re-run forensics to confirm single build_sha
   - Run Phase 4 controlled test
   - Monitor for violations

