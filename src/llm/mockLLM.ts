/**
 * 🎭 MOCK LLM SYSTEM
 * Deterministic content generation and embedding simulation for shadow mode
 */

import { SeriesEngine } from '../series/seriesEngine';
import { incrementError } from '../api/metrics';

// Mock completion metrics
let mockMetrics = {
  llmBlocked: 0,
  mockCompletions: 0,
  mockEmbeddings: 0,
  uniqueBlocksCount: 0
};

export interface MockCompletion {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockEmbedding {
  data: Array<{
    embedding: number[];
  }>;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class MockLLMSystem {
  private seriesEngine: SeriesEngine;
  private seededRandom: (seed: string) => number;

  constructor() {
    this.seriesEngine = new SeriesEngine();
    
    // Deterministic seeded random for consistent mock content
    this.seededRandom = (seed: string): number => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash) / 2147483647; // Normalize to 0-1
    };
  }

  /**
   * Generate mock completion using series templates and heuristics
   */
  public async generateMockCompletion(prompt: string): Promise<MockCompletion> {
    console.log('[MOCK_LLM] 🎭 Generating deterministic completion...');
    mockMetrics.mockCompletions++;
    mockMetrics.llmBlocked++;

    try {
      // Extract intent from prompt
      const intent = this.extractIntent(prompt);
      let content = '';
      
      if (intent.type === 'health_content') {
        content = await this.generateHealthContent(intent);
      } else if (intent.type === 'reply') {
        content = await this.generateReply(intent);
      } else {
        content = await this.generateGenericContent(intent);
      }

      console.log(`[MOCK_LLM] ✅ Generated ${content.length} chars (${intent.type})`);

      return {
        choices: [{
          message: {
            content
          }
        }],
        usage: {
          prompt_tokens: Math.floor(prompt.length / 4), // Rough estimate
          completion_tokens: Math.floor(content.length / 4),
          total_tokens: Math.floor((prompt.length + content.length) / 4)
        }
      };
    } catch (error) {
      console.error('[MOCK_LLM] ❌ Mock completion failed:', error.message);
      incrementError();
      
      return {
        choices: [{
          message: {
            content: this.getFallbackContent()
          }
        }]
      };
    }
  }

  /**
   * Generate mock embedding using text hashing for deterministic vectors
   */
  public async generateMockEmbedding(text: string): Promise<MockEmbedding> {
    console.log('[MOCK_LLM] 🎭 Generating deterministic embedding...');
    mockMetrics.mockEmbeddings++;

    // Generate 256-dimensional vector based on text hash
    const embedding = this.textToVector(text, 256);
    
    return {
      data: [{
        embedding
      }],
      usage: {
        prompt_tokens: Math.floor(text.length / 4),
        total_tokens: Math.floor(text.length / 4)
      }
    };
  }

  /**
   * Convert text to deterministic vector for cosine similarity
   */
  private textToVector(text: string, dimensions: number): number[] {
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    
    const vector = new Array(dimensions).fill(0);
    
    // Hash each word and distribute across dimensions
    words.forEach((word, wordIndex) => {
      for (let i = 0; i < dimensions; i++) {
        const seed = `${word}_${i}_${wordIndex}`;
        const hash = this.seededRandom(seed);
        vector[i] += hash * 0.1; // Weight each word contribution
      }
    });
    
    // Normalize vector to unit length for cosine similarity
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }
    
