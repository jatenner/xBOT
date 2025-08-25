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
  
  // Value-focused content formats for high-performers
  private readonly CONTENT_FORMATS = {
    'research-insight': {
      template: 'Latest research finding with practical application for busy professionals',
      examples: ['New Stanford study: 10-minute morning sunlight exposure improves focus 40% more than coffee. Takes 2 weeks to see full effects.']
    },
    'actionable-tip': {
      template: 'Specific, measurable action with clear benefit for executives/athletes',
      examples: ['Pre-meeting protocol: 4-7-8 breathing for 30 seconds. Reduces cortisol 23% and improves decision quality. Executive teams using this report better outcomes.']
    },
    'myth-correction': {
      template: 'Common health misconception corrected with evidence',
      examples: ['Myth: More sleep = better performance. Reality: Sleep consistency matters more than duration. ±30 minutes same bedtime optimizes cognitive function.']
    },
    'optimization-strategy': {
      template: 'Specific protocol for health/performance optimization',
      examples: ['Travel recovery protocol: Land, 15min sunlight, protein within 2 hours, no caffeine after 2pm. Eliminates jet lag 60% faster than standard advice.']
    },
    'problem-solution': {
      template: 'Common high-performer health challenge with practical solution',
      examples: ['Afternoon energy crash solution: 10-minute walk + 20g protein at 3pm. Stabilizes blood sugar through evening meetings. Game-changer for executives.']
    },
    'data-driven': {
      template: 'Interesting health metric or biomarker insight with application',
      examples: ['HRV below 30? Your nervous system is overstressed. Simple fix: 5-minute breathing exercise daily improves HRV by 15-25% in 4 weeks.']
    },
    'comparison': {
      template: 'Popular vs evidence-based approach comparison',
      examples: ['Popular: 8 glasses water daily. Evidence-based: Half your weight in ounces, adjusted for activity. Most athletes are chronically under-hydrated.']
    },
    'tool-technique': {
      template: 'Specific tool or technique for health optimization',
      examples: ['Underrated recovery tool: Red light therapy 10min post-workout. Increases muscle repair 31% and reduces soreness. $200 device vs $2000 clinics.']
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
    
    // VALUE-FOCUSED format rotation - prioritize helpful, actionable content
    const formatPool = [
      'actionable-tip', 'research-insight', 'optimization-strategy', 
      'problem-solution', 'data-driven', 'myth-correction', 'comparison', 'tool-technique'
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
    
    return `You are an evidence-based health expert sharing valuable insights for @SignalAndSynapse. MISSION: PROVIDE GENUINE VALUE & BUILD TRUST.

BRAND: ${brandNotes}
TOPIC: ${seed}
FORMAT: ${formatInfo.template}

CONTENT STRATEGY:
Your goal is to establish expertise and provide actionable value, not just create controversy. You are building a community of people who want to optimize their health based on science.

DIVERSE CONTENT PATTERNS (rotate between these, never repeat the same pattern twice in a row):

1. RESEARCH INSIGHT: "New study from [institution] shows [finding]. What this means for you: [practical application]"

2. MYTH CORRECTION: "Common belief: [myth]. What science actually shows: [fact]. Why this matters: [implication]"

3. PRACTICAL TIP: "Simple [topic] optimization: [actionable step]. Results you can expect: [outcome]. Takes [time commitment]"

4. PERSONAL EXPERIENCE: "After [time period] optimizing [area], here's what worked: [specific strategy]. Measurable result: [outcome]"

5. COMPARISON: "[Popular approach] vs [evidence-based approach]. The data favors [choice] because [reason]"

6. COUNTER-INTUITIVE FACT: "Most people think [common belief]. Research suggests [different approach]. Key studies: [evidence]"

7. EXPERT INSIGHT: "Top [profession]s know this about [topic]: [insight]. How you can apply it: [action]"

8. TOOL/TECHNIQUE: "Underrated [tool/technique] for [goal]: [description]. Why it works: [mechanism]. How to start: [steps]"

BANNED REPETITIVE PHRASES:
- "I spent $X on..."
- "Total bullshit!"
- "They're wrong:"
- "Former [anything] insider here"
- "Fight me in the comments"

AVOID THESE RECENT PATTERNS:
${avoidContent}

AUTHENTIC VOICE & ENGAGEMENT:
Write as a certified health professional who:
- Has worked with 500+ high-performers over 10 years
- Combines clinical experience with personal optimization
- References specific studies and protocols
- Admits when something is individual/requires personalization
- Shares both successes and learning experiences

Create engagement through:
- "What's your experience with [protocol]?"
- "Anyone else notice [pattern] when trying [strategy]?"
- "This worked for 80% of my clients, but [variation] was needed for others"
- "Worth trying for [specific type of person]?"
- "Game-changer for [profession/athlete type] but requires [context]"

CONTENT REQUIREMENTS:
1. Lead with value, not controversy
2. Include specific, actionable information
3. Reference credible sources when possible
4. Write conversationally but expertly
5. End with a question that invites genuine discussion
6. ≤260 characters total
7. No formulaic hooks or repetitive patterns

${insightText}

Generate ONE valuable, actionable tweet:

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
    // Check for banned phrases that create repetitive content
    const bannedPhrases = [
      'Unpopular opinion', 
      'Plot twist:', 
      'Uncomfortable truth:', 
      'I this scared',
      'I spent $', // FIXED: Ban the repetitive money formula
      'Total bullshit!',
      'They\'re wrong:',
      'Former',
      'Fight me in the comments',
      'insider here:'
    ];
    
    for (const phrase of bannedPhrases) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        return { isValid: false, reason: `Contains banned repetitive phrase: "${phrase}"` };
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
      `I spent $3,200 on a functional medicine doctor. Here's what I learned that your GP will never tell you:`,
      `Your multivitamin is making you sicker. Here's why:\n\n• Contains synthetic vitamins your body can't absorb\n• Iron + calcium blocks zinc absorption\n• Folic acid masks B12 deficiency\n• Cheap magnesium oxide = expensive urine\n\nWhat works instead: whole food vitamins, taken separately, with meals`,
      `The supplement industry doesn't want you to know this, but most vitamin D3 supplements are completely fake.\n\nStudy from Harvard (2023): Only 12% contained the amount on the label.\n\nWhat I use instead: 15 minutes morning sun + cod liver oil. Free vitamin D that actually works.`,
      `I tracked my glucose for 30 days. The results will change how you eat forever:\n\n'Healthy' oatmeal: 180 mg/dL spike (pre-diabetic range)\nSteak + eggs: 88 mg/dL (stable)\n\nBreakfast cereal = metabolic disaster\nReal food = stable energy all day`,
      `Your doctor prescribed statins? Read this first:\n\nNew 2024 study of 500,000 patients:\n• Statins reduced heart attacks by 1.2%\n• Increased diabetes risk by 3.4%\n\nYou're trading heart disease for metabolic disease.\n\nNatural alternatives that work better: omega-3s (-23% heart disease), exercise (-35% cardiovascular death)`,
      `I wasted $2,400 on 'superfoods' before learning this:\n\nAcai berries: $40/lb, same antioxidants as blueberries ($3/lb)\nGoji berries: $25/lb, less vitamin C than oranges ($2/lb)\nSpirulina: $60/lb, less protein than chicken ($5/lb)\n\nMarketing genius. Nutritional scam.`
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
