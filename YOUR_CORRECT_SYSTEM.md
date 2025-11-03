# ✅ YOUR CORRECT CONTENT SYSTEM - COMPLETE FLOW

## 📍 Location: `src/jobs/planJob.ts`

**This is the system you described!**

---

## 🎯 THE CORRECT SEQUENTIAL FLOW

### EVERY 30 MINUTES - Complete Journey:

---

## STEP 0: Diversity Status Check

```typescript
// File: src/jobs/planJob.ts:277

const diversityEnforcer = getDiversityEnforcer();
await diversityEnforcer.getDiversitySummary();

// Logs:
"📊 DIVERSITY STATUS (Last 10 posts):
 Topics: gut health, NAD+, sleep, recovery, circadian...
 Angles: industry critique, mechanism, protocol, comparison...
 Tones: skeptical, confident, provocative, analytical...
 Generators: dataNerd, coach, mythBuster, provocateur..."
```

**Purpose:** Show what was recently used (for diversity tracking)

---

## STEP 1: AI Generates TOPIC (Avoids Last 10)

```typescript
// File: src/jobs/planJob.ts:279-287

const topicGenerator = getDynamicTopicGenerator();
const dynamicTopic = await topicGenerator.generateTopic();

// topicGenerator calls OpenAI:
// Prompt: "Generate unique health topic. 
//          AVOID these 10: [gut health, NAD+, sleep, recovery...]
//          Return: topic, angle, dimension, viral_potential"

// AI Output:
{
  topic: "Polyphenol bioavailability in cold-pressed vs heat-processed oils",
  angle: "Industry processing methods reduce efficacy by 70%",
  dimension: "research",
  viral_potential: 8.2
}

const topic = dynamicTopic.topic;

console.log('🎯 TOPIC: "Polyphenol bioavailability..."');
console.log('   Viral potential: 8.2/10');
```

**Key Features:**
- ✅ AI-generated (not from hardcoded list!)
- ✅ Avoids last 10 topics
- ✅ Includes viral scoring
- ✅ Infinite variety

---

## STEP 2: AI Generates ANGLE (For That Specific Topic!)

```typescript
// File: src/jobs/planJob.ts:289-293

const angleGenerator = getAngleGenerator();
const angle = await angleGenerator.generateAngle(topic);
// ↑ Receives the topic from Step 1!

// angleGenerator calls OpenAI:
// Prompt: "Generate unique angle for: 
//          'Polyphenol bioavailability in cold-pressed vs heat-processed oils'
//          AVOID these 10 recent angles: [industry critique, mechanism...]
//          Make it specific, surprising, engaging"

// AI Output:
"Why your expensive cold-pressed olive oil might be wasting money"

console.log('📐 ANGLE: "Why your expensive cold-pressed olive oil..."');
```

**Key Features:**
- ✅ AI-generated based on the specific topic
- ✅ Avoids last 10 angles
- ✅ Contextual (related to the topic!)
- ✅ Unique perspective

---

## STEP 3: AI Generates TONE (Independent Voice Style)

```typescript
// File: src/jobs/planJob.ts:295-299

const toneGenerator = getToneGenerator();
const tone = await toneGenerator.generateTone();

// toneGenerator calls OpenAI:
// Prompt: "Generate unique voice/tone/style
//          AVOID these 10: [skeptical, confident, provocative...]
//          Examples: casual friend, analytical researcher, 
//                   provocative challenger, practical coach"

// AI Output:
"Skeptical consumer advocate exposing marketing myths"

console.log('🎤 TONE: "Skeptical consumer advocate..."');
```

**Key Features:**
- ✅ AI-generated independently
- ✅ Avoids last 10 tones
- ✅ Defines the voice/style
- ✅ Varied personalities

---

## STEP 4: AI Generates FORMAT STRATEGY

```typescript
// File: src/jobs/planJob.ts:310-313

const formatStrategyGen = getFormatStrategyGenerator();
const formatStrategy = await formatStrategyGen.generateStrategy(
  topic,    // ← Receives topic
  angle,    // ← Receives angle
  tone,     // ← Receives tone
  matchedGenerator  // ← Receives generator (from next step)
);

// formatStrategyGen calls OpenAI:
// Prompt: "How should this content be visually formatted?
//          Topic: Polyphenol bioavailability...
//          Angle: Why expensive oils waste money
//          Tone: Skeptical consumer advocate
//          Create visual format strategy"

// AI Output:
"Lead with price comparison numbers, dense with specific brands, 
 bullet points for bioavailability data, end with actionable advice"

console.log('🎨 FORMAT: "Lead with price comparison..."');
```

**Key Features:**
- ✅ AI-generated based on topic+angle+tone
- ✅ Strategic (not random)
- ✅ Guides visual structure

---

## STEP 5: Match GENERATOR (Based on Angle + Tone)

