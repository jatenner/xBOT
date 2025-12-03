# ⚡ QUICK IMPLEMENTATION GUIDE
**Quick reference for exact code changes**

---

## 🎯 CRITICAL FILES (Must Update)

### **1. `src/ai/prompts.ts` - Core Prompt System**

**Add after line 100:**
```typescript
6. PERSONAL STORY OR CASE STUDY (Required - 20 points deducted if missing):
   ✅ "I tested this for 30 days. Results: [specific outcome]"
   ✅ "A client tried this protocol. After 2 weeks: [specific result]"
   ✅ "I tracked my sleep for 90 days. Nights I did X, I saw Y improvement."
   ✅ "Stanford study (n=87): 30% improvement. I tested it myself: [results]"
   ❌ WRONG: "Studies show..." without personal connection
   
   MANDATORY: 50% of posts MUST include personal story or case study
```

**Replace lines 253-281 (Hook Strategy):**
```typescript
🎣 HOOK STRATEGY (CRITICAL - Auto-reject if violated):

❌ BANNED HOOK PATTERNS (INSTANT REJECTION):
- "What if..." (overused, feels clickbait)
- "Ever wonder..." (generic, doesn't create curiosity)
- "Have you ever considered..." (weak, overused)

✅ REQUIRED HOOK PATTERNS (use these instead):
- Surprising data: "Stanford study: 87% of people eat the wrong pre-workout snack. Result? 30% less muscle growth."
- Counterintuitive finding: "Dark chocolate outperforms warm milk for sleep. Here's why..."
- Specific statistic: "1 year of lockdown left 10% with severe anxiety. 3,500 tracked by UC (2021)."
- Personal test result: "I tested dark chocolate for sleep for 30 days. Results: 15 min faster sleep, 20% more deep sleep."

HOOK REQUIREMENTS:
- Must include specific number or data point
- Must create genuine curiosity gap
- Must promise clear value (what will reader learn?)
- Must be surprising or counterintuitive
```

**Add after line 163:**
```typescript
✅ PROTOCOL REQUIREMENT (Required - 15 points deducted if missing):
   Every post MUST end with specific, actionable protocol:
   
   ✅ "Protocol: 30g dark chocolate (85% cocoa), 2 hours before bed, track for 1 week. Expected: 15-20 min faster sleep."
   ✅ "Try this: Track protein timing for 1 week. Eat 30g within 30 min of workout. Compare recovery vs. current routine."
   
   ❌ WRONG: "Maybe it's time to experiment" (too vague)
   ❌ WRONG: "Listen to your body" (not actionable)
   
   REQUIRED ELEMENTS:
   - Exact dosages/amounts (30g, 2 hours, 1 week)
   - Specific timing (when to do it)
   - Clear expectations (what result to expect)
   - Measurement method (how to track)
```

**Add after line 142:**
```typescript
❌ FORMATTING BANS (INSTANT AUTO-REJECTION):
- ALL CAPS for emphasis (SEROTONIN, MELATONIN) use normal case
- "--- THREAD BREAK ---" markers (remove completely)
- Excessive punctuation (!!!, ???)
- Shouty language (WAKE UP!, THINK AGAIN!)

✅ FORMATTING REQUIREMENTS:
- Use normal case for emphasis (let word choice create impact)
- Threads flow naturally without markers
- Professional tone (not aggressive)
```

**Replace lines 246-251:**
```typescript
✅ STUDY CITATION REQUIREMENTS (Required - 10 points deducted if missing):
   When citing studies, MUST include specific details:
   
   ✅ "Stanford 2022 study (n=87, 6-week protocol): 30% improvement"
   ✅ "Meta-analysis of 12 studies (n=1,200): 40% reduction"
   
   ❌ WRONG: "Studies show..." (too vague)
   ❌ WRONG: "Research indicates..." (not credible)
   
   REQUIRED ELEMENTS:
   - Institution name (Stanford, UC Berkeley, etc.)
   - Year (2022, 2021, etc.)
   - Sample size if available (n=87, n=1,200)
   - Specific finding (30% improvement, etc.)
   
   If study details unavailable, use personal test instead:
   ✅ "I tested this for 30 days. Results: [specific outcome]"
```

---

### **2. `src/growth/threadMaster.ts` - Thread Generation**

**Replace lines 65-153 (systemPrompt):**
```typescript
const systemPrompt = `You are a master Twitter thread writer optimized for FOLLOWER GROWTH.

