/**
 * Hybrid Content Types - Content Type Blending
 * 
 * Allows mixing of content types for more natural variety:
 * - Fact Bomb → Quick Tip
 * - Study Breakdown told as Case Study
 * - News Reaction → Challenge
 */

export interface HybridType {
  hybrid_id: string;
  name: string;
  description: string;
  base_type: string;
  blend_type: string;
  structure: string;
  examples: string[];
  viral_potential: number;
}

export class HybridContentTypes {
  private static instance: HybridContentTypes;
  private hybrids: HybridType[] = [];
  
  private constructor() {
    this.initializeHybrids();
  }
  
  public static getInstance(): HybridContentTypes {
    if (!HybridContentTypes.instance) {
      HybridContentTypes.instance = new HybridContentTypes();
    }
    return HybridContentTypes.instance;
  }
  
  /**
   * Get random hybrid type for variety
   */
  public getHybridType(): HybridType | null {
    // 30% chance to use hybrid instead of pure type
    if (Math.random() > 0.3) {
      return null; // Use pure type
    }
    
    const hybrid = this.hybrids[Math.floor(Math.random() * this.hybrids.length)];
    console.log(`[HYBRID] 🔀 Using hybrid: ${hybrid.name}`);
    
    return hybrid;
  }
  
  public getAllHybrids(): HybridType[] {
    return [...this.hybrids];
  }
  
  private initializeHybrids(): void {
    this.hybrids = [
      {
        hybrid_id: 'fact_to_action',
        name: 'Fact Bomb → Action',
        description: 'Surprising fact that leads directly to actionable tip',
        base_type: 'fact_bomb',
        blend_type: 'quick_tip',
        structure: 'Shocking stat + Why it matters + What to do about it',
        examples: [
          '73% of people are chronically dehydrated. This affects cognition within 2 hours. Fix: 500ml water upon waking.',
          'Your brain is 2% of body weight but uses 20% of energy. Glucose crashes kill focus. Solution: protein + fat breakfast.'
        ],
        viral_potential: 0.85
      },
      
      {
        hybrid_id: 'study_story',
        name: 'Study as Story',
        description: 'Study breakdown told as engaging narrative',
        base_type: 'study_breakdown',
        blend_type: 'case_study',
        structure: 'Study setup as story + Surprising findings + Real-world application',
        examples: [
          'Scientists gave people 30 min morning light. 6 weeks later, they fell asleep 1 hour faster. Here\'s why...',
          'Researchers tracked 10,000 people for 20 years. Those who did X lived 7 years longer. The mechanism...'
        ],
        viral_potential: 0.9
      },
      
      {
        hybrid_id: 'news_challenge',
        name: 'News → Challenge',
        description: 'React to news/trend and turn it into actionable challenge',
        base_type: 'news_reaction',
        blend_type: 'case_study',
        structure: 'Trend observation + Analysis + Try this challenge',
        examples: [
          'Everyone\'s talking about cold plunges. But 99% do it wrong. Here\'s the protocol that actually works...',
          'New ozempic study just dropped. Before you jump on it, try this natural approach for 30 days...'
        ],
        viral_potential: 0.95
      },
      
      {
        hybrid_id: 'controversy_education',
        name: 'Controversial Deep Dive',
        description: 'Controversial claim backed by educational breakdown',
        base_type: 'controversy',
        blend_type: 'thread_education',
        structure: 'Provocative claim + Evidence thread + Practical protocol',
        examples: [
          'Breakfast is NOT the most important meal. Thread on why meal timing is overrated...',
          'Stretching before exercise might INCREASE injury risk. Here\'s what the data shows...'
        ],
        viral_potential: 0.92
      },
      
      {
        hybrid_id: 'quick_educational',
        name: 'Quick Tip Thread',
        description: 'Simple tip expanded into educational framework',
        base_type: 'quick_tip',
        blend_type: 'thread_education',
        structure: 'Simple tip + Why it works + Full system',
        examples: [
          'Nasal breathing during exercise changes everything. Thread on respiratory efficiency...',
          'Cold showers in morning vs evening produce different effects. Here\'s the science...'
        ],
        viral_potential: 0.8
      },
      
      {
        hybrid_id: 'myth_buster_value',
        name: 'Myth Buster with Value',
        description: 'Debunk myth and provide better alternative',
        base_type: 'controversy',
        blend_type: 'quick_tip',
        structure: 'Common myth + Why it\'s wrong + What to do instead',
        examples: [
          'Myth: 8 hours sleep is mandatory. Reality: Sleep cycles matter more. Track these instead...',
          'Myth: Cardio best for fat loss. Truth: Resistance training wins long-term. Here\'s why...'
        ],
        viral_potential: 0.88
      }
    ];
  }
}

export const getHybridContentTypes = () => HybridContentTypes.getInstance();

