# 🔧 GENERATOR PROMPT REDESIGN - How to Change Them

## THE CHANGE: Remove Examples, Keep Everything Else

---

## EXAMPLE: MYTH BUSTER GENERATOR

### **CURRENT PROMPT (With Templates):**

```javascript
const systemPrompt = `You debunk myths with evidence and reveal what's actually true.

Your personality:
• I love debunking health myths
• I share the real truth behind common beliefs
• I challenge what everyone thinks they know
• I reveal surprising facts that contradict popular wisdom
• I make people question their assumptions

You can express your personality however feels natural:
• Sometimes state the myth and truth
• Sometimes just share the truth
• Sometimes ask questions that challenge beliefs
• Sometimes tell stories that debunk myths
• Sometimes make comparisons

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

Examples of good myth buster content:  ❌ REMOVE THIS!
• "Myth: Fasting slows metabolism. Truth: 48-hour fasts increase growth hormone 1,300%..."
• "Myth: Carbs at night cause weight gain. Truth: Meal timing doesn't affect weight loss..."

What makes myth-busting powerful:
• Challenges common beliefs
• Backed by evidence (not opinion)
• Offers alternative (not just "you're wrong")
• Explains why myth persists
• Makes people think differently about health`;
```

### **NEW PROMPT (Template-Free):**

```javascript
const systemPrompt = `You debunk myths with evidence and reveal what's actually true.

Your personality:
• I love debunking health myths
• I share the real truth behind common beliefs
• I challenge what everyone thinks they know
• I reveal surprising facts that contradict popular wisdom
• I make people question their assumptions

You can express your personality however feels natural:
• Ask challenging questions that make people reconsider
• Share direct data that contradicts beliefs
• Tell stories that reveal the truth
• Make comparisons (what people think vs reality)
• Present bold statements backed by evidence
• Use the classic myth/truth split (occasionally, not always!)

🎨 CRITICAL: CREATE SOMETHING NEW EACH TIME
Don't default to the same format. Experiment with structure.
Pick a RANDOM approach from the list above - don't always choose the first option.

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

What makes myth-busting powerful:
• Challenges common beliefs
• Backed by evidence (not opinion)
• Offers alternative (not just "you're wrong")
• Explains why myth persists
• Makes people think differently about health`;
```

### **KEY CHANGES:**

```
❌ REMOVED: All hardcoded examples
❌ REMOVED: "Examples of good myth buster content" section
✅ ADDED: "CREATE SOMETHING NEW EACH TIME"
✅ ADDED: "Pick a RANDOM approach"
✅ REORDERED: "Classic myth/truth split" moved to LAST (not first!)
✅ KEPT: Personality, options, principles
```

---

## WHAT STAYS IN PROMPTS

### **1. Personality Description** ✅

```javascript
"Your personality:
• I love [generator's core passion]
• I share [what they share]
• I focus on [their approach]
• I make people [their impact]"
```

**Why Keep:** Defines the voice and style clearly without forcing format

---

### **2. "Sometimes" Format Options** ✅

```javascript
"You can express however feels natural:
• Sometimes [approach 1]
• Sometimes [approach 2]
• Sometimes [approach 3]
• Sometimes [approach 4]
• Sometimes [approach 5]"
```

**Why Keep:** Shows variety, doesn't force specific format
**Change:** Randomize order each time or add "pick random" instruction

---

### **3. Quality Principles** ✅

```javascript
"What makes [generator] powerful:
• Specific beats vague
• Surprising beats expected
• Evidence beats opinion
• Clear beats confusing"
```

**Why Keep:** Guides QUALITY without forcing FORMAT

---

### **4. "CREATE SOMETHING NEW"** ✅

```javascript
"🎨 CRITICAL: CREATE SOMETHING NEW EACH TIME
Don't default to the same format. Experiment with structure.
Pick a RANDOM approach from the list above."
```

**Why Keep:** Actively prevents templating
**Add to:** ALL generators (only 7 of 12 have this now)

---

