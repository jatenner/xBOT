/**
 * 🎯 DEPTH REQUIREMENTS - Shared across all generators
 * 
 * Ensures all content has substance, depth, and interest - not just headline comments
 */

export const DEPTH_REQUIREMENTS_PROMPT = `
🎯 DEPTH & SUBSTANCE MANDATE (CRITICAL):
Your content must be INTERESTING and SUBSTANTIVE, not just headline comments.

REQUIRED ELEMENTS FOR DEPTH:

1. MECHANISM EXPLANATION (Required):
   ✅ "Cortisol spikes at 6am, blocking melatonin receptors → delays sleep onset by 2-3 hours"
   ❌ "Stress affects sleep" (too vague - no mechanism)

2. SPECIFIC CONTEXT (Required):
   ✅ "Night shift workers: Your circadian rhythm is 6-8 hours off. This is why you feel tired at 3pm even after 8 hours sleep."
   ❌ "Sleep is important" (too generic - no context)

3. SURPRISING INSIGHT (Required):
   ✅ "The real reason you can't sleep isn't caffeine - it's light exposure 2 hours before bed. Even dim light suppresses melatonin by 50%."
   ❌ "Avoid screens before bed" (too obvious - no surprise)

4. REAL-WORLD EXAMPLE (Encouraged):
   ✅ "I tracked my sleep for 90 days. Nights I used my phone after 9pm, I woke up 3x more often. The mechanism? Blue light hits ipRGC cells → signals SCN → delays melatonin."
   ❌ "Studies show screens affect sleep" (no personal connection)

5. UNIQUE CONNECTION (Encouraged):
   ✅ "What military sleep protocols teach us: The 2-minute sleep technique works because it activates parasympathetic nervous system, not because you 'try harder'."
   ❌ "Try meditation for sleep" (generic advice)

DEPTH CHECKLIST (Must have 3+ of these):
- [ ] Mechanism explanation (HOW/WHY it works)
- [ ] Specific context (WHO/WHEN it matters)
- [ ] Surprising insight (non-obvious fact)
- [ ] Real-world example (case study, personal, relatable)
- [ ] Unique connection (unexpected domain, hidden link)
- [ ] Storytelling element (narrative, memorable)

🚫 FORBIDDEN PATTERNS (AUTO-REJECT):
- "Research shows..." without mechanism or specific study
- "Most people think..." without surprising counterpoint
- "Here's why..." without depth or substance
- Generic advice anyone could give
- Headline-style content without explanation
- Lists without context or depth

If your content is just stating facts without depth, it will be REJECTED.
`;

export const DEPTH_EXAMPLES = {
  good: [
    "Night shift workers: Your circadian rhythm is 6-8 hours off. This is why you feel tired at 3pm even after 8 hours sleep. The mechanism? Cortisol spikes at 6am, blocking melatonin receptors → delays sleep onset by 2-3 hours.",
    "I tracked my sleep for 90 days. Nights I used my phone after 9pm, I woke up 3x more often. The real reason? Blue light hits ipRGC cells → signals SCN → delays melatonin by 2-3 hours. Even dim light suppresses it by 50%.",
    "What military sleep protocols teach us: The 2-minute sleep technique works because it activates parasympathetic nervous system, not because you 'try harder'. This is why it works for 90% of people who try it."
  ],
  bad: [
    "Research shows sleep is important",
    "Most people don't get enough sleep",
    "Here's why sleep matters",
    "Avoid screens before bed"
  ]
};




