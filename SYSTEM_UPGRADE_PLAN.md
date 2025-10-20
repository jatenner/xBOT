# 🚀 **SYSTEM UPGRADE PLAN - Way Better Content**

**Goal:** Generate tweets at the quality level of your baseline examples  
**Timeline:** Implement in order, test each phase  
**Result:** 2 tweets/day, all 12 personas rotated, baseline quality or better

---

## **PHASE 1: FIX POSTING RATE (CRITICAL)**

### **Current Problem:**
```
Config says: MAX_POSTS_PER_HOUR = 2
System tries: 2 posts per HOUR = 48 posts/day ❌
You want: 2 posts per DAY ✅
```

### **Fix:**
```typescript
// src/config/config.ts or Railway variables
MAX_POSTS_PER_HOUR = 2  // Keep this
POSTS_PER_DAY = 2        // Add this
JOBS_PLAN_INTERVAL_MIN = 720  // 12 hours (2x per day)

// Or simpler:
JOBS_PLAN_INTERVAL_MIN = 720  // Generate content every 12 hours
MAX_POSTS_PER_HOUR = 1        // Allow 1 post per attempt
```

### **Why:**
- Current: Generates content every 30 minutes = 48 opportunities/day
- Fixed: Generates content every 12 hours = 2 opportunities/day
- Each generation creates 1 post → 2 posts/day

---

## **PHASE 2: UPDATE GENERATOR PROMPTS (CRITICAL)**

### **What to Change:**
Replace ALL examples in generator prompts with your baseline examples.

### **Files to Update:**
1. `src/generators/humanVoiceEngine.ts`
2. `src/generators/newsReporterGenerator.ts`
3. `src/generators/storytellerGenerator.ts`
4. `src/generators/interestingContentGenerator.ts`
5. `src/generators/provocateurGenerator.ts`
6. `src/generators/dataNerdGenerator.ts`
7. `src/generators/mythBusterGenerator.ts`
8. `src/generators/coachGenerator.ts`
9. `src/generators/thoughtLeaderGenerator.ts`
10. `src/generators/contrarianGenerator.ts`
11. `src/generators/explorerGenerator.ts`
12. `src/generators/philosopherGenerator.ts`

### **Pattern:**
```typescript
// ❌ OLD EXAMPLES (remove these):
"Harvard 2020 (n=4,521): Each hour of sleep debt..."
"Lally et al. 2009 (n=96): Average 66 days..."

// ✅ NEW EXAMPLES (use these):
"People who sleep less than 6 hours have a 200% higher risk..."
"A study of 6,400 people (Science, 2021) found metabolism stays stable..."
```

### **Primary Example for Each Generator:**
Copy EXACT text from `BASELINE_EXAMPLES.md` into each generator's prompt.

---

## **PHASE 3: IMPROVE ROTATION LOGIC**

### **Current System:**
```typescript
// Exploration mode: Equal weights, avoid last 3
// Exploitation mode: Use learned weights
```

### **Enhancement: "Last Used" Tracking**
```typescript
// Track WHEN each generator was last used
// Boost generators that haven't been used in a while

interface GeneratorStats {
  name: string;
  weight: number;
  lastUsed: Date | null;
  timesUsed: number;
}

// In selection logic:
function adjustWeightsForRecency(weights: Record<string, number>): Record<string, number> {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  for (const [gen, lastUsed] of Object.entries(lastUsedTimes)) {
    if (lastUsed) {
      const hoursSince = (now - lastUsed.getTime()) / (1000 * 60 * 60);
      
      if (hoursSince > 24) {
        // Haven't used in 24+ hours → 3x boost
        weights[gen] *= 3;
      } else if (hoursSince > 12) {
        // Haven't used in 12+ hours → 2x boost
        weights[gen] *= 2;
      }
    }
  }
  
  return weights;
}
```

### **Enhancement: "Persona Variety" Target**
```typescript
// Goal: Use all 12 personas within 7 days

// Track usage over last 7 days
const usageLastWeek = getGeneratorUsage(7); // { DataNerd: 3, Coach: 2, ... }

// Find underused personas
const underused = Object.entries(usageLastWeek)
  .filter(([gen, count]) => count === 0)
  .map(([gen]) => gen);

// If posting now, boost underused personas
if (underused.length > 0) {
  for (const gen of underused) {
    weights[gen] *= 5; // 5x boost for unused personas
  }
}
```

---

## **PHASE 4: ADD QUALITY GATE SPECIFIC TO EXAMPLES**

### **New Validation: "Baseline Quality Check"**
```typescript
function validateAgainstBaseline(content: string, persona: string): {
  passes: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;
  
  // Check 1: No academic citations
  if (content.match(/et al\.|n=\d+/)) {
    issues.push('Contains academic citation format');
    score -= 30;
  }
  
  // Check 2: Has specific numbers
  const hasNumbers = content.match(/\d+/);
  if (!hasNumbers) {
    issues.push('Missing specific numbers/data');
    score -= 20;
  }
  
  // Check 3: Has emotional/memorable element
  const emotionalWords = ['feel', 'heart', 'care', 'matter', 'change', 'transform'];
  const hasEmotion = emotionalWords.some(word => content.toLowerCase().includes(word));
  if (!hasEmotion) {
    issues.push('Lacks emotional resonance');
    score -= 20;
  }
  
  // Check 4: Has concrete examples (names, places, specific actions)
  const hasConcretes = content.match(/\b[A-Z][a-z]+\b/) && // Proper nouns
                       content.match(/\d+\s+(minute|step|hour|day)/); // Specific actions
  if (!hasConcretes) {
    issues.push('Lacks concrete examples');
    score -= 15;
  }
  
  // Check 5: Has strong closing
  const lines = content.split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1];
  if (lastLine && lastLine.length < 20) {
    // Good - short punchy closing
  } else if (lastLine && lastLine.length > 100) {
    issues.push('Weak closing (too long)');
    score -= 15;
  }
  
  return {
    passes: score >= 70,
    score,
    issues
  };
}
```

