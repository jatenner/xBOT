# Production Unstick Audit Report

**Date:** 2026-02-04  
**Mode:** Production Unstick  
**Verdict:** ❌ **FAIL** (Ground truth established, secrets identified)

---

## Step 0 — Ground Truth: Running SHA

### xBOT Service
**BOOT Logs:**
```
sha=cd408377554b0dbbf25d75357e199cdc0f04b736 build_time=2026-01-23T16:53:03Z
```
**Running SHA:** `cd408377554b0dbbf25d75357e199cdc0f04b736`

### serene-cat Service
**BOOT Logs:**
```
[WORKER] 🚀 BOOT: runtime_sha=fdf00f1e32b67fa399f668d836c0a737e73bc62a
[WORKER] 🚀 BOOT: RAILWAY_GIT_COMMIT_SHA=fdf00f1e32b67fa399f668d836c0a737e73bc62a
```
**Running SHA:** `fdf00f1e32b67fa399f668d836c0a737e73bc62a`

### Local HEAD (with fix)
**Local SHA:** `c841452d6336bd40360604e67ab5a67111ca3582`

### Analysis
- ❌ **xBOT running OLD code** (before fix)
- ❌ **serene-cat running OLD code** (before fix)
- ✅ **Fix exists locally** but NOT in Railway

**Conclusion:** Railway deploys from **GitHub**, not local CLI artifacts.

---

## Step 1 — Railway Deploy Source

### Evidence
- Railway BOOT logs show SHA from GitHub commits
- Local fix (`c841452d`) not reflected in running services
- Railway `up` command may upload local files, but Railway appears to use GitHub SHA for builds

**Conclusion:** Railway deploys from **GitHub repository**, not local CLI uploads.

---

## Step 2 — Secret Scanning Blocker

### Git Push Error
```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - GITHUB PUSH PROTECTION
remote:   - Push cannot contain secrets
remote: 
remote:   —— OpenAI API Key ————————————————————————————————————
remote:    locations:
remote:      - commit: 4314a5ab5c98829a36ceb758ddc1c577170a31d0
remote:        path: .env.control.bak:165
remote:      - commit: 4314a5ab5c98829a36ceb758ddc1c577170a31d0
remote:        path: .env.executor:165
remote:      - commit: 4314a5ab5c98829a36ceb758ddc1c577170a31d0
remote:        path: .env.control:165
remote:      - commit: f1dbaaa69b2e57989a9b352140f5796c78510afe
remote:        path: .env.control:165
remote:      - commit: 1fe96ecee23c1ad548720e2747053e913cb35609
remote:        path: .env.local:7
remote:      - commit: f1dbaaa69b2e57989a9b352140f5796c78510afe
remote:        path: .env.local:7
```

### Secret Type
**OpenAI API Key** detected in:
- `.env.control` (line 165)
- `.env.control.bak` (line 165)
- `.env.executor` (line 165)
- `.env.local` (line 7)

### Affected Commits
1. `4314a5ab5c98829a36ceb758ddc1c577170a31d0` - P1 harvester fail-open
2. `f1dbaaa69b2e57989a9b352140f5796c78510afe` - high-volume autonomous rate controller
3. `1fe96ecee23c1ad548720e2747053e913cb35609` - Automatic migration system

### Files in Git History
**Found:** `.env.control`, `.env.local`, `.env.control.bak`, `.env.executor` are tracked in git

**Current `.gitignore`:**
- ✅ `.env` is ignored
- ❌ `.env.control` is NOT ignored
- ❌ `.env.local` is NOT ignored
- ❌ `.env.control.bak` is NOT ignored
- ❌ `.env.executor` is NOT ignored

---

## Step 3 — Secret Removal Plan

### A) Rotate Impacted Secrets

**Secrets to Rotate:**
1. **OpenAI API Key** (exposed in `.env.control`, `.env.local`, `.env.control.bak`, `.env.executor`)
   - Action: Generate new key in OpenAI dashboard
   - Update: Railway variables `OPENAI_API_KEY`
   - Update: Local `.env*` files (after purge)

