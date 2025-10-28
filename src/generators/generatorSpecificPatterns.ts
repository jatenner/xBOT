/**
 * GENERATOR-SPECIFIC PATTERNS
 * Each generator has its own rules instead of forcing all to be identical
 */

export const GENERATOR_PATTERNS = {
  // COACH: Actionable protocols, specific numbers
  coach: {
    required: ['specificity', 'actionable'],
    banned: ['fake_studies', 'vague_advice'],
    specificity: [
      /\d+\s*(mg|mcg|IU|g|ml|lux|min|hour|day|week)/i,
      /\d+%/, 
      /\d+:\d+/, // ratios like 16:8
    ],
    examples: [
      "Take 500mg magnesium glycinate 30 minutes before bed",
      "16:8 fasting (eat 12pm-8pm) + morning sunlight",
      "Cold shower: 2-3 minutes at 60°F for maximum benefit"
    ]
  },

  // PROVOCATEUR: Questions that challenge assumptions
  provocateur: {
    required: ['question', 'challenge'],
    banned: ['fake_studies', 'generic_questions'],
    specificity: [], // Questions don't need numbers
    examples: [
      "Why do we optimize sleep with blue light blockers but stare at phones all day?",
      "If 90% of serotonin comes from the gut, why do we treat depression as a brain problem?",
      "Why do we take supplements to fix problems we created with lifestyle?"
    ]
  },

  // STORYTELLER: Real narratives, case studies
  storyteller: {
    required: ['narrative', 'specificity'],
    banned: ['fake_studies', 'generic_stories'],
    specificity: [
      /\d+\s*(people|participants|patients|subjects)/i,
      /\d+\s*(year|month|week|day)s?/i,
      /\d+%/
    ],
    examples: [
      "A 2019 study followed 96 people for 12 weeks. Those who ate within 10-hour windows lost 3.3% body weight without calorie counting.",
      "In 2020, researchers tracked 200 shift workers. Those using bright light therapy at work had 40% better sleep quality than controls."
    ]
  },

  // DATA_NERD: Research-focused, mechanism-heavy
  data_nerd: {
    required: ['mechanism', 'specificity'],
    banned: ['fake_studies'],
    specificity: [
      /\d+\s*(mg|mcg|IU|g|ml|lux)/i,
      /\d+%/, 
      /(increases|decreases|triggers|blocks|modulates)/i,
      /(pathway|receptor|neurotransmitter|hormone)/i
    ],
    examples: [
      "Blue light (480nm) hits ipRGC cells → SCN master clock → cortisol release. Indoor lighting (300 lux) is 33x too dim for proper signaling.",
      "NMN (500mg) → NAD+ synthesis → sirtuin activation → DNA repair. Peak absorption at 2-3 hours post-dose."
    ]
  },

  // MYTH_BUSTER: Debunks myths with evidence
  myth_buster: {
    required: ['myth_truth', 'evidence'],
    banned: ['fake_studies'],
    specificity: [
      /\d+%/, 
      /\d+\s*(people|participants|studies)/i,
      /\d+\s*(year|month|week)s?/i
    ],
    examples: [
      "Myth: Fasting slows metabolism. Truth: 48-hour fasts increase growth hormone 1,300% (study of 11 men, 2011).",
      "Myth: Carbs at night cause weight gain. Truth: Meal timing doesn't affect weight loss when calories are equal (2017 study, 420 people)."
    ]
  },

  // PHILOSOPHER: Deep insights, thought-provoking
  philosopher: {
    required: ['insight', 'perspective'],
    banned: ['fake_studies', 'generic_advice'],
    specificity: [], // Insights don't need numbers
    examples: [
      "The gut microbiome doesn't just digest food—it shapes personality, mood, and decision-making through the vagus nerve.",
      "Modern life optimizes for convenience, not health. Every shortcut has a metabolic cost we're only beginning to understand."
    ]
  },

  // NEWS_REPORTER: Current research, breaking findings
  news_reporter: {
    required: ['recent_finding', 'specificity'],
    banned: ['fake_studies'],
    specificity: [
      /\d+\s*(mg|mcg|IU|g|ml)/i,
      /\d+%/, 
      /\b(202[0-4])\b/, // Recent years
      /\d+\s*(people|participants|patients)/i
    ],
    examples: [
      "New 2024 study: Myo-inositol (2,000mg) improves insulin sensitivity 50% in PCOS patients (90 women, 6 months).",
      "Breaking: Stanford researchers found 10-minute meditation increases focus 43% (study of 140 people, published this month)."
    ]
  },

  // THOUGHT_LEADER: Industry insights, future trends
  thought_leader: {
    required: ['insight', 'trend'],
    banned: ['fake_studies'],
    specificity: [
      /\d+%/, 
      /\d+\s*(year|month)s?/i,
      /\d+\s*(billion|million)/i
    ],
    examples: [
      "The longevity industry will hit $44 billion by 2030. Key driver: personalized biomarkers replacing one-size-fits-all protocols.",
      "Gut-brain research is exploding. 90% of serotonin is made in the gut—pharmaceutical companies are taking notice."
    ]
  },

  // CULTURAL_BRIDGE: Connects ancient wisdom with modern science
  cultural_bridge: {
    required: ['historical_connection', 'modern_validation'],
    banned: ['fake_studies'],
    specificity: [
      /\d+\s*(year|century|millennia)/i,
      /\d+%/, 
      /\d+\s*(mg|mcg|g)/i
    ],
    examples: [
      "Ancient Greeks used cold exposure for strength. Modern science: 11 minutes weekly increases brown fat 37% (2022 study).",
      "Ayurveda's 5,000-year-old practice of oil pulling reduces harmful bacteria 20% (2016 study, 60 people)."
    ]
  }
};

