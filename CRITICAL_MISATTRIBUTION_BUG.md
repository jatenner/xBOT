# 🚨 CRITICAL BUG: TWEET MISATTRIBUTION

**Date:** November 20, 2025  
**Severity:** CRITICAL  
**Status:** INVESTIGATING

---

## 🚨 THE PROBLEM

**Database says:**
- Tweet ID: `1990610483947446477`
- Content: "Why doesn't mainstream medicine fully embrace the gut-brain axis..."
- Generator: `provocateur`
- Views: 20,100

**Twitter shows:**
- Tweet ID: `1990610483947446477`
- Content: "Humans have a 'second heart' in their calves that pumps blood back to the chest..."
- Image: Legs with heart on calf
- Views: 22K

**These are COMPLETELY DIFFERENT posts!**

---

## 📊 IMPACT

1. **Learning System Corrupted:**
   - Provocateur generator being credited with 20K views
   - Learning system thinks gut-brain axis content works
   - Actually, it's a different post (calves as second heart)
   - Generator weights wrong
   - Pattern learning wrong

2. **Dashboard Data Wrong:**
   - Shows wrong content for posts
   - Metrics don't match reality
   - Can't trust any performance data

3. **Content Generation Misguided:**
   - AI learning from wrong patterns
   - Generating content based on false success data
   - Making wrong decisions about what works

---

## 🔍 ROOT CAUSE ANALYSIS

### Possible Causes:

#### **1. Wrong Tweet ID Captured During Posting**
**File:** `src/jobs/postingQueue.ts` (line 920-950)

**Scenario:**
- Post content A (gut-brain axis)
- Post succeeds, but captures tweet ID from content B (calves post)
- Stores wrong tweet_id in database
- Metrics scraper scrapes wrong tweet

**Check:**
- How tweet_id is extracted from posting response
- Network interception capturing wrong ID
- Timing issues (captures ID from previous post?)

#### **2. Metrics Scraper Using Wrong Tweet ID**
**File:** `src/jobs/metricsScraperJob.ts` (line 230-280)

**Scenario:**
- Tweet_id stored correctly
- But metrics scraper uses wrong tweet_id
- Scrapes wrong tweet's metrics
- Updates database with wrong data

**Check:**
- Does scraper verify tweet_id matches content before scraping?
- Does scraper use correct tweet_id from database?

#### **3. Database Corruption/Mix-up**
**Scenario:**
- Multiple posts happening simultaneously
- Race condition mixes up tweet_ids
- Wrong ID stored for wrong decision_id

**Check:**
- Are there multiple posts happening at same time?
- Is there a race condition in postingQueue?
- Does database properly isolate concurrent posts?

---

## 🔧 IMMEDIATE FIXES NEEDED

### **1. Add Content Verification After Posting**

**File:** `src/jobs/postingQueue.ts`

**Add after posting succeeds:**
```typescript
// After posting, verify tweet_id matches content
async function verifyPostedContent(tweetId: string, expectedContent: string): Promise<boolean> {
  try {
    // Scrape the tweet and check if content matches
    const { ScrapingOrchestrator } = await import('../metrics/scrapingOrchestrator');
    const orchestrator = ScrapingOrchestrator.getInstance();
    const page = await browserPool.acquirePage('verification');
    
    const result = await orchestrator.scrapeAndStore(
      page,
      tweetId,
      { collectionPhase: 'post_verification' },
      { useAnalytics: false }
    );
    
    if (!result.success || !result.content) {
      console.error(`[POSTING_QUEUE] ❌ Cannot verify tweet ${tweetId} - scrape failed`);
      return false;
    }
    
    const actualContent = result.content.substring(0, 100).toLowerCase();
    const expectedPreview = expectedContent.substring(0, 100).toLowerCase();
    
    // Check if content matches (allowing for minor formatting differences)
    const similarity = calculateSimilarity(actualContent, expectedPreview);
    
    if (similarity < 0.8) {
      console.error(`[POSTING_QUEUE] 🚨 MISMATCH DETECTED!`);
      console.error(`[POSTING_QUEUE] Expected: "${expectedPreview}..."`);
      console.error(`[POSTING_QUEUE] Actual: "${actualContent}..."`);
      console.error(`[POSTING_QUEUE] Similarity: ${(similarity * 100).toFixed(1)}%`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Content verified: ${(similarity * 100).toFixed(1)}% match`);
    return true;
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ⚠️ Verification failed: ${error.message}`);
    return false; // Fail-safe: if we can't verify, don't trust it
  }
}

// Use after posting
const isValid = await verifyPostedContent(tweetId, decision.content);
if (!isValid) {
  throw new Error(`Tweet ID ${tweetId} does not match expected content - possible misattribution!`);
}
```

### **2. Add Content Verification During Metrics Scraping**

**File:** `src/jobs/metricsScraperJob.ts`

**Add before storing metrics:**
```typescript
// Before storing metrics, verify content matches
const { data: metadata } = await supabase
  .from('content_metadata')
  .select('content, thread_parts, decision_type')
  .eq('decision_id', post.decision_id)
  .single();

if (metadata) {
  const expectedContent = metadata.decision_type === 'thread' 
    ? (metadata.thread_parts || []).join(' ')
    : (metadata.content || '');
  
  if (result.content) {
    const similarity = calculateSimilarity(
      result.content.substring(0, 200).toLowerCase(),
      expectedContent.substring(0, 200).toLowerCase()
    );
    
    if (similarity < 0.8) {
      console.error(`[METRICS_JOB] 🚨 MISATTRIBUTION DETECTED!`);
      console.error(`[METRICS_JOB] Tweet ID: ${post.tweet_id}`);
      console.error(`[METRICS_JOB] Expected: "${expectedContent.substring(0, 100)}..."`);
      console.error(`[METRICS_JOB] Actual: "${result.content.substring(0, 100)}..."`);
      console.error(`[METRICS_JOB] ⚠️ SKIPPING metrics update - content mismatch!`);
      continue; // Skip this tweet - don't store wrong metrics
    }
  }
}
```

### **3. Audit All High-View Posts**

**Create script:** `scripts/audit-tweet-attribution.ts`

```typescript
// Check all posts with >1000 views
// Verify content matches database
// Flag mismatches for manual review
// Fix incorrect tweet_ids
```

---

## 📋 VERIFICATION CHECKLIST

- [ ] Check if tweet_id extraction logic is correct
- [ ] Check if metrics scraper uses correct tweet_id
- [ ] Check for race conditions in postingQueue
- [ ] Audit all high-view posts (>1000 views)
- [ ] Verify all posts with >100 views manually
- [ ] Add content verification after posting
- [ ] Add content verification during scraping
- [ ] Fix all misattributed posts in database
- [ ] Re-run learning system with corrected data

---

## 🎯 IMMEDIATE ACTION ITEMS

1. **Manually verify** all posts with >1000 views
   - Check Twitter link vs database content
   - Flag mismatches

2. **Add content verification** to posting pipeline
   - Verify tweet_id matches content immediately after posting
   - Throw error if mismatch detected

3. **Add content verification** to metrics scraping
   - Verify content matches before storing metrics
   - Skip metrics update if mismatch detected

4. **Fix misattributed posts** in database
   - Find correct tweet_id for each misattributed post
   - Update database with correct IDs
   - Re-scrape metrics with correct IDs

---

**Status:** CRITICAL - System cannot be trusted until fixed  
**Priority:** P0 - Fix immediately  
**Estimated Impact:** All learning data is corrupted if this is widespread

