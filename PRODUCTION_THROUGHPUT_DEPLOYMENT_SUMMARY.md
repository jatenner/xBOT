# ✅ PRODUCTION THROUGHPUT DEPLOYMENT SUMMARY

**Git Commit:** `f65e669e`  
**Status:** ✅ **READY FOR DEPLOYMENT**  
**Working Tree:** Clean (all changes committed)

---

## 🎯 GOAL

Raise production throughput from ~0.2 replies/hour toward 4 replies/hour WITHOUT weakening ghost protection or safety gates.

---

## ✅ COMPLETED TASKS

### 1. Repo Hygiene ✅

- ✅ All uncommitted changes committed
- ✅ Working tree clean
- ✅ No "deploy from dirty tree" risk

**Commits:**
- `14fc7f3d` - Reply system V2 production improvements
- `4ca355b2` - Production throughput improvements + role resolver
- `e42a5017` - Fix POSTING_QUEUE_MAX_ITEMS usage
- `f65e669e` - Add deployment commands document

---

### 2. Production Role Config Hardening ✅

**File:** `src/utils/serviceRoleResolver.ts` (NEW)

**Features:**
- ✅ Single source of truth for role detection
- ✅ Resolution order:
  1. SERVICE_ROLE env var (if set)
  2. Infer from RAILWAY_SERVICE_NAME (serene-cat=worker, xBOT=main)
  3. Default to 'unknown' (safe - blocks posting)
- ✅ Used consistently in:
  - `src/posting/UltimateTwitterPoster.ts` (2 locations)
  - `src/posting/BulletproofThreadComposer.ts`
  - `src/jobs/postingQueue.ts`
  - `src/railwayEntrypoint.ts` (boot logging)

**Boot Log Output:**
```
[BOOT] Service type: WORKER
[BOOT] Resolved role: worker (source: RAILWAY_SERVICE_NAME)
[BOOT] SERVICE_ROLE: NOT SET
[BOOT] RAILWAY_SERVICE_NAME: serene-cat
```

**Ghost Protection:** ✅ Maintained (fallback preserved, standardized)

---

### 3. Throughput Diagnosis Automation ✅

**Enhanced:** `scripts/reply_funnel_dashboard.ts`

**New Features:**
- ✅ Acceptance rates per stage (fetched→evaluated→hardpass→queued→permit→used→posted)
- ✅ Bottleneck identification (smallest conversion stage)
- ✅ Top 5 reject reasons aggregated (hard filter + judge)

**New Script:** `scripts/throughput_autotune_report.ts`

**Features:**
- ✅ Reads last 6h metrics
- ✅ Outputs recommended knob changes based on bottleneck stage
- ✅ Success criteria check
- ✅ Implementation instructions

---

### 4. Safe Throughput Knobs ✅

**All gated by env vars (safe, reversible):**

1. **REPLY_V2_TICK_SECONDS**
   - Default: `900` (15 min)
   - Location: `src/jobs/jobManager.ts`, `src/jobs/replySystemV2/tieredScheduler.ts`
   - Effect: Scheduler frequency

2. **REPLY_V2_MAX_QUEUE_PER_TICK**
   - Default: `25`
   - Location: `src/jobs/replySystemV2/queueManager.ts`
   - Effect: Max candidates in queue

3. **REPLY_V2_MAX_EVAL_PER_TICK**
   - Default: `0` (unlimited)
   - Location: `src/jobs/replySystemV2/orchestrator.ts`
   - Effect: Max candidates evaluated per fetch cycle

4. **POSTING_QUEUE_MAX_ITEMS**
   - Default: `2`
   - Location: `src/jobs/postingQueue.ts`
   - Effect: Max items processed per posting queue cycle

**Safety Gates Unchanged:**
- ✅ Root-only requirement
- ✅ No self-reply
- ✅ Permit gating and trace chain
- ✅ Ghost prevention invariants

---

### 5. Verification Plan ✅

**File:** `THROUGHPUT_VERIFICATION_PLAN.md`

**Includes:**
- ✅ Exact commands for local + Railway execution
- ✅ Success criteria checklist
- ✅ Troubleshooting guide
- ✅ Expected output examples

---

## 🚀 DEPLOYMENT COMMANDS

```bash
# 1. Verify clean tree
git status
# Should show: "nothing to commit, working tree clean"

# 2. Deploy worker service
railway up --detach -s serene-cat

# 3. Deploy main service
railway up --detach -s xBOT

# 4. Wait for boot (30 seconds)
sleep 30

# 5. Verify boot logs
railway logs -s serene-cat --tail 50 | grep -E "\[BOOT\]|Resolved role"
railway logs -s xBOT --tail 50 | grep -E "\[BOOT\]|Resolved role"
```

---

## 📊 VERIFICATION COMMANDS

### Run Reports Locally

```bash
# Funnel dashboard
pnpm exec tsx scripts/reply_funnel_dashboard.ts

# Throughput autotune report
pnpm exec tsx scripts/throughput_autotune_report.ts

# Production report
pnpm exec tsx scripts/reply_production_report.ts
```

### Run Reports in Production

```bash
# Funnel dashboard
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts

# Throughput autotune report
railway run -s serene-cat -- pnpm exec tsx scripts/throughput_autotune_report.ts

# Production report
railway run -s serene-cat -- pnpm exec tsx scripts/reply_production_report.ts
```

---

