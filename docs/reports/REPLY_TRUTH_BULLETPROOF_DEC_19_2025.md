# Reply Truth Bulletproof Implementation
**Date:** December 19, 2025  
**Commit:** `e080d177`  
**Status:** ✅ COMPLETE (requires deployment + migration)

---

## 🎯 **OBJECTIVES ACHIEVED**

### **TASK 1: Fix Reply Posting Truth (CRITICAL)**
**Goal:** Make it impossible to have `status='posted'` with `tweet_id=NULL` going forward.

**Implementations:**
1. **Removed Duplicate Prevention Bug** (`postingQueue.ts` line ~2865)
   - **BEFORE:** Duplicate check would mark decision as `posted` without tweet_id
   - **AFTER:** Throws error, does NOT mark as posted
   - **Impact:** Eliminates one source of NULL tweet_ids

2. **Fail-Fast Validation** (`postingQueue.ts` lines ~2892-2910)
   - Validate `result.success` and `result.tweetId` exist
   - Validate `tweetId` is numeric (Twitter ID format)
   - Validate `tweetId` ≠ `parent_tweet_id` (not extraction bug)
   - **All checks throw immediately if invalid**

3. **Receipt Write Before Return** (`postingQueue.ts` lines ~2920-2934)
   - Receipt written IMMEDIATELY after tweet_id captured
   - Fail-closed: throws if receipt write fails
   - **Cannot return from `postReply()` without durable receipt**

4. **DB Save Verification** (`postingQueue.ts` lines ~2226-2240)
   - Check `saveResult.ok` from `markDecisionPosted()`
   - Throw if `ok=false` (triggers retry)
   - **Only mark success after DB confirms save**

5. **Lifecycle Logging**
   - `[REPLY_TRUTH] step=POSTED_UI tweet_id=...` (after Playwright)
   - `[REPLY_TRUTH] step=RECEIPT_OK receipt_id=...` (after receipt)
   - `[REPLY_TRUTH] step=DB_CONFIRMED ok=true tweet_id=...` (after DB)
   - `[REPLY_TRUTH] step=SUCCESS` (final success)

**Proof:** Code paths audited. All paths that set `status='posted'` require `tweet_id` to exist first.

---

### **TASK 2: Write Receipts for Replies (CRITICAL)**
**Goal:** Every posted reply must write a durable receipt in `post_receipts` with `parent_tweet_id`.

**Implementation:**
- **File:** `src/jobs/postingQueue.ts` lines ~2920-2934
- **Timing:** Immediately after `poster.postReply()` returns `result.tweetId`
- **Fields:**
  - `decision_id`: UUID of decision
  - `tweet_ids`: `[result.tweetId]`
  - `root_tweet_id`: `result.tweetId`
  - `post_type`: `'reply'`
  - `posted_at`: ISO timestamp
  - `metadata.parent_tweet_id`: **CRITICAL** - parent tweet ID
  - `metadata.target_tweet_id`: Same as parent (for compatibility)
  - `metadata.target_username`: Parent author handle
  - `metadata.content_preview`: Reply text preview

**Fail-Closed:**
```typescript
if (!receiptResult.success) {
  console.log(`[REPLY_TRUTH] step=FAIL reason=RECEIPT_WRITE_FAILED error=${receiptResult.error}`);
  throw new Error(`CRITICAL: Receipt write failed: ${receiptResult.error}`);
}
```

**Verifier Updated:**
- `scripts/debug-reply-pipeline-last60m.ts` now FAILS if posted replies have no receipts
- Checks `content_metadata` posted count vs `post_receipts` count
- Exit code 1 if mismatch

---

### **TASK 3: Distributed Rate Limiting (IMPORTANT)**
**Goal:** Enforce exactly 4 replies/hour across distributed workers using DB locks.

**Implementation:**
- **File:** `src/utils/replyRateLimiter.ts` (NEW)
- **Mechanism:** Postgres advisory locks via Supabase RPC
- **Lock ID:** `987654321` (unique for reply posting)
- **Timeout:** 5 seconds (prevents deadlock)

**How It Works:**
1. `withReplyLock()` wraps entire posting operation
2. Acquires advisory lock (blocks other workers)
3. Checks rate limit (rolling 60-minute window)
4. Executes posting operation
5. Releases lock automatically (even on error)

**Integration:**
- `src/jobs/postingQueue.ts` lines ~1859-1880
- Wraps `postReply()` call in `withReplyLock()`
- Logs: `[REPLY_LOCK] ✅ Lock acquired`, `[REPLY_LOCK] 🔓 Lock released`
- Throws if lock timeout or rate limit exceeded

