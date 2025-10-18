# 🗄️ DATABASE SETUP - Manual Migration Required

## ⚠️ IMPORTANT: Manual Step Required

**Railway does NOT automatically apply Supabase migrations.** You need to apply the database migration manually. This is a ONE-TIME setup.

---

## 🚀 QUICK SETUP (2 minutes)

### **Option 1: Supabase Dashboard (Easiest)**

1. **Open Supabase SQL Editor:**
   ```
   https://app.supabase.com/project/YOUR_PROJECT_ID/sql
   ```

2. **Copy the migration SQL:**
   - Open: `supabase/migrations/20251018170436_content_violations_tracking.sql`
   - Copy ALL content (entire file)

3. **Paste and Run:**
   - Paste into SQL Editor
   - Click "Run" (or press Cmd+Enter)
   - Wait for "Success" message

4. **Verify:**
   ```sql
   -- Run this to verify table was created:
   SELECT COUNT(*) FROM content_violations;
   -- Should return: 0
   ```

✅ **Done!** The content quality system is now fully operational.

---

### **Option 2: Command Line (If you have psql)**

```bash
# 1. Get your database URL from Railway
railway variables | grep DATABASE_URL

# 2. Apply migration directly
psql YOUR_DATABASE_URL -f supabase/migrations/20251018170436_content_violations_tracking.sql

# 3. Verify
psql YOUR_DATABASE_URL -c "SELECT COUNT(*) FROM content_violations;"
```

---

## 🔍 What This Creates

The migration creates:

### 1. **`content_violations` table**
Tracks every content sanitization violation:
- Generator name
- Violation type (first_person, banned_phrase, low_specificity, incomplete)
- Severity (critical, high, medium, low)
- Full content + context
- Action taken (rejected, retried, posted_anyway)

### 2. **`generator_quality_metrics` view**
Pre-computed metrics per generator:
- Total violations
- Violations by type
- Rejection rate
- Average specificity score

### 3. **Indexes**
Optimized for common queries:
- By generator + time
- By severity
- By violation type

### 4. **Refresh function**
```sql
SELECT refresh_generator_quality_metrics();
-- Run daily to update metrics
```

---

## 📊 After Setup - Verify It Works

### Check First Violation (After First Post)

```sql
-- View latest violations
SELECT 
  generator_name,
  violation_type,
  severity,
  detected_phrase,
  content_preview
FROM content_violations
ORDER BY created_at DESC
LIMIT 5;

-- Expected: 0 rows initially
-- After first few posts: Should see any violations logged
```

### Monitor Generator Performance

```sql
-- Top violating generators (run after 24 hours)
SELECT 
  generator_name,
  total_violations,
  first_person_count,
  critical_violations
FROM generator_quality_metrics
ORDER BY total_violations DESC;

-- Expected: Most generators should have 0-2 violations
-- If any generator has >10: Needs prompt improvement
```

---

## ❌ If You Skip This Step

**The system will still work**, but:
- ⚠️ Violation tracking will fail (logged as errors)
- ⚠️ Cannot monitor generator performance
- ⚠️ Cannot identify which generators need improvement
- ✅ Content sanitization still works (blocks bad content)
- ✅ First-person language still blocked

**Recommendation:** Apply the migration to get full monitoring capabilities.

---

## 🆘 Troubleshooting

### Error: "relation already exists"
**Solution:** Table already created - you're good! ✅

### Error: "permission denied"
**Solution:** Use service role key or check RLS policies

### Error: "column does not exist"
**Solution:** You might have an old schema. Drop the table first:
```sql
DROP TABLE IF EXISTS content_violations CASCADE;
-- Then rerun the migration
```

### Can't access Supabase Dashboard
**Solution:** Get URL from Railway:
```bash
railway variables | grep SUPABASE
```

---

## ✅ Confirmation Checklist

After applying migration:

- [ ] Table `content_violations` exists
- [ ] View `generator_quality_metrics` exists
- [ ] Can query: `SELECT COUNT(*) FROM content_violations;`
- [ ] Function exists: `SELECT refresh_generator_quality_metrics();`
- [ ] No errors in application logs about violations table

---

## 📞 Next Steps

1. ✅ Apply this migration (2 minutes)
2. ✅ Restart Railway service (if needed)
3. ✅ Monitor first post for violations
4. ✅ Review violation logs after 24 hours

---

**File Location:** `supabase/migrations/20251018170436_content_violations_tracking.sql`

**Once completed, the entire content quality system will be fully operational with monitoring!**