    return vector;
  }

  /**
   * Extract intent and context from prompt
   */
  private extractIntent(prompt: string): any {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('health') || lower.includes('wellness') || lower.includes('nutrition')) {
      return {
        type: 'health_content',
        topic: this.extractTopic(prompt),
        angle: this.extractAngle(prompt),
        format: this.extractFormat(prompt)
      };
    }
    
    if (lower.includes('reply') || lower.includes('respond')) {
      return {
        type: 'reply',
        context: this.extractReplyContext(prompt)
      };
    }
    
    return {
      type: 'generic',
      context: prompt.substring(0, 100)
    };
  }

  /**
   * Generate health content using series templates
   */
  private async generateHealthContent(intent: any): Promise<string> {
    // Use series engine for structured content
    const templates = ['myth-monday', 'snack-science', 'mini-challenge'];
    const selectedTemplate = templates[Math.floor(this.seededRandom(intent.topic) * templates.length)];
    
    try {
      const seriesContent = await this.seriesEngine.generateSeriesContent(selectedTemplate);
      return seriesContent.textBlock;
    } catch (error) {
      // Fallback to heuristic generation
      return this.generateHeuristicHealthContent(intent);
    }
  }

  /**
   * Generate reply content
   */
  private async generateReply(intent: any): Promise<string> {
    const replyTemplates = [
      "Great point! Here's an additional insight: {insight}",
      "Absolutely! The research shows {fact}. What's your experience with this?",
      "This aligns with recent studies on {topic}. Have you tried {suggestion}?",
      "Excellent observation! For readers wanting to learn more: {resource}"
    ];
    
    const template = replyTemplates[Math.floor(this.seededRandom(intent.context) * replyTemplates.length)];
    
    return template
      .replace('{insight}', this.getRandomHealthInsight())
      .replace('{fact}', this.getRandomHealthFact())
      .replace('{topic}', intent.context.split(' ').slice(0, 2).join(' '))
      .replace('{suggestion}', this.getRandomSuggestion())
      .replace('{resource}', this.getRandomResource());
  }

  /**
   * Generate generic content
   */
  private async generateGenericContent(intent: any): Promise<string> {
    const genericTemplates = [
      "Based on current research, {topic} shows promising results for health optimization.",
      "Recent studies indicate that {factor} can significantly impact {outcome}.",
      "For those interested in {area}, the evidence suggests {recommendation}."
    ];
    
    const template = genericTemplates[Math.floor(this.seededRandom(intent.context) * genericTemplates.length)];
    
    return template
      .replace('{topic}', 'evidence-based approaches')
      .replace('{factor}', 'lifestyle modifications')
      .replace('{outcome}', 'wellness outcomes')
      .replace('{area}', 'health optimization')
      .replace('{recommendation}', 'a systematic approach');
  }

  /**
   * Heuristic health content generation
   */
  private generateHeuristicHealthContent(intent: any): string {
    const healthTopics = [
      'sleep optimization', 'gut microbiome', 'circadian rhythms', 'stress management',
      'nutrition timing', 'exercise recovery', 'mental clarity', 'immune function'
    ];
    
    const topic = healthTopics[Math.floor(this.seededRandom(intent.topic) * healthTopics.length)];
    
    return `🧬 Health Insight: ${topic}

Recent research reveals that ${topic} plays a crucial role in overall wellness. Studies show that small, consistent changes in this area can lead to significant improvements in health markers.

Key takeaway: Focus on evidence-based approaches rather than trends for lasting results.

What's your experience with optimizing ${topic}?`;
  }

  // Helper methods for content generation
  private extractTopic(prompt: string): string {
    const healthKeywords = ['sleep', 'nutrition', 'exercise', 'stress', 'gut', 'immune', 'brain'];
    const words = prompt.toLowerCase().split(/\s+/);
    return healthKeywords.find(keyword => words.some(word => word.includes(keyword))) || 'wellness';
  }

  private extractAngle(prompt: string): string {
    if (prompt.includes('myth')) return 'myth-busting';
    if (prompt.includes('science')) return 'research-based';
    if (prompt.includes('tip')) return 'actionable';
    return 'educational';
  }

  private extractFormat(prompt: string): string {
    if (prompt.includes('thread')) return 'thread';
    if (prompt.includes('list')) return 'list';
    return 'single';
  }

  private extractReplyContext(prompt: string): string {
    return prompt.substring(prompt.indexOf('reply') + 5, prompt.indexOf('reply') + 50).trim();
  }

  private getRandomHealthInsight(): string {
    const insights = [
      'the gut-brain axis influences mood regulation',
      'cold exposure can boost brown fat activation',
      'timing carbs around workouts optimizes performance',
      'morning light exposure regulates circadian rhythms'
    ];
    return insights[Math.floor(Math.random() * insights.length)];
  }

  private getRandomHealthFact(): string {
    const facts = [
      'walking after meals reduces blood sugar spikes by 30%',
      'adequate sleep improves immune function by 70%',
      'social connections impact longevity more than exercise',
      'deep breathing activates the parasympathetic nervous system'
    ];
    return facts[Math.floor(Math.random() * facts.length)];
  }

  private getRandomSuggestion(): string {
    const suggestions = [
      'tracking your sleep quality for a week',
      'experimenting with meal timing',
      'incorporating daily walks',
      'practicing gratitude journaling'
    ];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  private getRandomResource(): string {
    const resources = [
      'recent meta-analyses support this approach',
      'several longitudinal studies confirm these benefits',
      'clinical trials show promising results',
      'peer-reviewed research validates this strategy'
    ];
    return resources[Math.floor(Math.random() * resources.length)];
  }

  private getFallbackContent(): string {
    return `Health tip: Evidence-based wellness approaches consistently outperform trends. Focus on fundamentals: quality sleep, balanced nutrition, regular movement, and stress management for optimal results.`;
  }

  /**
   * Get current mock metrics
   */
  public getMetrics() {
    return { ...mockMetrics };
  }

  /**
   * Reset metrics (for testing)
   */
  public resetMetrics() {
    mockMetrics = {
      llmBlocked: 0,
      mockCompletions: 0,
      mockEmbeddings: 0,
      uniqueBlocksCount: 0
    };
  }
}
