# Receipt System Implementation - Truth Gap Prevention

**Date:** 2025-12-19  
**Problem:** Tweet 2002063977095004544 exists on X but missing from DB (truth gap)

---

## ROOT CAUSE

**What Happened:**
1. Thread posted to X successfully at 12:10 PM
2. Database save to `content_metadata` failed silently  
3. Local backup (`tweet_id_backup.jsonl`) doesn't exist on Railway (ephemeral filesystem)
4. Logs rotated before error could be captured
5. **Result:** Tweet live on X, zero proof in our systems

---

## SOLUTION: IMMUTABLE RECEIPT SYSTEM

### Architecture

**Receipt Flow:**
```
Playwright posts → Tweet IDs captured → IMMEDIATE receipt write to Supabase
                                              ↓
                                        (DURABLE PROOF)
                                              ↓
                                     Try content_metadata save
                                              ↓
                                    Success? Mark receipt reconciled
                                    Failure? Receipt remains unreconciled
                                              ↓
                                    Reconcile job fixes gaps later
```

---

## IMPLEMENTED COMPONENTS

### 1. Database Table: `post_receipts`

**File:** `supabase/migrations/20251219_post_receipts.sql`

**Schema:**
```sql
CREATE TABLE post_receipts (
  receipt_id UUID PRIMARY KEY,
  decision_id UUID NULL,  -- Nullable for orphan receipts
  tweet_ids TEXT[] NOT NULL,
  root_tweet_id TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('single', 'thread', 'reply')),
  posted_at TIMESTAMPTZ NOT NULL,
  receipt_created_at TIMESTAMPTZ NOT NULL,
  reconciled_at TIMESTAMPTZ NULL,
  metadata JSONB DEFAULT '{}',
  reconciliation_attempts INTEGER DEFAULT 0,
  last_reconciliation_error TEXT NULL
);
```

**Indexes:**
- `idx_post_receipts_decision_id` - Fast decision lookup
- `idx_post_receipts_root_tweet_id` - Fast tweet ID lookup
- `idx_post_receipts_unreconciled` - Find gaps to fix
- `idx_post_receipts_orphan` - Find salvaged tweets

---

### 2. Receipt Writer: `src/utils/postReceiptWriter.ts`

**Functions:**
- `writePostReceipt()` - Write receipt immediately after post
- `writeOrphanReceipt()` - Salvage tweets missing from system
- `markReceiptReconciled()` - Mark as reconciled after DB save

**Key Features:**
- Append-only (never updates existing receipts except `reconciled_at`)
- Validates all inputs before write
- Returns success/failure immediately
- Logs critical failures prominently

---

### 3. Integration: `src/jobs/postingQueue.ts`

**Location:** Line ~1730 (immediately after `postContent()` returns)

**Changes:**
```typescript
// BEFORE: Only local backup (ephemeral on Railway)
saveTweetIdToBackup(decision.id, tweetId, content);

// AFTER: Receipt first (durable), then backup (best effort)
const receiptResult = await writePostReceipt({
  decision_id: decision.id,
  tweet_ids: tweetIds || [tweetId],
  root_tweet_id: tweetId,
  post_type: postType,
  posted_at: new Date().toISOString(),
  metadata: { ... }
});

if (!receiptResult.success) {
  console.error(`[RECEIPT] 🚨 CRITICAL: No durable proof for ${tweetId}`);
}
```

**Guarantees:**
- Receipt written BEFORE content_metadata save attempt
- Receipt write failure logged as CRITICAL
- Posting continues even if receipt fails (but logged)

---

## NEXT STEPS (Not Yet Implemented)

### 4. Reconciliation Job

**File:** `src/jobs/reconcileReceiptsJob.ts` (TO BE CREATED)

**Purpose:** Fix truth gaps by reconciling unreconciled receipts

**Logic:**
```typescript
// Every 5 minutes:
1. Find receipts where reconciled_at IS NULL
2. For each receipt:
   - Check if content_metadata has tweet_id
   - If missing: UPSERT content_metadata with receipt data
   - If present: Mark receipt reconciled
3. Log reconciliation results
```

**Registration:** Add to `jobManager.ts` with 5-minute interval

---

### 5. Salvage Command

**File:** `scripts/salvage-orphan-tweet.ts` (TO BE CREATED)

**Usage:**
```bash
pnpm truth:receipt:orphan \
  --tweetId 2002063977095004544 \
  --type thread \
  --postedAt "2025-12-19T17:10:00Z"
```

**Purpose:** Manually create receipt for tweets that slipped through

