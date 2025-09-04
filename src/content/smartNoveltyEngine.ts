/**
 * Smart Novelty Engine - Uses OpenAI to generate unique content every time
 * Much simpler and more effective than hardcoded databases
 */

import OpenAI from 'openai';

export class SmartNoveltyEngine {
  private static instance: SmartNoveltyEngine;
  private recentTopics: string[] = [];
  private maxRecentTopics = 20; // Track recent topics to avoid repetition

  static getInstance(): SmartNoveltyEngine {
    if (!this.instance) {
      this.instance = new SmartNoveltyEngine();
    }
    return this.instance;
  }

  /**
   * Generate unique health content using OpenAI's vast knowledge
   */
  async generateUniqueHealthContent(openai: OpenAI, style: 'breaking' | 'investigative' | 'underground' | 'research' = 'underground'): Promise<string> {
    // Build prompt to avoid recent topics
    const avoidTopics = this.recentTopics.length > 0 ? 
      `AVOID these recently covered topics: ${this.recentTopics.join(', ')}` : '';

    const stylePrompts = {
      breaking: "Create breaking health news with shocking statistics",
      investigative: "Expose a health secret most doctors don't know", 
      underground: "Share underground biohacking knowledge from elite performers",
      research: "Reveal cutting-edge research findings most people haven't heard"
    };

    const prompt = `You are a health influencer sharing OBSCURE, LESSER-KNOWN health knowledge that 99% of people have never heard before.

${stylePrompts[style]}

REQUIREMENTS:
- Share truly OBSCURE health facts/tips most people don't know
- Include specific numbers, percentages, or timeframes
- Focus on actionable advice people can try immediately  
- Avoid common knowledge (everyone knows exercise/sleep is good)
- Be specific about mechanisms (how/why it works)
- Include surprising/counterintuitive elements

${avoidTopics}

EXAMPLES OF GOOD OBSCURE CONTENT:
"Your liver processes alcohol 50% faster when you eat pears beforehand due to specific enzymes"
"Humming for 30 seconds activates your vagus nerve and lowers cortisol by 23%"
"Cold water on wrists triggers mammalian dive reflex, slowing heart rate by 25%"

Generate ONE unique health fact/tip that people would think "I had no idea!" when reading it.

Response format: Just the content, no extra text.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.9 // High creativity for unique content
      });

      const content = response.choices?.[0]?.message?.content?.trim() || '';
      
      if (content) {
        // Extract topic for tracking
        const topic = this.extractMainTopic(content);
        this.trackTopic(topic);
        
        console.log(`🧠 NOVEL_CONTENT: Generated unique ${style} content about: ${topic}`);
        return content;
      }

      throw new Error('Empty response from OpenAI');
      
    } catch (error: any) {
      console.error('❌ NOVELTY_GENERATION_FAILED:', error.message);
      return this.getFallbackContent();
    }
  }

  /**
   * Check if content is unique compared to recent posts
   */
  isContentUnique(newContent: string, recentPosts: string[]): { isUnique: boolean; similarity: number } {
    if (recentPosts.length === 0) return { isUnique: true, similarity: 0 };

    let maxSimilarity = 0;
    const newWords = this.getContentWords(newContent);

    for (const recentPost of recentPosts.slice(-10)) { // Check last 10 posts
      const recentWords = this.getContentWords(recentPost);
      const similarity = this.calculateSimilarity(newWords, recentWords);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    const isUnique = maxSimilarity < 0.6; // 60% similarity threshold
    
    console.log(`🔍 UNIQUENESS_CHECK: ${Math.round(maxSimilarity * 100)}% similar to recent content`);
    
    return { isUnique, similarity: maxSimilarity };
  }

  /**
   * Generate content with uniqueness guarantee
   */
  async generateUniqueContent(openai: OpenAI, recentPosts: string[], maxRetries: number = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🎯 UNIQUENESS_ATTEMPT: ${attempt}/${maxRetries}`);
      
      // Vary style each attempt
      const styles = ['underground', 'investigative', 'research', 'breaking'] as const;
      const style = styles[(attempt - 1) % styles.length];
      
      const content = await this.generateUniqueHealthContent(openai, style);
      const { isUnique, similarity } = this.isContentUnique(content, recentPosts);
      
      if (isUnique) {
        console.log(`✅ UNIQUE_CONTENT: Generated on attempt ${attempt} (${Math.round((1-similarity)*100)}% unique)`);
        return content;
      }
      
      console.log(`🔄 RETRY: Content too similar (${Math.round(similarity*100)}%), retrying with different style...`);
    }

    console.warn('⚠️ UNIQUENESS_FALLBACK: Using fallback after max retries');
    return this.getFallbackContent();
  }

  private extractMainTopic(content: string): string {
    // Extract key health topic from content
    const healthKeywords = [
      'liver', 'brain', 'gut', 'heart', 'sleep', 'cortisol', 'serotonin', 
      'dopamine', 'metabolism', 'immune', 'hormone', 'vitamin', 'mineral',
      'microbiome', 'circadian', 'mitochondria', 'inflammation', 'antioxidant'
    ];

    const words = content.toLowerCase().split(/\s+/);
    for (const keyword of healthKeywords) {
      if (words.some(word => word.includes(keyword))) {
        return keyword;
      }
    }

    // Fallback: use first meaningful word
    return words.find(word => word.length > 4) || 'health';
  }

  private trackTopic(topic: string): void {
    this.recentTopics.push(topic);
    
    if (this.recentTopics.length > this.maxRecentTopics) {
      this.recentTopics.shift();
    }
    
    console.log(`📝 TOPIC_TRACKING: Added "${topic}" (${this.recentTopics.length} recent topics tracked)`);
  }

  private getContentWords(content: string): Set<string> {
    return new Set(
      content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
    );
  }

  private calculateSimilarity(words1: Set<string>, words2: Set<string>): number {
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private getFallbackContent(): string {
    // NO HARDCODED FALLBACKS - API should always work
    console.warn('⚠️ CRITICAL: OpenAI API failed completely. Check API key configuration.');
    return 'System temporarily unavailable. Please check OpenAI API configuration.';
  }
}

export default SmartNoveltyEngine;
