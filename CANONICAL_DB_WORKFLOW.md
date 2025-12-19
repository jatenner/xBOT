# CANONICAL DATABASE WORKFLOW

**One source of truth for all database operations**

---

## ✅ CANONICAL MIGRATION PATH

### Method
**Direct pg.Client with NODE_TLS_REJECT_UNAUTHORIZED=0**

### Why This Works
- Supabase pooler requires SSL but uses self-signed certs
- `rejectUnauthorized: false` is the ONLY pattern that works reliably
- All 15+ existing migration scripts use this exact pattern

### Commands

```bash
# Apply any new migration
pnpm db:migrate

# Verify database schema
pnpm db:doctor
```

### Environment Variables Required
- `DATABASE_URL` - Direct PostgreSQL connection string (used by migrations)
- `SUPABASE_URL` - Supabase project URL (used by runtime client)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (used by runtime client)

---

## 🎯 DATABASE TARGET

**Canonical Truth:**
- **Host:** `aws-0-us-east-1.pooler.supabase.com`
- **Database:** `postgres`
- **Project:** `qtgjmaelglghnlahqpbl` (from SUPABASE_URL)

**Verification:**
```bash
pnpm db:doctor
```

Expected output:
```
[DB_VERIFY] Target: host=aws-0-us-east-1.pooler.supabase.com dbname=postgres
[DB_VERIFY] ✅ Connection successful
[DB_VERIFY] ✅ content_metadata.decision_id
[DB_VERIFY] ✅ content_metadata.tweet_id
[DB_VERIFY] ✅ content_metadata.thread_tweet_ids
[DB_VERIFY] ✅ system_events.component
[DB_VERIFY] ✅ system_events.message
[DB_VERIFY] ✅ post_receipts.receipt_id
[DB_VERIFY] ✅ post_receipts.tweet_ids

[DB_VERIFY] ✅ PASS - All required schema elements present
```

---

## 📋 REQUIRED SCHEMA ELEMENTS

### Tables
1. **content_metadata** (view) - Canonical posting truth
   - `decision_id` (UUID, PK)
   - `tweet_id` (TEXT)
   - `thread_tweet_ids` (JSONB)
   - `status` (TEXT)
   - `posted_at` (TIMESTAMPTZ)

2. **system_events** - Structured event logging
   - `component` (TEXT)
   - `event_type` (TEXT)
   - `severity` (TEXT)
   - `message` (TEXT)
   - `metadata` (JSONB)

3. **post_receipts** - Immutable posting proof
   - `receipt_id` (UUID, PK)
   - `tweet_ids` (TEXT[])
   - `root_tweet_id` (TEXT)
   - `post_type` (TEXT)
   - `posted_at` (TIMESTAMPTZ)
   - `reconciled_at` (TIMESTAMPTZ, nullable)

---

## 🚫 ANTI-PATTERNS (DO NOT USE)

❌ **Manual SQL paste in Supabase dashboard**
   - Reason: No version control, no verification

❌ **supabase db push** (without NODE_TLS_REJECT_UNAUTHORIZED=0)
   - Reason: SSL certificate errors

❌ **Multiple migration systems**
   - Reason: Confusion, drift, failures

❌ **Hardcoded SSL config in code**
   - Reason: Inconsistent, hard to debug

---

## 🔧 IMPLEMENTATION FILES

### Migration Runner
**File:** `scripts/applyPostReceiptsMigration.ts`
**Pattern:**
```typescript
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // CANONICAL
});
```

### Verification Script
**File:** `scripts/verifyDbConnection.ts`
**Purpose:** Verify schema + connection before app start

### Migration Files
**Location:** `supabase/migrations/*.sql`
**Naming:** `YYYYMMDD_description.sql`
**Format:** Idempotent SQL (IF NOT EXISTS, IF EXISTS, etc.)

---

## 🎯 VALIDATION IN RAILWAY

### One-Command Verification
```bash
railway run --service xBOT pnpm db:doctor
```

Expected: `✅ PASS`

### If FAIL
1. Check Railway env vars: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
2. Verify they point to same project
3. Run migration: `railway run --service xBOT pnpm db:migrate`
4. Re-verify: `railway run --service xBOT pnpm db:doctor`

---

## 📊 PROOF OF CORRECTNESS

### Local Verification (Dec 19, 2025)
```
[MIGRATION] Target: host=aws-0-us-east-1.pooler.supabase.com dbname=postgres
[MIGRATION] ✅ Connected
[MIGRATION] ✅ SQL executed
[MIGRATION] ✅ Table post_receipts verified
[MIGRATION] ✅ Found 5 indexes

[DB_VERIFY] ✅ PASS - All required schema elements present
```

### Runtime Confirmation
- App uses `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
- Migrations use `DATABASE_URL` (same host/dbname)
- Both point to: `qtgjmaelglghnlahqpbl.supabase.co`

---

## 🔒 SECURITY NOTE

`NODE_TLS_REJECT_UNAUTHORIZED=0` is **required** for Supabase pooler connections.

This is:
- ✅ Safe for Supabase (their pooler uses self-signed certs)
- ✅ Standard practice (all 15+ existing migrations use it)
- ✅ Only used for migration scripts (not runtime)
- ❌ Do NOT use for public internet connections

---

## 📝 CHANGELOG

**2025-12-19:** Established canonical workflow
- Applied `post_receipts` migration
- Created `verifyDbConnection.ts`
- Documented `NODE_TLS_REJECT_UNAUTHORIZED=0` as canonical pattern
- Verified all schema elements present

---

**END OF CANONICAL WORKFLOW**

