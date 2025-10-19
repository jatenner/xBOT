# ✅ Content Flow - How 2 Posts/Hour Actually Works

## **The Complete Flow (Step by Step)**

### **1. Startup** (main-bulletproof.ts)
```
🚀 System starts
   ↓
🕒 Job manager initializes timers
   ↓
🚀 IMMEDIATE: Run plan job NOW (don't wait 15min)
   ↓
[UNIFIED_PLAN] Generate 2 posts
   ↓
💾 Store in content_metadata (status='queued')
   - Post 1: scheduled_at = NOW + 10 minutes
   - Post 2: scheduled_at = NOW + 20 minutes
```

### **2. Every 15 Minutes** (Plan Job)
```
config: JOBS_PLAN_INTERVAL_MIN=15
   ↓
planJobUnified.ts → generateRealContent()
   ↓
Generate 2 new posts
   ↓
Store in content_metadata with future schedule times
```

### **3. Every 5 Minutes** (Posting Job)
```
config: JOBS_POSTING_INTERVAL_MIN=5
   ↓
postingQueue.ts → processPostingQueue()
   ↓
Check rate limit: MAX_POSTS_PER_HOUR=2 ✓
   ↓
Query: SELECT * FROM content_metadata 
       WHERE status='queued' 
       AND scheduled_at <= NOW + 5min grace
   ↓
Found ready posts? 
   ├─ YES → Post to Twitter → Move to posted_decisions
   └─ NO → Wait for next cycle
```

## **Rate Limiting Logic**

From `postingQueue.ts` line 96-143:
```typescript
async function checkPostingRateLimits(): Promise<boolean> {
  // Check last hour for content posts (replies have separate limit)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const { data: recentPosts } = await supabase
    .from('posted_decisions')
    .select('*')
    .eq('decision_type', 'content')  // Only count content, not replies
    .gte('posted_at', oneHourAgo.toISOString());
  
  const count = recentPosts?.length || 0;
  const maxPostsPerHour = config.MAX_POSTS_PER_HOUR; // 2
  
  if (count >= maxPostsPerHour) {
    console.log(`⚠️ Hourly CONTENT post limit reached: ${count}/${maxPostsPerHour}`);
    return false; // BLOCK posting
  }
  
  return true; // ALLOW posting
}
```

## **Math Check: Does This Give Us 2/Hour?**

**Generation Rate:**
- Plan job runs every 15 minutes
- Generates 2 posts each time  
- Total generated: 2 posts × 4 cycles = **8 posts per hour generated**

**Posting Rate:**
- Rate limiter allows MAX 2 per hour
- Posting job checks every 5 minutes
- **Only 2 posts will actually post per hour**

**Queue Behavior:**
- 8 generated - 2 posted = 6 posts stay queued
- Next hour: 6 backlog + 8 new = 14 queued, post 2
- Queue grows indefinitely! ❌

## **🚨 THE ACTUAL PROBLEM**

**Current config generates TOO MUCH:**
- Generating 8 posts/hour
- Posting only 2/hour
- Queue grows by 6 posts every hour

**This will:**
1. Fill the database with unused content
2. Old content gets stale but never posts
3. System wastes API costs generating content that won't post

## **✅ THE FIX**

**Option A: Adjust generation rate**
```
JOBS_PLAN_INTERVAL_MIN=30  (was 15)
```
- Runs every 30 minutes
- Generates 2 posts × 2 cycles = **4 posts/hour**
- Still more than needed, but manageable

**Option B: Generate 1 post per cycle** (BETTER)
```
Keep JOBS_PLAN_INTERVAL_MIN=30
Change planJobUnified.ts line 95: numToGenerate = 1
```
- Runs every 30 minutes
- Generates 1 post × 2 cycles = **2 posts/hour** ✅
- Perfect balance!

**Option C: Dynamic generation based on queue** (BEST)
```typescript
// Only generate if queue is low
const queuedCount = await countQueuedPosts();
if (queuedCount < 3) {
  // Generate more content
}
```

## **Recommended Solution**

Change config to generate exactly what we need:
```
JOBS_PLAN_INTERVAL_MIN=30  # Every 30 minutes
numToGenerate=1            # Generate 1 post per run
```

Result: **Exactly 2 posts/hour, no waste**

---

**Current Status:** System will post 2/hour but OVER-GENERATES (wastes API calls)
**After Fix:** System will generate and post exactly 2/hour efficiently

