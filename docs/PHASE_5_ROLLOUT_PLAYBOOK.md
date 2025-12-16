# Phase 5 Rollout Playbook

**Date:** 2025-01-16  
**Status:** Operational Guide  
**Purpose:** Safe rollout and rollback of Phase 5 policies (Generator + Slot)

---

## Quick Reference

### Enable Phase 5 (Production Config)
```bash
pnpm phase5:enable
pnpm phase:flags  # Verify
```

### Disable Phase 5 (Rollback)
```bash
pnpm phase5:disable
pnpm phase:flags  # Verify
```

### Check Current Flags
```bash
pnpm phase:flags
```

---

## 1. Enabling Phase 5 Policies

### Step 1: Set Flags via CLI

```bash
# Enable Phase 5 policies (routing ON, experiments OFF, policies ON)
pnpm phase5:enable
```

This sets:
- `ENABLE_PHASE4_ROUTING=true` ✅
- `ENABLE_PHASE4_EXPERIMENTS=false` ✅
- `ENABLE_PHASE5_GENERATOR_POLICY=true` ✅
- `ENABLE_PHASE5_SLOT_POLICY=true` ✅

### Step 2: Verify Flags

```bash
pnpm phase:flags
```

Expected output:
```
[PHASE FLAGS]
==================================================
ENABLE_PHASE4_ROUTING=true
ENABLE_PHASE4_EXPERIMENTS=false
ENABLE_PHASE5_GENERATOR_POLICY=true
ENABLE_PHASE5_SLOT_POLICY=true
==================================================

Summary:
  Phase 4 Routing: ✅ ON
  Phase 4 Experiments: ❌ OFF
  Phase 5 Generator Policy: ✅ ON
  Phase 5 Slot Policy: ✅ ON

✅ Configuration matches recommended production settings
```

### Step 3: Monitor Logs

Tail Railway logs and confirm these log prefixes appear:

**When `planJob` runs:**
- `[SLOT_POLICY] 🎯 Initializing slot policy...`
- `[SLOT_POLICY] ✅ Initialized slot weights: {...}`
- `[SLOT_POLICY] Selected slot=framework weight=16.5% (policy+learning)`
- `[GEN_POLICY] 🎯 Initializing generator policy...`
- `[GEN_POLICY] ✅ Initialized generator weights: {...}`
- `[GEN_POLICY] Selected generator=thoughtLeader weight=21.5% (policy+learning)`
- `[VOICE_GUIDE] slot=framework generator=coach decisionType=single hook=framework tone=educational structure=single`
- `[PHASE4] 🚀 Using Phase 4 orchestratorRouter`
- `[PHASE4][Router] decisionType=single, slot=framework, ...`

**When `replyJob` runs:**
- `[VOICE_GUIDE] slot=reply generator=data_nerd decisionType=reply hook=none tone=practical structure=reply`
- `[PHASE4][Router] decisionType=reply, slot=reply, ...`

**Expected behavior:**
- Slot policy logs appear on first `planJob` run (lazy init)
- Generator policy logs appear on first generator selection (lazy init)
- Voice guide logs appear for every content generation
- Phase 4 routing logs appear for every content generation

---

## 2. Quick Health Checks

Run these scripts to verify system health:

### Learning Health Report
```bash
pnpm tsx scripts/learning-health-report.ts
```

**What to look for:**
- V2 outcomes coverage: Should be >10% for recent posts
- Content slot coverage: Should approach 100% for new posts (last 3 days)
- vw_learning rows: Should have recent activity
- Weight maps: Should have at least 1 recent map
- Reply priorities: Should have non-zero priority scores

### Generator Performance Report
```bash
pnpm tsx scripts/report-generator-performance.ts
```

**What to look for:**
- Generator distribution should roughly match policy weights:
  - Tier 1 generators (thoughtLeader, coach, philosopher, dataNerd) should dominate (~60%)
  - Tier 2 generators should be moderate (~30%)
  - Tier 3 generators should be minimal (~10%)
- Top performers should have higher usage rates

### Slot Performance Report
```bash
pnpm tsx scripts/report-content-slot-performance.ts
```

**What to look for:**
- Slot distribution should roughly match policy weights:
  - High-value slots (framework, practical_tip, research) should dominate (~40%)
  - Medium-value slots should be moderate (~40%)
  - Low-value slots should be minimal (~20%)
- High-performing slots should have higher selection rates

### Reply Performance Report
```bash
pnpm tsx scripts/report-reply-performance.ts
```

**What to look for:**
- Replies should have `content_slot='reply'`
- Priority scores should be populated for high-value accounts
- Reply engagement metrics should be tracked

### Failure Modes Report
```bash
pnpm tsx scripts/report-failure-modes.ts
```

**What to look for:**
- Low engagement posts should be rare (<5%)
- Common failure patterns should be identified
- No systematic errors in generator/slot selection

---

## 3. Rollback Instructions

### When to Rollback

