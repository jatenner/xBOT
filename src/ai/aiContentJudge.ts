/**
 * 🏆 AI CONTENT JUDGE
 * 
 * Uses OpenAI to select the BEST content from multiple options
 * Provides detailed reasoning for selection
 * Scores based on viral potential, not just quality
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { ContentOption } from './multiOptionGenerator';

export interface JudgmentResult {
  winner: ContentOption;
  winner_index: number;
  score: number; // 1-10
  viral_probability: number; // 0-1
  reasoning: string;
  strengths: string[];
  improvements: string[];
  runner_up?: {
    generator: string;
    reason: string;
  };
}

/**
 * AI Content Judge - Selects best option with reasoning
 */
export class AIContentJudge {
  private static instance: AIContentJudge;
  
  static getInstance(): AIContentJudge {
    if (!this.instance) {
      this.instance = new AIContentJudge();
    }
    return this.instance;
  }
  
  /**
   * Judge multiple content options and select the best
   */
  async selectBest(options: ContentOption[]): Promise<JudgmentResult> {
    if (options.length === 0) {
      throw new Error('No options to judge');
    }
    
    if (options.length === 1) {
      // Only one option, return it
      return {
        winner: options[0],
        winner_index: 0,
        score: 7,
        viral_probability: 0.20,
        reasoning: 'Only option available',
        strengths: ['Generated successfully'],
        improvements: []
      };
    }
    
    console.log(`🏆 AI_JUDGE: Evaluating ${options.length} content options...`);
    
    try {
      const prompt = this.buildJudgmentPrompt(options);
      
      const response = await createBudgetedChatCompletion(
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: this.getJudgeSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for consistent judgment
          max_tokens: 800
        },
        {
          purpose: 'ai_content_judge'
        }
      );
      
      const analysis = this.parseJudgmentResponse(response, options);
      
      console.log(`✅ AI_JUDGE: Winner = ${analysis.winner.generator_name} (${analysis.score}/10)`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      
      return analysis;
      
    } catch (error: any) {
      console.error(`❌ AI_JUDGE_FAILED: ${error.message}`);
      
      // Fallback: Pick highest confidence option
      const fallbackWinner = options.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      const fallbackIndex = options.indexOf(fallbackWinner);
      
      return {
        winner: fallbackWinner,
        winner_index: fallbackIndex,
        score: 7,
        viral_probability: 0.20,
        reasoning: `AI judge failed, selected highest confidence option (${fallbackWinner.generator_name})`,
        strengths: ['Generated successfully'],
        improvements: []
      };
    }
  }
  
  /**
   * Build judgment prompt with all options
   */
  private buildJudgmentPrompt(options: ContentOption[]): string {
    const optionsText = options.map((opt, idx) => `
OPTION ${idx + 1} (${opt.generator_name}):
${opt.raw_content}
`).join('\n---\n');
    
    return `Evaluate these ${options.length} content options and select the BEST one for maximum engagement:

${optionsText}

Analyze each option based on:
1. Viral Potential (1-10) - Will people share this?
2. Hook Strength (1-10) - Does it grab attention immediately?
3. Shareability (1-10) - Does it make people want to retweet?
4. Uniqueness (1-10) - Is this a fresh angle?
5. Emotional Impact (1-10) - Does it trigger strong response?

Return ONLY a JSON object (no markdown, no code blocks):
{
  "winner_index": <0-based index of best option>,
  "overall_score": <1-10>,
  "viral_probability": <0.0-1.0>,
  "reasoning": "<2-3 sentences explaining why this option wins>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<optional improvement 1>", "<optional improvement 2>"],
  "runner_up_index": <index of second best>,
  "runner_up_reason": "<why second best lost>"
}`;
  }
  
  /**
   * System prompt for AI judge
   */
  private getJudgeSystemPrompt(): string {
    return `You are an expert content analyst specializing in viral social media content.

Your mission: Select the content with the HIGHEST engagement potential.

Viral content has these traits:
- Shocking or surprising angle
- Specific numbers/data (not vague)
- Challenges common beliefs
- Creates emotional response (anger, surprise, value)
- Makes people want to share to look smart/helpful
- Strong hook in first 10 words
- Practical or mind-blowing insight

Academic/boring content traits (avoid):
- Generic advice everyone knows
- Lacks specificity or data
- Too diplomatic or safe
- Academic citations as hooks
- "Protocol:" or step-by-step format
- No emotional punch

Be HARSH but FAIR. Pick the winner that will actually get engagement, not just the "safe" option.`;
  }
  
  /**
   * Parse AI judgment response
   */
  private parseJudgmentResponse(response: any, options: ContentOption[]): JudgmentResult {
    try {
      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('Empty response from AI judge');
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
      
      const winnerIndex = parsed.winner_index || 0;
      const winner = options[winnerIndex];
      
      if (!winner) {
        throw new Error(`Invalid winner index: ${winnerIndex}`);
      }
      
      return {
        winner,
        winner_index: winnerIndex,
        score: parsed.overall_score || 7,
        viral_probability: parsed.viral_probability || 0.20,
        reasoning: parsed.reasoning || 'Selected as best option',
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        runner_up: parsed.runner_up_index !== undefined ? {
          generator: options[parsed.runner_up_index]?.generator_name || 'unknown',
          reason: parsed.runner_up_reason || 'Close second'
        } : undefined
      };
      
    } catch (error: any) {
      console.error(`Failed to parse judgment: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Export singleton instance
 */
export const aiContentJudge = AIContentJudge.getInstance();

