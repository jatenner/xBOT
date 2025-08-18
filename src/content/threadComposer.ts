/**
 * Thread Generator v2 - Structured templates with hook variety
 * Coachy, evidence-aware, practical style for health content
 */

export interface ThreadTemplate {
  type: 'mini' | 'deep' | 'checklist';
  targetTweets: number;
  hookPattern: string;
  structure: string[];
  description: string;
}

export interface ThreadResult {
  tweets: string[];
  template: ThreadTemplate;
  qualityScore?: number;
}

export class ThreadComposer {
  private readonly templates: ThreadTemplate[] = [
    {
      type: 'mini',
      targetTweets: 4,
      hookPattern: 'counterintuitive',
      structure: [
        'Hook: Counterintuitive insight about topic',
        'Context: Why this matters for health',  
        'Evidence: Research or personal experience',
        'Action: One specific step to try'
      ],
      description: 'Quick insight thread with surprising angle'
    },
    {
      type: 'mini',
      targetTweets: 3,
      hookPattern: 'before_after',
      structure: [
        'Hook: Before/after transformation',
        'Method: What changed (specific)',
        'How: Practical steps to replicate'
      ],
      description: 'Personal transformation story'
    },
    {
      type: 'deep',
      targetTweets: 8,
      hookPattern: 'myth_vs_fact',
      structure: [
        'Hook: Common myth everyone believes',
        'Problem: Why this myth is harmful',
        'Truth: What research actually shows',
        'Evidence: 2-3 specific studies/examples',
        'Method: How to apply the truth',
        'Steps: Specific implementation',
        'Common mistake: What people get wrong',
        'CTA: Challenge or experiment to try'
      ],
      description: 'Myth-busting deep dive with evidence'
    },
    {
      type: 'deep',
      targetTweets: 7,
      hookPattern: 'framework',
      structure: [
        'Hook: Simple framework for complex problem',
        'Context: Why existing approaches fail',
        'Framework: 3-part system overview',
        'Part 1: First principle with example',
        'Part 2: Second principle with example', 
        'Part 3: Third principle with example',
        'Implementation: How to start today'
      ],
      description: 'Systematic framework breakdown'
    },
    {
      type: 'checklist',
      targetTweets: 6,
      hookPattern: 'checklist',
      structure: [
        'Hook: 80/20 checklist for outcome',
        'Context: Why most people overcomplicate this',
        'Item 1: Most important factor (20% → 50% results)',
        'Item 2: Second priority (easy win)',
        'Item 3: Advanced optimization (for perfectionists)',
        'Implementation: Start with item 1 only'
      ],
      description: 'Prioritized action checklist'
    }
  ];

  private hookPatterns = {
    counterintuitive: [
      'The #1 {topic} advice is backwards',
      'Everyone thinks {topic} works like X. It actually works like Y.',
      'Counterintuitive truth about {topic}:',
      'The {topic} industry doesn\'t want you to know this:',
      'I thought {topic} was about X. Turns out it\'s about Y.'
    ],
    before_after: [
      'Before: {negative state}. After: {positive state}. Here\'s what changed:',
      'I fixed my {problem} in {timeframe}. The solution was surprisingly simple:',
      '6 months ago I struggled with {issue}. Today it\'s solved. Here\'s how:',
      'From {bad state} to {good state} in {timeframe}:'
    ],
    myth_vs_fact: [
      'Myth: {common belief about topic}. Fact: {actual truth}.',
      'The biggest {topic} myth (that everyone believes):',
      'Stop believing this {topic} myth:',
      '{topic} myth that\'s literally backwards:'
    ],
    framework: [
      'Simple 3-step framework for {outcome}:',
      'The {topic} framework that changed everything:',
      'I use this {topic} system for {benefit}:',
      'My 3-part {topic} method:'
    ],
    checklist: [
      '80/20 {topic} checklist (3 things that matter most):',
      'If you only do 3 things for {topic}, do these:',
      'Essential {topic} checklist (ignore everything else):',
      'The only {topic} checklist you need:'
    ]
  };

  /**
   * Generate thread using specified template and topic
   */
  async generateThread(topic: string, templateType?: 'mini' | 'deep' | 'checklist'): Promise<ThreadResult> {
    // Select template (rotate to ensure variety)
    const availableTemplates = templateType 
      ? this.templates.filter(t => t.type === templateType)
      : this.templates;
    
    const template = this.selectTemplate(availableTemplates);
    const hookPattern = this.getHookPattern(template.hookPattern, topic);
    
    // Generate structured content
    const tweets = await this.generateStructuredContent(template, topic, hookPattern);
    
    // Run originality check
    const passesOriginality = await this.checkOriginality(tweets[0]);
    
    if (!passesOriginality) {
      // Retry with different hook pattern
      const altHookPattern = this.getAlternativeHook(template.hookPattern, topic);
      const altTweets = await this.generateStructuredContent(template, topic, altHookPattern);
      return { tweets: altTweets, template };
    }
    
    return { tweets, template };
  }

  /**
   * Select template with variety rotation
   */
  private selectTemplate(templates: ThreadTemplate[]): ThreadTemplate {
    // For now, random selection. Could add smart rotation based on recent usage
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Get hook pattern for template and topic
   */
  private getHookPattern(patternType: string, topic: string): string {
    const patterns = this.hookPatterns[patternType as keyof typeof this.hookPatterns] || this.hookPatterns.counterintuitive;
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern.replace(/{topic}/g, topic);
  }

  /**
   * Get alternative hook pattern for retry
   */
  private getAlternativeHook(patternType: string, topic: string): string {
    const allPatterns = Object.values(this.hookPatterns).flat();
    const pattern = allPatterns[Math.floor(Math.random() * allPatterns.length)];
    return pattern.replace(/{topic}/g, topic);
  }

  /**
   * Generate structured content following template
   */
  private async generateStructuredContent(template: ThreadTemplate, topic: string, hookPattern: string): Promise<string[]> {
    const tweets: string[] = [];
    
    // For now, return placeholder content. In real implementation, this would:
    // 1. Send structured prompt to OpenAI based on template.structure
    // 2. Include the hookPattern as the opening
    // 3. Follow the evidence-aware, practical style guidelines
    // 4. Ensure each tweet fits character limits
    
    // Placeholder implementation:
    tweets.push(hookPattern);
    
    for (let i = 1; i < template.targetTweets; i++) {
      const structureGuide = template.structure[i] || `Tweet ${i + 1} content`;
      tweets.push(`${structureGuide} (placeholder for ${topic})`);
    }
    
    return tweets;
  }

  /**
   * Lightweight originality checker
   */
  private async checkOriginality(hookTweet: string): Promise<boolean> {
    // Simple check against common patterns that indicate low originality
    const lowOriginalityPatterns = [
      /here are \d+ tips/i,
      /\d+ things you should know/i,
      /let's talk about/i,
      /today I want to share/i,
      /thread about/i
    ];
    
    return !lowOriginalityPatterns.some(pattern => pattern.test(hookTweet));
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): ThreadTemplate[] {
    return [...this.templates];
  }
}