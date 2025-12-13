/**
 * 📅 CONTENT SLOT MANAGER
 * 
 * Manages micro content calendar with content slots for strategic variety
 * 
 * Content Slots:
 * - myth_busting: Debunking health myths
 * - framework: Providing frameworks/models
 * - research: Sharing research findings
 * - practical_tip: Actionable tips
 * - case_study: Real examples/case studies
 * - trend_analysis: Analyzing trends
 * - comparison: Comparing options
 * - deep_dive: Deep exploration of topics
 * 
 * Phase 2.1: Content Enhancements
 */

export type ContentSlotType =
  | 'myth_busting'
  | 'framework'
  | 'research'
  | 'practical_tip'
  | 'case_study'
  | 'trend_analysis'
  | 'comparison'
  | 'deep_dive'
  | 'question'
  | 'story'
  | 'news'
  | 'educational';

export interface ContentSlotConfig {
  slot: ContentSlotType;
  description: string;
  preferredGenerators?: string[];
  preferredAngles?: string[];
  preferredTones?: string[];
}

/**
 * Content slot definitions with preferences
 */
const CONTENT_SLOT_DEFINITIONS: Record<ContentSlotType, ContentSlotConfig> = {
  myth_busting: {
    slot: 'myth_busting',
    description: 'Debunking health myths and misconceptions',
    preferredGenerators: ['mythBuster', 'contrarian', 'dataNerd'],
    preferredAngles: ['debunking', 'correcting misconceptions', 'fact-checking'],
    preferredTones: ['authoritative', 'educational', 'direct']
  },
  framework: {
    slot: 'framework',
    description: 'Providing frameworks, models, or systems',
    preferredGenerators: ['coach', 'teacher', 'thoughtLeader'],
    preferredAngles: ['systematic approach', 'step-by-step', 'structured method'],
    preferredTones: ['educational', 'practical', 'clear']
  },
  research: {
    slot: 'research',
    description: 'Sharing research findings and studies',
    preferredGenerators: ['dataNerd', 'investigator', 'researcher'],
    preferredAngles: ['study findings', 'research-backed', 'evidence-based'],
    preferredTones: ['scientific', 'data-driven', 'analytical']
  },
  practical_tip: {
    slot: 'practical_tip',
    description: 'Actionable tips and advice',
    preferredGenerators: ['coach', 'pragmatist', 'teacher'],
    preferredAngles: ['actionable advice', 'how-to', 'practical steps'],
    preferredTones: ['helpful', 'practical', 'actionable']
  },
  case_study: {
    slot: 'case_study',
    description: 'Real examples and case studies',
    preferredGenerators: ['storyteller', 'culturalBridge', 'experimenter'],
    preferredAngles: ['real example', 'case study', 'personal story'],
    preferredTones: ['narrative', 'engaging', 'relatable']
  },
  trend_analysis: {
    slot: 'trend_analysis',
    description: 'Analyzing health trends',
    preferredGenerators: ['newsReporter', 'trendAnalyst', 'thoughtLeader'],
    preferredAngles: ['trend analysis', 'market insights', 'industry trends'],
    preferredTones: ['analytical', 'insightful', 'forward-looking']
  },
  comparison: {
    slot: 'comparison',
    description: 'Comparing options or approaches',
    preferredGenerators: ['dataNerd', 'pragmatist', 'investigator'],
    preferredAngles: ['comparison', 'vs analysis', 'pros and cons'],
    preferredTones: ['balanced', 'analytical', 'objective']
  },
  deep_dive: {
    slot: 'deep_dive',
    description: 'Deep exploration of topics',
    preferredGenerators: ['investigator', 'philosopher', 'patternFinder'],
    preferredAngles: ['deep analysis', 'comprehensive exploration', 'in-depth'],
    preferredTones: ['thoughtful', 'comprehensive', 'detailed']
  },
  question: {
    slot: 'question',
    description: 'Posing questions to engage audience',
    preferredGenerators: ['provocateur', 'thoughtLeader', 'connector'],
    preferredAngles: ['provocative question', 'thought-provoking', 'engagement question'],
    preferredTones: ['curious', 'engaging', 'provocative']
  },
  story: {
    slot: 'story',
    description: 'Narrative-driven content',
    preferredGenerators: ['storyteller', 'culturalBridge', 'historian'],
    preferredAngles: ['narrative', 'story', 'anecdote'],
    preferredTones: ['narrative', 'engaging', 'relatable']
  },
  news: {
    slot: 'news',
    description: 'Breaking news and updates',
    preferredGenerators: ['newsReporter', 'dataNerd', 'investigator'],
    preferredAngles: ['breaking news', 'latest research', 'recent findings'],
    preferredTones: ['informative', 'timely', 'authoritative']
  },
  educational: {
    slot: 'educational',
    description: 'Educational content',
    preferredGenerators: ['teacher', 'coach', 'translator'],
    preferredAngles: ['educational', 'teaching', 'explaining'],
    preferredTones: ['educational', 'patient', 'clear']
  }
};

