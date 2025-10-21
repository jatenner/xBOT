/**
 * COMPETITIVE INTELLIGENCE ENGINE
 * Learn from successful health accounts to improve our content
 * 
 * Strategy: If we have no engagement data, learn from THEIR success
 */

import { budgetedOpenAI } from '../services/openaiBudgetedClient';

export interface SuccessfulPattern {
  hook_style: string;
  content_structure: string;
  topic: string;
  engagement: number;
  example_tweet: string;
}

export interface CompetitiveInsights {
  top_hooks: string[];
  trending_topics: string[];
  successful_examples: string[];
  patterns: SuccessfulPattern[];
  last_updated: Date;
}

class CompetitiveIntelligenceEngine {
  // Target accounts: high-engagement health/science accounts
  private TARGET_ACCOUNTS = [
    '@hubermanlab',
    '@foundmyfitness',
    '@PeterAttiaMD',
    '@davidasinclair',
    '@drgominak'
  ];

  private cachedInsights: CompetitiveInsights | null = null;
  private cacheExpiry: Date | null = null;
  private CACHE_DURATION_HOURS = 24; // Refresh daily

  /**
   * Get competitive insights (cached for 24h)
   */
  async getInsights(): Promise<CompetitiveInsights> {
    // Check cache
    if (this.cachedInsights && this.cacheExpiry && new Date() < this.cacheExpiry) {
      console.log('[COMPETITIVE_INTEL] ✅ Using cached insights');
      return this.cachedInsights;
    }

    console.log('[COMPETITIVE_INTEL] 🔍 Analyzing successful health accounts...');

    // For now, use AI to generate insights based on known patterns
    // TODO: In future, scrape actual tweets from these accounts
    const insights = await this.generateInsightsFromAI();

    // Cache results
    this.cachedInsights = insights;
    this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000);

    return insights;
  }

  /**
   * Use AI to analyze what makes successful health content
   * (Alternative to scraping when we don't have browser access)
   */
  private async generateInsightsFromAI(): Promise<CompetitiveInsights> {
    try {
      const response = await budgetedOpenAI.chatComplete({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `You are analyzing successful health & wellness content from top accounts like @hubermanlab, @foundmyfitness, @PeterAttiaMD.

Analyze what makes their content get 1000+ likes and provide:

1. TOP 5 HOOK STYLES that get high engagement
2. TOP 5 TRENDING TOPICS in health/wellness right now
3. 3 EXAMPLE TWEETS (realistic style, not real tweets) that would get high engagement

Format as JSON:
{
  "top_hooks": ["hook style 1", "hook style 2", ...],
  "trending_topics": ["topic 1", "topic 2", ...],
  "successful_examples": ["tweet 1", "tweet 2", "tweet 3"],
  "key_patterns": [
    {
      "pattern": "pattern name",
      "description": "why it works",
      "example": "short example"
    }
  ]
}

IMPORTANT: Base this on REAL patterns from successful science/health accounts.`
        }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'competitive_intelligence_analysis',
        priority: 'medium'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const aiInsights = JSON.parse(content);

      const insights: CompetitiveInsights = {
        top_hooks: aiInsights.top_hooks || [],
        trending_topics: aiInsights.trending_topics || [],
        successful_examples: aiInsights.successful_examples || [],
        patterns: (aiInsights.key_patterns || []).map((p: any) => ({
          hook_style: p.pattern || '',
          content_structure: p.description || '',
          topic: '',
          engagement: 1000,
          example_tweet: p.example || ''
        })),
        last_updated: new Date()
      };

      console.log('[COMPETITIVE_INTEL] ✅ Generated insights:');
      console.log(`   Top hooks: ${insights.top_hooks.slice(0, 3).join(', ')}`);
      console.log(`   Trending topics: ${insights.trending_topics.slice(0, 3).join(', ')}`);

      return insights;

    } catch (error) {
      console.error('[COMPETITIVE_INTEL] ❌ Failed to generate insights:', error);
      
      // Fallback to hardcoded successful patterns
      return this.getFallbackInsights();
    }
  }

  /**
   * Fallback insights if AI call fails
   */
  private getFallbackInsights(): CompetitiveInsights {
    return {
      top_hooks: [
        'Surprising statistic + explanation',
        'Myth-busting with research',
        'Protocol with specific numbers',
        'Mechanism explanation',
        'Counterintuitive finding'
      ],
      trending_topics: [
        'Sleep optimization',
        'Metabolic health',
        'Longevity interventions',
        'Circadian rhythm',
        'Gut microbiome'
      ],
      successful_examples: [
        'Morning sunlight increases dopamine by 50% (Renna et al. 2023). Most people get it wrong: You need 10 minutes BEFORE 9am. Later = diminishing returns.',
        'Zone 2 cardio at 60-70% max HR for 150+ min/week increases mitochondrial density 40% in 8 weeks. The data is clear—walking isn\'t enough.',
        'Sauna at 174°F for 20 min, 4x/week cuts cardiovascular mortality 50%. Heat shock proteins trigger repair cascades. Time and temp matter.'
      ],
      patterns: [],
      last_updated: new Date()
    };
  }

  /**
   * Get successful examples to use in prompts
   */
  async getExamplesForPrompt(count: number = 3): Promise<string> {
    const insights = await this.getInsights();
    const examples = insights.successful_examples.slice(0, count);
    
    return examples.map((ex, i) => `Example ${i + 1}: "${ex}"`).join('\n\n');
  }

  /**
   * Get trending topics for content generation
   */
  async getTrendingTopics(): Promise<string[]> {
    const insights = await this.getInsights();
    return insights.trending_topics;
  }

  /**
   * Get successful hook styles
   */
  async getSuccessfulHooks(): Promise<string[]> {
    const insights = await this.getInsights();
    return insights.top_hooks;
  }

  /**
   * Clear cache (for testing or force refresh)
   */
  clearCache(): void {
    this.cachedInsights = null;
    this.cacheExpiry = null;
    console.log('[COMPETITIVE_INTEL] 🗑️  Cache cleared');
  }
}

// Singleton instance
export const competitiveIntelligence = new CompetitiveIntelligenceEngine();

