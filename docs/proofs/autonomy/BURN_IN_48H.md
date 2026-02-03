# 🔥 48-HOUR BURN-IN PLAN

**Start Date:** February 3, 2026  
**Status:** ⏳ **PENDING** - Awaiting deployment

---

## BURN-IN OBJECTIVES

1. ✅ Verify hourly tick executes reliably
2. ✅ Confirm WARMUP mode defaults work
3. ✅ Verify replies posted (≥5 total)
4. ✅ Verify timeline posts posted (≥1 OR 0 if controller decides)
5. ✅ Confirm learning loop runs and updates weights
6. ✅ Verify metrics polling works

---

## TIMELINE

### Hour 0-24: WARMUP Phase
- **Mode:** WARMUP (default)
- **Expected:** 1 reply/hour (peak), 0 posts/hour initially
- **Targets:** ~12-24 replies, 0 posts

### Hour 24-48: Monitor Transition
- **Mode:** May transition to GROWTH if yield > 5% ER
- **Expected:** Up to 4 replies/hour, 1 post/hour
- **Targets:** ~24-48 replies, 1-2 posts

---

## VERIFICATION CHECKLIST

### Hour 0 (Deployment)
- [ ] Migration applied
- [ ] Schema preflight passes
- [ ] Hourly tick scheduled
- [ ] First tick executes

### Hour 12
- [ ] Check rate_controller_state (12 rows)
- [ ] Verify replies posted (≥6)
- [ ] Check logs for errors

### Hour 24
- [ ] Check hour_weights table (updated)
- [ ] Check strategy_weights table (updated)
- [ ] Run metrics poll: `railway run pnpm exec tsx scripts/ops/poll-reply-metrics.ts --limit=10`
- [ ] Verify learning loop ran

### Hour 48
- [ ] Final verification:
  - Total replies: ≥5
  - Total posts: ≥1 OR 0 (if controller decided)
  - Learning loop: Ran at least once
  - Weights updated: Yes

---

## SQL QUERIES FOR VERIFICATION

### Check Replies Posted
```sql
SELECT COUNT(*) as total_replies
FROM content_metadata
WHERE decision_type = 'reply'
AND status = 'posted'
AND posted_at > NOW() - INTERVAL '48 hours';
```

### Check Timeline Posts Posted
```sql
SELECT COUNT(*) as total_posts
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
AND status = 'posted'
AND posted_at > NOW() - INTERVAL '48 hours';
```

### Check Hour Weights Updated
```sql
SELECT hour_bucket, weight, total_posts, avg_outcome_score
FROM hour_weights
WHERE updated_at > NOW() - INTERVAL '48 hours'
ORDER BY weight DESC
LIMIT 5;
```

### Check Strategy Weights Updated
```sql
SELECT strategy_id, weight, total_posts, avg_outcome_score
FROM strategy_weights
WHERE updated_at > NOW() - INTERVAL '48 hours'
ORDER BY weight DESC
LIMIT 5;
```

### Check Rate Controller State
```sql
SELECT hour_start, mode, target_replies_this_hour, target_posts_this_hour,
       executed_replies, executed_posts, risk_score, yield_score
FROM rate_controller_state
WHERE hour_start > NOW() - INTERVAL '48 hours'
ORDER BY hour_start DESC;
```

---

## METRICS POLLING

### Run Poll Script
```bash
railway run pnpm exec tsx scripts/ops/poll-reply-metrics.ts --limit=10
```

**Expected:** Updates `actual_likes`, `actual_replies`, `actual_retweets` for recent posts

---

## SUCCESS CRITERIA

### Minimum (PASS)
- ✅ Hourly tick executes every hour
- ✅ ≥5 replies posted in 48 hours
- ✅ Learning loop runs at least once
- ✅ Weights tables updated
- ✅ No critical errors

### Optimal (PASS+)
- ✅ ≥20 replies posted
- ✅ ≥1 timeline post posted
- ✅ Mode transitions from WARMUP to GROWTH
- ✅ Yield score > 0.01 (1% ER)
- ✅ Risk score < 0.3

---

## RISK MONITORING

### Watch For
- 429 errors → Should trigger COOLDOWN mode
- Login walls → Should trigger COOLDOWN mode
- High risk_score → Should reduce targets
- Low yield_score → Should stay in WARMUP

### Alerts
- If 429 occurs: Check `bot_backoff_state` table
- If no replies posted: Check `rate_controller_state` for mode
- If learning loop fails: Check `system_events` for errors

---

**Status:** ⏳ **AWAITING DEPLOYMENT**
