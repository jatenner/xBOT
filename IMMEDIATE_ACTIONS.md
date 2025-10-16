# IMMEDIATE ACTIONS TO IMPROVE CONTENT

## ✅ COMPLETED (Just Now):
1. Fixed character limits (250 chars/tweet max)
2. Fixed thread posting (reply chains, not walls of text)
3. Added strict validation
4. Cleared broken queue (12 posts)

---

## 🔄 TO IMPLEMENT NOW (Content Quality):

### **Priority 1: Ban Generic Language System-Wide**

#### Files to Update:
All 10 generators need this added to their prompts:

```typescript
CRITICAL CONTENT RULES:
- NO generic phrases: "optimize your health", "boost energy", "cultivate relationships"
- NO template openers: "Most people think X", "Did you know", "It's important to"
- NO numbered lists: 1. 2. 3. format
- NO markdown: **bold** formatting
- USE specific language: "sleep 8 hours", "text friends weekly", "eat 400g protein"
- USE concrete data: "47% reduction", "MIT 2023 study", "tracked 5,000 people"
- WRITE like a human expert, not a corporate blog
```

#### Generators to Update:
1. `/src/generators/coachGenerator.ts`
2. `/src/generators/provocateurGenerator.ts`
3. `/src/generators/thoughtLeaderGenerator.ts`
4. `/src/generators/explorerGenerator.ts`
5. `/src/generators/dataNerdGenerator.ts`
6. `/src/generators/mythBusterGenerator.ts`
7. `/src/generators/newsReporterGenerator.ts` ✅ (already has "Return json")
8. `/src/generators/storytellerGenerator.ts`
9. `/src/generators/contrarianGenerator.ts`
10. `/src/generators/philosopherGenerator.ts` ✅ (already has "Return json")

---

### **Priority 2: Add Post-Processing**

Integrate the new `contentFormatter.ts` into the orchestrator:

```typescript
// In contentOrchestrator.ts, after generation:

import { formatForTwitter, validateContentQuality, isTooGeneric } from '../content/contentFormatter';

// After getting content from generator:
const formattedContent = formatForTwitter(content);

// Quality check:
const quality = validateContentQuality(
  Array.isArray(formattedContent) ? formattedContent.join(' ') : formattedContent
);

if (!quality.passed) {
  console.warn(`[ORCHESTRATOR] ⚠️ Content quality issues: ${quality.issues.join(', ')}`);
  // Optional: regenerate if score too low
}

// Check if too generic:
if (isTooGeneric(formattedContent)) {
  console.error(`[ORCHESTRATOR] ❌ Content too generic, regenerating...`);
  // Trigger regeneration with different generator/approach
}
```

---

### **Priority 3: Improve Hook Variety**

Update `/src/ai/hookEvolutionEngineSimple.ts` to include more pattern types:

```typescript
const HOOK_PATTERNS = [
  'bold_claim',      // "Your sleep routine is backwards."
  'weird_fact',      // "Octopuses have 9 brains."
  'story_opener',    // "A surgeon forgot 11 years overnight."
  'question',        // "Why do we sleep?"
  'data_shock',      // "73% of X is actually Y."
  'contrarian',      // "Everything you know about X is wrong."
  'direct_address',  // "You're not lazy."
  'mystery'          // "The one thing nobody talks about."
];
```

---

### **Priority 4: Add Formatting Engine**

Create line breaks and rhythm for readability:

```typescript
function addFormatting(content: string): string {
  // Strategy 1: Break after periods for drama (if long)
  if (content.length > 150) {
    content = content.replace(/\. ([A-Z])/g, '.\n\n$1');
  }
  
  // Strategy 2: Emphasize key numbers
  content = content.replace(/(\d+%)/g, '\n\n$1\n\n');
  
  // Strategy 3: Add breathing room before "The key:"
  content = content.replace(/The key:/g, '\n\nThe key:');
  
  return content.replace(/\n{3,}/g, '\n\n').trim();
}
```

---

## 📊 BEFORE/AFTER EXAMPLES:

### Example 1: Sleep Content

**BEFORE (Generic, Boring):**
```
Most people don't realize that sleep is important for health. Research shows that 7-9 hours is optimal for cognitive function and recovery. It's important to maintain good sleep hygiene.
```

**AFTER (Specific, Engaging):**
```
Sleep debt compounds faster than credit card interest.

Miss 2 hours/night = 30% worse problem-solving (Stanford, 2023).

The fix isn't "sleep hygiene." It's matching your schedule to your chronotype.

Night owls forced into 6am starts see 40% worse outcomes.
```

---

### Example 2: Thread Structure

**BEFORE (Formulaic):**
```
Tweet 1: Did you know that exercise timing matters?
Tweet 2: Research shows morning vs evening workouts have different effects.
Tweet 3: This is important for optimizing your fitness routine.
Tweet 4: Try adjusting your workout schedule for best results!
```

**AFTER (Engaging):**
```
Tweet 1: Morning workouts burn 20% more fat. Evening workouts build 15% more muscle.

Tweet 2: MIT tracked 4,000 athletes for 3 years. Time of day affects hormones more than the workout itself.

Tweet 3: Morning = cortisol spike = fat oxidation. Evening = testosterone peak = muscle synthesis.

Tweet 4: The best time? When your body's biochemistry matches your goal.
```

---

## 🎯 SUCCESS METRICS:

**Track These After Implementation:**
1. Engagement rate (target: >3%)
2. Profile clicks from posts (target: >50/post)
3. Follower growth per post (target: >5)
4. Reply quality (questions vs generic reactions)
5. Quote tweets / shares

**Red Flags to Watch:**
- Engagement rate <1%
- No replies
- People saying "this sounds like AI"
- Unfollows after posting

---

## 🚀 ROLLOUT PLAN:

### Week 1:
- ✅ Fix technical issues (DONE)
- 🔄 Update all generator prompts (IN PROGRESS)
- 🔄 Add contentFormatter integration

### Week 2:
- Track engagement on new content
- A/B test: formatted vs unformatted
- Identify which hooks perform best

### Week 3:
- Evolve system based on data
- Double down on high-performing patterns
- Eliminate low-performing patterns

---

## 💡 KEY INSIGHT:

**Good content isn't about following a formula. It's about:**
1. **Specificity** - Real numbers, real studies, real mechanisms
2. **Voice** - Sounds like a smart human, not corporate AI
3. **Value** - Reader learns something non-obvious
4. **Format** - Easy to scan, natural rhythm
5. **Hook** - Makes you want to read more

---

**NEXT:** Want me to implement Priority 1 (ban generic language in all generators)?

