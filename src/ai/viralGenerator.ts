import OpenAI from 'openai';
import { getViralPrompt, getViralCriticPrompt, getEmergencyViralTopic, ViralGenerationParams } from './viralPrompts';

export interface ViralContentResult {
  format: 'thread' | 'single';
  topic: string;
  tweets: string[];
  viralityScore: number;
  engagementHooks: string[];
  controversyLevel: 'low' | 'medium' | 'high';
}

export class ViralContentGenerator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate viral content optimized for maximum engagement
   */
  async generateViralContent(params: ViralGenerationParams): Promise<{
    success: boolean;
    content?: ViralContentResult;
    viralityScore?: number;
    attempts?: number;
    error?: string;
  }> {
    console.log('🔥 VIRAL_GENERATOR: Creating high-engagement content');
    
    // If no topic provided, use emergency viral topic
    if (!params.topic) {
      params.topic = getEmergencyViralTopic();
      console.log(`🎯 Using emergency viral topic: ${params.topic}`);
    }
    
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 VIRAL_ATTEMPT: ${attempts}/${maxAttempts}`);

      try {
        // Generate viral content
        const content = await this.generateRawViralContent(params);
        if (!content.success) {
          console.error('❌ VIRAL_GENERATION_FAILED:', content.error);
          if (attempts >= maxAttempts) {
            return { success: false, error: content.error, attempts };
          }
          continue;
        }

        console.log('🔍 VIRAL_EVALUATION: Checking engagement potential');
        
        // Evaluate virality
        const viralCheck = await this.evaluateVirality(content.content!);
        const score = viralCheck.score || 0;
        
        console.log(`📊 Virality score: ${score}/100`);

        // For viral content, we want HIGH scores (80+)
        if (score >= 80 || attempts >= maxAttempts) {
          console.log(score >= 80 ? '🔥 VIRAL_SUCCESS: High engagement potential!' : '⚠️ Using best attempt');
          return { 
            success: true, 
            content: content.content!, 
            viralityScore: score,
            attempts 
          };
        }

        // Regenerate with more aggressive settings
        if (attempts < maxAttempts) {
          console.log(`🔄 Score too low (${score}/100), increasing virality...`);
          params.viralityLevel = 'maximum';
          params.contentStyle = 'controversial';
        }

      } catch (error) {
        console.error(`❌ VIRAL_ATTEMPT_${attempts}_FAILED:`, error);
        if (attempts >= maxAttempts) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Viral generation error',
            attempts 
          };
        }
      }
    }

    return { success: false, error: 'Max viral attempts reached', attempts };
  }

  /**
   * Generate raw viral content using OpenAI
   */
  private async generateRawViralContent(params: ViralGenerationParams): Promise<{
    success: boolean;
    content?: ViralContentResult;
    error?: string;
  }> {
    try {
      const prompt = getViralPrompt(params);
      const tokenLimit = params.format === 'thread' ? 1800 : 500;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use latest model for best viral content
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, // Higher temperature for more creative/controversial content
        top_p: 0.95,
        presence_penalty: 0.3, // Encourage new ideas
        frequency_penalty: 0.2, // Reduce repetition
        max_tokens: tokenLimit,
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        return { success: false, error: 'No viral content returned from OpenAI' };
      }

      let content: ViralContentResult;
      try {
        const { safeJsonParse } = await import('../utils/jsonCleaner');
        content = safeJsonParse(rawContent);
      } catch (error) {
        return { success: false, error: `Invalid JSON response from viral generator: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }

      // Validate viral content structure
      if (!content.tweets || !Array.isArray(content.tweets) || content.tweets.length === 0) {
        return { success: false, error: 'Invalid viral content structure' };
      }

      // Validate tweet lengths - STRICT limits to prevent Twitter rejection
      const invalidTweets = content.tweets.filter(tweet => 
        typeof tweet !== 'string' || tweet.length < 50 || tweet.length > 260
      );

      if (invalidTweets.length > 0) {
        return { success: false, error: `Invalid tweet lengths: ${invalidTweets.length} tweets` };
      }

      return { success: true, content };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown viral generation error' 
      };
    }
  }

  /**
   * Evaluate content for viral potential
   */
  private async evaluateVirality(content: ViralContentResult): Promise<{
    success: boolean;
    score?: number;
    passes?: boolean;
    feedback?: any;
    error?: string;
  }> {
    try {
      const criticPrompt = getViralCriticPrompt(content);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: criticPrompt }],
        temperature: 0.1, // Low temperature for consistent evaluation
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const rawFeedback = response.choices[0]?.message?.content;
      if (!rawFeedback) {
        return { success: false, error: 'No viral feedback received' };
      }

      let feedback: any;
      try {
        feedback = JSON.parse(rawFeedback);
      } catch (error) {
        return { success: false, error: 'Invalid JSON from viral critic' };
      }

      const score = feedback.viralityScore || 0;
      const passes = feedback.passes || score >= 80; // High bar for viral content

      return { 
        success: true, 
        score, 
        passes,
        feedback 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Viral evaluation error' 
      };
    }
  }

  /**
   * Quick viral tweet generation
   */
  async generateViralTweet(topic?: string): Promise<{
    success: boolean;
    tweet?: string;
    viralityScore?: number;
    error?: string;
  }> {
    try {
      const result = await this.generateViralContent({
        topic: topic || getEmergencyViralTopic(),
        format: 'single',
        viralityLevel: 'high',
        contentStyle: 'controversial'
      });

      if (!result.success || !result.content) {
        return { success: false, error: result.error };
      }

      return { 
        success: true, 
        tweet: result.content.tweets[0],
        viralityScore: result.viralityScore
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Viral tweet generation error' 
      };
    }
  }

  /**
   * Generate controversial take on a topic
   */
  async generateControversialTake(topic: string): Promise<{
    success: boolean;
    tweet?: string;
    controversyLevel?: string;
    error?: string;
  }> {
    try {
      const result = await this.generateViralContent({
        topic: `Controversial opinion about: ${topic}`,
        format: 'single',
        viralityLevel: 'maximum',
        contentStyle: 'controversial'
      });

      if (!result.success || !result.content) {
        return { success: false, error: result.error };
      }

      return { 
        success: true, 
        tweet: result.content.tweets[0],
        controversyLevel: result.content.controversyLevel
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Controversial take generation error' 
      };
    }
  }
}