---

## **PHASE 5: IMPLEMENT "FLOW" SYSTEM**

### **What is Flow?**
Consecutive tweets that complement each other, not repeat.

### **Anti-Patterns to Avoid:**
```
❌ DataNerd → DataNerd → DataNerd (3 data dumps in a row)
❌ Provocateur → Provocateur (2 questions in a row)
❌ NewsReporter → NewsReporter (2 news items in a row)
```

### **Flow Rules:**
```typescript
const FLOW_RULES = {
  // After DataNerd (heavy data), use:
  DataNerd: ['Philosopher', 'HumanVoice', 'Storyteller'], // Something human
  
  // After Provocateur (questions), use:
  Provocateur: ['Coach', 'MythBuster', 'DataNerd'], // Something with answers
  
  // After NewsReporter (event-driven), use:
  NewsReporter: ['ThoughtLeader', 'Contrarian'], // Something analytical
  
  // After Storyteller (narrative), use:
  Storyteller: ['Provocateur', 'Philosopher'], // Something reflective
  
  // After Coach (actionable), use:
  Coach: ['DataNerd', 'MythBuster'], // Something that explains WHY
  
  // After Philosopher (abstract), use:
  Philosopher: ['Coach', 'InterestingContent'], // Something concrete
  
  // ... etc for all 12
};

function selectNextGenerator(lastGenerator: string, weights: Record<string, number>) {
  const preferred = FLOW_RULES[lastGenerator] || [];
  
  // Boost preferred generators for better flow
  for (const gen of preferred) {
    if (weights[gen]) {
      weights[gen] *= 2; // 2x boost for good flow
    }
  }
  
  return weightedRandom(weights);
}
```

---

## **PHASE 6: ENHANCE EACH GENERATOR WITH BASELINE EXAMPLE**

### **Implementation Pattern:**
```typescript
// Example: src/generators/dataNerdGenerator.ts

const systemPrompt = `You are the DATA NERD persona.

YOUR GOLD STANDARD EXAMPLE (match this quality):
"Want a stat that'll change your bedtime tonight?
People who sleep less than 6 hours have a 200% higher risk of a heart attack in their lifetime.
Study: European Heart Journal, 2023.
No supplement on Earth fixes what chronic sleep steals."

WHAT MAKES THIS EXCELLENT:
✅ Hook question (change your bedtime tonight)
✅ Shocking stat (200% higher risk)
✅ Simple source format (European Heart Journal, 2023)
✅ Powerful closing (what sleep steals)

YOUR JOB: Create content at this level or better.

STRICT RULES:
❌ NO "et al." or "(n=X)" in main text
❌ NO academic citation format
✅ Source format: "Study: [Journal], [Year]" or "[Institution] tracked [number] people"
✅ Specific numbers (8,000 steps, 200% risk, 6 hours)
✅ Memorable closing line
✅ < 280 characters

Generate content now:`;
```

### **Do This For All 12 Generators:**
Each gets its EXACT baseline example as the primary reference.

---

## **IMPLEMENTATION CHECKLIST**

### **Week 1: Critical Fixes**
- [ ] Fix posting rate (2/day not 2/hour)
- [ ] Update DataNerd generator with baseline example
- [ ] Update Philosopher generator with baseline example
- [ ] Update Coach generator with baseline example
- [ ] Deploy and test (3 days, 6 posts)

### **Week 2: All Generators**
- [ ] Update remaining 9 generators with baseline examples
- [ ] Add baseline quality validation
- [ ] Deploy and test (7 days, 14 posts)

### **Week 3: Flow & Rotation**
- [ ] Add "last used" tracking
- [ ] Implement flow rules
- [ ] Add variety target (all 12 in 7 days)
- [ ] Deploy and monitor

### **Week 4: Optimization**
- [ ] Analyze which personas perform best
- [ ] Adjust weights based on engagement
- [ ] Fine-tune flow rules
- [ ] Document winning patterns

---

## **SUCCESS METRICS**

### **Quality Metrics:**
- ✅ 0% tweets with "et al." or "(n=X)"
- ✅ 100% tweets with specific numbers
- ✅ 80%+ tweets match baseline quality
- ✅ 90%+ pass content sanitizer

### **Variety Metrics:**
- ✅ All 12 personas used in 7-day period
- ✅ No persona used 3+ times in a row
- ✅ Good flow (varied energy/tone)

### **Engagement Metrics:**
- ✅ Increasing likes per tweet
- ✅ Increasing follower growth rate
- ✅ Learning system has 10+ outcomes/week

---

**Start with Phase 1 (posting rate) and Phase 2 (update 3 generators as test).  
Deploy, monitor, then roll out to all 12.**

