/**
 * CONTENT REFINEMENT ENGINE
 * Multi-layer AI improvement: Generate → Critique → Improve → Verify
 * 
 * Philosophy: Never post first draft. AI improves its own content.
 */

import { budgetedOpenAI } from '../services/openaiBudgetedClient';
import { competitiveIntelligence } from './competitiveIntelligence';

export interface RefinementResult {
  original_content: string;
  refined_content: string;
  improvements_made: string[];
  quality_increase: number;
  engagement_prediction: number;
  should_use_refined: boolean;
}

export interface ContentCritique {
  score: number; // 1-10
  strengths: string[];
  weaknesses: string[];
  improvement_suggestions: string[];
  boring_score: number; // 1-10, higher = more boring
  engagement_prediction: number; // estimated likes
}

class ContentRefinementEngine {
  /**
   * Main refinement pipeline
   */
  async refineContent(
    content: string,
    context: {
      generator_used?: string;
      topic?: string;
      recent_posts?: string[];
    }
  ): Promise<RefinementResult> {
    console.log('[REFINEMENT] 🎨 Starting multi-layer refinement...');

    // Layer 1: AI Critique
    const critique = await this.critiqueContent(content, context);
    console.log(`[REFINEMENT] 📊 Critique score: ${critique.score}/10`);

    // If score is already excellent, skip refinement
    if (critique.score >= 8.5) {
      console.log('[REFINEMENT] ✅ Content already excellent, skipping refinement');
      return {
        original_content: content,
        refined_content: content,
        improvements_made: ['Content passed critique with high score'],
        quality_increase: 0,
        engagement_prediction: critique.engagement_prediction,
        should_use_refined: false
      };
    }

    // Layer 2: Improve based on critique
    const improved = await this.improveContent(content, critique, context);

    // Layer 3: Verify improvement
    const verificationCritique = await this.critiqueContent(improved, context);
    const qualityIncrease = verificationCritique.score - critique.score;

    console.log(`[REFINEMENT] ✅ Quality improved: ${critique.score} → ${verificationCritique.score} (+${qualityIncrease.toFixed(1)})`);

    return {
      original_content: content,
      refined_content: improved,
      improvements_made: critique.improvement_suggestions,
      quality_increase: qualityIncrease,
      engagement_prediction: verificationCritique.engagement_prediction,
      should_use_refined: verificationCritique.score > critique.score
    };
  }

  /**
   * Layer 1: AI critiques content
   */
  private async critiqueContent(
    content: string,
    context: {
      generator_used?: string;
      topic?: string;
      recent_posts?: string[];
    }
  ): Promise<ContentCritique> {
    try {
      // Get successful examples for comparison
      const successfulExamples = await competitiveIntelligence.getExamplesForPrompt(2);

      const response = await budgetedOpenAI.chatComplete({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `You are an expert health content critic. Analyze this tweet for a 31-follower account:

TWEET TO CRITIQUE:
"${content}"

CONTEXT:
- Generator: ${context.generator_used || 'unknown'}
- Topic: ${context.topic || 'general health'}
- Recent posts: ${context.recent_posts?.length || 0} in history

SUCCESSFUL EXAMPLES (1000+ likes):
${successfulExamples}

Rate this tweet 1-10 and provide:
1. Score (1-10, be HONEST)
2. Strengths (what works well)
3. Weaknesses (what's wrong)
4. Specific improvements needed
5. Boring score (1-10, higher = more boring)
6. Estimated engagement (how many likes from 31 followers)

Consider:
- Hook strength (grabs attention?)
- Value (actionable insight?)
- Uniqueness (different from recent posts?)
- Engagement potential (would YOU like/share this?)
- Too academic/boring?
- Too similar to examples?

Format as JSON:
{
  "score": <1-10>,
  "strengths": ["strength 1", ...],
  "weaknesses": ["weakness 1", ...],
  "improvement_suggestions": ["suggestion 1", ...],
  "boring_score": <1-10>,
  "engagement_prediction": <0-10>
}

Be critical. Don't inflate scores.`
        }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'content_critique',
        priority: 'high'
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No critique generated');
      }

      const parsed = JSON.parse(result);

      return {
        score: parsed.score || 5,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        improvement_suggestions: parsed.improvement_suggestions || [],
        boring_score: parsed.boring_score || 5,
        engagement_prediction: parsed.engagement_prediction || 0
      };

    } catch (error) {
      console.error('[REFINEMENT] ❌ Critique failed:', error);
      
      // Fallback: basic critique
      return {
        score: 6,
        strengths: ['Clear message'],
        weaknesses: ['Unknown - critique failed'],
        improvement_suggestions: ['Add more specific data'],
        boring_score: 5,
        engagement_prediction: 1
      };
    }
  }

