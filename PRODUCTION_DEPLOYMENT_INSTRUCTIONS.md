# 🚀 PRODUCTION DEPLOYMENT INSTRUCTIONS

**Date:** January 2026  
**Goal:** Deploy Reply System V2 improvements for 4 replies/hour production throughput

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [x] Reply Funnel Dashboard script created (`scripts/reply_funnel_dashboard.ts`)
- [x] Candidate quality improvements (momentum + audience fit signals)
- [x] Account discovery system implemented (`src/jobs/replySystemV2/accountDiscovery.ts`)
- [x] Discovered accounts feed enhanced (15% weight, 3 accounts/run)
- [x] Production report script created (`scripts/reply_production_report.ts`)

---

## 🚀 DEPLOYMENT STEPS

### 1. Build and Test Locally

```bash
# Install dependencies
pnpm install

# Run TypeScript build check
pnpm run build

# Test dashboard script
pnpm exec tsx scripts/reply_funnel_dashboard.ts

# Test production report
pnpm exec tsx scripts/reply_production_report.ts
```

### 2. Deploy via Railway CLI

#### Deploy Worker Service

```bash
# Navigate to project root
cd /Users/jonahtenner/Desktop/xBOT

# Deploy worker service (runs reply jobs)
railway up --service worker --detach

# Verify deployment
railway logs --service worker --tail 50
```

#### Deploy Main Service

```bash
# Deploy main service (API + webhooks)
railway up --service main --detach

# Verify deployment
railway logs --service main --tail 50
```

### 3. Verify Deployment

```bash
# Check worker logs for reply system activity
railway logs --service worker | grep -i "reply\|orchestrator\|scheduler"

# Check for errors
railway logs --service worker | grep -i "error\|failed"

# Verify account discovery is running
railway logs --service worker | grep -i "account_discovery"
```

---

## 📊 POST-DEPLOYMENT VERIFICATION

### 1. Run Funnel Dashboard

```bash
pnpm exec tsx scripts/reply_funnel_dashboard.ts
```

**Expected Output:**
- Fetch started/completed events logged
- Candidates evaluated and passed filters
- Queue size >= 10
- Permits created and used
- Reply posted events

### 2. Run Production Report

```bash
pnpm exec tsx scripts/reply_production_report.ts
```

**Expected Output:**
- Funnel metrics table (6h/24h)
- Top 20 accepted candidates with scores
- Top 20 rejected candidates with reasons
- Threshold recommendations

### 3. Monitor Metrics

**Key Metrics to Watch:**
- **Throughput:** >= 4 replies/hour
- **Success Rate:** >= 60% with >=1000 views
- **Queue Size:** >= 15 candidates
- **Permits Used:** Should match reply_posted events
- **Ghosts:** 0 (verify via `scripts/gold_proof_report.ts`)

---

## 🔧 CONFIGURATION ADJUSTMENTS

### Control Plane Settings

If throughput is low, adjust in `control_plane_state`:

```sql
-- Increase discovered_accounts feed weight
UPDATE control_plane_state
SET feed_weights = jsonb_set(
  feed_weights,
  '{discovered_accounts}',
  '0.20'
)
WHERE expires_at IS NULL;

-- Lower acceptance threshold if needed
UPDATE control_plane_state
SET acceptance_threshold = 0.55  -- Lower from 0.60
WHERE expires_at IS NULL;
```

### Candidate Scoring Thresholds

If quality is low, adjust in `src/jobs/replySystemV2/candidateScorer.ts`:

```typescript
// Increase velocity threshold
const MIN_LIKES_PER_HOUR = 3; // Increase from 2

// Increase expected views threshold
const MIN_EXPECTED_VIEWS = 800; // Increase from 500
```

---

## 📈 MONITORING COMMANDS

### Check Reply System Status

```bash
# View recent reply_posted events
railway run psql "$DATABASE_URL" -c "
SELECT event_type, COUNT(*) 
FROM system_events 
WHERE event_type = 'reply_posted' 
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
"

# Check permit usage
railway run psql "$DATABASE_URL" -c "
SELECT status, COUNT(*) 
FROM post_attempts 
WHERE pipeline_source = 'reply_v2_scheduler'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
"

# Check queue size
railway run psql "$DATABASE_URL" -c "
SELECT COUNT(*) as queue_size
FROM reply_candidate_queue
WHERE status = 'queued'
  AND expires_at > NOW();
"
```

### Check Account Discovery

```bash
# View discovered accounts
railway run psql "$DATABASE_URL" -c "
SELECT username, priority_score, performance_tier, total_replies_count
FROM discovered_accounts
ORDER BY priority_score DESC
LIMIT 20;
"

# Check discovery events
railway run psql "$DATABASE_URL" -c "
SELECT event_type, COUNT(*), MAX(created_at) as last_run
FROM system_events
WHERE event_type = 'account_discovery_completed'
GROUP BY event_type;
"
```

---

## 🐛 TROUBLESHOOTING

### Low Throughput (< 4/hour)

1. **Check Queue Size:**
   ```bash
   railway run psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM reply_candidate_queue WHERE status = 'queued';"
   ```

2. **Check Scheduler Runs:**
   ```bash
   railway logs --service worker | grep "scheduler_job_started" | tail -20
   ```

3. **Increase Feed Weights:**
   - Increase `discovered_accounts` weight to 0.20
   - Lower `acceptance_threshold` to 0.55

### Low Success Rate (< 60% >=1000 views)

1. **Check Views Distribution:**
   ```bash
   pnpm exec tsx scripts/reply_production_report.ts | grep "Success rate"
   ```

2. **Increase Quality Thresholds:**
   - Increase `MIN_LIKES_PER_HOUR` to 3
   - Increase `MIN_EXPECTED_VIEWS` to 800

### Ghost Replies (permits created but no reply_posted)

1. **Check Posting Queue:**
   ```bash
   railway logs --service worker | grep "postingQueue\|reply_posted" | tail -50
   ```

2. **Verify Permit Status:**
   ```bash
   railway run psql "$DATABASE_URL" -c "
   SELECT permit_id, status, created_at, used_at
   FROM post_attempts
   WHERE pipeline_source = 'reply_v2_scheduler'
     AND status != 'USED'
     AND created_at > NOW() - INTERVAL '2 hours';
   "
   ```

---

## ✅ SUCCESS CRITERIA

After deployment, verify:

- ✅ **Throughput:** >= 4 replies/hour (check 24h metrics)
- ✅ **Quality:** >= 60% success rate (>=1000 views)
- ✅ **Traceability:** 0 ghosts (permit USED + reply_posted match)
- ✅ **Queue Health:** Avg queue size >= 15
- ✅ **Account Discovery:** Running every 6 hours, discovering new accounts

---

## 📝 NOTES

- Account discovery runs automatically every 6 hours via orchestrator
- Dashboard and report scripts can be run locally or via Railway CLI
- All metrics are stored in database - no external monitoring needed
- Thresholds can be adjusted via control_plane_state table

---

**Deployment Date:** [TBD]  
**Deployed By:** [TBD]  
**Status:** Ready for deployment
