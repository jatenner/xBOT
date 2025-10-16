/**
 * Topic Expansion - MASSIVE diversity beyond just health
 * 
 * 15+ topic categories with AI-driven selection
 * Ensures content isn't limited to sleep/nutrition/exercise
 */

export interface TopicCategory {
  category_id: string;
  name: string;
  description: string;
  example_angles: string[];
  viral_potential: number; // 0-1
  follower_appeal: number; // 0-1
  evergreen: boolean; // Can be used anytime vs trending-dependent
}

export interface TopicSelection {
  category: TopicCategory;
  specific_angle: string;
  reason: string;
}

export class TopicExpansion {
  private static instance: TopicExpansion;
  private topics: TopicCategory[] = [];
  
  private constructor() {
    this.initializeTopics();
  }
  
  public static getInstance(): TopicExpansion {
    if (!TopicExpansion.instance) {
      TopicExpansion.instance = new TopicExpansion();
    }
    return TopicExpansion.instance;
  }
  
  /**
   * Select optimal topic with diversity
   */
  public async selectTopic(context?: {
    recentTopics?: string[];
    timeOfDay?: string;
    dayOfWeek?: string;
  }): Promise<TopicSelection> {
    
    console.log('[TOPIC_EXPANSION] 🎯 Selecting diverse topic...');
    
    // Filter out recently used topics
    const recentIds = context?.recentTopics || [];
    const candidates = this.topics.filter(t => 
      !recentIds.includes(t.category_id)
    );
    
    // Score topics
    const scored = candidates.map(topic => {
      let score = (topic.viral_potential * 0.4) + (topic.follower_appeal * 0.6);
      
      // Boost evergreen content
      if (topic.evergreen) {
        score *= 1.2;
      }
      
      // Random exploration factor
      const exploration = Math.random() * 0.3;
      
      return { topic, score: score + exploration };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    const selected = scored[0]?.topic || this.topics[0];
    const angle = selected.example_angles[Math.floor(Math.random() * selected.example_angles.length)];
    
    console.log(`[TOPIC_EXPANSION] ✅ Selected: ${selected.name} → "${angle}"`);
    
    return {
      category: selected,
      specific_angle: angle,
      reason: `Diverse topic selection: ${selected.name}`
    };
  }
  
  public getAllTopics(): TopicCategory[] {
    return [...this.topics];
  }
  
  private initializeTopics(): void {
    this.topics = [
      // Health & Biology (core, but specific niches)
      {
        category_id: 'health_optimization',
        name: 'Health Optimization',
        description: 'Sleep, nutrition, exercise science',
        example_angles: [
          'sleep architecture and REM cycles',
          'protein timing for muscle synthesis',
          'VO2 max and longevity correlation',
          'microbiome diversity and immunity',
          'circadian rhythm hacking',
          'metabolic flexibility training'
        ],
        viral_potential: 0.8,
        follower_appeal: 0.9,
        evergreen: true
      },
      
      // Neuroscience & Psychology
      {
        category_id: 'neuroscience',
        name: 'Neuroscience & Brain',
        description: 'How the brain works, cognitive enhancement',
        example_angles: [
          'neuroplasticity and habit formation',
          'dopamine reward systems',
          'focus and attention mechanisms',
          'memory consolidation during sleep',
          'brain-derived neurotrophic factor (BDNF)',
          'default mode network and creativity'
        ],
        viral_potential: 0.85,
        follower_appeal: 0.9,
        evergreen: true
      },
      
      {
        category_id: 'psychology',
        name: 'Psychology & Behavior',
        description: 'Human behavior, decision-making, mental models',
        example_angles: [
          'cognitive biases affecting health decisions',
          'willpower depletion myth',
          'identity-based habits',
          'loss aversion in fitness',
          'social proof and conformity',
          'mental models for better thinking'
        ],
        viral_potential: 0.9,
        follower_appeal: 0.85,
        evergreen: true
      },
      
      // Productivity & Performance
      {
        category_id: 'productivity',
        name: 'Productivity & Focus',
        description: 'Getting more done, deep work, time management',
        example_angles: [
          'ultradian rhythms for peak performance',
          'attention restoration theory',
          'timeboxing vs task-batching',
          'deep work protocols',
          'energy management over time management',
          'decision fatigue elimination'
        ],
        viral_potential: 0.85,
        follower_appeal: 0.9,
        evergreen: true
      },
      
      // Longevity & Aging
      {
        category_id: 'longevity',
        name: 'Longevity & Aging',
        description: 'Living longer, healthspan, anti-aging science',
        example_angles: [
          'senescent cell clearance',
          'NAD+ and cellular energy',
          'rapamycin and autophagy',
          'telomere length and lifestyle',
          'blue zones commonalities',
          'mitochondrial health optimization'
        ],
        viral_potential: 0.8,
        follower_appeal: 0.85,
        evergreen: true
      },
      
      // Technology & Innovation
      {
        category_id: 'technology',
        name: 'Technology & Innovation',
        description: 'Tech advances, AI, wearables, future of health',
        example_angles: [
          'continuous glucose monitors for non-diabetics',
          'AI in drug discovery',
          'gene editing possibilities',
          'wearable biometric tracking',
          'VR for pain management',
          'personalized medicine revolution'
        ],
        viral_potential: 0.9,
        follower_appeal: 0.8,
        evergreen: false
      },
      
      // Science & Research
      {
        category_id: 'science_discoveries',
        name: 'Science Discoveries',
        description: 'Recent studies, breakthrough research',
        example_angles: [
          'quantum biology in photosynthesis',
          'CRISPR applications beyond genes',
          'dark matter detection methods',
          'extremophile organisms',
          'consciousness theories',
          'climate adaptation mechanisms'
        ],
        viral_potential: 0.85,
        follower_appeal: 0.75,
        evergreen: false
      },
      
      // Philosophy & Thinking
      {
        category_id: 'philosophy',
        name: 'Philosophy & Mental Models',
        description: 'How to think better, frameworks, wisdom',
        example_angles: [
          'stoic principles for modern life',
          'first principles thinking',
          'second-order thinking',
          'inversion as problem-solving',
          'probabilistic thinking',
          'systems thinking vs linear thinking'
        ],
        viral_potential: 0.8,
        follower_appeal: 0.8,
        evergreen: true
      },
      
      // Economics & Systems
      {
        category_id: 'economics',
        name: 'Economics & Incentives',
        description: 'How systems and incentives shape behavior',
        example_angles: [
          'incentive structures in healthcare',
          'game theory in daily life',
          'network effects and winner-take-all',
          'principal-agent problems',
          'revealed preferences vs stated preferences',
          'Goodhart\'s law in metrics'
        ],
        viral_potential: 0.75,
        follower_appeal: 0.7,
        evergreen: true
      },
      
      // Evolution & Biology
      {
        category_id: 'evolution',
        name: 'Evolution & Biology',
        description: 'Evolutionary perspective on modern life',
        example_angles: [
          'mismatch theory and modern diseases',
          'evolutionary psychology of food cravings',
          'sexual selection and behavior',
          'kin selection and altruism',
          'evolutionary arms races',
          'spandrels in human design'
        ],
        viral_potential: 0.8,
        follower_appeal: 0.75,
        evergreen: true
      },
      
      // Data & Statistics
      {
        category_id: 'data_science',
        name: 'Data & Statistics',
        description: 'Understanding numbers, avoiding statistical fallacies',
        example_angles: [
          'p-hacking in research',
          'survivorship bias in success stories',
          'regression to the mean',
          'base rate neglect',
          'correlation vs causation examples',
          'selection bias in studies'
        ],
        viral_potential: 0.7,
        follower_appeal: 0.75,
        evergreen: true
      },
      
      // History & Patterns
      {
        category_id: 'history',
        name: 'History & Patterns',
        description: 'Historical patterns, lessons from the past',
        example_angles: [
          'medical breakthroughs and paradigm shifts',
          'forgotten ancient health practices',
          'cyclical nature of health trends',
          'historical nutrition disasters',
          'plague responses through history',
          'evolution of medical understanding'
        ],
        viral_potential: 0.75,
        follower_appeal: 0.7,
        evergreen: true
      },
      
      // Current Events & News
      {
        category_id: 'current_events',
        name: 'Current Events & Trends',
        description: 'Recent news, trending topics, timely commentary',
        example_angles: [
          'latest health policy changes',
          'viral fitness trends analysis',
          'new supplement controversies',
          'celebrity health claims debunked',
          'breaking research studies',
          'health misinformation trends'
        ],
        viral_potential: 0.95,
        follower_appeal: 0.85,
        evergreen: false
      },
      
      // Controversial & Debate
      {
        category_id: 'controversy',
        name: 'Controversial Topics',
        description: 'Debates, contrarian takes, challenge consensus',
        example_angles: [
          'carnivore diet evidence review',
          'seed oils debate',
          'statin controversy',
          'mammography screening debate',
          'BMI as health metric',
          'breakfast necessity myth'
        ],
        viral_potential: 0.95,
        follower_appeal: 0.9,
        evergreen: true
      },
      
      // Meta-Learning
      {
        category_id: 'learning',
        name: 'Learning & Skills',
        description: 'How to learn effectively, skill acquisition',
        example_angles: [
          'spaced repetition systems',
          'deliberate practice principles',
          'transfer of learning',
          'desirable difficulty',
          'chunking and expertise',
          'interleaving vs blocking'
        ],
        viral_potential: 0.8,
        follower_appeal: 0.85,
        evergreen: true
      },
      
      // Fascinating Facts
      {
        category_id: 'fascinating',
        name: 'Fascinating Facts',
        description: 'Mind-blowing facts from any domain',
        example_angles: [
          'quantum entanglement at body temp',
          'octopus intelligence and distributed brain',
          'tardigrade survival abilities',
          'mantis shrimp vision capabilities',
          'whale communication across oceans',
          'fungal networks and tree communication'
        ],
        viral_potential: 0.9,
        follower_appeal: 0.8,
        evergreen: true
      }
    ];
  }
}

export const getTopicExpansion = () => TopicExpansion.getInstance();

