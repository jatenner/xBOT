/**
 * SHARED CONTENT PATTERNS
 * Single source of truth for banned phrases and required elements
 * Used by all 12 generators to ensure consistent voice and quality
 */

export const BANNED_PHRASES = [
  // First-person (CRITICAL - violates brand voice)
  'I tried',
  'I found',
  'I discovered',
  'I realized',
  'my experience',
  'worked for me',
  'my gut',
  'my journey',
  'my results',
  'for me',
  'I\'ve been',
  'been diving deep',
  
  // Vague/Generic language
  'Who knew?',
  'Turns out',
  'Just realized',
  'crazy, right?',
  'game changer',
  'game-changer',
  
  // Template/robotic language
  'Let\'s dive in',
  'dive deep',
  'Thread below',
  'Stay tuned',
  'More soon',
  'More in thread',
  'coming up',
  
  // Incomplete thoughts
  '...',
  'and more',
  'etc.',
  
  // Generic hooks without substance
  'Here\'s why', // Only banned if not followed by specifics
] as const;

export const REQUIRED_PATTERNS = {
  specificity: [
    /\d+%/,                                    // Percentages: "40% increase"
    /\d+\s*(mg|mcg|IU|g|ml|lux)/i,           // Dosages: "500mg", "10,000 lux"
    /\d+\s*(min|minute|hour|day|week|month)s?/i, // Time: "10 min", "66 days"
    /n\s*=\s*\d+/i,                           // Sample size: "n=96"
    /\b(19|20)\d{2}\b/,                       // Year: "2009", "2023"
    /\d+:\d+/,                                 // Ratios/times: "16:8", "2:1"
    /\d+-\d+/,                                 // Ranges: "18-254 days"
  ],
  mechanism: [
    /(increases|decreases|triggers|blocks|modulates|activates|inhibits|regulates)/i,
    /(pathway|receptor|neurotransmitter|hormone|enzyme|protein)/i,
    /(circadian|autophagy|metabolism|inflammation|microbiome)/i,
  ],
  evidence: [
    /\b[A-Z][a-z]+\s+et\s+al\.?/,            // "Lally et al."
    /(study|research|trial|data|evidence)\s+(shows?|reveals?|demonstrates?|indicates?|suggests?)/i,
    /(Harvard|Stanford|Mayo|Johns Hopkins|MIT|Cleveland Clinic)/i,
  ]
};

export const VOICE_GUIDELINES = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 STRICT VOICE REQUIREMENTS - MANDATORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ REQUIRED ELEMENTS:
▸ Third-person perspective ONLY - no first-person ever
▸ Specific numbers, measurements, or studies
▸ Mechanism explanation (how/why it works)
▸ Evidence-based claims with sources
▸ Actionable, concrete advice
▸ Complete sentences - no trailing "..."

