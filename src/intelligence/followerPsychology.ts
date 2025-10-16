/**
 * Follower Psychology Engine
 * 
 * Understands WHY people follow accounts and builds it into content:
 * - Consistent value in specific niche
 * - Unique perspective/voice
 * - Entertainment + education mix
 * - Insider knowledge feeling
 * - Community/belonging
 */

export interface FollowerMotive {
  motive_id: string;
  name: string;
  description: string;
  content_characteristics: string[];
  examples: string[];
  weight: number; // How important is this motive
}

export interface PsychologyGuidance {
  primary_motive: FollowerMotive;
  secondary_motive: FollowerMotive;
  content_instructions: string[];
  voice_guidance: string;
  avoid: string[];
}

export class FollowerPsychology {
  private static instance: FollowerPsychology;
  private motives: FollowerMotive[] = [];
  
  private constructor() {
    this.initializeMotives();
  }
  
  public static getInstance(): FollowerPsychology {
    if (!FollowerPsychology.instance) {
      FollowerPsychology.instance = new FollowerPsychology();
    }
    return FollowerPsychology.instance;
  }
  
  /**
   * Get follower psychology guidance for content
   */
  public getPsychologyGuidance(): PsychologyGuidance {
    // Weighted random selection of primary motive
    const totalWeight = this.motives.reduce((sum, m) => sum + m.weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulative = 0;
    let primary = this.motives[0];
    
    for (const motive of this.motives) {
      cumulative += motive.weight;
      if (random <= cumulative) {
        primary = motive;
        break;
      }
    }
    
    // Select different secondary motive
    const secondary = this.motives.find(m => m.motive_id !== primary.motive_id) || this.motives[1];
    
    console.log(`[PSYCHOLOGY] 🧠 Primary: ${primary.name}, Secondary: ${secondary.name}`);
    
    return {
      primary_motive: primary,
      secondary_motive: secondary,
      content_instructions: [
        ...primary.content_characteristics.slice(0, 2),
        ...secondary.content_characteristics.slice(0, 1)
      ],
      voice_guidance: this.getVoiceGuidance(primary, secondary),
      avoid: [
        'Generic advice',
        'Obvious information',
        'Salesy language',
        'Excessive hashtags',
        'Robotic tone'
      ]
    };
  }
  
  private getVoiceGuidance(primary: FollowerMotive, secondary: FollowerMotive): string {
    const voices = {
      value_provider: 'Authoritative expert sharing actionable insights',
      thought_leader: 'Provocative thinker challenging conventional wisdom',
      entertainer: 'Engaging storyteller mixing education with entertainment',
      insider: 'Well-connected insider sharing exclusive knowledge',
      community_builder: 'Relatable peer building community through shared experiences'
    };
    
    return voices[primary.motive_id as keyof typeof voices] || voices.value_provider;
  }
  
  private initializeMotives(): void {
    this.motives = [
      {
        motive_id: 'value_provider',
        name: 'Consistent Value Provider',
        description: 'People follow for reliable, high-quality information',
        content_characteristics: [
          'Provide specific, actionable information',
          'Include numbers, data, research',
          'Solve real problems people have',
          'Be consistently useful',
          'Build authority through demonstration'
        ],
        examples: [
          'Here are 3 specific changes that improved my sleep quality by 40%',
          'New study (n=2,847) shows this timing increases results by 23%',
          'After testing 15 protocols, this one actually works'
        ],
        weight: 0.3
      },
      
      {
        motive_id: 'thought_leader',
        name: 'Unique Perspective / Thought Leader',
        description: 'People follow for unique takes and contrarian wisdom',
        content_characteristics: [
          'Challenge conventional thinking',
          'Provide unique angles on common topics',
          'Connect unexpected dots',
          'Be provocative but backed by evidence',
          'Make people think differently'
        ],
        examples: [
          'Everyone optimizes morning routines. The real leverage is in your evening.',
          'Sleep supplements are backwards. Here\'s what actually regulates circadian rhythm.',
          'Conventional fitness advice ignores evolutionary biology'
        ],
        weight: 0.25
      },
      
      {
        motive_id: 'entertainer',
        name: 'Entertainment + Education',
        description: 'People follow to be entertained while learning',
        content_characteristics: [
          'Make learning enjoyable',
          'Use storytelling and narrative',
          'Include surprising twists',
          'Be conversational and engaging',
          'Mix humor with insights'
        ],
        examples: [
          'I accidentally discovered this while trying to fix my terrible sleep...',
          'The placebo effect is so strong, it works even when you know it\'s placebo',
          'Your gut bacteria are literally controlling your food cravings'
        ],
        weight: 0.2
      },
      
      {
        motive_id: 'insider',
        name: 'Insider Knowledge',
        description: 'People follow for exclusive, hard-to-find information',
        content_characteristics: [
          'Share non-obvious insights',
          'Reference cutting-edge research',
          'Explain what insiders know',
          'Provide exclusive frameworks',
          'Be ahead of trends'
        ],
        examples: [
          'Most doctors don\'t know this about metabolic flexibility',
          'Longevity researchers are quietly doing this',
          'Here\'s what the latest research actually shows (not headlines)'
        ],
        weight: 0.15
      },
      
      {
        motive_id: 'community_builder',
        name: 'Community & Belonging',
        description: 'People follow to be part of a community',
        content_characteristics: [
          'Create sense of belonging',
          'Use inclusive language',
          'Build shared identity',
          'Encourage participation',
          'Foster community feeling'
        ],
        examples: [
          'If you\'re optimizing health, you\'re in the right place',
          'We\'re all experimenting and learning together',
          'Fellow biohackers will appreciate this'
        ],
        weight: 0.1
      }
    ];
  }
  
  /**
   * Get all motives for inspection
   */
  public getAllMotives(): FollowerMotive[] {
    return [...this.motives];
  }
}

export const getFollowerPsychology = () => FollowerPsychology.getInstance();

