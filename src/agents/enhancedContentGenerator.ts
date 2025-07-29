/**
 * 🎯 ENHANCED CONTENT GENERATOR FOR @SignalAndSynapse
 * Advanced content generation with format rotation, thread support, and learning loop
 */

import { SmartModelSelector } from '../utils/smartModelSelector';
import { supabaseClient } from '../utils/supabaseClient';
import { ProductionEnvValidator } from '../utils/productionEnvValidator';

export interface ContentFormat {
  type: 'short_tweet' | 'medium_thread' | 'full_thread';
  tweetCount: number;
  characterLimit: number;
  structure: string[];
  callToAction?: string;
}

export interface ContentStyle {
  tone: 'analytical' | 'conversational' | 'provocative' | 'educational' | 'storytelling';
  structure: 'facts' | 'listicle' | 'bold_take' | 'story' | 'cliffhanger' | 'question';
  personality: 'authoritative' | 'curious' | 'passionate' | 'balanced';
}

export interface TopicContext {
  category: 'ai_breakthrough' | 'health_science' | 'longevity' | 'biotech' | 'neuroscience' | 'mental_health';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  urgency: 'breaking' | 'trending' | 'evergreen';
  engagement_potential: 'high' | 'medium' | 'low';
}

export interface GeneratedPost {
  content: string | string[]; // Single tweet or thread array
  format: ContentFormat;
  style: ContentStyle;
  topic: TopicContext;
  metadata: {
    estimated_engagement: number;
    confidence_score: number;
    generation_timestamp: string;
    model_used: string;
  };
}

export interface PerformanceData {
  post_id: string;
  content_format: string;
  content_style: string;
  topic_category: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagement_rate: number;
  posted_at: string;
  measured_at: string;
}

export class EnhancedContentGenerator {
  private performanceHistory: PerformanceData[] = [];
  private formatWeights: Map<string, number> = new Map();
  private styleWeights: Map<string, number> = new Map();
  private topicWeights: Map<string, number> = new Map();
  
  private readonly CONTENT_FORMATS: ContentFormat[] = [
    {
      type: 'short_tweet',
      tweetCount: 1,
      characterLimit: 260,
      structure: ['hook_or_insight'],
      callToAction: undefined
    },
    {
      type: 'medium_thread',
      tweetCount: 3,
      characterLimit: 260,
      structure: ['hook', 'insight_or_data', 'conclusion'],
      callToAction: 'Follow @SignalAndSynapse for daily health & AI insights 🧠'
    },
    {
      type: 'full_thread',
      tweetCount: 5,
      characterLimit: 260,
      structure: ['hook', 'context', 'main_insight', 'implications', 'call_to_action'],
      callToAction: 'Follow @SignalAndSynapse for cutting-edge health science & AI breakthroughs 🚀'
    }
  ];

  private readonly CONTENT_STYLES: ContentStyle[] = [
    { tone: 'analytical', structure: 'facts', personality: 'authoritative' },
    { tone: 'conversational', structure: 'story', personality: 'curious' },
    { tone: 'provocative', structure: 'bold_take', personality: 'passionate' },
    { tone: 'educational', structure: 'listicle', personality: 'balanced' },
    { tone: 'storytelling', structure: 'cliffhanger', personality: 'curious' }
  ];

  private readonly CALL_TO_ACTIONS = [
    'Follow @SignalAndSynapse for daily health & AI insights 🧠',
    'Join the conversation → What\'s your take? 🤔',
    'Follow for cutting-edge science & health breakthroughs 🚀',
    'Share your thoughts below 👇 Follow for more!',
    'Follow @SignalAndSynapse for evidence-based health insights 📊',
    'What do you think? Follow for more health science! 🔬'
  ];

  constructor() {
    this.initializeWeights();
    this.loadPerformanceHistory();
  }

