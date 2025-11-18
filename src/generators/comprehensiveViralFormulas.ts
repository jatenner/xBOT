/**
 * 🔥 COMPREHENSIVE VIRAL FORMULAS SYSTEM
 * 
 * Expanded viral formulas for all 22 generators
 * Based on proven patterns from viral replies (10K-100K views)
 * Plus generator-specific formulas tailored to each personality
 */

export interface ViralFormula {
  name: string;
  structure: string;
  example: string;
  bestFor: string[];
  engagementScore: number; // 1-10
}

/**
 * BASE VIRAL FORMULAS (Universal - work for all generators)
 */
export const BASE_VIRAL_FORMULAS: ViralFormula[] = [
  {
    name: 'CONTRARIAN EXPERT',
    structure: 'Actually, latest research from [Institution] shows the opposite: [surprising finding]. [Specific stat]% of people don\'t realize [insight].',
    example: 'Actually, latest research from Stanford shows the opposite: cold exposure before bed improves sleep. 73% of people don\'t realize the timing matters more than duration.',
    bestFor: ['contrarian', 'provocateur', 'mythBuster', 'investigator'],
    engagementScore: 9
  },
  {
    name: 'AUTHORITY ADDITION',
    structure: 'This aligns with [Institution] research showing [specific finding]. The mechanism involves [brief explanation]. [Stat]% improvement in studies.',
    example: 'This aligns with Harvard research showing morning light boosts dopamine 200%. The mechanism involves ipRGC cells signaling the SCN. 40% improvement in mood studies.',
    bestFor: ['dataNerd', 'newsReporter', 'investigator', 'thoughtLeader'],
    engagementScore: 8
  },
  {
    name: 'CURIOSITY GAP',
    structure: 'The real reason this works has to do with [physiological process]. Most people miss the [specific detail] that makes all the difference.',
    example: 'The real reason this works has to do with vagal tone activation. Most people miss the 5-minute breathing window that makes all the difference.',
    bestFor: ['explorer', 'connector', 'philosopher', 'patternFinder'],
    engagementScore: 9
  },
  {
    name: 'MYTH CORRECTION',
    structure: 'Common misconception. [Institution] studies actually show [correct information]. The [specific number]% difference is significant.',
    example: 'Common misconception. Mayo Clinic studies actually show 8 glasses of water is unnecessary. The 40% hydration difference is significant.',
    bestFor: ['mythBuster', 'contrarian', 'investigator', 'teacher'],
    engagementScore: 8
  },
  {
    name: 'INSIDER KNOWLEDGE',
    structure: 'Researchers at [Institution] discovered [surprising detail] about this. The [specific mechanism] explains why [insight].',
    example: 'Researchers at MIT discovered circadian proteins peak at 2pm, not morning. The CLOCK gene mechanism explains why afternoon naps work better.',
    bestFor: ['dataNerd', 'investigator', 'thoughtLeader', 'newsReporter'],
    engagementScore: 8
  },
  {
    name: 'SHOCKING STATISTIC',
    structure: '[Percentage]% of people [common behavior] but [surprising fact]. The reason: [mechanism]. What to do instead: [action].',
    example: '87% of people skip breakfast but feel more energy. The reason: cortisol peaks naturally at 8am. What to do instead: wait 2 hours after waking.',
    bestFor: ['dataNerd', 'provocateur', 'contrarian', 'coach'],
    engagementScore: 9
  },
  {
    name: 'HIDDEN MECHANISM',
    structure: 'The [specific process] most people ignore: [mechanism]. This explains why [common problem] happens. The fix: [solution].',
    example: 'The magnesium recycling most people ignore: requires B6 cofactor. This explains why supplements fail. The fix: take with 50mg B6.',
    bestFor: ['explorer', 'connector', 'investigator', 'patternFinder'],
    engagementScore: 8
  },
  {
    name: 'TIMING SECRET',
    structure: '[Action] works 3x better when done at [specific time]. The [mechanism] peaks then. Most people do it [wrong time] and miss [benefit].',
    example: 'Protein works 3x better when taken within 30min of waking. The mTOR pathway peaks then. Most people do it at lunch and miss muscle synthesis.',
    bestFor: ['coach', 'pragmatist', 'experimenter', 'teacher'],
    engagementScore: 8
  },
  {
    name: 'COST COMPARISON',
    structure: '[Expensive solution] costs $[X] but [cheap alternative] does the same for $[Y]. The [mechanism] is identical. Save [amount] by [action].',
    example: 'NMN costs $100/month but niacin does the same for $5. The NAD+ pathway is identical. Save $95 by taking 500mg niacin with flush.',
    bestFor: ['pragmatist', 'contrarian', 'coach', 'investigator'],
    engagementScore: 7
  },
  {
    name: 'ELITE SECRET',
    structure: 'Top [profession/group] use [specific protocol]. The [mechanism] gives them [advantage]. Here\'s how to replicate: [steps].',
    example: 'Top athletes use cold exposure at 11°C for 11min. The hormetic stress gives them 40% faster recovery. Here\'s how to replicate: start at 15°C, work down.',
    bestFor: ['coach', 'thoughtLeader', 'experimenter', 'dataNerd'],
    engagementScore: 9
  },
  {
    name: 'FAILURE PATTERN',
    structure: '[Common approach] fails because [reason]. The [mechanism] requires [missing piece]. Do this instead: [correct approach].',
    example: 'Intermittent fasting fails because cortisol spikes. The glucose mechanism requires protein at 8am. Do this instead: eat 30g protein, then fast.',
    bestFor: ['mythBuster', 'contrarian', 'coach', 'pragmatist'],
    engagementScore: 8
  },
  {
    name: 'SYNERGY DISCOVERY',
    structure: '[Thing A] + [Thing B] = [multiplier]x better results. The [mechanism] creates [synergy effect]. Most people do them separately.',
    example: 'Magnesium + B6 + Zinc = 3x better sleep. The GABA synthesis mechanism creates cofactor synergy. Most people do them separately.',
    bestFor: ['connector', 'explorer', 'patternFinder', 'investigator'],
    engagementScore: 8
  },
  {
    name: 'DOSE DEPENDENCY',
    structure: '[Common dose] does nothing, but [specific dose] works. The [mechanism] needs [threshold]. Most supplements are underdosed by [percentage].',
    example: '200mg magnesium does nothing, but 400mg works. The NMDA receptor mechanism needs saturation. Most supplements are underdosed by 50%.',
    bestFor: ['dataNerd', 'investigator', 'experimenter', 'pragmatist'],
    engagementScore: 7
  },
  {
    name: 'TIMING REVELATION',
    structure: 'Doing [action] at [wrong time] blocks [benefit]. The [mechanism] is time-sensitive. Switch to [correct time] for [improvement]% boost.',
    example: 'Doing cardio at night blocks deep sleep. The cortisol mechanism is time-sensitive. Switch to morning for 35% sleep improvement.',
    bestFor: ['coach', 'pragmatist', 'experimenter', 'teacher'],
    engagementScore: 8
  },
  {
    name: 'BIOAVAILABILITY HACK',
    structure: '[Supplement] has [low]% absorption alone but [high]% with [cofactor]. The [mechanism] requires [cofactor] for activation. Take together.',
    example: 'Curcumin has 1% absorption alone but 20% with piperine. The liver metabolism mechanism requires piperine for activation. Take together.',
    bestFor: ['investigator', 'dataNerd', 'connector', 'experimenter'],
    engagementScore: 7
  }
];