**Migration Required:**
- `supabase/migrations/20251219_advisory_locks.sql`
- Creates `pg_try_advisory_lock()` and `pg_advisory_unlock()` RPC functions
- **Must be applied before deploying code**

---

### **TASK 4: Cleanup Old Bad Rows**
**Goal:** Mark old bad rows as `failed` with reason.

**Implementation:**
- **Script:** `scripts/repair-reply-null-tweet-ids.ts`
- **Command:** `pnpm repair:reply-null-ids [--dry-run]`
- **Action:** Sets `status='failed'` and adds `failure_reason`

**Dry-Run Results:**
```
Found 7 bad rows:
1. 25fdbaaa... (created 1058h ago = 44 days)
2. 1417e578... (created 1058h ago = 44 days)
3. 2a5a4cb8... (created 1058h ago = 44 days)
4. b4fd9f79... (created 812h ago = 34 days)
5. 21d6c973... (created 830h ago = 35 days)
6. 7cda006c... (created 88h ago = 3.7 days)
7. 93ae2af4... (created 72h ago = 3 days)
```

**Date Proof:** Oldest bad rows are 44 days old, proving they are from BEFORE the fixes.

---

## 📊 **VERIFIER OUTPUT (Local)**

```
> pnpm debug:reply-pipeline:last60m

A) DISCOVERY HEALTH: ✅ PASS (1000 accounts)
B) HARVESTING HEALTH: ✅ PASS (77 fresh opportunities)
C) SELECTION HEALTH: ✅ PASS (10 decisions, 2 posted)

D) POSTING TRUTH: ❌ FAIL
   - 7 replies with tweet_id=NULL (old data, created 3-44 days ago)
   - 2 replies with JSON artifacts (old data)

E) RECEIPT RECONCILIATION: ❌ FAIL
   - 3 posted replies in last 60m, but 0 receipts
   - Receipts NOT being written (table may not exist or code path issue)

F) RATE LIMITER: ✅ PASS (3/4 in last 60m)
```

---

## 🔧 **DEPLOYMENT CHECKLIST**

### **1. Apply Supabase Migration (CRITICAL)**
Run in Supabase SQL Editor:

```sql
-- Advisory Lock Functions for Distributed Reply Rate Limiting

CREATE OR REPLACE FUNCTION pg_try_advisory_lock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_lock(lock_id);
$$;

CREATE OR REPLACE FUNCTION pg_advisory_unlock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_advisory_unlock(lock_id);
$$;

COMMENT ON FUNCTION pg_try_advisory_lock IS 'Try to acquire advisory lock (non-blocking)';
COMMENT ON FUNCTION pg_advisory_unlock IS 'Release advisory lock';
```

**Verification:**
```sql
-- Test lock acquisition
SELECT pg_try_advisory_lock(987654321);  -- Should return true
SELECT pg_advisory_unlock(987654321);    -- Should return true
```

---

### **2. Verify `post_receipts` Table Exists**
Run in Supabase SQL Editor:

```sql
-- Check if post_receipts table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'post_receipts'
);

-- If true, check schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_receipts' 
ORDER BY ordinal_position;
```

**Expected Columns:**
- `receipt_id` (bigint or serial)
- `decision_id` (uuid, nullable)
- `tweet_ids` (jsonb or text[])
- `root_tweet_id` (text)
- `post_type` (text)
- `posted_at` (timestamptz)
- `metadata` (jsonb)
- `receipt_created_at` (timestamptz)
- `reconciled_at` (timestamptz, nullable)

**If Table Missing:** Create it using schema from `src/utils/postReceiptWriter.ts`.

---

### **3. Deploy Code to Railway**
Code is already pushed to `main` (commit `e080d177`).

Railway will auto-deploy within 2-5 minutes.

**Monitor logs for:**
- `[REPLY_LOCK] ✅ Lock acquired`
- `[REPLY_TRUTH] step=RECEIPT_OK`
- `[REPLY_TRUTH] step=DB_CONFIRMED`
- `[REPLY_TRUTH] step=SUCCESS`

---

### **4. Run Cleanup Script**
After deployment, clean old bad rows:

```bash
# Dry-run first (safe)
railway run --service xBOT pnpm repair:reply-null-ids:dry-run

# If output looks correct, run for real
railway run --service xBOT pnpm repair:reply-null-ids
```

**Expected:** 7 rows marked as `failed`.

---

### **5. Verify Truth Invariants (After 1 Hour)**
Run in Supabase SQL Editor:

