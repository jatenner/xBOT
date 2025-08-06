# Database Structure Documentation

This file documents the actual structure of our Supabase database based on live analysis.

## Important Notes
- Always run diagnostic queries BEFORE creating migrations
- This database has **many tables** (400+ rows of indexes shown)
- The structure is complex with many existing constraints

## Core Tables

### `bot_config` Table
**Status: EXISTS**
**Primary Key: `id`**
**Unique Constraints: `key`**

```sql
-- Current Structure (confirmed via live query)
CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,           -- bot_config_pkey
    key VARCHAR UNIQUE NOT NULL,     -- bot_config_key_key constraint  
    -- CORRECT: value TEXT NOT NULL (confirmed via schema inspection)
    -- Missing: description TEXT
);
```

**Required Fixes:**
- ✅ Table exists with `key` column
- ✅ Has `value TEXT NOT NULL` column (CONFIRMED)  
- ❌ Missing `description TEXT` column

**Migration Strategy:**
- ✅ COMPLETED: Use existing `key` column (NOT `config_key`)
- ✅ COMPLETED: Use existing `value` column (NOT `config_value`)
- ❌ OPTIONAL: Add `description TEXT` column if needed
- Insert default configs using `key` column

### Other Major Tables (Observed)
From the index listing, the database contains tables for:
- `tweets` (primary content table)
- `agent_actions` (bot activities)
- `content_*` tables (content analysis, caching, etc.)
- `viral_*` tables (viral analysis and metrics)
- `algorithm_*` tables (algorithm tracking)
- `budget_*` tables (cost tracking)
- `ai_*` tables (AI usage logs)
- And many more...

## Migration Best Practices

### 1. Always Diagnose First
```sql
-- Check if table exists
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_name');

-- Check columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'table_name';

-- Check constraints  
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'table_name';
```

### 2. Use Safe Patterns
```sql
DO $$
BEGIN
    -- Always check before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns...) THEN
        ALTER TABLE ... ADD COLUMN ...;
    END IF;
END $$;
```

### 3. Never Assume Structure
- Don't assume column names (`config_key` vs `key`)
- Don't assume table doesn't exist
- Always check constraints before adding unique indexes
- Test with small inserts first

## Code Integration

### Reading Config (Use `key` column)
```sql
SELECT value FROM bot_config WHERE key = 'growth_metrics';
```

### Writing Config (Use `key` column)  
```sql
INSERT INTO bot_config (key, value) VALUES ('setting', '{}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## Error Prevention

### Common Migration Errors
1. **Wrong column names** - Always check actual structure first
2. **Unique constraint violations** - Check existing data before adding constraints  
3. **NOT NULL violations** - Add columns as nullable first, then populate
4. **Missing table assumptions** - Always check if table exists

### Debugging Steps
1. Run diagnostic queries first
2. Check information_schema tables
3. Look at constraint names and types
4. Test with small data sets
5. Use ON CONFLICT clauses for safety

---

**Last Updated:** 2025-08-06  
**Source:** Live Supabase database analysis via SQL queries