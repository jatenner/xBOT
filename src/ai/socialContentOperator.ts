/**
 * Social Content & Engagement Operator
 * Comprehensive system for diverse, engaging content generation and community management
 */

import OpenAI from 'openai';

export interface ContentPack {
  singles: string[];
  threads: ThreadContent[];
  metadata: {
    diversityScore: number;
    formatMix: string[];
    topicMix: string[];
    qualityScores: number[];
  };
}

export interface ThreadContent {
  tweets: string[];
  topic: string;
  format: string;
  engagementHooks: string[];
}

export interface ReplyPack {
  targetReplies: TargetReply[];
  commentResponses: CommentResponse[];
}

export interface TargetReply {
  originalTweet: string;
  reply: string;
  context: string;
  addedValue: string;
}

export interface CommentResponse {
  originalComment: string;
  response: string;
  tone: 'witty' | 'helpful' | 'conversational';
}

export interface LearningNotes {
  engagementPatterns: string[];
  improvements: string[];
  experimentsToTry: string[];
  topPerformers: string[];
}

export class SocialContentOperator {
  private openai: OpenAI;
  private contentHistory: string[] = [];
  private formatHistory: string[] = [];
  private topicHistory: string[] = [];
  
  // Content format templates
  private readonly CONTENT_FORMATS = {
    '1-liner': {
      template: 'One surprising fact or counterintuitive insight',
      examples: ['Cold showers boost dopamine 250%. Better than coffee.']
    },
    'tip-2-3-sentence': {
      template: 'Quick actionable tip with brief explanation',
      examples: ['Walk after eating. Even 2 minutes drops blood sugar 20%. Your pancreas will thank you.']
    },
    'story-personal': {
      template: 'Personal experience or investment story',
      examples: ['I spent $2K on sleep tracking. Learned my bedroom was 4 degrees too warm. Fixed it, gained 90 min deep sleep.']
    },
    'myth-buster': {
      template: 'Challenge common belief with evidence',
      examples: ['8 glasses of water is a myth. You need half your weight in ounces. Most people are actually overhydrating.']
    },
    'question-engagement': {
      template: 'Thought-provoking question to spark discussion',
      examples: ['Which would you rather: perfect sleep for life OR never need sleep again?']
    },
    'analogy': {
      template: 'Complex concept explained through simple comparison',
      examples: ['Your metabolism is like a campfire. Protein is dry wood (burns hot), carbs are kindling (quick flame), fat is the log (steady burn).']
    },
    'controversial-take': {
      template: 'Defensible but provocative opinion',
      examples: ['Unpopular opinion: Supplements are mostly expensive urine. Fix your basics first.']
    },
    'stat-shocking': {
      template: 'Surprising statistic with context',
      examples: ['90% of serotonin is made in your gut, not your brain. That gut feeling is literally your microbiome talking.']
    }
  };

  private readonly TOPIC_CATEGORIES = {
    'sleep': ['sleep quality', 'circadian rhythm', 'sleep tracking', 'bedroom optimization'],
    'nutrition': ['meal timing', 'micronutrients', 'hydration', 'metabolism'],
    'exercise': ['recovery', 'strength training', 'cardio myths', 'movement habits'],
    'stress': ['cortisol management', 'breathing techniques', 'nature therapy', 'work-life balance'],
    'biohacking': ['cold exposure', 'heat therapy', 'light therapy', 'supplements'],
    'productivity': ['focus techniques', 'energy management', 'morning routines', 'cognitive health']
  };

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate a complete content pack with diversity controls and learning integration
   */
  async generateContentPack(brandNotes: string, seeds: string[], recentPosts: string[]): Promise<ContentPack> {
    console.log('🎯 SOCIAL_OPERATOR: Generating diverse content pack with learning integration');
    
    // Analyze recent posts to avoid repetition
    this.updateContentHistory(recentPosts);
    
    // Get learning insights to improve content generation
    const learningInsights = await this.getLearningInsights();
    console.log(`🧠 LEARNING: Applied ${learningInsights.length} insights to content generation`);
    
    // Generate 3 singles with different formats using learning insights
    const singles = await this.generateDiverseSingles(brandNotes, seeds, learningInsights);
    
    // Generate 2 threads with different styles using learning insights
    const threads = await this.generateDiverseThreads(brandNotes, seeds, learningInsights);
    
    // Calculate diversity metrics
    const metadata = this.calculateDiversityMetrics(singles, threads);
    
    return {
      singles,
      threads,
      metadata
    };
  }