/**
 * Get patterns for a specific generator
 */
export function getGeneratorPatterns(generatorName: string) {
  const normalizedName = generatorName.toLowerCase().replace(/[^a-z]/g, '');
  
  // Map variations to standard names
  const nameMap: Record<string, string> = {
    'coach': 'coach',
    'provocateur': 'provocateur', 
    'storyteller': 'storyteller',
    'datanerd': 'data_nerd',
    'data_nerd': 'data_nerd',
    'mythbuster': 'myth_buster',
    'myth_buster': 'myth_buster',
    'philosopher': 'philosopher',
    'newsreporter': 'news_reporter',
    'news_reporter': 'news_reporter',
    'thoughtleader': 'thought_leader',
    'thought_leader': 'thought_leader',
    'culturalbridge': 'cultural_bridge',
    'cultural_bridge': 'cultural_bridge'
  };
  
  const standardName = nameMap[normalizedName] || 'coach';
  return GENERATOR_PATTERNS[standardName as keyof typeof GENERATOR_PATTERNS] || GENERATOR_PATTERNS.coach;
}

/**
 * Check if content matches generator requirements
 */
export function validateGeneratorContent(content: string, generatorName: string): {
  valid: boolean;
  missing: string[];
  suggestions: string[];
} {
  const patterns = getGeneratorPatterns(generatorName);
  const missing: string[] = [];
  const suggestions: string[] = [];
  
  // Check required elements
  if (patterns.required.includes('specificity') && patterns.specificity.length > 0) {
    const hasSpecificity = patterns.specificity.some(pattern => pattern.test(content));
    if (!hasSpecificity) {
      missing.push('specificity');
      suggestions.push(...patterns.examples);
    }
  }
  
  if (patterns.required.includes('question') && !content.includes('?')) {
    missing.push('question');
    suggestions.push('Ask a thought-provoking question');
  }
  
  if (patterns.required.includes('myth_truth') && !content.toLowerCase().includes('myth')) {
    missing.push('myth_truth');
    suggestions.push('Start with "Myth:" and "Truth:"');
  }
  
  return {
    valid: missing.length === 0,
    missing,
    suggestions
  };
}
