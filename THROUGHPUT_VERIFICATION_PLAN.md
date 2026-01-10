# 📊 THROUGHPUT VERIFICATION PLAN

**Goal:** Raise production throughput from ~0.2 replies/hour toward 4 replies/hour

---

## ✅ SUCCESS CRITERIA

After deployment, verify within 6 hours:

- [ ] **Throughput:** >= 2 replies/hour (first milestone, target: 4/hour)
- [ ] **Ghosts:** 0 (permits USED count equals reply_posted count)
- [ ] **Queue Health:** Avg queue size >= 10 candidates
- [ ] **Traceability:** All replies have permit USED + reply_posted events

---

## 🚀 DEPLOYMENT COMMANDS

```bash
# 1. Ensure clean tree
git status

# 2. Deploy worker service
railway up --detach -s serene-cat

# 3. Deploy main service
railway up --detach -s xBOT

# 4. Wait for services to boot (30 seconds)
sleep 30

# 5. Verify boot logs
railway logs -s serene-cat --tail 50 | grep -E "\[BOOT\]|Resolved role"
railway logs -s xBOT --tail 50 | grep -E "\[BOOT\]|Resolved role"
```

---

## 📊 VERIFICATION COMMANDS

### Run Funnel Dashboard (Local)

```bash
pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

**Expected Output:**
- Funnel metrics table (6h/24h)
- Bottleneck analysis section
- Top 5 reject reasons
- Acceptance rates per stage

### Run Funnel Dashboard (Production)

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

### Run Throughput Autotune Report (Local)

```bash
pnpm exec tsx scripts/throughput_autotune_report.ts
```

**Expected Output:**
- Current state (6h metrics)
- Recommended knob changes
- Implementation instructions
- Success criteria check

### Run Throughput Autotune Report (Production)

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/throughput_autotune_report.ts
```

### Run Production Report (Local)

```bash
pnpm exec tsx scripts/reply_production_report.ts
```

### Run Production Report (Production)

```bash
railway run -s serene-cat -- pnpm exec tsx scripts/reply_production_report.ts
```

---

## 🔧 THROUGHPUT KNOBS (Environment Variables)

All knobs are safe, reversible, and gated by env vars:

### Available Knobs

1. **REPLY_V2_TICK_SECONDS**
   - Default: `900` (15 minutes)
   - Effect: How often scheduler runs
   - Safe range: `600-900` (10-15 min)
   - To increase throughput: Lower to `600` (10 min = 6 ticks/hour)

2. **REPLY_V2_MAX_QUEUE_PER_TICK**
   - Default: `25`
   - Effect: Max candidates in queue
   - Safe range: `25-40`
   - To increase throughput: Raise to `35-40`

3. **REPLY_V2_MAX_EVAL_PER_TICK**
   - Default: `0` (unlimited)
   - Effect: Max candidates evaluated per fetch cycle
   - Safe range: `0-100` (0 = unlimited)
   - To limit cost: Set to `50-100`

4. **POSTING_QUEUE_MAX_ITEMS**
   - Default: `2`
   - Effect: Max items processed per posting queue cycle
   - Safe range: `2-5`
   - To increase throughput: Raise to `3-4`

### Setting Knobs in Railway

```bash
# Via Railway CLI
railway variables set REPLY_V2_TICK_SECONDS=600 -s serene-cat
railway variables set REPLY_V2_MAX_QUEUE_PER_TICK=35 -s serene-cat
railway variables set POSTING_QUEUE_MAX_ITEMS=3 -s serene-cat

# Or via Railway Dashboard:
# Project → serene-cat service → Variables → Add Variable
```

---

## 📈 EXPECTED OUTPUT EXAMPLES

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
| 🟡 medium | Feed weights (discovered_accounts) | 0.15 | 0.20 | Queue size 1.3 < 10 - need more supply |

=== SUCCESS CRITERIA CHECK ===

❌ Throughput >= 2/hour: 0.17/hour
✅ 0 ghosts: 1 used = 1 posted
❌ Queue size >= 10: 1.3
```

---

## 🐛 TROUBLESHOOTING

### If Throughput Still Low After Knob Changes

1. **Check Bottleneck:**
   ```bash
   railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts | grep BOTTLENECK
   ```

2. **Check Queue Size:**
   ```bash
   railway run psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM reply_candidate_queue WHERE status = 'queued' AND expires_at > NOW();"
   ```

3. **Check Scheduler Activity:**
   ```bash
   railway logs -s serene-cat | grep "scheduler_job_started" | tail -20
   ```

4. **Check Permit Usage:**
   ```bash
   railway run psql "$DATABASE_URL" -c "SELECT status, COUNT(*) FROM post_attempts WHERE pipeline_source = 'reply_v2_scheduler' AND created_at > NOW() - INTERVAL '6 hours' GROUP BY status;"
   ```

### If Ghosts Detected

1. **Check Permit Status:**
   ```bash
   railway run psql "$DATABASE_URL" -c "SELECT permit_id, status, used_at FROM post_attempts WHERE pipeline_source = 'reply_v2_scheduler' AND status != 'USED' AND created_at > NOW() - INTERVAL '2 hours';"
   ```

2. **Check Reply Posted Events:**
   ```bash
   railway run psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM system_events WHERE event_type = 'reply_posted' AND created_at > NOW() - INTERVAL '6 hours';"
   ```

---

## 📝 NOTES

- All knobs are reversible - just remove or change env vars
- Ghost protection remains intact (role resolver + permit gating)
- Safety gates unchanged (root-only, no self-reply, etc.)
- Changes take effect on next service restart

---

**Last Updated:** January 2026  
**Status:** Ready for deployment
