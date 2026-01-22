# 🚦 24H BAKE FINAL GO/NO-GO DECISION

**Date:** 2026-01-22  
**Bake Period:** 2026-01-22T19:50:00Z to 2026-01-23T19:50:00Z  
**Mode:** PROD-ONLY (ALLOW_TEST_POSTS unset)  
**Decision:** ⏳ PENDING (Run at 24h mark)

---

## PASS/FAIL CHECKLIST

### ✅ A) Plan Continuity

**Requirement:** Expected vs actual hourly windows (generate_series)

**Check:**
```sql
SELECT COUNT(*) as expected_plans, 
       (SELECT COUNT(*) FROM growth_plans WHERE window_start >= NOW() - INTERVAL '24 hours') as actual_plans
FROM generate_series(
  NOW() - INTERVAL '24 hours',
  NOW(),
  '1 hour'::interval
) AS hour;
```

**Expected:** 24 plans (one per hour)  
**Actual:** (Run at 24h mark)  
**Status:** ⏳ PENDING

**Pass Criteria:** ≥ 20 plans present (allow for 4h grace period)

---

### ✅ B) Posting Outcomes

**Requirement:** POST_SUCCESS count by hour + URLs verified

**Check:**
- All POST_SUCCESS tweet_ids are 18-20 digits
- URLs load (HTTP 200)

**Status:** ⏳ PENDING (Run at 24h mark)

**Pass Criteria:**
- All tweet_ids valid (18-20 digits)
- ≥ 80% URLs load successfully

---

### ✅ C) Replies

**Requirement:** Reply attempts / successes / DENY reasons (CONSENT_WALL etc.)

**Check:**
```sql
-- Reply attempts
SELECT COUNT(*) FROM system_events 
WHERE event_type = 'POST_ATTEMPT' 
  AND event_data->>'decision_type' = 'reply'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- Reply successes
SELECT COUNT(*) FROM system_events 
WHERE event_type = 'REPLY_SUCCESS'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- DENY reasons
SELECT deny_reason_code, COUNT(*) 
FROM reply_decisions
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY deny_reason_code;
```

**Status:** ⏳ PENDING (Run at 24h mark)

**Pass Criteria:**
- Reply system operational (attempts > 0)
- DENY reasons structured (no NULL/OTHER)

---

### ✅ D) Resistance

**Requirement:** CONSENT_WALL / CHALLENGE / POST_FAILED by hour

**Check:**
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  event_type,
  COUNT(*) as count
FROM system_events
WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), event_type;
```

**Status:** ⏳ PENDING (Run at 24h mark)

**Pass Criteria:**
- CONSENT_WALL < 20% of reply attempts
- CHALLENGE < 5% of posting attempts
- POST_FAILED < 10% of posting attempts

---

### ✅ E) Overruns

**Requirement:** Must be 0

**Check:**
```sql
SELECT COUNT(*) AS overruns
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
  AND gp.window_start >= NOW() - INTERVAL '24 hours';
```

**Status:** ⏳ PENDING (Run at 24h mark)

**Pass Criteria:** **MUST BE 0** (hard requirement)

---

### ✅ F) PROD vs TEST

**Requirement:** TEST must be 0

**Check:**
```sql
-- POST_SUCCESS_TEST events
SELECT COUNT(*) FROM system_events 
WHERE event_type = 'POST_SUCCESS_TEST'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- Test posts in content_metadata
SELECT COUNT(*) FROM content_metadata
WHERE is_test_post = true
  AND status = 'posted'
  AND posted_at >= NOW() - INTERVAL '24 hours';