  /**
   * Layer 2: Improve content based on critique
   */
  private async improveContent(
    content: string,
    critique: ContentCritique,
    context: any
  ): Promise<string> {
    try {
      // Get successful patterns to emulate
      const successfulExamples = await competitiveIntelligence.getExamplesForPrompt(2);

      const response = await budgetedOpenAI.chatComplete({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `Improve this health tweet to maximize engagement:

ORIGINAL TWEET (Score: ${critique.score}/10):
"${content}"

CRITIQUE:
Weaknesses: ${critique.weaknesses.join(', ')}
Boring score: ${critique.boring_score}/10

IMPROVEMENTS NEEDED:
${critique.improvement_suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

SUCCESSFUL EXAMPLES TO EMULATE:
${successfulExamples}

REQUIREMENTS:
✅ Keep core insight but make it MORE engaging
✅ Strengthen hook (surprise, data, question)
✅ Add specific numbers/mechanisms
✅ Make it shareable
✅ Under 270 characters
✅ Sound human, not academic

❌ Don't lose the scientific credibility
❌ Don't make it clickbait
❌ Don't copy examples exactly

Return ONLY the improved tweet, nothing else.`
        }],
        temperature: 0.7,
        max_tokens: 150
      }, {
        purpose: 'content_improvement',
        priority: 'high'
      });

      const improved = response.choices[0]?.message?.content?.trim();
      
      if (!improved || improved.length > 280) {
        console.log('[REFINEMENT] ⚠️ Improvement failed validation, keeping original');
        return content;
      }

      return improved;

    } catch (error) {
      console.error('[REFINEMENT] ❌ Improvement failed:', error);
      return content; // Return original if improvement fails
    }
  }

  /**
   * Quick check: Is content boring/repetitive?
   */
  async isContentBoring(content: string, recentPosts: string[] = []): Promise<{
    is_boring: boolean;
    reason: string;
    similarity_to_recent: number;
  }> {
    // Simple heuristic checks
    const boringPatterns = [
      /^Protocol:/i,
      /^Step \d+:/i,
      /optimization protocol/i,
      /comprehensive/i,
      /let's dive/i,
      /stay tuned/i
    ];

    for (const pattern of boringPatterns) {
      if (pattern.test(content)) {
        return {
          is_boring: true,
          reason: `Matches boring pattern: ${pattern.source}`,
          similarity_to_recent: 0
        };
      }
    }

    // Check similarity to recent posts
    if (recentPosts.length > 0) {
      const similarities = recentPosts.map(post => {
        const contentWords = new Set(content.toLowerCase().split(/\s+/));
        const postWords = new Set(post.toLowerCase().split(/\s+/));
        const intersection = new Set([...contentWords].filter(w => postWords.has(w)));
        return intersection.size / Math.max(contentWords.size, postWords.size);
      });

      const maxSimilarity = Math.max(...similarities);
      if (maxSimilarity > 0.6) {
        return {
          is_boring: true,
          reason: `Too similar to recent post (${(maxSimilarity * 100).toFixed(0)}% overlap)`,
          similarity_to_recent: maxSimilarity
        };
      }
    }

    return {
      is_boring: false,
      reason: 'Content passed boring checks',
      similarity_to_recent: 0
    };
  }
}

// Singleton instance
export const contentRefinementEngine = new ContentRefinementEngine();

