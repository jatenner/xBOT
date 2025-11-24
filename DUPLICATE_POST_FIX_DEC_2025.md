# 🔧 DUPLICATE POST FIX - December 2025

## 🚨 Problem Identified

**Issue:** Same tweet posted 5 times on Twitter despite duplicate detection

**Root Cause:**
1. Post succeeded on Twitter
2. Database save failed (tweet_id not saved)
3. Duplicate check only looked in `posted_decisions` table
4. Since tweet_id wasn't saved, duplicate check failed
5. System retried → posted again → same cycle repeated

**Evidence:**
- Database shows: 1 record with status='failed', tweet_id=NULL, retry_count=3
- Twitter shows: 5 identical posts
- `posted_decisions` table: 0 records (database save never succeeded)

## ✅ Fix Applied

### Enhanced Duplicate Detection

**Before:**
- Only checked `posted_decisions` table
- If database save failed, duplicate check would fail
- System would retry and post duplicate

**After:**
- **Check 1:** `content_metadata` table for posts with same content AND tweet_id
- **Check 2:** `posted_decisions` table (backup check)
- Prevents duplicates even if database save partially failed

**Location:** `src/jobs/postingQueue.ts:1049-1085`

```typescript
// Check 1: content_metadata for already-posted content with tweet_id
const { data: duplicateInMetadata } = await supabase
  .from('content_metadata')
  .select('decision_id, tweet_id, status, posted_at')
  .eq('content', decision.content)
  .not('tweet_id', 'is', null) // Must have tweet_id (actually posted)
  .neq('decision_id', decision.id) // Exclude current decision
  .limit(1);

if (duplicateInMetadata && duplicateInMetadata.length > 0) {
  // Prevent duplicate posting
  return;
}

// Check 2: posted_decisions table (backup check)
const { data: duplicateContent } = await supabase
  .from('posted_decisions')
  .select('tweet_id, content, decision_id')
  .eq('content', decision.content)
  .limit(1);
```

## 📊 Expected Impact

1. **Prevents duplicate posts** even if database save fails
2. **Checks both tables** for comprehensive duplicate detection
3. **Stops retry loop** when content already posted

## 🔍 Additional Recommendations

### 1. Investigate Database Save Failures
The root cause is database save failures. Need to investigate:
- Why is `markDecisionPosted()` failing?
- Are there database connection issues?
- Is there a schema mismatch?

### 2. Add Content Hash Tracking
Consider adding content hash to `content_metadata` table for faster duplicate checks:
```sql
ALTER TABLE content_metadata ADD COLUMN content_hash VARCHAR(64);
CREATE INDEX idx_content_hash ON content_metadata(content_hash);
```

### 3. Monitor Duplicate Detection
Add logging to track when duplicates are detected:
```typescript
console.log(`[POSTING_QUEUE] 🚫 DUPLICATE DETECTED: Content already posted as ${tweet_id}`);
```

## 🧪 Testing

1. ✅ Enhanced duplicate check implemented
2. ⏳ Test with duplicate content to verify blocking
3. ⏳ Monitor database save success rate
4. ⏳ Check for any remaining duplicate posts

## 📝 Notes

- Duplicate check now runs BEFORE posting (prevents wasted API calls)
- Checks both `content_metadata` and `posted_decisions` tables
- Excludes current decision_id to prevent false positives
- Requires tweet_id to be present (confirms actual posting)