```

**Status:** ⏳ PENDING (Run at 24h mark)

**Pass Criteria:** **MUST BE 0** (hard requirement)

---

### ✅ G) Stuck States

**Requirement:** No stuck content_metadata (posting/queued/failed) with old ages

**Check:**
```sql
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/3600 as oldest_hours
FROM content_metadata
WHERE status IN ('queued', 'posting', 'failed', 'blocked')
GROUP BY status;
```

**Status:** ⏳ PENDING (Run at 24h mark)

**Pass Criteria:**
- No `posting` status > 1 hour old
- No `queued` status > 24 hours old (unless scheduled for future)
- Failed/blocked states acceptable (expected)

---

## DECISION MATRIX

| Check | Weight | Pass Criteria | Status |
|-------|--------|---------------|--------|
| A) Plan Continuity | High | ≥ 20 plans | ⏳ PENDING |
| B) Posting Outcomes | High | Valid IDs, URLs load | ⏳ PENDING |
| C) Replies | Medium | Operational, structured | ⏳ PENDING |
| D) Resistance | Medium | < thresholds | ⏳ PENDING |
| E) Overruns | **CRITICAL** | **MUST BE 0** | ⏳ PENDING |
| F) PROD vs TEST | **CRITICAL** | **MUST BE 0** | ⏳ PENDING |
| G) Stuck States | Low | No old stuck states | ⏳ PENDING |

---

## IF PASS: Next Upgrade Plan for "Growth Learning"

### Phase 1: Learning System Activation (Week 1)

**Goal:** Enable AI-driven content optimization based on performance data

**Steps:**
1. **Enable Generator Learning**
   - Activate `GENERATOR_LEARNING_ENABLED=true`
   - Monitor generator performance tracking
   - Verify learning_posts table populated

2. **Enable Bandit Optimization**
   - Activate `BANDIT_LEARNING_ENABLED=true`
   - Verify outcomes table populated
   - Monitor arm selection patterns

3. **Enable Timing Optimization**
   - Activate `TIMING_LEARNING_ENABLED=true`
   - Verify timing_window data collection
   - Monitor optimal posting windows

**Success Criteria:**
- Learning systems writing to outcomes/learning_posts
- Generator performance tracked
- No overruns (targets respected)

### Phase 2: Adaptive Content Selection (Week 2)

**Goal:** System automatically selects best-performing generators/styles

**Steps:**
1. **Enable Adaptive Selection**
   - Activate `ADAPTIVE_SELECTION_ENABLED=true`
   - Monitor generator selection patterns
   - Verify performance-based routing

2. **Enable Topic Learning**
   - Activate `TOPIC_LEARNING_ENABLED=true`
   - Monitor topic performance tracking
   - Verify topic diversity maintained

**Success Criteria:**
- System selects top performers automatically
- Topic diversity maintained
- No degradation in posting quality

### Phase 3: Growth Tuning (Week 3+)

**Goal:** Optimize posting cadence and content mix for growth

**Steps:**
1. **Enable Growth Controller**
   - Verify shadow_controller generating plans
   - Monitor plan execution vs targets
   - Adjust targets based on performance

2. **Enable Reply Learning**
   - Activate reply performance tracking
   - Monitor reply success rates
   - Optimize reply timing/selection

**Success Criteria:**
- Growth plans executed within targets
- Reply success rate > 50%
- Follower growth positive

---

## IF FAIL: Top 3 Blockers and Exact Fixes

### Blocker 1: Overruns > 0

**Diagnosis:**
```sql
SELECT gp.plan_id, gp.window_start, gp.target_posts, gp.target_replies,
       ge.posts_done, ge.replies_done
FROM growth_plans gp
JOIN growth_execution ge ON ge.plan_id = gp.plan_id
WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
  AND gp.window_start >= NOW() - INTERVAL '24 hours';
```

**Fix:**
1. Check posting queue rate limits
2. Verify growth_execution counters updated correctly
3. Add hard stop if overrun detected
4. Review plan generation logic

---

### Blocker 2: POST_SUCCESS_TEST > 0

**Diagnosis:**
```sql
SELECT * FROM system_events 
WHERE event_type = 'POST_SUCCESS_TEST'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

**Fix:**
1. Verify ALLOW_TEST_POSTS is NOT SET in Railway
2. Check postingQueue test lane filter active
3. Verify migration health guard working
4. Review test decision cleanup

---

### Blocker 3: Plan Continuity < 20

**Diagnosis:**
```sql
SELECT COUNT(*) FROM growth_plans 
WHERE window_start >= NOW() - INTERVAL '24 hours';
```

**Fix:**
1. Check shadow_controller job running
2. Verify job_heartbeats show success
3. Check Railway memory (low memory may skip jobs)
4. Review plan generation schedule

---

## COMMANDS TO RUN AT 24H MARK

```bash
# 1. Generate final report
pnpm exec tsx scripts/monitor/generate_24h_final_bake_report.ts

# 2. Verify truth pipeline
pnpm exec tsx scripts/verify/truth_pipeline_happy_path.ts

# 3. Review report
cat docs/BAKE_24H_FINAL_REPORT.md

# 4. Update this GO/NO-GO document with results
# 5. Make GO/NO-GO decision
```

---

## CURRENT STATUS (Start Snapshot)

**Bake Start:** 2026-01-22T19:50:00Z  
**Current Time:** 2026-01-22T19:50:00Z  
**Elapsed:** 0 hours  
**Status:** ⏳ IN PROGRESS

**All Systems:** ✅ OPERATIONAL
- CDP: ✅ Reachable
- Runner: ✅ Active (log updated < 15 min)
- Railway: ✅ Worker alive (905 min uptime)
- Plans: ✅ Latest plan 13 min ago
- Shadow Controller: ✅ GROWTH_PLAN_GENERATED 12 min ago

---

**Report Generated:** 2026-01-22T19:50:00Z  
**Next Update:** At 24h mark (2026-01-23T19:50:00Z)  
**Decision:** ⏳ PENDING