```typescript
// File: src/jobs/planJob.ts:301-305

const generatorMatcher = getGeneratorMatcher();
const matchedGenerator = generatorMatcher.matchGenerator(angle, tone);

// Matching logic:
// Input:
//   angle: "Why expensive oils waste money"
//   tone: "Skeptical consumer advocate"

// Analysis:
//   - Contains "skeptical" → contrarian tendency
//   - Contains "why" → questioning approach
//   - Contains "waste money" → challenges mainstream

// Match: contrarian (best fit for this angle+tone combo)

console.log('🎭 GENERATOR MATCHED: contrarian');
```

**The 12 Generators:**
1. **dataNerd** - Research-heavy, numbers, studies
2. **provocateur** - Bold claims, challenges status quo
3. **mythBuster** - Debunks common beliefs
4. **contrarian** - Opposite of mainstream view
5. **storyteller** - Narrative, anecdotes
6. **coach** - Practical, actionable advice
7. **philosopher** - Deep thinking, implications
8. **culturalBridge** - Cultural/historical context
9. **newsReporter** - Current events, breaking news
10. **explorer** - Connections, discoveries
11. **thoughtLeader** - Big picture, trends
12. **humanVoice** - Conversational, relatable

**Matching Examples:**
```
"mechanism" angle + "analytical" tone → dataNerd
"protocol" angle + "direct" tone → coach
"controversy" angle + "provocative" tone → provocateur
"story" angle + "warm" tone → storyteller
"industry critique" angle + "skeptical" tone → contrarian
```

---

## STEP 6: Call Dedicated Generator

```typescript
// File: src/jobs/planJob.ts:340-352

const generatedContent = await callDedicatedGenerator(matchedGenerator, {
  topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  formatStrategy: "Lead with price comparison...",
  growthIntelligence: {...}  // Performance data
});

// This calls: src/jobs/planJob.ts:181-252
// Which loads the specific generator file
```

### Inside callDedicatedGenerator():

```typescript
// File: src/jobs/planJob.ts:181-231

// Map generator name to file:
const generatorMap = {
  'contrarian': {
    module: '../generators/contrarianGenerator',
    fn: 'generateContrarianContent'
  },
  'dataNerd': {
    module: '../generators/dataNerdGenerator',
    fn: 'generateDataNerdContent'
  },
  'mythBuster': {
    module: '../generators/mythBusterGenerator',
    fn: 'generateMythBusterContent'
  },
  // ...etc for all 12
};

// Load the specific generator:
const config = generatorMap[matchedGenerator];  // 'contrarian'
const module = await import('../generators/contrarianGenerator');
const generateFn = module.generateContrarianContent;

// Call it with full context:
const result = await generateFn({
  topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  formatStrategy: "Lead with price comparison...",
  format: 'single',
  intelligence: growthIntelligence
});
```

---

## STEP 7: Inside contrarianGenerator.ts

```typescript
// File: src/generators/contrarianGenerator.ts

export async function generateContrarianContent(params) {
  const { topic, angle, tone, formatStrategy } = params;
  
  // Specialized CONTRARIAN prompt:
  const systemPrompt = `
  You are a CONTRARIAN health expert who challenges mainstream beliefs.
  
  PERSONALITY:
  - Question conventional wisdom
  - Expose industry myths
  - Present opposite viewpoint with evidence
  - Make readers think "Wait, really?"
  
  TOPIC: ${topic}
  ANGLE: ${angle}
  TONE: ${tone}
  FORMAT: ${formatStrategy}
  
  Your contrarian approach:
  - Start with what "everyone thinks"
  - Flip it with surprising data
  - Challenge the mainstream narrative
  - End with thought-provoking question or bold claim
  
  NO first-person. Evidence-based. Specific numbers.
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create contrarian content about: ${topic}` }
    ],
    temperature: 0.9
  });
  
  const content = response.choices[0].message.content;
  
  return {
    content: content,
    format: 'single',
    visualFormat: formatStrategy
  };
}
```

**AI Generates (in contrarian voice):**
```
"Everyone's dropping $40 on cold-pressed olive oil for polyphenols.

Research shows heat processing at 70°C INCREASES polyphenol bioavailability 
by 40% (oleocanthal deglycosylation).

Cold-pressed = marketing > science.

Are you paying premium for lower efficacy?"
```

**Notice:**
- ✅ Contrarian personality shines through
- ✅ Challenges mainstream (cold-pressed is "better")
- ✅ Uses the angle ("waste money")
- ✅ Follows tone ("skeptical consumer")
- ✅ Applies format strategy (price comparison, data)
- ✅ No template copying!

---

## STEP 8: Return & Save

```typescript
// Back in: src/jobs/planJob.ts:354-400

const generatedContent = {
  text: "Everyone's dropping $40 on cold-pressed...",
  format: 'single',
  topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  visual_format: "Lead with price comparison..."
};

// Save to database with FULL metadata:
await supabase.from('content_metadata').insert({
  decision_id: uuid(),
  content: generatedContent.text,
  
  // AI-generated dimensions (ALL unique!):
  raw_topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  format_strategy: "Lead with price comparison...",
  generator_name: "contrarian",
  
  // Metadata:
  angle_type: "consumer_economics",
  tone_cluster: "skeptical",
  structural_type: "comparison",
  
  status: 'queued',
  scheduled_at: new Date(...)
});
```

