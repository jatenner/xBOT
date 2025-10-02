# 🚀 Deployment Guide: Autonomous xBOT System

## Pre-Deployment Checklist

✅ All code changes committed  
✅ No linting errors  
✅ Tests created (jobsRegistration.test.ts)  
✅ PR description complete (PR_AUTONOMOUS_SYSTEM.md)  
✅ Twitter session valid (TWITTER_SESSION_B64 set on Railway)  

---

## Railway Variables to Set

Before deploying, ensure these are configured on Railway:

```bash
# Required
MODE=live
DISABLE_POSTING=false
ADMIN_TOKEN=<generate-random-secure-string>
JOBS_AUTOSTART=true
TWITTER_SESSION_B64=<your-base64-session>

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis
REDIS_URL=redis://...

# Job Intervals
JOBS_PLAN_INTERVAL_MIN=60
JOBS_REPLY_INTERVAL_MIN=90
JOBS_POSTING_INTERVAL_MIN=5
JOBS_LEARN_INTERVAL_MIN=120

# Optional (for debugging)
PLAYWRIGHT_TRACE=off  # Set to 'on' for debugging
LOG_LEVEL=info
```

**To set variables:**
```bash
railway variables --set MODE=live
railway variables --set DISABLE_POSTING=false
railway variables --set ADMIN_TOKEN=$(openssl rand -hex 32)
# ... etc
```

---

## Deployment Commands

### 1. Commit Changes
```bash
git add .
git commit -m "feat: autonomous system with robust playwright"
```

### 2. Push to Main (triggers auto-deploy)
```bash
git push origin main
```

### 3. Monitor Build
```bash
railway logs --service xbot-production --follow
```

**Expected build time:** 3-5 minutes (includes Playwright installation)

### 4. Verify Deployment
Wait ~60 seconds after "Starting Container" message, then:

```bash
# Check health
curl https://your-app.railway.app/status

# Expected: { "ok": true, "mode": "live", "postingEnabled": true, "timers": {...} }
```

---

## Post-Deployment Validation

### Test 1: Health Check
```bash
curl https://your-app.railway.app/status | jq
```

**Verify:**
- `mode === "live"`
- `postingEnabled === true`
- `timers.posting === true`
- `timers.plan === true`
- `timers.reply === true`
- `timers.learn === true`

### Test 2: Playwright Status
```bash
curl https://your-app.railway.app/playwright | jq
```

**Verify:**
- `browserHealthy === true`
- `profileDirExists === true`

### Test 3: Smoke Test (CLI)
```bash
railway run bash -c 'tsx scripts/post_once.ts "xBOT autonomous smoke $(date +%s)"'
```

**Expected output:**
```
✅ SMOKE_TEST_PASS: Tweet posted successfully!
   • Tweet ID: 1234567890
```

### Test 4: Smoke Test (HTTP)
```bash
export ADMIN_TOKEN="<your-token>"
export HOST="https://your-app.railway.app"

curl -X POST $HOST/admin/post \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"xBOT HTTP smoke test"}'
```

**Expected:** `{ "ok": true, "success": true, "id": "..." }`

### Test 5: Verify Tweet on X
1. Go to https://x.com/your_account
2. Verify smoke test tweets appear
3. Verify timestamps match deployment time

### Test 6: Check Job Timers
```bash
railway logs | grep "JOB_REGISTERED"
```

**Expected:** `JOB_REGISTERED {"plan":true,"reply":true,"posting":true,"learn":true} mode=live`

### Test 7: Monitor First Posting Cycle
```bash
railway logs --follow | grep -E "POSTING_|JOB_POSTING"
```

**Wait 5 minutes** (JOBS_POSTING_INTERVAL_MIN), then verify:
```
🕒 JOB_POSTING: Starting...
POSTING_START textLength=...
[PW] Attempt 1/3 starting...
POSTING_DONE id=...
✅ JOB_POSTING: Completed successfully
```

---

## Troubleshooting

### Build Fails
**Symptom:** Build fails with "Cannot find module..."  
**Fix:** 
```bash
rm -rf dist node_modules
npm install
npm run build
git add . && git commit -m "fix: rebuild with deps"
git push
```

### Posting Job Not Registered
**Symptom:** Logs show `❌ FATAL: Posting job not registered despite MODE=live`  
**Fix:**
```bash
# Verify env vars on Railway
railway variables | grep -E "MODE|DISABLE_POSTING"

# Should show:
# MODE=live
# DISABLE_POSTING=false

# If not, set them:
railway variables --set MODE=live
railway variables --set DISABLE_POSTING=false

# Trigger redeploy
railway up
```

