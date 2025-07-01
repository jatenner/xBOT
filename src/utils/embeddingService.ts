import { openaiClient } from './openaiClient';

export class EmbeddingService {
  private cache = new Map<string, number[]>();
  
  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.hashText(text);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      const embedding = await openaiClient.embed(text.substring(0, 8000));
      this.cache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return new Array(1536).fill(0); // Return zero vector as fallback
    }
  }
  
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

export const embeddingService = new EmbeddingService(); 