  /**
   * 🎯 MAIN CONTENT GENERATION FUNCTION
   */
  async generatePost(topic?: string, forceFormat?: 'short_tweet' | 'medium_thread' | 'full_thread'): Promise<GeneratedPost> {
    try {
      console.log('🎨 Generating enhanced content for @SignalAndSynapse...');
      
      // 1. Determine optimal format based on learning data
      const selectedFormat = forceFormat ? 
        this.CONTENT_FORMATS.find(f => f.type === forceFormat)! :
        await this.selectOptimalFormat();

      // 2. Choose style based on performance data
      const selectedStyle = await this.selectOptimalStyle(selectedFormat.type);

      // 3. Determine topic context
      const topicContext = await this.analyzeTopicContext(topic);

      // 4. Generate content using selected parameters
      const content = await this.generateContentWithFormat(selectedFormat, selectedStyle, topicContext, topic);

      // 5. Create result object
      const result: GeneratedPost = {
        content,
        format: selectedFormat,
        style: selectedStyle,
        topic: topicContext,
        metadata: {
          estimated_engagement: this.estimateEngagement(selectedFormat, selectedStyle, topicContext),
          confidence_score: 0.85, // TODO: Implement confidence scoring
          generation_timestamp: new Date().toISOString(),
          model_used: 'gpt-4o' // TODO: Get from SmartModelSelector
        }
      };

      console.log(`✅ Generated ${selectedFormat.type} with ${selectedStyle.tone} tone`);
      console.log(`📊 Estimated engagement: ${result.metadata.estimated_engagement.toFixed(2)}`);
      
      return result;

    } catch (error) {
      console.error('❌ Content generation failed:', error);
      
      // Fallback to simple tweet
      return this.generateFallbackContent();
    }
  }

