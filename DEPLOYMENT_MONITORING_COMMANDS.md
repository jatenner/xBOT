# Deployment Monitoring - Receipt System Fix

**Commit:** `a560a4da` - fix: fail-closed receipt system + startup verification  
**Confidence:** 95% all tweets will be saved correctly  
**Deployed:** Dec 19, 2025

---

## 🚀 WHAT WAS FIXED

### Fix #1: Receipt Write Now Fail-Closed ✅
**Location:** `src/jobs/postingQueue.ts` line 1728-1769

**BEFORE:**
```typescript
// Receipt write could fail silently
if (!receiptResult.success) {
  console.error(...); // Just log
  // Continue anyway ❌
}
```

**AFTER:**
```typescript
// Receipt write MUST succeed or post fails
if (!receiptResult.success) {
  console.error(`[RECEIPT] 🚨 CRITICAL: Receipt write FAILED`);
  // Mark as retry_pending
  // Throw exception (fail-closed) ✅
  throw new Error(`Receipt write failed: ${receiptResult.error}`);
}
```

### Fix #2: DB Save Return Value Checked ✅
**Location:** `src/jobs/postingQueue.ts` line 2204

**BEFORE:**
```typescript
await markDecisionPosted(...);
dbSaveSuccess = true; // Assumed success ❌
```

**AFTER:**
```typescript
const saveResult = await markDecisionPosted(...);
if (!saveResult.ok) {
  throw new Error(`markDecisionPosted returned ok=false`);
}
dbSaveSuccess = true; // Only if verified ✅
```

### Fix #3: Startup Verification (Fail-Closed) ✅
**Location:** `src/main-bulletproof.ts` line 58-130

**NEW:**
```typescript
async function verifyDatabaseConnection() {
  // Verify Supabase client works
  // Verify post_receipts table exists
  // Verify system_events table exists
  // If ANY fail → process.exit(1) ✅
}

// Called at boot before starting jobs
await verifyDatabaseConnection();
```

---

## 📊 MONITORING COMMANDS

### 1. Check Deployment Status
```bash
railway status --service xBOT
```

### 2. Verify Startup Logs (CRITICAL)
```bash
railway logs --service xBOT --lines 200 | grep -E "BOOT commit|STARTUP"
```

**Expected output:**
```
[BOOT] commit=a560a4da node=v22.x.x
[STARTUP] 🔍 Verifying database connection and receipt system...
[STARTUP] ✅ Database connection verified
[STARTUP] ✅ post_receipts table verified
[STARTUP] ✅ system_events table verified
[STARTUP] ✅ All critical database checks passed
```

**If you see:**
```
[STARTUP] 🚨 CRITICAL: post_receipts table does not exist!
[STARTUP] 🚨 Exiting to prevent truth gaps
```
→ Run: `railway run --service xBOT pnpm db:migrate`

### 3. Monitor for Receipt Writes
```bash
railway logs --service xBOT --lines 500 | grep "RECEIPT"
```

**Expected (when next post happens):**
```
[RECEIPT] 📝 Writing receipt for single (1 tweet)
[RECEIPT]    decision_id=<uuid>
[RECEIPT]    tweet_ids=<id>
[RECEIPT] ✅ Receipt written: <receipt_id>
[LIFECYCLE] decision_id=<uuid> step=RECEIPT_SAVED receipt_id=<uuid>
```

**If you see:**
```
[RECEIPT] 🚨 CRITICAL: Receipt write FAILED
[RECEIPT] 🚨 Error: <error message>
```
→ Post will be retried (fail-closed working correctly)

### 4. Watch for Next Post (Live)
```bash
railway logs --service xBOT --follow | grep -E "POSTING_QUEUE.*Processing|RECEIPT|SUCCESS|POST_CLICKED"
```

### 5. Verify Receipt System Working
```bash
# After next post, run diagnostic
railway run --service xBOT pnpm debug:posts:last5
```

**Expected:**
```
📝 POST_RECEIPTS: Found 1 receipts (not empty anymore!)
✅ All receipts reconciled
```

### 6. Check for Truth Gaps
```bash
railway run --service xBOT pnpm debug:posts:last5 | grep -E "UNRECONCILED|Summary"
```

**Expected:**
```
📊 Summary: 0/X receipts unreconciled
```

---

## 🎯 SUCCESS CRITERIA

### Immediate (Within 5 minutes)
- ✅ Service starts successfully
- ✅ Startup logs show all database checks passed
- ✅ No `[STARTUP] 🚨 CRITICAL` errors

### Short-term (Next post, ~30 min)
- ✅ `[RECEIPT] ✅ Receipt written` log appears
- ✅ `[LIFECYCLE] step=RECEIPT_SAVED` log appears
- ✅ `[POSTING_QUEUE][SUCCESS]` log appears
- ✅ Post appears in both `content_metadata` AND `post_receipts`

### Medium-term (24 hours)
- ✅ All posts have receipts (`pnpm debug:posts:last5`)
- ✅ Zero unreconciled receipts
- ✅ No truth gaps (tweets on X match DB)

---

## 🚨 ROLLBACK PLAN

If service fails to start:
```bash
# Revert to previous commit
git revert a560a4da
git push origin main

# Or rollback in Railway dashboard
```

If receipts still not writing:
```bash
# Check env vars
railway variables | grep SUPABASE

# Verify table exists
railway run --service xBOT pnpm db:doctor

# Check Supabase client
railway run --service xBOT -- node -e "
const { getSupabaseClient } = require('./dist/db/index.js');
console.log('Client exists:', !!getSupabaseClient());
"
```

---

## 📋 QUICK CHECKLIST

- [x] Code changes applied (3 fixes)
- [x] Build successful
- [x] Committed: `a560a4da`
- [x] Pushed to Railway
- [ ] Verify startup logs (waiting for deployment)
- [ ] Monitor next post for receipt write
- [ ] Run `pnpm debug:posts:last5` to confirm receipts exist
- [ ] Verify no truth gaps after 24h

---

**Current Status:** Deployed, waiting for Railway build  
**Next:** Monitor startup logs for verification  
**ETA:** Next post in ~10-30 minutes (based on cadence)