❌ STRICTLY FORBIDDEN:
▸ First-person language: "I", "me", "my", "mine"
▸ Collective pronouns: "we", "us", "our", "ours" (even in phrases like "we know", "we understand")
▸ Anecdotal framing: "worked for me", "in my experience"
▸ Personal discoveries: "I found", "I tried", "I realized"
▸ Vague claims without data: "amazing results", "game changer"
▸ Generic advice everyone knows
▸ Template phrases: "Let's dive in", "Thread below", "Who knew?"
▸ Incomplete thoughts: "..." ellipsis endings
▸ Hashtags (never use #hashtags)
▸ Emojis: Maximum 2 emojis per tweet (use sparingly)
▸ **ACADEMIC CITATIONS AS HOOKS**: NEVER start with "Author et al. YEAR:" or "In YEAR, study:"
▸ **PROTOCOL FORMAT**: NEVER start with "Protocol:" or "Step 1:"

🚨 AUTO-REJECT TRIGGERS (Content will be deleted):
▸ ANY use of "we", "us", "our" in ANY context
▸ More than 2 emojis in the entire tweet/thread
▸ Any personal pronouns (I, me, my)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📏 CHARACTER LIMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ Single tweets: MAXIMUM 200 characters (optimized for viral engagement)
▸ Thread tweets: MAXIMUM 200 characters each
▸ If approaching limit, CUT WORDS, don't truncate mid-sentence

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 SPECIFICITY REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every post MUST include at least ONE:
✓ Specific measurement: "10,000 lux", "500mg", "16:8 fasting"
✓ Timeframe/range: "66 days average (18-254 range)"
✓ Percentage/ratio: "40% increase", "2-3x better"
✓ Research reference: "Harvard tracked 4,500 people", "96-person study"
✓ Mechanism pathway: "Blue light → brain clock → serotonin"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 VIRAL FORMULAS (PROVEN ENGAGEMENT PATTERNS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use these structures to maximize engagement (same formulas that work in viral replies):

CONTRARIAN EXPERT:
"Actually, latest research from [Institution] shows the opposite: [surprising finding]. [Specific stat]% of people don't realize [insight]."

AUTHORITY ADDITION:
"This aligns with [Institution] research showing [specific finding]. The mechanism involves [brief explanation]. [Stat]% improvement in studies."

CURIOSITY GAP:
"The real reason this works has to do with [physiological process]. Most people miss the [specific detail] that makes all the difference."

MYTH CORRECTION:
"Common misconception. [Institution] studies actually show [correct information]. The [specific number]% difference is significant."

INSIDER KNOWLEDGE:
"Researchers at [Institution] discovered [surprising detail] about this. The [specific mechanism] explains why [insight]."

CURIOSITY TRIGGERS (use these phrases):
✅ "The real reason..."
✅ "Most people don't realize..."
✅ "Latest research shows..."
✅ "The mechanism involves..."
✅ "Researchers discovered..."

Apply these formulas naturally within your generator's personality - don't force them, but use them when they fit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ EXAMPLES OF EXCELLENT CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GOOD: "16:8 fasting (eat 12pm-8pm) + 500mg NMN daily. Fasting triggers 
autophagy, clearing damaged cells. NMN boosts NAD+ for energy metabolism 
and DNA repair. Timing + supplementation work synergistically."
→ Specific protocol, mechanisms, no first-person, engaging

GOOD: "Habit formation takes 66 days on average (18-254 day range). University 
of London tracked 96 people—process follows logistic curve, not linear timeline. 
Consistency matters more than intensity."
→ Gives data, explains mechanism, no academic citation format

GOOD: "10,000 lux bright light within 1 hour of waking. 480nm wavelength 
hits ipRGC cells, signals SCN master clock, triggers serotonin release. 
Indoor lighting (300-500 lux) is 20x too dim."
→ Specific measurement, pathway, comparison

BAD: "I tried intermittent fasting and it worked for me! You should try 
it too. Who knew it was so effective?"
→ First-person, anecdotal, vague, banned phrases

BAD: "Fasting is great for health. Let's dive into the benefits..."
→ Generic, template language, no specifics

⛔ NEVER START WITH ACADEMIC CITATIONS:
BAD: "Lally et al. 2009 (n=96): Habit formation takes 66 days..."
BAD: "In 2011, Stanford study found that meditation improves focus..."
GOOD: "Habit formation takes 66 days on average. University of London tracked 96 people—consistency matters more than speed."
GOOD: "Stanford researchers found meditation boosts focus 43% in 8 weeks. The key: daily practice, not duration."

⛔ NEVER USE PROTOCOL FORMAT:
BAD: "Protocol: Step 1: Morning sunlight Step 2: Cold shower..."
BAD: "Optimization protocol for sleep: 1. Magnesium 2. Dark room..."
GOOD: "Morning sunlight (10,000 lux) activates cortisol, signaling wake time..."
GOOD: "Magnesium glycinate (400mg) before bed → GABA activation → 35% deeper sleep..."
`;

/**
 * Get character limit based on format and position
 */
export function getCharacterLimit(format: 'single' | 'thread', position: number = 0): number {
  if (format === 'single') {
    return 270; // Single tweet safe limit
  }
  return 250; // Thread tweet safe limit
}

/**
 * Check if content violates banned phrases
 */
export function hasBannedPhrase(content: string): { violated: boolean; phrase?: string } {
  const lowerContent = content.toLowerCase();
  
  for (const phrase of BANNED_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      return { violated: true, phrase };
    }
  }
  
  return { violated: false };
}

/**
 * Check if content has sufficient specificity
 */
export function hasSpecificity(content: string): { score: number; matches: string[]; types: number } {
  let score = 0;
  const matches: string[] = [];
  const typesFound = new Set<string>();
  
  // Check specificity patterns (measurements, percentages, etc.)
  for (const pattern of REQUIRED_PATTERNS.specificity) {
    const match = content.match(pattern);
    if (match) {
      score++;
      matches.push(match[0]);
      typesFound.add('measurement');
    }
  }
  
  // Check mechanism patterns
  for (const pattern of REQUIRED_PATTERNS.mechanism) {
    if (pattern.test(content)) {
      score++;
      matches.push('mechanism');
      typesFound.add('mechanism');
      break; // Only count once
    }
  }
  
  // Check evidence patterns (studies, citations, etc.)
  for (const pattern of REQUIRED_PATTERNS.evidence) {
    const match = content.match(pattern);
    if (match) {
      score++;
      matches.push(match[0] || 'evidence');
      typesFound.add('evidence');
      break; // Only count once
    }
  }
  
  // ENHANCED: Return number of distinct types
  return { score, matches, types: typesFound.size };
}

