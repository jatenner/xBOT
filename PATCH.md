# TRUTH GAP PATCHES - Minimal Fixes

**Date:** December 30, 2025  
**Goal:** Fix 3 critical bugs preventing proper post/reply tracking

---

## CONTRADICTION RESOLVED ✅

**My Error:** I stated "receipt write fails silently" then later said "receipt write is fail-closed"

**Truth:** Receipt write **IS fail-closed** for both posts and replies:
- **Posts:** Line 1820 throws `new Error('Receipt write failed')`
- **Replies:** Line 3008 throws `new Error('CRITICAL: Receipt write failed')`

**So receipt write is NOT the problem.** The actual bugs are:

---

## BUG #1: Quota Counting Doesn't Verify tweet_id ⚠️ **ROOT CAUSE OF OVER-POSTING**

### Posts Path

**File:** `src/jobs/postingQueue.ts:394-399`

**Current Code:**
```typescript
const { data: recentContent } = await supabase
  .from('content_metadata')
  .select('decision_type')
  .in('decision_type', ['single', 'thread'])
  .eq('status', 'posted')
  .gte('posted_at', oneHourAgo);
```

**Bug:** Counts ALL posts with `status='posted'`, even if `tweet_id` is NULL (phantom posts)

**Result:** System thinks quota is full when it's not, OR thinks quota available when it's not

