/**
 * 🧠 AI HEALTH CONTENT JUDGE
 * 
 * Uses GPT-4o-mini to judge if tweets are health/wellness/fitness related
 * Replaces primitive keyword matching with intelligent context understanding
 * 
 * Batch processing: 50 tweets at once for efficiency
 * Cost: ~$0.0001 per tweet = $0.005 per 50 tweets
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface HealthJudgment {
  isHealthRelevant: boolean;
  score: number; // 0-10 (0=not health, 10=clearly health)
  category: 'fitness' | 'nutrition' | 'longevity' | 'mental_health' | 'supplements' | 'protocols' | 'medical' | 'wellness' | 'not_health';
  reason: string;
}

export class HealthContentJudge {
  private static instance: HealthContentJudge;

  private constructor() {}

  static getInstance(): HealthContentJudge {
    if (!HealthContentJudge.instance) {
      HealthContentJudge.instance = new HealthContentJudge();
    }
    return HealthContentJudge.instance;
  }

  /**
   * Batch judge health relevance for multiple tweets
   * More efficient than judging one at a time
   */
  async batchJudge(tweets: Array<{
    content: string;
    author: string;
    authorBio?: string;
  }>): Promise<HealthJudgment[]> {
    if (tweets.length === 0) return [];

    console.log(`[HEALTH_JUDGE] 🧠 Judging ${tweets.length} tweets for health relevance...`);

    try {
      // Process in batches of 50 (optimal for GPT-4o-mini)
      const BATCH_SIZE = 50;
      const allJudgments: HealthJudgment[] = [];

      for (let i = 0; i < tweets.length; i += BATCH_SIZE) {
        const batch = tweets.slice(i, i + BATCH_SIZE);
        const batchJudgments = await this.judgeBatch(batch);
        allJudgments.push(...batchJudgments);
      }

      const healthCount = allJudgments.filter(j => j.isHealthRelevant).length;
      const avgScore = allJudgments.reduce((sum, j) => sum + j.score, 0) / allJudgments.length;

      console.log(`[HEALTH_JUDGE] ✅ Judged ${tweets.length} tweets: ${healthCount} health-relevant (${Math.round(healthCount/tweets.length*100)}%)`);
      console.log(`[HEALTH_JUDGE] 📊 Average health score: ${avgScore.toFixed(1)}/10`);

      return allJudgments;
    } catch (error: any) {
      console.error('[HEALTH_JUDGE] ❌ Batch judgment failed:', error.message);
      // Return all as non-health to fail safely
      return tweets.map(() => ({
        isHealthRelevant: false,
        score: 0,
        category: 'not_health' as const,
        reason: 'Judgment failed'
      }));
    }
  }

  /**
   * Judge a single batch (up to 50 tweets)
   */
  private async judgeBatch(tweets: Array<{
    content: string;
    author: string;
    authorBio?: string;
  }>): Promise<HealthJudgment[]> {
    const prompt = `You are a health content expert. Judge if each tweet is related to health, wellness, fitness, nutrition, or medicine.

For each tweet, provide:
- score: 0-10 (0=completely unrelated, 10=clearly health-related)
- category: fitness, nutrition, longevity, mental_health, supplements, protocols, medical, wellness, or not_health
- reason: Brief explanation (10 words max)

TWEETS:
${tweets.map((t, i) => `
${i}. @${t.author}${t.authorBio ? ` (${t.authorBio.substring(0, 50)})` : ''}
   "${t.content.substring(0, 280)}"
`).join('\n')}

Return ONLY valid JSON (no markdown):
{
  "judgments": [
    {"index": 0, "score": 8, "category": "nutrition", "reason": "Discusses gut health and probiotics"},
    {"index": 1, "score": 2, "category": "not_health", "reason": "About politics, not health"}
  ]
}`;

    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a health content classifier. Return only valid JSON, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower = more consistent
      max_tokens: 2000
    });

    const content = response.choices[0].message.content || '{}';
    
    // Remove markdown formatting if present
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('[HEALTH_JUDGE] ❌ Failed to parse JSON:', jsonContent.substring(0, 200));
      throw new Error('Invalid JSON response from AI');
    }

    const judgments = parsed.judgments || [];

    // Map to our format
    return tweets.map((tweet, index) => {
      const judgment = judgments.find((j: any) => j.index === index);
      
      if (!judgment) {
        console.warn(`[HEALTH_JUDGE] ⚠️ Missing judgment for tweet ${index}`);
        return {
          isHealthRelevant: false,
          score: 0,
          category: 'not_health' as const,
          reason: 'No judgment received'
        };
      }

      const score = Number(judgment.score) || 0;
      
      return {
        isHealthRelevant: score >= 6, // Threshold: 6/10 or higher
        score,
        category: judgment.category || 'not_health',
        reason: judgment.reason || 'No reason provided'
      };
    });
  }

  /**
   * Judge a single tweet (convenience method)
   */
  async judgeSingle(tweet: {
    content: string;
    author: string;
    authorBio?: string;
  }): Promise<HealthJudgment> {
    const results = await this.batchJudge([tweet]);
    return results[0];
  }
}

// Singleton export
export const healthContentJudge = HealthContentJudge.getInstance();

