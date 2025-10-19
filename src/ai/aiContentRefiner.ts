/**
 * ✨ AI CONTENT REFINER
 * 
 * Takes winning content and polishes it to perfection
 * Uses judge feedback + viral examples to enhance
 * 
 * Goal: Transform good content into exceptional content
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { ViralTweet, formatViralExamplesForPrompt, getTopViralExamples } from '../intelligence/viralTweetDatabase';

export interface RefinementConfig {
  content: string;
  format: 'single' | 'thread';
  judge_feedback?: {
    strengths: string[];
    improvements: string[];
    score: number;
  };
  viral_examples?: ViralTweet[];
}

export interface RefinementResult {
  refined_content: string;
  improvements_made: string[];
  before_after_comparison: string;
}

/**
 * AI Content Refiner - Polishes content to perfection
 */
export class AIContentRefiner {
  private static instance: AIContentRefiner;
  
  static getInstance(): AIContentRefiner {
    if (!this.instance) {
      this.instance = new AIContentRefiner();
    }
    return this.instance;
  }
  
  /**
   * Refine content based on judge feedback
   */
  async refine(config: RefinementConfig): Promise<RefinementResult> {
    const { content, format, judge_feedback, viral_examples } = config;
    
    console.log(`✨ AI_REFINER: Polishing content (score: ${judge_feedback?.score || 'N/A'})...`);
    
    try {
      // Get viral examples if not provided
      const examples = viral_examples || getTopViralExamples(3);
      
      const prompt = this.buildRefinementPrompt(content, format, judge_feedback, examples);
      
      const response = await createBudgetedChatCompletion(
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: this.getRefinerSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7, // Balanced for creativity + consistency
          max_tokens: 600
        },
        {
          purpose: 'ai_content_refiner'
        }
      );
      
      const result = this.parseRefinementResponse(response, content);
      
      console.log(`✅ AI_REFINER: Content polished successfully`);
      console.log(`   Improvements: ${result.improvements_made.join(', ')}`);
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ AI_REFINER_FAILED: ${error.message}`);
      
      // Fallback: Return original content
      return {
        refined_content: content,
        improvements_made: ['Refinement failed, using original'],
        before_after_comparison: 'No changes'
      };
    }
  }
  
  /**
   * Build refinement prompt
   */
  private buildRefinementPrompt(
    content: string,
    format: 'single' | 'thread',
    feedback: any,
    examples: ViralTweet[]
  ): string {
    const viralExamplesText = formatViralExamplesForPrompt(examples);
    
    const feedbackText = feedback ? `
JUDGE FEEDBACK:
✅ Strengths: ${feedback.strengths.join(', ')}
🔧 Improvements needed: ${feedback.improvements.join(', ')}
📊 Current score: ${feedback.score}/10

Your goal: Make this a 9-10/10 by addressing improvements while keeping strengths.
` : '';
    
    return `Refine this content to maximize viral potential:

CURRENT CONTENT:
${content}

${feedbackText}

${viralExamplesText}

REFINEMENT GOALS:
1. Strengthen the hook (first 10 words MUST grab attention)
2. Add specific numbers/data if missing
3. Increase emotional impact (surprise, anger, or value)
4. Make it more shareable (would you retweet this?)
5. Remove any academic/boring language
6. Keep under ${format === 'thread' ? '250 chars per tweet' : '270 chars total'}

Return ONLY a JSON object (no markdown, no code blocks):
{
  "refined_content": "<improved version>",
  "improvements_made": ["<change 1>", "<change 2>", "<change 3>"],
  "hook_before": "<original first sentence>",
  "hook_after": "<improved first sentence>"
}`;
  }
  
  /**
   * System prompt for refiner
   */
  private getRefinerSystemPrompt(): string {
    return `You are an expert content editor specializing in viral social media optimization.

Your mission: Polish good content into EXCEPTIONAL content.

Focus on:
1. HOOK OPTIMIZATION - First 10 words determine 90% of engagement
2. SPECIFICITY - Add numbers, data, studies if missing
3. EMOTIONAL PUNCH - Create surprise, anger, or massive value
4. SHAREABILITY - Make people want to retweet to look smart
5. BREVITY - Cut unnecessary words ruthlessly

Avoid:
- Making content longer (shorter is better)
- Adding academic citations as hooks
- Using "Protocol:" or step-by-step formats
- Removing the original insight/angle
- Generic advice or platitudes

Keep the core message but make it IMPOSSIBLE to ignore.`;
  }
  
  /**
   * Parse refinement response
   */
  private parseRefinementResponse(response: any, originalContent: string): RefinementResult {
    try {
      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('Empty response from AI refiner');
      }
      
      // Try to parse JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Try to extract JSON from markdown if wrapped
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }
      
      return {
        refined_content: parsed.refined_content || originalContent,
        improvements_made: parsed.improvements_made || ['No specific improvements listed'],
        before_after_comparison: parsed.hook_before && parsed.hook_after 
          ? `BEFORE: "${parsed.hook_before}"\nAFTER: "${parsed.hook_after}"`
          : 'N/A'
      };
      
    } catch (error: any) {
      console.error(`Failed to parse refinement: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Export singleton instance
 */
export const aiContentRefiner = AIContentRefiner.getInstance();

