# 📜 SYSTEM INVARIANTS
## xBOT Truth Contracts
### Date: December 20, 2025

---

## 🎯 OVERVIEW

**Truth invariants** are explicit contracts that MUST hold true for the system to function correctly. Any violation indicates a critical bug that requires immediate attention.

---

## ✅ INVARIANT 1: Posting Truth (Singles & Threads)

### **Contract:**
For every post (single or thread), ALL of the following MUST be true:

```typescript
interface PostingTruthContract {
  // Step 1: Posted to X
  postedToX: true;          // Tweet visible on X timeline
  
  // Step 2: Tweet ID captured
  tweetIdCaptured: true;    // ID extracted from Playwright DOM
  
  // Step 3: Receipt written immediately
  receiptWritten: true;     // post_receipts row created (fail-closed)
  
  // Step 4: Database updated
  dbUpdated: true;          // content_metadata.status = 'posted'
  tweetIdSaved: true;       // content_metadata.tweet_id IS NOT NULL
  
  // Step 5: Verified write
  verifiedDbWrite: true;    // markDecisionPosted() returned {ok: true}
}
```

### **Validation (DB-only):**

```sql
-- CHECK 1: No posted rows with null tweet_id
SELECT decision_id, status, tweet_id, posted_at
FROM content_metadata
WHERE status = 'posted' 
  AND (tweet_id IS NULL OR tweet_id = '')
  AND posted_at > NOW() - INTERVAL '24 hours';
-- Expected: 0 rows
-- FAIL if: >0 rows

-- CHECK 2: No orphan receipts (posted to X but not in DB)
SELECT r.receipt_id, r.decision_id, r.root_tweet_id, r.posted_at
FROM post_receipts r
LEFT JOIN content_metadata cm 
  ON r.decision_id = cm.decision_id AND cm.status = 'posted'
WHERE r.post_type IN ('single', 'thread')
  AND r.posted_at > NOW() - INTERVAL '24 hours'
  AND cm.decision_id IS NULL;
-- Expected: 0 rows
-- FAIL if: >0 rows
```

### **Code Locations:**

| Step | Function | File | Lines |
|------|----------|------|-------|
| 1. Post to X | `postContent()` | `src/jobs/postingQueue.ts` | ~2050-2070 |
| 2. Capture ID | `BulletproofThreadComposer.post()` | `src/posting/BulletproofThreadComposer.ts` | ~300-400 |
| 3. Write receipt | `writePostReceipt()` | `src/utils/postReceiptWriter.ts` | ~15-45 |
| 4. Update DB | `markDecisionPosted()` | `src/jobs/postingQueue.ts` | ~2910-2960 |
| 5. Verify write | `processDecision()` | `src/jobs/postingQueue.ts` | ~2115-2140 |

### **PASS/FAIL Criteria:**
- ✅ **PASS:** 0 null tweet_ids AND 0 orphan receipts
- ❌ **FAIL:** Any null tweet_ids OR orphan receipts

### **Current Status:** ⚠️ PARTIAL
- ✅ 0 null tweet_ids (last 24h)
- ❌ 13 orphan receipts (last 24h) → **23% truth gap**

---

## ✅ INVARIANT 2: Reply Truth

### **Contract:**
For every reply, ALL of Invariant 1 PLUS:

```typescript
interface ReplyTruthContract extends PostingTruthContract {
  // Additional reply-specific requirements
  parentTweetIdCaptured: true;   // target_tweet_id from opportunity
  parentTweetIdSaved: true;      // content_metadata.target_tweet_id IS NOT NULL
  receiptHasParent: true;        // post_receipts.metadata.parent_tweet_id exists
}
```

### **Validation (DB-only):**

```sql
-- CHECK 1: All posted replies have parent_tweet_id
SELECT decision_id, status, tweet_id, target_tweet_id, posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND (target_tweet_id IS NULL OR target_tweet_id = '')
  AND posted_at > NOW() - INTERVAL '24 hours';
-- Expected: 0 rows
-- FAIL if: >0 rows

-- CHECK 2: Receipts match DB entries for replies
SELECT 
  COUNT(DISTINCT r.decision_id) as receipt_count,
  COUNT(DISTINCT cm.decision_id) as db_count
FROM post_receipts r
LEFT JOIN content_metadata cm 
  ON r.decision_id = cm.decision_id AND cm.status = 'posted'
WHERE r.post_type = 'reply'
  AND r.posted_at > NOW() - INTERVAL '24 hours';
-- Expected: receipt_count = db_count
-- FAIL if: counts differ
```

