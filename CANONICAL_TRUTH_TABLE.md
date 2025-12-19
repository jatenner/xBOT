# Canonical Truth Table Documentation

**Date:** 2025-12-19

---

## Source of Truth

**Function:** `markDecisionPosted()`  
**File:** `src/jobs/postingQueue.ts`  
**Lines:** 2938-3082

---

## Table: `content_metadata`

**Type:** View (writes go to underlying base table, but code uses view name)  
**Write Operation:** Lines 3009-3012

```typescript
const { error: updateError } = await supabase
  .from('content_metadata')
  .update(updateData)
  .eq('decision_id', decisionId);
```

---

## Columns Used

### Primary Key
- **`decision_id`** (UUID) - Primary identifier for decisions

### Status Tracking
- **`status`** (TEXT) - Set to `'posted'` on success (line 2995)

### Tweet ID Storage
- **`tweet_id`** (TEXT) - Stores root/single tweet ID (line 2996)
  - **CRITICAL:** Always saved for metrics scraping
  - Used for both singles and thread roots

- **`thread_tweet_ids`** (JSONB/TEXT) - Stores array of all tweet IDs (line 3003-3006)
  - Saved as JSON string: `JSON.stringify(tweetIds)`
  - **ALWAYS saved when `tweetIds.length > 1`** (multi-tweet posts)
  - Can be null for single tweets

### Timestamps
- **`posted_at`** (TIMESTAMPTZ) - Timestamp when posted (line 2997)
- **`updated_at`** (TIMESTAMPTZ) - Last update timestamp (line 2998)

---

## Write Logic

**Location:** Lines 2994-3007

```typescript
const updateData: any = {
  status: 'posted',
  tweet_id: tweetId, // Root/single tweet ID
  posted_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// THREAD TRUTH FIX: Always save thread_tweet_ids when multiple IDs
if (hasMultipleTweetIds) {
  updateData.thread_tweet_ids = JSON.stringify(tweetIds);
} else {
  updateData.thread_tweet_ids = tweetIds ? JSON.stringify(tweetIds) : null;
}
```

---

## Verification

**Location:** Lines 3020-3032

After update, reads back to verify:
```typescript
const { data: verifyData, error: verifyError } = await supabase
  .from('content_metadata')
  .select('tweet_id, status')
  .eq('decision_id', decisionId)
  .single();

if (verifyData.tweet_id !== tweetId || verifyData.status !== 'posted') {
  throw new Error(`Save verification failed`);
}
```

---

## Retry Logic

- **Max Retries:** 3 (line 2984)
- **Backoff:** Exponential (1s, 2s, 4s) - line 3048
- **Critical Failure:** Logged but doesn't throw (line 3060-3077)

---

## Summary

| Property | Value |
|----------|-------|
| **Table** | `content_metadata` |
| **Primary Key** | `decision_id` (UUID) |
| **Status Column** | `status` = `'posted'` |
| **Tweet ID Columns** | `tweet_id` (TEXT), `thread_tweet_ids` (JSONB) |
| **Write Function** | `markDecisionPosted()` |
| **File Location** | `src/jobs/postingQueue.ts:2938-3082` |
| **Retry Logic** | 3 attempts with exponential backoff |
| **Verification** | Read-back verification after write |

---

**Note:** `content_metadata` is a view, but all write operations target it by name. The underlying base table is automatically resolved by Supabase.