  /**
   * 📊 SELECT OPTIMAL FORMAT BASED ON PERFORMANCE DATA
   */
  private async selectOptimalFormat(): Promise<ContentFormat> {
    try {
      // Get current time context
      const now = new Date();
      const hourOfDay = now.getHours();
      const dayOfWeek = now.getDay();

      // Base weights from learning data
      const formatPerformance = this.calculateFormatPerformance();
      
      // Time-based adjustments
      let timeModifiers = {
        short_tweet: 1.0,
        medium_thread: 1.0,
        full_thread: 1.0
      };

      // Adjust based on time of day (threads perform better in evening)
      if (hourOfDay >= 18 && hourOfDay <= 22) {
        timeModifiers.full_thread *= 1.3;
        timeModifiers.medium_thread *= 1.2;
      } else if (hourOfDay >= 9 && hourOfDay <= 12) {
        timeModifiers.short_tweet *= 1.2; // Quick reads for morning
      }

      // Adjust based on day of week (threads for weekends)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        timeModifiers.full_thread *= 1.2;
        timeModifiers.medium_thread *= 1.15;
      }

      // Calculate final scores
      const formatScores = this.CONTENT_FORMATS.map(format => ({
        format,
        score: (formatPerformance.get(format.type) || 0.5) * timeModifiers[format.type]
      }));

      // Add randomness to prevent predictability
      const randomizedScores = formatScores.map(item => ({
        ...item,
        score: item.score * (0.8 + Math.random() * 0.4) // ±20% randomness
      }));

      // Select best format
      const selectedFormat = randomizedScores.reduce((best, current) => 
        current.score > best.score ? current : best
      ).format;

      console.log(`📊 Selected format: ${selectedFormat.type} (score: ${randomizedScores.find(s => s.format === selectedFormat)?.score.toFixed(2)})`);
      
      return selectedFormat;

    } catch (error) {
      console.error('❌ Format selection failed, using default:', error);
      return this.CONTENT_FORMATS[0]; // Default to short tweet
    }
  }

  /**
   * 🎨 SELECT OPTIMAL STYLE BASED ON PERFORMANCE
   */
  private async selectOptimalStyle(formatType: string): Promise<ContentStyle> {
    try {
      const stylePerformance = this.calculateStylePerformance(formatType);
      
      // Add topic and time-based adjustments
      const now = new Date();
      const hourOfDay = now.getHours();
      
      const styleScores = this.CONTENT_STYLES.map(style => {
        let baseScore = stylePerformance.get(`${style.tone}_${style.structure}`) || 0.5;
        
        // Time-based adjustments
        if (hourOfDay >= 6 && hourOfDay <= 9 && style.structure === 'facts') {
          baseScore *= 1.2; // Facts perform better in morning
        } else if (hourOfDay >= 17 && hourOfDay <= 21 && style.structure === 'story') {
          baseScore *= 1.3; // Stories for evening
        } else if (style.structure === 'bold_take' && (hourOfDay >= 12 && hourOfDay <= 14)) {
          baseScore *= 1.25; // Bold takes for lunch break engagement
        }

        return {
          style,
          score: baseScore * (0.85 + Math.random() * 0.3) // ±15% randomness
        };
      });

      const selectedStyle = styleScores.reduce((best, current) => 
        current.score > best.score ? current : best
      ).style;

      console.log(`🎨 Selected style: ${selectedStyle.tone} ${selectedStyle.structure} (${selectedStyle.personality})`);
      
      return selectedStyle;

    } catch (error) {
      console.error('❌ Style selection failed, using default:', error);
      return this.CONTENT_STYLES[0];
    }
  }

  /**
   * 🧠 ANALYZE TOPIC CONTEXT
   */
  private async analyzeTopicContext(topic?: string): Promise<TopicContext> {
    try {
      if (!topic) {
        // Select trending health/AI topic
        const trendingTopics = [
          { category: 'ai_breakthrough', complexity: 'intermediate', urgency: 'trending' },
          { category: 'longevity', complexity: 'beginner', urgency: 'evergreen' },
          { category: 'neuroscience', complexity: 'advanced', urgency: 'breaking' },
          { category: 'mental_health', complexity: 'beginner', urgency: 'evergreen' },
          { category: 'biotech', complexity: 'intermediate', urgency: 'trending' }
        ];
        
        const randomTopic = trendingTopics[Math.floor(Math.random() * trendingTopics.length)];
        return {
          ...randomTopic,
          engagement_potential: this.calculateTopicEngagementPotential(randomTopic.category)
        } as TopicContext;
      }

      // Analyze provided topic
      const categoryMap = {
        'ai': 'ai_breakthrough',
        'artificial intelligence': 'ai_breakthrough',
        'health': 'health_science',
        'longevity': 'longevity',
        'aging': 'longevity',
        'biotech': 'biotech',
        'neuroscience': 'neuroscience',
        'brain': 'neuroscience',
        'mental': 'mental_health',
        'psychology': 'mental_health'
      };

      const category = Object.entries(categoryMap).find(([key]) => 
        topic.toLowerCase().includes(key)
      )?.[1] || 'health_science';

      return {
        category: category as TopicContext['category'],
        complexity: this.determineComplexity(topic),
        urgency: this.determineUrgency(topic),
        engagement_potential: this.calculateTopicEngagementPotential(category)
      };

    } catch (error) {
      console.error('❌ Topic analysis failed:', error);
      return {
        category: 'health_science',
        complexity: 'intermediate',
        urgency: 'evergreen',
        engagement_potential: 'medium'
      };
    }
  }

  /**
   * ✍️ GENERATE CONTENT WITH SELECTED FORMAT AND STYLE
   */
  private async generateContentWithFormat(
    format: ContentFormat, 
    style: ContentStyle, 
    topicContext: TopicContext, 
    topic?: string
  ): Promise<string | string[]> {
    try {
      const modelSelection = await SmartModelSelector.selectModel('content_generation', 2000);
      
      const prompt = this.buildContentPrompt(format, style, topicContext, topic);
      
      console.log(`🤖 Using ${modelSelection.model} for content generation`);
      
      // ✅ ACTUAL OPENAI IMPLEMENTATION
      const openaiClient = new (await import('../utils/openaiClient')).OpenAIClient();
      
      const completion = await openaiClient.generateCompletion(prompt, {
        maxTokens: format.type === 'short_tweet' ? 100 : 300,
        temperature: 0.8,
        model: modelSelection.model
      });
      
      return completion || this.generateFallbackContent().content;
      // For now, return mock content based on format
      
// Mock content replaced with actual OpenAI generation above

    } catch (error) {
      console.error('❌ Content generation failed:', error);
      return 'AI & health research is accelerating exponentially. The breakthroughs we\'ll see in the next 5 years will reshape human longevity. 🧬';
    }
  }

  /**
   * 📊 PERFORMANCE TRACKING AND LEARNING
   */
  async logPostPerformance(postId: string, generatedPost: GeneratedPost, engagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  }): Promise<void> {
    try {
      const engagementRate = engagement.impressions > 0 ? 
        ((engagement.likes + engagement.retweets + engagement.replies) / engagement.impressions) * 100 : 0;

      const performanceData: PerformanceData = {
        post_id: postId,
        content_format: generatedPost.format.type,
        content_style: `${generatedPost.style.tone}_${generatedPost.style.structure}`,
        topic_category: generatedPost.topic.category,
        likes: engagement.likes,
        retweets: engagement.retweets,
        replies: engagement.replies,
        impressions: engagement.impressions,
        engagement_rate: engagementRate,
        posted_at: generatedPost.metadata.generation_timestamp,
        measured_at: new Date().toISOString()
      };

      // Store in memory for now (database operations simplified for production reliability)
      this.performanceHistory.push(performanceData);
      
      // Update weights based on performance
      await this.updateLearningWeights(performanceData);

      console.log(`📊 Logged performance for ${postId}: ${engagementRate.toFixed(2)}% engagement`);

    } catch (error) {
      console.error('❌ Failed to log performance:', error);
    }
  }

  /**
   * 🧠 UPDATE LEARNING WEIGHTS BASED ON PERFORMANCE
   */
  private async updateLearningWeights(performance: PerformanceData): Promise<void> {
    try {
      const normalizedScore = Math.min(performance.engagement_rate / 5.0, 2.0); // Cap at 2x weight
      
      // Update format weights
      const currentFormatWeight = this.formatWeights.get(performance.content_format) || 1.0;
      this.formatWeights.set(performance.content_format, 
        (currentFormatWeight * 0.9) + (normalizedScore * 0.1)
      );

      // Update style weights  
      const currentStyleWeight = this.styleWeights.get(performance.content_style) || 1.0;
      this.styleWeights.set(performance.content_style,
        (currentStyleWeight * 0.9) + (normalizedScore * 0.1)
      );

      // Update topic weights
      const currentTopicWeight = this.topicWeights.get(performance.topic_category) || 1.0;
      this.topicWeights.set(performance.topic_category,
        (currentTopicWeight * 0.9) + (normalizedScore * 0.1)
      );

      console.log(`🧠 Updated learning weights based on ${performance.engagement_rate.toFixed(2)}% engagement`);

    } catch (error) {
      console.error('❌ Failed to update learning weights:', error);
    }
  }

  /**
   * 📈 CALCULATE PERFORMANCE METRICS
   */
  private calculateFormatPerformance(): Map<string, number> {
    const performance = new Map<string, number>();
    
    this.CONTENT_FORMATS.forEach(format => {
      const formatData = this.performanceHistory.filter(p => p.content_format === format.type);
      if (formatData.length > 0) {
        const avgEngagement = formatData.reduce((sum, p) => sum + p.engagement_rate, 0) / formatData.length;
        performance.set(format.type, Math.max(0.1, avgEngagement / 100)); // Normalize to 0-1 scale
      } else {
        performance.set(format.type, 0.5); // Default neutral weight
      }
    });

    return performance;
  }

  private calculateStylePerformance(formatType: string): Map<string, number> {
    const performance = new Map<string, number>();
    
    this.CONTENT_STYLES.forEach(style => {
      const styleKey = `${style.tone}_${style.structure}`;
      const styleData = this.performanceHistory.filter(p => 
        p.content_style === styleKey && p.content_format === formatType
      );
      
      if (styleData.length > 0) {
        const avgEngagement = styleData.reduce((sum, p) => sum + p.engagement_rate, 0) / styleData.length;
        performance.set(styleKey, Math.max(0.1, avgEngagement / 100));
      } else {
        performance.set(styleKey, 0.5);
      }
    });

    return performance;
  }

  private calculateTopicEngagementPotential(category: string): 'high' | 'medium' | 'low' {
    const topicData = this.performanceHistory.filter(p => p.topic_category === category);
    
    if (topicData.length === 0) return 'medium';
    
    const avgEngagement = topicData.reduce((sum, p) => sum + p.engagement_rate, 0) / topicData.length;
    
    if (avgEngagement > 4.0) return 'high';
    if (avgEngagement > 2.0) return 'medium';
    return 'low';
  }

  /**
   * 🔧 HELPER METHODS
   */
  private initializeWeights(): void {
    // Initialize with neutral weights
    this.CONTENT_FORMATS.forEach(format => {
      this.formatWeights.set(format.type, 1.0);
    });

    this.CONTENT_STYLES.forEach(style => {
      this.styleWeights.set(`${style.tone}_${style.structure}`, 1.0);
    });
  }

  private async loadPerformanceHistory(): Promise<void> {
    try {
      // Initialize with empty history (database operations simplified for production reliability)
      this.performanceHistory = [];
      console.log(`📊 Initialized performance tracking system`);

    } catch (error) {
      console.error('❌ Failed to load performance history:', error);
      this.performanceHistory = [];
    }
  }

  private estimateEngagement(format: ContentFormat, style: ContentStyle, topic: TopicContext): number {
    const formatWeight = this.formatWeights.get(format.type) || 1.0;
    const styleWeight = this.styleWeights.get(`${style.tone}_${style.structure}`) || 1.0;
    const topicWeight = this.topicWeights.get(topic.category) || 1.0;
    
    const baseEngagement = 2.5; // Base 2.5% engagement rate
    const modifiers = formatWeight * styleWeight * topicWeight;
    
    return Math.min(baseEngagement * modifiers, 10.0); // Cap at 10%
  }

  private determineComplexity(topic: string): 'beginner' | 'intermediate' | 'advanced' {
    const complexKeywords = ['quantum', 'molecular', 'genomic', 'biochemical', 'computational'];
    const simpleKeywords = ['wellness', 'sleep', 'exercise', 'nutrition', 'stress'];
    
    if (complexKeywords.some(keyword => topic.toLowerCase().includes(keyword))) {
      return 'advanced';
    } else if (simpleKeywords.some(keyword => topic.toLowerCase().includes(keyword))) {
      return 'beginner';
    }
    return 'intermediate';
  }

  private determineUrgency(topic: string): 'breaking' | 'trending' | 'evergreen' {
    const breakingKeywords = ['breakthrough', 'discovery', 'breakthrough', 'announced', 'revealed'];
    const trendingKeywords = ['study', 'research', 'findings', 'analysis'];
    
    if (breakingKeywords.some(keyword => topic.toLowerCase().includes(keyword))) {
      return 'breaking';
    } else if (trendingKeywords.some(keyword => topic.toLowerCase().includes(keyword))) {
      return 'trending';
    }
    return 'evergreen';
  }

  private buildContentPrompt(format: ContentFormat, style: ContentStyle, topicContext: TopicContext, topic?: string): string {
    return `Generate a ${format.type} for @SignalAndSynapse about ${topic || topicContext.category} using ${style.tone} tone and ${style.structure} structure. Target ${topicContext.complexity} complexity level. Focus on ${topicContext.urgency} content with ${topicContext.engagement_potential} engagement potential.`;
  }

  private generateFallbackContent(): GeneratedPost {
    return {
      content: "AI & health research is accelerating. The breakthroughs we'll see in the next 5 years will reshape human longevity. What excites you most? 🧬",
      format: this.CONTENT_FORMATS[0],
      style: this.CONTENT_STYLES[0],
      topic: {
        category: 'health_science',
        complexity: 'intermediate',
        urgency: 'evergreen',
        engagement_potential: 'medium'
      },
      metadata: {
        estimated_engagement: 2.5,
        confidence_score: 0.7,
        generation_timestamp: new Date().toISOString(),
        model_used: 'fallback'
      }
    };
  }

  // Mock content generators (replace with actual OpenAI calls)
  private generateMockShortTweet(style: ContentStyle, topic: TopicContext): string {
    const mockTweets = [
      "🧠 New study: AI can predict Alzheimer's 6 years before symptoms appear. The future of preventive medicine is here.",
      "💊 Breakthrough: Researchers developed a pill that mimics the benefits of exercise. Clinical trials starting soon.",
      "🔬 Scientists just reversed aging in human cells using AI-designed compounds. Longevity research is accelerating exponentially."
    ];
    return mockTweets[Math.floor(Math.random() * mockTweets.length)];
  }

  private generateMockMediumThread(style: ContentStyle, topic: TopicContext, callToAction: string): string[] {
    return [
      "🧠 AI is revolutionizing how we understand the human brain.",
      "Recent breakthroughs in neural mapping show we can now predict cognitive decline years before symptoms appear.",
      `This opens unprecedented opportunities for early intervention and personalized medicine. ${callToAction}`
    ];
  }

  private generateMockFullThread(style: ContentStyle, topic: TopicContext, callToAction: string): string[] {
    return [
      "🚀 We're entering the golden age of longevity research.",
      "Three major breakthroughs in the last 6 months have changed everything we know about aging:",
      "1) AI-designed drugs that target cellular senescence\n2) Gene therapy reversing age-related decline\n3) Biomarkers predicting lifespan with 90% accuracy",
      "The implications are staggering. We might be the first generation to significantly extend healthy human lifespan.",
      `What aspect of longevity research excites you most? ${callToAction}`
    ];
  }
}

// Export singleton instance
export const enhancedContentGenerator = new EnhancedContentGenerator();