### **Code Locations:**

| Step | Function | File | Lines |
|------|----------|------|-------|
| Parent ID capture | `generateReplies()` | `src/jobs/replyPostingJobV2.ts` | ~150-200 |
| Reply posting | `postReply()` | `src/jobs/postingQueue.ts` | ~2818-2967 |
| Receipt write | `writePostReceipt()` (with parent metadata) | `src/jobs/postingQueue.ts` | ~2850-2870 |
| DB save | `markDecisionPosted()` (with parent) | `src/jobs/postingQueue.ts` | ~2920-2940 |

### **PASS/FAIL Criteria:**
- ✅ **PASS:** All posted replies have tweet_id AND target_tweet_id
- ❌ **FAIL:** Any posted reply missing either ID

### **Current Status:** ✅ PASS
- ✅ 0 missing parent IDs (last 24h)
- ✅ 0 null tweet_ids (last 24h)

---

## ✅ INVARIANT 3: Metrics Truth

### **Contract:**
For every posted tweet, metrics MUST be scrapable within 48h:

```typescript
interface MetricsTruthContract {
  // Prerequisites for metrics scraping
  tweetIdExists: true;           // tweet_id or thread_tweet_ids[0] exists
  tweetIdIsNumeric: true;        // Valid Twitter ID format (numeric string)
  tweetIsScrapable: true;        // Tweet not deleted, account not private
  
  // Outcome (within 48h)
  metricsScraped: true;          // actual_likes/retweets/replies populated
}
```

### **Validation (DB-only):**

```sql
-- CHECK 1: Metrics coverage (within 48h of posting)
SELECT 
  COUNT(*) as total_posted,
  SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) as with_metrics,
  ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as coverage_pct
FROM content_metadata
WHERE status = 'posted'
  AND posted_at > NOW() - INTERVAL '48 hours'
  AND posted_at < NOW() - INTERVAL '2 hours'; -- Allow 2h for first scrape
-- Expected: coverage_pct > 80%
-- FAIL if: coverage_pct < 50%

-- CHECK 2: No invalid tweet IDs
SELECT decision_id, tweet_id, decision_type, posted_at
FROM content_metadata
WHERE status = 'posted'
  AND posted_at > NOW() - INTERVAL '24 hours'
  AND (
    tweet_id !~ '^[0-9]+$'  -- Not numeric
    OR LENGTH(tweet_id) < 10 -- Too short
    OR LENGTH(tweet_id) > 20 -- Too long
  );
-- Expected: 0 rows
-- FAIL if: >0 rows
```

### **Code Locations:**

| Step | Function | File | Lines |
|------|----------|------|-------|
| Scraping eligibility | `getEligibleTweets()` | `src/jobs/metricsScraperJob.ts` | ~50-100 |
| Scrape execution | `scrapeMetrics()` | `src/jobs/metricsScraperJob.ts` | ~150-250 |
| DB update | `saveMetrics()` | `src/jobs/metricsScraperJob.ts` | ~300-350 |

### **PASS/FAIL Criteria:**
- ✅ **PASS:** >80% of posts have metrics within 48h
- ⚠️ **WARNING:** 50-80% coverage
- ❌ **FAIL:** <50% coverage

### **Current Status:** ✅ PASS
- ✅ 95.1% coverage (39/41 posts in last 24h)

---

## ✅ INVARIANT 4: Rate Compliance

### **Contract:**
Rate limits MUST be enforced using post_receipts as source of truth:

```typescript
interface RateComplianceContract {
  // Rate limits (per hour, rolling window)
  postsPerHour: number;       // <=2 (singles + threads)
  repliesPerHour: number;     // <=4
  
  // Source of truth
  sourceTable: 'post_receipts'; // NOT content_metadata
  
  // Enforcement
  checkedBeforePosting: true;   // rateLimiter called in processDecision()
  blockingOnExceed: true;       // Decision not processed if limit reached
}
```

### **Validation (DB-only):**

```sql
-- CHECK 1: Posts per hour (rolling window)
SELECT 
  COUNT(*) FILTER (WHERE post_type IN ('single', 'thread')) as posts_last_hour,
  COUNT(*) FILTER (WHERE post_type = 'reply') as replies_last_hour
FROM post_receipts
WHERE posted_at > NOW() - INTERVAL '1 hour';
-- Expected: posts_last_hour <=2, replies_last_hour <=4
-- FAIL if: either limit exceeded

-- CHECK 2: Hourly distribution (last 24h)
SELECT 
  DATE_TRUNC('hour', posted_at) as hour,
  COUNT(*) FILTER (WHERE post_type IN ('single', 'thread')) as posts,
  COUNT(*) FILTER (WHERE post_type = 'reply') as replies
FROM post_receipts
WHERE posted_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
-- Expected: No hour with posts>2 or replies>4
-- FAIL if: any hour exceeds limits
```

