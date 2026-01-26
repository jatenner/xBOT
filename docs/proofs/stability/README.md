# Long-Running Executor Stability Proofs

This directory contains immutable proof artifacts for Phase 5A.3: Long-Running Executor Stability.

## Purpose

Proves the executor can run continuously without degradation over extended periods (default: 30 minutes). Validates continuous health event emission, absence of crashes, and stable operation.

## Proof Criteria

- ✅ EXECUTOR_HEALTH_BOOT observed within 20s
- ✅ EXECUTOR_HEALTH_READY observed within 90s
- ✅ ≥1 EXECUTOR_HEALTH_OK per 60s (no gaps >90s)
- ✅ No EXECUTOR_DAEMON_CRASH events
- ✅ No browser pool exhaustion
- ✅ Duration completed successfully

## Running the Proof

```bash
# Default 30-minute run
pnpm run executor:prove:long-run-stability

# Custom duration (60 minutes)
PROOF_DURATION_MINUTES=60 pnpm run executor:prove:long-run-stability
```

## Files

- **`INDEX.md`** - Append-only index of all proof runs
- **`stability-<timestamp>.md`** - Immutable proof reports (one per run)

## Verification

After marking Phase 5A.3 as PROVEN in documentation, run:

```bash
pnpm run verify:docs:truth
```

This ensures the PROVEN claim references an existing immutable proof file with PASS status.
