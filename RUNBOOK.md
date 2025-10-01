# xBOT Operations Runbook

**Last Updated:** 2025-10-01  
**System:** Autonomous X/Twitter Bot (xBOT)  
**Platform:** Railway (production)

---

## 🚀 Quick Start

### Enable Live Posting

```bash
# Set MODE to live (enables real posting)
railway variables --service xbot-production --set MODE=live

# Restart the service (Railway auto-restarts on variable changes)
# Or manually restart:
railway restart --service xbot-production
```

### Seed After Deploy

```bash
# Generate content
railway run --service xbot-production -- npm run job:plan

# Post the generated content
railway run --service xbot-production -- npm run job:posting
```

---

## 📋 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MODE` | Operating mode: `live` or `shadow` | `live` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `REDIS_URL` | Redis connection string | `redis://...` |
| `SUPABASE_URL` | Supabase project URL | `https://...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_TOKEN` | Admin API access token | (none, admin API disabled) |
| `REAL_METRICS_ENABLED` | Enable real Twitter metrics collection | `false` |
| `DAILY_OPENAI_LIMIT_USD` | OpenAI daily budget limit | `5.0` |

### Legacy Variables (Deprecated)

⚠️ These are deprecated and mapped to `MODE`:
- `POSTING_DISABLED` → Use `MODE=shadow` instead
- `DRY_RUN` → Use `MODE=shadow` instead
- `LIVE_POSTS` → Use `MODE=live` instead

---

## 🔍 Troubleshooting

### Why is the system not posting?

**Check these in order:**

1. **MODE setting**
   ```bash
   railway variables --service xbot-production | grep MODE
   ```
   Should show `MODE=live`. If `MODE=shadow`, posting is disabled.

2. **Empty queue**
   Check logs for:
   ```
   [POSTING_QUEUE] ℹ️ No decisions ready for posting
   ```
   **Fix:** Run `npm run job:plan` to generate content.

3. **Quality gate failures**
   Check logs for:
   ```
   [GATE_CHAIN] ❌ Quality check failed
   [GATE_CHAIN] ❌ Duplicate detected
   ```
   **Fix:** System is working correctly, filtering low-quality content.

4. **OpenAI 429 errors**
   Check logs for:
   ```
   429 You exceeded your current quota
   [OPENAI_RETRY] ❌ Max retries exceeded
   ```
   **Fix:** Add credits to OpenAI account or wait for quota reset.

5. **Invalid Playwright session**
   Check logs for:
   ```
   [PLAYWRIGHT_SESSION_INVALID]
   [POST_ERROR] Failed to post: session expired
   ```
   **Fix:** Re-authenticate Twitter session (see Playwright Session section).

### Log Patterns (Grep Regex)

```bash
# Check posting activity
railway logs --service xbot-production --tail | grep -E "PLAN_JOB|POSTING_QUEUE|POST_"

# Check errors
railway logs --service xbot-production --tail | grep -E "ERROR|FAIL|❌"

# Check LLM calls
railway logs --service xbot-production --tail | grep -E "OPENAI|LLM_"

# Check job execution
railway logs --service xbot-production --tail | grep -E "JOB_PLAN|JOB_REPLY|JOB_POSTING|JOB_LEARN"

# Check retries and backoff
railway logs --service xbot-production --tail | grep -E "RETRY|BACKOFF"
```

---

## 🔐 Admin API

### Authentication

Admin endpoints require the `x-admin-token` header:

```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  https://your-railway-app.up.railway.app/admin/jobs
```

### Admin Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/admin/jobs` | GET | List available jobs |
| `/admin/jobs/run?name=plan` | POST | Run a specific job |
| `/admin/jobs/schedule` | GET | View job schedule |

---

## 🛠️ Maintenance Tasks

### View Logs (Press `q` to Exit)

```bash
# Follow live logs (stuck in less? press q)
railway logs --service xbot-production --tail

# Show last 300 lines
railway logs --service xbot-production --tail | tail -n 300

# Filter for specific job
railway logs --service xbot-production --tail | grep PLAN_JOB
```

### Run One-Off Jobs

```bash
# Plan content
railway run --service xbot-production -- npm run job:plan

# Post content
railway run --service xbot-production -- npm run job:posting

# Generate replies
railway run --service xbot-production -- npm run job:reply

# Run learning cycle
railway run --service xbot-production -- npm run job:learn
```

### Deploy

```bash
# Deploy current code
railway up --service xbot-production --yes

# Deploy from specific branch
git push origin main  # CI/CD auto-deploys
```

### Reset Redis Budget Counter

If the budget displays negative values:

```bash
railway run --service xbot-production -- npx tsx scripts/reset-redis-budget.ts
```

---

## 🧪 Health Checks

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/status` | Basic health check |
| `/canary` | Comprehensive system test (LLM, DB, Queue, Playwright) |
| `/playwright/ping` | Playwright session status |
| `/metrics` | System metrics |

### Example Health Check

```bash
curl https://your-railway-app.up.railway.app/canary

# Expected response:
{
  "ok": true,
  "mode": "live",
  "llm_ok": true,
  "db_ok": true,
  "queue_ok": true,
  "playwright_ok": true,
  "queue_count": 5
}
```

---

## 🔄 Operational Modes

### Shadow Mode (`MODE=shadow`)
- **LLM:** ✅ Enabled (real OpenAI calls)
- **Posting:** ❌ Disabled
- **Use case:** Testing content generation without posting

### Live Mode (`MODE=live`)
- **LLM:** ✅ Enabled
- **Posting:** ✅ Enabled
- **Use case:** Production operation

---

## 🐛 Common Issues

### Issue: "ADMIN_TOKEN not configured"

**Symptoms:** Admin endpoints return 503.

**Fix:**
```bash
railway variables --service xbot-production --set ADMIN_TOKEN=xbot-admin-2025
```

### Issue: "DATABASE_INSERT_ERROR: Cannot read properties of null"

**Symptoms:** `api_usage` table inserts fail.

**Fix:** This was fixed in recent deployment. If still occurring:
```bash
git pull origin main
railway up --service xbot-production --yes
```

### Issue: Negative budget display

**Symptoms:** Logs show `daily=$-0.10/1.50`

**Fix:** This is cosmetic. Budget refunds exceeded charges. Will self-correct or run:
```bash
railway run --service xbot-production -- npx tsx scripts/reset-redis-budget.ts
```

---

## 📞 Emergency Contacts

- **Platform:** Railway Dashboard
- **Logs:** `railway logs --service xbot-production --tail`
- **Errors:** Check `/canary` endpoint
- **Restart:** `railway restart --service xbot-production`

---

## 📚 Related Documentation

- [DEPLOYMENT_SUMMARY_V2.md](./DEPLOYMENT_SUMMARY_V2.md) - Deployment guide
- [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) - High-level overview
- [README_OPERATIONS.md](./README_OPERATIONS.md) - Operations guide
- [CANARY_VALIDATION.md](./CANARY_VALIDATION.md) - Validation tests
