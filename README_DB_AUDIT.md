# 🗄️ Database Inventory & Cleanup Starter Kit

A comprehensive toolkit for auditing, documenting, and cleaning up your Snap2Health X-Bot database.

## 🎯 Quick Start

```bash
# Run database audit
npm run db:audit

# Review results and documentation
cat docs/db-schema.md

# Apply cleanup (after review)
# psql -f migrations/zzz_soft_delete_20241218.sql
```

## 📁 Files Created

### Core Tools
- **`scripts/table_audit.sql`** - PostgreSQL audit queries
- **`scripts/tableHeat.ts`** - TypeScript execution script
- **`docs/db-schema.md`** - Complete schema documentation
- **`migrations/zzz_soft_delete_20241218.sql`** - Cleanup migration template

### Package Scripts
- **`npm run db:audit`** - Run the complete audit process

## 🔍 What the Audit Shows

The audit analyzes:
- **Row counts** - How much data each table contains
- **Table sizes** - Disk space usage
- **Activity status** - ACTIVE/EMPTY/STALE classification
- **Code references** - Which tables are used in your codebase
- **Cleanup recommendations** - Safe-to-remove candidates

## 📊 Current Database State

Based on the latest audit results:

| Table | Rows | Status | Action | Notes |
|-------|------|--------|---------|-------|
| tweets | 81 | ✅ KEEP | Active use | Core bot functionality |
| learning_insights | 91 | ✅ KEEP | Active use | AI learning data |
| bot_config | 28 | ✅ KEEP | Active use | Configuration storage |
| content_themes | 6 | ✅ KEEP | Active use | Content strategy |
| control_flags | 3 | ✅ KEEP | Active use | Kill switches |
| api_usage | 2 | ✅ KEEP | Active use | Quota tracking |
| timing_insights | 2 | ✅ KEEP | Active use | Posting optimization |
| style_performance | 2 | ✅ KEEP | Active use | Style analytics |
| replies | 0 | ⚠️ CANDIDATE | Empty table | Reply functionality unused |
| target_tweets | 0 | ⚠️ CANDIDATE | Empty table | Target identification unused |
| engagement_analytics | 0 | ⚠️ CANDIDATE | Empty table | Analytics feature unused |
| content_recycling | 0 | ⚠️ CANDIDATE | Empty table | Recycling feature unused |
| media_history | 0 | ⚠️ CANDIDATE | Empty table | Image tracking unused |
| news_cache | 0 | ⚠️ CANDIDATE | Empty table | News caching unused |

## 🚨 Safety Features

### Soft Delete Approach
- Tables are **renamed** with `zzz_` prefix, not dropped
- Data remains recoverable for 30+ days
- Audit log tracks all changes
- Easy rollback process

### Verification Steps
1. **Code analysis** - Scans for table references
2. **Manual review** - Human approval required
3. **Backup reminder** - Explicit backup instructions
4. **Audit trail** - Complete change tracking

## 🛠️ Usage Guide

### 1. Run the Audit
```bash
npm run db:audit
```

This will:
- Analyze all tables for size, activity, and usage
- Scan codebase for table references
- Generate cleanup recommendations
- Display results in formatted tables

### 2. Review Documentation
```bash
# Read complete schema docs
cat docs/db-schema.md

# Check specific table info
grep -A 10 "table_name" docs/db-schema.md
```

### 3. Apply Cleanup (If Needed)
```bash
# 1. Create database backup first!
pg_dump your_database > backup_$(date +%Y%m%d).sql

# 2. Review the migration
cat migrations/zzz_soft_delete_20241218.sql

# 3. Edit migration to include actual tables to rename
# 4. Apply the migration
psql -f migrations/zzz_soft_delete_20241218.sql
```

### 4. Monitor Results
```bash
# Check for renamed tables
psql -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'zzz_%';"

# Review audit log
psql -c "SELECT * FROM cleanup_audit_log ORDER BY cleanup_date DESC;"
```

