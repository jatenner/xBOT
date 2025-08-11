import OpenAI from 'openai';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface ContentGenerationRequest {
  contentType: 'thread' | 'single' | 'reply';
  topic?: string;
  mood?: 'informative' | 'engaging' | 'funny' | 'controversial';
  targetLength?: 'short' | 'medium' | 'long';
}

export interface GeneratedContent {
  content: string;
  isThread: boolean;
  threadParts?: string[];
  hashtags: string[];
  estimatedEngagement: number;
  contentScore: number;
}

export class IntelligentContentGenerator {
  private static instance: IntelligentContentGenerator;
  private openai: OpenAI;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): IntelligentContentGenerator {
    if (!IntelligentContentGenerator.instance) {
      IntelligentContentGenerator.instance = new IntelligentContentGenerator();
    }
    return IntelligentContentGenerator.instance;
  }

  public async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      console.log('🧠 Generating intelligent content...', request);

      // Get content style from database
      const contentStyle = await this.getContentStyle();
      
      // Generate content based on request
      const prompt = this.buildPrompt(request, contentStyle);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a viral content creator who builds massive followings. Create engaging, human-like content that gets shared.
            
            RULES:
            - Sound like a real person, not a brand or corporate account
            - NO hashtags unless absolutely necessary (hashtags kill reach)
            - If creating a thread, number it properly (1/, 2/, etc.)
            - Make it shareable, relatable, and valuable
            - Cover diverse topics: productivity, life hacks, science, relationships, career, finance, tech
            - Write like you're texting a friend or sharing something you just learned
            - Each thread part should be under 280 characters
            - Start with hooks like "Just realized...", "Pro tip:", "Anyone else...", "Fun fact:"
            - Avoid quote-like formatting - make it conversational`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.8
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Analyze the generated content
      const analysis = this.analyzeContent(content);
      
      // Store generation data for learning
      await this.storeGenerationData(request, content, analysis);
      
      return analysis;
    } catch (error: any) {
      console.error('❌ Content generation failed:', error.message);
      throw error;
    }
  }

  private buildPrompt(request: ContentGenerationRequest, style: string): string {
    const topics = [
      'productivity hacks', 'life optimization', 'surprising facts', 'career insights', 
      'money tips', 'relationship advice', 'tech discoveries', 'psychology insights',
      'time management', 'personal growth', 'science breakthroughs', 'learning techniques',
      'creativity tips', 'health optimization', 'wellness hacks', 'success principles'
    ];
    
    const randomTopic = request.topic || topics[Math.floor(Math.random() * topics.length)];
    
    const prompts = {
      thread: `Create a viral Twitter thread about ${randomTopic}. 
              Start with a hook, then break down insights. Make it ${request.mood || 'engaging'}.
              Number each part (1/, 2/, etc.). Sound human and shareable.`,
      
      single: `Create a viral tweet about ${randomTopic}. 
               Make it ${request.mood || 'engaging'} and relatable.
               Start with "Just learned...", "Pro tip:", "Fun fact:", or "Anyone else...".
               No hashtags. Sound like a real person.`,
               
      reply: `Create a helpful reply about ${randomTopic}. 
              Be conversational and add value. 
              Sound like you're genuinely helping a friend.`
    };

    return prompts[request.contentType] || prompts.single;
  }

  private analyzeContent(content: string): GeneratedContent {
    // Detect if it's a thread
    const isThread = /\d+\//.test(content);
    
    // Split into thread parts if it's a thread
    let threadParts: string[] = [];
    if (isThread) {
      threadParts = content.split('\n\n').filter(part => part.trim().length > 0);
    }

    // Extract hashtags
    const hashtags = content.match(/#\w+/g) || [];

    // Calculate engagement score (simplified)
    const engagementScore = this.calculateEngagementScore(content);
    
    // Calculate content quality score
    const contentScore = this.calculateContentScore(content);

    return {
      content: isThread ? threadParts.join('\n\n') : content,
      isThread,
      threadParts: isThread ? threadParts : undefined,
      hashtags,
      estimatedEngagement: engagementScore,
      contentScore
    };
  }

  private calculateEngagementScore(content: string): number {
    let score = 50; // Base score
    
    // Length optimization
    if (content.length > 100 && content.length < 250) score += 10;
    
    // Question marks increase engagement
    if (content.includes('?')) score += 15;
    
    // Emojis (but not too many)
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > 0 && emojiCount <= 3) score += 5;
    
    // Hashtags (but penalize too many)
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    if (hashtagCount === 0) score += 10; // No hashtags is more human
    if (hashtagCount > 3) score -= 15; // Too many hashtags
    
    // Thread bonus
    if (/\d+\//.test(content)) score += 20;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateContentScore(content: string): number {
    let score = 50;
    
    // Value indicators
    if (content.includes('tip') || content.includes('hack') || content.includes('secret')) score += 10;
    if (content.includes('study') || content.includes('research')) score += 5;
    if (content.includes('myth') || content.includes('truth')) score += 8;
    
    // Readability
    const sentences = content.split(/[.!?]+/).length;
    if (sentences >= 2 && sentences <= 5) score += 10;
    
    // Personal tone
    if (content.includes('you') || content.includes('your')) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private async getContentStyle(): Promise<string> {
    try {
      const result = await this.db.executeQuery(
        'get_content_style',
        async (client) => {
          const { data, error } = await client
            .from('bot_config')
            .select('config_value')
            .eq('config_key', 'content_style')
            .single();
          if (error) throw error;
          return data;
        }
      );
      return result?.config_value || 'health_focused';
    } catch (error) {
      console.warn('Failed to get content style, using default');
      return 'health_focused';
    }
  }

  private async storeGenerationData(
    request: ContentGenerationRequest, 
    content: string, 
    analysis: GeneratedContent
  ): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_generation_data',
        async (client) => {
          const { error } = await client
            .from('content_generations')
            .insert({
              content_type: request.contentType,
              topic: request.topic || 'general',
              mood: request.mood || 'informative',
              content: content,
              engagement_score: analysis.estimatedEngagement,
              content_score: analysis.contentScore
            });
          if (error) throw error;
          return { success: true };
        }
      );
    } catch (error) {
      // Non-critical error - content generation should continue
      console.warn('Failed to store generation data:', error);
    }
  }

  public async getTopPerformingTopics(limit: number = 10): Promise<Array<{topic: string, avgScore: number}>> {
    try {
      const result = await this.db.executeQuery(
        'get_top_performing_topics',
        async (client) => {
          const { data, error } = await client
            .rpc('get_top_performing_topics', { 
              topic_limit: limit,
              days_back: 30,
              min_count: 3 
            });
          if (error) throw error;
          return data || [];
        }
      );
      
      return result.map((row: any) => ({
        topic: row.topic,
        avgScore: parseFloat(row.avg_score)
      }));
    } catch (error) {
      console.warn('Failed to get top performing topics:', error);
      return [];
    }
  }
}