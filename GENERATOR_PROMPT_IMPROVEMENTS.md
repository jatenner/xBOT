# 🎯 **SYSTEMATIC GENERATOR PROMPT IMPROVEMENTS**

**Goal:** Remove ALL generic crap. Make prompts hyper-specific, actionable, data-driven.

---

## **❌ WHAT IS "GENERIC CRAP"?**

### **Generic (Vague, Useless):**
```
❌ "Make it interesting"
❌ "Be engaging"
❌ "Sound human"
❌ "Add value"
❌ "Be authentic"
❌ "Make people care"
❌ "Write good content"
❌ "Be compelling"
```

### **Specific (Actionable, Testable):**
```
✅ "Start with a number that contradicts common belief"
✅ "Include 2+ specific measurements (temps, dosages, timeframes)"
✅ "Explain the biological mechanism in < 15 words"
✅ "End with a 1-sentence reframe that makes reader rethink"
✅ "Use contrasts: 'Not X. Not Y. Just Z.'"
✅ "Include a real person, place, or study with year"
```

---

## **🔧 SPECIFIC IMPROVEMENTS FOR EACH GENERATOR**

### **1. DataNerd - Current Issues:**

**Generic parts:**
- "Make statistics interesting" ← HOW?
- "Add context" ← WHAT context?
- "Be specific" ← HOW specific?

**Improved specificity:**
```typescript
// ❌ OLD:
"Share surprising data with context"

// ✅ NEW:
"MANDATORY STRUCTURE:
1. Opening: Specific number that challenges belief
   Example: '8,000 steps, not 10,000' or '66 days, not 21 days'

2. Source: Institution + year (no 'et al.')
   Example: 'Harvard 2022' or 'Stanford tracked 4,500 people'

3. Mechanism: WHY it works (< 20 words)
   Example: 'Blue light → retinal cells → circadian clock → melatonin suppression'

4. Practical implication: What to DO differently
   Example: 'Eat within 12pm-8pm, not 8am-8pm'

5. Memorable closer: Reframe the concept
   Example: 'It's not about eating less. It's about eating when.'

FAIL CRITERIA (auto-reject):
- No specific number in first sentence
- No source/year mentioned
- No mechanism explanation
- Ends with question instead of insight
- Uses phrases: 'studies show', 'research suggests', 'experts say'
"
```

---

### **2. Coach - Current Issues:**

**Generic parts:**
- "Give actionable advice" ← Not specific enough
- "Be practical" ← Define practical

**Improved specificity:**
```typescript
// ❌ OLD:
"Give specific, actionable protocols"

// ✅ NEW:
"PROTOCOL REQUIREMENTS (all must be present):

1. EXACT MEASUREMENT:
   ✅ '30g protein' NOT '❌ high protein'
   ✅ '65-68°F' NOT ❌ 'cool room'
   ✅ '11 minutes weekly' NOT ❌ 'regular cold exposure'

2. EXACT TIMING:
   ✅ 'within 30 minutes of waking' NOT ❌ 'in the morning'
   ✅ '2 hours before bed' NOT ❌ 'before sleep'
   ✅ '16:8 window (12pm-8pm)' NOT ❌ 'intermittent fasting'

3. TESTABLE THRESHOLD:
   ✅ 'Can barely hold conversation' NOT ❌ 'moderate intensity'
   ✅ 'Heart rate 60-70% max' NOT ❌ 'comfortable pace'
   ✅ 'Until slight shiver (11-13°C)' NOT ❌ 'cold enough'

4. WHAT NOT TO DO:
   ✅ 'Not 72-75°F (too warm)' - show the common mistake
   ✅ 'Not lukewarm showers' - explain why threshold matters

STRUCTURE ENFORCEMENT:
- First sentence: The exact protocol with numbers
- Second sentence: Why it works (mechanism)
- Third sentence: Common mistake people make
- Fourth sentence: How to know it's working

NO LISTS with ✅ emojis unless timeframe is specified.
NO 'try to' or 'aim for' - give exact specs.
"
```

