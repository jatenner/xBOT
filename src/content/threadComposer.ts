/**
 * Thread Generator v2 - Fixed template rendering
 * Generates structured, engaging threads with proper variable substitution
 */

export interface ThreadTemplate {
  type: 'checklist' | 'myth_vs_fact' | 'tiny_experiment' | 'eighty_twenty' | 'before_after';
  targetTweets: number;
  hookPattern: string;
  structure: string[];
  description: string;
}

export interface ThreadResult {
  tweets: string[];
  template: string;
  topic: string;
  originalityScore: number;
}

export class ThreadComposer {
  private templates: ThreadTemplate[] = [
    {
      type: 'checklist',
      targetTweets: 6,
      hookPattern: 'checklist',
      structure: [
        'Hook: Essential {topic} checklist',
        'Context: Why most approaches fail',
        'Item 1: First critical step',
        'Item 2: Second essential element', 
        'Item 3: Third key component',
        'Implementation: How to start today'
      ],
      description: 'Essential checklist format'
    },
    {
      type: 'myth_vs_fact',
      targetTweets: 5,
      hookPattern: 'myth_vs_fact',
      structure: [
        'Hook: Common {topic} myth exposed',
        'Myth: What people wrongly believe',
        'Fact: What actually works',
        'Why: Scientific explanation',
        'Action: What to do instead'
      ],
      description: 'Myth-busting format'
    },
    {
      type: 'tiny_experiment',
      targetTweets: 7,
      hookPattern: 'before_after',
      structure: [
        'Hook: {topic} experiment results',
        'Problem: What wasn\'t working',
        'Hypothesis: What I wanted to test',
        'Method: Exact protocol used',
        'Results: Specific outcomes',
        'Learning: Key insights gained',
        'Try: How you can replicate'
      ],
      description: 'Experiment and results format'
    },
    {
      type: 'eighty_twenty',
      targetTweets: 6,
      hookPattern: 'framework',
      structure: [
        'Hook: 80/20 rule for {topic}',
        'Context: Why most people overcomplicate',
        '20% #1: Most important factor',
        '20% #2: Second priority',
        '20% #3: Third essential',
        'Implementation: Start with #1 only'
      ],
      description: 'Pareto principle application'
    },
    {
      type: 'before_after',
      targetTweets: 5,
      hookPattern: 'before_after',
      structure: [
        'Hook: Before/after transformation',
        'Before: Previous struggling state',
        'Change: What was modified',
        'After: Current improved state',
        'How: Exact steps to replicate'
      ],
      description: 'Transformation story'
    }
  ];

  private hookPatterns = {
    checklist: [
      'Essential {topic} checklist (3 things that matter most):',
      'If you only do 3 things for {topic}, do these:',
      'The only {topic} checklist you need:',
      '80/20 {topic} checklist:'
    ],
    myth_vs_fact: [
      'Myth: {topic} works best when you do X. Reality: Y is what actually works.',
      'The biggest {topic} myth (that everyone believes):',
      'Stop believing this {topic} myth:',
      'Common {topic} advice that\'s backwards:'
    ],
    before_after: [
      'I fixed my {topic} problem in {timeframe}. Here\'s what changed:',
      'Before: struggling with {topic}. After: {positive outcome}.',
      'From {negative state} to {positive state} in {timeframe}:',
      '6 months ago I couldn\'t {skill}. Today it\'s automatic.'
    ],
    framework: [
      'Simple 3-step framework for {topic}:',
      'The {topic} system that changed everything:',
      'My proven {topic} method:',
      'Framework for mastering {topic}:'
    ]
  };

  private topicContext = {
    'sleep optimization': {
      negative: 'lying awake for hours',
      positive: '7-8 hours of quality sleep',
      timeframe: '2 weeks',
      skill: 'fall asleep quickly',
      problem: 'insomnia'
    },
    'energy management': {
      negative: 'afternoon crashes',
      positive: 'steady energy all day',
      timeframe: '3 weeks',
      skill: 'maintain focus',
      problem: 'fatigue'
    },
    'morning routines': {
      negative: 'rushing and stressed mornings',
      positive: 'calm, productive starts',
      timeframe: '1 month',
      skill: 'wake up naturally',
      problem: 'morning chaos'
    },
    'productivity': {
      negative: 'scattered and overwhelmed',
      positive: 'focused and efficient',
      timeframe: '4 weeks',
      skill: 'prioritize effectively',
      problem: 'procrastination'
    },
    'stress management': {
      negative: 'constant anxiety',
      positive: 'calm under pressure',
      timeframe: '6 weeks',
      skill: 'handle stress',
      problem: 'overwhelm'
    }
  };