/**
 * Singleton instance for reuse
 */
let viralGeneratorInstance: ViralContentGenerator | null = null;

export function getViralContentGenerator(): ViralContentGenerator {
  if (!viralGeneratorInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured for viral generator');
    }
    viralGeneratorInstance = new ViralContentGenerator(apiKey);
  }
  return viralGeneratorInstance;
}

/**
 * Emergency viral content for immediate use
 */
export const EMERGENCY_VIRAL_TWEETS = [
  "Unpopular opinion: Your 'healthy' breakfast is keeping you tired all day. I haven't eaten breakfast in 2 years and my energy is insane. The cereal industry played us all.",
  
  "Stop drinking 8 glasses of water. You're literally flushing money down the toilet. Add 1/4 tsp sea salt to your morning water instead. Your cells need sodium to actually absorb it.",
  
  "Your trainer lied to you about cardio. I spent $5K to learn this: 20 minutes of heavy lifting burns more fat than an hour on the treadmill. Cardio is keeping you skinny-fat.",
  
  "Hot take: Meditation apps are making anxiety worse. I used Headspace for a year and felt more scattered than ever. 5 minutes of walking outside beats any guided meditation.",
  
  "Your doctor won't tell you this: Cholesterol levels don't predict heart attacks. I spent $10K on private testing to learn what actually matters (hint: it's not total cholesterol)."
];

/**
 * Get emergency viral tweet for immediate posting
 */
export function getEmergencyViralTweet(): string {
  return EMERGENCY_VIRAL_TWEETS[Math.floor(Math.random() * EMERGENCY_VIRAL_TWEETS.length)];
}
