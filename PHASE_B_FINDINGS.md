# PHASE B: FIND THE OTHER INSTANCE

## Findings from Phase A Forensics:

### 1. `dev` build_sha Posts (5 posts, last ~1 hour ago)
- **Pipeline Source:** `postingQueue`
- **Job Run IDs:** `posting_1767670972036`, `posting_1767670212717`, etc.
- **Root Cause:** `getBuildSHA()` returns 'dev' when Railway env vars not set
- **Location:** Current Railway instance (but missing RAILWAY_GIT_COMMIT_SHA env var)

### 2. `NULL` build_sha Posts (50 posts, last ~4 hours ago)
- **Pipeline Source:** `NULL` (not set)
- **Job Run ID:** `NULL`
- **Root Cause:** Posts bypassing `atomicPostExecutor` or old code paths
- **Likely Source:** Old deployment or direct DB updates

## Suspected Writers:

### Writer 1: Current Railway Instance (Missing Env Vars)
- **Evidence:** `dev` build_sha with `postingQueue` pipeline_source
- **Issue:** `RAILWAY_GIT_COMMIT_SHA` env var not set
- **Action:** Set Railway env vars properly

### Writer 2: Old Deployment / Direct DB Updates
- **Evidence:** `NULL` build_sha with `NULL` pipeline_source
- **Issue:** Posts not going through `atomicPostExecutor`
- **Action:** Check for old Railway deployments, direct DB scripts, or legacy code paths

## Shutdown Actions:

1. **Set Railway Env Vars:**
   ```bash
   railway variables --set "RAILWAY_GIT_COMMIT_SHA=$(git rev-parse HEAD)"
   ```

2. **Check for Old Deployments:**
   - Railway dashboard → Check for multiple deployments
   - Verify only one service is active

3. **Check for Direct DB Scripts:**
   - Search for scripts that update `status='posted'` directly
   - Check for legacy posting code paths

4. **Verify Local .env:**
   - Confirmed: Local .env points to production DB
   - **RISK:** Local dev could post to production if running
   - **Action:** Ensure local dev never runs against production

