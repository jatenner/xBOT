# P1 Automated Workflow - START HERE

## Single Command

```bash
pnpm p1:auto
```

That's it. Run this one command and it will:
1. Harvest candidates until ≥25 public_search_* opportunities
2. Run plan-only planner and verify ok>=1
3. Create real decisions
4. Check executor and poll for posted reply
5. Update all documentation automatically

## Expected Duration

**10-30 minutes** typically

## What Happens

The script runs through all P1 phases automatically:

- **Phase A:** Harvest cycles (3-10 cycles, ~5 min each)
- **Phase B:** Plan-only probe (2-3 min)
- **Phase C:** Create decisions (2-3 min)
- **Phase D:** Poll for reply (0-10 min)
- **Phase E:** Update docs (< 1 min)

## Manual Action (If Needed)

If executor daemon is not running, the script will:
1. Print: `EXECUTION_MODE=executor RUNNER_MODE=true pnpm run executor:daemon`
2. Wait for you to start it
3. Press ENTER to continue

## Success = Exit Code 0

When the script completes successfully:
- ✅ Reply URL printed
- ✅ Proof doc created: `docs/proofs/p1-reply-v2-first-post/P1_FIRST_REPLY_POSTED.md`
- ✅ Trackers updated: `docs/TRACKER.md`, `docs/SYSTEM_STATUS.md`

## If It Fails

Paste back these outputs:

1. **The error message from the script**

2. **If Phase A failed (harvest):**
   ```bash
   tail -50 /tmp/harvest-cycle-*.log | tail -30
   ```

3. **If Phase B failed (probe ok==0):**
   ```bash
   tail -50 /tmp/planner-plan-only.log
   pnpm exec tsx scripts/ops/p1-probe-reasons.ts
   ```

4. **If Phase D failed (no reply):**
   ```bash
   pnpm exec tsx scripts/p1-status.ts
   ```

## Logs Location

All logs are in `/tmp/`:
- `/tmp/harvest-cycle-N.log` - Harvest outputs
- `/tmp/planner-plan-only.log` - Plan-only output
- `/tmp/planner-real.log` - Real planner output

## Status Check

At any time, check status:
```bash
pnpm p1:status
```

---

**Ready? Run:** `pnpm p1:auto`