---

### **3. Philosopher - Current Issues:**

**Generic parts:**
- "Be profound" ← Subjective
- "State deep truths" ← Vague

**Improved specificity:**
```typescript
// ❌ OLD:
"State simple deep truths"

// ✅ NEW:
"PHILOSOPHICAL INSIGHT FORMULA:

1. UNIVERSAL OBSERVATION (what everyone experiences):
   Format: 'Your [X] is the only [Y] you're guaranteed...'
   Example: 'Your body is the only place you're guaranteed to live'
   
2. CONTRAST (what most people do vs what makes sense):
   Format: 'Most people treat it like [BAD]. [Should be GOOD].'
   Example: 'Most people treat it like a rental. Treat it like a home.'

3. MECHANISM/REASON (the underlying why):
   Format: 'Because [biological/logical truth]'
   Example: 'Because consistency compounds, effort doesn't'

STRUCTURAL REQUIREMENTS:
- Max 3 sentences (profound = concise)
- No questions (insights, not prompts)
- No metaphors without practical implication
- Must reveal a hidden truth, not state obvious fact

TEST: Would Naval Ravikant or Derek Sivers tweet this?
If it sounds like a fortune cookie or Instagram quote → reject.
"
```

---

### **4. Contrarian - Current Issues:**

**Generic parts:**
- "Challenge conventional wisdom" ← Which wisdom? How?
- "Make people think" ← About what specifically?

**Improved specificity:**
```typescript
// ❌ OLD:
"Challenge conventional wisdom with data"

// ✅ NEW:
"CONTRARIAN STRUCTURE (mandatory):

1. SETUP: State what everyone believes
   Format: 'Everyone [does/thinks X]'
   Example: 'Everyone optimizes their morning routine'

2. CHALLENGE: Show why it's backwards
   Format: 'Nobody asks [the real problem]'
   Example: 'Nobody asks why they need 2 hours of hacks to feel normal'

3. DATA/MECHANISM: Prove the contrarian view
   Format: '[Specific data] shows [surprising truth]'
   Example: 'Sleep debt (< 6hrs) matters 10x more than screen time'

4. REFRAME: Give the correct mental model
   Format: 'It's not about [X]. It's about [Y].'
   Example: 'It's not about morning routines. It's about evening routines.'

SPECIFIC CONTRARIAN ANGLES (rotate these):
- Common practice is backwards (cold doesn't work because of temperature, works because of nervous system training)
- Optimization is the problem (over-optimizing sleep → orthosomnia)
- We're solving the wrong equation (gym for weight loss → kitchen for weight loss)
- Time/timing is inverted (eat when metabolically ready, not by clock)
- The constraint is elsewhere (not willpower, sleep debt)

FAIL IF:
- Just says 'hot take' without supporting data
- Contrarian for shock value (no mechanism)
- Challenges science without proof
"
```

---

### **5. MythBuster - Current Issues:**

**Generic parts:**
- "Bust myths" ← Which myths? How to identify?
- "Show what's true" ← Not specific enough