---

## 🎯 COMPLETE FLOW VISUALIZATION

```
EVERY 30 MINUTES:

┌─────────────────────────────────────────┐
│ STEP 0: Diversity Status                │
│ → Show last 10 topics/angles/tones      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 1: AI Generates TOPIC              │
│ → topicGenerator.generateTopic()        │
│ → Avoids last 10 topics                 │
│ → Output: "Polyphenol bioavailability..." │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 2: AI Generates ANGLE              │
│ → angleGenerator.generateAngle(topic)   │ ← Receives topic!
│ → Avoids last 10 angles                 │
│ → Output: "Why expensive oils waste $"  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 3: AI Generates TONE               │
│ → toneGenerator.generateTone()          │
│ → Avoids last 10 tones                  │
│ → Output: "Skeptical consumer advocate" │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 4: AI Generates FORMAT STRATEGY    │
│ → formatStrategyGen.generateStrategy()  │ ← Receives all above!
│ → Output: "Price comparison with data"  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 5: Match GENERATOR                 │
│ → generatorMatcher.match(angle, tone)   │
│ → Logic: skeptical + consumer → contrarian │
│ → Output: "contrarian"                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 6: Call Dedicated Generator        │
│ → contrarianGenerator.ts runs           │
│ → Receives: topic, angle, tone, format  │
│ → Has specialized contrarian prompt     │
│ → AI generates in contrarian voice      │
│ → Output: "Everyone's dropping $40..."  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 7: Save to Database                │
│ → Full metadata saved                   │
│ → raw_topic, angle, tone, format_strategy │
│ → generator_name, quality_score         │
└─────────────────────────────────────────┘
```

---

## 🔍 KEY COMPONENTS EXPLAINED

### 1. Topic Generator (`dynamicTopicGenerator.ts`)

**What it does:**
```typescript
async generateTopic() {
  // Get last 10 topics from database
  const banned = ['gut health', 'NAD+', 'sleep', 'recovery'...];
  
  // Call OpenAI:
  // "Generate unique health topic.
  //  AVOID: gut health, NAD+, sleep, recovery...
  //  Make it specific, interesting, viral"
  
  // AI generates:
  return {
    topic: "Urolithin A vs resveratrol for mitophagy activation",
    dimension: "research",
    viral_potential: 7.8
  };
}
```

**Why this works:**
- ✅ Avoids repeating last 10 topics
- ✅ AI creates NEW topics each time
- ✅ Infinite variety (not limited to 16!)

---

### 2. Angle Generator (`angleGenerator.ts`)

**What it does:**
```typescript
async generateAngle(topic) {
  // RECEIVES the topic from Step 1!
  // topic = "Urolithin A vs resveratrol..."
  
  // Get last 10 angles
  const banned = ['mechanism', 'protocol', 'comparison'...];
  
  // Call OpenAI:
  // "Generate unique angle FOR THIS TOPIC:
  //  'Urolithin A vs resveratrol for mitophagy'
  //  AVOID: mechanism, protocol, comparison...
  //  Make it surprising, specific"
  
  // AI generates:
  return "Why Bryan Johnson switched from resveratrol to Urolithin A";
}
```

**Why this works:**
- ✅ Angle is SPECIFIC to the topic
- ✅ Not just random from a list
- ✅ Contextual and relevant

---

### 3. Tone Generator (`toneGenerator.ts`)

**What it does:**
```typescript
async generateTone() {
  // Get last 10 tones
  const banned = ['skeptical', 'confident', 'analytical'...];
  
  // Call OpenAI:
  // "Generate unique voice/tone/style
  //  AVOID: skeptical, confident, analytical...
  //  Create personality for the content"
  
  // AI generates:
  return {
    tone: "Evidence-driven biohacker sharing insider knowledge",
    is_singular: true,
    tone_cluster: "expert_insider"
  };
}
```

**Why this works:**
- ✅ Creates actual personality
- ✅ Not just mood words
- ✅ Defines voice character

---

### 4. Format Strategy Generator (`formatStrategyGenerator.ts`)

**What it does:**
```typescript
async generateStrategy(topic, angle, tone, generator) {
  // RECEIVES everything from above!
  
  // Call OpenAI:
  // "Create visual format strategy for:
  //  Topic: Urolithin A vs resveratrol
  //  Angle: Why Bryan Johnson switched
  //  Tone: Evidence-driven biohacker
  //  Generator: contrarian
  //  
  //  How should this be structured/formatted?"
  
  // AI generates:
  return "Open with Bryan Johnson reference, 
          compare molecules with specific mechanisms,
          dense with biomarker data,
          end with protocol recommendation";
}
```

**Why this works:**
- ✅ Format matches the content
- ✅ Strategic visual structure
- ✅ Contextual to topic/angle/tone

---

### 5. Generator Matcher (`generatorMatcher.ts`)

