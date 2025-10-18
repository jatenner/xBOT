# 🚀 DATABASE MIGRATION DEPLOYMENT

## ⚠️ IMPORTANT: Run This Migration Now

The code is deployed to Railway, but the database migration needs to be applied for the autonomous learning system to work.

---

## 🎯 OPTION 1: Supabase Dashboard (EASIEST - 2 minutes)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/uokidymvzfkxwvxlpnfu/editor

2. **Open SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy & Paste the Migration:**
   - Open this file: `supabase/migrations/20251018_generator_learning_system.sql`
   - Copy ALL contents (350 lines)
   - Paste into SQL Editor

4. **Run the Migration:**
   - Click "Run" (or press Cmd+Enter)
   - Wait for "Success" message
   - You should see: "12 rows affected" (the 12 generator weights inserted)

5. **Verify:**
   ```sql
   SELECT generator_name, weight, status FROM generator_weights ORDER BY weight DESC;
   ```
   Should return 12 rows with your generators.

---

## 🎯 OPTION 2: Direct Database Connection

If you have the database password:

```bash
# Get your database connection string from Supabase dashboard
# Settings > Database > Connection String (Direct connection)

# Run migration
psql "postgresql://postgres:[YOUR-PASSWORD]@db.uokidymvzfkxwvxlpnfu.supabase.co:5432/postgres" \
  -f supabase/migrations/20251018_generator_learning_system.sql
```

---

## ✅ VERIFICATION CHECKLIST

After running the migration, verify these tables exist:

```sql
-- Should return 3 rows
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('generator_weights', 'generator_performance_history', 'optimization_events');

-- Should return 12 generators
SELECT COUNT(*) FROM generator_weights;

-- Check content_metadata has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'content_metadata' 
AND column_name IN ('generator_name', 'generator_confidence', 'experiment_arm');
```

---

## 🔍 WHAT THIS MIGRATION DOES

1. ✅ Creates `generator_weights` table (stores weights for 12 generators)
2. ✅ Creates `generator_performance_history` table (historical snapshots)
3. ✅ Creates `optimization_events` table (audit log)
4. ✅ Adds `generator_name` column to `content_metadata`
5. ✅ Adds `generator_confidence` column to `content_metadata`
6. ✅ Adds `experiment_arm` column to `content_metadata`
7. ✅ Creates 9 performance indexes
8. ✅ Inserts default weights for 12 generators
9. ✅ Creates helper functions and triggers

---

## 🚨 TROUBLESHOOTING

### Migration fails with "table already exists"
```sql
-- Drop tables and retry (CAREFUL - only if you know they're empty)
DROP TABLE IF EXISTS optimization_events CASCADE;
DROP TABLE IF EXISTS generator_performance_history CASCADE;
DROP TABLE IF EXISTS generator_weights CASCADE;

-- Then run the migration again
```

### Column already exists error
The migration uses `ADD COLUMN IF NOT EXISTS`, so this shouldn't happen. But if it does, the migration is idempotent and safe to re-run.

---

## 🎉 AFTER MIGRATION

Once migration is complete:

1. **Check Railway Logs:**
   ```
   ✅ UNIFIED_ENGINE: Loaded 12 generator weights from database
   ```

2. **Verify First Post:**
   After the next post, check:
   ```sql
   SELECT decision_id, generator_name, posted_at 
   FROM content_metadata 
   WHERE posted_at > NOW() - INTERVAL '1 hour' 
   ORDER BY posted_at DESC 
   LIMIT 5;
   ```
   Should show `generator_name` populated!

3. **Wait for First Optimization:**
   - Needs 20+ posts before running
   - Will happen automatically after ~6-8 hours
   - Check `optimization_events` table after

---

## 📞 NEED HELP?

If migration fails or you see errors:
1. Copy the exact error message
2. Check which line number failed
3. Run verification queries above to see what exists

The migration is designed to be safe and idempotent (can run multiple times).

---

**🚀 Run the migration now and the autonomous learning system will start working immediately!**

