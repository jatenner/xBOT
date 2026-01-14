# Post One Golden Reply - Live Validation Implementation

## ✅ Code Changes Completed

### Commit Hash
`5d540130` - Fix: move preflight check inside loop, fix continue label scope

### Key Updates
1. **Fresh candidate sourcing:**
   - Primary: `reply_candidate_queue` (last 6 hours)
   - Secondary: `candidate_evaluations` (last 2 hours)
   - Filters out tweets used in last 48h

2. **Live validation loop:**
   - Uses `resolveTweetAncestry()` for each candidate
   - Validates: `target_exists`, `is_root`, `status=OK`
   - Tracks skip reasons

3. **Preflight gate report:**
   - Shows validation outcome (target_exists/is_root/status/method)
   - Shows semantic_similarity and gate fields
   - Shows will_pass_gates YES/NO + reason

4. **Loop until success:**
   - Default `--maxCandidates=50`
   - Tries candidates until one succeeds
   - Prints skip reasons breakdown if none succeed

---

## ⚠️ Current Blocker

**`railway run` executes locally, not in Railway production.**

The script attempts live validation using `resolveTweetAncestry()`, which requires Playwright browsers. However:
- `railway run -s xBOT -- ...` runs **locally** with Railway's environment variables
- Local environment doesn't have Playwright browsers installed
- Browser pool fails: `Executable doesn't exist at /Users/jonahtenner/Library/Caches/ms-playwright/...`

**Result:** All candidates fail validation with `ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT`.

---

## 🎯 Solutions

### Option 1: Install Playwright Locally (Quick Fix)
```bash
pnpm exec playwright install chromium
```
Then `railway run` will work locally.

### Option 2: Run Directly in Railway Production
Create a Railway job/endpoint that executes the script in production where browsers work.

### Option 3: Skip Live Validation, Rely on Safety Gates
Remove live validation, rely on posting queue safety gates to catch invalid targets. This is less efficient but works without browsers.

---

## 📊 Current Status

**Script Structure:** ✅ Complete  
**Fresh Candidates:** ✅ Implemented  
**Live Validation:** ⚠️ Blocked by local browser dependency  
**Preflight Report:** ✅ Implemented  
**Loop Until Success:** ✅ Implemented  

**Next Step:** Install Playwright locally OR run script directly in Railway production environment.

---

## 📝 Raw Outputs

See `/tmp/post-golden-live-v2.log` for full execution logs showing browser pool failures.
