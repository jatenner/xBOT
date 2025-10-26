/**
 * 🎭 GENERATOR MATCHER
 * 
 * Routes topic angles and tones to the most suitable content generator.
 * 
 * Purpose:
 * - Each generator has a distinct personality
 * - Certain angles naturally fit certain generators
 * - This matcher ensures optimal pairing
 * 
 * Example:
 * - Angle: "Why insurance won't cover NAD+ testing"
 * - Tone: "Skeptical investigative"
 * - Best match: "contrarian" (challenges systems, questions industry)
 * 
 * Available Generators (11 total):
 * - contrarian: Challenges mainstream, questions systems
 * - culturalBridge: Books, influencers, cultural connections, people stories
 * - dataNerd: Research-heavy, data-driven
 * - storyteller: Narratives, real people stories
 * - coach: Prescriptive, how-to, protocols
 * - explorer: Novel ideas, experimental
 * - thoughtLeader: Big picture, insights
 * - mythBuster: Debunks myths, corrects misconceptions
 * - newsReporter: Breaking news, trending research
 * - philosopher: Deep thinking, meaning, context
 * - provocateur: Bold, controversial, edgy
 */

export type GeneratorType = 
  | 'contrarian'
  | 'culturalBridge' // Books, influencers, cultural connections
  | 'dataNerd'
  | 'storyteller'
  | 'coach'
  | 'explorer'
  | 'thoughtLeader'
  | 'mythBuster'
  | 'newsReporter'
  | 'philosopher'
  | 'provocateur';

export class GeneratorMatcher {
  private static instance: GeneratorMatcher;
  
  private constructor() {}
  
  public static getInstance(): GeneratorMatcher {
    if (!GeneratorMatcher.instance) {
      GeneratorMatcher.instance = new GeneratorMatcher();
    }
    return GeneratorMatcher.instance;
  }
  
  /**
   * Select generator for content creation
   * 
   * 🎲 CURRENT MODE: PURE RANDOM (Data Collection Phase)
   * - All generators have equal 10% chance
   * - No bias, no assumptions
   * - Collects unbiased performance data
   * 
   * 🔮 FUTURE MODE: LEARNED WEIGHTS (Optimization Phase)
   * - Will use performance data to weight selection
   * - High-performing combinations get higher probability
   * - Activated after 50-100 posts with data
   * 
   * @param angle - The content angle/perspective
   * @param tone - The content tone/voice
   * @returns Randomly selected generator name
   */
  matchGenerator(angle: string, tone: string): GeneratorType {
    console.log(`[GENERATOR_MATCH] 🎲 Selecting generator (RANDOM MODE - data collection):`);
    console.log(`   Angle: "${angle}"`);
    console.log(`   Tone: "${tone}"`);
    
    // 🎲 PURE RANDOM SELECTION - No bias!
    // All generators have equal 10% chance
    const allGenerators = this.getAllGenerators();
    const randomIndex = Math.floor(Math.random() * allGenerators.length);
    const selected = allGenerators[randomIndex];
    
    console.log(`   → Randomly selected: ${selected} (1/${allGenerators.length} chance)`);
    console.log(`   → Learning mode: OFF (collecting unbiased data first)`);
    
    return selected;
  }
  
  /**
   * 🔮 FUTURE: Learned weights-based selection
   * 
   * This will be activated later when we have enough performance data.
   * For now, it just reports data but doesn't influence decisions.
   * 
   * To activate: Change LEARNING_MODE_ACTIVE to true
   */
  private LEARNING_MODE_ACTIVE = false; // ← Set to true when ready to use learned weights
  
  async matchGeneratorWithLearning(
    angle: string,
    tone: string
  ): Promise<GeneratorType> {
    
    if (!this.LEARNING_MODE_ACTIVE) {
      console.log('[GENERATOR_MATCH] 📊 Learning data available but not active yet');
      return this.matchGenerator(angle, tone); // Use random for now
    }
    
    // TODO: Implement weighted selection based on performance data
    // This will query content_performance_learning table
    // And weight generators by their success rate
    
    console.log('[GENERATOR_MATCH] 🧠 LEARNING MODE: Using performance data');
    return this.matchGenerator(angle, tone); // Placeholder
  }
  
  /**
   * Get all available generators
   */
  getAllGenerators(): GeneratorType[] {
    return [
      'contrarian',
      'culturalBridge', // Books, influencers, people, cultural connections
      'dataNerd',
      'storyteller',
      'coach',
      'explorer',
      'thoughtLeader',
      'mythBuster',
      'newsReporter',
      'philosopher',
      'provocateur'
    ];
  }
}

/**
 * Singleton instance getter
 */
export function getGeneratorMatcher(): GeneratorMatcher {
  return GeneratorMatcher.getInstance();
}