### **5. Topic/Angle/Tone Context** ✅

```javascript
// This is already passed in:
"Create content about ${topic} from this angle: ${angle} using this tone: ${tone}"
```

**Why Keep:** Your sophisticated metadata system provides context

---

## WHAT GETS REMOVED

### **1. Hardcoded Examples** ❌

```javascript
// DELETE THIS ENTIRE SECTION:
"Examples of good [generator] content:
• [Example 1]
• [Example 2]
• [Example 3]"
```

**Why Remove:** AI copies these exactly, overriding all your complexity

---

### **2. Template Suggestions** ❌

```javascript
// DELETE FROM QUALITY GATES:
fixes.push('Clear structure: "Myth: X. Truth: Y"');

// REPLACE WITH:
fixes.push('Show contrast between belief and reality - any format works');
```

**Why Remove:** Enforces rigid templates

---

### **3. Specific Format Patterns** ❌

```javascript
// DELETE:
"Start with 'Myth:' and end with 'Truth:'"

// KEEP:
"Challenge beliefs and provide evidence"
```

**Why Remove:** Goal-based > Format-based

---

## NOW CHECKING: TOPIC/TONE/ANGLE/STRUCTURE GENERATORS

Let me check if these have the same template issues...


---

## CHECKING TOPIC/TONE/ANGLE/STRUCTURE GENERATORS

### **TOPIC GENERATOR** (dynamicTopicGenerator.ts)

**Current Approach:**
```javascript
"Generate a unique health topic.

Avoid these recent topics:
1. Topic A
2. Topic B
...

Complete creative freedom. Surprise me."
```

**MY ANALYSIS:**
✅ **EXCELLENT!** NO hardcoded examples!
✅ Uses recent topics to avoid repetition
✅ "Complete creative freedom"
✅ Meta-awareness instruction (compensates for training bias)
✅ Provides domains list but NOT templates

**No changes needed!** This is how ALL generators should work!

---

### **ANGLE GENERATOR** (angleGenerator.ts)

**Current Approach:**
```javascript
"Generate unique angles (perspectives) for health topics.

TARGET DISTRIBUTION:
- Cultural angles: 15% (influencer practices, trends)
- Media angles: 15% (podcast coverage, viral claims)
- Industry angles: 15% (pricing, profits, incentives)
- Controversial angles: 10% (challenge consensus)
...

ANGLE TYPE EXAMPLES:
- 'Wim Hof's impact on cold exposure adoption'
- 'Why Bryan Johnson's protocol went viral'
- 'Insurance won't cover X (follow incentives)'
...

Recently used (avoid):
[List of recent angles]"
```

**MY ANALYSIS:**
⚠️ **HAS EXAMPLES!** But they're PATTERN examples, not templates

**Difference:**
- ❌ Bad examples: "Myth: X. Truth: Y." (exact format to copy)
- ✅ Good examples: "Wim Hof's impact..." (inspiration, not template)

**These are okay** because:
- They show TYPES of angles (cultural, media, industry)
- Not exact formats to copy
- High variety (dozens of different patterns)
- Teach AI about angle CATEGORIES, not formats

**Verdict:** KEEP these! They're educational, not templating.

---

### **TONE GENERATOR** (Not found as separate file)

**Where it's generated:**
Looking at planJob.ts, tone seems to be generated inline or through a different system.

**Need to check:** Is tone being generated with templates or freely?

Let me search...

Actually, looking at the database results, tones are HIGHLY varied:
- "Cynical analyst unearthing health absurdities"
- "Blunt critique of wellness marketing tricks"
- "Fierce defense of nutritional integrity"
- "Fearlessly challenging wellness misconceptions"

**MY ANALYSIS:**
✅ **NO rigid patterns!** Tones are creative and unique
✅ Not seeing template issues here
✅ This is working correctly!

---

### **FORMAT STRATEGY GENERATOR** (Not found as separate file)

**From database:**
- "Begin with cynical statement → layer dense statistics..."
- "Use blunt statements → highlight contradictions..."
- "Start with bold assertions → layer shocking stats..."

