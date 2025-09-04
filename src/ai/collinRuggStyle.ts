/**
 * Colin Rugg-inspired content formatting and storytelling techniques
 * Based on his viral Twitter success with news and explanatory content
 */

export interface RuggStylePost {
  format: 'breaking_news' | 'explainer' | 'story_thread' | 'data_story' | 'investigative';
  hook: string;
  body: string[];
  conclusion?: string;
  language_style: 'accessible' | 'authoritative' | 'investigative' | 'conversational';
}

export class CollinRuggStyleGenerator {
  
  /**
   * Generate content using Colin Rugg's proven formatting techniques
   */
  static generateHealthNews(topic: string, facts: string[]): RuggStylePost {
    const formats = [
      'breaking_news',
      'explainer', 
      'data_story',
      'investigative'
    ] as const;
    
    const format = formats[Math.floor(Math.random() * formats.length)];
    
    switch (format) {
      case 'breaking_news':
        return this.createBreakingNewsFormat(topic, facts);
      case 'explainer':
        return this.createExplainerFormat(topic, facts);
      case 'data_story':
        return this.createDataStoryFormat(topic, facts);
      case 'investigative':
        return this.createInvestigativeFormat(topic, facts);
      default:
        return this.createExplainerFormat(topic, facts);
    }
  }

  private static createBreakingNewsFormat(topic: string, facts: string[]): RuggStylePost {
    const hooks = [
      "BREAKING:",
      "NEW STUDY:",
      "MAJOR DISCOVERY:",
      "SCIENTISTS REVEAL:",
      "LEAKED DOCUMENTS:",
      "EXCLUSIVE:",
      "JUST IN:"
    ];
    
    const hook = `${hooks[Math.floor(Math.random() * hooks.length)]} ${topic}`;
    
    return {
      format: 'breaking_news',
      hook,
      body: [
        "Here's what you need to know:",
        "",
        ...facts.map((fact, i) => `${i + 1}. ${fact}`),
        "",
        "This changes everything."
      ],
      language_style: 'authoritative'
    };
  }

  private static createExplainerFormat(topic: string, facts: string[]): RuggStylePost {
    const hooks = [
      `Let me explain why ${topic.toLowerCase()} matters:`,
      `Here's the truth about ${topic.toLowerCase()}:`,
      `Most people don't understand ${topic.toLowerCase()}. Here's why:`,
      `The real story behind ${topic.toLowerCase()}:`,
      `What the experts won't tell you about ${topic.toLowerCase()}:`
    ];
    
    return {
      format: 'explainer',
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: [
        "🧵 Thread:",
        "",
        ...facts.map((fact, i) => `${i + 1}/ ${fact}`),
        "",
        "The implications are massive."
      ],
      conclusion: "Share this with someone who needs to know.",
      language_style: 'accessible'
    };
  }

  private static createDataStoryFormat(topic: string, facts: string[]): RuggStylePost {
    const hooks = [
      `The numbers on ${topic.toLowerCase()} are staggering:`,
      `New data reveals shocking truth about ${topic.toLowerCase()}:`,
      `The statistics behind ${topic.toLowerCase()} will blow your mind:`,
      `Research shows ${topic.toLowerCase()} is worse than we thought:`
    ];
    
    return {
      format: 'data_story',
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: [
        "📊 The data:",
        "",
        ...facts.map((fact, i) => `• ${fact}`),
        "",
        "These numbers don't lie."
      ],
      conclusion: "The evidence is clear.",
      language_style: 'authoritative'
    };
  }

  private static createInvestigativeFormat(topic: string, facts: string[]): RuggStylePost {
    const hooks = [
      `I investigated ${topic.toLowerCase()}. What I found was disturbing:`,
      `After digging into ${topic.toLowerCase()}, here's what I discovered:`,
      `Nobody is talking about this ${topic.toLowerCase()} scandal:`,
      `The cover-up around ${topic.toLowerCase()} runs deep:`
    ];
    
    return {
      format: 'investigative',
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: [
        "🔍 What I uncovered:",
        "",
        ...facts.map((fact, i) => `${i + 1}) ${fact}`),
        "",
        "They don't want you to know this."
      ],
      conclusion: "Do your own research.",
      language_style: 'investigative'
    };
  }

  /**
   * Convert RuggStylePost to tweet format
   */
  static formatForTwitter(post: RuggStylePost): string {
    const parts = [post.hook];
    
    if (post.body.length > 0) {
      parts.push('');
      parts.push(...post.body);
    }
    
    if (post.conclusion) {
      parts.push('');
      parts.push(post.conclusion);
    }
    
    return parts.join('\n').trim();
  }

  /**
   * Language variety techniques inspired by Colin Rugg
   */
  static getLanguageVariations() {
    return {
      openers: [
        "Let me break this down:",
        "Here's what's really happening:",
        "The truth is more complex:",
        "Most people miss this:",
        "Pay attention to this:",
        "This is important:",
        "Don't overlook this:",
        "The real story:",
        "What they're not telling you:",
        "Behind the scenes:"
      ],
      
      transitions: [
        "But here's the kicker:",
        "Here's where it gets interesting:",
        "But wait, there's more:",
        "The plot thickens:",
        "It gets worse:",
        "Here's the shocking part:",
        "But that's not all:",
        "The real bombshell:",
        "Here's what's really happening:",
        "The truth is even stranger:"
      ],
      
      conclusions: [
        "This changes everything.",
        "The implications are huge.",
        "Think about that for a second.",
        "Let that sink in.",
        "This is just the beginning.",
        "The evidence speaks for itself.",
        "Make of that what you will.",
        "Draw your own conclusions.",
        "The numbers don't lie.",
        "Actions speak louder than words."
      ],
      
      emphasis: [
        "Pay close attention:",
        "This is crucial:",
        "Don't miss this:",
        "Mark my words:",
        "Remember this:",
        "Here's the key:",
        "This matters:",
        "Take note:",
        "Keep this in mind:",
        "Don't forget:"
      ]
    };
  }
}

export default CollinRuggStyleGenerator;
