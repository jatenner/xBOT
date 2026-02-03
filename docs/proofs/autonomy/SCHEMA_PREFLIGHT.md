# 🔒 SCHEMA PREFLIGHT SYSTEM

**Date:** February 3, 2026  
**Status:** ✅ Implemented

---

## OVERVIEW

Fail-closed schema verification system that prevents rate controller execution if required schema elements are missing.

**Location:** `src/rateController/schemaPreflight.ts`

---

## REQUIRED SCHEMA ELEMENTS

### Tables
- `bot_backoff_state` - Rate limit backoff state
- `bot_run_counters` - Daily budget counters
- `rate_controller_state` - Hourly targets and execution state
- `strategy_weights` - Learned strategy weights
- `hour_weights` - Learned hour-of-day weights
- `prompt_version_weights` - Learned prompt version weights

### Columns (content_metadata)
- `prompt_version` - Prompt/template version identifier
- `strategy_id` - Strategy identifier
- `hour_bucket` - Hour of day (0-23) when posted
- `outcome_score` - Computed outcome score

### RPC Functions
- `increment_budget_counter` - Atomic budget counter increment

---

## BEHAVIOR

### On Boot
- `jobManager.ts` runs preflight check
- If failed: Logs error, sets `SAFE_MODE=true`
- Hourly tick scheduled but will skip execution

### On Hourly Tick
- `hourlyTick.ts` runs preflight check before execution
- If failed: Skips execution, logs error
- Sets `SAFE_MODE=true` environment variable

### Safe Mode
- When `SAFE_MODE=true`:
  - Hourly tick does nothing except log
  - No replies posted
  - No timeline posts posted
  - System continues running (other jobs unaffected)

---

## VERIFICATION

### Check Preflight Status
```bash
railway run pnpm exec tsx -e "
import { runSchemaPreflight } from './src/rateController/schemaPreflight.js';
const result = await runSchemaPreflight();
console.log(JSON.stringify(result, null, 2));
"
```

### Check Safe Mode Status
```bash
railway run pnpm exec tsx -e "
import { isSafeMode } from './src/rateController/schemaPreflight.js';
console.log('SAFE_MODE:', isSafeMode());
"
```

---

## LOG OUTPUT

### Preflight Passed
```
[SCHEMA_PREFLIGHT] 🔒 Running schema preflight check...
[SCHEMA_PREFLIGHT] ✅ Table exists: bot_backoff_state
[SCHEMA_PREFLIGHT] ✅ Table exists: bot_run_counters
...
[SCHEMA_PREFLIGHT] ✅ PREFLIGHT PASSED: All schema elements present
```

### Preflight Failed
```
[SCHEMA_PREFLIGHT] 🔒 Running schema preflight check...
[SCHEMA_PREFLIGHT] ❌ Missing table: rate_controller_state
[SCHEMA_PREFLIGHT] ❌ PREFLIGHT FAILED: 1 missing items
[SCHEMA_PREFLIGHT] 🛡️ SAFE_MODE ACTIVATED: Rate controller disabled
[HOURLY_TICK] ❌ Schema preflight failed - SAFE_MODE activated
[HOURLY_TICK] 🛡️ Skipping execution (safe mode)
```

---

## SYSTEM EVENTS

On preflight failure, logs to `system_events`:
```json
{
  "event_type": "schema_preflight_failed",
  "severity": "critical",
  "message": "Schema preflight failed: table:rate_controller_state",
  "event_data": {
    "missing_items": ["table:rate_controller_state"],
    "required_tables": [...],
    "required_columns": {...},
    "required_rpc": [...]
  }
}
```

---

**Status:** ✅ **IMPLEMENTED** - Ready for production
