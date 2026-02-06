# Production Stability Proof Bundle

**Date:** 2026-02-05  
**Commit SHA:** (run `git rev-parse HEAD` after commit; pre-commit: cf37acc)

## Objectives Completed

### A) Boot behavior: HTTP server before DB/migrations
- `railwayEntrypoint.ts` starts health server **synchronously** before any background init
- `/status` returns 200 immediately with sync-only fields (no DB/async imports for core payload)
- Response includes: `service_name`, `git_sha`, `migrations_enabled`, `x_actions_enabled`, `uptime_seconds`

### B) Migrations: manual by default, never block boot
- `RUN_MIGRATIONS_ENABLED` default **false**
- `RUN_MIGRATIONS_FAIL_FAST` default **false**
- Migrations run only in xBOT (not serene-cat) when enabled
- If migrations fail and FAIL_FAST=false → log and continue boot

### C) X safety: ActionGate
- `X_ACTIONS_ENABLED` default **false**
- Crash-loop kill switch: ≥2 restarts in 15 min → 6h cooldown (env cannot override)
- Pacing: `X_MAX_ACTIONS_PER_HOUR=1`, `X_MAX_ACTIONS_PER_DAY=3`, jitter 30–180s
- 72h warmup: `X_WARMUP_UNTIL_ISO` optional
- ActionGate wired into `UltimateTwitterPoster` via `verifyPostingGuard`

### D) Migration runner safety
- Advisory lock: if unavailable after 120s, exit 0 unless `RUN_MIGRATIONS_FAIL_FAST=true`
- First error visibility: filename, statement index, 200-char snippet, pg code/message/detail/hint
- Dollar-quote detection: `$$`, `$func$`, `DO $` → single-statement execution
- Lock released in `finally` best-effort

---

## Files Changed

| File | Change |
|------|--------|
| `src/safety/actionGate.ts` | **NEW** — ActionGate: X_ACTIONS_ENABLED, crash-loop cooldown, pacing, warmup |
| `src/railwayEntrypoint.ts` | /status fast sync response; migrations_enabled, x_actions_enabled, uptime_seconds; background migration run (xBOT only) |
| `src/main.ts` | Gate migrations with RUN_MIGRATIONS_ENABLED; fail-fast optional |
| `scripts/db/apply-migrations.ts` | RUN_MIGRATIONS_FAIL_FAST for lock; first-error logging; $func$ detection |
| `src/posting/UltimateTwitterPoster.ts` | ActionGate check in verifyPostingGuard; recordAction() on success |

---

## Railway Variable Commands

### xBOT
```bash
railway variables set RUN_MIGRATIONS_ENABLED=false --service xBOT
railway variables set RUN_MIGRATIONS_FAIL_FAST=false --service xBOT
railway variables set X_ACTIONS_ENABLED=false --service xBOT
railway variables set X_MAX_ACTIONS_PER_HOUR=1 --service xBOT
railway variables set X_MAX_ACTIONS_PER_DAY=3 --service xBOT
railway variables set X_ACTION_JITTER_SECONDS_MIN=30 --service xBOT
railway variables set X_ACTION_JITTER_SECONDS_MAX=180 --service xBOT
railway variables set X_WARMUP_UNTIL_ISO=2026-02-08T20:53:46.000Z --service xBOT
```

### serene-cat
```bash
railway variables set RUN_MIGRATIONS_ENABLED=false --service serene-cat
railway variables set RUN_MIGRATIONS_FAIL_FAST=false --service serene-cat
railway variables set X_ACTIONS_ENABLED=false --service serene-cat
railway variables set X_MAX_ACTIONS_PER_HOUR=1 --service serene-cat
railway variables set X_MAX_ACTIONS_PER_DAY=3 --service serene-cat
railway variables set X_ACTION_JITTER_SECONDS_MIN=30 --service serene-cat
railway variables set X_ACTION_JITTER_SECONDS_MAX=180 --service serene-cat
```

**Note:** `X_WARMUP_UNTIL_ISO` is optional. Set to now+72h in UTC for warmup. Example: `date -u -v+72H +"%Y-%m-%dT%H:%M:%S.000Z"` (macOS) or `date -u -d '+72 hours' +"%Y-%m-%dT%H:%M:%S.000Z"` (Linux).

---

## Redeploy Commands

```bash
railway up --service xBOT --detach
railway up --service serene-cat --detach
```

---

## Proof Bundle Greps (run after redeploy)

### Healthcheck
```bash
railway logs --service xBOT -n 400 | grep -E "/status|STATUS|listening|PORT|BOOT"
railway logs --service serene-cat -n 400 | grep -E "/status|STATUS|listening|PORT|BOOT"
```

### Migrations
```bash
railway logs --service xBOT -n 800 | grep -E "RUN_MIGRATIONS|MIGRATIONS|Acquiring advisory lock|Migration applied|Migration failed"
railway logs --service serene-cat -n 800 | grep -E "RUN_MIGRATIONS|MIGRATIONS|Acquiring advisory lock|Migration applied|Migration failed"
```

### Job manager
```bash
railway logs --service xBOT -n 1200 | grep -E "JOB_MANAGER_BOOT|Starting Job Manager|HOURLY_TICK|SCHEDULE|RATE_CONTROLLER"
railway logs --service serene-cat -n 1200 | grep -E "JOB_MANAGER_BOOT|Starting Job Manager|HOURLY_TICK|SCHEDULE|RATE_CONTROLLER"
```

### X safety
```bash
railway logs --service xBOT -n 800 | grep -E "X_ACTIONS|X_SAFETY|cooldown|WARMUP|ActionGate"
railway logs --service serene-cat -n 800 | grep -E "X_ACTIONS|X_SAFETY|cooldown|WARMUP|ActionGate"
```

### Verifier
```bash
railway run --service xBOT pnpm exec tsx scripts/ops/verify-production-execution.ts
```

---

## Next Steps

### Manual migration run
```bash
railway run --service xBOT pnpm db:migrate
```
Or with RUN_MIGRATIONS_ENABLED=true for one deploy, then set back to false.

### When to enable X actions after 72h warmup
1. After `X_WARMUP_UNTIL_ISO` has passed, set `X_ACTIONS_ENABLED=true` for xBOT.
2. Keep pacing caps: `X_MAX_ACTIONS_PER_HOUR=1`, `X_MAX_ACTIONS_PER_DAY=3` initially.
3. Monitor for suspension signals; increase caps gradually if stable.
