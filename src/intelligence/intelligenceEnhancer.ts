/**
 * INTELLIGENCE ENHANCER
 * Boosts low-intelligence content to make it more insightful and engaging
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage, IntelligenceScore } from './intelligenceTypes';
import { PostGenerationIntelligence } from './postGenerationIntelligence';

export class IntelligenceEnhancer {
  private postGenIntel = new PostGenerationIntelligence();

  /**
   * Boost content intelligence using AI
   */
  async boostIntelligence(
    originalContent: string | string[],
    weaknesses: string[],
    intelligencePackage?: IntelligencePackage,
    maxAttempts: number = 2
  ): Promise<{ content: string | string[]; improved: boolean; finalScore: number }> {
    
    const contentStr = Array.isArray(originalContent) 
      ? originalContent.join('\n\n') 
      : originalContent;
    
    const isThread = Array.isArray(originalContent);

    console.log(`🔧 INTELLIGENCE_ENHANCER: Attempting to boost content...`);
    console.log(`  Weaknesses: ${weaknesses.join(', ')}`);

    let bestContent = originalContent;
    let bestScore = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`  🔄 Enhancement attempt ${attempt}/${maxAttempts}...`);

        const enhancedContent = await this.enhanceContent(
          contentStr,
          weaknesses,
          intelligencePackage,
          isThread
        );

        // Score the enhanced version
        const newScore = await this.postGenIntel.scoreIntelligence(enhancedContent);

        console.log(`  📊 Enhanced score: ${newScore.overall_score}/100`);

        if (newScore.overall_score > bestScore) {
          bestContent = enhancedContent;
          bestScore = newScore.overall_score;
        }

        // If we hit good threshold, stop
        if (newScore.overall_score >= 85) {
          console.log(`  ✅ Content enhanced successfully`);
          return {
            content: enhancedContent,
            improved: true,
            finalScore: newScore.overall_score
          };
        }

        // Update weaknesses for next attempt
        weaknesses = newScore.weaknesses;

      } catch (error: any) {
        console.error(`  ⚠️ Enhancement attempt ${attempt} failed:`, error.message);
      }
    }

    const improved = bestScore > 0;
    
    if (improved) {
      console.log(`  📈 Content improved (best score: ${bestScore}/100)`);
    } else {
      console.log(`  ⚠️ Could not improve content, using original`);
    }

    return {
      content: bestContent,
      improved,
      finalScore: bestScore
    };
  }

  /**
   * AI enhancement logic
   */
  private async enhanceContent(
    content: string,
    weaknesses: string[],
    intelligencePackage?: IntelligencePackage,
    isThread: boolean = false
  ): Promise<string | string[]> {
    
    const perspectivesContext = intelligencePackage ? `
AVAILABLE PERSPECTIVES (use these to add depth):
${intelligencePackage.perspectives.map((p, i) => `
${i + 1}. ${p.angle}
   → Implication: ${p.implication}
   → Action: ${p.action_hook}
`).join('\n')}

RESEARCH INSIGHTS:
- Surprise factor: ${intelligencePackage.research.surprise_factor}
- Expert insight: ${intelligencePackage.research.expert_insight}
` : '';

    const prompt = `You are an intelligence enhancement AI. Make this content MORE INTELLIGENT and ENGAGING.

ORIGINAL CONTENT:
${content}

WEAKNESSES TO FIX:
${weaknesses.map((w, i) => `${i + 1}. ${w}`).join('\n')}

${perspectivesContext}

YOUR TASK: Rewrite to fix weaknesses while maintaining style and length.

ENHANCEMENT STRATEGIES:
1. If "lacks unique perspective": Add a contrarian angle or surprising insight
2. If "not actionable": Include specific next steps or applications
3. If "not engaging": Improve hook, add curiosity gap, use storytelling
4. If "not memorable": Add a sticky insight or quotable moment
5. If "low viral potential": Make it more shareable (surprising/useful/provocative)

RULES:
- Keep the same format ${isThread ? '(thread with multiple tweets)' : '(single tweet)'}
- Maintain character limits (270 chars per tweet max)
- Keep expert third-person voice (no "I", "me", "my")
- Must include data/citations
- Must explain mechanisms
- Make it SMARTER, not just different

${isThread ? 'Return JSON: {"tweets": ["tweet1", "tweet2", ...]}' : 'Return JSON: {"tweet": "..."}'}`;

    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: 'You are an intelligence enhancement AI specializing in making content more insightful and engaging.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    }, {
      purpose: 'intelligence_enhancer - content boost',
      priority: 'medium'
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No enhanced content returned');

    try {
      const parsed = JSON.parse(result);
      
      if (isThread) {
        return parsed.tweets || parsed;
      } else {
        return parsed.tweet || parsed;
      }
    } catch {
      // If not JSON, return as-is
      return result;
    }
  }

  /**
   * Quick boost without full intelligence package
   */
  async quickBoost(content: string | string[]): Promise<string | string[]> {
    try {
      const score = await this.postGenIntel.scoreIntelligence(content);
      
      if (score.overall_score >= 75) {
        return content; // Already good
      }

      const result = await this.boostIntelligence(
        content,
        score.weaknesses,
        undefined,
        1 // Single attempt
      );

      return result.content;
    } catch (error) {
      console.error('Quick boost failed, returning original');
      return content;
    }
  }
}

