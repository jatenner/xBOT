/**
 * INTELLIGENT TOPIC SELECTOR
 * Pick topics based on trending health topics + competitive intelligence
 * 
 * Strategy: Don't pick randomly - pick what's HOT right now
 */

import { budgetedOpenAI } from '../services/openaiBudgetedClient';
import { competitiveIntelligence } from './competitiveIntelligence';

export interface TopicSuggestion {
  topic: string;
  reasoning: string;
  viral_potential: number; // 1-10
  trend_score: number; // 1-10
  uniqueness: number; // 1-10
}

class IntelligentTopicSelector {
  private cachedTopics: TopicSuggestion[] = [];
  private cacheExpiry: Date | null = null;
  private CACHE_DURATION_HOURS = 6; // Refresh every 6 hours

  /**
   * Select best topic for content generation
   */
  async selectTopic(context: {
    recent_topics?: string[];
    generator_type?: string;
    time_of_day?: number;
  }): Promise<TopicSuggestion> {
    // Get trending topics
    const suggestions = await this.getTrendingTopics();

    // Filter out recently used topics
    const recentTopics = context.recent_topics || [];
    const freshSuggestions = suggestions.filter(
      s => !recentTopics.some(rt => rt.toLowerCase().includes(s.topic.toLowerCase()))
    );

    // Pick highest viral potential
    const sortedByPotential = freshSuggestions.sort((a, b) => b.viral_potential - a.viral_potential);

    if (sortedByPotential.length > 0) {
      const selected = sortedByPotential[0];
      console.log(`[TOPIC_SELECTOR] 🎯 Selected: "${selected.topic}" (viral: ${selected.viral_potential}/10)`);
      return selected;
    }

    // Fallback to any suggestion
    if (suggestions.length > 0) {
      return suggestions[0];
    }

    // Ultimate fallback
    return {
      topic: 'health optimization',
      reasoning: 'Fallback to general health topic',
      viral_potential: 5,
      trend_score: 5,
      uniqueness: 5
    };
  }

  /**
   * Get trending health topics (cached)
   */
  private async getTrendingTopics(): Promise<TopicSuggestion[]> {
    // Check cache
    if (this.cachedTopics.length > 0 && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cachedTopics;
    }

    console.log('[TOPIC_SELECTOR] 🔍 Researching trending health topics...');

    try {
      // Get competitive insights
      const compInsights = await competitiveIntelligence.getInsights();

      // Ask AI to analyze current trends
      const response = await budgetedOpenAI.chatComplete({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `You are a health content strategist. Analyze what health topics are trending RIGHT NOW.

CONTEXT:
- Successful accounts are posting about: ${compInsights.trending_topics.join(', ')}
- Current date: ${new Date().toLocaleDateString()}
- Target: Small health account (31 followers) needs viral potential

Suggest 10 health topics that:
1. Are trending/timely right now
2. Have high viral potential
3. Are specific enough to be interesting
4. Work for evidence-based health content

Format as JSON array:
[
  {
    "topic": "specific topic name",
    "reasoning": "why it's trending now",
    "viral_potential": <1-10>,
    "trend_score": <1-10>,
    "uniqueness": <1-10>
  }
]

Examples of GOOD topics:
- "Cold plunge timing for cortisol" (specific, timely)
- "Magnesium threonate for sleep" (specific compound)
- "Morning light vs evening light" (counterintuitive comparison)

Examples of BAD topics:
- "Sleep" (too broad)
- "Exercise" (too generic)
- "Stress management" (boring)

Return ONLY the JSON array.`
        }],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'topic_trend_analysis',
        priority: 'medium'
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No topics generated');
      }

      const parsed = JSON.parse(result);
      const suggestions: TopicSuggestion[] = parsed.topics || parsed.suggestions || [];

      if (suggestions.length === 0) {
        throw new Error('Empty suggestions array');
      }

      // Cache results
      this.cachedTopics = suggestions;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000);

      console.log(`[TOPIC_SELECTOR] ✅ Loaded ${suggestions.length} trending topics`);

      return suggestions;

    } catch (error) {
      console.error('[TOPIC_SELECTOR] ❌ Failed to get trending topics:', error);
      
      // Fallback to competitive insights
      const compInsights = await competitiveIntelligence.getInsights();
      return compInsights.trending_topics.map(topic => ({
        topic,
        reasoning: 'From competitive intelligence',
        viral_potential: 7,
        trend_score: 7,
        uniqueness: 6
      }));
    }
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cachedTopics = [];
    this.cacheExpiry = null;
    console.log('[TOPIC_SELECTOR] 🗑️  Cache cleared');
  }
}

// Singleton instance
export const intelligentTopicSelector = new IntelligentTopicSelector();

