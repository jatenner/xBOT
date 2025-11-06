/**
 * 🏆 AI CONTENT JUDGE
 * 
 * Enhanced with interrogation protocol:
 * 1. Structural validation
 * 2. Claim interrogation (defend your claims)
 * 3. Final scoring
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { ContentOption } from './multiOptionGenerator';
import { judgeInterrogation, InterrogationResult } from './judgeInterrogation';

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
  interrogation?: InterrogationResult; // NEW: Interrogation results
  defensibility?: number; // NEW: Defensibility score
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
          max_tokens: 800,
          response_format: { type: "json_object" } // ✅ FIX #3: Force JSON output
        },
        {
          purpose: 'ai_content_judge'
        }
      );
      
      const analysis = this.parseJudgmentResponse(response, options);
      
      console.log(`✅ AI_JUDGE: Winner = ${analysis.winner.generator_name} (${analysis.score}/10)`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      
      // NEW: Run interrogation on winner
      console.log(`[AI_JUDGE] 🔍 Running claim interrogation on winner...`);
      
      try {
        const interrogationResult = await judgeInterrogation.interrogateContent({
          text: analysis.winner.raw_content,
          topic: 'health', // Could pass actual topic if available
          generator: analysis.winner.generator_name
        });
        
        console.log(judgeInterrogation.getSummary(interrogationResult));
        
        // Adjust score based on defensibility
        const originalScore = analysis.score;
        const defensibilityScore = interrogationResult.defensibilityScore;
        
        // Combine scores: 60% original quality, 40% defensibility
        const combinedScore = (originalScore * 0.6) + (defensibilityScore / 10 * 0.4);
        
        analysis.score = Math.round(combinedScore * 10) / 10; // Round to 1 decimal
        analysis.interrogation = interrogationResult;
        analysis.defensibility = defensibilityScore;
        
        // Add interrogation feedback to improvements
        if (!interrogationResult.passed) {
          analysis.improvements = [
            ...analysis.improvements,
            ...interrogationResult.feedback.slice(0, 2) // Add top 2 feedback items
          ];
        }
        
        console.log(`[AI_JUDGE] 📊 Adjusted score: ${originalScore} → ${analysis.score} (defensibility: ${defensibilityScore})`);
        
      } catch (interrogationError: any) {
        console.warn(`[AI_JUDGE] ⚠️ Interrogation failed: ${interrogationError.message}`);
        // Continue without interrogation if it fails
      }
      
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
OPTION ${idx} (${opt.generator_name}):
${opt.raw_content}
`).join('\n---\n');
    
    return `Evaluate these ${options.length} content options and select the BEST one for maximum engagement:

${optionsText}

CRITICAL: There are exactly ${options.length} options indexed 0 to ${options.length - 1}.
You MUST return winner_index between 0 and ${options.length - 1} (inclusive).

Analyze each option based on:
1. Viral Potential (1-10) - Will people share this?
2. Hook Strength (1-10) - Does it grab attention immediately?
3. Shareability (1-10) - Does it make people want to retweet?
4. Uniqueness (1-10) - Is this a fresh angle?
5. Emotional Impact (1-10) - Does it trigger strong response?

Return ONLY a JSON object (no markdown, no code blocks):
{
  "winner_index": <MUST be 0 to ${options.length - 1}>,
  "overall_score": <1-10>,
  "viral_probability": <0.0-1.0>,
  "reasoning": "<2-3 sentences explaining why this option wins>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<optional improvement 1>", "<optional improvement 2>"],
  "runner_up_index": <MUST be 0 to ${options.length - 1}, different from winner>,
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
      
      // ✅ FIX #1: Bounds checking for winner index
      let winnerIndex = parsed.winner_index || 0;
      
      // Validate and clamp winner index to valid range
      if (typeof winnerIndex !== 'number' || winnerIndex < 0 || winnerIndex >= options.length) {
        console.warn(`⚠️ AI_JUDGE: Invalid winner index ${winnerIndex} (valid: 0-${options.length - 1})`);
        console.warn(`⚠️ AI_JUDGE: Clamping to valid range...`);
        winnerIndex = Math.max(0, Math.min(winnerIndex, options.length - 1));
      }
      
      const winner = options[winnerIndex];
      
      if (!winner) {
        throw new Error(`Invalid winner index: ${winnerIndex}`);
      }
      
      // ✅ FIX #2: Validate runner-up index
      let runnerUp = undefined;
      if (parsed.runner_up_index !== undefined) {
        const runnerUpIndex = parsed.runner_up_index;
        if (runnerUpIndex >= 0 && runnerUpIndex < options.length && runnerUpIndex !== winnerIndex) {
          runnerUp = {
            generator: options[runnerUpIndex]?.generator_name || 'unknown',
            reason: parsed.runner_up_reason || 'Close second'
          };
        }
      }
      
      return {
        winner,
        winner_index: winnerIndex,
        score: parsed.overall_score || 7,
        viral_probability: parsed.viral_probability || 0.20,
        reasoning: parsed.reasoning || 'Selected as best option',
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        runner_up: runnerUp
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

