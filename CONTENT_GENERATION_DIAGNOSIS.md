# 🎯 **CONTENT GENERATION DIAGNOSIS**

## **THE PROBLEM:**

Your content **IS AI-generated** BUT it's **repetitive in topics/angles**:
- ✅ Different wording (passes duplicate check)
- ❌ Same topics (inflammation, 66 days, habits)
- ❌ Same angles (challenging common wisdom)

---

## **ROOT CAUSES:**

### **1. Duplicate Detection Only Checks Words, Not Topics**
```typescript
// src/jobs/planJobUnified.ts line 131-143
const isDuplicate = recentTexts.some(recentText => {
  const recentWords = new Set(recentText.split(/\s+/));
  const newWords = contentToCheck.split(/\s+/);
  const matchingWords = newWords.filter(w => recentWords.has(w)).length;
  const similarity = matchingWords / newWords.length;
  
  if (similarity > 0.7) return true; // ❌ ONLY CHECKS WORDS
  return false;
});
```

**Example of what passes:**
- Tweet A: "Inflammation signals immune system to address issues"
- Tweet B: "What if inflammation isn't the enemy but a necessary tool?"
- **Result:** 0% word match → PASSES ✅ (but same topic!)

### **2. No Topic Tracking**
```typescript
// src/jobs/planJobUnified.ts line 100-107
const recentContent = await supabase
  .from('content_metadata')
  .select('content, decision_id, generator_name'); // ❌ NO TOPIC FIELD

const recentGenerators = [...]; // Tracks generators
// ❌ MISSING: const recentTopics = [...]; 
```

**System tracks:**
- ✅ Generator names (DataNerd, ThoughtLeader, etc.)
- ✅ Content text

**System does NOT track:**
- ❌ Topics (inflammation, habits, sleep, etc.)
- ❌ Angles (contrarian, supportive, neutral)
- ❌ Perspectives (challenge belief, support belief, nuance)

### **3. No Explicit Topic Selection**
```typescript
// src/unified/UnifiedContentEngine.ts
const generated = await engine.generateContent({
  format: 'single', // Specifies format
  recentGenerators: [...] // Avoids recent generators
  // ❌ MISSING: topic: 'unique_topic_not_recently_used'
  // ❌ MISSING: angle: 'unique_angle_not_recently_used'
  // ❌ MISSING: avoidTopics: ['inflammation', '66 days', ...]
});
```

**Currently:** Generators pick topics randomly from their knowledge
**Problem:** No guidance to avoid recent topics

### **4. Generators Don't Know What Was Posted Recently**
```typescript
// Each generator (dataNerdGenerator.ts, thoughtLeaderGenerator.ts, etc.)
export async function generateDataNerdContent(
  params: ContentParams,
  intelligence?: IntelligencePackage
): Promise<GeneratedContent> {
  // ❌ NO INPUT ABOUT RECENT TOPICS
  // ❌ NO INPUT ABOUT RECENT ANGLES
  
  // Generator randomly picks from its expertise:
  // - Inflammation, sleep, habits, fasting, etc.
  // - HIGH CHANCE of repeating if topic pool is small
}
```

---

## **WHY REPETITION HAPPENS:**

### **Example: Inflammation Topic**
1. DataNerd generates about inflammation
2. System posts it
3. Next cycle: ThoughtLeader also generates about inflammation
4. **Duplicate check:** Different words → PASSES ✅
5. **Result:** 2 inflammation posts in a row

### **Example: 66 Days Habit**
1. ThoughtLeader posts "66 days to form habit (not 21)"
2. System posts it
3. Later: Coach generates protocol about 66-day habits
4. **Duplicate check:** Different format → PASSES ✅
5. **Result:** Repetitive topic

---

## **WHAT'S NEEDED:**

### **1. Topic Tracking & Avoidance**
```typescript
// Track last 20 topics
const recentTopics = [
  'inflammation',
  'habit formation',
  'sleep quality',
  'fasting',
  ...
];

// Pass to engine
await engine.generateContent({
  avoidTopics: recentTopics.slice(0, 10) // Avoid last 10 topics
});
```

### **2. Angle/Perspective Tracking**
```typescript
// Track last 20 angles
const recentAngles = [
  'contrarian_challenge',
  'data_driven_insight',
  'practical_protocol',
  ...
];

// Enforce diversity
await engine.generateContent({
  avoidAngles: recentAngles.slice(0, 5) // Avoid last 5 angles
});
```

### **3. Semantic Topic Diversity**
```typescript
// Use AI to extract topics
const topicExtraction = await openai.chat.completions.create({
  messages: [{
    role: 'system',
    content: 'Extract 3 main topics from this health tweet. Return JSON: ["topic1", "topic2", "topic3"]'
  }, {
    role: 'user',
    content: tweetContent
  }]
});

// Store topics in database
await supabase
  .from('content_metadata')
  .update({
    topics: extractedTopics, // NEW COLUMN
    angle: identifiedAngle,   // NEW COLUMN
    perspective: identifiedPerspective // NEW COLUMN
  });
```

### **4. Forced Topic Diversity in Generators**
```typescript
// Pass explicit guidance to each generator
await generateDataNerdContent({
  topic: selectedUnusedTopic,
  angle: selectedUnusedAngle,
  recentTopics: [...], // Topics to avoid
  recentAngles: [...]  // Angles to avoid
}, intelligence);
```

---

## **SOLUTION ARCHITECTURE:**

### **Phase 1: Add Topic/Angle Extraction**
- After content generated, extract topics/angles via AI
- Store in `content_metadata` (new columns)
- Build topic/angle history

### **Phase 2: Enforce Diversity**
- Load last 20 topics/angles
- Pass to generators as "avoid list"
- Generators must pick different topics

### **Phase 3: Semantic Similarity**
- Use embeddings to measure topic similarity
- Reject content if >60% semantically similar to recent posts

---

## **EXPECTED IMPROVEMENT:**

### **Before:**
- Post 1: Inflammation (DataNerd)
- Post 2: Inflammation (ThoughtLeader) ❌ REPETITIVE
- Post 3: 66 days habit (Coach)
- Post 4: 66 days habit (Contrarian) ❌ REPETITIVE

### **After:**
- Post 1: Inflammation (DataNerd)
- Post 2: Sleep architecture (ThoughtLeader) ✅ UNIQUE
- Post 3: Gut microbiome (Coach) ✅ UNIQUE
- Post 4: Cold exposure (Contrarian) ✅ UNIQUE

---

**Next:** Implement topic/angle tracking + diversity enforcement

