# Phase A: Harvest Plan

## Commands to Run

### Batch 1: Initial Harvest (Run 3 cycles)

**Cycle 1:**
```bash
railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-1.log 2>&1
```

**After Cycle 1, check count:**
```bash
pnpm exec tsx scripts/ops/check-public-count.ts
```

**Cycle 2:**
```bash
railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-2.log 2>&1
```

**After Cycle 2, check count:**
```bash
pnpm exec tsx scripts/ops/check-public-count.ts
```

**Cycle 3:**
```bash
railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-3.log 2>&1
```

**After Cycle 3, check count:**
```bash
pnpm exec tsx scripts/ops/check-public-count.ts
```

## What to Paste Back

After each batch (3 cycles), paste:
1. **Public candidate count:**
   ```
   Public candidates (last 2h): X
   ```

2. **Last harvest log snippet (10-20 lines):**
   ```bash
   tail -20 /tmp/harvest-cycle-3.log | grep -E "\[HARVESTER|public_search|stored|opportunities|PUBLIC|tier="
   ```

## Expected Progress

- Cycle 1: 1 → ~5-10 candidates
- Cycle 2: ~5-10 → ~15-20 candidates  
- Cycle 3: ~15-20 → ~25+ candidates ✅

If after 3 cycles we're still < 25, we'll run 2 more cycles.

## Decision Point

After Batch 1 (3 cycles):
- If count ≥ 25: ✅ Proceed to Phase B
- If count < 25: Run Batch 2 (2 more cycles)