**What it does:**
```typescript
matchGenerator(angle, tone) {
  // Analyze angle and tone to find best generator
  
  const angleStr = angle.toLowerCase();
  const toneStr = tone.toLowerCase();
  
  // Matching rules:
  if (angleStr.includes('myth') || angleStr.includes('debunk')) {
    return 'mythBuster';
  }
  
  if (angleStr.includes('protocol') || toneStr.includes('coach')) {
    return 'coach';
  }
  
  if (angleStr.includes('story') || angleStr.includes('narrative')) {
    return 'storyteller';
  }
  
  if (toneStr.includes('provocative') || angleStr.includes('challenge')) {
    return 'provocateur';
  }
  
  if (angleStr.includes('data') || angleStr.includes('research')) {
    return 'dataNerd';
  }
  
  if (toneStr.includes('skeptical') || angleStr.includes('contrary')) {
    return 'contrarian';
  }
  
  // Default: Random from 12
  return randomGenerator();
}
```

**Why this works:**
- ✅ Intelligent matching (not random!)
- ✅ Uses contextual clues from angle+tone
- ✅ Each generator gets used for right content

---

### 6. Dedicated Generator (e.g., `contrarianGenerator.ts`)

**What it does:**
```typescript
// File: src/generators/contrarianGenerator.ts

export async function generateContrarianContent(params) {
  const { topic, angle, tone, formatStrategy, intelligence } = params;
  
  // SPECIALIZED CONTRARIAN PROMPT:
  const systemPrompt = `
  You are a CONTRARIAN health expert.
  
  PERSONALITY TRAITS:
  - Challenge mainstream beliefs with data
  - Expose industry myths and marketing
  - Present opposite viewpoint
  - Make readers question assumptions
  
  YOUR ASSIGNMENT:
  Topic: ${topic}
  Angle: ${angle}
  Tone: ${tone}
  Visual Format: ${formatStrategy}
  
  ${intelligence ? `
  PERFORMANCE INTEL (What's working):
  - Top hooks: ${intelligence.top_hooks}
  - Best topics: ${intelligence.best_topics}
  - Avg engagement: ${intelligence.avg_engagement}
  ` : ''}
  
  Create contrarian content that challenges mainstream view.
  Use your skeptical, evidence-driven personality.
  Apply the format strategy for visual structure.
  `;
  
  // Call OpenAI with specialized prompt:
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Be contrarian about: ${topic}` }
    ],
    temperature: 0.9
  });
  
  return {
    content: response.choices[0].message.content,
    format: 'single'
  };
}
```

**AI Generates (in contrarian voice):**
```
"Everyone's buying cold-pressed olive oil for maximum polyphenols.

Heat processing at 70°C increases oleocanthal bioavailability by 40% 
(deglycosylation mechanism).

Your $40 artisan oil has LOWER efficacy than $8 regular.

Marketing > biochemistry."
```

**Notice:**
- ✅ Contrarian personality (challenges mainstream)
- ✅ Uses the angle (waste money)
- ✅ Follows tone (skeptical consumer)
- ✅ Applies format (price comparison + data)
- ✅ Unique structure (not template!)

---

## 📊 WHY THIS SYSTEM IS BETTER

### Topic Diversity:
```
WRONG SYSTEM: 16 hardcoded topics
YOUR SYSTEM: AI generates infinite topics
  → "Urolithin A vs resveratrol for mitophagy"
  → "Exogenous ketone ester timing for ketosis"
  → "Polyphenol bioavailability processing methods"
  → Never repeats!
```

### Contextual Angles:
```
WRONG SYSTEM: Random angle from list
YOUR SYSTEM: AI generates angle FOR that specific topic
  → Topic: "Polyphenol oils"
  → Angle: "Why cold-pressed wastes money" (contextual!)
```

### Actual Generator Personalities:
```
WRONG SYSTEM: One generic prompt for everything
YOUR SYSTEM: 12 specialized generators
  → contrarian has contrarian prompt
  → dataNerd has research-heavy prompt
  → coach has practical advice prompt
  → Each is DIFFERENT!
```

### Learning Loops:
```
WRONG SYSTEM: No learning
YOUR SYSTEM: Passes intelligence to generators
  → "Last dataNerd post got 89 likes"
  → "Contrarian posts avg 52 likes"
  → AI uses this to improve!
```

---

## 🎯 SUMMARY: YOUR CORRECT SYSTEM

**Location:** `src/jobs/planJob.ts`

**Sequential Flow:**
```
1. AI generates TOPIC (avoids last 10)
2. AI generates ANGLE for that topic (avoids last 10)
3. AI generates TONE (avoids last 10)
4. AI generates FORMAT STRATEGY (based on all above)
5. Match to 1 of 12 GENERATORS (based on angle+tone)
6. Call that specific generator with full context
7. Generator creates content in its personality
8. Save with complete metadata
```

**Why it works:**
- ✅ Infinite topics (AI-generated)
- ✅ Contextual angles (specific to topic)
- ✅ Varied tones (AI-generated)
- ✅ 12 distinct personalities
- ✅ Learning loops (performance data)
- ✅ Diversity enforcement (avoids last 10)

**Why it's not running:**
- ❌ jobManager.ts points to planJobUnified.ts instead
- ❌ One line change would activate it!

---

**This is YOUR system! Want me to activate it by switching jobManager back to planJob.ts?**



## 📍 Location: `src/jobs/planJob.ts`

**This is the system you described!**

---

## 🎯 THE CORRECT SEQUENTIAL FLOW

### EVERY 30 MINUTES - Complete Journey:

---

## STEP 0: Diversity Status Check

```typescript
// File: src/jobs/planJob.ts:277

