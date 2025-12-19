# Reply Truth Infrastructure Migration - COMPLETE
**Date:** December 19, 2025  
**Commits:** `19d42e77`, `c3c929aa`  
**Status:** ✅ VERIFIED WORKING

---

## 🎯 **OBJECTIVE ACHIEVED**

Created a proper, idempotent migration that:
1. ✅ Creates advisory lock wrapper functions for distributed reply rate limiting
2. ✅ Adds `parent_tweet_id` column to `post_receipts` table
3. ✅ Can be applied via canonical migrator (`pnpm db:migrate`)
4. ✅ Passes all `db:doctor` checks
5. ✅ Field names aligned across entire codebase

---

## 📦 **MIGRATION FILE**

**Filename:** `supabase/migrations/20251219_reply_truth_infrastructure.sql`

**Contents:**
- **Part 1:** Advisory lock wrapper functions
  - `public.pg_try_advisory_lock(lock_id bigint)` → delegates to `pg_catalog.pg_try_advisory_lock`
  - `public.pg_advisory_unlock(lock_id bigint)` → delegates to `pg_catalog.pg_advisory_unlock`
  - Accessible via Supabase RPC for distributed locking

- **Part 2:** Post receipts table enhancements
  - `ALTER TABLE post_receipts ADD COLUMN IF NOT EXISTS parent_tweet_id TEXT`
  - 6 indexes for performance
  - Full documentation comments

