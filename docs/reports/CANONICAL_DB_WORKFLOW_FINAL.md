# Canonical Database Workflow - Implementation Complete

**Date:** December 19, 2025  
**Status:** ✅ PRODUCTION READY

---

## 🎯 CANONICAL WORKING MIGRATION WORKFLOW

### THE ONE TRUE PATH

**File:** `scripts/bulletproof_migrate.js`  
**Command:** `pnpm db:migrate` (updated to use canonical path)  
**Method:** Supabase JS client → RPC exec_sql → Fallback to REST API

### Environment Variables (Required)
```bash
SUPABASE_URL=https://qtgjmaelglghnlahqpbl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

### What It Does
1. Connects via `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
2. Ensures `_migrations` tracking table exists
3. Reads all `.sql` files from `supabase/migrations/` (sorted alphabetically)
4. Skips migrations already recorded in `_migrations` table
5. Executes new migrations via `supabase.rpc('exec_sql')` or REST fallback
6. Records successful migrations in `_migrations` table
7. **Never fails deployment** (logs errors, continues)

### Current Target Database
- **Project Ref:** qtgjmaelglghnlahqpbl
- **Host:** qtgjmaelglghnlahqpbl.supabase.co
- **Used by:** Railway production deployment
- **Verified by:** `pnpm db:doctor` ✅

---

## 🏥 DB DOCTOR - Health Check System

### Implementation

**File:** `scripts/dbDoctor.ts`  
**Command:** `pnpm db:doctor`

### What It Checks
1. ✅ `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist
2. ✅ Can connect to database
3. ✅ Required tables exist:
   - `content_metadata`
   - `system_events`
   - `post_receipts` ✅
4. ✅ `DATABASE_URL` (if exists) points to same project as `SUPABASE_URL`

### Latest Run (Local)
```
[DB_DOCTOR] Running health check...
[DB_DOCTOR] Target: qtgjmaelglghnlahqpbl.supabase.co
[DB_DOCTOR] Found: content_metadata, system_events, post_receipts
[DB_DOCTOR] PASS
```

**Result:** All required tables exist, including `post_receipts` ✅

---

## 📊 VERIFICATION PROOF

### 1. Canonical Migration Path Identified ✅

**Evidence:**
- `package.json` line 60: `"db:migrate": "node scripts/bulletproof_migrate.js"`
- `scripts/bulletproof_migrate.js` uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Tracks migrations in `_migrations` table
- Used by Railway in production (`migrate:prod` script)

### 2. DB Doctor Validates Same Target ✅

**Evidence:**
```bash
$ pnpm db:doctor
[DB_DOCTOR] Target: qtgjmaelglghnlahqpbl.supabase.co
[DB_DOCTOR] PASS
```

Both migration system and runtime point to: **qtgjmaelglghnlahqpbl.supabase.co**

### 3. post_receipts Table Exists ✅

**Evidence:**
- `pnpm db:doctor` output shows: `Found: content_metadata, system_events, post_receipts`
- Migration `supabase/migrations/20251219_post_receipts.sql` was applied previously
- Table structure matches schema requirements

### 4. Runtime Uses Same Database ✅

**App Runtime Connection:**
- `src/db/index.ts`: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
- `src/jobs/postingQueue.ts`: Uses same Supabase client
- `src/utils/postReceiptWriter.ts`: Uses same Supabase client

**All code paths use:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

---

## 📝 UPDATED DOCUMENTATION

### 1. Package.json Scripts (Updated)
```json
{
  "db:doctor": "tsx scripts/dbDoctor.ts",
  "db:migrate": "node scripts/bulletproof_migrate.js"
}
```

### 2. Canonical Workflow Doc
**File:** `CANONICAL_MIGRATION_WORKFLOW.md`
- Documents THE ONE TRUE PATH
- Lists required env vars
- Provides verification commands
- States DO NOT USE alternatives

---

## 🚀 HOW TO VALIDATE IN RAILWAY

### One-Command Verification
```bash
railway run --service xBOT pnpm db:doctor
```

**Expected Output:**
```
[DB_DOCTOR] Running health check...
[DB_DOCTOR] Target: qtgjmaelglghnlahqpbl.supabase.co
[DB_DOCTOR] Found: content_metadata, system_events, post_receipts
[DB_DOCTOR] PASS
```

### If New Migration Needed
```bash
# 1. Add .sql file to supabase/migrations/
# 2. Apply via canonical path:
railway run --service xBOT pnpm db:migrate

# 3. Verify:
railway run --service xBOT pnpm db:doctor
```

---

## ✅ DELIVERABLES COMPLETE

### 1. Canonical Working Migration Workflow ✅
- **Identified:** `scripts/bulletproof_migrate.js`
- **Method:** Supabase JS client → RPC → REST fallback
- **Tracking:** `_migrations` table
- **Documented:** `CANONICAL_MIGRATION_WORKFLOW.md`

### 2. DB Doctor Implementation ✅
- **File:** `scripts/dbDoctor.ts`
- **CLI:** `pnpm db:doctor`
- **Checks:** Connectivity, tables, project match
- **Status:** Working, all checks pass

### 3. Proof of Same DB Target ✅
- **Migration target:** qtgjmaelglghnlahqpbl.supabase.co
- **Runtime target:** qtgjmaelglghnlahqpbl.supabase.co
- **Verified by:** `pnpm db:doctor`

### 4. Standardized Commands ✅
- `pnpm db:doctor` - Health check
- `pnpm db:migrate` - Apply migrations (canonical path)
- Updated `package.json` to enforce canonical workflow

---

## 🎯 MINIMAL VALIDATION CHECKLIST

To validate after Railway deploy:

1. ✅ **Run health check:**
   ```bash
   railway run --service xBOT pnpm db:doctor
   ```
   Expected: `[DB_DOCTOR] PASS`

2. ✅ **Check service starts:**
   ```bash
   railway logs --service xBOT | grep "DB_DOCTOR"
   ```
   Expected: No startup DB_DOCTOR failures

3. ✅ **Verify receipts write:**
   ```bash
   railway logs --service xBOT | grep "RECEIPT"
   ```
   Expected: `[RECEIPT] wrote receipt` or `[LIFECYCLE] step=RECEIPT_WRITTEN`

---

## 🚨 IMPORTANT: REMAINING WORK

This PR establishes the **canonical database workflow** and **health check system**.

**Still needed for full receipt system:**
1. ⏳ Fail-closed posting (if receipt write fails, mark RETRY_PENDING)
2. ⏳ Reconciliation job (every 5 min, fix unreconciled receipts)
3. ⏳ Salvage command (`pnpm truth:receipt:orphan`)
4. ⏳ Truth verifier enhancement (check receipt counts)

**Why not in this PR:**
- This PR focuses on **ONE problem**: Enforce deterministic DB workflow
- Receipt system features build on top of this foundation
- Incremental, testable changes

---

## 🎉 CONCLUSION

**Problem Solved:**  
Multiple migration paths causing confusion and SSL errors.

**Solution:**  
Identified and enforced THE ONE TRUE PATH (`bulletproof_migrate.js`), created health check system (`dbDoctor.ts`), documented everything.

**Evidence:**  
All checks pass, same target confirmed, no new systems introduced.

**Next Steps:**  
Deploy to Railway, run `pnpm db:doctor`, proceed with receipt system features.

---

**Implementation:** Complete  
**Verification:** Local PASS  
**Documentation:** Complete  
**Ready for:** Railway deployment & receipt system Phase 2

