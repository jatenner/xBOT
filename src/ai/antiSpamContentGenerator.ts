/**
 * ANTI-SPAM CONTENT GENERATOR
 * Creates authentic, engaging content that doesn't sound like AI bot spam
 */

export interface AuthenticContent {
  content: string;
  reasoning: string;
  authenticity_score: number;
  engagement_prediction: number;
}

export class AntiSpamContentGenerator {
  private static instance: AntiSpamContentGenerator;
  
  public static getInstance(): AntiSpamContentGenerator {
    if (!AntiSpamContentGenerator.instance) {
      AntiSpamContentGenerator.instance = new AntiSpamContentGenerator();
    }
    return AntiSpamContentGenerator.instance;
  }

  private bannedPhrases = [
    'Sleep Myth Busted!',
    'Shocking Health Truth:',
    'Biohack Alert!',
    'Did you know?',
    '% of people don\'t know',
    'Harvard study reveals',
    'According to research',
    'Scientists say',
    'Here\'s the truth:',
    'This will shock you:',
    'Game-changer:',
    'Mind-blowing fact:',
    'Life hack:',
    'Pro tip:',
    'Fun fact:'
  ];

  private authenticContentTypes = [
    {
      type: 'personal_observation',
      template: 'I noticed something weird about [topic]. [observation]. Anyone else experiencing this?',
      examples: [
        'I noticed something weird about coffee timing. Drinking it 90-120 minutes after waking feels way more effective than first thing. Anyone else experiencing this?',
        'I noticed something weird about cold showers. The mental clarity boost lasts about 4 hours, but only if I do them before 10am. Anyone else experiencing this?'
      ]
    },
    {
      type: 'counterintuitive_insight',
      template: '[Common belief] might be backwards. [Alternative approach] worked better for me because [reason].',
      examples: [
        'Eating breakfast might be backwards. Skipping it until 11am improved my focus because my cortisol is naturally high in the morning.',
        'Working out in the evening might be backwards. Morning exercise gave me sustained energy all day because it kickstarts metabolism.'
      ]
    },
    {
      type: 'practical_experiment',
      template: 'Tried [specific change] for [timeframe]. [Specific result]. [Simple explanation why].',
      examples: [
        'Tried drinking water 30 minutes before meals for 2 weeks. Lost 3 pounds without changing anything else. Apparently it activates satiety signals.',
        'Tried blue light glasses after 8pm for 10 days. Fell asleep 15 minutes faster. Seems to help maintain natural melatonin production.'
      ]
    },
    {
      type: 'simple_insight',
      template: '[Simple observation] that most people miss: [insight]. [Why it matters].',
      examples: [
        'Simple breathing pattern most people miss: exhale longer than you inhale. Activates parasympathetic nervous system instantly.',
        'Simple posture fix most people miss: ears over shoulders, not forward. Reduces neck tension and improves breathing capacity.'
      ]
    },
    {
      type: 'relatable_struggle',
      template: 'Anyone else [relatable problem]? Found [simple solution] works better than [common solution].',
      examples: [
        'Anyone else crash around 3pm? Found a 10-minute walk works better than coffee. Something about resetting circadian rhythm.',
        'Anyone else wake up groggy? Found keeping the room at 65°F works better than sleeping longer. Temperature affects sleep quality more than duration.'
      ]
    }
  ];

  public async generateAuthenticContent(topic?: string): Promise<AuthenticContent> {
    // Pick a random content type
    const contentType = this.authenticContentTypes[Math.floor(Math.random() * this.authenticContentTypes.length)];
    
    // Generate content based on the selected type
    const content = await this.generateFromTemplate(contentType, topic);
    
    // Score authenticity (higher = more human-like)
    const authenticity_score = this.scoreAuthenticity(content);
    
    // Predict engagement (higher = more likely to get views/replies)
    const engagement_prediction = this.predictEngagement(content);
    
    return {
      content,
      reasoning: `Used ${contentType.type} template to create relatable, non-spammy content`,
      authenticity_score,
      engagement_prediction
    };
  }

  private async generateFromTemplate(contentType: any, topic?: string): Promise<string> {
    // For now, use examples until we can integrate with OpenAI properly
    const example = contentType.examples[Math.floor(Math.random() * contentType.examples.length)];
    
    // Add some variation to avoid exact duplicates
    const variations = [
      example,
      example.replace('Anyone else', 'Does anyone else'),
      example.replace('I noticed', 'I\'ve noticed'),
      example.replace('Tried', 'I tried'),
      example.replace('Found', 'I found')
    ];
    
    return variations[Math.floor(Math.random() * variations.length)];
  }

  private scoreAuthenticity(content: string): number {
    let score = 100;
    
    // Deduct points for banned phrases
    for (const phrase of this.bannedPhrases) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        score -= 30;
      }
    }
    
    // Deduct points for fake statistics
    const hasUnverifiedStats = /\d+%/.test(content) && !content.includes('for me') && !content.includes('my');
    if (hasUnverifiedStats) score -= 25;
    
    // Add points for personal language
    if (content.includes('I ') || content.includes('my ') || content.includes('me ')) score += 15;
    
    // Add points for question format (encourages engagement)
    if (content.includes('?')) score += 10;
    
    // Add points for specific timeframes/numbers
    if (/\d+ (days?|weeks?|minutes?)/.test(content)) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private predictEngagement(content: string): number {
    let score = 50; // baseline
    
    // Questions drive replies
    if (content.includes('Anyone else')) score += 20;
    if (content.includes('?')) score += 15;
    
    // Personal experiences are relatable
    if (content.includes('I tried') || content.includes('I noticed')) score += 15;
    
    // Specific results are interesting
    if (/\d+ (pounds?|minutes?|hours?)/.test(content)) score += 10;
    
    // Counterintuitive insights get shares
    if (content.includes('might be backwards') || content.includes('most people miss')) score += 12;
    
    // Simple, actionable advice gets bookmarks
    if (content.length < 200 && content.includes('works better')) score += 8;
    
    return Math.max(0, Math.min(100, score));
  }

  public isSpammy(content: string): boolean {
    // Check for banned phrases
    for (const phrase of this.bannedPhrases) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        return true;
      }
    }
    
    // Check for fake credibility patterns
    const hasUnverifiedClaims = /\d+% of (people|adults|users)/.test(content);
    const hasVagueStudyReferences = /study (shows?|reveals?|says?)/.test(content.toLowerCase());
    const hasClickbaitWords = /(shocking|mind-blowing|secret|truth)/i.test(content);
    
    return hasUnverifiedClaims || hasVagueStudyReferences || hasClickbaitWords;
  }
}