### Browser Crashes
**Symptom:** Logs show `[PW] ❌ Attempt 3 failed: Target page... closed`  
**Fix:**
```bash
# Enable tracing
railway variables --set PLAYWRIGHT_TRACE=on
railway up

# Wait for next post attempt
railway logs --follow | grep "PW"

# Download traces
railway run bash -c 'ls -lh /tmp/*.{png,zip}'
```

### Session Expired
**Symptom:** `Not logged in to Twitter`  
**Fix:**
```bash
# Create fresh session locally
node create_fresh_session.js

# Deploy to Railway
bash deploy_session.sh

# Verify
railway logs | grep "SESSION_SAVED"
```

### Memory Issues
**Symptom:** Container OOM killed  
**Fix:**
```bash
# Check memory usage
railway logs | grep "memory"

# Increase Railway service memory if needed (via dashboard)
# Or reduce posting frequency:
railway variables --set JOBS_POSTING_INTERVAL_MIN=10
```

---

## Rollback Procedure

### Immediate Stop (Emergency)
```bash
# Stop posting without rollback
railway variables --set DISABLE_POSTING=true
railway up
```

### Full Rollback
```bash
# Revert to previous commit
git log --oneline -5
git revert <commit-hash>
git push origin main

# Or reset hard (if safe)
git reset --hard <previous-commit>
git push origin main --force
```

---

## Monitoring Commands

### Watch All Logs
```bash
railway logs --service xbot-production --follow
```

### Watch Posting Only
```bash
railway logs --follow | grep -E "POSTING_|POST_"
```

### Watch Job Execution
```bash
railway logs --follow | grep -E "JOB_|HEARTBEAT"
```

### Check Last 100 Lines
```bash
railway logs --service xbot-production --lines 100
```

### Export Logs for Analysis
```bash
railway logs --lines 500 > logs_$(date +%Y%m%d_%H%M%S).txt
```

---

## Success Criteria

After deployment, verify:

✅ `/status` returns `mode: "live"`, `postingEnabled: true`  
✅ All 4 job timers registered: `plan`, `reply`, `posting`, `learn`  
✅ Smoke test posts successfully  
✅ Tweet appears on X timeline  
✅ No crash logs in Railway  
✅ Automatic posting cycle works (wait 5 min)  
✅ Browser profile directory exists: `/tmp/xbot-profile`  
✅ No FATAL errors in logs  

---

## Next Steps After Successful Deployment

1. **Monitor first hour:**
   - Watch for posting cycles
   - Verify tweets appear on X
   - Check engagement data collection

2. **Verify learning loop:**
   - Wait for learn job to run (120 min)
   - Check logs for `LEARN_JOB: coeffs_updated`
   - Verify predictor versions increment

3. **Scale if needed:**
   - Increase `MAX_POSTS_PER_HOUR` gradually
   - Adjust posting interval as needed
   - Monitor OpenAI costs

4. **Set up alerts:**
   - Railway notification webhooks
   - Monitor `/status` endpoint externally
   - Alert on FATAL errors

---

## Files Changed in This PR

### New Files
```
src/config/featureFlags.ts
src/infra/playwright/launcher.ts
src/infra/playwright/withBrowser.ts
src/posting/postNow.ts
src/server/routes/admin.ts
scripts/post_once.ts
test/jobsRegistration.test.ts
PR_AUTONOMOUS_SYSTEM.md
DEPLOYMENT_AUTONOMOUS.md
```

### Modified Files
```
src/jobs/jobManager.ts      (fail-fast logic + all 4 timers)
src/server.ts                (admin routes + enhanced /status)
Dockerfile                   (Playwright system deps)
package.json                 (version bump: 1.0.2 → 1.0.3)
```

---

## Support

If issues persist:
1. Check Railway logs for specific error
2. Review traces in `/tmp/` 
3. Verify all env vars are set correctly
4. Test session validity: `railway run node verify_session.js`
5. Open GitHub issue with logs (redact secrets!)

---

## Performance Benchmarks

**Expected metrics after 1 hour:**
- Posts generated: ~1 (based on MAX_POSTS_PER_HOUR)
- Replies generated: 0-2 (based on reply job interval)
- Learn cycles: 0 (first cycle at 120 min)
- Memory usage: ~400-500MB
- CPU usage: <10% (idle), ~50% (during posting)

**Expected metrics after 24 hours:**
- Posts: ~24
- Replies: ~10-15
- Learn cycles: ~12
- OpenAI cost: <$2 (with budget controls)

