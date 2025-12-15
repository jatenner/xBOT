# Phase 4 Rollout Plan

**Date:** 2025-01-16  
**Status:** Ready for Validation  
**Feature Flags:** `ENABLE_PHASE4_ROUTING`, `ENABLE_PHASE4_EXPERIMENTS`

---

## Executive Summary

Phase 4 introduces intelligent AI routing (CoreContentOrchestrator vs ExpertOrchestrator), budget-aware model selection, learning-signal integration, and experimentation metadata. This plan outlines a safe, gradual rollout strategy with clear monitoring and rollback procedures.

**Current State:**
- All Phase 4 code is deployed
- Feature flags default to `false` (no behavioral changes)
- Migrations need to be applied (experiment metadata columns)
- System is ready for validation and gradual rollout

---

## Prerequisites

### 1. Migration Status

**Required Migration:**
- `20250116_add_experiment_metadata.sql` - Adds `experiment_group` and `hook_variant` columns

**Action Required:**
- Migration will be auto-applied by Supabase CLI on next deployment
- OR apply manually via Supabase dashboard SQL editor
- Verify columns exist before enabling experiments

**Verification:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'content_generation_metadata_comprehensive' 
AND column_name IN ('experiment_group', 'hook_variant');
```

### 2. Data Health Baseline

**Current Metrics (Last 3 Days):**
- v2 outcomes: 10.4% coverage (50/481)
- content_slot: 2.2% coverage (8/364)
- priority_score: 3.8% coverage (38/1000 accounts)
- Slot performance: No data yet (will populate as content is generated)

**Acceptable for Rollout:**
- ✅ v2 outcomes are populating (10%+ is sufficient to start)
- ✅ content_slot is wired (will populate as new content is generated)
- ✅ priority_score is working (38 accounts have scores)
- ⚠️ Slot performance needs time to accumulate (acceptable for Phase A)

---

## Rollout Phases

### Phase A: Routing Only (Days 1-3)

**Goal:** Enable intelligent routing without experiments

**Settings:**
```bash
ENABLE_PHASE4_ROUTING=true
ENABLE_PHASE4_EXPERIMENTS=false
```

**What Happens:**
- planJob routes through orchestratorRouter
- replyJob routes through orchestratorRouter
- ExpertOrchestrator used for:
  - High-value thread slots (deep_dive, framework, research)
  - High-priority replies (priority_score >= 0.8)
  - Deep dive singles (30-50% chance based on slot performance)
- BudgetController enforces:
  - Max 20 expert calls/day
  - 75% daily budget threshold
  - 25% budget reserve

**Expected Behavior:**
- 80-90% of content uses GPT-4o-mini (CoreContentOrchestrator)
- 10-20% uses GPT-4o (ExpertOrchestrator) for high-value content
- Daily OpenAI spend stays within $5-6 limit
- No increase in error rates

**Monitoring:**
- Daily OpenAI spend vs limit
- Expert calls per day (should be ≤ 20)
- Error rates (should remain stable)
- Content generation success rate (should remain ≥ 95%)

**Success Criteria:**
- ✅ Budget stays within limits
- ✅ Expert calls ≤ 20/day
- ✅ No increase in errors
- ✅ Routing logs show correct Core vs Expert decisions

**Rollback Condition:**
- Daily spend exceeds $6.50
- Expert calls exceed 25/day
- Error rate increases > 5%
- Content generation success rate drops < 90%

**Rollback Action:**
```bash
ENABLE_PHASE4_ROUTING=false
```
(No code revert needed - feature flag gates all changes)

---

### Phase B: Learning Signal Integration (Days 4-7)

**Goal:** Enable learning-aware routing adjustments

**Settings:**
```bash
ENABLE_PHASE4_ROUTING=true
ENABLE_PHASE4_EXPERIMENTS=false
```

**What Changes:**
- Slot performance scores now influence routing
- Low-performing slots (< 0.5) downgraded to Core even if high-value
- High-performing slots (>= 0.7) can get Expert upgrade
- Routing becomes more data-driven over time

**Expected Behavior:**
- Routing decisions improve as slot performance data accumulates
- High-performing slots get more Expert usage
- Low-performing slots get less Expert usage (cost savings)

**Monitoring:**
- Slot performance scores (should populate over time)
- Expert usage by slot (should correlate with performance)
- Budget efficiency (should improve as routing gets smarter)

**Success Criteria:**
- ✅ Slot performance scores populate (at least 3 slots with data)
- ✅ Routing decisions correlate with slot performance
- ✅ Budget efficiency improves or stays stable

**Rollback Condition:**
- Slot performance scores don't populate after 3 days
- Routing decisions don't correlate with performance
- Budget efficiency degrades

**Rollback Action:**
- Same as Phase A (set flag to false)

---

### Phase C: Experiments (Days 8+)

**Goal:** Enable A/B hook testing

**Settings:**
```bash
ENABLE_PHASE4_ROUTING=true
ENABLE_PHASE4_EXPERIMENTS=true
```

**What Happens:**
- Experiment metadata assigned to:
  - practical_tip slots
  - myth_busting slots
  - framework slots
- Hook variants A/B randomly assigned
- Data flows into vw_learning for analysis

**Expected Behavior:**
- ~30-40% of content gets experiment metadata
- Variants A and B roughly balanced (50/50 split)
- No impact on content quality or generation success

**Monitoring:**
- Experiment assignment rate (should be ~30-40% of eligible slots)
- Variant balance (should be roughly 50/50)
- Content quality (should remain stable)

**Success Criteria:**
- ✅ Experiments assigned correctly
- ✅ Variants balanced
- ✅ No quality degradation

**Rollback Condition:**
- Experiment assignment causes errors
- Variant balance severely skewed (> 70/30)
- Content quality degrades

**Rollback Action:**
```bash
ENABLE_PHASE4_EXPERIMENTS=false
```
(Keep routing enabled, disable experiments only)

---

## Monitoring Dashboard

### Key Metrics to Track Daily

**Budget Metrics:**
- Daily OpenAI spend (target: $4-5, max: $6)
- Expert calls per day (target: 10-15, max: 20)
- Budget reserve remaining (should stay > 25%)

**Routing Metrics:**
- CoreContentOrchestrator usage (target: 80-90%)
- ExpertOrchestrator usage (target: 10-20%)
- Routing decision breakdown by slot/priority

**Performance Metrics:**
- Content generation success rate (target: ≥ 95%)
- Error rate (target: ≤ 5%)
- Average generation time (should remain stable)

**Learning Metrics:**
- Slot performance scores (should populate over time)
- Priority score coverage (should increase)
- v2 outcomes coverage (should increase)

**Experiment Metrics (Phase C only):**
- Experiment assignment rate
- Variant balance (A vs B)
- Experiment content performance (future analysis)

### SQL Queries for Monitoring

**Daily Budget Check:**
```sql
SELECT 
  used_today_usd,
  remaining_usd,
  percent_used