2. **Supabase Service Role Key** (may be exposed)
   - Action: Rotate in Supabase dashboard
   - Update: Railway variables `SUPABASE_SERVICE_ROLE_KEY`
   - Update: Local `.env*` files (after purge)

3. **Twitter Session/Cookies** (may be exposed in `TWITTER_SESSION_B64`)
   - Action: Regenerate session via browser login
   - Update: Railway variables `TWITTER_SESSION_B64`
   - Update: Local `.env*` files (after purge)

**Note:** Do NOT print secret values in this report.

### B) Purge Secrets from Git History

**Files to Remove:**
- `.env.control`
- `.env.local`
- `.env.control.bak`
- `.env.executor`

**Method:** Use `git filter-repo` (preferred) or BFG Repo-Cleaner

**Steps:**
1. Install `git-filter-repo`: `pip install git-filter-repo`
2. Remove files from history:
   ```bash
   git filter-repo --path .env.control --invert-paths
   git filter-repo --path .env.local --invert-paths
   git filter-repo --path .env.control.bak --invert-paths
   git filter-repo --path .env.executor --invert-paths
   ```
3. Update `.gitignore` to prevent future commits:
   ```bash
   echo ".env.*" >> .gitignore
   echo "!.env.example" >> .gitignore
   ```
4. Verify purge:
   ```bash
   git log -p --all | grep -iE "sk-|service_role|TWITTER_SESSION_B64" || echo "No secrets found"
   ```

### C) Force Push Clean History
```bash
git push origin main --force
```

**Warning:** This rewrites git history. Coordinate with team if shared repository.

---

## Step 4 — Redeploy After Cleanup

### Commands
```bash
railway up --service xBOT --detach
railway up --service serene-cat --detach
```

### Expected Result
- Railway builds from clean GitHub main
- New SHA matches local HEAD (`c841452d`)
- Hourly tick fix deployed

---

## Step 5 — Proof Requirements (After Redeploy)

### A) SHA Proof
- ✅ xBOT BOOT logs show SHA matching `c841452d`
- ✅ serene-cat BOOT logs show SHA matching `c841452d`

### B) Hourly Tick Proof
```sql
SELECT * FROM rate_controller_state ORDER BY updated_at DESC LIMIT 3;
```
**PASS:** Latest `updated_at` within 90 minutes

### C) Navigation Proof
```sql
SELECT COUNT(*) FROM system_events
WHERE created_at > NOW() - INTERVAL '3 hours'
  AND event_type = 'SAFE_GOTO_ATTEMPT';
```
**PASS:** Count > 0

### D) Execution Proof
```sql
SELECT COUNT(*) FROM content_metadata
WHERE decision_type='reply' AND status='posted'
AND posted_at > NOW() - INTERVAL '3 hours';
```
**PASS:** Count > 0 OR explain skip/infra reasons

---

## Current Status

### Running SHA vs Local SHA
- **xBOT:** `cd408377554b0dbbf25d75357e199cdc0f04b736` (OLD - before fix)
- **serene-cat:** `fdf00f1e32b67fa399f668d836c0a737e73bc62a` (OLD - before fix)
- **Local:** `c841452d6336bd40360604e67ab5a67111ca3582` (NEW - has fix)

### Secret Scanning
- ❌ **BLOCKED:** OpenAI API Key in git history
- ❌ **Files:** `.env.control`, `.env.local`, `.env.control.bak`, `.env.executor`
- ❌ **Commits:** `4314a5ab`, `f1dbaaa6`, `1fe96ece`

### Next Steps
1. Rotate secrets (OpenAI, Supabase, Twitter)
2. Purge `.env*` files from git history
3. Update `.gitignore`
4. Force push clean history
5. Redeploy both services
6. Verify SHA + hourly tick execution

---

**Report Generated:** 2026-02-04  
**Status:** ❌ FAIL - Secrets blocking push, Railway running old code  
**Action Required:** Purge secrets from git history, then redeploy