Rollback immediately if you see:
- **Crash loops**: Service repeatedly crashing/restarting
- **Zero posts**: No content being generated for >1 hour
- **Persistent errors**: Repeated errors in logs (not warnings)
- **Budget issues**: Unexpected OpenAI cost spikes
- **Data corruption**: Missing or incorrect data in reports

### How to Rollback

**Step 1: Disable all Phase 5 policies**
```bash
pnpm phase5:disable
```

**Step 2: Verify flags are OFF**
```bash
pnpm phase:flags
```

Expected output:
```
[PHASE FLAGS]
==================================================
ENABLE_PHASE4_ROUTING=not set (defaults to false)
ENABLE_PHASE4_EXPERIMENTS=not set (defaults to false)
ENABLE_PHASE5_GENERATOR_POLICY=not set (defaults to false)
ENABLE_PHASE5_SLOT_POLICY=not set (defaults to false)
==================================================

Summary:
  Phase 4 Routing: ❌ OFF
  Phase 4 Experiments: ❌ OFF
  Phase 5 Generator Policy: ❌ OFF
  Phase 5 Slot Policy: ❌ OFF
```

**Step 3: Monitor logs**
- Confirm `[SLOT_POLICY]` and `[GEN_POLICY]` logs stop appearing
- Confirm `[PHASE4]` logs stop appearing (if routing was disabled)
- System should return to original behavior (calendar-based slots, weight-map generators)

**Step 4: Verify system is working**
- Run `pnpm tsx scripts/learning-health-report.ts`
- Check that posts are still being generated
- Check that no new errors appear

---

## 4. Individual Flag Toggles

### Toggle Generator Policy Only
```bash
# Enable
pnpm phase5:generators:on

# Disable
pnpm phase5:generators:off
```

### Toggle Slot Policy Only
```bash
# Enable
pnpm phase5:slots:on

# Disable
pnpm phase5:slots:off
```

### Toggle Experiments (Future)
```bash
# Enable (only after Phase 5 is stable for 3-5 days)
pnpm phase4:experiments:on

# Disable
pnpm phase4:experiments:off
```

---

## 5. Troubleshooting

### Flags Not Taking Effect

**Symptom:** Flags are set but logs don't show policy activity

**Check:**
1. Verify flags are actually set: `pnpm phase:flags`
2. Check Railway deployment: Flags require a redeploy to take effect
3. Check logs for initialization errors: `[SLOT_POLICY] ❌` or `[GEN_POLICY] ❌`

**Fix:**
- If flags are correct but not working, check Railway logs for errors
- If initialization fails, policies fall back to original behavior (safe)

### Policy Weights Not Loading

**Symptom:** `[SLOT_POLICY] ⚠️ Failed to initialize policy` or `[GEN_POLICY] ⚠️ Failed to initialize policy`

**Check:**
1. Verify `vw_learning` view exists and has data
2. Check database connectivity
3. Check logs for specific error messages

**Fix:**
- Policies gracefully fall back to original behavior
- System continues working normally
- Check database connection and `vw_learning` view

### Unexpected Behavior

**Symptom:** Slot/generator distribution doesn't match expectations

**Check:**
1. Run performance reports to see actual distribution
2. Check if learning data is influencing weights
3. Verify policy base weights are correct

**Fix:**
- Policy weights are adjusted by learning data (30% influence)
- If learning data suggests different weights, policy adapts
- This is expected behavior (data-driven optimization)

---

## 6. Production Checklist

Before enabling Phase 5 in production:

- [ ] All migrations applied (`vw_learning` view exists)
- [ ] Data coverage acceptable (v2 outcomes >10%, slots >50% for recent posts)
- [ ] Learning system healthy (weight maps present, priorities populated)
- [ ] No critical errors in logs
- [ ] Budget monitoring enabled
- [ ] Rollback plan ready

After enabling Phase 5:

- [ ] Flags verified: `pnpm phase:flags`
- [ ] Logs show policy initialization
- [ ] Content generation working normally
- [ ] Performance reports show expected distributions
- [ ] No new errors introduced

---

## 7. Monitoring Commands

### Check Flag Status
```bash
pnpm phase:flags
```

### View Recent Logs (Railway)
```bash
railway logs --service xBOT | tail -n 100
```

### Filter Policy Logs
```bash
railway logs --service xBOT | grep -E "\[SLOT_POLICY\]|\[GEN_POLICY\]|\[PHASE4\]"
```

### Run Health Reports
```bash
pnpm tsx scripts/learning-health-report.ts
pnpm tsx scripts/report-generator-performance.ts
pnpm tsx scripts/report-content-slot-performance.ts
```

---

## Summary

**Enable Phase 5:**
```bash
pnpm phase5:enable && pnpm phase:flags
```

**Monitor:**
- Watch logs for `[SLOT_POLICY]`, `[GEN_POLICY]`, `[PHASE4]` entries
- Run health reports after 24 hours

**Rollback if needed:**
```bash
pnpm phase5:disable && pnpm phase:flags
```

**Everything is feature-flagged and backward-compatible. Rollback is instant and safe.**