**Improved specificity:**
```typescript
// ❌ OLD:
"Show what's wrong, what's true, and WHY"

// ✅ NEW:
"MYTH-BUSTING FORMULA:

1. STATE THE MYTH (exact popular belief):
   Format: 'Myth: "[Exact quote people believe]"'
   Example: 'Myth: "Your metabolism slows because you age"'
   NOT: 'People think metabolism slows' (too vague)

2. PRESENT THE DATA (specific study contradicting it):
   Format: '[Institution] tracked [#] people ([year]): [finding]'
   Example: 'Study of 6,400 people (Science, 2021): metabolism stable age 20-60'
   NOT: 'Studies show otherwise' (useless)

3. REVEAL THE REAL CAUSE (what actually explains the phenomenon):
   Format: 'What [actually causes X]: [List of real factors]'
   Example: 'What slows: Movement. Muscle mass. Protein intake. Sleep.'
   NOT: 'Other factors' (be specific)

4. REFRAME THE MENTAL MODEL (change how they think):
   Format: 'Your [X] didn't [Y]. Your [Z] did.'
   Example: 'Your metabolism didn't quit. Your habits did.'

COMMON MYTHS TO TARGET:
- Metabolism slows with age
- Blue light ruins sleep (duration matters more)
- Stretching prevents injuries (strength through ROM does)
- Eating before bed ruins sleep (opposite - stabilizes blood sugar)
- More cardio = more fat loss (Zone 2 burns more fat than Zone 4)
- 21 days to form habit (actually 66 days average, 18-254 range)

FAIL IF:
- Myth isn't something majority believes
- No specific counter-data
- Doesn't explain WHY myth is wrong
"
```

---

### **6. NewsReporter - Current Issues:**

**Generic parts:**
- "Cover events" ← Which events? How?
- "Be timely" ← Vague

**Improved specificity:**
```typescript
// ❌ OLD:
"Cover news events and launches"

// ✅ NEW:
"NEWS COVERAGE FORMULA:

1. URGENCY SIGNAL (timestamp/newness):
   Format: '🚨 [Time marker]: [Event]'
   Examples:
   - '🚨 Published today in JAMA:'
   - '🚨 Just announced:'
   - '🚨 Now available:'
   NOT: 'Recently' or 'New study' without specifics

2. THE CONCRETE FINDING (specific, quotable):
   Format: '[Exact number/claim]'
   Example: '8,000 steps a day cuts risk of early death by 51%'
   NOT: 'Walking helps longevity' (too vague)

3. CONTRAST WITH EXPECTATION (myth vs reality):
   Format: 'Not [X]. Not [Y]. Just [Z].'
   Example: 'Not 10,000. Not marathon training. Just ~60 minutes of walking.'
   This makes it newsworthy (challenges belief)

4. SOURCE CITATION (simple, readable):
   Format: 'Published [timeframe] in [Journal/Institution]'
   Example: 'Published today in JAMA Network Open'
   NOT: 'Smith et al., 2024, Journal of...'

5. MEMORABLE REFRAME (the headline insight):
   Format: 'The [X] isn't [expected]. It's [surprising].'
   Example: 'The headline isn't "fitness influencer secret." It's "your neighborhood sidewalk is free medicine."'

WHAT QUALIFIES AS NEWS:
✅ Product launches (Ozempic at CVS, new CGM device)
✅ Official statements (FDA approves, CDC warns, Surgeon General says)
✅ Regulatory decisions (ban, recall, approval)
✅ Breaking studies (published this week)
❌ General health advice (not newsworthy)
❌ Evergreen content (not timely)

FAIL IF:
- No timestamp/freshness signal
- No specific number/claim
- Sounds like a blog post, not news
"
```

---

## **🎯 IMPLEMENTATION PRIORITY**

### **Phase 1: Remove all generic phrases**
Search and destroy:
- "Be interesting" → Replace with specific structure
- "Add value" → Replace with measurable criteria
- "Sound human" → Replace with specific voice patterns
- "Be engaging" → Replace with engagement formulas

### **Phase 2: Add mandatory structure**
Every generator needs:
1. Opening requirement (specific format)
2. Body requirement (what must be included)
3. Closing requirement (how to end)
4. Fail criteria (what triggers rejection)

### **Phase 3: Add testable criteria**
Replace subjective with objective:
- ❌ "Make it compelling" → ✅ "Include 2+ numbers in first 2 sentences"
- ❌ "Be authentic" → ✅ "No phrases: 'studies show', 'research suggests', 'I think'"
- ❌ "Add context" → ✅ "Explain mechanism in < 20 words"

---

**Ready to implement these improvements to all 12 generators?**

