/**
 * 📊 EMOTIONAL INTELLIGENCE ENGINE
 * Adds psychological depth and emotional triggers to content
 */

export interface EmotionalProfile {
  primaryEmotion: string;
  triggers: string[];
  psychologyPrinciples: string[];
  viralMechanisms: string[];
  persuasionTactics: string[];
}

export class EmotionalIntelligenceEngine {
  private static instance: EmotionalIntelligenceEngine;

  private emotionalFrameworks: EmotionalProfile[] = [
    {
      primaryEmotion: "Curiosity",
      triggers: ["information gaps", "partial reveals", "insider secrets", "contrarian facts"],
      psychologyPrinciples: ["Zeigarnik Effect", "Information Gap Theory", "Curiosity Loops"],
      viralMechanisms: ["cliffhanger statements", "numbered lists with missing items", "partial case studies"],
      persuasionTactics: ["hint at exclusive knowledge", "tease full revelation", "create knowledge FOMO"]
    },
    {
      primaryEmotion: "Surprise",
      triggers: ["counter-intuitive facts", "debunked myths", "unexpected connections", "plot twists"],
      psychologyPrinciples: ["Expectancy Violation", "Cognitive Dissonance", "Pattern Interrupt"],
      viralMechanisms: ["myth-busting revelations", "opposite-day facts", "everything-you-know-is-wrong"],
      persuasionTactics: ["challenge assumptions", "flip conventional wisdom", "reveal hidden truths"]
    },
    {
      primaryEmotion: "Fear/Urgency",
      triggers: ["health risks", "time pressure", "scarcity", "missing out", "industry secrets"],
      psychologyPrinciples: ["Loss Aversion", "Scarcity Principle", "Urgency Bias"],
      viralMechanisms: ["health warnings", "limited-time insights", "industry cover-ups"],
      persuasionTactics: ["highlight what people risk losing", "create time pressure", "expose hidden dangers"]
    },
    {
      primaryEmotion: "Validation/Pride",
      triggers: ["elite knowledge", "insider status", "being ahead of curve", "sophisticated understanding"],
      psychologyPrinciples: ["Social Proof", "Authority Bias", "In-group Preference"],
      viralMechanisms: ["elite performer secrets", "high-status knowledge", "insider protocols"],
      persuasionTactics: ["position as exclusive club", "validate intelligence", "offer status symbols"]
    },
    {
      primaryEmotion: "Hope/Optimism",
      triggers: ["breakthrough solutions", "success stories", "future possibilities", "empowerment"],
      psychologyPrinciples: ["Optimism Bias", "Self-Efficacy", "Growth Mindset"],
      viralMechanisms: ["transformation stories", "breakthrough discoveries", "empowering protocols"],
      persuasionTactics: ["show path to better future", "highlight progress", "demonstrate possibility"]
    }
  ];

  public static getInstance(): EmotionalIntelligenceEngine {
    if (!EmotionalIntelligenceEngine.instance) {
      EmotionalIntelligenceEngine.instance = new EmotionalIntelligenceEngine();
    }
    return EmotionalIntelligenceEngine.instance;
  }

  /**
   * 🧠 Select optimal emotional framework for content
   */
  selectEmotionalFramework(topic: string, targetEngagement: string): EmotionalProfile {
    const topicLower = topic.toLowerCase();
    
    // Topic-based emotion mapping
    if (topicLower.includes('risk') || topicLower.includes('danger') || topicLower.includes('warning')) {
      return this.emotionalFrameworks.find(f => f.primaryEmotion === "Fear/Urgency")!;
    }
    
    if (topicLower.includes('myth') || topicLower.includes('truth') || topicLower.includes('secret')) {
      return this.emotionalFrameworks.find(f => f.primaryEmotion === "Surprise")!;
    }
    
    if (topicLower.includes('elite') || topicLower.includes('exclusive') || topicLower.includes('insider')) {
      return this.emotionalFrameworks.find(f => f.primaryEmotion === "Validation/Pride")!;
    }
    
    if (topicLower.includes('breakthrough') || topicLower.includes('cure') || topicLower.includes('solution')) {
      return this.emotionalFrameworks.find(f => f.primaryEmotion === "Hope/Optimism")!;
    }
    
    // Default to curiosity for general engagement
    return this.emotionalFrameworks.find(f => f.primaryEmotion === "Curiosity")!;
  }

