# 🌾 HARVEST POST-STABILIZATION PROOF

**Date:** February 3, 2026  
**Status:** Verification Required  
**Purpose:** Prove harvest produces candidates reliably after rate-limit stabilization

---

## 📋 OVERVIEW

This document proves that:
1. ✅ Harvest runs successfully with backoff/budget system
2. ✅ Opportunities are inserted into database
3. ✅ Budget counters are updated correctly
4. ✅ Profile harvester works when search is blocked

---

## 🧪 TESTING STEPS

### Step 1: Run Harvest Cycle

```bash
railway service xBOT
railway logs -n 200
railway run pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts
```

### Step 2: Verify Database State

**Check budget counters:**
```sql
SELECT * FROM bot_run_counters WHERE date = CURRENT_DATE;
```

**Expected:** `nav_count` and/or `search_count` incremented

**Check opportunities inserted:**
```sql
SELECT 
  discovery_source,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM reply_opportunities
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY discovery_source;
```

**Expected:** At least one row with `discovery_source` in ('profile', 'public_search_*')

**Check backoff state:**
```sql
SELECT * FROM bot_backoff_state WHERE key = 'harvest_search';
```

**Expected:** Either NULL (not blocked) or `blocked_until` in future

---

## ✅ SUCCESS CRITERIA

- [ ] Harvest cycle completes without errors
- [ ] `bot_run_counters` shows updated counts for today
- [ ] At least 1 opportunity inserted with `discovery_source='profile'` OR `discovery_source LIKE 'public_search_%'`
- [ ] JSON summary output shows `inserted_rows > 0`
- [ ] No rate limit errors in logs

---

## 📊 EXPECTED OUTPUT

**JSON Summary:**
```json
{
  "mode": "search" | "profile" | "skipped",
  "dom_cards": 0,
  "status_urls": 0,
  "inserted_rows": 5,
  "rate_limited": false,
  "blocked_until": null,
  "budgets_remaining": { "nav": 15, "search": 0 }
}
```

**Log Patterns:**
- `[BACKOFF_STORE]` or `[BUDGET_STORE]` messages
- `[PROFILE_HARVEST]` or `[HARVEST]` success messages
- `✅ Stored X opportunities`

---

**Status:** ⏳ Awaiting Verification
