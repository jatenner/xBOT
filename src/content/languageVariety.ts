/**
 * Language Variety Engine - Ensures diverse writing styles and formats
 * Inspired by Colin Rugg's successful content variety
 */

export class LanguageVarietyEngine {
  private static instance: LanguageVarietyEngine;
  private recentPatterns: string[] = [];
  private maxPattern = 10; // Track last 10 patterns to avoid repetition

  static getInstance(): LanguageVarietyEngine {
    if (!this.instance) {
      this.instance = new LanguageVarietyEngine();
    }
    return this.instance;
  }

  /**
   * Get a diverse hook pattern that hasn't been used recently
   */
  getDiverseHook(topic: string, format: 'single' | 'thread' = 'single'): string {
    const hookPatterns = {
      breaking_news: [
        "BREAKING:",
        "NEW STUDY:",
        "MAJOR DISCOVERY:",
        "SCIENTISTS REVEAL:",
        "EXCLUSIVE:",
        "JUST IN:",
        "URGENT UPDATE:"
      ],
      
      explainer: [
        "Let me break this down:",
        "Here's what's really happening:",
        "The truth about {topic}:",
        "Most people don't understand {topic}. Here's why:",
        "What experts won't tell you about {topic}:",
        "The real story behind {topic}:",
        "Here's why {topic} matters:"
      ],
      
      investigative: [
        "I investigated {topic}. What I found was disturbing:",
        "After digging into {topic}, here's what I discovered:",
        "Nobody is talking about this {topic} issue:",
        "The cover-up around {topic} runs deep:",
        "They don't want you to know about {topic}:",
        "Hidden truth about {topic}:"
      ],
      
      data_driven: [
        "The numbers on {topic} are staggering:",
        "New data reveals shocking truth about {topic}:",
        "Research shows {topic} is worse than we thought:",
        "The statistics behind {topic} will blow your mind:",
        "Data doesn't lie about {topic}:",
        "Here's what the research really says about {topic}:"
      ],
      
      personal: [
        "I've been studying {topic} for years. Here's what I learned:",
        "My experience with {topic} changed everything:",
        "After testing {topic} for 30 days:",
        "What I wish I knew about {topic} earlier:",
        "My controversial take on {topic}:",
        "Why I changed my mind about {topic}:"
      ],
      
      question_based: [
        "Why do 99% of people get {topic} wrong?",
        "What if everything you know about {topic} is false?",
        "How does {topic} actually work?",
        "Is {topic} actually dangerous?",
        "Why isn't anyone talking about {topic}?",
        "What's the real truth about {topic}?"
      ]
    };

    // Get all available patterns
    const allPatterns = Object.values(hookPatterns).flat();
    
    // Filter out recently used patterns
    const availablePatterns = allPatterns.filter(pattern => 
      !this.recentPatterns.includes(pattern)
    );
    
    // If all patterns used, reset
    const patterns = availablePatterns.length > 0 ? availablePatterns : allPatterns;
    
    // Select random pattern
    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];
    
    // Track usage
    this.recentPatterns.push(selectedPattern);
    if (this.recentPatterns.length > this.maxPattern) {
      this.recentPatterns.shift();
    }
    
    // Replace placeholder with topic
    return selectedPattern.replace(/{topic}/g, topic.toLowerCase());
  }

  /**
   * Get diverse transition phrases
   */
  getDiverseTransition(): string {
    const transitions = [
      "But here's the kicker:",
      "Here's where it gets interesting:",
      "But wait, there's more:",
      "The plot thickens:",
      "It gets worse:",
      "Here's the shocking part:",
      "But that's not all:",
      "The real bombshell:",
      "Here's what's really happening:",
      "The truth is even stranger:",
      "Pay close attention:",
      "This is where it gets crazy:",
      "Here's the part that blew my mind:",
      "But then I discovered something:",
      "The research reveals:",
      "Scientists found:",
      "But the data shows:",
      "Here's what changed everything:"
    ];
    
    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  /**
   * Get diverse conclusion phrases
   */
  getDiverseConclusion(): string {
    const conclusions = [
      "This changes everything.",
      "The implications are huge.",
      "Think about that for a second.",
      "Let that sink in.",
      "This is just the beginning.",
      "The evidence speaks for itself.",
      "Make of that what you will.",
      "Draw your own conclusions.",
      "The numbers don't lie.",
      "Actions speak louder than words.",
      "This is why it matters.",
      "The truth is finally out.",
      "Now you know.",
      "Share this with someone who needs to know.",
      "Don't let them fool you.",
      "The choice is yours.",
      "This could save your life.",
      "Your health depends on it.",
      "Knowledge is power.",
      "Stay informed."
    ];
    
    return conclusions[Math.floor(Math.random() * conclusions.length)];
  }

  /**
   * Get diverse formatting styles
   */
  getFormatStyle(): {
    style: 'numbered' | 'bulleted' | 'narrative' | 'qa' | 'timeline';
    prefix: string;
  } {
    const styles = [
      { style: 'numbered' as const, prefix: '1.' },
      { style: 'bulleted' as const, prefix: '•' },
      { style: 'narrative' as const, prefix: '' },
      { style: 'qa' as const, prefix: 'Q:' },
      { style: 'timeline' as const, prefix: '📅' }
    ];
    
    return styles[Math.floor(Math.random() * styles.length)];
  }

  /**
   * Generate diverse content structure
   */
  generateContentStructure(facts: string[]): {
    hook: string;
    body: string[];
    conclusion: string;
    style: string;
  } {
    const hook = this.getDiverseHook("health topic");
    const transition = this.getDiverseTransition();
    const conclusion = this.getDiverseConclusion();
    const format = this.getFormatStyle();
    
    let body: string[] = [];
    
    switch (format.style) {
      case 'numbered':
        body = facts.map((fact, i) => `${i + 1}. ${fact}`);
        break;
      case 'bulleted':
        body = facts.map(fact => `• ${fact}`);
        break;
      case 'narrative':
        body = [transition, '', ...facts];
        break;
      case 'qa':
        body = facts.map((fact, i) => 
          i % 2 === 0 ? `Q: ${fact}` : `A: ${fact}`
        );
        break;
      case 'timeline':
        body = facts.map(fact => `📅 ${fact}`);
        break;
    }
    
    return {
      hook,
      body,
      conclusion,
      style: format.style
    };
  }
}

export default LanguageVarietyEngine;
