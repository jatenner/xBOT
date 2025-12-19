# Reply Pipeline Truth Inventory
**Date:** December 19, 2025  
**Purpose:** Document canonical write paths and success criteria for reply pipeline

---

## 📊 **SOURCE OF TRUTH TABLES**

### **Primary Table: `content_metadata`**
- **Purpose:** Canonical record of all decisions (singles, threads, replies)
- **Schema:** View backed by `content_generation_metadata_comprehensive`
- **Key Fields for Replies:**
  - `decision_id` (UUID, primary key)
  - `decision_type` = 'reply'
  - `status` ('queued' → 'posted' → 'success')
  - `content` (reply text, MUST be string)
  - `tweet_id` (posted tweet ID, NULL until posted)
  - `target_tweet_id` (parent tweet ID being replied to)
  - `target_username` (parent author handle)
  - `posted_at` (timestamp)
  - `created_at` (queued timestamp)

### **Secondary Table: `post_receipts`**
- **Purpose:** Immutable proof of posting (fail-safe ledger)
- **Key Fields for Replies:**
  - `receipt_id` (auto-increment)
  - `decision_id` (links to content_metadata)
  - `root_tweet_id` (same as tweet_id for replies)
  - `tweet_ids` (JSONB array, single ID for replies)
  - `post_type` = 'reply'
  - `posted_at` (immutable timestamp)
  - `metadata->>'parent_tweet_id'`
  - `metadata->>'parent_author'`
  - `metadata->>'context_preview'`
  - `reconciled_at` (NULL or timestamp)

---

## 🔧 **CANONICAL WRITE PATHS**

### **Path 1: Queue Reply (Generation)**

**File:** `src/jobs/replyJob.ts`  
**Function:** `generateRealReplies()`  
**Line:** ~1259

```typescript
const { data, error } = await supabase
  .from('content_metadata')
  .insert([{
    decision_id: reply.decision_id,
    decision_type: 'reply',
    content: Array.isArray(reply.content) ? reply.content[0] : reply.content,  // ✅ FIXED
    target_tweet_id: reply.target_tweet_id,
    target_username: reply.target_username,
    status: 'queued',
    scheduled_at: scheduledAt.toISOString(),
    // ... other fields
  }]);
```

**What it writes:**
- `decision_type`: 'reply'
- `content`: Reply text (string)
- `target_tweet_id`: Parent tweet ID
- `target_username`: Parent author
- `status`: 'queued'
- `tweet_id`: NULL (not posted yet)

---

### **Path 2: Post Reply to X**

**File:** `src/jobs/postingQueue.ts`  
**Function:** `postReply()`  
**Line:** ~2818-2950

```typescript
// Posts via Playwright
const result = await poster.postReply(
  decision.target_tweet_id,
  decision.content,
  decision.target_username
);

// Returns: { tweetId: "2002115756826505495" }
```

**What happens:**
1. Playwright navigates to parent tweet
2. Clicks reply button
3. Types reply content
4. Posts tweet
5. Extracts tweet ID from network response

---

### **Path 3: Save Tweet ID (Receipt)**

**File:** `src/jobs/postingQueue.ts`  
**Function:** `postReply()`  
**Line:** ~2903-2920

```typescript
// 🔒 TRUTH CONTRACT: Write receipt IMMEDIATELY (fail-closed)
const { writePostReceipt } = await import('../utils/postReceiptWriter');
const receiptResult = await writePostReceipt({
  decision_id: decision.id,
  tweet_ids: [result.tweetId],
  root_tweet_id: result.tweetId,
  post_type: 'reply',
  posted_at: new Date().toISOString(),
  metadata: {
    target_tweet_id: decision.target_tweet_id || null,
    target_username: decision.target_username || null,
    parent_author: decision.parent_author || null,
    parent_tweet_id: decision.target_tweet_id || null,
    parent_url: decision.parent_url || null,
    context_preview: decision.context_preview || null,
    // ... other fields
  }
});

if (!receiptResult.success) {
  throw new Error(`Receipt write failed: ${receiptResult.error}`);
}
```

**What it writes:**
- `post_receipts` table: Immutable record with tweet_id + parent_tweet_id
- Metadata includes context preview
- Fail-closed: throws if write fails

---

### **Path 4: Update content_metadata (Canonical)**

**File:** `src/jobs/postingQueue.ts`  
**Function:** `postReply()` calls `markDecisionPosted()`  
**Line:** ~2930-2950

