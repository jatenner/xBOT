# Canonical Database Migration Workflow

## ✅ THE ONE TRUE PATH

**File:** `scripts/bulletproof_migrate.js`  
**Command:** `pnpm migrate:prod` or `node scripts/bulletproof_migrate.js`

### What it does:
1. Connects using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
2. Ensures `_migrations` tracking table exists
3. Reads all `.sql` files from `supabase/migrations/`
4. Skips already-applied migrations
5. Executes new migrations via Supabase RPC
6. Records applied migrations in `_migrations` table
7. **Never fails deployment** (continues even if migration errors)

### Required env vars:
```bash
SUPABASE_URL=https://qtgjmaelglghnlahqpbl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... (service role key)
```

### How to verify target:
```bash
pnpm db:doctor
```

### How to apply new migrations:
```bash
# 1. Add your .sql file to supabase/migrations/
# 2. Run the canonical migration command:
pnpm migrate:prod

# OR in Railway:
railway run --service xBOT pnpm migrate:prod
```

## 🚫 DO NOT USE (unless emergency)

- ❌ Manual SQL pasting in Supabase dashboard
- ❌ `supabase db push` (requires local Supabase CLI link)
- ❌ Direct `pg` client connections with custom SSL configs
- ❌ Creating new migration scripts with different methods

## ✅ Validation Commands

```bash
# Check DB connectivity and schema
pnpm db:doctor

# Verify which migrations have been applied
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('_migrations').select('*').then(({data}) => console.log(data));
"
```

## 🎯 Target Database

**Project:** qtgjmaelglghnlahqpbl.supabase.co  
**Used by:** Railway production deployment  
**Verified by:** `scripts/dbDoctor.ts`

## 📋 Migration Status

Run `pnpm db:doctor` to see:
- ✅ Connection status
- ✅ Required tables (content_metadata, system_events, post_receipts)
- ✅ Project ref match between SUPABASE_URL and DATABASE_URL

