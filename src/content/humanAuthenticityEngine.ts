/**
 * HUMAN AUTHENTICITY ENGINE
 * 
 * Fixes robotic content by adding human personality, natural flow,
 * and authentic voice patterns that actually engage people.
 */

interface AuthenticContent {
  content: string;
  humanityScore: number;
  authenticityFactors: string[];
  personality: string;
}

interface VoicePattern {
  pattern: string;
  examples: string[];
  tone: 'casual' | 'confident' | 'controversial' | 'personal';
}

export class HumanAuthenticityEngine {
  private static instance: HumanAuthenticityEngine;

  // Natural human conversation starters
  private humanHooks: VoicePattern[] = [
    {
      pattern: "personal_realization",
      examples: [
        "I used to think X until...",
        "For years I believed X, then I discovered...",
        "I was completely wrong about X. Here's what changed my mind:",
        "I fell for the X myth too. Then reality hit:"
      ],
      tone: 'personal'
    },
    {
      pattern: "observation",
      examples: [
        "Here's what nobody talks about:",
        "Something weird I noticed:",
        "This is going to sound crazy, but:",
        "I keep seeing people make the same mistake:"
      ],
      tone: 'casual'
    },
    {
      pattern: "direct_statement",
      examples: [
        "Let's be honest:",
        "Real talk:",
        "Here's the truth:",
        "Nobody wants to say this, but:"
      ],
      tone: 'confident'
    },
    {
      pattern: "story_setup",
      examples: [
        "Last week, something happened that blew my mind:",
        "I just had a conversation that changed everything:",
        "My friend asked me a question that stopped me cold:",
        "I witnessed something that proves my point:"
      ],
      tone: 'personal'
    }
  ];

  // Natural transitions and connectors
  private naturalTransitions = [
    "Here's the thing:",
    "But here's what's crazy:",
    "The plot twist?",
    "Here's where it gets interesting:",
    "But wait, it gets worse:",
    "The kicker?",
    "What blew my mind:",
    "The part that shocked me:"
  ];

  // Human language patterns that sound natural
  private humanLanguagePatterns = {
    // Replace clinical terms with human ones
    clinical_to_human: new Map([
      ["systematic review shows", "research proves"],
      ["meta-analysis indicates", "studies found"],
      ["clinical studies demonstrate", "science shows"],
      ["evidence suggests", "turns out"],
      ["data indicates", "the numbers show"],
      ["research concludes", "researchers found"],
      ["analysis reveals", "when they looked deeper"],
      ["findings show", "what they discovered"]
    ]),

    // Replace robotic phrases with natural ones
    robotic_to_natural: new Map([
      ["deep dive: the psychology behind", "here's what's really happening with"],
      ["fascinating insight into", "crazy thing about"],
      ["comprehensive analysis of", "when you really look at"],
      ["optimization strategies for", "better ways to"],
      ["implementation of methodologies", "actually doing this stuff"],
      ["evidence-based approach", "what actually works"],
      ["systematic methodology", "the right way to do this"]
    ]),

    // Add natural speech patterns
    conversation_fillers: [
      "honestly,",
      "look,",
      "listen,",
      "okay,",
      "so,",
      "anyway,",
      "but seriously,",
      "I mean,"
    ]
  };

  // Personality voices to choose from
  private personalityVoices = {
    skeptical_insider: {
      tone: "I've seen behind the curtain",
      phrases: ["I used to work in X", "From the inside", "They don't tell you", "Industry secret"]
    },
    reformed_believer: {
      tone: "I used to believe the lies",
      phrases: ["I was naive", "I fell for it too", "I used to think", "Until I learned"]
    },
    truth_teller: {
      tone: "Someone has to say it",
      phrases: ["Nobody talks about", "The truth is", "Let's be real", "Here's what's actually happening"]
    },
    relatable_friend: {
      tone: "We're in this together",
      phrases: ["We've all been there", "You know that feeling", "Same thing happened to me", "Here's what I learned"]
    }
  };

  private constructor() {}

  public static getInstance(): HumanAuthenticityEngine {
    if (!HumanAuthenticityEngine.instance) {
      HumanAuthenticityEngine.instance = new HumanAuthenticityEngine();
    }
    return HumanAuthenticityEngine.instance;
  }

