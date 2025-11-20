# 🔧 FIX ACTION PLAN - Post Performance Issues
**Date:** November 20, 2025

## 🎯 ISSUES TO FIX

1. ❌ **Threads too long** (250-280 chars → should be 200 max)
2. ❌ **4 posts missing tweet_id** (never posted successfully)
3. ❌ **Generic/AI-sounding content** (need more provocative angles)
4. ❌ **Generator selection** (provocateur works, others don't)
5. ❌ **Zero likes despite views** (content not resonating)

---

## 🔥 FIX #1: Thread Character Limits (CRITICAL)

### **Problem:**
- Thread parts are 250-280 characters
- Should be 200 max for optimal engagement
- Multiple files have inconsistent limits

### **Files to Fix:**

#### **1.1 `src/utils/tweetLinter.ts` (Lines 41-47)**
**Current:**
```typescript
if (finalFormat === 'single' || finalFormat === 'longform_single') {
  maxLength = TWEET_MAX_CHARS_HARD; // 279 for singles
} else {
  // Thread tweets: 240 for T1 (before-the-fold), 270 for T2+
  maxLength = i === 0 ? 240 : 270;
}
```

**Fix:**
```typescript
if (finalFormat === 'single' || finalFormat === 'longform_single') {
  maxLength = TWEET_MAX_CHARS_HARD; // 279 for singles
} else {
  // Thread tweets: 200 chars max for ALL parts (optimal for engagement)
  maxLength = 200;
}
```

#### **1.2 `src/ai/bulletproofPrompts.ts` (Lines 76-78)**
**Current:**
```typescript
THREAD RULES (STRICT VALIDATION - FAILURE = REJECTION):
- FLEXIBLE length: 3-7 tweets (can be short or long based on topic)
- Each tweet PRECISELY 150-270 characters (count spaces!)
```

**Fix:**
```typescript
THREAD RULES (STRICT VALIDATION - FAILURE = REJECTION):
- FLEXIBLE length: 3-7 tweets (can be short or long based on topic)
- Each tweet PRECISELY 100-200 characters (count spaces!)
- HARD LIMIT: 200 chars - exceeding this = REJECTION
```

#### **1.3 `src/growth/threadMaster.ts` (Lines 96, 189)**
**Current:**
```typescript
- Each tweet: 150-230 characters
```

**Fix:**
```typescript
- Each tweet: 100-200 characters (200 chars HARD LIMIT)
```

#### **1.4 `src/utils/threadValidator.ts` - Check config**
Need to verify `maxCharsHard` is set to 200 in config.

**Action:** Search for `maxCharsHard` config and ensure it's 200.

---

## 🔥 FIX #2: Missing tweet_ids (Posts Not Posting)

### **Problem:**
- 4 posts have no `tweet_id` (status='posted' but tweet_id is NULL)
- Means posting failed but wasn't caught

### **Files to Check:**

#### **2.1 `src/jobs/postingQueue.ts` - Error Handling**
**Action:** Review error handling around line 640-650 where `markDecisionPosted` is called.

**Check:**
1. Are errors caught when posting fails?
2. Is `tweet_id` validated before saving?
3. Are failed posts retried?

**Expected Fix:**
```typescript
// Before marking as posted, verify tweet_id exists
if (!tweetId || tweetId === 'unknown' || tweetId === 'posted_success') {
  console.error(`[POSTING_QUEUE] ❌ Invalid tweet_id: ${tweetId}`);
  // Mark as failed, not posted
  await supabase
    .from('content_metadata')
    .update({ 
      status: 'failed',
      error_message: 'Invalid tweet_id after posting attempt'
    })
    .eq('decision_id', decisionId);
  throw new Error('Invalid tweet_id');
}
```

#### **2.2 `src/posting/postThread.ts` - Tweet ID Capture**
**Action:** Verify tweet ID capture is working (line 99-100).

**Check:**
- Is `captureTweetId` function working?
- Are errors logged when ID capture fails?

#### **2.3 Find Failed Posts Script**
**Action:** Create script to find posts with status='posted' but no tweet_id.

```typescript
// scripts/find-failed-posts.ts
const { data: failedPosts } = await supabase
  .from('content_metadata')
  .select('*')
  .eq('status', 'posted')
  .is('tweet_id', null);

console.log(`Found ${failedPosts.length} posts marked as posted but missing tweet_id`);
```

---

## 🔥 FIX #3: Increase Provocateur Usage & Improve Prompts

### **Problem:**
- `provocateur` got 20k views (1 use)
- `coach` got 28 avg views (6 uses)
- Need more provocative/contrarian content

### **Files to Fix:**

#### **3.1 `src/intelligence/generatorMatcher.ts` - Boost Provocateur Weight**
**Action:** Find generator selection logic and increase `provocateur` probability.

**Expected Fix:**
```typescript
// Increase provocateur weight based on performance data
const generatorWeights: Record<string, number> = {
  provocateur: 0.25,  // 25% (up from ~7%)
  contrarian: 0.15,    // 15%
  mythBuster: 0.12,    // 12%
  dataNerd: 0.10,      // 10%
  thoughtLeader: 0.10, // 10%
  coach: 0.05,         // 5% (down from higher)
  interestingContent: 0.05, // 5% (down)
  // ... rest distributed
};
```

#### **3.2 Update All Generator Prompts - Add Provocative Angle Requirements**
**Action:** Add to all generator prompts:

```
🔥 MANDATORY: PROVOCATIVE HOOK (Required for engagement)
- MUST challenge mainstream assumptions
- MUST use contrarian/controversial angles
- MUST ask "Why doesn't..." or "What are they afraid of..." questions
- AVOID generic academic openings like "Emerging research indicates..."

EXAMPLES OF GOOD HOOKS:
✅ "Why doesn't mainstream medicine embrace the gut-brain axis?"
✅ "What are they afraid of revealing about [topic]?"
✅ "The truth they don't want you to know about [topic]..."
✅ "Most people think [X], but the research shows [surprising Y]"

EXAMPLES OF BAD HOOKS (AUTO-REJECT):
❌ "Emerging research indicates that..."
❌ "Throughout history, various cultures have..."
❌ "Studies show that..."
```

#### **3.3 `src/generators/provocateurGenerator.ts` - Enhance Prompt**
**Action:** Ensure this generator's prompt emphasizes:
- Controversial angles
- Challenging authority
- Asking provocative questions
- Specific data with surprising implications

---

## 🔥 FIX #4: Improve Content Quality (Reduce Generic Tone)

### **Problem:**
- Content sounds AI-generated/robotic
- Generic health advice without personality
- Missing hooks and curiosity gaps

### **Files to Fix:**

#### **4.1 `src/ai/prompts.ts` - Strengthen Hook Requirements**
**Current (Lines 208-223):**
```typescript
🔥 HOOK CONSTRUCTION PRINCIPLES (create YOUR OWN unique hooks, don't copy patterns):
- Lead with the most surprising data point or counterintuitive finding
...
```

**Fix:** Add MANDATORY provocative hook requirement:
```typescript
🔥 MANDATORY: PROVOCATIVE HOOK (Required - Content auto-rejected without it)
- MUST start with a provocative question, controversial claim, or surprising fact
- MUST challenge mainstream assumptions or authority
- MUST create immediate curiosity gap
- FORBIDDEN: Generic academic openings ("Emerging research...", "Studies show...")
- FORBIDDEN: Generic statements ("Throughout history...", "Many people...")

HOOK EXAMPLES THAT WORK:
✅ "Why doesn't mainstream medicine embrace the gut-brain axis when research shows 90% of serotonin is made in the gut?"
✅ "The supplement industry doesn't want you to know this: [surprising fact]"
✅ "Most people think [X], but [Institution] research shows [surprising Y]"

HOOK EXAMPLES THAT FAIL (AUTO-REJECT):
❌ "Emerging research indicates that circadian genes influence metabolic health..."
❌ "Throughout history, various cultures have embraced fasting..."
❌ "Studies show that probiotics can reduce anxiety symptoms..."
```

#### **4.2 `src/generators/sharedPatterns.ts` - Add Provocative Formula**
**Action:** Add at top of VOICE_GUIDELINES:
```typescript
🔥 MANDATORY HOOK REQUIREMENT:
Every post MUST start with ONE of these patterns:
1. Provocative question: "Why doesn't [authority] [action] when [fact]?"
2. Controversial claim: "[Authority] doesn't want you to know that [fact]"
3. Contrarian angle: "Most people think [X], but research shows [Y]"
4. Surprising data: "[Number]% of [group] don't realize [fact]"

FORBIDDEN OPENERS (Auto-reject):
- "Emerging research indicates..."
- "Studies show..."
- "Throughout history..."
- "Many people..."
```

---

## 🔥 FIX #5: Validate Character Limits Before Posting

### **Problem:**
- Threads are being posted with 250+ chars
- Need validation to reject before posting

### **Files to Fix:**

#### **5.1 `src/jobs/postingQueue.ts` - Add Validation Before Posting**
**Action:** Add validation check before posting:

```typescript
// Before posting, validate character limits
function validateContentBeforePosting(content: string | string[], type: 'single' | 'thread'): boolean {
  if (type === 'single') {
    if (content.length > 200) {
      console.error(`[VALIDATION] ❌ Single tweet too long: ${content.length} chars (max 200)`);
      return false;
    }
  } else {
    const parts = Array.isArray(content) ? content : [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length > 200) {
        console.error(`[VALIDATION] ❌ Thread part ${i + 1} too long: ${parts[i].length} chars (max 200)`);
        return false;
      }
    }
  }
  return true;
}

// Use before posting:
if (!validateContentBeforePosting(content, decisionType)) {
  await markDecisionFailed(decisionId, 'Content exceeds character limits');
  continue;
}
```

#### **5.2 `src/validators/substanceValidator.ts` - Add Character Check**
**Action:** Add character limit validation to substance validator.

---

## 📋 IMPLEMENTATION PRIORITY

### **Priority 1 (IMMEDIATE - Fix Today):**
1. ✅ Fix thread character limits (200 max) - 4 files
2. ✅ Add validation before posting - 1 file
3. ✅ Find and fix missing tweet_id posts - 1 script + 1 file

### **Priority 2 (This Week):**
4. ✅ Increase provocateur usage - 1 file
5. ✅ Improve hooks in all prompts - 3 files
6. ✅ Add provocative angle requirements - All generator files

### **Priority 3 (Ongoing):**
7. ✅ Monitor generator performance
8. ✅ A/B test different hook styles
9. ✅ Optimize based on engagement data

---

## 🧪 TESTING CHECKLIST

After fixes, verify:
- [ ] Thread parts are ≤ 200 characters
- [ ] All posts have tweet_id after posting
- [ ] Provocateur usage increased to ~25%
- [ ] Hooks are provocative (not generic)
- [ ] Content validation catches over-limit posts

---

## 📊 SUCCESS METRICS

Track after fixes:
1. Average views per post (target: >500)
2. Average likes per post (target: >10)
3. Posts with zero likes (target: <20%)
4. Character limit violations (target: 0)
5. Missing tweet_ids (target: 0)

---

## 🔍 FILES TO MODIFY

### **Immediate Fixes:**
1. `src/utils/tweetLinter.ts` - Line 41-47
2. `src/ai/bulletproofPrompts.ts` - Line 76-78
3. `src/growth/threadMaster.ts` - Lines 96, 189
4. `src/utils/threadValidator.ts` - Check config
5. `src/jobs/postingQueue.ts` - Add validation + error handling

### **Content Improvements:**
6. `src/intelligence/generatorMatcher.ts` - Boost provocateur
7. `src/ai/prompts.ts` - Strengthen hook requirements
8. `src/generators/sharedPatterns.ts` - Add provocative formula
9. All generator files - Add provocative angle requirements

### **Diagnostic Scripts:**
10. `scripts/find-failed-posts.ts` - Find posts without tweet_id
11. `scripts/validate-content-limits.ts` - Check existing posts

---

**Ready to implement?** Let me know which fix to start with!