## 🔧 Customization

### Add New Tables to Monitor
Edit `scripts/tableHeat.ts`:
```typescript
const knownTables = [
  'tweets', 'replies', // ... existing tables
  'your_new_table'     // Add here
];
```

### Modify Cleanup Criteria
Edit `scripts/table_audit.sql`:
```sql
CASE 
  WHEN ts.row_count = 0 AND ra.total_operations = 0 THEN 'HIGH_CLEANUP_CANDIDATE'
  WHEN ts.row_count < 5 THEN 'CUSTOM_CRITERIA'  -- Your criteria
  -- ...
END as cleanup_recommendation
```

### Change Risk Thresholds
Adjust these values in the audit script:
- **Empty table threshold**: `row_count = 0`
- **Low activity threshold**: `row_count < 10`
- **Stale operation threshold**: `total_operations < 5`

## 📋 Maintenance Schedule

### Weekly
- Run `npm run db:audit` to check table growth
- Review any new EMPTY tables

### Monthly  
- Full documentation review
- Consider cleanup of long-empty tables
- Update schema docs if needed

### Quarterly
- Deep analysis of table usage patterns
- Review and update cleanup criteria
- Archive old audit logs

## 🔄 Recovery Process

If you need to restore a soft-deleted table:

```sql
-- 1. Find the table in audit log
SELECT * FROM cleanup_audit_log WHERE table_name = 'original_name';

-- 2. Rename back to original
ALTER TABLE zzz_tablename_unused_20241218 RENAME TO original_name;

-- 3. Update audit log
UPDATE cleanup_audit_log 
SET can_restore = false 
WHERE new_name = 'zzz_tablename_unused_20241218';
```

## 📈 Benefits

### Database Performance
- **Reduced clutter** - Remove unused tables
- **Faster queries** - Less metadata to scan
- **Cleaner backups** - Smaller backup files

### Development Productivity  
- **Clear documentation** - Know what each table does
- **Usage tracking** - Understand table relationships
- **Safe cleanup** - Remove technical debt safely

### Operational Excellence
- **Audit trail** - Track all database changes
- **Recovery options** - Easy rollback process
- **Automated monitoring** - Regular health checks

## 🚀 Advanced Features

### Custom Audit Queries
Add your own analysis to `scripts/table_audit.sql`:
```sql
-- Find tables with old data
SELECT table_name, MAX(created_at) as last_insert
FROM information_schema.tables t
JOIN your_timestamp_analysis ON t.table_name = ...;
```

### Integration with CI/CD
```yaml
# .github/workflows/db-audit.yml
- name: Database Audit
  run: npm run db:audit
  
- name: Check for empty tables
  run: |
    if [[ $(npm run db:audit | grep "EMPTY" | wc -l) -gt 5 ]]; then
      echo "Many empty tables detected - consider cleanup"
    fi
```

### Monitoring Dashboard
Connect audit results to your monitoring:
```typescript
// Monitor table growth trends
const metrics = await runTableAudit();
sendMetrics('db.table_count', metrics.totalTables);
sendMetrics('db.empty_tables', metrics.emptyTables);
```

## ⚡ Troubleshooting

### "RPC not available" Error
The script falls back to direct queries automatically. This is normal for some Supabase configurations.

### Permission Errors
Ensure your Supabase service role has:
- `SELECT` permissions on system tables
- `SELECT` permissions on all user tables
- `ALTER TABLE` permissions for cleanup

### No Tables Found
Check your connection string and ensure you're connected to the correct database.

---

## 📞 Support

For questions about this toolkit:
1. Check the schema documentation: `docs/db-schema.md`
2. Review audit results: `npm run db:audit`  
3. Consult the migration template: `migrations/zzz_soft_delete_20241218.sql`

**Remember**: Always backup before cleanup! 🛡️ 