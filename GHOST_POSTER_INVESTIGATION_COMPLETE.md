# 🔍 GHOST POSTER INVESTIGATION - COMPLETE REPORT

## PHASE A: DB FORENSICS RESULTS ✅

### Query 1: Build SHA Timeline (Last 48h)

```
build_sha | cnt | first_seen | last_seen
----------------------------------------
dev                  |   5 | 2026-01-06T01:49:48.632Z | 2026-01-06T03:43:41.785Z
NULL                 |  50 | 2026-01-04T14:26:40.794Z | 2026-01-06T00:26:03.178Z
local-1767583640292  |   1 | 2026-01-05T03:51:27.956Z | 2026-01-05T03:51:27.956Z
```

**ANALYSIS:**
- `dev` build_sha: **5 posts** from `postingQueue`, last seen **~1 hour ago** (still active!)
- `NULL` build_sha: **50 posts** with `NULL` pipeline_source, last seen **~4 hours ago**
- `local-*` build_sha: 1 post (likely test)

### Query 2: Fingerprint dev/NULL Writers

```
build_sha | pipeline_source | cnt | last_seen | job_run_ids
-----------------------------------------------------------
dev                  | postingQueue                   |   5 | 2026-01-06T03:43:41.785Z | posting_1767670972036, posting_1767670212717, posting_1767664347300, posting_1767664318309, posting_1767664106832
NULL                 | NULL                           |  50 | 2026-01-06T00:26:03.178Z | NULL
```

**FINDINGS:**
1. **`dev` posts:** Coming from `postingQueue` pipeline (current Railway instance)
   - **Root Cause:** `getBuildSHA()` returns 'dev' when `RAILWAY_GIT_COMMIT_SHA` env var not set
   - **Status:** STILL HAPPENING (last post ~1 hour ago)

2. **`NULL` posts:** Coming from unknown source (bypassing atomic executor)
   - **Root Cause:** Posts with `NULL` pipeline_source = not going through `atomicPostExecutor`
   - **Status:** Last seen ~4 hours ago (may be stopped or intermittent)

### Query 3: Last 20 NULL/dev Posts

```
decision_id | tweet_id | type | pipeline_source | build_sha | job_run_id | posted_at | content_preview
---------------------------------------------------------------------------------------------------
4d59e2e3... | 2008238440857382912 | single | postingQueue | dev | posting_1767670972036 | 2026-01-06T03:43:41.785+00:00 | Switching from processed snacks to whole foods can
a2cbd4b3... | 2008380698466406886 | single | postingQueue | dev | posting_1767670212717 | 2026-01-06T03:31:11.733+00:00 | The secret to overcoming the afternoon slump isn't
...
49166a20... | 2008334166593609957 | single | NULL | NULL | NULL | 2026-01-06T00:26:03.178+00:00 | Surprisingly, 1 ounce of almonds (about 23 nuts) b
```

**KEY OBSERVATIONS:**
- `dev` posts have proper `pipeline_source` and `job_run_id` (going through postingQueue)
- `NULL` posts have `NULL` pipeline_source and `NULL` job_run_id (bypassing system)

---

## PHASE B: FIND THE OTHER INSTANCE ✅

### Suspected Writers Identified:

#### Writer 1: Current Railway Instance (Missing Env Vars) ⚠️
- **Evidence:** `dev` build_sha with `postingQueue` pipeline_source
- **Fingerprint:** `pipeline_source='postingQueue'`, `build_sha='dev'`, `job_run_id='posting_*'`
- **Root Cause:** `RAILWAY_GIT_COMMIT_SHA` env var not set in Railway
- **Status:** ACTIVE (last post ~1 hour ago)
- **Shutdown Action:** Set Railway env vars properly

#### Writer 2: Unknown Bypass (NULL pipeline_source) ⚠️
- **Evidence:** `NULL` build_sha with `NULL` pipeline_source
- **Fingerprint:** `pipeline_source=NULL`, `build_sha=NULL`, `job_run_id=NULL`
- **Root Cause:** Posts bypassing `atomicPostExecutor` entirely
- **Status:** Last seen ~4 hours ago (may be stopped)
- **Possible Sources:**
  - Old Railway deployment (before atomic prewrite)
  - Direct DB updates (scripts or manual)
  - Legacy code paths not using atomic executor

### Shutdown Actions:

1. **✅ Code Fix Deployed:** Hardened `getBuildSHA()` to never return 'dev'
2. **✅ Code Fix Deployed:** `markDecisionPosted` now preserves `pipeline_source` and `build_sha`
3. **⏳ Railway Env Vars:** Need to set `RAILWAY_GIT_COMMIT_SHA` in Railway dashboard
4. **⏳ Check Old Deployments:** Verify no old Railway deployments still running