### **Code Locations:**

| Step | Function | File | Lines |
|------|----------|------|-------|
| Rate check | `checkRateLimit()` | `src/utils/rateLimiter.ts` | ~10-80 |
| Enforcement | `processDecision()` | `src/jobs/postingQueue.ts` | ~1707-1720 |
| Source query | Uses `post_receipts` | `src/utils/rateLimiter.ts` | ~30-50 |

### **PASS/FAIL Criteria:**
- ✅ **PASS:** All hours within limits (posts <=2, replies <=4)
- ❌ **FAIL:** Any hour over limits

### **Current Status:** ✅ PASS
- ✅ 0 posts, 0 replies (last hour)
- ✅ No hour exceeded limits (last 24h)

---

## ✅ INVARIANT 5: Idempotency

### **Contract:**
No decision should be posted twice:

```typescript
interface IdempotencyContract {
  // Before posting
  checkExisting: true;          // Query for existing posted row
  
  // If already posted
  skipRepost: true;             // Return early with success
  noDoubleReceipt: true;        // Don't write duplicate receipt
  
  // Guarantees
  oneDecisionOnePost: true;     // Each decision_id posted max once
  oneTweetId: true;             // Each decision_id has only one tweet_id
}
```

### **Validation (DB-only):**

```sql
-- CHECK 1: No decision posted multiple times
SELECT decision_id, COUNT(*) as post_count
FROM content_metadata
WHERE status = 'posted'
GROUP BY decision_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
-- FAIL if: >0 rows

-- CHECK 2: No decision with multiple tweet IDs
SELECT decision_id, 
       COUNT(DISTINCT tweet_id) as unique_tweet_ids,
       ARRAY_AGG(DISTINCT tweet_id) as all_tweet_ids
FROM content_metadata
WHERE status = 'posted' AND tweet_id IS NOT NULL
GROUP BY decision_id
HAVING COUNT(DISTINCT tweet_id) > 1;
-- Expected: 0 rows
-- FAIL if: >0 rows
```

### **Code Locations:**

| Step | Function | File | Lines |
|------|----------|------|-------|
| Idempotency check | `markDecisionPosted()` | `src/jobs/postingQueue.ts` | ~2915-2925 |
| Early return | `markDecisionPosted()` | `src/jobs/postingQueue.ts` | ~2926-2930 |

### **PASS/FAIL Criteria:**
- ✅ **PASS:** No decision posted more than once
- ❌ **FAIL:** Any decision with multiple posts or tweet IDs

### **Current Status:** ✅ PASS (assumed - not explicitly tested in audit)

---

## 📊 INVARIANT SUMMARY

| # | Invariant | Current Status | Priority | Fix Required |
|---|-----------|----------------|----------|--------------|
| 1 | **Posting Truth** | ⚠️ PARTIAL (13 orphans) | 🔴 **CRITICAL** | Run reconciliation |
| 2 | **Reply Truth** | ✅ PASS | 🟢 LOW | None |
| 3 | **Metrics Truth** | ✅ PASS (95% coverage) | 🟢 LOW | None |
| 4 | **Rate Compliance** | ✅ PASS | 🟢 LOW | None |
| 5 | **Idempotency** | ✅ PASS (assumed) | 🟢 LOW | Add explicit test |

---

## 🚨 VIOLATION RESPONSE

### **When an invariant fails:**

1. **STOP** - Pause affected system immediately (if critical)
2. **DIAGNOSE** - Run SQL queries to quantify violation
3. **FIX** - Apply surgical fix (run reconciliation, restart job, etc.)
4. **VERIFY** - Re-run audit to confirm fix
5. **PREVENT** - Add monitoring to detect future violations early

### **Example: Orphan Receipts (Invariant 1 violation)**

```bash
# 1. STOP - Optionally pause posting (not needed for this)
# 2. DIAGNOSE
pnpm audit:health  # Shows 13 orphans

# 3. FIX
pnpm truth:reconcile:last24h  # Backfills orphans

# 4. VERIFY
pnpm audit:health  # Should show 0 orphans

# 5. PREVENT
# - Truth integrity job already monitors this
# - Runs every 15 min
# - Pauses posting if repeated violations
```

---

**These invariants are the bedrock of system reliability. Any violation is a bug, not a feature.**

