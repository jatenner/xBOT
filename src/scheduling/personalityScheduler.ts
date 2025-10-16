/**
 * PERSONALITY SCHEDULER
 * Assigns different generators to different days for natural rhythm
 */

export type GeneratorType = 
  | 'contrarian' 
  | 'data_nerd' 
  | 'storyteller' 
  | 'coach' 
  | 'explorer' 
  | 'thought_leader'
  | 'myth_buster'
  | 'news_reporter'
  | 'philosopher'
  | 'provocateur';

export type FormatType = 'single' | 'thread' | 'auto';

// GENERATOR POOL - All 10 voices with their characteristics
export const GENERATOR_POOL: Array<{
  generator: GeneratorType;
  weight: number; // Initial weight (adjusted by learning)
  preferredFormats: FormatType[];
  description: string;
}> = [
  { generator: 'contrarian', weight: 1.0, preferredFormats: ['single', 'thread'], description: 'Challenges conventional wisdom' },
  { generator: 'data_nerd', weight: 1.0, preferredFormats: ['thread'], description: 'Research-heavy, numbers-focused' },
  { generator: 'storyteller', weight: 1.0, preferredFormats: ['thread'], description: 'Transformation narratives' },
  { generator: 'coach', weight: 1.0, preferredFormats: ['single'], description: 'Actionable protocols' },
  { generator: 'explorer', weight: 1.0, preferredFormats: ['single', 'thread'], description: 'Curious questions' },
  { generator: 'thought_leader', weight: 1.0, preferredFormats: ['single', 'thread'], description: 'Bold authoritative claims' },
  { generator: 'myth_buster', weight: 1.0, preferredFormats: ['single', 'thread'], description: 'Debunks myths with evidence' },
  { generator: 'news_reporter', weight: 1.0, preferredFormats: ['single'], description: 'Breaking research news' },
  { generator: 'philosopher', weight: 1.0, preferredFormats: ['thread'], description: 'Deep existential thinking' },
  { generator: 'provocateur', weight: 1.0, preferredFormats: ['single', 'thread'], description: 'Hot takes and debates' }
];

// WEEKLY ROTATION - Different emphasis each week, but not rigid
export const WEEKLY_THEMES = [
  { theme: 'Evidence Week', favoredGenerators: ['data_nerd', 'news_reporter', 'myth_buster'], weight: 1.5 },
  { theme: 'Insight Week', favoredGenerators: ['philosopher', 'thought_leader', 'explorer'], weight: 1.5 },
  { theme: 'Action Week', favoredGenerators: ['coach', 'contrarian', 'provocateur'], weight: 1.5 },
  { theme: 'Story Week', favoredGenerators: ['storyteller', 'news_reporter', 'myth_buster'], weight: 1.5 }
];

export class PersonalityScheduler {
  private static instance: PersonalityScheduler;
  private learningWeights: Record<GeneratorType, number> = {
    'contrarian': 1.0,
    'data_nerd': 1.0,
    'storyteller': 1.0,
    'coach': 1.0,
    'explorer': 1.0,
    'thought_leader': 1.0,
    'myth_buster': 1.0,
    'news_reporter': 1.0,
    'philosopher': 1.0,
    'provocateur': 1.0
  };
  
  private recentUsage: Map<GeneratorType, number> = new Map();
  
  private constructor() {}
  
  public static getInstance(): PersonalityScheduler {
    if (!PersonalityScheduler.instance) {
      PersonalityScheduler.instance = new PersonalityScheduler();
    }
    return PersonalityScheduler.instance;
  }
  
  /**
   * DYNAMIC SELECTION - No rigid schedule, performance + diversity driven
   */
  selectGenerator(): { generator: GeneratorType; format: FormatType; reasoning: string } {
    console.log('[SCHEDULER] 🎲 Dynamic generator selection (no rigid schedule)');
    
    // Get current week number for rotation
    const weekNumber = this.getWeekNumber();
    const weeklyTheme = WEEKLY_THEMES[weekNumber % WEEKLY_THEMES.length];
    
    console.log(`[SCHEDULER] 📅 Week ${weekNumber}: ${weeklyTheme.theme}`);
    
    // Calculate scores for each generator
    const scores = GENERATOR_POOL.map(gen => {
      // Base weight from learning
      let score = this.learningWeights[gen.generator];
      
      // Weekly theme boost
      if (weeklyTheme.favoredGenerators.includes(gen.generator)) {
        score *= weeklyTheme.weight;
      }
      
      // Diversity penalty - recently used generators get lower priority
      const recentUse = this.recentUsage.get(gen.generator) || 0;
      score *= Math.pow(0.6, recentUse); // Aggressive diversity enforcement
      
      return {
        generator: gen.generator,
        score,
        preferredFormats: gen.preferredFormats,
        description: gen.description
      };
    });
    
    // Sort by score and pick weighted random from top 5
    scores.sort((a, b) => b.score - a.score);
    const topCandidates = scores.slice(0, 5);
    
    // Weighted random selection
    const totalScore = topCandidates.reduce((sum, c) => sum + c.score, 0);
    let random = Math.random() * totalScore;
    
    let selected = topCandidates[0];
    for (const candidate of topCandidates) {
      random -= candidate.score;
      if (random <= 0) {
        selected = candidate;
        break;
      }
    }
    
    // Pick format from preferred formats
    const format = selected.preferredFormats[
      Math.floor(Math.random() * selected.preferredFormats.length)
    ];
    
    // Track usage for diversity
    this.recentUsage.set(selected.generator, (this.recentUsage.get(selected.generator) || 0) + 1);
    
    // Reset usage counts occasionally
    if (this.recentUsage.size > 15) {
      this.recentUsage.clear();
    }
    
    console.log(`[SCHEDULER] ✅ Selected: ${selected.generator} (score: ${selected.score.toFixed(2)})`);
    
    return {
      generator: selected.generator,
      format: format as FormatType,
      reasoning: `${selected.description} (theme: ${weeklyTheme.theme})`
    };
  }
  
  /**
   * Update generator performance weight
   */
  updateGeneratorWeight(generator: GeneratorType, followers_gained: number): void {
    // Exponential moving average
    const alpha = 0.3;
    const normalizedGain = followers_gained / 10; // Normalize to 0-1+ range
    
    this.learningWeights[generator] = 
      this.learningWeights[generator] * (1 - alpha) + 
      (1 + normalizedGain) * alpha;
    
    console.log(`[SCHEDULER] 📈 Updated ${generator} weight: ${this.learningWeights[generator].toFixed(2)}`);
  }
  
  /**
   * Get all generator weights (for inspection)
   */
  getWeights(): Record<GeneratorType, number> {
    return { ...this.learningWeights };
  }
  
  /**
   * Get week number for rotation
   */
  private getWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
  }
}

export const getPersonalityScheduler = () => PersonalityScheduler.getInstance();