```typescript
// ✅ STEP 2: Save to content_metadata for learning
const saveResult = await markDecisionPosted(
  decision.id,
  result.tweetId,
  `https://x.com/${username}/status/${result.tweetId}`,
  undefined, // Not a thread
  {
    parent_tweet_id: decision.target_tweet_id,
    parent_author: decision.parent_author,
    parent_text_preview: decision.context_preview,
    topic_label: decision.topic_label,
    confidence: decision.confidence,
    model: decision.model,
    generation_hash: decision.generation_hash,
  }
);

if (!saveResult.ok) {
  throw new Error(`DB save failed: ${saveResult.error}`);
}
```

**What it writes:**
- `content_metadata.tweet_id`: Posted tweet ID
- `content_metadata.status`: 'posted'
- `content_metadata.posted_at`: Timestamp
- `content_metadata.metadata`: Reply-specific fields

---

## ✅ **SUCCESS CRITERIA**

### **What Counts as "Success":**

**Current (Correct):**
```typescript
// In postingQueue.processDecision():
if (!result || !result.tweetId) {
  // FAIL - no tweet ID
  return false;
}

// Receipt write (fail-closed)
if (!receiptResult.success) {
  throw new Error(...);
}

// DB save (fail-closed)
if (!saveResult.ok) {
  throw new Error(...);
}

// Only after BOTH succeed:
console.log(`[LIFECYCLE] step=SUCCESS type=reply tweet_id=...`);
return true; // ✅ SUCCESS
```

**Invariant:**
- Success = tweet_id captured + receipt written + DB updated
- If ANY step fails, the entire operation fails
- No silent failures (fail-closed design)

---

## 🚨 **REPLY LINKAGE FIELDS**

### **Required Fields (Non-NULL for valid reply):**

| Field | Location | Purpose |
|-------|----------|---------|
| `decision_id` | `content_metadata` | Unique identifier |
| `decision_type` | `content_metadata` | Must be 'reply' |
| `tweet_id` | `content_metadata` | Posted tweet ID (NULL until posted) |
| `target_tweet_id` | `content_metadata` | Parent tweet ID |
| `target_username` | `content_metadata` | Parent author |
| `content` | `content_metadata` | Reply text (string, no arrays) |
| `status` | `content_metadata` | 'queued' → 'posted' |
| `posted_at` | `content_metadata` | When posted (NULL until posted) |

### **Optional Context Fields:**

| Field | Location | Purpose |
|-------|----------|---------|
| `metadata->>'parent_text_preview'` | `content_metadata` | Snippet of parent tweet |
| `metadata->>'parent_author'` | `post_receipts` | Same as target_username |
| `metadata->>'context_preview'` | `post_receipts` | Context used for generation |
| `metadata->>'topic_label'` | `content_metadata` | Detected topic |
| `metadata->>'confidence'` | `content_metadata` | Generation confidence |

---

## 🔍 **VERIFICATION QUERIES**

### **Check Last 10 Posted Replies:**

```sql
SELECT 
  decision_id,
  tweet_id,
  target_tweet_id,
  target_username,
  content,
  LENGTH(content) as content_length,
  status,
  posted_at,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
AND status = 'posted'
ORDER BY posted_at DESC
LIMIT 10;
```

**Expected:**
- All `tweet_id` NOT NULL
- All `target_tweet_id` NOT NULL
- All `content` are strings (not arrays)
- No `{`, `}`, `[`, `]` in content

### **Check Receipt Reconciliation:**

```sql
SELECT 
  r.receipt_id,
  r.root_tweet_id,
  r.decision_id,
  r.post_type,
  c.tweet_id as cm_tweet_id,
  c.status,
  r.reconciled_at
FROM post_receipts r
LEFT JOIN content_metadata c ON r.decision_id = c.decision_id
WHERE r.post_type = 'reply'
ORDER BY r.posted_at DESC
LIMIT 10;
```

**Expected:**
- `r.root_tweet_id` = `c.tweet_id`
- `c.status` = 'posted'
- No orphan receipts (c.decision_id NOT NULL)

---

## 📊 **CURRENT STATE (As of Dec 19, 2025)**

### **✅ Working:**
- Queue/save path (replyJob.ts)
- Posting path (postingQueue.ts)
- Receipt system (post_receipts)
- DB update (markDecisionPosted)
- Fail-closed design (no silent failures)

### **❌ Broken:**
- ~~Content stored as array~~ ✅ **FIXED** (commit 440015a3)
- Context fetching NOT integrated (replyContextFetcher exists but unused)
- AI generates generic content (no parent tweet in prompt)
- Reply quality gate missing (allows JSON/brackets)

### **🟡 Incomplete:**
- Rate limiting enforced (4/hour) but may not be checked early enough
- Context preview not always saved to metadata
- Learning loop may not attribute replies correctly without context

---

**END OF INVENTORY**