/**
 * GENERATOR-SPECIFIC VIRAL FORMULAS
 * Tailored to each generator's personality and voice
 */
export const GENERATOR_SPECIFIC_FORMULAS: Record<string, ViralFormula[]> = {
  // PROVOCATEUR: Bold questions that challenge assumptions
  provocateur: [
    {
      name: 'INDUSTRY CHALLENGE',
      structure: 'Why does [industry] push [common advice] when [research] shows [truth]? The [incentive] explains it. Here\'s what actually works: [solution].',
      example: 'Why does Big Pharma push statins when research shows inflammation causes heart disease? The $20B revenue explains it. Here\'s what actually works: fix insulin resistance.',
      bestFor: ['provocateur'],
      engagementScore: 10
    },
    {
      name: 'UNCOMFORTABLE QUESTION',
      structure: 'What if [common belief] is backwards? [Research] suggests [opposite]. The [mechanism] points to [truth]. Why isn\'t this mainstream?',
      example: 'What if breakfast is backwards? Research suggests fasting until noon. The insulin mechanism points to better glucose control. Why isn\'t this mainstream?',
      bestFor: ['provocateur'],
      engagementScore: 9
    }
  ],

  // DATA NERD: Numbers, statistics, research
  dataNerd: [
    {
      name: 'META-ANALYSIS INSIGHT',
      structure: '[Number] studies, [total participants] people: [finding]. The [statistic]% effect size is significant. Here\'s what this means: [implication].',
      example: '47 studies, 12,000 people: morning light improves mood. The 23% effect size is significant. Here\'s what this means: 10min at sunrise = antidepressant effect.',
      bestFor: ['dataNerd'],
      engagementScore: 9
    },
    {
      name: 'EFFECT SIZE COMPARISON',
      structure: '[Intervention A] improves [metric] by [X]%. [Intervention B] improves by [Y]%. The [mechanism] explains the [difference]x gap.',
      example: 'Exercise improves sleep by 15%. Morning light improves by 40%. The circadian mechanism explains the 2.6x gap.',
      bestFor: ['dataNerd'],
      engagementScore: 8
    }
  ],

  // MYTH BUSTER: Correcting misconceptions
  mythBuster: [
    {
      name: 'POPULAR MYTH DEBUNK',
      structure: 'Myth: "[common belief]". Reality: [research] shows [truth]. The [percentage]% of people believe this because [reason]. Here\'s the science: [evidence].',
      example: 'Myth: "8 glasses of water daily". Reality: research shows hydration needs vary. The 90% of people believe this because marketing. Here\'s the science: urine color is the real indicator.',
      bestFor: ['mythBuster'],
      engagementScore: 9
    },
    {
      name: 'BACKWARDS LOGIC',
      structure: 'Everyone thinks [X] causes [Y], but it\'s actually [Z] causing [X]. The [mechanism] works in reverse. Here\'s the proof: [evidence].',
      example: 'Everyone thinks stress causes insomnia, but it\'s actually poor sleep causing stress. The cortisol mechanism works in reverse. Here\'s the proof: fix sleep first, stress drops 40%.',
      bestFor: ['mythBuster'],
      engagementScore: 9
    }
  ],

  // CONTRARIAN: Opposite takes
  contrarian: [
    {
      name: 'OPPOSITE TAKE',
      structure: 'Everyone says [common advice]. Do the opposite: [contrarian action]. The [mechanism] works better this way. Here\'s why: [reason].',
      example: 'Everyone says eat every 3 hours. Do the opposite: fast 16 hours. The insulin mechanism works better this way. Here\'s why: constant eating keeps insulin high.',
      bestFor: ['contrarian'],
      engagementScore: 9
    }
  ],

  // COACH: Practical, actionable
  coach: [
    {
      name: 'SIMPLE PROTOCOL',
      structure: '[Timeframe] protocol: [Step 1] + [Step 2] + [Step 3] = [Result]. The [mechanism] creates [benefit]. Start today: [first step].',
      example: '30-day protocol: Morning light + 30g protein + 7h sleep = 40% energy boost. The circadian mechanism creates metabolic alignment. Start today: 10min outside at sunrise.',
      bestFor: ['coach'],
      engagementScore: 9
    },
    {
      name: 'HABIT STACK',
      structure: 'Instead of [hard habit], stack [easy habit] + [medium habit]. The [mechanism] makes it stick. Example: [specific stack].',
      example: 'Instead of cold showers, stack warm shower + 30sec cold finish. The dopamine mechanism makes it stick. Example: normal shower + count to 30 cold = done.',
      bestFor: ['coach'],
      engagementScore: 8
    }
  ],

  // STORYTELLER: Narrative-driven
  storyteller: [
    {
      name: 'TRANSFORMATION STORY',
      structure: '[Before state] → [catalyst] → [after state]. The [mechanism] explains the change. The lesson: [insight].',
      example: 'Chronic fatigue → morning light protocol → 40% energy boost. The cortisol mechanism explains the change. The lesson: timing matters more than supplements.',
      bestFor: ['storyteller'],
      engagementScore: 8
    }
  ],

  // THOUGHT LEADER: Forward-thinking
  thoughtLeader: [
    {
      name: 'FUTURE INSIGHT',
      structure: 'In 5 years, [current practice] will be obsolete. [Emerging research] points to [new approach]. The [mechanism] is the key. Start now: [action].',
      example: 'In 5 years, daily multivitamins will be obsolete. Emerging research points to targeted micronutrients. The genetic mechanism is the key. Start now: test, then supplement.',
      bestFor: ['thoughtLeader'],
      engagementScore: 8
    }
  ],

  // EXPLORER: Discovery-focused
  explorer: [
    {
      name: 'HIDDEN CONNECTION',
      structure: '[Thing A] and [Thing B] seem unrelated, but [mechanism] connects them. This explains why [observation]. The implication: [insight].',
      example: 'Sleep and gut health seem unrelated, but the vagus nerve connects them. This explains why probiotics improve sleep. The implication: fix gut, fix sleep.',
      bestFor: ['explorer'],
      engagementScore: 8
    }
  ],

  // CONNECTOR: Linking concepts
  connector: [
    {
      name: 'SYSTEM LINK',
      structure: '[System A] affects [System B] via [mechanism]. Most people optimize [A] or [B] separately. Optimize [connection point] for [multiplier]x results.',
      example: 'Circadian rhythm affects metabolism via cortisol. Most people optimize sleep or diet separately. Optimize morning light for 2x results.',
      bestFor: ['connector'],
      engagementScore: 9
    }
  ],

  // INVESTIGATOR: Research-deep
  investigator: [
    {
      name: 'DEEP DIVE FINDING',
      structure: 'Dug into [topic] research. Found [surprising finding] in [study type]. The [mechanism] works differently than thought. Here\'s what matters: [key insight].',
      example: 'Dug into magnesium research. Found glycinate crosses blood-brain barrier in glycine form. The mechanism works differently than thought. Here\'s what matters: form > dose.',
      bestFor: ['investigator'],
      engagementScore: 8
    }
  ],

  // PHILOSOPHER: Big picture
  philosopher: [
    {
      name: 'PHILOSOPHICAL INSIGHT',
      structure: 'The [health concept] isn\'t about [common view], it\'s about [deeper truth]. The [mechanism] reveals [philosophical insight]. This changes how we think about [topic].',
      example: 'Longevity isn\'t about adding years, it\'s about preserving function. The autophagy mechanism reveals cellular cleanup matters more than supplements. This changes how we think about aging.',
      bestFor: ['philosopher'],
      engagementScore: 7
    }
  ],

  // NEWS REPORTER: Breaking research
  newsReporter: [
    {
      name: 'BREAKING FINDING',
      structure: 'BREAKING: [Institution] just published [finding]. The [mechanism] shows [implication]. This changes [common practice]. Here\'s what to do: [action].',
      example: 'BREAKING: Stanford just published circadian disruption causes diabetes. The insulin mechanism shows timing matters more than calories. This changes meal timing. Here\'s what to do: eat within 12-hour window.',
      bestFor: ['newsReporter'],
      engagementScore: 9
    }
  ],

  // TEACHER: Educational
  teacher: [
    {
      name: 'EDUCATIONAL BREAKDOWN',
      structure: 'Let\'s break down [concept]: [Step 1], [Step 2], [Step 3]. The [mechanism] connects them. Most people miss [key detail]. Here\'s why it matters: [reason].',
      example: 'Let\'s break down sleep: Light sets clock, food sets metabolism, exercise sets recovery. The circadian mechanism connects them. Most people miss the timing. Here\'s why it matters: misalignment = poor sleep.',
      bestFor: ['teacher'],
      engagementScore: 8
    }
  ],

  // EXPERIMENTER: Trial-based
  experimenter: [
    {
      name: 'EXPERIMENT RESULT',
      structure: 'Tested [protocol] for [timeframe]. Results: [finding]. The [mechanism] explains it. What worked: [success factor]. What didn\'t: [failure factor].',
      example: 'Tested cold exposure for 30 days. Results: 40% better sleep. The cortisol mechanism explains it. What worked: 11°C for 11min. What didn\'t: longer duration.',
      bestFor: ['experimenter'],
      engagementScore: 8
    }
  ],

  // PRAGMATIST: Practical solutions
  pragmatist: [
    {
      name: 'PRACTICAL HACK',
      structure: 'Skip [complex solution]. Do [simple action] instead. The [mechanism] is the same. Saves [time/money]. Results: [outcome].',
      example: 'Skip expensive NAD+ supplements. Do 500mg niacin instead. The NAD+ pathway is the same. Saves $95/month. Results: same biomarker improvement.',
      bestFor: ['pragmatist'],
      engagementScore: 9
    }
  ],

  // PATTERN FINDER: Meta-insights
  patternFinder: [
    {
      name: 'PATTERN DISCOVERY',
      structure: 'Noticed a pattern: [observation]. The [mechanism] explains why [pattern exists]. This applies to [broader concept]. The insight: [meta-learning].',
      example: 'Noticed a pattern: top performers optimize morning routine. The circadian mechanism explains why early wins compound. This applies to all habits. The insight: first 2 hours determine the day.',
      bestFor: ['patternFinder'],
      engagementScore: 8
    }
  ],

  // HISTORIAN: Historical context
  historian: [
    {
      name: 'HISTORICAL LESSON',
      structure: '[Historical example] shows [health principle]. Modern research confirms: [finding]. The [mechanism] hasn\'t changed. The lesson: [insight].',
      example: 'Ancient Greeks used cold baths for recovery. Modern research confirms: cold exposure reduces inflammation. The hormetic mechanism hasn\'t changed. The lesson: old practices often work.',
      bestFor: ['historian'],
      engagementScore: 7
    }
  ],

  // CULTURAL BRIDGE: Cross-cultural
  culturalBridge: [
    {
      name: 'CULTURAL WISDOM',
      structure: '[Culture] has used [practice] for [timeframe]. Research shows [benefit]. The [mechanism] explains it. How to adapt: [modern version].',
      example: 'Japanese have used forest bathing for centuries. Research shows 20% cortisol reduction. The phytoncide mechanism explains it. How to adapt: 20min in nature daily.',
      bestFor: ['culturalBridge'],
      engagementScore: 8
    }
  ],

  // TRANSLATOR: Simplifying complex
  translator: [
    {
      name: 'COMPLEX SIMPLIFIED',
      structure: '[Complex concept] = [simple explanation]. The [mechanism] in plain terms: [translation]. Why this matters: [practical reason].',
      example: 'Autophagy = cellular cleanup. The mechanism in plain terms: fasting triggers cell repair. Why this matters: 16-hour fast = daily cellular maintenance.',
      bestFor: ['translator'],
      engagementScore: 8
    }
  ],

  // INTERESTING CONTENT: Engaging angles
  interestingContent: [
    {
      name: 'SURPRISING ANGLE',
      structure: '[Unexpected fact] about [topic]. The [mechanism] explains why [surprising connection]. Most people think [common belief], but [truth].',
      example: 'Blue light at night affects weight gain. The melatonin mechanism explains why circadian disruption causes insulin resistance. Most people think it\'s just sleep, but metabolism is connected.',
      bestFor: ['interestingContent'],
      engagementScore: 9
    }
  ],

  // POP CULTURE ANALYST: Trend connections
  popCultureAnalyst: [
    {
      name: 'TREND INSIGHT',
      structure: '[Current trend] is popular, but [health angle] is missing. The [mechanism] shows [insight]. Here\'s how to do it right: [corrected approach].',
      example: 'Intermittent fasting is popular, but protein timing is missing. The mTOR mechanism shows muscle loss risk. Here\'s how to do it right: 30g protein at 8am, then fast.',
      bestFor: ['popCultureAnalyst'],
      engagementScore: 8
    }
  ]
};

/**
 * Get viral formulas for a specific generator
 */
export function getViralFormulasForGenerator(generatorName: string): ViralFormula[] {
  const baseFormulas = BASE_VIRAL_FORMULAS;
  const generatorFormulas = GENERATOR_SPECIFIC_FORMULAS[generatorName] || [];
  
  // Combine base formulas (all can use) + generator-specific formulas
  return [...baseFormulas, ...generatorFormulas];
}

/**
 * Get random viral formula for a generator
 */
export function getRandomViralFormula(generatorName: string): ViralFormula {
  const formulas = getViralFormulasForGenerator(generatorName);
  return formulas[Math.floor(Math.random() * formulas.length)];
}

/**
 * Get top viral formulas by engagement score
 */
export function getTopViralFormulas(generatorName: string, limit: number = 5): ViralFormula[] {
  const formulas = getViralFormulasForGenerator(generatorName);
  return formulas
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, limit);
}

/**
 * Format viral formula as prompt instruction
 */
export function formatViralFormulaAsPrompt(formula: ViralFormula): string {
  return `${formula.name}:
Structure: "${formula.structure}"
Example: "${formula.example}"
Engagement Score: ${formula.engagementScore}/10`;
}