**Why Your Issue:** "Posted 4 times in 30 minutes when limit is 2 per hour"
- Previous posts had `status='posted'` but `tweet_id=NULL` (failed DB saves)
- Quota counter ignored them (they don't have `tweet_id`)
- System thought quota available, posted 4 times

### Replies Path

**File:** `src/jobs/postingQueue.ts:429-434`

**Current Code:**
```typescript
const { count: replyCount } = await supabase
  .from('content_metadata')
  .select('*', { count: 'exact', head: true })
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .gte('posted_at', oneHourAgo);
```

**Bug:** Same issue - counts posts without verifying `tweet_id IS NOT NULL`

---

## BUG #2: Reply Fallback Uses Wrong Generator ⚠️ **CAUSES THREAD-LIKE REPLIES**

### The Flow

**File:** `src/jobs/replyJob.ts`

Reply generation has **3 paths** (in order of priority):

1. **Path A (CORRECT):** Phase 4 routing → `orchestratorRouter` → `CoreContentOrchestrator`
   - Lines 918-1012
   - Uses reply-specific logic
   - Passes quality gate
   - ✅ **This works correctly**

2. **Path B (CORRECT):** Relationship reply system
   - Lines 1017-1047
   - Optimized for follower conversion
   - ✅ **This works correctly**

3. **Path C (WRONG):** Fallback to `generators/replyGeneratorAdapter`
   - **Lines 1052-1062**
   - Called when Path A and B fail
   - Calls regular generators (dataNerd, coach, etc.) in "reply mode"
   - ❌ **This produces thread-like content**

**File:** `src/jobs/replyJob.ts:1052-1062`

**Current Code:**
```typescript
try {
    // Try to use the selected generator (only if Phase 4 routing didn't already handle it)
    if (!usePhase4Routing) {
  const { generateReplyWithGenerator } = await import('../generators/replyGeneratorAdapter');
  strategicReply = await generateReplyWithGenerator(replyGenerator, {
    tweet_content: target.tweet_content,
    username: target.account.username,
    category: target.account.category,
    reply_angle: target.reply_angle
  });
  console.log(`[REPLY_JOB] ✅ ${replyGenerator} generator succeeded`);
    }
} catch (generatorError: any) {
```

**Bug:** `generators/replyGeneratorAdapter` calls regular generators (dataNerd, coach, mythBuster) which are trained to make **standalone posts**, not contextual replies.

**Why Your Issue:** "Replies formatted as threads, not contextual"
- Path A (Phase 4) fails or isn't enabled
- Path B (Relationship) fails
- Falls back to Path C
- `generateReplyWithGenerator` calls `generateDataNerdContent({ format: 'single' })`
- DataNerd generator produces: "1/5 Curcumin, found in turmeric..." (thread opener, not reply)

---

## BUG #3: Receipt Write Succeeds But No Reconciliation ⚠️ **CAUSES MISSING POSTS**

**Not a code bug, but a missing feature.**

**Current State:**
- Tweet posts to Twitter ✅
- Receipt writes to `post_receipts` ✅  
- `markDecisionPosted()` tries to update `content_metadata`
- If DB update fails (timeout, connection error), post has receipt but `content_metadata` shows `status='queued'` or `'failed'`
- Metrics scraper reads from `content_metadata`, so tweet is invisible

**Why Your Issue:** "Posts not saved to database"
- Tweets `2005979408272863265` and `2005971984409329907` exist on Twitter
- Receipts may exist in `post_receipts`
- But `content_metadata` doesn't have them (or has wrong status)
- No reconciliation job to backfill

**Solution:** New job to sync `post_receipts` → `content_metadata` (P1 fix, not included in minimal patches)

---

## MINIMAL PATCHES (P0 ONLY)

### Patch 1: Fix Post Quota Counting

**File:** `src/jobs/postingQueue.ts`

```diff
--- a/src/jobs/postingQueue.ts
+++ b/src/jobs/postingQueue.ts
@@ -394,6 +394,7 @@
           const { data: recentContent } = await supabase
             .from('content_metadata')
             .select('decision_type')
             .in('decision_type', ['single', 'thread'])
             .eq('status', 'posted')
+            .not('tweet_id', 'is', null)
             .gte('posted_at', oneHourAgo);
```

### Patch 2: Fix Reply Quota Counting

**File:** `src/jobs/postingQueue.ts`

```diff
--- a/src/jobs/postingQueue.ts
+++ b/src/jobs/postingQueue.ts
@@ -429,6 +429,7 @@
           const { count: replyCount } = await supabase
             .from('content_metadata')
             .select('*', { count: 'exact', head: true })
             .eq('decision_type', 'reply')
             .eq('status', 'posted')
+            .not('tweet_id', 'is', null)
             .gte('posted_at', oneHourAgo);
```

### Patch 3: Remove Wrong Reply Fallback

**File:** `src/jobs/replyJob.ts`

```diff
--- a/src/jobs/replyJob.ts
+++ b/src/jobs/replyJob.ts
@@ -1048,18 +1048,11 @@
       } catch (relationshipError: any) {
         console.warn(`[REPLY_JOB] ⚠️ Relationship reply system failed, trying generator:`, relationshipError.message);
         
-        try {
-            // Try to use the selected generator (only if Phase 4 routing didn't already handle it)
-            if (!usePhase4Routing) {
-          const { generateReplyWithGenerator } = await import('../generators/replyGeneratorAdapter');
-          strategicReply = await generateReplyWithGenerator(replyGenerator, {
-            tweet_content: target.tweet_content,
-            username: target.account.username,
-            category: target.account.category,
-            reply_angle: target.reply_angle
-          });
-          console.log(`[REPLY_JOB] ✅ ${replyGenerator} generator succeeded`);
-            }
+        // ✅ FIX: Don't fall back to regular generators (they produce standalone posts, not contextual replies)
+        // If Phase 4 and Relationship systems both failed, use strategic fallback only
+        if (!usePhase4Routing) {
+          console.log(`[REPLY_JOB] ⚠️ Phase 4 routing disabled and relationship system failed, using strategic fallback`);
+          strategicReply = await strategicReplySystem.generateStrategicReply(target);
         } catch (generatorError: any) {
           // Fallback to strategicReplySystem if generator fails
           console.warn(`[REPLY_JOB] ⚠️ ${replyGenerator} generator failed, using strategic fallback:`, generatorError.message);
```

---

## CODE EVIDENCE

### Evidence 1: Receipt Write IS Fail-Closed (Posts)

**File:** `src/jobs/postingQueue.ts:1797-1820`

```typescript
if (!receiptResult.success) {
  console.error(`[POSTING_QUEUE][FLOW] ❌ STEP 2/4 FAILED: Receipt write failed`);
  console.error(`[RECEIPT] 🚨 CRITICAL: Receipt write FAILED - marking post as RETRY_PENDING`);
  console.error(`[RECEIPT] 🚨 Error: ${receiptResult.error}`);
  console.error(`[RECEIPT] 🚨 Tweet ${tweetId} is on X but we have NO DURABLE PROOF`);
  
  // Mark decision as retry_pending for reconciliation
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  await supabase
    .from('content_metadata')
    .update({
      status: 'retry_pending',
      features: {
        receipt_write_failed: true,
        tweet_id_orphan: tweetId,
        needs_reconciliation: true,
        failed_at: new Date().toISOString()
      }
    })
    .eq('decision_id', decision.id);
  
  // Fail-closed: throw to trigger retry
  throw new Error(`Receipt write failed: ${receiptResult.error}`);  // ✅ THROWS ERROR
}
```

### Evidence 2: Receipt Write IS Fail-Closed (Replies)

**File:** `src/jobs/postingQueue.ts:3006-3009`

```typescript
if (!receiptResult.success) {
  console.log(`[REPLY_TRUTH] step=FAIL reason=RECEIPT_WRITE_FAILED error=${receiptResult.error}`);
  throw new Error(`CRITICAL: Receipt write failed: ${receiptResult.error}`);  // ✅ THROWS ERROR
}
```

### Evidence 3: Quota Counting (Posts) - Missing tweet_id Check

**File:** `src/jobs/postingQueue.ts:394-402`

```typescript
// Query recent posts
const { data: recentContent } = await supabase
  .from('content_metadata')
  .select('decision_type')
  .in('decision_type', ['single', 'thread'])
  .eq('status', 'posted')
  .gte('posted_at', oneHourAgo);  // ❌ No .not('tweet_id', 'is', null)

// Count POSTS (not tweets) - threads = 1 post, singles = 1 post
const postsThisHour = (recentContent || []).length;
```

### Evidence 4: Quota Counting (Replies) - Missing tweet_id Check

**File:** `src/jobs/postingQueue.ts:429-436`

```typescript
// 🚨 FIX: Query content_metadata TABLE directly
const { count: replyCount } = await supabase
  .from('content_metadata')
  .select('*', { count: 'exact', head: true })
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .gte('posted_at', oneHourAgo);  // ❌ No .not('tweet_id', 'is', null)

const totalRepliesThisHour = (replyCount || 0) + repliesPostedThisCycle;
```

### Evidence 5: Wrong Reply Generator Fallback

**File:** `src/jobs/replyJob.ts:1048-1068`

```typescript
} catch (relationshipError: any) {
  console.warn(`[REPLY_JOB] ⚠️ Relationship reply system failed, trying generator:`, relationshipError.message);
  
  try {
      // Try to use the selected generator (only if Phase 4 routing didn't already handle it)
      if (!usePhase4Routing) {
    const { generateReplyWithGenerator } = await import('../generators/replyGeneratorAdapter');
    strategicReply = await generateReplyWithGenerator(replyGenerator, {
      tweet_content: target.tweet_content,
      username: target.account.username,
      category: target.account.category,
      reply_angle: target.reply_angle
    });
    console.log(`[REPLY_JOB] ✅ ${replyGenerator} generator succeeded`);
      }
  } catch (generatorError: any) {
    // Fallback to strategicReplySystem if generator fails
    console.warn(`[REPLY_JOB] ⚠️ ${replyGenerator} generator failed, using strategic fallback:`, generatorError.message);
    strategicReply = await strategicReplySystem.generateStrategicReply(target);
    console.log(`[REPLY_JOB] ✅ Fallback strategicReplySystem succeeded`);
    }
  }
```

**Problem:** `generators/replyGeneratorAdapter` at line 1054 imports the WRONG adapter. It should use `ai/replyGeneratorAdapter` for contextual replies.

### Evidence 6: What generators/replyGeneratorAdapter Does

**File:** `src/generators/replyGeneratorAdapter.ts:53-77`

```typescript
switch (generatorName) {
  // ✅ SUPPORT BOTH NAMING CONVENTIONS (for backwards compatibility)
  case 'data_nerd':
  case 'dataNerd':
    generated = await generateDataNerdContent({
      topic: replyTopic,
      format: 'single'
    });
    break;
    
  case 'coach':
    generated = await generateCoachContent({
      topic: replyTopic,
      format: 'single'
    });
    break;
    
  case 'myth_buster':
  case 'mythBuster':
    generated = await generateMythBusterContent({
      topic: replyTopic,
      format: 'single'
    });
    break;
```

**Problem:** These are **standalone post generators**, not reply generators. They don't know about parent tweet context. They produce "health facts" not "replies to someone's tweet".

---

## VERIFICATION COMMANDS

### Test 1: Verify Quota Enforcement (After Patch)

```bash
# Wait 2 hours, check posts count
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const { data: posts } = await supabase
  .from('content_metadata')
  .select('decision_type, tweet_id, posted_at')
  .in('decision_type', ['single', 'thread'])
  .eq('status', 'posted')
  .not('tweet_id', 'is', null')
  .gte('posted_at', twoHoursAgo);

console.log(\`Posts in last 2 hours: \${posts?.length || 0} (should be ≤ 2)\`);
posts?.forEach(p => {
  console.log(\`  - \${p.decision_type}: \${p.tweet_id} at \${p.posted_at}\`);
});
"
```

### Test 2: Verify Reply Quality (After Patch)

```bash
# Check last 5 replies for thread markers
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: replies } = await supabase
  .from('content_metadata')
  .select('tweet_id, content, target_username')
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .order('posted_at', { ascending: false })
  .limit(5);

replies?.forEach((r) => {
  console.log(\`\n@\${r.target_username}: \${r.content}\`);
  console.log(\`  Length: \${r.content.length} chars\`);
  
  // Check for thread markers
  const hasThreadMarker = r.content.match(/^\d+\/\d+/) || r.content.includes('🧵') || r.content.match(/^\d+\./);
  if (hasThreadMarker) {
    console.log(\`  ⚠️ THREAD MARKER DETECTED!\`);
  } else {
    console.log(\`  ✅ Clean reply\`);
  }
});
"
```

---

## SUMMARY

| Bug | Root Cause | Impact | Fix Time |
|-----|-----------|--------|----------|
| Over-posting | Quota doesn't verify tweet_id | Posted 4x in 30min | 2 min |
| Thread-like replies | Wrong generator fallback | Non-contextual replies | 5 min |
| Missing posts | No reconciliation (not a bug, missing feature) | Posts invisible | P1 (future) |

**Total Fix Time:** 7 minutes for P0 patches

**Deploy:** Apply 3 patches, commit, push to Railway

**Verify:** Monitor for 2 hours, check quota enforcement and reply quality