const diversityEnforcer = getDiversityEnforcer();
await diversityEnforcer.getDiversitySummary();

// Logs:
"📊 DIVERSITY STATUS (Last 10 posts):
 Topics: gut health, NAD+, sleep, recovery, circadian...
 Angles: industry critique, mechanism, protocol, comparison...
 Tones: skeptical, confident, provocative, analytical...
 Generators: dataNerd, coach, mythBuster, provocateur..."
```

**Purpose:** Show what was recently used (for diversity tracking)

---

## STEP 1: AI Generates TOPIC (Avoids Last 10)

```typescript
// File: src/jobs/planJob.ts:279-287

const topicGenerator = getDynamicTopicGenerator();
const dynamicTopic = await topicGenerator.generateTopic();

// topicGenerator calls OpenAI:
// Prompt: "Generate unique health topic. 
//          AVOID these 10: [gut health, NAD+, sleep, recovery...]
//          Return: topic, angle, dimension, viral_potential"

// AI Output:
{
  topic: "Polyphenol bioavailability in cold-pressed vs heat-processed oils",
  angle: "Industry processing methods reduce efficacy by 70%",
  dimension: "research",
  viral_potential: 8.2
}

const topic = dynamicTopic.topic;

console.log('🎯 TOPIC: "Polyphenol bioavailability..."');
console.log('   Viral potential: 8.2/10');
```

**Key Features:**
- ✅ AI-generated (not from hardcoded list!)
- ✅ Avoids last 10 topics
- ✅ Includes viral scoring
- ✅ Infinite variety

---

## STEP 2: AI Generates ANGLE (For That Specific Topic!)

```typescript
// File: src/jobs/planJob.ts:289-293

const angleGenerator = getAngleGenerator();
const angle = await angleGenerator.generateAngle(topic);
// ↑ Receives the topic from Step 1!

// angleGenerator calls OpenAI:
// Prompt: "Generate unique angle for: 
//          'Polyphenol bioavailability in cold-pressed vs heat-processed oils'
//          AVOID these 10 recent angles: [industry critique, mechanism...]
//          Make it specific, surprising, engaging"

// AI Output:
"Why your expensive cold-pressed olive oil might be wasting money"

console.log('📐 ANGLE: "Why your expensive cold-pressed olive oil..."');
```

**Key Features:**
- ✅ AI-generated based on the specific topic
- ✅ Avoids last 10 angles
- ✅ Contextual (related to the topic!)
- ✅ Unique perspective

---

## STEP 3: AI Generates TONE (Independent Voice Style)

```typescript
// File: src/jobs/planJob.ts:295-299

const toneGenerator = getToneGenerator();
const tone = await toneGenerator.generateTone();

// toneGenerator calls OpenAI:
// Prompt: "Generate unique voice/tone/style
//          AVOID these 10: [skeptical, confident, provocative...]
//          Examples: casual friend, analytical researcher, 
//                   provocative challenger, practical coach"

// AI Output:
"Skeptical consumer advocate exposing marketing myths"

console.log('🎤 TONE: "Skeptical consumer advocate..."');
```

**Key Features:**
- ✅ AI-generated independently
- ✅ Avoids last 10 tones
- ✅ Defines the voice/style
- ✅ Varied personalities

---

## STEP 4: AI Generates FORMAT STRATEGY

```typescript
// File: src/jobs/planJob.ts:310-313

const formatStrategyGen = getFormatStrategyGenerator();
const formatStrategy = await formatStrategyGen.generateStrategy(
  topic,    // ← Receives topic
  angle,    // ← Receives angle
  tone,     // ← Receives tone
  matchedGenerator  // ← Receives generator (from next step)
);

// formatStrategyGen calls OpenAI:
// Prompt: "How should this content be visually formatted?
//          Topic: Polyphenol bioavailability...
//          Angle: Why expensive oils waste money
//          Tone: Skeptical consumer advocate
//          Create visual format strategy"

// AI Output:
"Lead with price comparison numbers, dense with specific brands, 
 bullet points for bioavailability data, end with actionable advice"

console.log('🎨 FORMAT: "Lead with price comparison..."');
```

**Key Features:**
- ✅ AI-generated based on topic+angle+tone
- ✅ Strategic (not random)
- ✅ Guides visual structure

---

## STEP 5: Match GENERATOR (Based on Angle + Tone)

```typescript
// File: src/jobs/planJob.ts:301-305

const generatorMatcher = getGeneratorMatcher();
const matchedGenerator = generatorMatcher.matchGenerator(angle, tone);

// Matching logic:
// Input:
//   angle: "Why expensive oils waste money"
//   tone: "Skeptical consumer advocate"

// Analysis:
//   - Contains "skeptical" → contrarian tendency
//   - Contains "why" → questioning approach
//   - Contains "waste money" → challenges mainstream

