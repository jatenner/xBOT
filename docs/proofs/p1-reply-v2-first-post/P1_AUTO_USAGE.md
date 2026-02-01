# P1 Automated Workflow Usage

## Single Command

```bash
pnpm p1:auto
```

## What It Does

The script automatically executes all P1 phases:

1. **Phase A:** Harvest cycles until ≥25 public candidates (max 10 cycles)
2. **Phase B:** Run plan-only planner, verify `ok >= 1`
3. **Phase C:** Create real decisions
4. **Phase D:** Check executor, poll for posted reply (up to 10 minutes)
5. **Phase E:** Update documentation (TRACKER.md, SYSTEM_STATUS.md, daily status)

## Exit Codes

- **0:** ✅ P1 complete - reply URL found and documented
- **1:** ❌ Failed at any phase

## Logs

All logs are written to `/tmp/`:
- `/tmp/harvest-cycle-N.log` - Harvest cycle outputs
- `/tmp/planner-plan-only.log` - Plan-only planner output
- `/tmp/planner-real.log` - Real planner output

## Manual Actions

If executor daemon is not running, the script will:
1. Print the exact command to start it
2. Wait for you to press ENTER
3. Continue polling for posted reply

## What to Paste Back If It Fails

If the script fails, paste back:

1. **The error message from the script**
2. **Last harvest log (if Phase A failed):**
   ```bash
   tail -50 /tmp/harvest-cycle-*.log | tail -30
   ```

3. **Planner log (if Phase B failed):**
   ```bash
   tail -50 /tmp/planner-plan-only.log
   ```

4. **Probe reasons (if ok==0):**
   ```bash
   pnpm exec tsx scripts/ops/p1-probe-reasons.ts
   ```

5. **Status check (if Phase D failed):**
   ```bash
   pnpm exec tsx scripts/p1-status.ts
   ```

## Expected Duration

- Phase A: 5-15 minutes (3-10 harvest cycles)
- Phase B: 2-3 minutes (plan-only run)
- Phase C: 2-3 minutes (real planner run)
- Phase D: 0-10 minutes (polling for reply)
- Phase E: < 1 minute (documentation updates)

**Total:** 10-30 minutes typically

## Success Criteria

The script exits 0 only when:
- ✅ ≥25 public candidates harvested
- ✅ Plan-only `ok >= 1`
- ✅ Real decisions created
- ✅ Reply posted (URL exists in DB)
- ✅ Proof document created
- ✅ Trackers updated
