/**
 * 🎯 PROMISE DELIVERY VALIDATOR
 * 
 * Ensures tweets that promise specific content actually deliver on those promises
 * - Detects number promises ("30 ways", "5 tips", etc.)
 * - Validates that threads contain the promised amount of content
 * - Generates missing content when promises are detected
 * - Prevents engagement-killing empty promises
 */

import { BudgetAwareOpenAI } from './budgetAwareOpenAI';
import OpenAI from 'openai';

interface PromiseDetection {
  hasPromise: boolean;
  promiseType: 'numbered_list' | 'tips' | 'ways' | 'reasons' | 'steps' | 'myths' | 'strategies' | 'none';
  promisedCount: number;
  promiseText: string;
  topic: string;
  isValidPromise: boolean; // Whether we can actually fulfill this promise
}

interface ContentDelivery {
  deliversPromise: boolean;
  actualCount: number;
  expectedCount: number;
  missingContent: string[];
  deliveryScore: number; // 0-1 how well it delivers
}

interface PromiseValidationResult {
  isValid: boolean;
  hasUnfulfilledPromise: boolean;
  promiseDetection: PromiseDetection;
  contentDelivery: ContentDelivery;
  requiredAction: 'none' | 'generate_missing_content' | 'convert_to_single_tweet' | 'regenerate_completely';
  generatedContent?: string[];
  improvedContent?: string;
  failureReason?: string;
}

export class PromiseDeliveryValidator {
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private openai: OpenAI;
  
  constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * 🔍 MAIN VALIDATION - Analyzes content for unfulfilled promises
   */
  async validatePromiseDelivery(content: string | string[]): Promise<PromiseValidationResult> {
    try {
      console.log('🎯 Analyzing content for promise delivery...');
      
      // Step 1: Detect if content makes any promises
      const promiseDetection = this.detectPromises(content);
      
      if (!promiseDetection.hasPromise) {
        return {
          isValid: true,
          hasUnfulfilledPromise: false,
          promiseDetection,
          contentDelivery: {
            deliversPromise: true,
            actualCount: 0,
            expectedCount: 0,
            missingContent: [],
            deliveryScore: 1.0
          },
          requiredAction: 'none'
        };
      }

      console.log(`📋 Promise detected: ${promiseDetection.promiseText} (${promiseDetection.promisedCount} items)`);

      // Step 2: Analyze if content delivers on the promise
      const contentDelivery = this.analyzeContentDelivery(content, promiseDetection);
      
      // Step 3: Determine if action is needed
      if (contentDelivery.deliversPromise && contentDelivery.deliveryScore > 0.8) {
        return {
          isValid: true,
          hasUnfulfilledPromise: false,
          promiseDetection,
          contentDelivery,
          requiredAction: 'none'
        };
      }

      // Step 4: Generate missing content or fix the promise
      console.log(`🚨 Promise not delivered! Expected ${promiseDetection.promisedCount}, found ${contentDelivery.actualCount}`);
      
      const fixResult = await this.generateFixForUnfulfilledPromise(promiseDetection, contentDelivery, content);
      
      return {
        isValid: false,
        hasUnfulfilledPromise: true,
        promiseDetection,
        contentDelivery,
        requiredAction: fixResult.action,
        generatedContent: fixResult.generatedContent,
        improvedContent: fixResult.improvedContent,
        failureReason: fixResult.failureReason
      };

    } catch (error) {
      console.error('❌ Promise validation failed:', error);
      
      return {
        isValid: false,
        hasUnfulfilledPromise: true,
        promiseDetection: {
          hasPromise: false,
          promiseType: 'none',
          promisedCount: 0,
          promiseText: '',
          topic: '',
          isValidPromise: false
        },
        contentDelivery: {
          deliversPromise: false,
          actualCount: 0,
          expectedCount: 0,
          missingContent: [],
          deliveryScore: 0
        },
        requiredAction: 'regenerate_completely',
        failureReason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * 🔍 DETECT PROMISES in content
   */
  private detectPromises(content: string | string[]): PromiseDetection {
    const text = Array.isArray(content) ? content.join(' ') : content;
    
    // Common promise patterns
    const patterns = [
      { regex: /(\d+)\s+(science-backed\s+)?ways?\s+to\s+([^.!?]+)/i, type: 'ways' as const },
      { regex: /(\d+)\s+tips?\s+(for|to)\s+([^.!?]+)/i, type: 'tips' as const },
      { regex: /(\d+)\s+reasons?\s+(why|to)\s+([^.!?]+)/i, type: 'reasons' as const },
      { regex: /(\d+)\s+steps?\s+to\s+([^.!?]+)/i, type: 'steps' as const },
      { regex: /(\d+)\s+(proven\s+)?strategies?\s+(for|to)\s+([^.!?]+)/i, type: 'strategies' as const },
      { regex: /(\d+)\s+myths?\s+(about|around)\s+([^.!?]+)/i, type: 'myths' as const },
      { regex: /here\s+are\s+(\d+)\s+([^.!?]+)/i, type: 'numbered_list' as const },
      { regex: /(\d+)\s+evidence-based\s+([^.!?]+)/i, type: 'numbered_list' as const }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const count = parseInt(match[1]);
        const topic = match[3] || match[2] || 'health topic';
        
        return {
          hasPromise: true,
          promiseType: pattern.type,
          promisedCount: count,
          promiseText: match[0],
          topic: topic.trim(),
          isValidPromise: count >= 3 && count <= 50 // Reasonable range
        };
      }
    }

    return {
      hasPromise: false,
      promiseType: 'none',
      promisedCount: 0,
      promiseText: '',
      topic: '',
      isValidPromise: false
    };
  }

  /**
   * 📊 ANALYZE if content actually delivers on the promise
   */
  private analyzeContentDelivery(content: string | string[], promise: PromiseDetection): ContentDelivery {
    const contentArray = Array.isArray(content) ? content : [content];
    const fullText = contentArray.join(' ');
    
    // Count actual delivered items
    let actualCount = 0;
    const missingContent: string[] = [];
    
    // Look for numbered lists or distinct points
    const numberedItems = fullText.match(/\d+[\.\)]\s+[^.!?]+[.!?]/g) || [];
    const bulletPoints = fullText.match(/[•\-\*]\s+[^.!?]+[.!?]/g) || [];
    const distinctSentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    actualCount = Math.max(numberedItems.length, bulletPoints.length);
    
    // If no clear numbering, estimate from sentences
    if (actualCount === 0 && distinctSentences.length > 2) {
      actualCount = Math.max(0, distinctSentences.length - 1); // Subtract intro sentence
    }
    
    // Calculate missing content
    for (let i = actualCount + 1; i <= promise.promisedCount; i++) {
      missingContent.push(`Missing item ${i} for ${promise.topic}`);
    }
    
    const deliveryScore = actualCount / promise.promisedCount;
    const deliversPromise = deliveryScore >= 0.8; // Must deliver 80% of promised content
    
    return {
      deliversPromise,
      actualCount,
      expectedCount: promise.promisedCount,
      missingContent,
      deliveryScore
    };
  }

  /**
   * 🔧 GENERATE FIX for unfulfilled promises
   */
  private async generateFixForUnfulfilledPromise(
    promise: PromiseDetection, 
    delivery: ContentDelivery,
    originalContent: string | string[]
  ): Promise<{
    action: 'generate_missing_content' | 'convert_to_single_tweet' | 'regenerate_completely';
    generatedContent?: string[];
    improvedContent?: string;
    failureReason?: string;
  }> {
    
    if (!promise.isValidPromise) {
      return {
        action: 'convert_to_single_tweet',
        improvedContent: await this.convertToSingleTweet(originalContent, promise)
      };
    }

    // If we're missing too much content, regenerate completely
    if (delivery.deliveryScore < 0.3) {
      return {
        action: 'regenerate_completely',
        improvedContent: await this.regenerateWithFullContent(promise)
      };
    }

    // Generate missing content to complete the promise
    try {
      const missingContent = await this.generateMissingContent(promise, delivery);
      return {
        action: 'generate_missing_content',
        generatedContent: missingContent
      };
    } catch (error) {
      return {
        action: 'convert_to_single_tweet',
        failureReason: `Failed to generate content: ${error.message}`,
        improvedContent: await this.convertToSingleTweet(originalContent, promise)
      };
    }
  }

  /**
   * 🎯 GENERATE missing content items
   */
  private async generateMissingContent(promise: PromiseDetection, delivery: ContentDelivery): Promise<string[]> {
    const missingCount = promise.promisedCount - delivery.actualCount;
    
    const prompt = `Generate ${missingCount} additional ${promise.promiseType} for ${promise.topic}.

Context: We promised ${promise.promisedCount} ${promise.promiseType} but only delivered ${delivery.actualCount}.

Requirements:
- Each item should be actionable and specific
- Focus on health/wellness/longevity 
- Make them practical and evidence-based
- Number them starting from ${delivery.actualCount + 1}
- Keep each item under 200 characters
- Make them engaging and valuable

Format each item as:
${delivery.actualCount + 1}. [Specific actionable advice]

Generate ${missingCount} items:`;

    try {
      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini',
        maxTokens: Math.min(800, missingCount * 100),
        temperature: 0.7,
        priority: 'important',
        operationType: 'content_generation'
      });

      const generatedText = response.response || '';
      const items = generatedText
        .split(/\d+\.\s+/)
        .slice(1) // Remove empty first element
        .map(item => item.trim())
        .filter(item => item.length > 10)
        .slice(0, missingCount); // Ensure we don't exceed requested count

      if (items.length === 0) {
        throw new Error('No valid items generated');
      }

      console.log(`✅ Generated ${items.length} missing content items`);
      return items.map((item, index) => `${delivery.actualCount + index + 1}. ${item}`);

    } catch (error) {
      console.error('❌ Failed to generate missing content:', error);
      throw error;
    }
  }

  /**
   * 🔄 CONVERT promise-making content to single tweet
   */
  private async convertToSingleTweet(content: string | string[], promise: PromiseDetection): Promise<string> {
    const originalText = Array.isArray(content) ? content.join(' ') : content;
    
    const prompt = `Convert this tweet that makes a promise it can't deliver into a better single tweet:

Original: "${originalText}"

Problems:
- Promises ${promise.promisedCount} ${promise.promiseType} but doesn't deliver them
- This creates engagement disappointment

Convert to either:
1. A thought-provoking question about ${promise.topic}
2. A single powerful tip about ${promise.topic}  
3. An interesting fact about ${promise.topic}

Requirements:
- Under 280 characters
- Engaging and valuable
- No unfulfilled promises
- Professional health/wellness tone
- Include relevant emoji (max 1)

Return only the improved tweet:`;

    try {
      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini', 
        maxTokens: 150,
        temperature: 0.7,
        priority: 'important',
        operationType: 'content_improvement'
      });

      const improvedTweet = (response.response || '').trim();
      
      if (improvedTweet.length > 0 && improvedTweet.length <= 280) {
        console.log('✅ Converted unfulfilled promise to single tweet');
        return improvedTweet;
      }
      
      throw new Error('Generated tweet is invalid');

    } catch (error) {
      console.error('❌ Failed to convert to single tweet:', error);
      
      // Fallback: Simple question about the topic
      return `What's your experience with ${promise.topic}? 🤔`;
    }
  }

  /**
   * 🔄 REGENERATE with full content delivery
   */
  private async regenerateWithFullContent(promise: PromiseDetection): Promise<string> {
    const prompt = `Create a complete Twitter thread that delivers on this promise:

Promise: ${promise.promisedCount} ${promise.promiseType} for ${promise.topic}

Requirements:
- Start with an engaging hook tweet
- Deliver ALL ${promise.promisedCount} items as separate tweets
- Each item should be actionable and specific
- Focus on health/wellness/longevity
- Evidence-based and practical
- Professional but engaging tone
- Each tweet under 280 chars
- Number the items clearly

Format:
Tweet 1: [Hook about the topic]
Tweet 2: 1. [First specific tip/way/reason]
Tweet 3: 2. [Second specific tip/way/reason]
...continue for all ${promise.promisedCount} items

Create the complete thread:`;

    try {
      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini',
        maxTokens: Math.min(1500, promise.promisedCount * 80),
        temperature: 0.7,
        priority: 'important',
        operationType: 'thread_generation'
      });

      const fullThread = response.response || '';
      console.log(`✅ Regenerated complete thread with ${promise.promisedCount} items`);
      return fullThread;

    } catch (error) {
      console.error('❌ Failed to regenerate full content:', error);
      throw error;
    }
  }

  /**
   * 📊 GET validation statistics
   */
  getValidationStats(): {
    promises_detected_today: number;
    unfulfilled_promises_fixed: number;
    content_generated_today: number;
    average_delivery_score: number;
  } {
    // In a real implementation, these would be tracked
    return {
      promises_detected_today: 0,
      unfulfilled_promises_fixed: 0, 
      content_generated_today: 0,
      average_delivery_score: 0.95
    };
  }
}