# 🚀 DEPLOYMENT COMMANDS

**Git Commit:** `4ca355b2`  
**Status:** ✅ All changes committed, ready for deployment

---

## 📋 PRE-DEPLOYMENT CHECK

```bash
# Verify clean tree
git status

# Should show: "nothing to commit, working tree clean"
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Deploy Worker Service (serene-cat)

```bash
railway up --detach -s serene-cat
```

**Expected Output:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/...
```

### 2. Deploy Main Service (xBOT)

```bash
railway up --detach -s xBOT
```

**Expected Output:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/...
```

### 3. Verify Boot (Wait 30 seconds)

```bash
# Check worker service boot logs
railway logs -s serene-cat --tail 50 | grep -E "\[BOOT\]|Resolved role"

# Check main service boot logs
railway logs -s xBOT --tail 50 | grep -E "\[BOOT\]|Resolved role"
```

**Expected Output:**
```
[BOOT] Service type: WORKER
[BOOT] Resolved role: worker (source: RAILWAY_SERVICE_NAME)
[BOOT] SERVICE_ROLE: NOT SET
[BOOT] RAILWAY_SERVICE_NAME: serene-cat
```

---

## 📊 VERIFICATION COMMANDS

### Run Funnel Dashboard (Production)

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

**Expected Output:**
- Funnel metrics table (6h/24h)
- Bottleneck analysis section
- Top 5 reject reasons
- Acceptance rates per stage

### Run Throughput Autotune Report (Production)

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/throughput_autotune_report.ts
```

**Expected Output:**
- Current state (6h metrics)
- Recommended knob changes
- Implementation instructions
- Success criteria check

### Run Production Report (Production)

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_production_report.ts
```

---

## 🔧 OPTIONAL: SET THROUGHPUT KNOBS

If throughput is still low after deployment, set these env vars:

```bash
# Increase scheduler frequency (10 min instead of 15 min)
railway variables set REPLY_V2_TICK_SECONDS=600 -s serene-cat

# Increase queue size
railway variables set REPLY_V2_MAX_QUEUE_PER_TICK=35 -s serene-cat

# Increase posting queue processing
railway variables set POSTING_QUEUE_MAX_ITEMS=3 -s serene-cat
```

**Note:** Changes take effect on next service restart. Railway will auto-restart after setting vars.

---

## ✅ SUCCESS CRITERIA (Check within 6 hours)

- [ ] **Throughput:** >= 2 replies/hour (first milestone)
- [ ] **Ghosts:** 0 (permits USED = reply_posted)
- [ ] **Queue Health:** Avg queue size >= 10
- [ ] **Traceability:** All replies have permit USED + reply_posted events

---

**Deployment Date:** [TBD]  
**Deployed By:** [TBD]  
**Status:** Ready for deployment