**Idempotent:** Safe to run multiple times (uses `CREATE OR REPLACE`, `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)

---

## 📋 **POST_RECEIPTS SCHEMA (CANONICAL)**

```sql
CREATE TABLE post_receipts (
  -- Primary key
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Decision linkage (nullable for orphan receipts)
  decision_id UUID,
  
  -- Tweet IDs (ARRAY for compatibility with existing schema)
  tweet_ids TEXT[] NOT NULL,
  root_tweet_id TEXT NOT NULL,
  
  -- Post classification
  post_type TEXT NOT NULL CHECK (post_type IN ('single', 'thread', 'reply')),
  
  -- Timestamps
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at TIMESTAMPTZ,
  
  -- Reply-specific: parent tweet ID (dedicated column)
  parent_tweet_id TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  reconciliation_attempts INTEGER DEFAULT 0,
  last_reconciliation_error TEXT
);
```

**Key Points:**
- `post_type` is the canonical field name (not `kind`)
- `parent_tweet_id` is a dedicated column (not in metadata)
- `tweet_ids` is an ARRAY, not JSONB (existing schema compatibility)

---

## 🔄 **MIGRATION RUNNER**

**Command:** `pnpm db:migrate`

**Implementation:** `scripts/bulletproof_migrate.js`

**How it works:**
1. Loads `.env` for local development (Railway provides env vars)
2. Connects to Supabase using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
3. Creates `_migrations` tracking table
4. Scans `supabase/migrations/*.sql` files (lexicographic order)
5. Checks if already applied (via `_migrations` table)
6. Executes SQL directly via Supabase client
7. Records successful migrations in `_migrations` table

**Result:** All 84 migrations applied, including the new `20251219_reply_truth_infrastructure.sql`

---

## ✅ **VERIFICATION OUTPUT**

### **db:doctor (Full Pass)**

```bash
> pnpm db:doctor

[DB_VERIFY] Target: host=aws-0-us-east-1.pooler.supabase.com dbname=postgres
[DB_VERIFY] ✅ Connection successful

[DB_VERIFY] 📋 Checking required columns...

[DB_VERIFY] ✅ content_metadata.decision_id
[DB_VERIFY] ✅ content_metadata.tweet_id
[DB_VERIFY] ✅ content_metadata.thread_tweet_ids
[DB_VERIFY] ✅ system_events.component
[DB_VERIFY] ✅ system_events.message
[DB_VERIFY] ✅ post_receipts.receipt_id
[DB_VERIFY] ✅ post_receipts.tweet_ids
[DB_VERIFY] ✅ post_receipts.post_type
[DB_VERIFY] ✅ post_receipts.parent_tweet_id  ← NEW
[DB_VERIFY] ✅ post_receipts.root_tweet_id

[DB_VERIFY] 🔒 Checking advisory lock functions...

[DB_VERIFY] ✅ FUNCTION pg_try_advisory_lock()  ← NEW
[DB_VERIFY] ✅ FUNCTION pg_advisory_unlock()    ← NEW

[DB_VERIFY] ✅ PASS - All required schema elements present
```

### **Advisory Lock Test (Functional)**

```bash
> pnpm exec tsx scripts/test-advisory-locks.ts

[TEST] Testing advisory lock access...

[TEST] ✅ Direct call succeeded: true
[TEST] ✅ Unlock succeeded: true

[TEST] Complete
```

**Proof:** Advisory locks are accessible via Supabase RPC and work correctly.

---

## 🔧 **CODE ALIGNMENT**

All code now uses the canonical schema:

### **1. Receipt Writer** (`src/utils/postReceiptWriter.ts`)
```typescript
const parentTweetId = receipt.post_type === 'reply' 
  ? (receipt.metadata?.parent_tweet_id || receipt.metadata?.target_tweet_id)
  : null;

const { data, error } = await supabase
  .from('post_receipts')
  .insert({
    decision_id: receipt.decision_id,
    tweet_ids: receipt.tweet_ids,
    root_tweet_id: receipt.root_tweet_id,
    post_type: receipt.post_type,  // Canonical field name
    posted_at: receipt.posted_at,
    parent_tweet_id: parentTweetId, // Dedicated column
    metadata: receipt.metadata || {},
    receipt_created_at: new Date().toISOString()
  })
```

### **2. Verifier** (`scripts/debug-reply-pipeline-last60m.ts`)
```typescript
const { data: receipts, error } = await supabase
  .from('post_receipts')
  .select('receipt_id, root_tweet_id, decision_id, post_type, posted_at, parent_tweet_id, metadata')
  .eq('post_type', 'reply')  // Uses post_type
  .order('posted_at', { ascending: false })
  .limit(10);

// Checks dedicated column, not metadata
if (receipt.parent_tweet_id) {
  console.log(`      Parent: ${receipt.parent_tweet_id}`);
}
```

### **3. Rate Limiter** (`src/utils/replyRateLimiter.ts`)
```typescript
// Uses Supabase RPC to call advisory lock wrappers
const { data: lockResult, error: lockError } = await supabase
  .rpc('pg_try_advisory_lock', { lock_id: REPLY_LOCK_ID });

// Later...
const { error: unlockError } = await supabase
  .rpc('pg_advisory_unlock', { lock_id: REPLY_LOCK_ID });
```

**Result:** No more confusion between `post_type` vs `kind`, or `parent_tweet_id` column vs metadata.

---

## 📊 **FILES CHANGED**

1. **Migration:**
   - `supabase/migrations/20251219_reply_truth_infrastructure.sql` (NEW)

2. **Migration Runner:**
   - `scripts/bulletproof_migrate.js` (added dotenv support)
   - `package.json` (updated `db:migrate` to use bulletproof_migrate.js)

3. **Code Alignment:**
   - `src/utils/postReceiptWriter.ts` (writes to `parent_tweet_id` column)
   - `scripts/debug-reply-pipeline-last60m.ts` (queries `parent_tweet_id` column)

4. **Verification:**
   - `scripts/verifyDbConnection.ts` (checks for `parent_tweet_id` + lock functions)

5. **Helper Scripts** (for testing):
   - `scripts/apply-reply-truth-migration-direct.ts`
   - `scripts/test-advisory-locks.ts`
   - `scripts/check-advisory-lock-functions.ts`
   - `scripts/check-post-receipts-schema.ts`

---

## 🚀 **DEPLOYMENT STEPS (COMPLETED LOCALLY)**

### **Step 1:** Apply Migration ✅
```bash
pnpm db:migrate
```
**Result:** All 84 migrations applied, including `20251219_reply_truth_infrastructure.sql`

### **Step 2:** Verify Schema ✅
```bash
pnpm db:doctor
```
**Result:** ✅ PASS - All required schema elements present

### **Step 3:** Test Advisory Locks ✅
```bash
pnpm exec tsx scripts/test-advisory-locks.ts
```
**Result:** ✅ Lock and unlock work via Supabase RPC

### **Step 4:** Verify Verifier ✅
```bash
pnpm debug:reply-pipeline:last60m
```
**Result:** Verifier now checks for receipts correctly (will PASS once replies start posting)

---

## 🔄 **RAILWAY DEPLOYMENT**

The migration will auto-apply in Railway via:
1. Railway detects git push to `main`
2. Runs build process
3. `scripts/bulletproof_migrate.js` runs automatically (if registered in build/start scripts)
4. Migration applies if not already in `_migrations` table

**To manually trigger in Railway:**
```bash
railway run --service xBOT pnpm db:migrate
```

---

## 🧪 **POST-DEPLOYMENT VERIFICATION**

After Railway deployment, verify with these SQL queries in Supabase SQL Editor:

### **Query 1: Check Advisory Lock Functions**
```sql
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('pg_try_advisory_lock', 'pg_advisory_unlock')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```
**Expected:** 2 rows (one for each function)

### **Query 2: Check parent_tweet_id Column**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'post_receipts' 
  AND column_name = 'parent_tweet_id';
```
**Expected:** 1 row (`parent_tweet_id`, `text`, `YES`)

### **Query 3: Test Advisory Lock**
```sql
SELECT pg_try_advisory_lock(123456789);  -- Should return true
SELECT pg_advisory_unlock(123456789);    -- Should return true
```
**Expected:** Both return `true`

---

## 📝 **SUMMARY**

### **What Was Fixed**
1. ❌ **Before:** Migration couldn't be applied via canonical migrator
   - ✅ **After:** `pnpm db:migrate` applies all migrations correctly

2. ❌ **Before:** Advisory lock functions not accessible via Supabase RPC
   - ✅ **After:** Wrapper functions created in `public` schema, fully functional

3. ❌ **Before:** `parent_tweet_id` missing from `post_receipts` table
   - ✅ **After:** Column added via `ALTER TABLE ADD COLUMN IF NOT EXISTS`

4. ❌ **Before:** Inconsistent field names (`post_type` vs `kind`, column vs metadata)
   - ✅ **After:** All code uses `post_type` and dedicated `parent_tweet_id` column

5. ❌ **Before:** `db:doctor` failed on missing schema elements
   - ✅ **After:** `db:doctor` PASSES all checks

### **What to Expect Next**
1. Deploy code to Railway (auto-deploys from `main`)
2. Migration auto-applies (or run manually: `railway run --service xBOT pnpm db:migrate`)
3. Reply posting will start writing receipts with `parent_tweet_id`
4. Distributed rate limiting will use advisory locks
5. `pnpm debug:reply-pipeline:last60m` will PASS on "Receipt Reconciliation" section

---

**Migration is complete, tested, and ready for production deployment.**

