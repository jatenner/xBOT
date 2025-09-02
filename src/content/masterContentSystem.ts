/**
 * MASTER CONTENT SYSTEM
 * Unified orchestrator for all content operations: generation, strategy, growth, learning
 */

import { OpenAI } from 'openai';

export interface ContentSystemConfig {
  account_goals: {
    target_followers: number;
    growth_rate_target: number; // followers per day
    engagement_rate_target: number; // %
    content_pillars: string[];
  };
  content_strategy: {
    posting_frequency: number; // posts per day
    content_mix: {
      threads: number; // %
      single_tweets: number; // %
      replies: number; // %
    };
    tone: 'educational' | 'conversational' | 'contrarian' | 'inspirational';
    authenticity_level: number; // 1-10
  };
}

export interface ContentPlan {
  content_type: 'thread' | 'single' | 'reply';
  topic: string;
  angle: string;
  target_engagement: number;
  viral_potential: number;
  learning_focus: string[];
  strategic_purpose: string;
}

export interface ContentResult {
  content: string;
  metadata: {
    type: 'thread' | 'single' | 'reply';
    topic: string;
    angle: string;
    quality_score: number;
    viral_prediction: number;
    authenticity_score: number;
    strategic_alignment: number;
  };
  performance_prediction: {
    likes: number;
    retweets: number;
    replies: number;
    followers_gained: number;
  };
}

export interface LearningData {
  content_id: string;
  content: string;
  performance: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    followers_before: number;
    followers_after: number;
  };
  lessons: {
    what_worked: string[];
    what_failed: string[];
    insights: string[];
    recommendations: string[];
  };
}

