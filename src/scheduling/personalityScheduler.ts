/**
 * PERSONALITY SCHEDULER
 * Assigns different generators to different days for natural rhythm
 */

export type GeneratorType = 'contrarian' | 'data_nerd' | 'storyteller' | 'coach' | 'explorer' | 'thought_leader';
export type FormatType = 'single' | 'thread' | 'auto';

export interface DailyPersonality {
  day: string;
  generator: GeneratorType;
  format: FormatType;
  goal: string;
  reasoning: string;
}

export const WEEKLY_SCHEDULE: DailyPersonality[] = [
  {
    day: 'Monday',
    generator: 'contrarian',
    format: 'single',
    goal: 'Challenge weekend assumptions',
    reasoning: 'Start week by questioning conventional wisdom'
  },
  {
    day: 'Tuesday',
    generator: 'data_nerd',
    format: 'thread',
    goal: 'Mid-week deep dive',
    reasoning: 'Break down study with all the details'
  },
  {
    day: 'Wednesday',
    generator: 'storyteller',
    format: 'thread',
    goal: 'Hump day inspiration',
    reasoning: 'Share transformation story for mid-week motivation'
  },
  {
    day: 'Thursday',
    generator: 'thought_leader',
    format: 'single',
    goal: 'Bold claim',
    reasoning: 'Make authoritative statement to build credibility'
  },
  {
    day: 'Friday',
    generator: 'coach',
    format: 'single',
    goal: 'Weekend prep',
    reasoning: 'Give actionable protocol for weekend implementation'
  },
  {
    day: 'Saturday',
    generator: 'explorer',
    format: 'auto',
    goal: 'Casual exploration',
    reasoning: 'Ask questions and explore ideas casually'
  },
  {
    day: 'Sunday',
    generator: 'thought_leader',
    format: 'thread',
    goal: 'Weekly synthesis',
    reasoning: 'Wrap up week with big-picture thinking'
  }
];

export class PersonalityScheduler {
  private static instance: PersonalityScheduler;
  private learningWeights: Record<GeneratorType, number> = {
    'contrarian': 1.0,
    'data_nerd': 1.0,
    'storyteller': 1.0,
    'coach': 1.0,
    'explorer': 1.0,
    'thought_leader': 1.0
  };
  
  private constructor() {}
  
  public static getInstance(): PersonalityScheduler {
    if (!PersonalityScheduler.instance) {
      PersonalityScheduler.instance = new PersonalityScheduler();
    }
    return PersonalityScheduler.instance;
  }
  
  /**
   * Get today's scheduled personality
   */
  getTodaysPersonality(): DailyPersonality {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const scheduled = WEEKLY_SCHEDULE.find(s => s.day === today);
    
    return scheduled || WEEKLY_SCHEDULE[0]; // Fallback to Monday
  }
  
  /**
   * Get personality with learning adjustments
   * If a generator is performing well, increase its frequency
   */
  getAdjustedPersonality(): DailyPersonality {
    const base = this.getTodaysPersonality();
    
    // 80% of time, use schedule
    // 20% of time, use best-performing generator
    if (Math.random() < 0.8) {
      return base;
    }
    
    // Find best performer
    const bestGenerator = Object.entries(this.learningWeights)
      .sort(([, a], [, b]) => b - a)[0][0] as GeneratorType;
    
    console.log(`[SCHEDULER] 📊 Using best performer: ${bestGenerator} (weight: ${this.learningWeights[bestGenerator].toFixed(2)})`);
    
    return {
      ...base,
      generator: bestGenerator,
      reasoning: `Best performer (${this.learningWeights[bestGenerator].toFixed(1)}x baseline)`
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
}

export const getPersonalityScheduler = () => PersonalityScheduler.getInstance();