  /**
   * Transform robotic content into authentic human voice
   */
  humanizeContent(roboticContent: string, topic: string): AuthenticContent {
    console.log('🎭 HUMANIZING: Converting robotic content to authentic voice');

    let humanized = roboticContent;
    const authenticityFactors: string[] = [];
    let humanityScore = 0;

    // 1. Select personality for this post
    const personality = this.selectPersonality(topic);
    authenticityFactors.push(`Personality: ${personality}`);
    humanityScore += 15;

    // 2. Replace clinical language
    humanized = this.replaceClinicalLanguage(humanized);
    if (humanized !== roboticContent) {
      authenticityFactors.push('Replaced clinical language');
      humanityScore += 20;
    }

    // 3. Add human hook
    humanized = this.addHumanHook(humanized, personality);
    authenticityFactors.push('Added personal hook');
    humanityScore += 25;

    // 4. Improve flow and transitions
    humanized = this.improveFlow(humanized);
    authenticityFactors.push('Improved natural flow');
    humanityScore += 20;

    // 5. Add personality voice
    humanized = this.addPersonalityVoice(humanized, personality);
    authenticityFactors.push('Added authentic voice');
    humanityScore += 20;

    console.log(`✅ Humanized with ${humanityScore}% humanity score`);

    return {
      content: humanized,
      humanityScore,
      authenticityFactors,
      personality
    };
  }

  /**
   * Select appropriate personality based on topic
   */
  private selectPersonality(topic: string): string {
    if (topic.includes('industry') || topic.includes('insider') || topic.includes('secret')) {
      return 'skeptical_insider';
    } else if (topic.includes('myth') || topic.includes('wrong') || topic.includes('mistake')) {
      return 'reformed_believer';
    } else if (topic.includes('truth') || topic.includes('reality') || topic.includes('honest')) {
      return 'truth_teller';
    } else {
      return 'relatable_friend';
    }
  }

  /**
   * Replace clinical/academic language with human language
   */
  private replaceClinicalLanguage(content: string): string {
    let humanized = content.toLowerCase();

    // Replace clinical terms
    for (const [clinical, human] of this.humanLanguagePatterns.clinical_to_human) {
      humanized = humanized.replace(new RegExp(clinical, 'gi'), human);
    }

    // Replace robotic phrases
    for (const [robotic, natural] of this.humanLanguagePatterns.robotic_to_natural) {
      humanized = humanized.replace(new RegExp(robotic, 'gi'), natural);
    }

    // Capitalize first letter
    return humanized.charAt(0).toUpperCase() + humanized.slice(1);
  }

  /**
   * Add authentic human hook at the beginning
   */
  private addHumanHook(content: string, personality: string): string {
    const relevantHooks = this.humanHooks.filter(h => 
      personality === 'personal' ? h.tone === 'personal' : true
    );
    
    const selectedHook = relevantHooks[Math.floor(Math.random() * relevantHooks.length)];
    const hookExample = selectedHook.examples[Math.floor(Math.random() * selectedHook.examples.length)];
    
    // Don't add hook if content already has a personal beginning
    if (content.toLowerCase().startsWith('i ') || content.toLowerCase().includes('spent $')) {
      return content;
    }
    
    return `${hookExample}\n\n${content}`;
  }

  /**
   * Improve natural flow and transitions
   */
  private improveFlow(content: string): string {
    const sentences = content.split('. ');
    if (sentences.length < 2) return content;

    let improved = sentences[0];

    for (let i = 1; i < sentences.length; i++) {
      // Add natural transitions between sentences
      if (i === Math.floor(sentences.length / 2)) {
        const transition = this.naturalTransitions[Math.floor(Math.random() * this.naturalTransitions.length)];
        improved += `. ${transition} ${sentences[i]}`;
      } else {
        improved += `. ${sentences[i]}`;
      }
    }

    return improved;
  }

  /**
   * Add personality-specific voice patterns
   */
  private addPersonalityVoice(content: string, personality: string): string {
    const voice = this.personalityVoices[personality as keyof typeof this.personalityVoices];
    
    if (!voice) return content;

    // Add personality phrase if not already present
    const hasPersonalityPhrase = voice.phrases.some(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    );

    if (!hasPersonalityPhrase) {
      const phrase = voice.phrases[Math.floor(Math.random() * voice.phrases.length)];
      // Insert personality phrase naturally
      content = content.replace(/\. ([A-Z])/, `. ${phrase}: $1`);
    }

    return content;
  }

  /**
   * Quick authenticity check
   */
  checkAuthenticity(content: string): {
    score: number;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for robotic patterns
    if (content.includes('systematic review') || content.includes('meta-analysis')) {
      issues.push('Clinical language detected');
      suggestions.push('Use "research shows" instead of clinical terms');
      score -= 20;
    }

    if (content.includes('deep dive:') || content.includes('comprehensive analysis')) {
      issues.push('Robotic phrases detected');
      suggestions.push('Start with personal observations');
      score -= 15;
    }

    // Check for human elements
    if (!content.toLowerCase().includes('i ') && !content.includes('you ')) {
      issues.push('No personal pronouns');
      suggestions.push('Add "I" or "you" for human connection');
      score -= 25;
    }

    if (content.split('\n\n').length < 2) {
      issues.push('No paragraph breaks');
      suggestions.push('Break into digestible chunks');
      score -= 10;
    }

    return { score: Math.max(0, score), issues, suggestions };
  }
}