**MY ANALYSIS:**
✅ **HIGHLY VARIED!** No rigid patterns detected
✅ Each strategy is unique and contextual
✅ This is working as intended!

---

### **VISUAL FORMAT GENERATOR** (Inline in generators)

**From database:**
- "Split format emphasizes myth vs truth, no emojis"
- "Bullet points for clarity, easy to follow"
- "Bold key statistics, use line breaks"
- "Plain text with thought-provoking statement"

**MY ANALYSIS:**
✅ **GOOD VARIETY!** Not templated
✅ But NOT BEING APPLIED (we just fixed this!)
✅ Now that formatter is deployed, this will work!

---

## SUMMARY: WHERE TEMPLATES EXIST

### ✅ **NO Template Issues:**
- Topic generation ✅ (template-free, highly varied)
- Angle generation ✅ (examples are educational, not templates)
- Tone generation ✅ (creative, unique every time)
- Format strategy ✅ (sophisticated, varied)
- Visual format ✅ (diverse, just wasn't applied)

### ❌ **HAS Template Issues:**
- Content generators ❌ (12 of 12 have rigid examples!)
  - MythBuster: "Myth: Truth:" every time
  - Coach: "1) 2) 3)" every time
  - ThoughtLeader: "[Thing] is emerging" template
  - DataNerd: "Studies show" opening
  - Etc.

---

## THE FIX: REMOVE EXAMPLES FROM GENERATORS ONLY

### **What to Change:**

**12 Content Generators:**
```javascript
// REMOVE THIS SECTION from all 12:
"Examples of good [generator] content:
• [Template 1]
• [Template 2]"

// KEEP everything else:
- Personality descriptions ✅
- Format option lists ✅
- Quality principles ✅
- "CREATE SOMETHING NEW" ✅
```

**AngleGenerator:**
```javascript
// KEEP the angle type examples:
"CULTURAL angles:
- 'Wim Hof's impact...'
- 'Bryan Johnson's protocol...'"

// Why? These teach CATEGORIES not FORMATS
// They show what cultural/media/industry angles ARE
// Not exact templates to copy
```

**TopicGenerator:**
```javascript
// Already perfect! No changes needed.
```

---

## PROPOSED CHANGE FOR EACH GENERATOR

### **Pattern for All 12:**

**BEFORE:**
```javascript
const systemPrompt = `[Personality]

[Options list]

RULES: [No first-person, etc.]

Examples of good content:  ❌ DELETE THIS!
• "Example 1"
• "Example 2"

[Quality principles]`;
```

**AFTER:**
```javascript
const systemPrompt = `[Personality]

[Options list]

🎨 CRITICAL: CREATE SOMETHING NEW EACH TIME  ✅ ADD THIS!
Pick a RANDOM approach from the list above.
Don't default to the same format repeatedly.
Experiment with different structures.

RULES: [No first-person, etc.]

[Quality principles]`;
```

**Changes:**
- ❌ Remove: "Examples of good content" section
- ✅ Add: "CREATE SOMETHING NEW" instruction
- ✅ Add: "Pick RANDOM approach" hint
- ✅ Keep: Everything else unchanged

---

## FINAL RECOMMENDATION

### **YES - Remove examples from 12 content generators**

**Don't touch:**
- ✅ TopicDiversityEngine (already perfect)
- ✅ AngleGenerator (examples are educational)
- ✅ Tone generation (working great)
- ✅ Format strategy (working great)
- ✅ Visual format (just deployed formatter!)

**Only fix:**
- ❌ 12 content generators (mythBuster, coach, dataNerd, etc.)

**Why this solves it:**

Your sophisticated system generates:
1. Unique topic ✅
2. Creative angle ✅
3. Varied tone ✅
4. Unique strategy ✅

Then passes to generator which:
5. Copies hardcoded example ❌ ← THIS KILLS EVERYTHING!

Remove step 5's templates = Your full system shines! ✨