=== HOOK REQUIREMENTS (CRITICAL) ===
❌ BANNED: "What if...", "Ever wonder...", "Have you ever..."
✅ REQUIRED: Surprising data or counterintuitive finding

GOOD HOOKS:
- "Stanford study: 87% of people eat the wrong pre-workout snack. Result? 30% less muscle growth."
- "Dark chocolate outperforms warm milk for sleep. I tested both for 30 days. Here's what happened..."

BAD HOOKS:
- "What if your pre-workout snack is wrong?"
- "Ever wonder why dark chocolate helps sleep?"

=== THREAD STRUCTURE ===
Tweet 1 (hook): Surprising data or counterintuitive finding
Tweet 2: Mechanism explanation (HOW/WHY it works)
Tweet 3: Personal story or case study (I tested this... or A client tried...)
Tweet 4: Specific protocol (exact steps, dosages, timing)
Tweet 5: Expected results and measurement method
Tweet 6: Actionable takeaway with specific protocol (NOT a question)

=== FORMATTING REQUIREMENTS ===
- NO "--- THREAD BREAK ---" markers (flow naturally)
- NO ALL CAPS (use normal case: serotonin, not SEROTONIN)
- NO numbered lists (1., 2., 3.)
- NO "🧵" or "thread below"
- Each tweet: 100-200 characters (200 chars HARD LIMIT)
- Natural flow between tweets (each builds on previous)

=== PROTOCOL REQUIREMENT ===
Every thread MUST end with specific, actionable protocol:
- Exact dosages/amounts (30g, 2 hours, 1 week)
- Specific timing (when to do it)
- Clear expectations (what result to expect)
- Measurement method (how to track)

Example closer:
"Protocol: 30g dark chocolate (85% cocoa), 2 hours before bed, track sleep for 1 week. Expected: 15-20 min faster sleep onset, 20% more deep sleep. Try it and let me know what happens."`;
```

**Replace lines 177-189 (userPrompt OUTPUT section):**
```typescript
OUTPUT AS JSON:
{
  "hook": "Tweet 1: Surprising data or counterintuitive finding (NOT 'What if...')",
  "body": [
    "Tweet 2: Mechanism explanation with specific data",
    "Tweet 3: Personal story or case study (I tested this... or A client tried...)",
    "Tweet 4: Specific protocol with exact steps",
    "Tweet 5: Expected results and measurement method"
  ],
  "closer": "Tweet 6: Actionable takeaway with specific protocol (NOT a question)"
}

THREAD REQUIREMENTS:
- Tweet 1: Must start with surprising data, NOT "What if..." question
- Tweet 3: MUST include personal story or case study
- Tweet 4-5: MUST include specific protocol (dosages, timing, expectations)
- Tweet 6: MUST end with actionable protocol, NOT "Maybe experiment" or question
- NO "--- THREAD BREAK ---" markers (flow naturally)
- NO ALL CAPS (use normal case)
- Each tweet: 100-200 characters (200 chars HARD LIMIT)
```

---

### **3. `src/quality/contentQualityController.ts` - Quality Gates**

**Add after line 95:**
```typescript
// 6. PERSONAL STORY CHECK (10% weight)
score.personalStory = this.scorePersonalStory(content);
if (score.personalStory < 50) {
  score.issues.push('Missing personal story or case study - add "I tested this..." or "A client tried..."');
}

// 7. PROTOCOL SPECIFICITY CHECK (15% weight)
score.protocolSpecificity = this.scoreProtocolSpecificity(content);
if (score.protocolSpecificity < 60) {
  score.issues.push('Missing specific protocol - add exact dosages, timing, and expectations');
}
```

**Add after line 83:**
```typescript
// 2.5. HOOK QUALITY CHECK (15% weight)
score.hookQuality = this.scoreHookQuality(content);
if (score.hookQuality < 60) {
  score.issues.push('Weak hook - avoid "What if...", "Ever wonder..." - use surprising data instead');
}
```