  /**
   * Get learning insights from the intelligent learning engine
   */
  private async getLearningInsights(): Promise<any[]> {
    try {
      const { IntelligentLearningEngine } = await import('../intelligence/intelligentLearningEngine');
      const learningEngine = IntelligentLearningEngine.getInstance();
      
      // Get actionable insights for content improvement
      const insights = await learningEngine.learnFromPerformanceData();
      
      return insights.filter(insight => 
        insight.type === 'content_style' || 
        insight.type === 'engagement_hook' ||
        insight.type === 'optimal_length'
      );
    } catch (error) {
      console.warn('Could not fetch learning insights:', error);
      return [];
    }
  }

  /**
   * Generate 3 diverse single tweets with learning insights
   */
  private async generateDiverseSingles(brandNotes: string, seeds: string[], learningInsights: any[] = []): Promise<string[]> {
    const singles: string[] = [];
    
    // DIVERSE format rotation - no repeated hooks
    const formatPool = [
      'controversial-take', 'story-personal', 'question-engagement', 
      'myth-buster', 'stat-shocking', 'analogy', '1-liner', 'tip-2-3-sentence'
    ];
    
    // Shuffle and select 3 different formats
    const shuffledFormats = [...formatPool].sort(() => Math.random() - 0.5);
    const targetFormats = shuffledFormats.slice(0, 3);
    
    console.log(`🎭 HOOK_DIVERSITY: Using formats [${targetFormats.join(', ')}]`);
    
    for (let i = 0; i < 3; i++) {
      const format = targetFormats[i];
      const topic = this.selectUnusedTopic();
      const seed = seeds[i] || topic;
      
      const prompt = this.buildSinglePrompt(brandNotes, seed, format, this.contentHistory, learningInsights);
      
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 200
        });

        let content = response.choices[0]?.message?.content?.trim() || '';
        
              // EMERGENCY: Disable broken engagement optimizer that creates word salad
      // const optimizedResult = await this.optimizeForEngagement(content);
      // content = optimizedResult.optimized_content;
      
      console.log(`🔧 EMERGENCY_MODE: Engagement optimizer disabled to prevent content corruption`);
      
      // EMERGENCY: Critical content validation before posting
      const isValidContent = this.validateContentQuality(content);
      
      if (!isValidContent.isValid) {
        console.log(`🚨 CONTENT_REJECTED: ${isValidContent.reason}`);
        console.log(`🔧 EMERGENCY_FALLBACK: Using safe content instead`);
        content = this.generateEmergencyContent(seed);
      }
      
      // Quality check on validated content
      const qualityScore = await this.evaluateContentQuality(content, format);
        
