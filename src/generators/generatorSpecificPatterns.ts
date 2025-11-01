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
    examples: [] // Removed templates - AI has freedom to format however works best
  },

  // PROVOCATEUR: Questions that challenge assumptions
  provocateur: {
    required: ['question', 'challenge'],
    banned: ['fake_studies', 'generic_questions'],
    specificity: [], // Questions don't need numbers
    examples: [] // Removed templates - AI has freedom to challenge however works best
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
    examples: [] // Removed templates - AI has freedom to tell stories however works best
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
    examples: [] // Removed templates - AI has freedom to present data however works best
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
    examples: [] // Removed templates - AI has freedom to debunk myths however works best
  },

  // PHILOSOPHER: Deep insights, thought-provoking
  philosopher: {
    required: ['insight', 'perspective'],
    banned: ['fake_studies', 'generic_advice'],
    specificity: [], // Insights don't need numbers
    examples: [] // Removed templates - AI has freedom to philosophize however works best
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
    examples: [] // Removed templates - AI has freedom to report news however works best
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
    examples: [] // Removed templates - AI has freedom to share insights however works best
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
    examples: [] // Removed templates - AI has freedom to bridge cultures however works best
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
  
  if (patterns.required.includes('myth_truth')) {
    // Check for contrast (belief vs reality), not specific "Myth:" word
    const hasContrast = /\b(myth|truth|believe|think|actually|reality|wrong|fact|popular)\b/i.test(content);
    if (!hasContrast) {
      missing.push('myth_truth');
      suggestions.push('Show contrast between common belief and reality - any format works');
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    suggestions
  };
}
