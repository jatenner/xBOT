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
 * Available Generators (22 total):
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
 * - interestingContent: High-interest, engaging content
 * - dynamicContent: Adaptive, versatile content
 * - popCultureAnalyst: Connects health to pop culture, trends, influencers
 * - teacher: Patient, step-by-step educational content
 * - investigator: Deep research synthesis across multiple studies
 * - connector: Systems thinking, shows interconnections
 * - pragmatist: Realistic, achievable protocols (80/20 approach)
 * - historian: Historical context and health evolution
 * - translator: Translates complex science to simple language
 * - patternFinder: Identifies patterns across research/domains
 * - experimenter: Experimental protocols and self-experimentation
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
  | 'provocateur'
  | 'interestingContent'
  | 'dynamicContent'
  | 'popCultureAnalyst' // NEW - Nov 6, 2025
  | 'teacher' // NEW - Nov 6, 2025
  | 'investigator' // NEW - Nov 6, 2025
  | 'connector' // NEW - Nov 6, 2025
  | 'pragmatist' // NEW - Nov 6, 2025
  | 'historian' // NEW - Nov 6, 2025
  | 'translator' // NEW - Nov 6, 2025
  | 'patternFinder' // NEW - Nov 6, 2025
  | 'experimenter'; // NEW - Nov 6, 2025

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
   * 🎯 v2 UPGRADE: Uses offline weight maps from learning_model_weights
   * - Reads active weight map from database
   * - Uses weighted selection with exploration (80% exploit, 20% explore)
   * - Falls back to random if no weight map available
   * 
   * @param angle - The content angle/perspective
   * @param tone - The content tone/voice
   * @returns Selected generator name (weighted or random)
   */
  async matchGenerator(angle: string, tone: string): Promise<GeneratorType> {
    console.log(`[GENERATOR_MATCH] 🎯 Selecting generator (v2 weight map mode):`);
    console.log(`   Angle: "${angle}"`);
    console.log(`   Tone: "${tone}"`);
    
    // 🎯 v2: Try to load active weight map
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      const { data: weightMap, error } = await supabase
        .from('learning_model_weights')
        .select('weights, version, sample_size')
        .eq('is_active', true)
        .order('computed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && weightMap?.weights?.generator_name) {
        const generatorWeights = weightMap.weights.generator_name as Record<string, number>;
        const allGenerators = this.getAllGenerators();
        
        // Filter to only generators that exist in our system
        const validWeights: Record<string, number> = {};
        let totalWeight = 0;
        
        for (const gen of allGenerators) {
          if (generatorWeights[gen] !== undefined) {
            validWeights[gen] = generatorWeights[gen];
            totalWeight += generatorWeights[gen];
          }
        }
        
        if (Object.keys(validWeights).length > 0 && totalWeight > 0) {
          // 🎯 v2: Weighted selection with exploration (80% exploit, 20% explore)
          const explorationRate = 0.2; // 20% exploration
          const useExploration = Math.random() < explorationRate;
          
          if (useExploration) {
            // 20%: Pure random exploration
            const randomIndex = Math.floor(Math.random() * allGenerators.length);
            const selected = allGenerators[randomIndex];
            console.log(`   → Exploration mode: ${selected} (random)`);
            return selected;
          } else {
            // 80%: Weighted selection (exploit)
            const selected = this.selectWeightedGenerator(validWeights, totalWeight);
            const weight = validWeights[selected] || 0;
            console.log(`   → Exploitation mode: ${selected} (weight: ${(weight * 100).toFixed(1)}%, map v${weightMap.version}, n=${weightMap.sample_size})`);
            return selected as GeneratorType;
          }
        }
      }
    } catch (error: any) {
      console.warn(`[GENERATOR_MATCH] ⚠️ Failed to load weight map: ${error.message}, falling back to random`);
    }
    
    // Fallback: Pure random selection (if no weight map available)
    const allGenerators = this.getAllGenerators();
    const randomIndex = Math.floor(Math.random() * allGenerators.length);
    const selected = allGenerators[randomIndex];
    
    console.log(`   → Random fallback: ${selected} (1/${allGenerators.length} chance, no weight map)`);
    
    return selected;
  }
  
  /**
   * Select generator using weighted probabilities
   */
  private selectWeightedGenerator(weights: Record<string, number>, totalWeight: number): string {
    const random = Math.random() * totalWeight;
    let cumulative = 0;
    
    for (const [generator, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (random <= cumulative) {
        return generator;
      }
    }
    
    // Fallback to first generator if rounding errors
    return Object.keys(weights)[0] || 'dataNerd';
  }
  
  /**
   * 🎯 v2: Legacy method - now integrated into matchGenerator()
   * Kept for backward compatibility
   */
  async matchGeneratorWithLearning(
    angle: string,
    tone: string
  ): Promise<GeneratorType> {
    return this.matchGenerator(angle, tone);
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
      'provocateur',
      'interestingContent',
      'dynamicContent',
      // NEW GENERATORS (Nov 6, 2025)
      'popCultureAnalyst',
      'teacher',
      'investigator',
      'connector',
      'pragmatist',
      'historian',
      'translator',
      'patternFinder',
      'experimenter'
    ];
  }
}

/**
 * Singleton instance getter
 */
export function getGeneratorMatcher(): GeneratorMatcher {
  return GeneratorMatcher.getInstance();
}

