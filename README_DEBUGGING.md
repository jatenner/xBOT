# 🔧 DEBUGGING & MONITORING GUIDE

**Problem:** Railway logs stall, fail, or are slow  
**Solution:** Use these fast, reliable commands instead

---

## 🚀 QUICK COMMANDS

### Check if system is alive
```bash
pnpm check
```
**What it does:** Hits all health endpoints, checks database, verifies integrity  
**Use when:** You want to know if the system is working (30 seconds)

### Analyze posting issues
```bash
pnpm analyze
```
**What it does:** Deep dive into:
- Posts without receipts
- Receipts not synced
- Stuck posts
- Failed posts
- Rate limit violations

**Use when:** Posts aren't being saved correctly

### Full system diagnosis
```bash
pnpm diagnose
```
**What it does:** Checks queue, last post, failures, reply opportunities  
**Use when:** You need detailed system state

### Check specific tweets
```bash
pnpm check-tweets
```
**What it does:** Verifies if recent tweets are in database  
**Use when:** You posted something and want to verify it saved

---

## 📊 ENDPOINTS (No CLI Needed!)

### Basic health
```bash
curl https://xbot-production-844b.up.railway.app/status | jq
```

### System internals
```bash
curl https://xbot-production-844b.up.railway.app/api/system/health | jq
```

### Queue status
```bash
curl https://xbot-production-844b.up.railway.app/api/diagnostics/health | jq
```

---

## 🎯 COMMON ISSUES & FIXES

### Issue: "Posts going to Twitter but not database"
```bash
pnpm analyze
# Look for section: POSTS WITHOUT RECEIPTS
```
**Fix:** Check if `postReceiptWriter` is failing

### Issue: "Queue is stuck"
```bash
pnpm check
# Look for: Queue Status
```
**Fix:** Check browser pool, posting job may be paused

### Issue: "Rate limit violations"
```bash
pnpm analyze
# Look for section: POSTING RATE ANALYSIS
```
**Fix:** Verify `MAX_POSTS_PER_HOUR=2` in Railway

### Issue: "System not responding"
```bash
curl https://xbot-production-844b.up.railway.app/status
```
**Fix:** If no response, restart Railway service

---

## 🔍 INVESTIGATION WORKFLOW

**When something is wrong:**

1. **Quick health check** (10 seconds)
   ```bash
   pnpm check
   ```

2. **If posting issues** (30 seconds)
   ```bash
   pnpm analyze
   ```

3. **If need detailed state** (1 minute)
   ```bash
   pnpm diagnose
   ```

4. **Verify specific tweets** (15 seconds)
   ```bash
   pnpm check-tweets
   ```

---

## 📁 SCRIPT LOCATIONS

- `scripts/live-system-check.ts` - Main health checker
- `scripts/analyze-posting-issues.ts` - Posting deep dive
- `scripts/diagnose-system-now.ts` - Full system state
- `scripts/check-recent-tweets.ts` - Tweet verification

---

## 🚨 EMERGENCY COMMANDS

### Restart service
```bash
railway up --service xBOT
```

### Check ENV variables
```bash
railway variables --json | grep -E "MAX_POSTS|ENABLE_TRUTH"
```

### Force immediate post
```bash
pnpm post-now
```

---

## ✅ NO MORE:

❌ `railway logs` (stalls, fails, slow)  
❌ `railway run tsx scripts/...` (slow, SSL issues)  
❌ Manually querying database  

✅ `pnpm check` (fast, reliable)  
✅ `pnpm analyze` (detailed insights)  
✅ `curl` endpoints (instant status)  

---

**All commands run in <60 seconds and give actionable results!**