  /**
   * Generate thread using specified template and topic
   */
  async generateThread(options: {
    topic: string;
    template?: 'checklist' | 'myth_vs_fact' | 'tiny_experiment' | 'eighty_twenty' | 'before_after';
    tweetCount?: number;
  }): Promise<ThreadResult> {
    const { topic, template, tweetCount = 6 } = options;
    
    // Select template
    const availableTemplates = template 
      ? this.templates.filter(t => t.type === template)
      : this.templates;
    
    const selectedTemplate = this.selectTemplate(availableTemplates);
    
    // Generate tweets based on template structure
    const tweets = this.generateTweetsFromTemplate(selectedTemplate, topic, tweetCount);
    
    // Calculate originality score
    const originalityScore = this.calculateOriginalityScore(tweets);
    
    return {
      tweets: tweets.slice(0, tweetCount),
      template: selectedTemplate.type,
      topic,
      originalityScore
    };
  }

  /**
   * Select template with rotation to ensure variety
   */
  private selectTemplate(templates: ThreadTemplate[]): ThreadTemplate {
    if (templates.length === 0) {
      return this.templates[0]; // Fallback
    }
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate tweets from template structure
   */
  private generateTweetsFromTemplate(template: ThreadTemplate, topic: string, targetCount: number): string[] {
    const tweets: string[] = [];
    const context = this.getTopicContext(topic);

    for (let i = 0; i < Math.min(template.structure.length, targetCount); i++) {
      const structureItem = template.structure[i];
      
      // Generate specific content based on template type and structure
      const tweet = this.generateSpecificContent(template.type, structureItem, topic, context, i);
      
      tweets.push(tweet);
    }

    return tweets;
  }

  /**
   * Generate specific content for each tweet in the thread
   */
  private generateSpecificContent(
    templateType: string, 
    structureItem: string, 
    topic: string, 
    context: any, 
    index: number
  ): string {
    const cleanTopic = topic.toLowerCase();

    switch (templateType) {
      case 'checklist':
        return this.generateChecklistContent(structureItem, cleanTopic, context, index);
      case 'myth_vs_fact':
        return this.generateMythFactContent(structureItem, cleanTopic, context, index);
      case 'tiny_experiment':
        return this.generateExperimentContent(structureItem, cleanTopic, context, index);
      case 'eighty_twenty':
        return this.generateEightyTwentyContent(structureItem, cleanTopic, context, index);
      case 'before_after':
        return this.generateBeforeAfterContent(structureItem, cleanTopic, context, index);
      default:
        return this.substituteVariables(structureItem, topic, context);
    }
  }

  private generateChecklistContent(structureItem: string, topic: string, context: any, index: number): string {
    if (structureItem.includes('Hook:')) {
      return `Essential ${topic} checklist (3 things that matter most):`;
    } else if (structureItem.includes('Context:')) {
      return `Most people overcomplicate ${topic}. These 3 things drive 80% of results.`;
    } else if (structureItem.includes('Item 1:')) {
      if (topic.includes('sleep')) return `1) Consistent wake time (even weekends). This sets your circadian rhythm.`;
      if (topic.includes('energy')) return `1) Protein within 30 minutes of waking. Stabilizes blood sugar all day.`;
      if (topic.includes('morning')) return `1) Feet on floor, 3 deep breaths. Activates your nervous system.`;
      return `1) Start with the foundation. Master this before adding complexity.`;
    } else if (structureItem.includes('Item 2:')) {
      if (topic.includes('sleep')) return `2) Cool room (65-68°F). Your body needs to drop temperature to sleep.`;
      if (topic.includes('energy')) return `2) No screens 2 hours before bed. Blue light disrupts melatonin.`;
      if (topic.includes('morning')) return `2) 2 minutes of natural light exposure. Even cloudy days work.`;
      return `2) Build the habit loop. Cue, routine, reward - make it automatic.`;
    } else if (structureItem.includes('Item 3:')) {
      if (topic.includes('sleep')) return `3) 2-minute rule: If not asleep in 2 minutes, get up. Do something boring until sleepy.`;
      if (topic.includes('energy')) return `3) Move every 90 minutes. Even 30 seconds of movement helps circulation.`;
      if (topic.includes('morning')) return `3) One priority written down. Clarifies focus for the entire day.`;
      return `3) Track progress weekly. What gets measured gets improved.`;
    } else if (structureItem.includes('Implementation:')) {
      return `Start with #1 only. Master it for a week before adding #2. Slow progress beats no progress.`;
    }
    return structureItem;
  }

  private generateMythFactContent(structureItem: string, topic: string, context: any, index: number): string {
    if (structureItem.includes('Hook:')) {
      if (topic.includes('sleep')) return `Myth: You need exactly 8 hours of sleep every night.`;
      if (topic.includes('energy')) return `Myth: Caffeine gives you energy.`;
      if (topic.includes('exercise')) return `Myth: The best time to exercise is in the morning.`;
      return `Common ${topic} myth that's holding you back:`;
    } else if (structureItem.includes('Myth:')) {
      if (topic.includes('sleep')) return `Myth: Everyone needs the same amount of sleep.`;
      if (topic.includes('energy')) return `Myth: Coffee boosts energy levels.`;
      return `Myth: More is always better for ${topic}.`;
    } else if (structureItem.includes('Fact:')) {
      if (topic.includes('sleep')) return `Fact: You need 7-9 hours of quality sleep cycles. Some people thrive on 7, others need 9.`;
      if (topic.includes('energy')) return `Fact: Caffeine blocks tiredness signals but doesn't create energy. It borrows from tomorrow.`;
      return `Fact: Consistency and quality matter more than quantity for ${topic}.`;
    } else if (structureItem.includes('Why:')) {
      return `Why: Individual chronotypes and sleep needs vary based on genetics, age, and lifestyle factors.`;
    } else if (structureItem.includes('Action:')) {
      return `Action: Track your energy levels at different sleep durations. Find your personal sweet spot.`;
    }
    return structureItem;
  }

  private generateExperimentContent(structureItem: string, topic: string, context: any, index: number): string {
    if (structureItem.includes('Hook:')) {
      return `I ran a ${topic} experiment for 2 weeks. Results surprised me:`;
    } else if (structureItem.includes('Problem:')) {
      return `Problem: ${context.negative} despite trying conventional advice.`;
    } else if (structureItem.includes('Hypothesis:')) {
      return `Hypothesis: What if the timing matters more than the method?`;
    } else if (structureItem.includes('Method:')) {
      if (topic.includes('sleep')) return `Method: Moved all screens out of bedroom. Used 2-minute rule if awake.`;
      if (topic.includes('energy')) return `Method: Ate 20g protein within 30 minutes of waking for 14 days.`;
      return `Method: Changed one variable for 2 weeks while keeping everything else constant.`;
    } else if (structureItem.includes('Results:')) {
      return `Results: ${context.positive} by day 10. Sustained for 4+ weeks now.`;
    } else if (structureItem.includes('Learning:')) {
      return `Learning: Small, consistent changes beat dramatic overhauls every time.`;
    } else if (structureItem.includes('Try:')) {
      return `Try: Pick one variable to test for 2 weeks. Measure daily. What's your result?`;
    }
    return structureItem;
  }

  private generateEightyTwentyContent(structureItem: string, topic: string, context: any, index: number): string {
    if (structureItem.includes('Hook:')) {
      return `80/20 rule for ${topic}: 3 things that drive 80% of results.`;
    } else if (structureItem.includes('Context:')) {
      return `Most people try to optimize everything. Focus on these 3 things first.`;
    } else if (structureItem.includes('20% #1:')) {
      if (topic.includes('sleep')) return `20% #1: Consistent wake time (even weekends). Sets your entire circadian rhythm.`;
      if (topic.includes('energy')) return `20% #1: Morning protein. Stabilizes blood sugar and energy for 8+ hours.`;
      return `20% #1: The foundation habit that enables everything else.`;
    } else if (structureItem.includes('20% #2:')) {
      if (topic.includes('sleep')) return `20% #2: Cool sleeping environment (65-68°F). Temperature regulation is critical.`;
      if (topic.includes('energy')) return `20% #2: Movement every 90 minutes. Prevents energy crashes and brain fog.`;
      return `20% #2: The consistency factor that compounds over time.`;
    } else if (structureItem.includes('20% #3:')) {
      if (topic.includes('sleep')) return `20% #3: No screens 2 hours before bed. Blue light disrupts melatonin production.`;
      if (topic.includes('energy')) return `20% #3: Strategic caffeine timing. Before 2pm only, after morning protein.`;
      return `20% #3: The optimization that maximizes the first two.`;
    } else if (structureItem.includes('Implementation:')) {
      return `Start with #1 only. Master it for 2 weeks. Then add #2. Resist the urge to do everything at once.`;
    }
    return structureItem;
  }

  private generateBeforeAfterContent(structureItem: string, topic: string, context: any, index: number): string {
    if (structureItem.includes('Hook:')) {
      return `From ${context.negative} to ${context.positive} in ${context.timeframe}:`;
    } else if (structureItem.includes('Before:')) {
      return `Before: ${context.negative}. Tried everything but nothing stuck.`;
    } else if (structureItem.includes('Change:')) {
      if (topic.includes('sleep')) return `Change: Stopped tracking sleep. Focused on wake time only.`;
      if (topic.includes('energy')) return `Change: Added 20g protein to morning routine. That's it.`;
      return `Change: One small adjustment to my daily routine.`;
    } else if (structureItem.includes('After:')) {
      return `After: ${context.positive}. Completely transformed my ${topic}.`;
    } else if (structureItem.includes('How:')) {
      return `How: Start with one change. Be consistent for 2 weeks. Then assess and adjust.`;
    }
    return structureItem;
  }

  /**
   * Get topic-specific context variables
   */
  private getTopicContext(topic: string): any {
    const cleanTopic = topic.toLowerCase();
    
    // Find the best match
    for (const [key, context] of Object.entries(this.topicContext)) {
      if (cleanTopic.includes(key) || key.includes(cleanTopic)) {
        return context;
      }
    }
    
    // Default context
    return {
      negative: 'struggling with this issue',
      positive: 'consistent improvement',
      timeframe: '3 weeks',
      skill: 'manage this effectively',
      problem: 'inconsistency'
    };
  }

  /**
   * Substitute variables in template strings
   */
  private substituteVariables(template: string, topic: string, context?: any): string {
    let result = template.replace(/\{topic\}/g, topic);
    
    if (context) {
      result = result.replace(/\{negative state\}/g, context.negative);
      result = result.replace(/\{positive state\}/g, context.positive);
      result = result.replace(/\{positive outcome\}/g, context.positive);
      result = result.replace(/\{negative state\}/g, context.negative);
      result = result.replace(/\{timeframe\}/g, context.timeframe);
      result = result.replace(/\{skill\}/g, context.skill);
      result = result.replace(/\{problem\}/g, context.problem);
    }
    
    return result;
  }

  /**
   * Calculate originality score for generated content
   */
  private calculateOriginalityScore(tweets: string[]): number {
    const content = tweets.join(' ').toLowerCase();
    let score = 80; // Base score
    
    // Reduce score for generic phrases
    const genericPhrases = ['here are', 'let me tell you', 'in this thread', 'tips for', 'ways to'];
    genericPhrases.forEach(phrase => {
      if (content.includes(phrase)) score -= 10;
    });
    
    // Increase score for specific elements
    const specificElements = [/\d+\s*(minutes?|hours?|days?|weeks?)/, /\d+[%]/, /step \d+/];
    specificElements.forEach(pattern => {
      if (pattern.test(content)) score += 5;
    });
    
    return Math.max(50, Math.min(100, score));
  }
}

export const threadComposer = new ThreadComposer();