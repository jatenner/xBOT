# 🔒 PRODUCTION MIGRATION VERIFICATION

**Date:** February 3, 2026  
**Status:** ⚠️ **PENDING** - Migration needs manual application

---

## MIGRATION FILE

**File:** `supabase/migrations/20260203_rate_controller_schema.sql`

**To Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy entire contents of migration file
3. Paste and run
4. Verify success message

---

## VERIFICATION QUERIES

### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'bot_backoff_state',
  'bot_run_counters',
  'rate_controller_state',
  'strategy_weights',
  'hour_weights',
  'prompt_version_weights'
)
ORDER BY table_name;
```

**Expected:** 6 rows

### Check Columns Exist
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_metadata' 
AND column_name IN ('prompt_version', 'strategy_id', 'hour_bucket', 'outcome_score')
ORDER BY column_name;
```

**Expected:** 4 rows

### Check RPC Function Exists
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'increment_budget_counter';
```

**Expected:** 1 row

---

## CURRENT STATUS (Pre-Migration)

**Verification Output:**
```
❌ bot_backoff_state: relation does not exist
❌ bot_run_counters: relation does not exist
❌ rate_controller_state: relation does not exist
❌ strategy_weights: relation does not exist
❌ hour_weights: relation does not exist
❌ prompt_version_weights: relation does not exist
❌ prompt_version: column does not exist
❌ strategy_id: column does not exist
❌ hour_bucket: column does not exist
❌ outcome_score: column does not exist
❌ increment_budget_counter: function does not exist
```

**Action Required:** Apply migration via Supabase Dashboard SQL Editor

---

## POST-MIGRATION VERIFICATION

After applying migration, run:
```bash
railway run pnpm exec tsx scripts/ops/verify-migration.ts
```

**Expected Output:**
```
✅ bot_backoff_state: exists
✅ bot_run_counters: exists
✅ rate_controller_state: exists
✅ strategy_weights: exists
✅ hour_weights: exists
✅ prompt_version_weights: exists
✅ prompt_version: exists
✅ strategy_id: exists
✅ hour_bucket: exists
✅ outcome_score: exists
✅ increment_budget_counter: exists
```

---

**Status:** ⚠️ **AWAITING MIGRATION APPLICATION**