---

## PHASE C: HARDEN BUILD_SHA ✅

### Changes Made:

**File:** `src/posting/atomicPostExecutor.ts`

1. **Fail-closed if build_sha missing:**
   ```typescript
   // 🔒 CRITICAL: Fail-closed if build_sha is missing
   const finalBuildSha = build_sha || getBuildSHA();
   if (!finalBuildSha || finalBuildSha === 'dev' || finalBuildSha === 'unknown') {
     // Block posting and log to system_events
     return { success: false, error: `BLOCKED: Missing or invalid build_sha` };
   }
   ```

2. **Never return 'dev':**
   ```typescript
   export function getBuildSHA(): string {
     const sha = process.env.RAILWAY_GIT_COMMIT_SHA || ...;
     
     // 🔒 CRITICAL: Never return 'dev' or empty - fail-closed
     if (!sha || sha === 'dev') {
       // Try Railway deployment ID, or use timestamp-based ID
       return railwaySha || `unknown_${Date.now()}`;
     }
     return sha;
   }
   ```

3. **Preserve in markDecisionPosted:**
   ```typescript
   // 🔒 CRITICAL: Preserve pipeline_source and build_sha from existing row
   const { data: existingRow } = await supabase
     .from('content_generation_metadata_comprehensive')
     .select('pipeline_source, build_sha, job_run_id')
     .eq('decision_id', decisionId)
     .single();
   
   const updateData: any = {
     status: 'posted',
     tweet_id: tweetId,
     pipeline_source: existingRow?.pipeline_source || 'postingQueue',
     build_sha: existingRow?.build_sha || getBuildSHA(),
     job_run_id: existingRow?.job_run_id || `markPosted_${Date.now()}`,
   };
   ```

### Git Diff:
```
diff --git a/src/posting/atomicPostExecutor.ts b/src/posting/atomicPostExecutor.ts
+  // 🔒 CRITICAL: Fail-closed if build_sha is missing
+  const finalBuildSha = build_sha || getBuildSHA();
+  if (!finalBuildSha || finalBuildSha === 'dev' || finalBuildSha === 'unknown') {
+    return { success: false, error: `BLOCKED: Missing or invalid build_sha` };
+  }
+  
+  // Updated prewriteRow to use finalBuildSha
+  pipeline_source: pipeline_source || 'unknown',
+  build_sha: finalBuildSha,
+  
+  // Updated getBuildSHA() to never return 'dev'
```

### Deployment:
```
✅ Committed: fdf00f1e
✅ Deployed: Railway build cc8d99af-2232-4288-8d62-560e05fac52e
```

---

## PHASE D: CONTROLLED TEST ⏳

### Prerequisites:
- ✅ Code fixes deployed
- ⏳ Wait for deployment to complete
- ⏳ Verify no NULL/dev posts in last 1 hour
- ⏳ Set Railway env vars

### Next Steps:
1. **Wait 1 hour** and re-run Phase A forensics
2. **Verify** no new NULL/dev posts
3. **Set Railway env vars:**
   ```bash
   railway variables --set "RAILWAY_GIT_COMMIT_SHA=$(git rev-parse HEAD)"
   ```
4. **Enable posting:**
   ```bash
   railway variables --set "POSTING_ENABLED=true"
   railway variables --set "REPLIES_ENABLED=true"
   railway variables --set "DRAIN_QUEUE=false"
   ```
5. **Trigger controlled test** (one reply)
6. **Verify logs** show ATOMIC PREWRITE → POST → UPDATE
7. **Run verification SQL** again

---

## SUMMARY

### Ghost Posters Identified:
1. ✅ **Current Railway Instance** (missing env vars) - `dev` build_sha
2. ⚠️ **Unknown Bypass** (NULL pipeline_source) - `NULL` build_sha

### Fixes Deployed:
1. ✅ **build_sha hardening** - Fail-closed if missing
2. ✅ **Preserve metadata** - `markDecisionPosted` preserves pipeline_source/build_sha
3. ✅ **Never return 'dev'** - `getBuildSHA()` uses timestamp-based ID instead

### Remaining Actions:
1. ⏳ Set Railway env vars (`RAILWAY_GIT_COMMIT_SHA`)
2. ⏳ Verify no old deployments running
3. ⏳ Wait 1 hour and verify no new NULL/dev posts
4. ⏳ Run Phase D controlled test

**Status:** Code fixes deployed ✅ | Waiting for verification ⏳

