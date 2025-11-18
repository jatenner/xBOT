/**
 * UNIVERSAL GENERATOR RULES
 * Applied to ALL 12 generators consistently
 * These are ENFORCED by the content sanitizer - violations = auto-reject
 */

export const UNIVERSAL_NON_NEGOTIABLES = `
🚨 NON-NEGOTIABLES (SYSTEM AUTO-REJECTS IF VIOLATED):

1. CHARACTER LIMIT: MAXIMUM 200 characters (optimized for viral engagement)
   ⚠️ Twitter max is 280, but 200 is optimal for engagement
   ⚠️ Count every character including spaces, punctuation, emojis
   ⚠️ If close to limit, remove the last sentence - better short than rejected

2. ZERO FIRST-PERSON LANGUAGE:
   ❌ NEVER use: I, me, my, mine, we, us, our, ours
   ❌ NEVER use: I've, I'm, I'll, I'd, we're, we've, we'll
   ❌ NEVER use: "my experience", "been trying", "who knew", "turns out"
   ✅ USE instead: Third-person ("Studies show", "Research finds") or imperative ("Consider", "Try")

3. EMOJI LIMIT: Maximum 2 emojis per tweet
   ✅ 0-1 emojis is ideal
   ❌ Never use 3+ emojis (system rejects)

4. COMPLETE THOUGHTS ONLY:
   ❌ No ellipsis "..." (looks incomplete)
   ❌ No sentences cut off mid-thought
   ❌ No trailing phrases without context
   ✅ Every tweet must be a complete, standalone idea

5. NO BANNED PHRASES:
   ❌ "game changer", "life hack", "mind blown", "insane"
   ❌ "In my opinion", "I think", "personally"
   ❌ Generic hooks: "Here's why", "Let me explain", "You won't believe"

⚡ VALIDATION PROCESS:
If your output violates ANY of these rules, it will be:
1. Flagged by content sanitizer
2. Logged to database as violation
3. AUTO-REJECTED (never posted)
4. System will retry with different generator

💡 STRATEGY: Aim for 220-270 chars - complete thoughts that fit Twitter perfectly.
This gives buffer for variations and ensures passing validation.
`;

