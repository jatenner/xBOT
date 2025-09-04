/**
 * Smart Novelty Engine - Uses OpenAI to generate unique content every time
 * Much simpler and more effective than hardcoded databases
 */

import OpenAI from 'openai';
import AdvancedPromptEngine from '../ai/advancedPrompts';

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
   * Generate unique health content using ADVANCED PROMPTING SYSTEM
   */
  async generateUniqueHealthContent(openai: OpenAI, style: 'breaking' | 'investigative' | 'underground' | 'research' = 'underground'): Promise<string> {
    console.log(`🚀 ADVANCED_PROMPTING: Generating ${style} content with enhanced prompts`);

    // Map simple styles to advanced prompt styles
    const styleMap = {
      breaking: 'viral_breaking' as const,
      investigative: 'investigative_expose' as const,
      underground: 'underground_secret' as const,
      research: 'scientific_discovery' as const
    };

    // Generate advanced prompt
    const prompt = AdvancedPromptEngine.generateOptimizedPrompt({
      style: styleMap[style],
      obscurity_level: 4, // High obscurity for unique content
      audience_sophistication: 'health_conscious',
      content_type: 'single_tweet',
      avoid_topics: this.recentTopics,
      recent_content: [] // Could add recent content if available
    });

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // Use more powerful model for better prompts
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.8, // Balanced creativity and coherence
        top_p: 0.9,
        frequency_penalty: 0.3, // Reduce repetition
        presence_penalty: 0.2 // Encourage novel topics
      });

      const content = response.choices?.[0]?.message?.content?.trim() || '';
      
      if (content) {
        // Extract topic for tracking
        const topic = this.extractMainTopic(content);
        this.trackTopic(topic);
        
        console.log(`🎯 ADVANCED_CONTENT: Generated ${style} content about: ${topic}`);
        console.log(`📝 CONTENT_PREVIEW: "${content.substring(0, 80)}..."`);
        return content;
      }

      throw new Error('Empty response from OpenAI');
      
    } catch (error: any) {
      console.error('❌ ADVANCED_GENERATION_FAILED:', error.message);
      return this.getFallbackContent();
    }
  }

  /**
   * Check if content is unique compared to recent posts - ENHANCED for better detection
   */
  isContentUnique(newContent: string, recentPosts: string[]): { isUnique: boolean; similarity: number; reason?: string } {
    if (recentPosts.length === 0) return { isUnique: true, similarity: 0 };

    let maxSimilarity = 0;
    let similarPost = '';
    const newWords = this.getContentWords(newContent);
    const newLower = newContent.toLowerCase();

    for (const recentPost of recentPosts.slice(-15)) { // Check last 15 posts
      const recentWords = this.getContentWords(recentPost);
      const recentLower = recentPost.toLowerCase();
      
      // Multiple similarity checks
      const wordSimilarity = this.calculateSimilarity(newWords, recentWords);
      const phraseSimilarity = this.calculatePhraseSimilarity(newLower, recentLower);
      const conceptSimilarity = this.calculateConceptSimilarity(newContent, recentPost);
      
      const overallSimilarity = Math.max(wordSimilarity, phraseSimilarity, conceptSimilarity);
      
      if (overallSimilarity > maxSimilarity) {
        maxSimilarity = overallSimilarity;
        similarPost = recentPost.substring(0, 50) + '...';
      }
    }

    const isUnique = maxSimilarity < 0.5; // Stricter 50% threshold
    const reason = !isUnique ? `Too similar to: "${similarPost}"` : undefined;
    
    console.log(`🔍 ENHANCED_UNIQUENESS_CHECK: ${Math.round(maxSimilarity * 100)}% similar to recent content`);
    if (reason) console.log(`⚠️ SIMILARITY_REASON: ${reason}`);
    
    return { isUnique, similarity: maxSimilarity, reason };
  }

  /**
   * Generate specialized content (replies, threads, etc.)
   */
  async generateSpecializedContent(openai: OpenAI, type: 'reply_to_post' | 'unique_health_fact' | 'viral_thread', context?: any): Promise<string> {
    console.log(`🎯 SPECIALIZED_CONTENT: Generating ${type} with advanced prompts`);

    const prompt = AdvancedPromptEngine.getSpecializedPrompt(type, context);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: type === 'viral_thread' ? 300 : 200,
        temperature: 0.8,
        top_p: 0.9,
        frequency_penalty: 0.4, // Higher for specialized content
        presence_penalty: 0.3
      });

      const content = response.choices?.[0]?.message?.content?.trim() || '';
      
      if (content) {
        console.log(`✅ SPECIALIZED_SUCCESS: Generated ${type}`);
        console.log(`📝 CONTENT_PREVIEW: "${content.substring(0, 80)}..."`);
        return content;
      }

      throw new Error('Empty specialized content response');
      
    } catch (error: any) {
      console.error(`❌ SPECIALIZED_GENERATION_FAILED (${type}):`, error.message);
      return this.getFallbackContent();
    }
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
    // Add to recent topics
    this.recentTopics.push(topic);
    
    // Also track specific overused topics with higher penalty
    const overusedTopics = ['magnesium', 'supplement timing', '99% of people'];
    const topicLower = topic.toLowerCase();
    
    for (const overused of overusedTopics) {
      if (topicLower.includes(overused)) {
        // Add multiple times to prevent re-use
        this.recentTopics.push(overused);
        this.recentTopics.push(overused);
        console.log(`🚨 OVERUSED_TOPIC_PENALTY: "${overused}" added with extra weight to prevent reuse`);
      }
    }
    
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

  private calculatePhraseSimilarity(text1: string, text2: string): number {
    // Check for similar phrases and sentence structures
    const phrases1 = text1.split(/[.!?]+/).map(p => p.trim()).filter(p => p.length > 10);
    const phrases2 = text2.split(/[.!?]+/).map(p => p.trim()).filter(p => p.length > 10);
    
    let maxPhraseSimilarity = 0;
    
    for (const phrase1 of phrases1) {
      for (const phrase2 of phrases2) {
        const words1 = new Set(phrase1.split(/\s+/));
        const words2 = new Set(phrase2.split(/\s+/));
        const similarity = this.calculateSimilarity(words1, words2);
        maxPhraseSimilarity = Math.max(maxPhraseSimilarity, similarity);
      }
    }
    
    return maxPhraseSimilarity;
  }

  private calculateConceptSimilarity(text1: string, text2: string): number {
    // Enhanced similarity detection including hooks and patterns
    const healthConcepts = [
      'sleep', 'magnesium', 'cortisol', 'serotonin', 'dopamine', 'vitamin',
      'protein', 'fasting', 'metabolism', 'inflammation', 'gut', 'microbiome',
      'circadian', 'hormone', 'stress', 'anxiety', 'depression', 'energy',
      'brain', 'liver', 'heart', 'blood', 'immune', 'cold', 'heat', 'breathing'
    ];
    
    // Check for repetitive hooks/openings
    const commonHooks = [
      '99% of people', '95% of people', 'most people are doing', 'here\'s why',
      'take magnesium', 'supplement timing', 'better sleep', 'for better'
    ];
    
    const text1Lower = text1.toLowerCase();
    const text2Lower = text2.toLowerCase();
    
    // Check for hook similarity (higher weight)
    let hookSimilarity = 0;
    for (const hook of commonHooks) {
      if (text1Lower.includes(hook) && text2Lower.includes(hook)) {
        hookSimilarity += 0.8; // High penalty for same hooks
      }
    }
    
    // Check for concept similarity
    const concepts1 = healthConcepts.filter(concept => text1Lower.includes(concept));
    const concepts2 = healthConcepts.filter(concept => text2Lower.includes(concept));
    
    if (concepts1.length === 0 || concepts2.length === 0) return hookSimilarity;
    
    const commonConcepts = concepts1.filter(concept => concepts2.includes(concept));
    const conceptSimilarity = commonConcepts.length / Math.max(concepts1.length, concepts2.length);
    
    return Math.max(hookSimilarity, conceptSimilarity);
  }

  private getFallbackContent(): string {
    // NO HARDCODED FALLBACKS - API should always work
    console.warn('⚠️ CRITICAL: OpenAI API failed completely. Check API key configuration.');
    return 'System temporarily unavailable. Please check OpenAI API configuration.';
  }
}

export default SmartNoveltyEngine;
