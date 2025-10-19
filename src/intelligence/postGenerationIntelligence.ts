/**
 * POST-GENERATION INTELLIGENCE
 * Scores content intelligence AFTER generation
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligenceScore } from './intelligenceTypes';

export class PostGenerationIntelligence {

  /**
   * Score content's intelligence and engagement potential
   */
  async scoreIntelligence(content: string | string[]): Promise<IntelligenceScore> {
    const contentStr = Array.isArray(content) ? content.join('\n\n') : content;
    
    console.log(`🧠 POST_GEN_INTELLIGENCE: Scoring content intelligence...`);

    const prompt = `You are a critical intelligence evaluator. Rate this content's INTELLIGENCE and ENGAGEMENT.

CONTENT:
${contentStr}

SCORE EACH DIMENSION (0-100):

1. Intelligence Score:
   - Does this offer unique perspective or just state facts?
   - Does this challenge assumptions or make you think differently?
   - Is there depth and insight, not just surface-level info?

2. Engagement Potential:
   - Would this stop your scroll?
   - Does the hook create curiosity?
   - Is it interesting enough to read fully?

3. Viral Potential:
   - Would you share this with a friend?
   - Does it have shareability (surprising, useful, provocative)?
   - Could this spread organically?

4. Actionability:
   - Can someone actually USE this information?
   - Are there concrete next steps or takeaways?
   - Is it practical, not just theoretical?

5. Memorability:
   - Would you remember this tomorrow?
   - Does it have a sticky insight or memorable framing?
   - Is there a quotable moment?

ALSO IDENTIFY:
- Strengths: What makes this content good?
- Weaknesses: What's missing or could be better?
- Improvement suggestions: Specific ways to enhance

Return JSON:
{
  "intelligence_score": 85,
  "engagement_potential": 90,
  "viral_potential": 75,
  "actionability_score": 80,
  "memorability_score": 85,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "improvement_suggestions": ["suggestion 1", "suggestion 2"]
}

Be HONEST and CRITICAL. Don't inflate scores.`;

    try {
      const response = await createBudgetedChatCompletion({
        model: getContentGenerationModel(),
        messages: [
          { role: 'system', content: 'You are a harsh but fair content critic specializing in intelligence evaluation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'post_gen_intelligence - content scoring',
        priority: 'medium'
      });

      const result = response.choices[0]?.message?.content;
      if (!result) throw new Error('No intelligence score returned');

      const scores = JSON.parse(result);

      // Calculate overall score
      const overall = Math.round((
        scores.intelligence_score +
        scores.engagement_potential +
        scores.viral_potential +
        scores.actionability_score +
        scores.memorability_score
      ) / 5);

      const intelligenceScore: IntelligenceScore = {
        intelligence_score: scores.intelligence_score,
        engagement_potential: scores.engagement_potential,
        viral_potential: scores.viral_potential,
        actionability_score: scores.actionability_score,
        memorability_score: scores.memorability_score,
        overall_score: overall,
        passes_intelligence_threshold: overall >= 75,
        improvement_suggestions: scores.improvement_suggestions || [],
        strengths: scores.strengths || [],
        weaknesses: scores.weaknesses || []
      };

      console.log(`  📊 Intelligence: ${intelligenceScore.intelligence_score}/100`);
      console.log(`  📊 Engagement: ${intelligenceScore.engagement_potential}/100`);
      console.log(`  📊 Viral: ${intelligenceScore.viral_potential}/100`);
      console.log(`  📊 Overall: ${intelligenceScore.overall_score}/100`);

      return intelligenceScore;

    } catch (error: any) {
      console.error(`❌ POST_GEN_INTELLIGENCE scoring failed:`, error.message);
      throw error;
    }
  }

  /**
   * Quick evaluation for real-time feedback
   */
  async quickScore(content: string | string[]): Promise<number> {
    try {
      const fullScore = await this.scoreIntelligence(content);
      return fullScore.overall_score;
    } catch (error) {
      console.error('Quick score failed, returning neutral score');
      return 70; // Neutral score on failure
    }
  }
}