// Match: contrarian (best fit for this angle+tone combo)

console.log('🎭 GENERATOR MATCHED: contrarian');
```

**The 12 Generators:**
1. **dataNerd** - Research-heavy, numbers, studies
2. **provocateur** - Bold claims, challenges status quo
3. **mythBuster** - Debunks common beliefs
4. **contrarian** - Opposite of mainstream view
5. **storyteller** - Narrative, anecdotes
6. **coach** - Practical, actionable advice
7. **philosopher** - Deep thinking, implications
8. **culturalBridge** - Cultural/historical context
9. **newsReporter** - Current events, breaking news
10. **explorer** - Connections, discoveries
11. **thoughtLeader** - Big picture, trends
12. **humanVoice** - Conversational, relatable

**Matching Examples:**
```
"mechanism" angle + "analytical" tone → dataNerd
"protocol" angle + "direct" tone → coach
"controversy" angle + "provocative" tone → provocateur
"story" angle + "warm" tone → storyteller
"industry critique" angle + "skeptical" tone → contrarian
```

---

## STEP 6: Call Dedicated Generator

```typescript
// File: src/jobs/planJob.ts:340-352

const generatedContent = await callDedicatedGenerator(matchedGenerator, {
  topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  formatStrategy: "Lead with price comparison...",
  growthIntelligence: {...}  // Performance data
});

// This calls: src/jobs/planJob.ts:181-252
// Which loads the specific generator file
```

### Inside callDedicatedGenerator():

```typescript
// File: src/jobs/planJob.ts:181-231

// Map generator name to file:
const generatorMap = {
  'contrarian': {
    module: '../generators/contrarianGenerator',
    fn: 'generateContrarianContent'
  },
  'dataNerd': {
    module: '../generators/dataNerdGenerator',
    fn: 'generateDataNerdContent'
  },
  'mythBuster': {
    module: '../generators/mythBusterGenerator',
    fn: 'generateMythBusterContent'
  },
  // ...etc for all 12
};

// Load the specific generator:
const config = generatorMap[matchedGenerator];  // 'contrarian'
const module = await import('../generators/contrarianGenerator');
const generateFn = module.generateContrarianContent;

// Call it with full context:
const result = await generateFn({
  topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  formatStrategy: "Lead with price comparison...",
  format: 'single',
  intelligence: growthIntelligence
});
```

---

## STEP 7: Inside contrarianGenerator.ts

```typescript
// File: src/generators/contrarianGenerator.ts

export async function generateContrarianContent(params) {
  const { topic, angle, tone, formatStrategy } = params;
  
  // Specialized CONTRARIAN prompt:
  const systemPrompt = `
  You are a CONTRARIAN health expert who challenges mainstream beliefs.
  
  PERSONALITY:
  - Question conventional wisdom
  - Expose industry myths
  - Present opposite viewpoint with evidence
  - Make readers think "Wait, really?"
  
  TOPIC: ${topic}
  ANGLE: ${angle}
  TONE: ${tone}
  FORMAT: ${formatStrategy}
  
  Your contrarian approach:
  - Start with what "everyone thinks"
  - Flip it with surprising data
  - Challenge the mainstream narrative
  - End with thought-provoking question or bold claim
  
  NO first-person. Evidence-based. Specific numbers.
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create contrarian content about: ${topic}` }
    ],
    temperature: 0.9
  });
  
  const content = response.choices[0].message.content;
  
  return {
    content: content,
    format: 'single',
    visualFormat: formatStrategy
  };
}
```

**AI Generates (in contrarian voice):**
```
"Everyone's dropping $40 on cold-pressed olive oil for polyphenols.

Research shows heat processing at 70°C INCREASES polyphenol bioavailability 
by 40% (oleocanthal deglycosylation).

Cold-pressed = marketing > science.

Are you paying premium for lower efficacy?"
```

**Notice:**
- ✅ Contrarian personality shines through
- ✅ Challenges mainstream (cold-pressed is "better")
- ✅ Uses the angle ("waste money")
- ✅ Follows tone ("skeptical consumer")
- ✅ Applies format strategy (price comparison, data)
- ✅ No template copying!

---

## STEP 8: Return & Save

```typescript
// Back in: src/jobs/planJob.ts:354-400

const generatedContent = {
  text: "Everyone's dropping $40 on cold-pressed...",
  format: 'single',
  topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  visual_format: "Lead with price comparison..."
};

// Save to database with FULL metadata:
await supabase.from('content_metadata').insert({
  decision_id: uuid(),
  content: generatedContent.text,
  
  // AI-generated dimensions (ALL unique!):
  raw_topic: "Polyphenol bioavailability...",
  angle: "Why expensive oils waste money",
  tone: "Skeptical consumer advocate",
  format_strategy: "Lead with price comparison...",
  generator_name: "contrarian",
  
  // Metadata:
  angle_type: "consumer_economics",
  tone_cluster: "skeptical",
  structural_type: "comparison",
  
  status: 'queued',
  scheduled_at: new Date(...)
});
```

---

## 🎯 COMPLETE FLOW VISUALIZATION

```
EVERY 30 MINUTES:

