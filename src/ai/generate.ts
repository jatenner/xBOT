import OpenAI from 'openai';
import { 
  OPENAI_MODEL, 
  OPENAI_TEMPERATURE, 
  OPENAI_TOP_P, 
  OPENAI_PRESENCE_PENALTY, 
  OPENAI_FREQUENCY_PENALTY,
  MAX_REGENERATION_ATTEMPTS 
} from '../config/env';
import { 
  GenerationParams, 
  ContentResult, 
  getGeneratorPrompt, 
  getCriticPrompt, 
  getRegenerationPrompt,
  getTopicExtractionPrompt 
} from './prompts';

export class ContentGenerator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate high-quality content with automatic quality checking and regeneration
   */
  async generateContent(params: GenerationParams): Promise<{
    success: boolean;
    content?: ContentResult;
    qualityScore?: number;
    attempts?: number;
    error?: string;
  }> {
    console.log('🎯 PROMPT_BUILD: Starting content generation with quality loop');
    
    let attempts = 0;
    const maxAttempts = MAX_REGENERATION_ATTEMPTS;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 MODEL_CALL: Generation attempt ${attempts}/${maxAttempts}`);

      try {
        // Generate content
        const content = await this.generateRawContent(params);
        if (!content.success) {
          return { success: false, error: content.error, attempts };
        }

        console.log('🔍 QUALITY_GATE: Evaluating content quality');
        
        // Evaluate quality
        const qualityCheck = await this.evaluateQuality(content.content!);
        if (!qualityCheck.success) {
          console.warn('⚠️ Quality evaluation failed, using content anyway');
          return { 
            success: true, 
            content: content.content!, 
            qualityScore: 50,
            attempts 
          };
        }

        const score = qualityCheck.score!;
        console.log(`📊 Quality score: ${score}/100`);

        // If quality is good enough, return content
        if (qualityCheck.passes) {
          console.log('✅ QUALITY_GATE: Content passed quality check');
          return { 
            success: true, 
            content: content.content!, 
            qualityScore: score,
            attempts 
          };
        }

        // If we have attempts left, regenerate with feedback
        if (attempts < maxAttempts) {
          console.log(`🔄 Quality insufficient (${score}/100), regenerating...`);
          params = this.createRegenerationParams(params, qualityCheck.feedback);
        } else {
          console.warn(`⚠️ Max attempts reached. Using best content with score: ${score}/100`);
          return { 
            success: true, 
            content: content.content!, 
            qualityScore: score,
            attempts 
          };
        }

      } catch (error) {
        console.error(`❌ Generation attempt ${attempts} failed:`, error);
        if (attempts >= maxAttempts) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown generation error',
            attempts 
          };
        }
      }
    }

    return { success: false, error: 'Max attempts reached without success', attempts };
  }

  /**
   * Generate raw content using OpenAI
   */
  private async generateRawContent(params: GenerationParams): Promise<{
    success: boolean;
    content?: ContentResult;
    error?: string;
  }> {
    try {
      const prompt = getGeneratorPrompt(params);
      const tokenLimit = params.format === 'thread' ? 1600 : 400;

      const response = await this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: OPENAI_TEMPERATURE,
        top_p: OPENAI_TOP_P,
        presence_penalty: OPENAI_PRESENCE_PENALTY,
        frequency_penalty: OPENAI_FREQUENCY_PENALTY,
        max_tokens: tokenLimit,
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        return { success: false, error: 'No content returned from OpenAI' };
      }

      // Parse and validate JSON
      let content: ContentResult;
      try {
        content = JSON.parse(rawContent);
      } catch (error) {
        return { success: false, error: 'Invalid JSON response from OpenAI' };
      }

      // Basic validation
      if (!content.tweets || !Array.isArray(content.tweets) || content.tweets.length === 0) {
        return { success: false, error: 'Invalid content structure' };
      }

      // Validate tweet lengths
      const invalidTweets = content.tweets.filter(tweet => 
        typeof tweet !== 'string' || tweet.length < 40 || tweet.length > 279
      );

      if (invalidTweets.length > 0) {
        return { success: false, error: `Invalid tweet lengths found: ${invalidTweets.length} tweets` };
      }

      return { success: true, content };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown OpenAI error' 
      };
    }
  }

  /**
   * Evaluate content quality using AI critic
   */
  private async evaluateQuality(content: ContentResult): Promise<{
    success: boolean;
    passes?: boolean;
    score?: number;
    feedback?: any;
    error?: string;
  }> {
    try {
      const criticPrompt = getCriticPrompt(content);

      const response = await this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: criticPrompt }],
        temperature: 0.1, // Low temperature for consistent evaluation
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const rawFeedback = response.choices[0]?.message?.content;
      if (!rawFeedback) {
        return { success: false, error: 'No critic feedback received' };
      }

      let feedback: any;
      try {
        feedback = JSON.parse(rawFeedback);
      } catch (error) {
        return { success: false, error: 'Invalid JSON response from critic' };
      }

      const score = feedback.overallScore || 0;
      const passes = feedback.passes || score >= 75;

      return { 
        success: true, 
        passes, 
        score, 
        feedback 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Quality evaluation error' 
      };
    }
  }

  /**
   * Create regeneration parameters with critic feedback
   */
  private createRegenerationParams(
    originalParams: GenerationParams, 
    criticFeedback: any
  ): GenerationParams {
    // For regeneration, we'll modify the topic to include improvement instructions
    const improvements = criticFeedback?.improvements || [];
    const modifiedTopic = originalParams.topic 
      ? `${originalParams.topic} (Improve: ${improvements.slice(0, 2).join(', ')})`
      : undefined;

    return {
      ...originalParams,
      topic: modifiedTopic
    };
  }

  /**
   * Extract topic from user input
   */
  async extractTopic(userInput: string): Promise<{
    success: boolean;
    topic?: string;
    format?: 'thread' | 'single';
    confidence?: number;
    error?: string;
  }> {
    try {
      const prompt = getTopicExtractionPrompt(userInput);

      const response = await this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const rawResult = response.choices[0]?.message?.content;
      if (!rawResult) {
        return { success: false, error: 'No topic extraction result' };
      }

      const result = JSON.parse(rawResult);
      return { 
        success: true, 
        topic: result.topic,
        format: result.format,
        confidence: result.confidence 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Topic extraction error' 
      };
    }
  }

  /**
   * Quick single tweet generation (simplified flow)
   */
  async generateQuickTweet(topic: string): Promise<{
    success: boolean;
    tweet?: string;
    error?: string;
  }> {
    try {
      const result = await this.generateContent({
        topic,
        format: 'single'
      });

      if (!result.success || !result.content) {
        return { success: false, error: result.error };
      }

      return { 
        success: true, 
        tweet: result.content.tweets[0] 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Quick tweet generation error' 
      };
    }
  }
}

/**
 * Singleton instance for reuse
 */
let generatorInstance: ContentGenerator | null = null;

export function getContentGenerator(): ContentGenerator {
  if (!generatorInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    generatorInstance = new ContentGenerator(apiKey);
  }
  return generatorInstance;
}