FROM budget_status_view
WHERE date = CURRENT_DATE;
```

**Expert Usage Today:**
```sql
SELECT COUNT(*) as expert_calls_today
FROM ai_call_log
WHERE model = 'gpt-4o'
AND DATE(created_at) = CURRENT_DATE;
```

**Routing Decisions:**
```sql
SELECT 
  decision_type,
  content_slot,
  COUNT(*) as total,
  SUM(CASE WHEN model_used = 'gpt-4o' THEN 1 ELSE 0 END) as expert_count
FROM content_generation_log
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY decision_type, content_slot;
```

---

## Rollback Procedures

### Immediate Rollback (Emergency)

**If budget exceeded or errors spike:**

1. Set environment variables in Railway:
   ```bash
   ENABLE_PHASE4_ROUTING=false
   ENABLE_PHASE4_EXPERIMENTS=false
   ```

2. Verify rollback:
   - Check logs show no [PHASE4] entries
   - Confirm planJob and replyJob use legacy paths
   - Verify no new Expert calls

3. Monitor for 1 hour:
   - Confirm error rate returns to baseline
   - Confirm budget usage returns to normal

**No code revert needed** - feature flags gate all Phase 4 changes.

### Gradual Rollback (If Issues Detected)

**If routing works but experiments cause issues:**

1. Disable experiments only:
   ```bash
   ENABLE_PHASE4_EXPERIMENTS=false
   ```

2. Keep routing enabled (if stable)

**If routing causes issues but budget is fine:**

1. Disable routing:
   ```bash
   ENABLE_PHASE4_ROUTING=false
   ```

2. System returns to pre-Phase 4 behavior

---

## Risk Assessment

### Low Risk
- ✅ Feature flags gate all changes
- ✅ Backward compatible when flags OFF
- ✅ BudgetController prevents overspend
- ✅ Expert call cap (20/day) prevents runaway costs

### Medium Risk
- ⚠️ Slot performance data needs time to accumulate
- ⚠️ Learning signals may be sparse initially
- ⚠️ Migration needs to be applied before experiments

### Mitigation
- Start with routing only (no experiments)
- Monitor closely for first 3 days
- Have rollback plan ready
- Test in dev/staging first if possible

---

## Recommended Timeline

**Week 1:**
- Day 1: Apply migration, enable routing only
- Days 2-3: Monitor closely, verify budget and routing
- Days 4-7: Continue monitoring, let learning signals accumulate

**Week 2:**
- Days 8-10: Enable experiments if routing is stable
- Days 11-14: Monitor experiments, collect data

**Ongoing:**
- Weekly review of metrics
- Adjust thresholds if needed
- Expand experiments gradually

---

## Success Criteria Summary

**Phase A Success:**
- ✅ Budget within limits
- ✅ Expert calls ≤ 20/day
- ✅ No error rate increase
- ✅ Routing logs show correct decisions

**Phase B Success:**
- ✅ Slot performance scores populate
- ✅ Routing correlates with performance
- ✅ Budget efficiency stable or improved

**Phase C Success:**
- ✅ Experiments assigned correctly
- ✅ Variants balanced
- ✅ No quality degradation

---

## Next Steps

1. **Before Rollout:**
   - [ ] Apply migration `20250116_add_experiment_metadata.sql`
   - [ ] Verify migration applied (check columns exist)
   - [ ] Run smoke test locally
   - [ ] Review smoke test logs

2. **Phase A Start:**
   - [ ] Set `ENABLE_PHASE4_ROUTING=true` in Railway
   - [ ] Monitor for 24 hours
   - [ ] Review metrics daily

3. **Phase B Start:**
   - [ ] Verify slot performance scores populating
   - [ ] Continue monitoring
   - [ ] Review routing decisions

4. **Phase C Start:**
   - [ ] Verify migration applied
   - [ ] Set `ENABLE_PHASE4_EXPERIMENTS=true`
   - [ ] Monitor experiment assignment
   - [ ] Collect data for analysis

---

## Contact & Support

**If issues arise:**
1. Check logs for [PHASE4] entries
2. Review budget status
3. Check routing decisions in logs
4. Rollback if needed (set flags to false)

**No code changes needed for rollback** - feature flags provide complete safety.