┌─────────────────────────────────────────┐
│ STEP 0: Diversity Status                │
│ → Show last 10 topics/angles/tones      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 1: AI Generates TOPIC              │
│ → topicGenerator.generateTopic()        │
│ → Avoids last 10 topics                 │
│ → Output: "Polyphenol bioavailability..." │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 2: AI Generates ANGLE              │
│ → angleGenerator.generateAngle(topic)   │ ← Receives topic!
│ → Avoids last 10 angles                 │
│ → Output: "Why expensive oils waste $"  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 3: AI Generates TONE               │
│ → toneGenerator.generateTone()          │
│ → Avoids last 10 tones                  │
│ → Output: "Skeptical consumer advocate" │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 4: AI Generates FORMAT STRATEGY    │
│ → formatStrategyGen.generateStrategy()  │ ← Receives all above!
│ → Output: "Price comparison with data"  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 5: Match GENERATOR                 │
│ → generatorMatcher.match(angle, tone)   │
│ → Logic: skeptical + consumer → contrarian │
│ → Output: "contrarian"                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 6: Call Dedicated Generator        │
│ → contrarianGenerator.ts runs           │
│ → Receives: topic, angle, tone, format  │
│ → Has specialized contrarian prompt     │
│ → AI generates in contrarian voice      │
│ → Output: "Everyone's dropping $40..."  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ STEP 7: Save to Database                │
│ → Full metadata saved                   │
│ → raw_topic, angle, tone, format_strategy │
│ → generator_name, quality_score         │
└─────────────────────────────────────────┘
```

---

## 🔍 KEY COMPONENTS EXPLAINED

### 1. Topic Generator (`dynamicTopicGenerator.ts`)

**What it does:**
```typescript
async generateTopic() {
  // Get last 10 topics from database
  const banned = ['gut health', 'NAD+', 'sleep', 'recovery'...];
  
  // Call OpenAI:
  // "Generate unique health topic.
  //  AVOID: gut health, NAD+, sleep, recovery...
  //  Make it specific, interesting, viral"
  
  // AI generates:
  return {
    topic: "Urolithin A vs resveratrol for mitophagy activation",
    dimension: "research",
    viral_potential: 7.8
  };
}
```

**Why this works:**
- ✅ Avoids repeating last 10 topics
- ✅ AI creates NEW topics each time
- ✅ Infinite variety (not limited to 16!)

---

### 2. Angle Generator (`angleGenerator.ts`)

**What it does:**
```typescript
async generateAngle(topic) {
  // RECEIVES the topic from Step 1!
  // topic = "Urolithin A vs resveratrol..."
  
  // Get last 10 angles
  const banned = ['mechanism', 'protocol', 'comparison'...];
  
  // Call OpenAI:
  // "Generate unique angle FOR THIS TOPIC:
  //  'Urolithin A vs resveratrol for mitophagy'
  //  AVOID: mechanism, protocol, comparison...
  //  Make it surprising, specific"
  
  // AI generates:
  return "Why Bryan Johnson switched from resveratrol to Urolithin A";
}
```

**Why this works:**
- ✅ Angle is SPECIFIC to the topic
- ✅ Not just random from a list
- ✅ Contextual and relevant

---

### 3. Tone Generator (`toneGenerator.ts`)

**What it does:**
```typescript
async generateTone() {
  // Get last 10 tones
  const banned = ['skeptical', 'confident', 'analytical'...];
  
  // Call OpenAI:
  // "Generate unique voice/tone/style
  //  AVOID: skeptical, confident, analytical...
  //  Create personality for the content"
  
  // AI generates:
  return {
    tone: "Evidence-driven biohacker sharing insider knowledge",
    is_singular: true,
    tone_cluster: "expert_insider"
  };
}
```

**Why this works:**
- ✅ Creates actual personality
- ✅ Not just mood words
- ✅ Defines voice character

---

### 4. Format Strategy Generator (`formatStrategyGenerator.ts`)

**What it does:**
```typescript
async generateStrategy(topic, angle, tone, generator) {
  // RECEIVES everything from above!
  
  // Call OpenAI:
  // "Create visual format strategy for:
  //  Topic: Urolithin A vs resveratrol
  //  Angle: Why Bryan Johnson switched
  //  Tone: Evidence-driven biohacker
  //  Generator: contrarian
  //  
  //  How should this be structured/formatted?"
  
  // AI generates:
  return "Open with Bryan Johnson reference, 
          compare molecules with specific mechanisms,
          dense with biomarker data,
          end with protocol recommendation";
}
```

**Why this works:**
- ✅ Format matches the content
- ✅ Strategic visual structure
- ✅ Contextual to topic/angle/tone

---

### 5. Generator Matcher (`generatorMatcher.ts`)

**What it does:**
```typescript
matchGenerator(angle, tone) {
  // Analyze angle and tone to find best generator
  
  const angleStr = angle.toLowerCase();
  const toneStr = tone.toLowerCase();
  
  // Matching rules:
  if (angleStr.includes('myth') || angleStr.includes('debunk')) {
    return 'mythBuster';
  }
  
  if (angleStr.includes('protocol') || toneStr.includes('coach')) {
    return 'coach';
  }
  
  if (angleStr.includes('story') || angleStr.includes('narrative')) {
    return 'storyteller';
  }
  
  if (toneStr.includes('provocative') || angleStr.includes('challenge')) {
    return 'provocateur';
  }
  
  if (angleStr.includes('data') || angleStr.includes('research')) {
    return 'dataNerd';
  }
  
  if (toneStr.includes('skeptical') || angleStr.includes('contrary')) {
    return 'contrarian';
  }
  
  // Default: Random from 12
  return randomGenerator();
}
```

**Why this works:**
- ✅ Intelligent matching (not random!)
- ✅ Uses contextual clues from angle+tone
- ✅ Each generator gets used for right content

---

### 6. Dedicated Generator (e.g., `contrarianGenerator.ts`)

**What it does:**
```typescript
// File: src/generators/contrarianGenerator.ts