**Add helper functions at end of class (before closing brace):**
```typescript
/**
 * Score personal story presence
 */
private scorePersonalStory(content: string): number {
  const hasPersonalStory = 
    /I (tested|tried|tracked|did)/i.test(content) ||
    /A client (tried|tested|did)/i.test(content) ||
    /I (saw|noticed|found|discovered)/i.test(content) ||
    /After (\d+) (days|weeks|months)/i.test(content);
  
  return hasPersonalStory ? 100 : 0;
}

/**
 * Score hook quality
 */
private scoreHookQuality(content: string): number {
  const firstSentence = content.split(/[.!?]/)[0];
  
  // Bad hooks
  if (/what if/i.test(firstSentence)) return 20;
  if (/ever wonder/i.test(firstSentence)) return 20;
  if (/have you ever/i.test(firstSentence)) return 20;
  
  // Good hooks
  if (/\d+%/.test(firstSentence)) return 90; // Has percentage
  if (/\d+ (study|studies|people|participants)/i.test(firstSentence)) return 90; // Has study data
  if (/I (tested|tried|tracked)/i.test(firstSentence)) return 85; // Personal test
  
  return 50; // Neutral
}

/**
 * Score protocol specificity
 */
private scoreProtocolSpecificity(content: string): number {
  const hasDosage = /\d+\s*(g|mg|ml|hours?|minutes?|days?|weeks?)/i.test(content);
  const hasTiming = /(before|after|within|during|at)\s+\d+/i.test(content);
  const hasExpectation = /(expected|result|improve|increase|decrease|reduce)/i.test(content);
  const hasMeasurement = /(track|measure|test|compare)/i.test(content);
  
  let score = 0;
  if (hasDosage) score += 25;
  if (hasTiming) score += 25;
  if (hasExpectation) score += 25;
  if (hasMeasurement) score += 25;
  
  return score;
}
```

**Update weighted score calculation (around line 164):**
```typescript
const weightedScore = 
  (score.completeness * 0.25) +
  (score.engagement * 0.15) +
  (score.hookQuality * 0.15) +  // NEW
  (score.clarity * 0.15) +
  (score.actionability * 0.10) +
  (score.personalStory * 0.10) +  // NEW
  (score.protocolSpecificity * 0.10);  // NEW
```

---

### **4. Individual Generators - Add Quality Requirements**

**For each generator file** (`src/generators/*Generator.ts`):

**Find the prompt building section** (usually `systemPrompt` or `buildPrompt` function)

**Add at the end of the prompt:**
```typescript
🚨 MANDATORY CONTENT QUALITY REQUIREMENTS (Dec 2025 Upgrade):

1. PERSONAL STORY (50% of posts):
   - Include "I tested this..." or "A client tried..." story
   - Specific results: "30 days, 15 min faster sleep, 20% more deep sleep"
   - Makes content relatable and memorable

2. STRONG HOOK (not generic questions):
   - ❌ BANNED: "What if...", "Ever wonder...", "Have you ever..."
   - ✅ REQUIRED: Surprising data or counterintuitive finding
   - Example: "Stanford study: 87% eat wrong snack. Result? 30% less growth."

3. SPECIFIC PROTOCOL (end with actionable steps):
   - Exact dosages: "30g dark chocolate (85% cocoa)"
   - Specific timing: "2 hours before bed"
   - Clear expectations: "Expected: 15-20 min faster sleep"
   - Measurement: "Track for 1 week"

4. NO ALL CAPS:
   - Use normal case (serotonin, not SEROTONIN)
   - Let word choice create impact, not formatting

5. SPECIFIC STUDY DETAILS:
   - Include: Institution, year, sample size, finding
   - Example: "Stanford 2022 (n=87): 30% improvement"
   - Or use personal test: "I tested for 30 days: [results]"
```

---

## 🚀 QUICK START

### **Step 1: Update Core Files (30 min)**
1. `src/ai/prompts.ts` - Add 5 new requirement sections
2. `src/growth/threadMaster.ts` - Update system and user prompts
3. `src/quality/contentQualityController.ts` - Add 3 new checks + helper functions

### **Step 2: Update Generators (60 min)**
- Add quality requirements to each generator's prompt
- 11 files × 5 min each = ~60 min

### **Step 3: Test (30 min)**
- Run plan job
- Verify generated content has:
  - Personal stories
  - Strong hooks (no "What if...")
  - Specific protocols
  - No ALL CAPS
  - Specific study details

### **Step 4: Deploy**
```bash
git add src/ai/prompts.ts src/growth/threadMaster.ts src/quality/contentQualityController.ts src/generators/
git commit -m "Content quality upgrade: Personal stories, stronger hooks, specific protocols"
git push origin main
```

---

## ✅ VALIDATION

After deployment, check:
- [ ] Personal stories in 50% of posts
- [ ] No "What if..." hooks
- [ ] All posts end with protocols
- [ ] No ALL CAPS
- [ ] Specific study details

**Expected:** Content score improves from 3-4/10 to 7-8/10

---

**Total Time:** ~2 hours  
**Files Changed:** 14 files  
**Risk:** Low (additive changes)