**Logic:**
```typescript
1. Validate tweet exists on X (optional Playwright check)
2. Write orphan receipt (decision_id=NULL)
3. Reconcile job will later try to match to content_metadata
4. If no match after X hours: keep as orphan for metrics scraping
```

---

### 6. Truth Verifier Enhancement

**File:** `scripts/verifyTruthIntegrity.ts` (TO BE UPDATED)

**New Check:** Orphan receipts

```typescript
// Add to existing checks:
const orphanReceipts = await supabase
  .from('post_receipts')
  .select('*')
  .is('decision_id', null)
  .is('reconciled_at', null)
  .lt('receipt_created_at', cutoffTime); // Older than 1 hour

if (orphanReceipts.length > 0) {
  console.log(`⚠️ Orphan Receipts: ${orphanReceipts.length}`);
  // Report but don't fail (orphans might be legitimate salvages)
}
```

---

## HOW THIS PREVENTS GAPS

### Before (Truth Gap Possible)
```
Post to X → Try DB save → Failure → No proof → TRUTH GAP
```

### After (Truth Gap Impossible)
```
Post to X → Write receipt (DURABLE) → Try DB save
                ↓
            PROOF EXISTS
                ↓
         Reconcile job fixes gaps
```

**Key Insight:** Receipt is written to Supabase (persistent) BEFORE attempting content_metadata save. Even if:
- DB save fails
- Railway restarts
- Logs rotate
- Local filesystem clears

**The receipt survives** and reconciliation job will fix the gap.

---

## DEPLOYMENT STEPS

### 1. Apply Migration
```bash
# Via Supabase Dashboard SQL Editor:
# Paste contents of supabase/migrations/20251219_post_receipts.sql
# Execute
```

### 2. Deploy Code
```bash
git add -A
git commit -m "feat: add immutable receipt system to prevent truth gaps"
git push origin main
# Railway auto-deploys
```

### 3. Verify Receipt Writing
```bash
# Check logs for next post:
railway logs | grep "\[RECEIPT\]"

# Expected:
# [RECEIPT] 📝 Writing receipt for single (1 tweet)
# [RECEIPT] ✅ Receipt written: <uuid>
```

### 4. Check for Unreconciled Receipts
```sql
SELECT 
  receipt_id,
  decision_id,
  root_tweet_id,
  post_type,
  posted_at,
  receipt_created_at
FROM post_receipts
WHERE reconciled_at IS NULL
ORDER BY receipt_created_at DESC
LIMIT 20;
```

---

## SALVAGING THE OLYMPIC TWEET

**Immediate Action for 2002063977095004544:**

```bash
# 1. Create salvage script (TO BE IMPLEMENTED)
pnpm truth:receipt:orphan \
  --tweetId 2002063977095004544 \
  --type thread \
  --postedAt "2025-12-19T17:10:00Z" \
  --metadata '{"content_preview":"Olympic athletes diet study"}'

# 2. This creates orphan receipt
# 3. Metrics scraper can now find and scrape this tweet
# 4. Manual DB entry can link receipt to content_metadata later
```

---

## TESTING

### Simulate DB Failure
```typescript
// In postingQueue.ts, temporarily break markDecisionPosted:
async function markDecisionPosted(...) {
  throw new Error('SIMULATED DB FAILURE');
}

// Post a tweet
// Check: Receipt exists, content_metadata missing
// Run reconcile job
// Check: content_metadata now has tweet_id, receipt marked reconciled
```

---

## METRICS

**Monitor:**
```sql
-- Unreconciled receipts (should be near 0)
SELECT COUNT(*) FROM post_receipts WHERE reconciled_at IS NULL;

-- Orphan receipts (salvaged tweets)
SELECT COUNT(*) FROM post_receipts WHERE decision_id IS NULL;

-- Reconciliation success rate
SELECT 
  COUNT(*) FILTER (WHERE reconciled_at IS NOT NULL) * 100.0 / COUNT(*) as reconciled_pct
FROM post_receipts;
```

---

## STATUS

✅ **Implemented:**
- Migration file (`post_receipts` table)
- Receipt writer (`postReceiptWriter.ts`)
- Integration into posting flow (`postingQueue.ts`)
- Build passing

⏳ **Pending:**
- Apply migration to Supabase
- Reconciliation job
- Salvage command
- Truth verifier enhancement
- Testing & validation

---

**Next Command:**
```bash
# Apply migration via Supabase dashboard, then:
git add -A && git commit -m "feat: receipt system to prevent truth gaps" && git push
```