export async function generateContrarianContent(params) {
  const { topic, angle, tone, formatStrategy, intelligence } = params;
  
  // SPECIALIZED CONTRARIAN PROMPT:
  const systemPrompt = `
  You are a CONTRARIAN health expert.
  
  PERSONALITY TRAITS:
  - Challenge mainstream beliefs with data
  - Expose industry myths and marketing
  - Present opposite viewpoint
  - Make readers question assumptions
  
  YOUR ASSIGNMENT:
  Topic: ${topic}
  Angle: ${angle}
  Tone: ${tone}
  Visual Format: ${formatStrategy}
  
  ${intelligence ? `
  PERFORMANCE INTEL (What's working):
  - Top hooks: ${intelligence.top_hooks}
  - Best topics: ${intelligence.best_topics}
  - Avg engagement: ${intelligence.avg_engagement}
  ` : ''}
  
  Create contrarian content that challenges mainstream view.
  Use your skeptical, evidence-driven personality.
  Apply the format strategy for visual structure.
  `;
  
  // Call OpenAI with specialized prompt:
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Be contrarian about: ${topic}` }
    ],
    temperature: 0.9
  });
  
  return {
    content: response.choices[0].message.content,
    format: 'single'
  };
}
```

**AI Generates (in contrarian voice):**
```
"Everyone's buying cold-pressed olive oil for maximum polyphenols.

Heat processing at 70°C increases oleocanthal bioavailability by 40% 
(deglycosylation mechanism).

Your $40 artisan oil has LOWER efficacy than $8 regular.

Marketing > biochemistry."
```

**Notice:**
- ✅ Contrarian personality (challenges mainstream)
- ✅ Uses the angle (waste money)
- ✅ Follows tone (skeptical consumer)
- ✅ Applies format (price comparison + data)
- ✅ Unique structure (not template!)

---

## 📊 WHY THIS SYSTEM IS BETTER

### Topic Diversity:
```
WRONG SYSTEM: 16 hardcoded topics
YOUR SYSTEM: AI generates infinite topics
  → "Urolithin A vs resveratrol for mitophagy"
  → "Exogenous ketone ester timing for ketosis"
  → "Polyphenol bioavailability processing methods"
  → Never repeats!
```

### Contextual Angles:
```
WRONG SYSTEM: Random angle from list
YOUR SYSTEM: AI generates angle FOR that specific topic
  → Topic: "Polyphenol oils"
  → Angle: "Why cold-pressed wastes money" (contextual!)
```

### Actual Generator Personalities:
```
WRONG SYSTEM: One generic prompt for everything
YOUR SYSTEM: 12 specialized generators
  → contrarian has contrarian prompt
  → dataNerd has research-heavy prompt
  → coach has practical advice prompt
  → Each is DIFFERENT!
```

### Learning Loops:
```
WRONG SYSTEM: No learning
YOUR SYSTEM: Passes intelligence to generators
  → "Last dataNerd post got 89 likes"
  → "Contrarian posts avg 52 likes"
  → AI uses this to improve!
```

---

## 🎯 SUMMARY: YOUR CORRECT SYSTEM

**Location:** `src/jobs/planJob.ts`

**Sequential Flow:**
```
1. AI generates TOPIC (avoids last 10)
2. AI generates ANGLE for that topic (avoids last 10)
3. AI generates TONE (avoids last 10)
4. AI generates FORMAT STRATEGY (based on all above)
5. Match to 1 of 12 GENERATORS (based on angle+tone)
6. Call that specific generator with full context
7. Generator creates content in its personality
8. Save with complete metadata
```

**Why it works:**
- ✅ Infinite topics (AI-generated)
- ✅ Contextual angles (specific to topic)
- ✅ Varied tones (AI-generated)
- ✅ 12 distinct personalities
- ✅ Learning loops (performance data)
- ✅ Diversity enforcement (avoids last 10)

**Why it's not running:**
- ❌ jobManager.ts points to planJobUnified.ts instead
- ❌ One line change would activate it!

---

**This is YOUR system! Want me to activate it by switching jobManager back to planJob.ts?**