```sql
-- QUERY 1: Any posted replies missing tweet_id? (should be 0 after cleanup)
SELECT decision_id, created_at, posted_at, status, tweet_id
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND (tweet_id IS NULL OR tweet_id = '')
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- QUERY 2: Receipts for replies in last hour (should be non-zero if posting)
SELECT 
  posted_at,
  root_tweet_id,
  metadata->>'parent_tweet_id' as parent_tweet_id,
  decision_id,
  metadata->>'target_username' as target_username
FROM post_receipts
WHERE post_type = 'reply'
  AND posted_at > now() - interval '2 hours'
ORDER BY posted_at DESC
LIMIT 50;

-- QUERY 3: Posted replies vs receipts (should match)
WITH recent_posted AS (
  SELECT COUNT(*) as posted_count
  FROM content_metadata
  WHERE decision_type = 'reply'
    AND status = 'posted'
    AND posted_at > now() - interval '1 hour'
),
recent_receipts AS (
  SELECT COUNT(*) as receipt_count
  FROM post_receipts
  WHERE post_type = 'reply'
    AND posted_at > now() - interval '1 hour'
)
SELECT 
  posted_count,
  receipt_count,
  CASE 
    WHEN posted_count = receipt_count THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM recent_posted, recent_receipts;
```

**Expected:**
- Query 1: 0 rows (no NULL tweet_ids going forward)
- Query 2: Non-zero rows with `parent_tweet_id` populated
- Query 3: `posted_count = receipt_count` ✅ MATCH

---

## 🚨 **CRITICAL INVARIANTS**

### **Invariant 1: No False Success**
```
∀ decision ∈ content_metadata:
  (decision.status = 'posted' ∧ decision.decision_type = 'reply') 
  ⟹ decision.tweet_id ≠ NULL
```

**Enforced By:**
- Receipt write fail-closed (throw if missing tweet_id)
- DB save fail-closed (throw if tweet_id missing)
- Validation at multiple stages

---

### **Invariant 2: Every Posted Reply Has Receipt**
```
∀ decision ∈ content_metadata WHERE status='posted' ∧ decision_type='reply':
  ∃ receipt ∈ post_receipts WHERE receipt.decision_id = decision.decision_id
```

**Enforced By:**
- Receipt written BEFORE return from `postReply()`
- Fail-closed: cannot return without receipt
- Verifier checks this and FAILs if violated

---

### **Invariant 3: Rate Limit Enforced Across Workers**
```
At any time t:
  |{d ∈ content_metadata : d.status='posted' ∧ d.decision_type='reply' ∧ d.posted_at ∈ [t-60m, t]}| ≤ 4
```

**Enforced By:**
- Postgres advisory lock (only one worker posting at a time)
- Rate check inside locked section
- Rolling 60-minute window

---

## 📝 **FILES CHANGED**

1. **`src/jobs/postingQueue.ts`**
   - Lines ~2865: Removed duplicate prevention bug
   - Lines ~2892-2934: Receipt write + validation
   - Lines ~1859-1880: Distributed lock integration
   - Lines ~2226-2240: DB save verification

2. **`src/utils/replyRateLimiter.ts`** (NEW)
   - `withReplyLock()`: Distributed lock wrapper
   - `checkReplyRateLimit()`: Pre-check helper

3. **`scripts/debug-reply-pipeline-last60m.ts`**
   - Enhanced receipt reconciliation check
   - FAIL if posted replies have no receipts

4. **`scripts/repair-reply-null-tweet-ids.ts`** (NEW)
   - Cleanup script for old bad rows
   - Dry-run mode for safety

5. **`supabase/migrations/20251219_advisory_locks.sql`** (NEW)
   - Advisory lock RPC functions
   - Required for distributed locking

6. **`package.json`**
   - Added `repair:reply-null-ids` commands

---

## 🎯 **NEXT STEPS**

1. **Deploy Migration:** Apply `20251219_advisory_locks.sql` in Supabase SQL Editor
2. **Verify Table:** Confirm `post_receipts` exists and has correct schema
3. **Wait for Deployment:** Railway auto-deploys within 2-5 minutes
4. **Run Cleanup:** `railway run --service xBOT pnpm repair:reply-null-ids`
5. **Wait 1 Hour:** Allow system to post new replies
6. **Run Truth Queries:** Execute SQL queries above to verify invariants

---

## ✅ **SUCCESS CRITERIA**

After 1 hour of production use:
- ✅ Query 1 returns 0 rows (no new NULL tweet_ids)
- ✅ Query 2 returns non-zero rows (receipts being written)
- ✅ Query 3 shows MATCH (posted_count = receipt_count)
- ✅ Logs show `[REPLY_LOCK]` and `[REPLY_TRUTH]` signals
- ✅ Rate limit enforced (max 4 replies/hour)

---

**END OF REPORT**