## 📈 EXPECTED OUTPUTS

### Funnel Dashboard Output

```
=== REPLY FUNNEL DASHBOARD ===

| Metric | Last 6h | Last 24h |
|--------|---------|----------|
| Fetch started | 2 | 68 |
| Candidates evaluated | 61 | 821 |
| Passed hard filters | 15 | 237 |
| Queue size (min/avg/max) | 0/1.3/9 | 0/0.4/9 |
| Scheduler ticks | 28 | 54 |
| Permits used | 1 | 1 |
| Reply posted | 1 | 1 |

=== BOTTLENECK ANALYSIS (24h) ===

| Stage | Acceptance Rate |
|-------|-----------------|
| Fetched → Evaluated | 95.2% |
| Evaluated → Hard Pass | 28.9% |
| Hard Pass → Queued | 12.5% |
| Queued → Permit | 25.0% |
| Permit → Used | 16.7% |
| Used → Posted | 100.0% |

🔴 BOTTLENECK: hardpass→queued (12.5%)

=== TOP 5 REJECT REASONS (24h) ===

| Rank | Reason | Count |
|------|--------|-------|
| 1 | rejected_low_velocity | 45 |
| 2 | judge_reject | 32 |
| 3 | not_root_tweet | 28 |
| 4 | rejected_low_conversation | 15 |
| 5 | insufficient_text | 12 |
```

### Throughput Autotune Report Output

```
=== THROUGHPUT AUTOTUNE REPORT ===

=== CURRENT STATE (6h) ===

Throughput: 0.17 replies/hour (target: 4/hour)
Bottleneck: hardpass→queued
Queue size: 1.3 avg
Scheduler ticks: 28
Permits used: 1
Replies posted: 1

=== RECOMMENDED KNOB CHANGES ===

| Priority | Knob | Current | Recommended | Reason |
|----------|------|---------|-------------|--------|
| 🔴 high | REPLY_V2_MAX_QUEUE_PER_TICK | 25 | 35-40 | Only 12.5% of passed candidates are queued |
| 🔴 high | REPLY_V2_TICK_SECONDS | 900 (15 min) | 600 (10 min) | Only 4.7 scheduler ticks/hour - increase frequency |

=== SUCCESS CRITERIA CHECK ===

❌ Throughput >= 2/hour: 0.17/hour
✅ 0 ghosts: 1 used = 1 posted
❌ Queue size >= 10: 1.3
```

---

## ✅ SUCCESS CRITERIA (Check within 6 hours)

- [ ] **Throughput:** >= 2 replies/hour (first milestone, target: 4/hour)
- [ ] **Ghosts:** 0 (permits USED count equals reply_posted count)
- [ ] **Queue Health:** Avg queue size >= 10 candidates
- [ ] **Traceability:** All replies have permit USED + reply_posted events

---

## 🔧 OPTIONAL: SET THROUGHPUT KNOBS

If throughput is still low after deployment:

```bash
# Increase scheduler frequency (10 min instead of 15 min)
railway variables set REPLY_V2_TICK_SECONDS=600 -s serene-cat

# Increase queue size
railway variables set REPLY_V2_MAX_QUEUE_PER_TICK=35 -s serene-cat

# Increase posting queue processing
railway variables set POSTING_QUEUE_MAX_ITEMS=3 -s serene-cat
```

**Note:** Changes take effect on next service restart (Railway auto-restarts).

---

## 📝 FILES CHANGED

### New Files:
- `src/utils/serviceRoleResolver.ts` - Role resolution utility
- `scripts/throughput_autotune_report.ts` - Autotune recommendations
- `THROUGHPUT_VERIFICATION_PLAN.md` - Verification guide
- `DEPLOYMENT_COMMANDS.md` - Deployment instructions
- `PRODUCTION_THROUGHPUT_DEPLOYMENT_SUMMARY.md` - This file

### Modified Files:
- `src/railwayEntrypoint.ts` - Use role resolver, boot logging
- `src/posting/UltimateTwitterPoster.ts` - Use role resolver (2 locations)
- `src/posting/BulletproofThreadComposer.ts` - Use role resolver
- `src/jobs/postingQueue.ts` - Use role resolver, add POSTING_QUEUE_MAX_ITEMS knob
- `src/jobs/jobManager.ts` - Add REPLY_V2_TICK_SECONDS knob
- `src/jobs/replySystemV2/tieredScheduler.ts` - Add REPLY_V2_TICK_SECONDS knob
- `src/jobs/replySystemV2/queueManager.ts` - Add REPLY_V2_MAX_QUEUE_PER_TICK knob
- `src/jobs/replySystemV2/orchestrator.ts` - Add REPLY_V2_MAX_EVAL_PER_TICK knob
- `scripts/reply_funnel_dashboard.ts` - Add bottleneck analysis + reject reasons

---

## 🛡️ SAFETY GUARANTEES

- ✅ **Ghost Protection:** Maintained (role resolver + permit gating)
- ✅ **Safety Gates:** Unchanged (root-only, no self-reply, etc.)
- ✅ **Reversibility:** All knobs via env vars (easy to revert)
- ✅ **Traceability:** Full event chain preserved

---

**Status:** ✅ **READY FOR DEPLOYMENT**

**Next Steps:**
1. Run deployment commands above
2. Verify boot logs show resolved role
3. Run reports after 6 hours
4. Adjust knobs based on recommendations if needed
