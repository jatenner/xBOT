# 🔧 SYSTEMATIC GENERATOR FIX

## Problem:
- Generators producing 280+ char tweets (fails validation)
- Generators using first-person (I, my, we, us) (fails sanitizer)
- Inconsistent quality across 12 generators

## Solution:
Add **UNIVERSAL NON-NEGOTIABLES** to ALL 12 generators

---

## UNIVERSAL RULES (Add to every generator):

```typescript
🚨 NON-NEGOTIABLES (SYSTEM WILL AUTO-REJECT IF VIOLATED):

1. CHARACTER LIMIT: 260 characters MAX (system rejects at 280, buffer for safety)
   - Count EVERY character including spaces, punctuation, emojis
   - If close to limit, cut the last sentence

2. ZERO FIRST-PERSON:
   - NO: I, me, my, mine, we, us, our, ours
   - NO: I've, I'm, I'll, I'd, we're, we've
   - NO: "my experience", "been trying", "who knew"
   - YES: Third-person or imperative ("Studies show", "Research finds", "Consider")

3. MAX 2 EMOJIS per tweet (0-1 is better)

4. NO BANNED PHRASES:
   - "In my opinion", "I think", "personally"
   - "game changer", "life hack", "mind blown"
   - Generic hooks: "Here's why", "Let me explain"

5. COMPLETE THOUGHTS:
   - No "..." ellipsis
   - No cut-off mid-sentence
   - Every tweet must be complete
```

---

## 12 GENERATORS TO FIX:

1. ✅ DataNerd - UPDATED
2. ⏳ ThoughtLeader
3. ⏳ Contrarian
4. ⏳ NewsReporter
5. ⏳ Storyteller
6. ⏳ MythBuster
7. ⏳ Coach
8. ⏳ Provocateur
9. ⏳ Interesting
10. ⏳ Explorer
11. ⏳ Philosopher
12. ⏳ HumanVoice (this one needs special attention - it's the fallback)

---

## Changes Per Generator:

### Add to EVERY generator prompt (line ~30-40):

```typescript
🚨 CRITICAL RULES (ENFORCED BY SYSTEM):
- Max 260 characters (count carefully!)
- Zero first-person pronouns (no I/me/my/we/us/our)
- Max 2 emojis total
- Complete thoughts only (no "...")
```

### Update max_tokens to prevent over-generation:
```typescript
max_tokens: format === 'thread' ? 600 : 100  // Reduced from 150 to 100 for singles
```

### Verify in system prompt:
Each generator should have its unique voice BUT follow universal rules.