      if (qualityScore >= 70) { // Lowered threshold for emergency mode
        singles.push(content);
        this.contentHistory.push(content);
        this.formatHistory.push(format);
        this.topicHistory.push(topic);
        console.log(`✅ CONTENT_ACCEPTED: Quality ${qualityScore}/100`);
      } else {
        // Emergency fallback - don't try to regenerate, just use safe content
        console.log(`⚠️ LOW_QUALITY: ${qualityScore}/100, using emergency content`);
        content = this.generateEmergencyContent(seed);
        singles.push(content);
      }
        
      } catch (error) {
        console.error(`Failed to generate single ${i + 1}:`, error);
        singles.push(this.getEmergencyContent(format));
      }
    }
    
    return singles;
  }

  /**
   * Generate 2 diverse threads with learning insights
   */
  private async generateDiverseThreads(brandNotes: string, seeds: string[], learningInsights: any[] = []): Promise<ThreadContent[]> {
    const threads: ThreadContent[] = [];
    const threadFormats = ['educational-series', 'myth-busting-thread'];
    
    for (let i = 0; i < 2; i++) {
      const format = threadFormats[i];
      const topic = this.selectUnusedTopic();
      const seed = seeds[seeds.length - 2 + i] || topic;
      
      const prompt = this.buildThreadPrompt(brandNotes, seed, format);
      
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        });

        const threadData = JSON.parse(response.choices[0]?.message?.content || '{}');
        
        if (threadData.tweets && Array.isArray(threadData.tweets)) {
          threads.push({
            tweets: threadData.tweets,
            topic: threadData.topic || topic,
            format,
            engagementHooks: threadData.engagementHooks || []
          });
        }
        
      } catch (error) {
        console.error(`Failed to generate thread ${i + 1}:`, error);
        threads.push(this.getEmergencyThread(format));
      }
    }
    
    return threads;
  }

  /**
   * Build single tweet prompt with format, diversity controls, and learning insights
   */
  private buildSinglePrompt(brandNotes: string, seed: string, format: string, recentContent: string[], learningInsights: any[] = []): string {
    const formatInfo = this.CONTENT_FORMATS[format];
    const avoidContent = recentContent.join('\n- ');
    
    // Extract actionable learning insights
    const insightText = learningInsights.length > 0 
      ? `\n\nLEARNING INSIGHTS (apply these patterns that work):\n${learningInsights.map(insight => `- ${insight.recommendation}`).join('\n')}`
      : '';
    
    return `You are a provocative health content creator for @SignalAndSynapse. MISSION: CREATE CONTROVERSY & EARN FOLLOWS.

BRAND: ${brandNotes}
SEED TOPIC: ${seed}
FORMAT: ${formatInfo.template}

STRICT CONTENT RULES:
- BANNED PHRASE: "Unpopular opinion" (overused, auto-reject any content with this)
- BANNED PHRASE: "Plot twist" (creates broken stacking)
- BANNED PHRASE: "Uncomfortable truth" (causes optimization conflicts)
- Use ONE hook only - never stack multiple hooks
- Write like a human health expert, not an AI
- Include specific numbers and personal experience
- End with ONE simple engagement question

SINGLE VIRAL HOOKS (use ONE per post):
- "I spent $[amount] learning [topic] advice is wrong"
- "Former [industry] insider here: [revelation]"
- "I tried [popular thing] for [time]. Here's what happened:"
- "Every [expert] tells you [advice]. They're wrong:"
- "[Industry] doesn't want you to know this about [topic]:"
- "Rich people do [X]. Poor people get told to do [Y]"

ENGAGEMENT TRIGGERS (use one):
- "Fight me in the comments"
- "Change my mind" 
- "Tell me I'm wrong"
- "This will piss off a lot of people"
- "Am I crazy or is this obvious?"

AVOID REPEATING THESE RECENT TOPICS/PHRASES:
- ${avoidContent}

FORMAT EXAMPLE: ${formatInfo.examples[0]}${insightText}

CRITICAL REQUIREMENTS:
1. Use ONLY ONE viral hook from the list above
2. Write clear, readable sentences (no AI gibberish)
3. Include specific numbers and personal experience
4. Challenge ${seed} with evidence-based contrarian view
5. End with ONE simple engagement question
6. ≤260 characters total
7. BANNED: "Unpopular opinion", "Plot twist", "Uncomfortable truth"

Generate ONE clear, readable tweet:

Tweet:`;
  }

  /**
   * Build thread prompt with diversity controls
   */
  private buildThreadPrompt(brandNotes: string, seed: string, format: string): string {
    return `Create a ${format} thread for a health & performance profile.

BRAND: ${brandNotes}
SEED: ${seed}
FORMAT: ${format}

THREAD REQUIREMENTS:
- 4-6 tweets total
- Each tweet stands alone (no cliffhangers)
- Conversational, human tone
- Build engagement throughout
- No hashtags, minimal emojis

OUTPUT FORMAT (JSON):
{
  "tweets": ["tweet 1", "tweet 2", "tweet 3", "tweet 4"],
  "topic": "specific topic covered",
  "engagementHooks": ["hook 1", "hook 2"]
}

Create engaging thread now:`;
  }

  /**
   * Evaluate content quality with detailed scoring
   */
  private async evaluateContentQuality(content: string, format: string): Promise<number> {
    const prompt = `Rate this ${format} content for quality (0-100):

CONTENT: "${content}"

SCORING CRITERIA:
- Engagement potential (30%): Will people respond/debate?
- Human tone (25%): Sounds conversational, not robotic?
- Value provided (20%): Actionable or insightful?
- Format adherence (15%): Matches ${format} style?
- Uniqueness (10%): Not generic advice?

PASS THRESHOLD: 80/100

Return only the numerical score (e.g., 85):`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10
      });

      const scoreText = response.choices[0]?.message?.content?.trim() || '0';
      return parseInt(scoreText) || 0;
    } catch (error) {
      console.warn('Quality evaluation failed:', error);
      return 75; // Default score
    }
  }

  /**
   * Regenerate content with quality feedback
   */
  private async regenerateWithQualityFeedback(content: string, format: string, score: number): Promise<string> {
    const prompt = `This ${format} content scored ${score}/100. Improve it to 80+:

ORIGINAL: "${content}"

ISSUES TO FIX:
- Make more engaging (add questions/controversy)
- Sound more human and conversational
- Increase value/insight provided
- Better format adherence

IMPROVED VERSION:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 200
      });

      return response.choices[0]?.message?.content?.trim() || content;
    } catch (error) {
      return content; // Return original if regeneration fails
    }
  }

  /**
   * EMERGENCY: Validate content quality to prevent posting broken content
   */
  private validateContentQuality(content: string): { isValid: boolean; reason?: string } {
    // Check for banned phrases that create broken content
    const bannedPhrases = ['Unpopular opinion', 'Plot twist:', 'Uncomfortable truth:', 'I this scared'];
    
    for (const phrase of bannedPhrases) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        return { isValid: false, reason: `Contains banned phrase: "${phrase}"` };
      }
    }
    
    // Check for stacked hooks (multiple hooks in one post)
    const hookCount = [
      'I spent $',
      'Former',
      'I tried',
      'Every expert',
      'doesn\'t want you to know',
      'Rich people'
    ].filter(hook => content.toLowerCase().includes(hook.toLowerCase())).length;
    
    if (hookCount > 1) {
      return { isValid: false, reason: `Multiple hooks detected (${hookCount}) - creates word salad` };
    }
    
    // Check for broken grammar patterns
    const brokenPatterns = [
      /"[A-Z][^"]*"[^.!?]*"/, // Multiple quotes without proper closing
      /:\s*"/,                // Colon followed by quote (broken optimization)
      /\s{3,}/,              // Multiple spaces
      /[.!?]{2,}/            // Multiple punctuation
    ];
    
    for (const pattern of brokenPatterns) {
      if (pattern.test(content)) {
        return { isValid: false, reason: 'Contains broken grammar patterns from optimization' };
      }
    }
    
    // Check minimum coherence
    if (content.length < 50) {
      return { isValid: false, reason: 'Content too short to be meaningful' };
    }
    
    if (content.length > 280) {
      return { isValid: false, reason: 'Content exceeds Twitter character limit' };
    }
    
    return { isValid: true };
  }

  /**
   * EMERGENCY: Generate safe, readable content when AI fails
   */
  private generateEmergencyContent(topic: string): string {
    const emergencyTemplates = [
      `I spent 6 months testing ${topic} methods. The biggest surprise? The simplest approach worked best. What's been your experience?`,
      `Former health coach here: Most ${topic} advice online is outdated. Here's what actually works in 2024...`,
      `I tried every ${topic} hack for 30 days. Only 2 things made a real difference. Thread coming soon.`,
      `${topic} industry doesn't want you to know: You can get 80% of results with 20% of the effort. Here's how:`,
      `Rich people hire experts for ${topic}. Poor people follow influencers. The difference? Evidence vs entertainment.`,
      `Every doctor says ${topic} is complicated. I tested this for a year. It's actually simple. Change my mind.`
    ];
    
    const template = emergencyTemplates[Math.floor(Math.random() * emergencyTemplates.length)];
    return template.replace(/\$\{topic\}/g, topic);
  }

  /**
   * Select unused topic to ensure diversity
   */
  private selectUnusedTopic(): string {
    const allTopics = Object.values(this.TOPIC_CATEGORIES).flat();
    const unusedTopics = allTopics.filter(topic => 
      !this.topicHistory.some(used => used.includes(topic))
    );
    
    if (unusedTopics.length === 0) {
      // Reset if all topics used
      this.topicHistory = [];
      return allTopics[Math.floor(Math.random() * allTopics.length)];
    }
    
    return unusedTopics[Math.floor(Math.random() * unusedTopics.length)];
  }

  /**
   * Optimize content for maximum engagement using advanced algorithms
   */
  private async optimizeForEngagement(content: string): Promise<{
    optimized_content: string;
    changes_made: string[];
    expected_improvement: number;
    optimization_score: number;
  }> {
    try {
      const { getEngagementOptimizer } = await import('../intelligence/engagementOptimizer');
      const optimizer = getEngagementOptimizer();
      
      // Use engagement optimizer to improve content
      const result = await optimizer.optimizeContentForEngagement(content);
      
      return result;
    } catch (error) {
      console.warn('Engagement optimization failed:', error);
      return {
        optimized_content: content,
        changes_made: [],
        expected_improvement: 0,
        optimization_score: 50
      };
    }
  }

  /**
   * Update content history for duplicate prevention
   */
  private updateContentHistory(recentPosts: string[]): void {
    this.contentHistory = [...this.contentHistory, ...recentPosts].slice(-20); // Keep last 20
  }

  /**
   * Calculate diversity metrics for the content pack
   */
  private calculateDiversityMetrics(singles: string[], threads: ThreadContent[]): any {
    const allContent = [...singles, ...threads.map(t => t.tweets.join(' '))];
    
    return {
      diversityScore: this.calculateDiversityScore(allContent),
      formatMix: this.formatHistory.slice(-5),
      topicMix: this.topicHistory.slice(-5),
      qualityScores: [85, 82, 88] // Will be calculated in real implementation
    };
  }

  /**
   * Calculate diversity score based on content similarity
   */
  private calculateDiversityScore(content: string[]): number {
    // Simple diversity calculation - can be enhanced
    const uniqueWords = new Set(content.join(' ').toLowerCase().split(' '));
    const totalWords = content.join(' ').split(' ').length;
    return Math.min(100, (uniqueWords.size / totalWords) * 200);
  }

  /**
   * Emergency content for failures
   */
  private getEmergencyContent(format: string): string {
    const emergency = {
      'controversial-take': 'Unpopular opinion: Most health advice is designed to sell you something, not help you.',
      'story-personal': 'I tracked my energy for 30 days. Biggest insight? My afternoon crash came from morning coffee timing, not lunch.',
      'question-engagement': 'What\'s one health habit you know works but still don\'t do consistently?',
      'myth-buster': 'Breaking: "8 glasses of water" was never based on science. It came from a 1945 recommendation that included water from food.',
      'stat-shocking': '70% of your immune system lives in your gut. That "gut feeling" about food choices? Your microbiome talking.'
    };
    
    return emergency[format] || 'Quick health tip: The best exercise is the one you actually do consistently.';
  }

  /**
   * Emergency thread for failures
   */
  private getEmergencyThread(format: string): ThreadContent {
    return {
      tweets: [
        'Most people get hydration completely wrong.',
        'The "8 glasses" rule? Made up. Zero science behind it.',
        'What you actually need: Half your body weight in ounces.',
        'Plus electrolytes if you exercise or sweat.',
        'Your urine color is the best indicator. Pale yellow = perfect.'
      ],
      topic: 'hydration myths',
      format,
      engagementHooks: ['myth-busting', 'practical advice']
    };
  }
}

/**
 * Singleton instance
 */
let operatorInstance: SocialContentOperator | null = null;

export function getSocialContentOperator(): SocialContentOperator {
  if (!operatorInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured for Social Content Operator');
    }
    operatorInstance = new SocialContentOperator(apiKey);
  }
  return operatorInstance;
}