  /**
   * 🎯 Generate emotional intelligence prompt enhancement
   */
  generateEmotionalPrompt(framework: EmotionalProfile): string {
    return `
🧠 EMOTIONAL INTELLIGENCE FRAMEWORK: ${framework.primaryEmotion.toUpperCase()}

🎯 PSYCHOLOGICAL TRIGGERS TO ACTIVATE:
${framework.triggers.map(trigger => `- ${trigger}`).join('\n')}

📊 PSYCHOLOGY PRINCIPLES TO LEVERAGE:
${framework.psychologyPrinciples.map(principle => `- ${principle}`).join('\n')}

🔥 VIRAL MECHANISMS TO EMPLOY:
${framework.viralMechanisms.map(mechanism => `- ${mechanism}`).join('\n')}

⚡ PERSUASION TACTICS TO USE:
${framework.persuasionTactics.map(tactic => `- ${tactic}`).join('\n')}

🎭 EMOTIONAL EXECUTION INSTRUCTIONS:
- Primary goal: Trigger ${framework.primaryEmotion.toLowerCase()} in the first 10 words
- Use specific ${framework.triggers[0]} to create immediate emotional hook
- Apply ${framework.psychologyPrinciples[0]} throughout the content structure
- End with ${framework.persuasionTactics[0]} to drive action

💡 ADVANCED EMOTIONAL OPTIMIZATION:
- Layer multiple triggers for compound emotional impact
- Use emotional progression (build tension → reveal → resolution)
- Create emotional contrast (fear → hope, confusion → clarity)
- Include emotional proof points (testimonials, case studies, data)
`;
  }

  /**
   * 🧬 Analyze content for emotional impact
   */
  analyzeEmotionalImpact(content: string): {
    emotionalScore: number;
    detectedEmotions: string[];
    triggerWords: string[];
    improvementSuggestions: string[];
  } {
    const triggerWords = [];
    const detectedEmotions = [];
    
    // Analyze for emotional trigger words
    const curiosityWords = ['secret', 'hidden', 'reveal', 'discover', 'unknown', 'mystery'];
    const surpriseWords = ['shocking', 'surprising', 'unexpected', 'myth', 'truth', 'actually'];
    const fearWords = ['danger', 'risk', 'warning', 'avoid', 'mistake', 'wrong'];
    const validationWords = ['elite', 'exclusive', 'insider', 'expert', 'advanced', 'sophisticated'];
    const hopeWords = ['breakthrough', 'solution', 'cure', 'transform', 'improve', 'optimize'];
    
    const allTriggers = [
      ...curiosityWords.map(w => ({ word: w, emotion: 'Curiosity' })),
      ...surpriseWords.map(w => ({ word: w, emotion: 'Surprise' })),
      ...fearWords.map(w => ({ word: w, emotion: 'Fear' })),
      ...validationWords.map(w => ({ word: w, emotion: 'Validation' })),
      ...hopeWords.map(w => ({ word: w, emotion: 'Hope' }))
    ];
    
    const contentLower = content.toLowerCase();
    allTriggers.forEach(trigger => {
      if (contentLower.includes(trigger.word)) {
        triggerWords.push(trigger.word);
        if (!detectedEmotions.includes(trigger.emotion)) {
          detectedEmotions.push(trigger.emotion);
        }
      }
    });
    
    // Calculate emotional score
    const emotionalScore = Math.min(100, triggerWords.length * 15 + detectedEmotions.length * 10);
    
    // Generate improvement suggestions
    const improvements = [];
    if (emotionalScore < 30) improvements.push("Add more emotional trigger words");
    if (detectedEmotions.length < 2) improvements.push("Layer multiple emotions for compound impact");
    if (!triggerWords.some(w => ['secret', 'exclusive', 'breakthrough'].includes(w))) {
      improvements.push("Add authority/exclusivity triggers");
    }
    
    return {
      emotionalScore,
      detectedEmotions,
      triggerWords,
      improvementSuggestions: improvements
    };
  }
}