/**
 * Get content slots for today based on weekday pattern
 * 
 * Pattern:
 * - Monday: framework, research (start week strong)
 * - Tuesday: practical_tip, myth_busting
 * - Wednesday: case_study, deep_dive (mid-week engagement)
 * - Thursday: comparison, trend_analysis
 * - Friday: question, story (end week engagement)
 * - Saturday: practical_tip, news (weekend catch-up)
 * - Sunday: educational, framework (weekend learning)
 */
export function getContentSlotsForToday(): ContentSlotType[] {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const slotPatterns: Record<number, ContentSlotType[]> = {
    0: ['educational', 'framework'], // Sunday
    1: ['framework', 'research'], // Monday
    2: ['practical_tip', 'myth_busting'], // Tuesday
    3: ['case_study', 'deep_dive'], // Wednesday
    4: ['comparison', 'trend_analysis'], // Thursday
    5: ['question', 'story'], // Friday
    6: ['practical_tip', 'news'] // Saturday
  };
  
  return slotPatterns[dayOfWeek] || ['practical_tip', 'educational']; // Default fallback
}

/**
 * Get content slots for a specific date
 */
export function getContentSlotsForDate(date: Date): ContentSlotType[] {
  const dayOfWeek = date.getDay();
  
  const slotPatterns: Record<number, ContentSlotType[]> = {
    0: ['educational', 'framework'],
    1: ['framework', 'research'],
    2: ['practical_tip', 'myth_busting'],
    3: ['case_study', 'deep_dive'],
    4: ['comparison', 'trend_analysis'],
    5: ['question', 'story'],
    6: ['practical_tip', 'news']
  };
  
  return slotPatterns[dayOfWeek] || ['practical_tip', 'educational'];
}

/**
 * Select a content slot from available slots (with bias toward preferred slots)
 */
export function selectContentSlot(
  availableSlots: ContentSlotType[],
  recentSlots?: ContentSlotType[] // Last N slots used (for diversity)
): ContentSlotType {
  if (availableSlots.length === 0) {
    return 'practical_tip'; // Default fallback
  }
  
  if (availableSlots.length === 1) {
    return availableSlots[0];
  }
  
  // If we have recent slots, avoid repeating the last one
  if (recentSlots && recentSlots.length > 0) {
    const lastSlot = recentSlots[recentSlots.length - 1];
    const filtered = availableSlots.filter(slot => slot !== lastSlot);
    
    if (filtered.length > 0) {
      // Random selection from filtered (avoiding last used)
      const randomIndex = Math.floor(Math.random() * filtered.length);
      return filtered[randomIndex];
    }
  }
  
  // Random selection from available slots
  const randomIndex = Math.floor(Math.random() * availableSlots.length);
  return availableSlots[randomIndex];
}

/**
 * Get slot configuration
 */
export function getSlotConfig(slot: ContentSlotType): ContentSlotConfig {
  return CONTENT_SLOT_DEFINITIONS[slot] || CONTENT_SLOT_DEFINITIONS.practical_tip;
}

/**
 * Get preferred generators for a slot
 */
export function getPreferredGeneratorsForSlot(slot: ContentSlotType): string[] {
  const config = getSlotConfig(slot);
  return config.preferredGenerators || [];
}

/**
 * Get preferred angles for a slot
 */
export function getPreferredAnglesForSlot(slot: ContentSlotType): string[] {
  const config = getSlotConfig(slot);
  return config.preferredAngles || [];
}

/**
 * Get preferred tones for a slot
 */
export function getPreferredTonesForSlot(slot: ContentSlotType): string[] {
  const config = getSlotConfig(slot);
  return config.preferredTones || [];
}

/**
 * Check if a generator matches a slot's preferences
 */
export function generatorMatchesSlot(generator: string, slot: ContentSlotType): boolean {
  const preferred = getPreferredGeneratorsForSlot(slot);
  return preferred.length === 0 || preferred.includes(generator);
}