export class MasterContentSystem {
  private static instance: MasterContentSystem;
  private openai: OpenAI;
  private config: ContentSystemConfig;
  private learningHistory: LearningData[] = [];

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.config = {
      account_goals: {
        target_followers: 10000,
        growth_rate_target: 50, // 50 new followers per day
        engagement_rate_target: 3.5, // 3.5% engagement rate
        content_pillars: ['health optimization', 'biohacking', 'productivity', 'wellness']
      },
      content_strategy: {
        posting_frequency: 3, // 3 posts per day
        content_mix: {
          threads: 40, // 40% threads
          single_tweets: 50, // 50% single tweets
          replies: 10 // 10% strategic replies
        },
        tone: 'conversational',
        authenticity_level: 9
      }
    };
  }

  public static getInstance(): MasterContentSystem {
    if (!MasterContentSystem.instance) {
      MasterContentSystem.instance = new MasterContentSystem();
    }
    return MasterContentSystem.instance;
  }

  /**
   * CONTENT GENERATION - Advanced AI with multiple models
   */
  public async generateContent(requirements?: Partial<ContentPlan>): Promise<ContentResult> {
    console.log('🎯 MASTER_CONTENT: Starting comprehensive content generation...');

    // Step 1: Strategic Planning
    const plan = await this.createStrategicPlan(requirements);
    console.log(`📋 STRATEGIC_PLAN: ${plan.strategic_purpose}`);

    // Step 2: Multi-Model Content Generation
    const rawContent = await this.generateWithMultipleModels(plan);
    
    // Step 3: Quality Enhancement
    const enhancedContent = await this.enhanceContentQuality(rawContent, plan);
    
    // Step 4: Performance Prediction
    const prediction = await this.predictPerformance(enhancedContent);
    
    // Step 5: Strategic Alignment Check
    const alignmentScore = await this.assessStrategicAlignment(enhancedContent, plan);

    const result: ContentResult = {
      content: enhancedContent,
      metadata: {
        type: plan.content_type,
        topic: plan.topic,
        angle: plan.angle,
        quality_score: await this.scoreQuality(enhancedContent),
        viral_prediction: plan.viral_potential,
        authenticity_score: await this.scoreAuthenticity(enhancedContent),
        strategic_alignment: alignmentScore
      },
      performance_prediction: prediction
    };

    console.log(`✅ CONTENT_GENERATED: Quality ${result.metadata.quality_score}/100, Viral ${result.metadata.viral_prediction}/100`);
    return result;
  }

  /**
   * CONTENT STRATEGY - Data-driven strategic planning
   */
  private async createStrategicPlan(requirements?: Partial<ContentPlan>): Promise<ContentPlan> {
    // Analyze recent performance
    const recentLessons = await this.getRecentLearnings();
    
    // Determine optimal content type based on data
    const contentType = requirements?.content_type || await this.determineOptimalContentType();
    
    // Select high-performing topic
    const topic = requirements?.topic || await this.selectStrategicTopic();
    
    // Choose angle based on what's working
    const angle = requirements?.angle || await this.selectWinningAngle(topic);

    return {
      content_type: contentType,
      topic,
      angle,
      target_engagement: this.calculateTargetEngagement(),
      viral_potential: await this.predictViralPotential(topic, angle),
      learning_focus: await this.identifyLearningOpportunities(),
      strategic_purpose: await this.defineStrategicPurpose(contentType, topic)
    };
  }

  /**
   * CONTENT GROWTH - Optimization for follower acquisition
   */
  private async generateWithMultipleModels(plan: ContentPlan): Promise<string> {
    const strategies = [
      'contrarian_expert', // Challenge conventional wisdom
      'practical_experimenter', // Share real experiments
      'insight_synthesizer', // Connect unexpected dots
      'community_builder' // Ask engaging questions
    ];

    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    const prompt = this.buildAdvancedPrompt(plan, strategy);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Use best model for content generation
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(strategy)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('❌ Advanced content generation failed:', error);
      throw error;
    }
  }

  private getSystemPrompt(strategy: string): string {
    const prompts = {
      contrarian_expert: `You are a contrarian health expert who challenges popular beliefs with evidence-based insights. Your content makes people think "I never thought of it that way" and gets massive engagement through thoughtful disagreement with conventional wisdom.`,
      
      practical_experimenter: `You are someone who constantly experiments with health optimization and shares real results. Your content is valuable because it shows actual data from real experiments, not just theory. People follow you for actionable insights they can try themselves.`,
      
      insight_synthesizer: `You are exceptional at connecting unexpected dots in health and wellness. You synthesize information from different fields to create "aha moments" that make complex topics simple and actionable. Your insights feel profound yet practical.`,
      
      community_builder: `You are focused on building an engaged community around health optimization. Your content always invites conversation, asks thoughtful questions, and makes people feel part of a movement. You're building a tribe, not just posting content.`
    };

    return prompts[strategy as keyof typeof prompts] || prompts.practical_experimenter;
  }

  private buildAdvancedPrompt(plan: ContentPlan, strategy: string): string {
    const recentLearnings = this.getLearningInsights();
    
    return `Create ${plan.content_type} content about: "${plan.topic}"

STRATEGY: ${strategy}
ANGLE: ${plan.angle}
TARGET ENGAGEMENT: ${plan.target_engagement}
VIRAL POTENTIAL TARGET: ${plan.viral_potential}/100

RECENT LEARNINGS FROM OUR DATA:
${recentLearnings.map(l => `- ${l}`).join('\n')}

CONTENT REQUIREMENTS:
- Must sound like a real person, not AI
- Include specific, believable details
- Create curiosity or controversy
- Encourage replies and engagement
- NO fake statistics or unverifiable claims
- NO generic hooks or clickbait phrases
- Maximum authenticity (score target: 90+/100)

${plan.content_type === 'thread' ? 'CREATE THREAD (3-5 tweets):' : 'CREATE SINGLE TWEET:'}

Focus on: ${plan.strategic_purpose}`;
  }

  /**
   * CONTENT LEARNING - Continuous improvement from data
   */
  public async learnFromContent(contentId: string, content: string, performance: any): Promise<LearningData> {
    console.log(`🧠 LEARNING: Analyzing performance of content ${contentId}`);

    const analysis = await this.analyzeContentPerformance(content, performance);
    
    const learningData: LearningData = {
      content_id: contentId,
      content,
      performance,
      lessons: analysis
    };

    // Store learning
    this.learningHistory.push(learningData);
    
    // Update strategy based on learnings
    await this.updateStrategyFromLearnings(learningData);
    
    console.log(`✅ LEARNED: ${analysis.insights.length} insights, ${analysis.recommendations.length} recommendations`);
    return learningData;
  }

  private async analyzeContentPerformance(content: string, performance: any): Promise<LearningData['lessons']> {
    const prompt = `Analyze this content performance and extract actionable insights:

CONTENT: "${content}"

PERFORMANCE:
- Likes: ${performance.likes}
- Retweets: ${performance.retweets}
- Replies: ${performance.replies}
- Impressions: ${performance.impressions}
- Followers gained: ${performance.followers_after - performance.followers_before}

Analyze what worked, what failed, and provide specific recommendations for future content.

Return JSON with: {"what_worked": [], "what_failed": [], "insights": [], "recommendations": []}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use smaller model for analysis
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        what_worked: analysis.what_worked || [],
        what_failed: analysis.what_failed || [],
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || []
      };
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      return {
        what_worked: [],
        what_failed: [],
        insights: [],
        recommendations: []
      };
    }
  }

  // Helper methods
  private async determineOptimalContentType(): Promise<'thread' | 'single' | 'reply'> {
    // Analyze recent performance to determine what's working best
    const recentThreads = this.learningHistory.filter(l => l.content.includes('1/') || l.content.includes('2/')).slice(-10);
    const recentSingles = this.learningHistory.filter(l => !l.content.includes('1/') && !l.content.includes('2/')).slice(-10);
    
    const threadAvgEngagement = recentThreads.reduce((sum, l) => sum + (l.performance.likes + l.performance.retweets + l.performance.replies), 0) / (recentThreads.length || 1);
    const singleAvgEngagement = recentSingles.reduce((sum, l) => sum + (l.performance.likes + l.performance.retweets + l.performance.replies), 0) / (recentSingles.length || 1);
    
    if (threadAvgEngagement > singleAvgEngagement * 1.5) {
      return 'thread';
    }
    
    return Math.random() > 0.6 ? 'thread' : 'single'; // Default mix
  }

  private async selectStrategicTopic(): Promise<string> {
    const topPerformingTopics = this.learningHistory
      .sort((a, b) => (b.performance.likes + b.performance.retweets + b.performance.replies) - (a.performance.likes + a.performance.retweets + a.performance.replies))
      .slice(0, 5)
      .map(l => this.extractTopic(l.content));

    if (topPerformingTopics.length > 0) {
      return topPerformingTopics[0];
    }

    // Default high-performing topics
    const topics = [
      'sleep optimization secrets most people ignore',
      'counterintuitive nutrition facts that work',
      'simple biohacks with immediate results',
      'productivity myths that actually hurt performance',
      'wellness habits that compound over time'
    ];

    return topics[Math.floor(Math.random() * topics.length)];
  }

  private async selectWinningAngle(topic: string): Promise<string> {
    const angles = [
      'personal experiment with specific results',
      'counterintuitive insight that challenges assumptions',
      'simple method most people overlook',
      'common mistake that sabotages progress',
      'unexpected connection between two concepts'
    ];

    return angles[Math.floor(Math.random() * angles.length)];
  }

  private calculateTargetEngagement(): number {
    // Base target on current follower count and recent performance
    const avgEngagement = this.learningHistory.slice(-10).reduce((sum, l) => 
      sum + (l.performance.likes + l.performance.retweets + l.performance.replies), 0
    ) / 10;
    
    return Math.max(5, Math.ceil(avgEngagement * 1.2)); // 20% improvement target
  }

  private async predictViralPotential(topic: string, angle: string): Promise<number> {
    // Simple scoring based on topic and angle
    let score = 50;
    
    if (topic.includes('counterintuitive') || topic.includes('secret') || topic.includes('myths')) score += 20;
    if (angle.includes('experiment') || angle.includes('results')) score += 15;
    if (angle.includes('counterintuitive') || angle.includes('challenges')) score += 25;
    
    return Math.min(95, score);
  }

  private async identifyLearningOpportunities(): Promise<string[]> {
    return [
      'engagement patterns',
      'optimal posting times',
      'content format preferences',
      'topic resonance',
      'audience growth triggers'
    ];
  }

  private async defineStrategicPurpose(contentType: string, topic: string): Promise<string> {
    const purposes = [
      `Build authority on ${topic}`,
      `Drive engagement through ${contentType}`,
      `Attract new followers interested in ${topic}`,
      `Establish thought leadership`,
      `Create viral discussion starter`
    ];

    return purposes[Math.floor(Math.random() * purposes.length)];
  }

  private async enhanceContentQuality(content: string, plan: ContentPlan): Promise<string> {
    // Apply quality enhancements
    let enhanced = content;
    
    // Remove AI tells
    enhanced = enhanced.replace(/Here's the truth:/gi, '');
    enhanced = enhanced.replace(/Let me tell you/gi, '');
    enhanced = enhanced.replace(/\*.*?\*/g, ''); // Remove emphasis markers
    
    // Ensure authenticity
    if (!enhanced.includes('I ') && !enhanced.includes('my ') && plan.content_type === 'single') {
      enhanced = enhanced.replace(/^/, 'I ');
    }
    
    return enhanced.trim();
  }

  private async predictPerformance(content: string): Promise<ContentResult['performance_prediction']> {
    // Simple prediction based on content characteristics
    let likes = 2;
    let retweets = 0;
    let replies = 1;
    let followers = 0;
    
    if (content.includes('?')) replies += 2;
    if (content.includes('I tried') || content.includes('I noticed')) likes += 3;
    if (content.includes('Anyone else')) replies += 3;
    if (content.length > 200) likes += 2; // Threads typically get more engagement
    
    return { likes, retweets, replies, followers_gained: followers };
  }

  private async assessStrategicAlignment(content: string, plan: ContentPlan): Promise<number> {
    // Score how well content aligns with strategic goals
    let score = 70; // Base score
    
    if (content.toLowerCase().includes(plan.topic.toLowerCase())) score += 15;
    if (content.toLowerCase().includes(plan.angle.toLowerCase())) score += 10;
    if (plan.content_type === 'thread' && content.includes('/')) score += 5;
    
    return Math.min(100, score);
  }

  private async scoreQuality(content: string): Promise<number> {
    let score = 70;
    
    // Authenticity indicators
    if (content.includes('I ') || content.includes('my ')) score += 10;
    if (content.includes('?')) score += 5;
    if (/\d+ (days?|weeks?|minutes?|hours?)/.test(content)) score += 10; // Specific timeframes
    
    // Deduct for AI tells
    if (content.includes('game-changer') || content.includes('shocking')) score -= 15;
    if (/\d+%/.test(content) && !content.includes('my ')) score -= 10; // Unverified stats
    
    return Math.max(30, Math.min(100, score));
  }

  private async scoreAuthenticity(content: string): Promise<number> {
    let score = 80;
    
    if (content.includes('I ') || content.includes('my ') || content.includes('me ')) score += 15;
    if (content.includes('Anyone else') || content.includes('Does anyone')) score += 10;
    if (content.includes('tried') || content.includes('noticed') || content.includes('found')) score += 10;
    
    // Deduct for spam indicators
    const spamPhrases = ['shocking', 'secret', 'truth', 'myth busted', 'game-changer'];
    for (const phrase of spamPhrases) {
      if (content.toLowerCase().includes(phrase)) score -= 20;
    }
    
    return Math.max(20, Math.min(100, score));
  }

  private getLearningInsights(): string[] {
    if (this.learningHistory.length === 0) {
      return [
        'Personal experiments get higher engagement than general advice',
        'Questions increase reply rates by 300%',
        'Specific timeframes (10 days, 2 weeks) add credibility',
        'Contrarian angles generate more shares'
      ];
    }

    return this.learningHistory
      .slice(-5)
      .flatMap(l => l.lessons.insights)
      .slice(0, 4);
  }

  private getRecentLearnings(): Promise<string[]> {
    return Promise.resolve(this.getLearningInsights());
  }

  private extractTopic(content: string): string {
    // Simple topic extraction
    const words = content.toLowerCase().split(' ');
    const healthWords = ['sleep', 'diet', 'exercise', 'nutrition', 'wellness', 'health', 'productivity'];
    const found = words.find(word => healthWords.includes(word));
    return found ? `${found} optimization` : 'health optimization';
  }

  private async updateStrategyFromLearnings(learningData: LearningData): Promise<void> {
    // Update internal strategy based on what's working
    const totalEngagement = learningData.performance.likes + learningData.performance.retweets + learningData.performance.replies;
    
    if (totalEngagement > 10) {
      // High-performing content - analyze why
      console.log(`🎯 HIGH_PERFORMER: Content got ${totalEngagement} total engagement`);
      
      // Could update content_strategy based on what worked
      if (learningData.content.includes('?')) {
        console.log('📈 INSIGHT: Questions drive engagement');
      }
      
      if (learningData.content.includes('I tried')) {
        console.log('📈 INSIGHT: Personal experiments resonate');
      }
    }
  }
}

export const masterContentSystem = MasterContentSystem.getInstance();
